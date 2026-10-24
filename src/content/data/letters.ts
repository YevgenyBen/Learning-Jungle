/**
 * The Hebrew letters with their Letter Names (voweled, so a Voice Clip or
 * Speech Fallback reads "גִּימֶל", not a bare consonant). Order is the
 * alphabet, with each final form right after its base letter.
 *
 * `id` is the letter's stable identity: `letter-` plus its English name,
 * `letter-final-` for final forms.
 */
export interface LetterData {
  readonly id: string;
  readonly letter: string;
  readonly name: string;
  readonly final?: true;
  readonly pronunciation?: string;
}

export const LETTERS: readonly LetterData[] = [
  { id: "letter-alef", letter: "א", name: "אָלֶף" },
  { id: "letter-bet", letter: "ב", name: "בֵּית" },
  { id: "letter-gimel", letter: "ג", name: "גִּימֶל" },
  { id: "letter-dalet", letter: "ד", name: "דָּלֶת" },
  { id: "letter-he", letter: "ה", name: "הֵא" },
  { id: "letter-vav", letter: "ו", name: "וָו" },
  { id: "letter-zayin", letter: "ז", name: "זַיִן" },
  { id: "letter-het", letter: "ח", name: "חֵית" },
  { id: "letter-tet", letter: "ט", name: "טֵית" },
  { id: "letter-yod", letter: "י", name: "יוּד" },
  { id: "letter-kaf", letter: "כ", name: "כַּף" },
  { id: "letter-final-kaf", letter: "ך", name: "כַף סוֹפִית", final: true },
  { id: "letter-lamed", letter: "ל", name: "לָמֶד" },
  { id: "letter-mem", letter: "מ", name: "מֵם" },
  { id: "letter-final-mem", letter: "ם", name: "מֵם סוֹפִית", final: true },
  { id: "letter-nun", letter: "נ", name: "נוּן" },
  { id: "letter-final-nun", letter: "ן", name: "נוּן סוֹפִית", final: true },
  { id: "letter-samekh", letter: "ס", name: "סָמֶךְ" },
  { id: "letter-ayin", letter: "ע", name: "עַיִן" },
  { id: "letter-pe", letter: "פ", name: "פֵּא" },
  { id: "letter-final-pe", letter: "ף", name: "פֵא סוֹפִית", final: true },
  { id: "letter-tsadi", letter: "צ", name: "צָדִי" },
  { id: "letter-final-tsadi", letter: "ץ", name: "צָדִי סוֹפִית", final: true },
  { id: "letter-qof", letter: "ק", name: "קוֹף" },
  { id: "letter-resh", letter: "ר", name: "רֵישׁ" },
  { id: "letter-shin", letter: "ש", name: "שִׁין" },
  { id: "letter-tav", letter: "ת", name: "תָּו" },
];
