import { describe, expect, it } from "vitest";
import { contentBank } from "@/content";
import { soundsLikePhonemes } from "./soundsLike";

const ipa = (text: string, spelling: string) => soundsLikePhonemes(text, spelling).map((w) => w.ipa);

describe("a Sounds-like Spelling", () => {
  it("is read as the he-IL phones, Hebrew r and kh included", () => {
    expect(ipa("רָחוֹק", "rakhok")).toEqual(["ʁaxok"]);
    expect(ipa("וָ", "va")).toEqual(["va"]);
    expect(ipa("פְּ", "p")).toEqual(["p"]);
  });

  it("reads two-letter sounds before single letters", () => {
    expect(ipa("שֶׁמֶשׁ", "shemesh")).toEqual(["ʃemeʃ"]);
    expect(ipa("צִפּוֹר", "tsipor")).toEqual(["t͡sipoʁ"]);
    expect(ipa("צִפּוֹר", "tzipor")).toEqual(["t͡sipoʁ"]);
    expect(ipa("חַלָּה", "challa")).toEqual(["xalla"]);
    expect(ipa("יֶלֶד", "yeled")).toEqual(["jeled"]);
    expect(ipa("ג'וּנְגֶּל", "jungel")).toEqual(["dʒungel"]);
    expect(ipa("צ'יפּס", "tchips")).toEqual(["tʃips"]);
    expect(ipa("ז'ָאנֶר", "zhaner")).toEqual(["ʒaneʁ"]);
  });

  it("marks syllables, and the stress before the syllable in capitals", () => {
    expect(ipa("תַּפּוּחַ", "ta-PU-akh")).toEqual(["ta" + "ˈpu" + ".ax"]);
    expect(ipa("גֶּשֶׁם", "GE-shem")).toEqual(["ˈge.ʃem"]);
    expect(ipa("אַגָּס", "a-GAS")).toEqual(["aˈgas"]);
    expect(ipa("שָׁלוֹם", "sha-lom")).toEqual(["ʃa.lom"]);
  });

  it("writes the catch of alef or ayin with an apostrophe", () => {
    expect(ipa("מַאֲמִין", "ma-'a-MIN")).toEqual(["ma.ʔaˈmin"]);
  });

  it("gives one word for each word of the text", () => {
    expect(soundsLikePhonemes("פֵּא סוֹפִית", "pe so-FIT")).toEqual([
      { text: "פֵּא", ipa: "pe" },
      { text: "סוֹפִית", ipa: "soˈfit" },
    ]);
  });

  it("is refused, saying what to fix, when it can't be read", () => {
    expect(() => soundsLikePhonemes("וָ", "wa")).toThrow(/"w".*write v instead/);
    expect(() => soundsLikePhonemes("כָּ", "ca")).toThrow(/"c".*k, s, kh or ts/);
    expect(() => soundsLikePhonemes("וָ", "vá")).toThrow(/"á" is not a Sounds-like letter/);
    expect(() => soundsLikePhonemes("תַּפּוּחַ", "TA-PU-akh")).toThrow(/more than one stressed/);
    expect(() => soundsLikePhonemes("תַּפּוּחַ", "ta-Pu-akh")).toThrow(/whole stressed syllable in capitals/);
    expect(() => soundsLikePhonemes("תַּפּוּחַ", "ta--pu")).toThrow(/empty syllable/);
    expect(() => soundsLikePhonemes("פֵּא סוֹפִית", "pe")).toThrow(/1 word\(s\) but .* has 2/);
    expect(() => soundsLikePhonemes("וָ", "  ")).toThrow(/empty/);
  });
});

describe("the Content Bank's Sounds-like Spellings", () => {
  it("can all be read", () => {
    for (const item of contentBank.spokenItems()) {
      if (item.soundsLike !== undefined) {
        expect(() => soundsLikePhonemes(item.pronunciation ?? item.voweledText, item.soundsLike!), item.id).not.toThrow();
      }
    }
  });
});
