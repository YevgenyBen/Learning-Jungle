import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contentBank, type SpokenItem } from "@/content";
import { generateVoiceClips, type Synthesizer } from "./generate";

// The generation script's core, driven with a stand-in synthesizer and a real
// temporary voice folder. Azure is never called.

const apple: SpokenItem = { id: "word-apple", voweledText: "תַּפּוּחַ" };
const alef: SpokenItem = { id: "letter-alef", voweledText: "אָלֶף" };

let voiceDir: string;
let spoken: string[];

/** A synthesizer that "speaks" by writing the text it was given as bytes. */
const fakeSynthesizer = (): Synthesizer => ({
  voice: "test-voice",
  extension: "mp3",
  synthesize: async (text) => {
    spoken.push(text);
    return new TextEncoder().encode(`audio of ${text}`);
  },
});

const manifest = () =>
  JSON.parse(readFileSync(join(voiceDir, "manifest.json"), "utf8")) as {
    clips: Record<string, { file: string; text?: string; voice?: string }>;
  };

const clipText = (file: string) => readFileSync(join(voiceDir, file), "utf8");

beforeEach(() => {
  voiceDir = mkdtempSync(join(tmpdir(), "voice-clips-"));
  writeFileSync(join(voiceDir, "manifest.json"), JSON.stringify({ clips: {} }));
  spoken = [];
});

afterEach(() => rmSync(voiceDir, { recursive: true, force: true }));

describe("generating Voice Clips", () => {
  it("makes a clip named by identity for every item that lacks one, and lists it in the manifest", async () => {
    await generateVoiceClips({ items: [apple, alef], voiceDir, synthesizer: fakeSynthesizer });

    expect(clipText("word-apple.mp3")).toBe("audio of תַּפּוּחַ");
    expect(clipText("letter-alef.mp3")).toBe("audio of אָלֶף");
    expect(manifest().clips["word-apple"].file).toBe("word-apple.mp3");
    expect(manifest().clips["letter-alef"].file).toBe("letter-alef.mp3");
    expect(existsSync(join(voiceDir, "manifest.json"))).toBe(true);
  });

  it("run again, generates nothing and does not even need a synthesizer", async () => {
    await generateVoiceClips({ items: [apple, alef], voiceDir, synthesizer: fakeSynthesizer });
    spoken = [];
    const noKey = () => {
      throw new Error("no Azure key");
    };

    await generateVoiceClips({ items: [apple, alef], voiceDir, synthesizer: noKey });

    expect(spoken).toEqual([]);
    expect(Object.keys(manifest().clips)).toEqual(["word-apple", "letter-alef"]);
  });

  it("generates only the items that lack a clip", async () => {
    await generateVoiceClips({ items: [apple], voiceDir, synthesizer: fakeSynthesizer });
    spoken = [];

    await generateVoiceClips({ items: [apple, alef], voiceDir, synthesizer: fakeSynthesizer });

    expect(spoken).toEqual(["אָלֶף"]);
  });

  it("generates from the pronunciation override when an item has one", async () => {
    const ba: SpokenItem = { id: "sound-ba", voweledText: "בָּ", pronunciation: "בָּה" };

    await generateVoiceClips({ items: [ba], voiceDir, synthesizer: fakeSynthesizer });

    expect(spoken).toEqual(["בָּה"]);
    expect(manifest().clips["sound-ba"].text).toBe("בָּה");
  });

  it("an item whose manifest entry has lost its file is generated again", async () => {
    await generateVoiceClips({ items: [apple], voiceDir, synthesizer: fakeSynthesizer });
    rmSync(join(voiceDir, "word-apple.mp3"));
    spoken = [];

    await generateVoiceClips({ items: [apple], voiceDir, synthesizer: fakeSynthesizer });

    expect(spoken).toEqual(["תַּפּוּחַ"]);
    expect(clipText("word-apple.mp3")).toBe("audio of תַּפּוּחַ");
  });
});

describe("the whole Content Bank", () => {
  it("gets one clip per spoken item: Words, Letter Names, shared Letter Sound sounds and numbers", async () => {
    const items = contentBank.spokenItems();

    const report = await generateVoiceClips({ items, voiceDir, synthesizer: fakeSynthesizer });

    expect(report.generated).toHaveLength(items.length);
    const clips = manifest().clips;
    for (const id of ["word-apple", "letter-gimel", "sound-ba", "number-21"]) {
      expect(existsSync(join(voiceDir, clips[id].file)), id).toBe(true);
    }
    expect(Object.keys(clips)).toEqual(items.map((item) => item.id));
    expect(spoken).toContain(contentBank.letterSound("בָּ")!.sound.pronunciation ?? "בָּ".normalize("NFC"));
  });
});

