/**
 * Content Bank types. Games see only these types and the queries in
 * `ContentBank` (bank.ts); the authored data behind them is private to the
 * Content Bank.
 */

/**
 * A stable identity for anything the Content Bank holds. It also names the
 * item's Voice Clip file (ADR-0002), so it is plain ASCII: `word-apple`,
 * `letter-alef`. Never reuse or rename one once a Voice Clip exists for it.
 */
export type ItemId = string;

/** Anything that can be said aloud, i.e. anything with a Voice Clip. */
export interface SpokenItem {
  readonly id: ItemId;
  /** The voweled text its Voice Clip is generated from and Speech Fallback reads. */
  readonly voweledText: string;
  /** Text used instead of `voweledText` only when generating the Voice Clip. */
  readonly pronunciation?: string;
}

export type Category = "fruits" | "vegetables" | "animals" | "home-objects";

/**
 * The image that stands for a Word: a file named by the Word's identity
 * (`/pictures/word-apple.svg`). Phase 1 ships Twemoji SVGs; replacing the file
 * under the same name replaces the Picture without touching any Game.
 * Draw it with `<WordPicture>` only.
 */
export interface Picture {
  /** The file's path in the app's public assets. */
  readonly src: string;
}

export interface Word extends SpokenItem {
  /** The Word written with Niqqud (עַגְבָנִיָּה). Same as `voweledText`. */
  readonly voweled: string;
  /** The Word in standard full spelling without Niqqud (עגבנייה). Authored, never derived. */
  readonly plain: string;
  readonly category: Category;
  readonly picture: Picture;
}

/** A Hebrew letter, final forms included, said aloud as its Letter Name. */
export interface Letter extends SpokenItem {
  /** The bare letter, e.g. "ג" or "ם". */
  readonly letter: string;
  /** Whether this is a final form (ך ם ן ף ץ). */
  readonly final: boolean;
  /** The Letter Name with Niqqud, e.g. "גִּימֶל". Same as `voweledText`. */
  readonly name: string;
}

/** One letter of a spelling. */
export interface SpelledLetter {
  /** The bare letter (final forms kept), what a Player matches. */
  readonly letter: string;
  /** The letter with the marks that belong to it, for display. */
  readonly marked: string;
}

export interface Spelling {
  readonly text: string;
  readonly letters: readonly SpelledLetter[];
}

export interface NiqqudSetting {
  readonly niqqud: boolean;
}

/** A vowel sound. */
export type Vowel = "a" | "e" | "i" | "o" | "u";

/** A vowel mark a Letter Sound is written with. */
export type VowelMark = "qamats" | "patah" | "tsere" | "segol" | "hiriq" | "holam" | "qubuts" | "shva";

/** A letter as written together with its vowel mark, such as בָּ. */
export interface LetterSound {
  /** Stable identity: `letter-sound-` + letter form + vowel mark (`letter-sound-vet-patah`). */
  readonly id: ItemId;
  /** The letter with its marks (dagesh, shin/sin dot, vowel mark), NFC normalized. */
  readonly written: string;
  /** The bare letter, e.g. "ב" for both בָּ and בָ. */
  readonly letter: string;
  readonly mark: VowelMark;
  /** The vowel heard, or null for shva (the letter is read on its own). */
  readonly vowel: Vowel | null;
  /**
   * What is said aloud: a Spoken Item shared with the Letter Sounds that
   * sound the same (בָּ and בַּ both point at `sound-ba`), so they share one
   * Voice Clip.
   */
  readonly sound: SpokenItem;
}

/** A number from 0 to 100, said aloud in its feminine form. */
export interface HebrewNumber extends SpokenItem {
  readonly value: number;
  /** The feminine spoken text, voweled, e.g. "עֶשְׂרִים וְאַחַת". Same as `voweledText`. */
  readonly feminine: string;
}
