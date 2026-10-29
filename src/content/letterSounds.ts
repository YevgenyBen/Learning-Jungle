import { CONSONANTS, MARK, SOUND_PRONUNCIATIONS, SOUND_SOUNDS_LIKE, VOWELS } from "./data/letterSounds";
import type { LetterSound, SpokenItem, VowelMark } from "./types";

/** The Content Bank's Letter Sound queries (part of `ContentBank`). */
export interface LetterSoundQueries {
  /**
   * Every Letter Sound in alphabet order, or only those of one bare letter
   * ("ב" gives both בּ and ב, "ש" both shin and sin).
   */
  letterSounds(filter?: { readonly letter?: string }): readonly LetterSound[];
  /** A Letter Sound by how it is written, in any order of its marks (בָּ). */
  letterSound(written: string): LetterSound | undefined;
  /**
   * The ways to write a bare letter with the vowel of another written letter
   * (`like`, such as "תַּ"), for a decoy that should look like the letter it
   * stands in for: the letter's Letter Sounds with that vowel mark (בַּ and בַ
   * for ב). A hataf counts as its full vowel and a shuruk (וּ) as qubuts.
   * Just the bare letter when `like` has no vowel or the letter never takes it.
   */
  writtenLike(letter: string, like: string): readonly string[];
}

/** The vowel marks by code point, with the ones Letter Sounds are not written with counted as the nearest that are. */
const VOWEL_MARKS: Readonly<Record<string, VowelMark>> = {
  ...Object.fromEntries(VOWELS.map(({ mark }) => [MARK[mark], mark])),
  "ֱ": "segol", // hataf segol
  "ֲ": "patah", // hataf patah
  "ֳ": "qamats", // hataf qamats
  "ֺ": "holam", // holam haser for vav
  "ׇ": "qamats", // qamats qatan
};

/** The vowel mark a letter is written with, if any. */
function vowelOf(written: string): VowelMark | null {
  for (const char of written) {
    const mark = VOWEL_MARKS[char];
    if (mark) return mark;
  }
  // A vav with a dagesh and no vowel mark is a shuruk, read "u".
  return written.startsWith("ו") && written.includes(MARK.dagesh) ? "qubuts" : null;
}

/** Builds every Letter Sound from the consonant and vowel tables. */
function buildLetterSounds(): LetterSound[] {
  const sounds = new Map<string, SpokenItem>();
  const letterSounds: LetterSound[] = [];

  for (const consonant of CONSONANTS) {
    for (const { mark, vowel } of VOWELS) {
      if (consonant.without?.includes(mark)) continue;
      const written = (consonant.letter + (consonant.marks ?? "") + MARK[mark]).normalize("NFC");
      const soundId = `sound-${consonant.consonant}${vowel ?? ""}`;
      let sound = sounds.get(soundId);
      if (!sound) {
        const pronunciation = SOUND_PRONUNCIATIONS[soundId];
        const soundsLike = SOUND_SOUNDS_LIKE[soundId];
        sound = {
          id: soundId,
          voweledText: written,
          ...(pronunciation ? { pronunciation } : {}),
          ...(soundsLike ? { soundsLike } : {}),
        };
        sounds.set(soundId, sound);
      }
      letterSounds.push({
        id: `letter-sound-${consonant.name}-${mark}`,
        written,
        letter: consonant.letter,
        mark,
        vowel,
        sound,
      });
    }
  }
  return letterSounds;
}

export function createLetterSoundQueries(): LetterSoundQueries {
  const letterSounds = buildLetterSounds();
  const byWritten = new Map(letterSounds.map((s) => [s.written, s]));
  return {
    letterSounds: (filter) =>
      filter?.letter ? letterSounds.filter((s) => s.letter === filter.letter) : letterSounds,
    letterSound: (written) => byWritten.get(written.normalize("NFC")),
    writtenLike: (letter, like) => {
      const mark = vowelOf(like);
      const forms = letterSounds.filter((s) => s.letter === letter && s.mark === mark).map((s) => s.written);
      return forms.length > 0 ? forms : [letter];
    },
  };
}
