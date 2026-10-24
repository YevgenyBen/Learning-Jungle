import type { ContentBank, ItemId } from "@/content";

/** What Azure speech to text heard in one Voice Clip (`npm run voice-check`). */
export interface ClipCheck {
  /** A fingerprint of the checked audio, so a regenerated clip is checked again. */
  readonly audio: string;
  /** Everything it heard, as text ("" when it heard no speech). */
  readonly heard: string;
  /** Its confidence, 0 to 1 (the lowest of its phrases); absent when it heard nothing. */
  readonly confidence?: number;
  /** The whole clip's length. */
  readonly durationMs: number;
  /** Where the speech starts and ends in the clip; absent when it heard nothing. */
  readonly speechStartMs?: number;
  readonly speechEndMs?: number;
}

/** `src/voice/review/clipChecks.json`: the last check of every clip. */
export interface ClipChecks {
  readonly checks: Readonly<Record<ItemId, ClipCheck>>;
}

/**
 * Why a clip is suspect: speech to text heard no speech in it, or heard
 * something other than the item. Speech to text is only a hint (it misses
 * wrong stress, and mishears some good clips), so a suspect is something
 * to listen to, not proof.
 */
export type Suspicion = "silent" | "misheard";

/**
 * What a correct clip of an item may be heard as.
 * - `text`: the whole of it, in one of these spellings (Words).
 * - `sounds-like`: the same, but compared by sound, since speech to text
 *   spells a Letter Name or a number any way that sounds right (חית as
 *   חייט).
 * - `opening`: a sound on its own is too short for speech to text to spell,
 *   so only the consonant it is heard to start with is compared.
 */
type Expectation =
  | { readonly kind: "text" | "sounds-like"; readonly forms: readonly string[] }
  | { readonly kind: "opening"; readonly letters: ReadonlySet<string> };

/**
 * Right readings that speech to text writes as something else: אָלֶף is also
 * the number 1000, and the name הֵא sounds like the word היי.
 */
const ALSO_HEARD_AS: Readonly<Record<ItemId, readonly string[]>> = {
  "letter-alef": ["1000"],
  "letter-he": ["היי"],
};

/**
 * Letters that are heard alike, so a sound may be spelled with any of them:
 * בֿ/ו, כּ/ק, כֿ/ח, ט/ת, שׂ/ס, and the silent openers of a bare vowel.
 */
const HEARD_ALIKE: readonly (readonly string[])[] = [
  ["ב", "ו"],
  ["כ", "ק", "ח"],
  ["ט", "ת"],
  ["ס", "ש"],
  ["א", "ע", "ה"],
];

const FINAL_FORMS: Readonly<Record<string, string>> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/**
 * Text reduced to what speech to text can be compared on: no Niqqud,
 * punctuation or extra spaces, final letters as regular ones.
 */
export function plainForComparison(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[֑-ׇ]/g, "")
    .replace(/[^א-ת0-9 ]/g, " ")
    .replace(/[ךםןףץ]/g, (letter) => FINAL_FORMS[letter])
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * How text sounds, roughly: letters heard alike made one, and the vowel
 * letters ו and י dropped (חית and חייט both become חט).
 */
function soundsLike(text: string): string {
  return [...plainForComparison(text)]
    .filter((letter) => letter !== "ו" && letter !== "י")
    .map((letter) => HEARD_ALIKE.find((group) => group.includes(letter))?.[0] ?? letter)
    .join("");
}

/** What each spoken item's clip may correctly be heard as. */
function expectations(bank: ContentBank): ReadonlyMap<ItemId, Expectation> {
  const expected = new Map<ItemId, Expectation>();
  const text = (kind: "text" | "sounds-like", id: ItemId, forms: readonly string[]) => {
    const all = [...forms, ...(ALSO_HEARD_AS[id] ?? [])];
    expected.set(id, { kind, forms: all.map(kind === "text" ? plainForComparison : soundsLike) });
  };

  for (const word of bank.words()) text("text", word.id, [word.plain, word.voweled]);
  // A Letter Name may come back spelled out (גימל) or as the letter itself (ג).
  for (const letter of bank.letters()) text("sounds-like", letter.id, [letter.name, letter.letter]);
  // Numbers mostly come back in digits; in words, spelled any way (שתיים for שְׁתַּיִם).
  for (const number of bank.numbers()) text("sounds-like", number.id, [number.feminine, String(number.value)]);
  for (const { sound, letter } of bank.letterSounds()) {
    const before = expected.get(sound.id);
    const letters = new Set(before?.kind === "opening" ? before.letters : []);
    for (const alike of HEARD_ALIKE.find((group) => group.includes(letter)) ?? [letter]) letters.add(alike);
    expected.set(sound.id, { kind: "opening", letters });
  }
  return expected;
}

function judge(expected: Expectation, check: ClipCheck): Suspicion | null {
  if (check.heard.trim() === "") return "silent";
  // Heard, but nothing Hebrew (English, say): nothing to compare.
  const heard = plainForComparison(check.heard);
  if (heard === "") return "misheard";
  switch (expected.kind) {
    case "text":
      return expected.forms.includes(heard) ? null : "misheard";
    case "sounds-like":
      return expected.forms.includes(soundsLike(heard)) ? null : "misheard";
    case "opening":
      return expected.letters.has(heard[0]) ? null : "misheard";
  }
}

/**
 * The suspect clips among the checked ones, in Content Bank order. Items
 * without a check (no clip, or not checked yet) are never suspect.
 */
export function suspectClips(bank: ContentBank, checks: ClipChecks): ReadonlyMap<ItemId, Suspicion> {
  const expected = expectations(bank);
  const suspects = new Map<ItemId, Suspicion>();
  for (const item of bank.spokenItems()) {
    const check = checks.checks[item.id];
    const expectation = expected.get(item.id);
    if (!check || !expectation) continue;
    const suspicion = judge(expectation, check);
    if (suspicion) suspects.set(item.id, suspicion);
  }
  return suspects;
}
