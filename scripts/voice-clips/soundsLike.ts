/**
 * Sounds-like Spellings: how a Spoken Item should sound, written in English
 * letters, turned into the IPA the he-IL voice takes in SSML's <phoneme>.
 *
 * The letters are the Content Bank's own ASCII for Hebrew sounds (kh, ts,
 * sh, y), so `ta-PU-akh` is תַּפּוּחַ stressed on its second syllable:
 * - vowels: a e i o u
 * - consonants: b d f g h k l m n p s t v z, r (the Hebrew r), y,
 *   sh, kh (or ch, as in "Chanukah"), ts (or tz), zh, j (as in "jungle"),
 *   tch, and ' for the catch of א or ע between vowels
 * - `-` between syllables, and the stressed syllable in CAPITALS
 * - a space between words, one word for each word of the item's text
 *
 * Only the he-IL phones Azure lists are written, so a spelling that is
 * accepted here is never refused by Azure as unknown phones.
 */

/** One word of the text and how it should sound. */
export interface PhonemeWord {
  readonly text: string;
  readonly ipa: string;
}

/** Longest first, so `tch` is read before `ts` and `sh` before `s`. */
const PHONES: readonly (readonly [string, string])[] = [
  ["tch", "tʃ"],
  ["sh", "ʃ"],
  ["kh", "x"],
  ["ch", "x"],
  ["ts", "t͡s"],
  ["tz", "t͡s"],
  ["zh", "ʒ"],
  ...[..."aeioubdfghklmnpstvz"].map((letter) => [letter, letter] as const),
  ["r", "ʁ"],
  ["y", "j"],
  ["j", "dʒ"],
  ["'", "ʔ"],
];

/** What to write instead of a letter Hebrew has no single sound for. */
const INSTEAD: Readonly<Record<string, string>> = {
  c: "k, s, kh or ts",
  q: "k",
  w: "v",
  x: "ks",
};

const STRESS = "ˈ";
const SYLLABLE = ".";

function syllableToIpa(syllable: string, spelling: string): string {
  let ipa = "";
  let rest = syllable.toLowerCase();
  while (rest.length > 0) {
    const phone = PHONES.find(([letters]) => rest.startsWith(letters));
    if (!phone) {
      const char = rest[0];
      const instead = INSTEAD[char];
      throw new Error(
        `"${spelling}": "${char}" is not a Sounds-like letter` + (instead ? `; write ${instead} instead.` : "."),
      );
    }
    ipa += phone[1];
    rest = rest.slice(phone[0].length);
  }
  return ipa;
}

function wordToIpa(word: string, spelling: string): string {
  const syllables = word.split("-");
  if (syllables.some((s) => s === "")) {
    throw new Error(`"${spelling}": "${word}" has an empty syllable; put one - between two syllables.`);
  }
  const stressed = syllables.map((s) => /[A-Z]/.test(s));
  syllables.forEach((s, i) => {
    if (stressed[i] && /[a-z]/.test(s)) {
      throw new Error(`"${spelling}": write the whole stressed syllable in capitals, not "${s}".`);
    }
  });
  if (stressed.filter(Boolean).length > 1) {
    throw new Error(`"${spelling}": "${word}" has more than one stressed syllable; capitalise only one.`);
  }
  return syllables
    .map((s, i) => (stressed[i] ? STRESS : i > 0 ? SYLLABLE : "") + syllableToIpa(s, spelling))
    .join("");
}

/**
 * Pairs each word of `text` with the IPA of its word in `spelling`.
 * Throws, naming the spelling and what to fix, when it can't be read.
 */
export function soundsLikePhonemes(text: string, spelling: string): readonly PhonemeWord[] {
  const textWords = text.trim().split(/\s+/);
  const spellingWords = spelling.trim().split(/\s+/).filter((w) => w !== "");
  if (spellingWords.length === 0) throw new Error(`The Sounds-like Spelling of "${text}" is empty.`);
  if (spellingWords.length !== textWords.length) {
    throw new Error(
      `"${spelling}" has ${spellingWords.length} word(s) but "${text}" has ${textWords.length}; ` +
        "write one word for each word of the text.",
    );
  }
  return textWords.map((word, i) => ({ text: word, ipa: wordToIpa(spellingWords[i], spelling) }));
}
