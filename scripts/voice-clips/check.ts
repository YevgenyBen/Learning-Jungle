import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ItemId, SpokenItem } from "../../src/content";
import type { ClipCheck, ClipChecks } from "../../src/voice/review/suspects";

/** What a speech recognizer heard in a clip. */
export type Transcription = Omit<ClipCheck, "audio">;

/** Hears what a clip says. The real one is Azure (azure.ts); tests pass a stand-in. */
export interface Transcriber {
  transcribe(audio: Uint8Array, file: string): Promise<Transcription>;
}

export interface CheckOptions {
  /** Every spoken item (`contentBank.spokenItems()`). */
  readonly items: readonly SpokenItem[];
  /** The folder holding the clips and manifest.json (`public/voice`). */
  readonly voiceDir: string;
  /** Where the results are kept (`src/voice/review/clipChecks.json`). */
  readonly reportPath: string;
  /** Called only when there is something to check, so a missing key fails only then. */
  readonly transcriber: () => Transcriber;
  /** Check exactly these identities again, changed or not. */
  readonly only?: readonly ItemId[];
  /** Called after each clip is checked. */
  readonly onChecked?: (id: ItemId, done: number, total: number) => void;
}

export interface CheckReport {
  /** Identities whose clip was transcribed this run. */
  readonly checked: readonly ItemId[];
}

const fingerprint = (audio: Uint8Array) => createHash("sha256").update(audio).digest("hex").slice(0, 16);

/**
 * Transcribes every Voice Clip whose audio has not been checked yet (new,
 * regenerated or replaced), and keeps the results for the review page.
 */
export async function checkVoiceClips(options: CheckOptions): Promise<CheckReport> {
  const { items, voiceDir, reportPath } = options;
  const manifest = JSON.parse(readFileSync(join(voiceDir, "manifest.json"), "utf8")) as {
    clips: Record<ItemId, { file: string }>;
  };
  const before: ClipChecks = existsSync(reportPath)
    ? (JSON.parse(readFileSync(reportPath, "utf8")) as ClipChecks)
    : { checks: {} };
  const checks: Record<ItemId, ClipCheck> = {};

  /** Writes the results in Content Bank order, so diffs stay small. */
  const save = () => {
    const ordered: Record<ItemId, ClipCheck> = {};
    for (const item of items) if (checks[item.id]) ordered[item.id] = checks[item.id];
    const text = JSON.stringify({ checks: ordered }, null, 2) + "\n";
    const old = existsSync(reportPath) ? readFileSync(reportPath, "utf8").replace(/\r\n/g, "\n") : "";
    if (old !== text) writeFileSync(reportPath, text);
  };

  if (options.only) {
    const known = new Set(items.map((item) => item.id));
    const unknown = options.only.filter((id) => !known.has(id) || !manifest.clips[id]);
    if (unknown.length > 0) throw new Error(`No Voice Clip to check for: ${unknown.join(" ")}`);
  }
  const forced = new Set(options.only ?? []);

  const toCheck: { id: ItemId; file: string; audio: Uint8Array; fingerprint: string }[] = [];
  for (const item of items) {
    const file = manifest.clips[item.id]?.file;
    if (!file || !existsSync(join(voiceDir, file))) continue;
    const audio = new Uint8Array(readFileSync(join(voiceDir, file)));
    const print = fingerprint(audio);
    const old = before.checks[item.id];
    const upToDate = old !== undefined && old.audio === print;
    if (options.only ? forced.has(item.id) : !upToDate) toCheck.push({ id: item.id, file, audio, fingerprint: print });
    else if (upToDate) checks[item.id] = old;
  }
  // Clips gone from the manifest lose their results here.
  save();

  const report = { checked: [] as ItemId[] };
  if (toCheck.length === 0) return report;
  const transcriber = options.transcriber();

  for (const clip of toCheck) {
    const heard = await transcriber.transcribe(clip.audio, clip.file);
    checks[clip.id] = { audio: clip.fingerprint, ...heard };
    // Saved after every clip, so an interrupted run picks up where it stopped.
    save();
    report.checked.push(clip.id);
    options.onChecked?.(clip.id, report.checked.length, toCheck.length);
  }
  return report;
}
