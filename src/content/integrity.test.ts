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
