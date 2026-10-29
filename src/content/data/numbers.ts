/**
 * The numbers 0-100 in their feminine form (what counting uses: אַחַת, שְׁתַּיִם,
 * שָׁלוֹשׁ), voweled. 21-99 are the tens followed by the unit joined with ו:
 * וְ in general, וּ before a shva (וּשְׁתַּיִם, וּשְׁמוֹנֶה), and תֵּשַׁע loses its
 * dagesh after it (וְתֵשַׁע).
 *
 * A number's identity is `number-` plus its digits (`number-21`).
 */

/** 0-9 on their own. */
export const UNITS: readonly string[] = [
  "אֶפֶס",
  "אַחַת",
  "שְׁתַּיִם",
  "שָׁלוֹשׁ",
  "אַרְבַּע",
  "חָמֵשׁ",
  "שֵׁשׁ",
  "שֶׁבַע",
  "שְׁמוֹנֶה",
  "תֵּשַׁע",
];

/** 10-19. */
export const TEN_TO_NINETEEN: readonly string[] = [
  "עֶשֶׂר",
  "אַחַת עֶשְׂרֵה",
  "שְׁתֵּים עֶשְׂרֵה",
  "שְׁלוֹשׁ עֶשְׂרֵה",
  "אַרְבַּע עֶשְׂרֵה",
  "חֲמֵשׁ עֶשְׂרֵה",
  "שֵׁשׁ עֶשְׂרֵה",
  "שְׁבַע עֶשְׂרֵה",
  "שְׁמוֹנֶה עֶשְׂרֵה",
  "תְּשַׁע עֶשְׂרֵה",
];

/** 20, 30, ... 90, indexed by the tens digit minus 2. */
export const TENS: readonly string[] = [
  "עֶשְׂרִים",
  "שְׁלוֹשִׁים",
  "אַרְבָּעִים",
  "חֲמִשִּׁים",
  "שִׁשִּׁים",
  "שִׁבְעִים",
  "שְׁמוֹנִים",
  "תִּשְׁעִים",
];

/** 1-9 joined with ו after a ten (עֶשְׂרִים וְאַחַת), indexed by the unit minus 1. */
export const AND_UNITS: readonly string[] = [
  "וְאַחַת",
  "וּשְׁתַּיִם",
  "וְשָׁלוֹשׁ",
  "וְאַרְבַּע",
  "וְחָמֵשׁ",
  "וְשֵׁשׁ",
  "וְשֶׁבַע",
  "וּשְׁמוֹנֶה",
  "וְתֵשַׁע",
];

export const HUNDRED = "מֵאָה";

/**
 * Pronunciation overrides by number, used only when generating Voice Clips.
 */
export const NUMBER_PRONUNCIATIONS: Readonly<Record<number, string>> = {};

/**
 * Sounds-like Spellings by number, used only when generating Voice Clips.
 */
export const NUMBER_SOUNDS_LIKE: Readonly<Record<number, string>> = {};
