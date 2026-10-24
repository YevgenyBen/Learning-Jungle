import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SpokenItem } from "@/content";
import type { ClipChecks } from "@/voice/review/suspects";
import { checkVoiceClips, type Transcriber } from "./check";

// The check script's core, driven with a stand-in transcriber and a real
// temporary voice folder. Azure is never called.

const apple: SpokenItem = { id: "word-apple", voweledText: "תַּפּוּחַ" };
const alef: SpokenItem = { id: "letter-alef", voweledText: "אָלֶף" };

let dir: string;
let voiceDir: string;
let reportPath: string;
let heardFiles: string[];

/** A transcriber that "hears" the clip's bytes as text. */
const fakeTranscriber = (): Transcriber => ({
  transcribe: async (audio, file) => {
    heardFiles.push(file);
    return { heard: new TextDecoder().decode(audio), confidence: 0.9, durationMs: 1000, speechStartMs: 100, speechEndMs: 700 };
  },
});

const noKey = () => {
  throw new Error("no Azure key");
};

/** Puts clips on disk and lists them in the manifest. */
function clips(files: Record<string, string>) {
  const listed: Record<string, { file: string }> = {};
  for (const [id, content] of Object.entries(files)) {
    writeFileSync(join(voiceDir, `${id}.mp3`), content);
    listed[id] = { file: `${id}.mp3` };
  }
  writeFileSync(join(voiceDir, "manifest.json"), JSON.stringify({ clips: listed }));
}

const report = () => JSON.parse(readFileSync(reportPath, "utf8")) as ClipChecks;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "voice-check-"));
  voiceDir = dir;
  reportPath = join(dir, "clipChecks.json");
  heardFiles = [];
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("checking Voice Clips", () => {
  it("keeps what was heard in every clip, with the clip's audio fingerprint", async () => {
    clips({ "word-apple": "תפוח", "letter-alef": "אלף" });

    const result = await checkVoiceClips({ items: [apple, alef], voiceDir, reportPath, transcriber: fakeTranscriber });

    expect(result.checked).toEqual(["word-apple", "letter-alef"]);
    expect(report().checks["word-apple"]).toMatchObject({ heard: "תפוח", confidence: 0.9, durationMs: 1000 });
    expect(report().checks["word-apple"].audio).toMatch(/^[0-9a-f]{16}$/);
    expect(report().checks["letter-alef"].heard).toBe("אלף");
  });

  it("run again, checks nothing and does not even need a transcriber", async () => {
    clips({ "word-apple": "תפוח" });
    await checkVoiceClips({ items: [apple], voiceDir, reportPath, transcriber: fakeTranscriber });
    heardFiles = [];

    const result = await checkVoiceClips({ items: [apple], voiceDir, reportPath, transcriber: noKey });

    expect(result.checked).toEqual([]);
    expect(report().checks["word-apple"].heard).toBe("תפוח");
  });

  it("checks a clip again once its audio has changed (regenerated or replaced)", async () => {
    clips({ "word-apple": "תפוח", "letter-alef": "אלף" });
    await checkVoiceClips({ items: [apple, alef], voiceDir, reportPath, transcriber: fakeTranscriber });
    heardFiles = [];
    writeFileSync(join(voiceDir, "word-apple.mp3"), "תפוחים");

    await checkVoiceClips({ items: [apple, alef], voiceDir, reportPath, transcriber: fakeTranscriber });

    expect(heardFiles).toEqual(["word-apple.mp3"]);
    expect(report().checks["word-apple"].heard).toBe("תפוחים");
  });

  it("checks exactly the listed identities again, changed or not", async () => {
    clips({ "word-apple": "תפוח", "letter-alef": "אלף" });
    await checkVoiceClips({ items: [apple, alef], voiceDir, reportPath, transcriber: fakeTranscriber });
    heardFiles = [];

    await checkVoiceClips({ items: [apple, alef], voiceDir, reportPath, transcriber: fakeTranscriber, only: ["letter-alef"] });

    expect(heardFiles).toEqual(["letter-alef.mp3"]);
    expect(Object.keys(report().checks)).toEqual(["word-apple", "letter-alef"]);
  });

  it("refuses identities that have no clip to check", async () => {
    clips({ "word-apple": "תפוח" });

    await expect(
      checkVoiceClips({ items: [apple, alef], voiceDir, reportPath, transcriber: fakeTranscriber, only: ["letter-alef"] }),
    ).rejects.toThrow(/letter-alef/);
  });

  it("forgets the results of clips that are gone, and skips items without a clip", async () => {
    clips({ "word-apple": "תפוח", "letter-alef": "אלף" });
    await checkVoiceClips({ items: [apple, alef], voiceDir, reportPath, transcriber: fakeTranscriber });
    clips({ "word-apple": "תפוח" });

    await checkVoiceClips({ items: [apple, alef], voiceDir, reportPath, transcriber: noKey });

    expect(Object.keys(report().checks)).toEqual(["word-apple"]);
  });

  it("saves after every clip, so an interrupted run keeps what it heard", async () => {
    clips({ "word-apple": "תפוח", "letter-alef": "אלף" });
    const failsSecond = (): Transcriber => {
      const real = fakeTranscriber();
      return {
        transcribe: async (audio, file) => {
          if (file === "letter-alef.mp3") throw new Error("network down");
          return real.transcribe(audio, file);
        },
      };
    };

    await expect(
      checkVoiceClips({ items: [apple, alef], voiceDir, reportPath, transcriber: failsSecond }),
    ).rejects.toThrow("network down");

    expect(existsSync(reportPath)).toBe(true);
    expect(Object.keys(report().checks)).toEqual(["word-apple"]);
  });
});