describe("keeping the manifest in step with the Content Bank", () => {
  it("an interrupted run keeps the clips it made, and the next run carries on", async () => {
    const failing = (): Synthesizer => ({
      ...fakeSynthesizer(),
      synthesize: async (text) => {
        if (text === "אָלֶף") throw new Error("Azure said no");
        return fakeSynthesizer().synthesize(text);
      },
    });
    await expect(
      generateVoiceClips({ items: [apple, alef], voiceDir, synthesizer: failing }),
    ).rejects.toThrow("Azure said no");
    expect(Object.keys(manifest().clips)).toEqual(["word-apple"]);
    spoken = [];

    await generateVoiceClips({ items: [apple, alef], voiceDir, synthesizer: fakeSynthesizer });

    expect(spoken).toEqual(["אָלֶף"]);
  });

  it("drops entries for items no longer in the Content Bank, keeping their files", async () => {
    await generateVoiceClips({ items: [apple, alef], voiceDir, synthesizer: fakeSynthesizer });

    const report = await generateVoiceClips({ items: [alef], voiceDir, synthesizer: fakeSynthesizer });

    expect(Object.keys(manifest().clips)).toEqual(["letter-alef"]);
    expect(existsSync(join(voiceDir, "word-apple.mp3"))).toBe(true);
    expect(report.unlisted).toEqual(["word-apple"]);
  });

  it("reports what it generated and which clips were made from text that has changed since", async () => {
    const first = await generateVoiceClips({ items: [apple, alef], voiceDir, synthesizer: fakeSynthesizer });
    expect(first.generated).toEqual(["word-apple", "letter-alef"]);

    const overridden: SpokenItem = { ...alef, pronunciation: "אָלֵף" };
    const second = await generateVoiceClips({ items: [apple, overridden], voiceDir, synthesizer: fakeSynthesizer });

    expect(second.generated).toEqual([]);
    expect(second.changed).toEqual(["letter-alef"]);
  });

  it("tells how far it has got after every clip", async () => {
    const progress: string[] = [];

    await generateVoiceClips({
      items: [apple, alef],
      voiceDir,
      synthesizer: fakeSynthesizer,
      onGenerated: (id, done, total) => progress.push(`${done}/${total} ${id}`),
    });

    expect(progress).toEqual(["1/2 word-apple", "2/2 letter-alef"]);
  });
});

describe("a clip dropped in by hand under an item's identity", () => {
  it("is listed in the manifest instead of generating one", async () => {
    writeFileSync(join(voiceDir, "word-apple.wav"), "a recording");

    await generateVoiceClips({ items: [apple], voiceDir, synthesizer: fakeSynthesizer });

    expect(spoken).toEqual([]);
    expect(manifest().clips["word-apple"]).toEqual({ file: "word-apple.wav" });
  });

  it("replaces a generated clip whose file was removed", async () => {
    await generateVoiceClips({ items: [apple], voiceDir, synthesizer: fakeSynthesizer });
    rmSync(join(voiceDir, "word-apple.mp3"));
    writeFileSync(join(voiceDir, "word-apple.m4a"), "a better recording");
    spoken = [];

    await generateVoiceClips({ items: [apple], voiceDir, synthesizer: fakeSynthesizer });

    expect(spoken).toEqual([]);
    expect(manifest().clips["word-apple"]).toEqual({ file: "word-apple.m4a" });
  });

  it("next to another clip of the same item is refused, naming both files", async () => {
    await generateVoiceClips({ items: [apple], voiceDir, synthesizer: fakeSynthesizer });
    writeFileSync(join(voiceDir, "word-apple.wav"), "a recording");

    await expect(
      generateVoiceClips({ items: [apple, alef], voiceDir, synthesizer: fakeSynthesizer }),
    ).rejects.toThrow(/word-apple\.mp3.*word-apple\.wav|word-apple\.wav.*word-apple\.mp3/);
    expect(spoken).toEqual(["תַּפּוּחַ"]);
  });

  it("is replaced by a generated clip when its identity is listed for regeneration", async () => {
    writeFileSync(join(voiceDir, "word-apple.wav"), "a recording");

    await generateVoiceClips({ items: [apple], voiceDir, synthesizer: fakeSynthesizer, only: ["word-apple"] });

    expect(manifest().clips["word-apple"].file).toBe("word-apple.mp3");
    expect(existsSync(join(voiceDir, "word-apple.wav"))).toBe(false);
  });
});

describe("regenerating listed identities", () => {
  const banana: SpokenItem = { id: "word-banana", voweledText: "בָּנָנָה" };

  it("regenerates only the listed items, even those that already have a clip", async () => {
    await generateVoiceClips({ items: [apple, alef], voiceDir, synthesizer: fakeSynthesizer });
    spoken = [];

    await generateVoiceClips({
      items: [apple, alef, banana],
      voiceDir,
      synthesizer: fakeSynthesizer,
      only: ["letter-alef"],
    });

    expect(spoken).toEqual(["אָלֶף"]);
    expect(manifest().clips["word-banana"]).toBeUndefined();
  });

  it("refuses an identity that is not a spoken item, before generating anything", async () => {
    await expect(
      generateVoiceClips({
        items: [apple, alef],
        voiceDir,
        synthesizer: fakeSynthesizer,
        only: ["letter-alef", "word-appel"],
      }),
    ).rejects.toThrow(/word-appel/);
    expect(spoken).toEqual([]);
  });
});
