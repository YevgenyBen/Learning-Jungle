import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ItemId, SpokenItem } from "../../src/content";
import { soundsLikePhonemes } from "./soundsLike";

/** Turns text into audio. The real one is Azure (azure.ts); tests pass a stand-in. */
export interface Synthesizer {
  /** The voice's name, kept in the manifest for bookkeeping. */
  readonly voice: string;
  /** The audio file extension of what `synthesize` returns, e.g. "mp3". */
  readonly extension: string;
  /** Says `text`; with a Sounds-like Spelling, says it the way that spells. */
  synthesize(text: string, soundsLike?: string): Promise<Uint8Array>;
}

/** A clip in `public/voice/manifest.json`. The voice player reads only `file`. */
interface ManifestClip {
  readonly file: string;
  /** The text the clip was generated from (absent for a dropped-in file). */
  readonly text?: string;
  /** The Sounds-like Spelling it was generated with, if any. */
  readonly soundsLike?: string;
  readonly voice?: string;
}

interface Manifest {
  clips: Record<ItemId, ManifestClip>;
}

export interface GenerateOptions {
  /** Every spoken item (`contentBank.spokenItems()`). */
  readonly items: readonly SpokenItem[];
  /** The folder holding the clips and manifest.json (`public/voice`). */
  readonly voiceDir: string;
  /** Called only when there is something to generate, so a missing key fails only then. */
  readonly synthesizer: () => Synthesizer;
  /** Regenerate exactly these identities (flagged on the review page), clip or not. */
  readonly only?: readonly ItemId[];
  /** Called after each new clip is saved. */
  readonly onGenerated?: (id: ItemId, done: number, total: number) => void;
}

/** Audio files a developer may drop in under an item's identity (`word-apple.wav`). */
const AUDIO = /\.(mp3|wav|m4a|aac|ogg|oga|opus|webm|flac)$/i;

export interface GenerateReport {
  /** Identities given a new clip by the synthesizer. */
  readonly generated: readonly ItemId[];
  /** Identities whose dropped-in file was taken into the manifest. */
  readonly adopted: readonly ItemId[];
  /** Manifest entries dropped because the Content Bank no longer says them (files are kept). */
  readonly unlisted: readonly ItemId[];
  /**
   * Clips generated from a text or Sounds-like Spelling that differs from
   * the item's now (candidates to regenerate).
   */
  readonly changed: readonly ItemId[];
}

/** The text a clip is generated from: the pronunciation override, else the voweled text. */
const generationText = (item: SpokenItem) => item.pronunciation ?? item.voweledText;

export async function generateVoiceClips(options: GenerateOptions): Promise<GenerateReport> {
  const { items, voiceDir } = options;
  const manifestPath = join(voiceDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  const report = { generated: [] as ItemId[], adopted: [] as ItemId[], unlisted: [] as ItemId[], changed: [] as ItemId[] };

  const known = new Set(items.map((item) => item.id));
  for (const id of Object.keys(manifest.clips)) {
    if (!known.has(id)) {
      delete manifest.clips[id];
      report.unlisted.push(id);
    }
  }
  /** Writes the manifest with its clips in Content Bank order, so diffs stay small. */
  const saveManifest = () => {
    const clips: Record<ItemId, ManifestClip> = {};
    for (const item of items) if (manifest.clips[item.id]) clips[item.id] = manifest.clips[item.id];
    const text = JSON.stringify({ ...manifest, clips }, null, 2) + "\n";
    // Untouched when nothing changed (not even its line endings).
    if (readFileSync(manifestPath, "utf8").replace(/\r\n/g, "\n") !== text) writeFileSync(manifestPath, text);
  };

  const audioFiles = readdirSync(voiceDir).filter((file) => AUDIO.test(file));
  /** The audio files on disk that are this item's clip. */
  const clipFiles = (id: ItemId) => {
    const files = new Set(audioFiles.filter((file) => file.slice(0, file.lastIndexOf(".")) === id));
    const listed = manifest.clips[id]?.file;
    if (typeof listed === "string" && existsSync(join(voiceDir, listed))) files.add(listed);
    return [...files];
  };

  let toGenerate: readonly SpokenItem[];
  if (options.only) {
    const byId = new Map(items.map((item) => [item.id, item]));
    const unknown = options.only.filter((id) => !byId.has(id));
    if (unknown.length > 0) {
      throw new Error(`Not a spoken item in the Content Bank: ${unknown.join(" ")}`);
    }
    toGenerate = [...new Set(options.only)].map((id) => byId.get(id)!);
  } else {
    const ambiguous: string[] = [];
    const missing: SpokenItem[] = [];
    for (const item of items) {
      const files = clipFiles(item.id);
      if (files.length > 1) ambiguous.push(`${item.id}: ${files.join(", ")}`);
      else if (files.length === 0) missing.push(item);
      else if (manifest.clips[item.id]?.file !== files[0]) {
        manifest.clips[item.id] = { file: files[0] };
        report.adopted.push(item.id);
      }
    }
    if (ambiguous.length > 0) {
      throw new Error(
        `More than one clip for the same item; keep one file per identity in ${voiceDir}:\n  ${ambiguous.join("\n  ")}`,
      );
    }
    toGenerate = missing;
  }
  saveManifest();

  const generating = new Set(toGenerate);
  for (const item of items) {
    const clip = manifest.clips[item.id];
    if (generating.has(item) || clip?.text === undefined) continue;
    if (clip.text !== generationText(item) || clip.soundsLike !== item.soundsLike) report.changed.push(item.id);
  }

  if (toGenerate.length === 0) return report;
  // A Sounds-like Spelling that can't be read stops the run before any clip is made.
  const unreadable: string[] = [];
  for (const item of toGenerate) {
    if (item.soundsLike === undefined) continue;
    try {
      soundsLikePhonemes(generationText(item), item.soundsLike);
    } catch (error) {
      unreadable.push(`${item.id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (unreadable.length > 0) {
    throw new Error(`Sounds-like Spellings that can't be read:\n  ${unreadable.join("\n  ")}`);
  }
  const synthesizer = options.synthesizer();

  for (const item of toGenerate) {
    const text = generationText(item);
    const { soundsLike } = item;
    const file = `${item.id}.${synthesizer.extension}`;
    const audio = await synthesizer.synthesize(text, soundsLike);
    for (const old of clipFiles(item.id)) if (old !== file) rmSync(join(voiceDir, old));
    writeFileSync(join(voiceDir, file), audio);
    manifest.clips[item.id] = { file, text, ...(soundsLike ? { soundsLike } : {}), voice: synthesizer.voice };
    // Saved after every clip, so an interrupted run picks up where it stopped.
    saveManifest();
    report.generated.push(item.id);
    options.onGenerated?.(item.id, report.generated.length, toGenerate.length);
  }
  return report;
}
