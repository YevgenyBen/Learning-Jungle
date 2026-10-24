import type { Category } from "../types";

/**
 * The Words, authored once. Both spellings are written by hand: the Plain
 * Spelling is never the Voweled Spelling with its marks stripped
 * (עַגְבָנִיָּה vs עגבנייה).
 *
 * `id` is the Word's stable identity (it names its Voice Clip and Picture
 * files): `word-` plus an English slug.
 */
export interface WordData {
  readonly id: string;
  readonly voweled: string;
  readonly plain: string;
  readonly category: Category;
  readonly emoji: string;
  readonly pronunciation?: string;
}

export const WORDS: readonly WordData[] = [
  { id: "word-apple", voweled: "תַּפּוּחַ", plain: "תפוח", category: "fruits", emoji: "🍎" },
  { id: "word-banana", voweled: "בָּנָנָה", plain: "בננה", category: "fruits", emoji: "🍌" },
  { id: "word-strawberry", voweled: "תּוּת", plain: "תות", category: "fruits", emoji: "🍓" },
  { id: "word-watermelon", voweled: "אֲבַטִּיחַ", plain: "אבטיח", category: "fruits", emoji: "🍉" },
  { id: "word-lemon", voweled: "לִימוֹן", plain: "לימון", category: "fruits", emoji: "🍋" },
  { id: "word-tomato", voweled: "עַגְבָנִיָּה", plain: "עגבנייה", category: "vegetables", emoji: "🍅" },
  { id: "word-carrot", voweled: "גֶּזֶר", plain: "גזר", category: "vegetables", emoji: "🥕" },
];
