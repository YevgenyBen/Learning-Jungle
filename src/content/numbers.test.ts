import { describe, expect, it } from "vitest";
import { contentBank } from "./index";

const spoken = (value: number) => {
  const found = contentBank.number(value);
  if (!found) throw new Error(`no number ${value} in the Content Bank`);
  return found;
};

describe("numbers", () => {
  it("are said aloud in their feminine form", () => {
    const one = spoken(1);
    expect(one.value).toBe(1);
    expect(one.feminine).toBe("אַחַת".normalize("NFC"));
    expect(one.voweledText).toBe(one.feminine);
    expect(one.id).toBe("number-1");
  });

  it.each([
    [0, "אֶפֶס"],
    [2, "שְׁתַּיִם"],
    [3, "שָׁלוֹשׁ"],
    [8, "שְׁמוֹנֶה"],
    [9, "תֵּשַׁע"],
    [10, "עֶשֶׂר"],
    [11, "אַחַת עֶשְׂרֵה"],
    [12, "שְׁתֵּים עֶשְׂרֵה"],
    [15, "חֲמֵשׁ עֶשְׂרֵה"],
    [19, "תְּשַׁע עֶשְׂרֵה"],
    [20, "עֶשְׂרִים"],
    [21, "עֶשְׂרִים וְאַחַת"],
    [22, "עֶשְׂרִים וּשְׁתַּיִם"],
    [28, "עֶשְׂרִים וּשְׁמוֹנֶה"],
    [29, "עֶשְׂרִים וְתֵשַׁע"],
    [35, "שְׁלוֹשִׁים וְחָמֵשׁ"],
    [40, "אַרְבָּעִים"],
    [47, "אַרְבָּעִים וְשֶׁבַע"],
    [56, "חֲמִשִּׁים וְשֵׁשׁ"],
    [64, "שִׁשִּׁים וְאַרְבַּע"],
    [73, "שִׁבְעִים וְשָׁלוֹשׁ"],
    [80, "שְׁמוֹנִים"],
    [99, "תִּשְׁעִים וְתֵשַׁע"],
    [100, "מֵאָה"],
  ])("%i is %s", (value, text) => {
    expect(spoken(value).feminine).toBe(text.normalize("NFC"));
  });

  it("are the complete range 0-100, in order, with stable unique identities", () => {
    const numbers = contentBank.numbers();
    expect(numbers.map((n) => n.value)).toEqual(Array.from({ length: 101 }, (_, i) => i));
    expect(numbers.map((n) => n.id)).toEqual(numbers.map((n) => `number-${n.value}`));
    expect(new Set(numbers.map((n) => n.feminine)).size).toBe(101);
    expect(contentBank.number(101)).toBeUndefined();
    expect(contentBank.number(-1)).toBeUndefined();
    expect(contentBank.number(2.5)).toBeUndefined();
  });

  it("are written only in voweled Hebrew words, NFC normalized", () => {
    // Every word has letters and vowel marks (shva, hataf vowels, vowels,
    // dagesh, shin/sin dots); words are separated by single spaces.
    const voweledWords = /^[א-תְ-ּׁׂ]+( [א-תְ-ּׁׂ]+)*$/;
    for (const n of contentBank.numbers()) {
      expect(n.feminine, n.id).toMatch(voweledWords);
      expect(n.feminine, n.id).toBe(n.feminine.normalize("NFC"));
      for (const word of n.feminine.split(" ")) expect(word, n.id).toMatch(/[ְ-ֻ]/);
    }
  });
});
