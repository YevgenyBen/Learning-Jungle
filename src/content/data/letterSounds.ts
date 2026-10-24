/**
 * The Letter Sounds, authored as two tables whose cross product the Content
 * Bank builds: every consonant form (a letter as written, with dagesh or a
 * shin/sin dot where that changes how it is read) with every vowel mark.
 *
 * The marks are written as code points, never as pasted combining
 * characters, so nobody has to eyeball an invisible dot.
 */
import type { Vowel, VowelMark } from "../types";

/** Hebrew marks used here, by code point. */
export const MARK = {
  shva: "ְ",
  hiriq: "ִ",
  tsere: "ֵ",
  segol: "ֶ",
  patah: "ַ",
  qamats: "ָ",
  holam: "ֹ",
  qubuts: "ֻ",
  dagesh: "ּ",
  shinDot: "ׁ",
  sinDot: "ׂ",
} as const;

export interface VowelData {
  readonly mark: VowelMark;
  /** The vowel heard, or null for shva: the letter is read on its own. */
  readonly vowel: Vowel | null;
}

/** The vowel marks, grouped by the five vowel sounds, then shva. */
export const VOWELS: readonly VowelData[] = [
  { mark: "qamats", vowel: "a" },
  { mark: "patah", vowel: "a" },
  { mark: "tsere", vowel: "e" },
  { mark: "segol", vowel: "e" },
  { mark: "hiriq", vowel: "i" },
  { mark: "holam", vowel: "o" },
  { mark: "qubuts", vowel: "u" },
  { mark: "shva", vowel: null },
];

export interface ConsonantData {
  /** English name of this form, used in identities: `bet` (בּ) and `vet` (ב). */
  readonly name: string;
  /** The bare letter. */
  readonly letter: string;
  /** Dagesh or a shin/sin dot that belongs to this form. */
  readonly marks?: string;
  /**
   * How the consonant is read in today's Hebrew, in ASCII. Letter Sounds with
   * the same consonant and vowel sound the same, so they share one spoken
   * sound and one Voice Clip (בָּ and בַּ, but also טָ and תָ, כָּ and קָ). Empty for
   * א and ע, which are not heard.
   */
  readonly consonant: string;
  /** Vowel marks this form never takes as a Letter Sound. */
  readonly without?: readonly VowelMark[];
}

/**
 * The consonant forms in alphabet order. Only ב כ פ take a dagesh here, as it
 * changes how they are read; ש comes as shin and sin.
 *
 * Left out on purpose: shva under א ה ע (nothing would be heard), and holam
 * and qubuts on ו (וֹ reads as holam male "o" and וֻ looks like shuruk).
 */
export const CONSONANTS: readonly ConsonantData[] = [
  { name: "alef", letter: "א", consonant: "", without: ["shva"] },
  { name: "bet", letter: "ב", marks: MARK.dagesh, consonant: "b" },
  { name: "vet", letter: "ב", consonant: "v" },
  { name: "gimel", letter: "ג", consonant: "g" },
  { name: "dalet", letter: "ד", consonant: "d" },
  { name: "he", letter: "ה", consonant: "h", without: ["shva"] },
  { name: "vav", letter: "ו", consonant: "v", without: ["holam", "qubuts"] },
  { name: "zayin", letter: "ז", consonant: "z" },
  { name: "het", letter: "ח", consonant: "kh" },
  { name: "tet", letter: "ט", consonant: "t" },
  { name: "yod", letter: "י", consonant: "y" },
  { name: "kaf", letter: "כ", marks: MARK.dagesh, consonant: "k" },
  { name: "khaf", letter: "כ", consonant: "kh" },
  { name: "lamed", letter: "ל", consonant: "l" },
  { name: "mem", letter: "מ", consonant: "m" },
  { name: "nun", letter: "נ", consonant: "n" },
  { name: "samekh", letter: "ס", consonant: "s" },
  { name: "ayin", letter: "ע", consonant: "", without: ["shva"] },
  { name: "pe", letter: "פ", marks: MARK.dagesh, consonant: "p" },
  { name: "fe", letter: "פ", consonant: "f" },
  { name: "tsadi", letter: "צ", consonant: "ts" },
  { name: "qof", letter: "ק", consonant: "k" },
  { name: "resh", letter: "ר", consonant: "r" },
  { name: "shin", letter: "ש", marks: MARK.shinDot, consonant: "sh" },
  { name: "sin", letter: "ש", marks: MARK.sinDot, consonant: "s" },
  { name: "tav", letter: "ת", consonant: "t" },
];

/**
 * Pronunciation overrides for spoken sounds, by their identity
 * (`sound-ba`), used only when generating Voice Clips.
 */
export const SOUND_PRONUNCIATIONS: Readonly<Record<string, string>> = {};
