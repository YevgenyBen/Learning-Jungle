import { describe, expect, it } from "vitest";
import { contentBank } from "./index";

const letterSound = (written: string) => {
  const found = contentBank.letterSound(written);
  if (!found) throw new Error(`no Letter Sound ${written} in the Content Bank`);
  return found;
};

describe("Letter Sounds", () => {
  it("are found by how they are written: a letter with its vowel mark", () => {
    const ba = letterSound("בָּ");
    expect(ba.written).toBe("בָּ".normalize("NFC"));
    expect(ba.letter).toBe("ב");
    expect(ba.mark).toBe("qamats");
    expect(ba.vowel).toBe("a");
    expect(ba.id).toBe("letter-sound-bet-qamats");
  });

  it("are found whatever order their marks are typed in", () => {
    const BET = "ב", DAGESH = "ּ", QAMATS = "ָ";
    expect(contentBank.letterSound(BET + DAGESH + QAMATS)?.id).toBe("letter-sound-bet-qamats");
    expect(contentBank.letterSound(BET + QAMATS + DAGESH)?.id).toBe("letter-sound-bet-qamats");
    expect(contentBank.letterSound(BET + QAMATS)?.id).toBe("letter-sound-vet-qamats");
  });

  it("בָּ and בַּ are different Letter Sounds that share one spoken sound", () => {
    const qamats = letterSound("בָּ");
    const patah = letterSound("בַּ");
    expect(qamats.id).not.toBe(patah.id);
    expect(patah.mark).toBe("patah");
    expect(qamats.sound).toBe(patah.sound);
    expect(qamats.sound.id).toBe("sound-ba");
  });

  it("with and without dagesh, בּ כּ פּ are read differently", () => {
    expect(letterSound("בָּ").sound.id).toBe("sound-ba");
    expect(letterSound("בָ").sound.id).toBe("sound-va");
    expect(letterSound("כָּ").sound.id).toBe("sound-ka");
    expect(letterSound("כָ").sound.id).toBe("sound-kha");
    expect(letterSound("פָּ").sound.id).toBe("sound-pa");
    expect(letterSound("פָ").sound.id).toBe("sound-fa");
  });

  it("letters that are read the same share a spoken sound", () => {
    expect(letterSound("וָ").sound).toBe(letterSound("בָ").sound);
    expect(letterSound("קֵ").sound).toBe(letterSound("כֵּ").sound);
    expect(letterSound("חִ").sound).toBe(letterSound("כִ").sound);
    expect(letterSound("טֹ").sound).toBe(letterSound("תֹ").sound);
    expect(letterSound("עַ").sound).toBe(letterSound("אָ").sound);
    expect(letterSound("אָ").sound.id).toBe("sound-a");
  });

  it("ש comes as shin and as sin, and sin is read like ס", () => {
    const shin = letterSound("שָׁ");
    const sin = letterSound("שָׂ");
    expect(shin.letter).toBe("ש");
    expect(sin.letter).toBe("ש");
    expect(shin.id).toBe("letter-sound-shin-qamats");
    expect(sin.id).toBe("letter-sound-sin-qamats");
    expect(shin.sound.id).toBe("sound-sha");
    expect(sin.sound).toBe(letterSound("סַ").sound);
    expect(contentBank.letterSounds({ letter: "ש" }).map((s) => s.written)).toEqual(
      expect.arrayContaining(["שָׁ".normalize("NFC"), "שָׂ".normalize("NFC")]),
    );
  });

  it("with shva, a letter is read on its own", () => {
    const b = letterSound("בְּ");
    expect(b.mark).toBe("shva");
    expect(b.vowel).toBeNull();
    expect(b.sound.id).toBe("sound-b");
    expect(b.sound).not.toBe(letterSound("בֶּ").sound);
    expect(letterSound("שְׁ").sound.id).toBe("sound-sh");
  });

  it("cover every letter with the five vowel sounds and shva", () => {
    // ב כ פ come with and without dagesh and ש as shin and sin, so they have
    // twice the eight vowel marks. Shva is left out under the silent א ה ע,
    // and holam and qubuts on ו (they would read as holam male and shuruk).
    const expected: Record<string, number> = {
      א: 7, ב: 16, ג: 8, ד: 8, ה: 7, ו: 6, ז: 8, ח: 8, ט: 8, י: 8, כ: 16,
      ל: 8, מ: 8, נ: 8, ס: 8, ע: 7, פ: 16, צ: 8, ק: 8, ר: 8, ש: 16, ת: 8,
    };
    for (const [letter, count] of Object.entries(expected)) {
      const sounds = contentBank.letterSounds({ letter });
      expect(sounds, letter).toHaveLength(count);
      const vowels = new Set(sounds.map((s) => s.vowel));
      const heard = letter === "ו" ? ["a", "e", "i"] : ["a", "e", "i", "o", "u"];
      for (const vowel of heard) expect(vowels.has(vowel as never), `${letter} ${vowel}`).toBe(true);
    }
    expect(contentBank.letterSounds()).toHaveLength(203);
    expect(new Set(contentBank.letterSounds().map((s) => s.mark))).toEqual(
      new Set(["qamats", "patah", "tsere", "segol", "hiriq", "holam", "qubuts", "shva"]),
    );
  });

  it("are each one Hebrew letter followed only by its marks, NFC normalized", () => {
    const oneLetterWithMarks = /^[א-ת][ְ-ּׁׂ]+$/;
    for (const s of contentBank.letterSounds()) {
      expect(s.written, s.id).toMatch(oneLetterWithMarks);
      expect(s.written, s.id).toBe(s.written.normalize("NFC"));
      expect([...s.written][0], s.id).toBe(s.letter);
    }
  });

  it("have stable ASCII identities, unique per Letter Sound and per spoken sound", () => {
    const all = contentBank.letterSounds();
    const ids = all.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^letter-sound-[a-z]+-[a-z]+$/);
    const sounds = [...new Set(all.map((s) => s.sound))];
    const soundIds = sounds.map((s) => s.id);
    expect(new Set(soundIds).size).toBe(soundIds.length);
    for (const id of soundIds) expect(id).toMatch(/^sound-[a-z]+$/);
  });

  it("a shared spoken sound is said from the voweled text of a Letter Sound that has it", () => {
    for (const s of contentBank.letterSounds()) {
      expect(letterSound(s.sound.voweledText).sound, s.id).toBe(s.sound);
    }
  });
});
