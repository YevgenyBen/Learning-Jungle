import { LETTERS } from "./data/letters";
import { WORDS } from "./data/words";
import type {
  Category,
  Letter,
  NiqqudSetting,
  SpelledLetter,
  Spelling,
  Word,
} from "./types";

/**
 * The Content Bank: the only source of learning content. Games ask it
 * questions; they never read the authored data directly.
 */
export interface ContentBank {
  /** Every Word, or only those in one Category. */
  words(filter?: { readonly category?: Category }): readonly Word[];
  /** A Word's spelling for a Niqqud setting, split into its letters. */
  spelling(word: Word, setting: NiqqudSetting): Spelling;
  /** Every letter, final forms included, in alphabet order. */
  letters(): readonly Letter[];
  /** A letter (final forms included) by its bare character. */
  letter(letter: string): Letter | undefined;
}

const HEBREW_LETTER = /[א-ת]/;

/** Splits Hebrew text into letters, each carrying the marks written after it. */
function splitLetters(text: string): SpelledLetter[] {
  const letters: SpelledLetter[] = [];
  for (const char of text) {
    if (HEBREW_LETTER.test(char)) {
      letters.push({ letter: char, marked: char });
    } else if (letters.length > 0) {
      const last = letters[letters.length - 1];
      letters[letters.length - 1] = { letter: last.letter, marked: last.marked + char };
    }
  }
  return letters;
}

function createContentBank(): ContentBank {
  const words: readonly Word[] = WORDS.map((data) => ({
    id: data.id,
    voweledText: data.voweled,
    ...(data.pronunciation ? { pronunciation: data.pronunciation } : {}),
    voweled: data.voweled,
    plain: data.plain,
    category: data.category,
    picture: { emoji: data.emoji },
  }));

  const letters: readonly Letter[] = LETTERS.map((data) => ({
    id: data.id,
    voweledText: data.name,
    ...(data.pronunciation ? { pronunciation: data.pronunciation } : {}),
    letter: data.letter,
    final: data.final === true,
    name: data.name,
  }));
  const byLetter = new Map(letters.map((l) => [l.letter, l]));

  return {
    words: (filter) =>
      filter?.category ? words.filter((w) => w.category === filter.category) : words,
    spelling: (word, { niqqud }) => {
      const text = niqqud ? word.voweled : word.plain;
      return { text, letters: splitLetters(text) };
    },
    letters: () => letters,
    letter: (letter) => byLetter.get(letter),
  };
}

export const contentBank: ContentBank = createContentBank();
