import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contentBank, type SpokenItem } from "./index";

const letterSounds = contentBank.letterSounds();
const spokenSounds = [...new Set(letterSounds.map((s) => s.sound))];

/** Everything with a Voice Clip, apart from Words. */
const spokenItems: readonly SpokenItem[] = [
  ...contentBank.letters(),
  ...spokenSounds,
  ...contentBank.numbers(),
];

describe("integrity of letters, Letter Sounds and numbers", () => {
  it("every identity in the bank is unique, Words included", () => {
    const ids = [
      ...contentBank.words(),
      ...contentBank.letters(),
      ...letterSounds,
      ...spokenSounds,
      ...contentBank.numbers(),
    ].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("identities are plain ASCII, as they name Voice Clip files", () => {
    for (const item of [...spokenItems, ...letterSounds]) {
      expect(item.id).toMatch(/^[a-z]+(-[a-z0-9]+)+$/);
    }
    for (const letter of contentBank.letters()) {
      expect(letter.id).toMatch(letter.final ? /^letter-final-[a-z]+$/ : /^letter-[a-z]+$/);
    }
  });

  it("every voweled text is Hebrew letters and Niqqud only, NFC normalized", () => {
    const hebrewWord = "[א-תְ-ּׁׂ]+";
    const hebrew = new RegExp(`^${hebrewWord}( ${hebrewWord})*$`);
    for (const item of spokenItems) {
      expect(item.voweledText, item.id).toMatch(hebrew);
      expect(item.voweledText, item.id).toBe(item.voweledText.normalize("NFC"));
      expect(item.voweledText, item.id).toMatch(/[ְ-ּ]/);
    }
  });

  it("every Letter Name is voweled, word by word", () => {
    // U+05BC counts too: shuruk is ו with that dot (יוּד).
    for (const letter of contentBank.letters()) {
      for (const word of letter.name.split(" ")) {
        expect(word, letter.id).toMatch(/[ְ-ּ]/);
      }
    }
  });

  it("a pronunciation override, where one is given, is not empty", () => {
    for (const item of spokenItems) {
      if (item.pronunciation !== undefined) expect(item.pronunciation.trim(), item.id).not.toBe("");
    }
  });
});

describe("spoken items (everything with a Voice Clip)", () => {
  const all = contentBank.spokenItems();
  const ids = all.map((item) => item.id);

  it("are every Word, letter, shared spoken sound and number, each once", () => {
    expect(all.length).toBe(contentBank.words().length + 27 + 118 + 101);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(contentBank.words()[0].id);
    expect(ids).toContain("letter-alef");
    expect(ids).toContain("letter-final-mem");
    expect(ids).toContain("number-0");
    expect(ids).toContain("number-100");
  });

  it("say a Letter Sound through its shared sound, not its own identity", () => {
    expect(ids.filter((id) => id === "sound-ba")).toHaveLength(1);
    expect(ids.some((id) => id.startsWith("letter-sound-"))).toBe(false);
  });

  // Reported, never failed: content can be added before its clips are
  // generated (`npm run voice-clips`, see README.md).
  it("without a Voice Clip are reported, not failed", async ({ annotate }) => {
    const voiceDir = fileURLToPath(new URL("../../public/voice/", import.meta.url));
    const manifest = JSON.parse(readFileSync(`${voiceDir}manifest.json`, "utf8")) as {
      clips: Record<string, { file?: unknown }>;
    };
    const missing = ids.filter((id) => {
      const file = manifest.clips[id]?.file;
      return typeof file !== "string" || !existsSync(voiceDir + file);
    });
    if (missing.length > 0) {
      const message = `${missing.length} of ${ids.length} spoken items have no Voice Clip yet: ${missing.slice(0, 10).join(" ")}${missing.length > 10 ? " ..." : ""}`;
      console.info(message);
      await annotate(message);
    }
  });
});
