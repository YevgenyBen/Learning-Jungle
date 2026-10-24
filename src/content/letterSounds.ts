import { CONSONANTS, MARK, SOUND_PRONUNCIATIONS, VOWELS } from "./data/letterSounds";
import type { LetterSound, SpokenSound } from "./types";

/** The Content Bank's Letter Sound queries (part of `ContentBank`). */
export interface LetterSoundQueries {
  /**
   * Every Letter Sound in alphabet order, or only those of one bare letter
   * ("ב" gives both בּ and ב, "ש" both shin and sin).
   */
  letterSounds(filter?: { readonly letter?: string }): readonly LetterSound[];
  /** A Letter Sound by how it is written, in any order of its marks (בָּ). */
  letterSound(written: string): LetterSound | undefined;
}

/** Builds every Letter Sound from the consonant and vowel tables. */
function buildLetterSounds(): LetterSound[] {
  const sounds = new Map<string, SpokenSound>();
  const letterSounds: LetterSound[] = [];

  for (const consonant of CONSONANTS) {
    for (const { mark, vowel } of VOWELS) {
      if (consonant.without?.includes(mark)) continue;
      const written = (consonant.letter + (consonant.marks ?? "") + MARK[mark]).normalize("NFC");
      const soundId = `sound-${consonant.consonant}${vowel ?? ""}`;
      let sound = sounds.get(soundId);
      if (!sound) {
        const pronunciation = SOUND_PRONUNCIATIONS[soundId];
        sound = { id: soundId, voweledText: written, ...(pronunciation ? { pronunciation } : {}) };
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
  };
}
