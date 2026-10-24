import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contentBank } from "./index";

const PUBLIC = fileURLToPath(new URL("../../public", import.meta.url));

const word = (plain: string) => {
  const found = contentBank.words().find((w) => w.plain === plain);
  if (!found) throw new Error(`no Word ${plain} in the Content Bank`);
  return found;
};

describe("a Word's spelling for a Niqqud setting", () => {
  it("with Niqqud on is the Voweled Spelling, one letter per base letter with its marks", () => {
    const spelling = contentBank.spelling(word("עגבנייה"), { niqqud: true });
    expect(spelling.text).toBe("עַגְבָנִיָּה");
    expect(spelling.letters.map((l) => l.letter)).toEqual(["ע", "ג", "ב", "נ", "י", "ה"]);
    expect(spelling.letters.map((l) => l.marked).join("")).toBe("עַגְבָנִיָּה");
    expect(spelling.letters[0].marked).toBe("עַ");
  });

  it("with Niqqud off is the authored Plain Spelling, not the voweled one stripped", () => {
    const spelling = contentBank.spelling(word("עגבנייה"), { niqqud: false });
    expect(spelling.text).toBe("עגבנייה");
    expect(spelling.letters.map((l) => l.letter)).toEqual(["ע", "ג", "ב", "נ", "י", "י", "ה"]);
    expect(spelling.letters.every((l) => l.marked === l.letter)).toBe(true);
  });

  it("keeps final letter forms as they are written", () => {
    const spelling = contentBank.spelling(word("לימון"), { niqqud: true });
    expect(spelling.letters.map((l) => l.letter)).toEqual(["ל", "י", "מ", "ו", "ן"]);
  });
});

describe("Words", () => {
  it("can be filtered by Category", () => {
    const fruits = contentBank.words({ category: "fruits" });
    expect(fruits.map((w) => w.plain)).toContain("תפוח");
    expect(fruits.map((w) => w.plain)).not.toContain("גזר");
    expect(fruits.every((w) => w.category === "fruits")).toBe(true);
  });

  it("can be found by the letter their spelling starts with", () => {
    const gimel = contentBank.wordsStartingWith("ג").map((w) => w.plain);
    expect(gimel).toContain("גזר");
    expect(gimel).not.toContain("תפוח");
    expect(contentBank.wordsStartingWith("ת").map((w) => w.plain)).toEqual(
      expect.arrayContaining(["תפוח", "תות"]),
    );
  });

  it("starting with a letter are the same with and without Niqqud", () => {
    for (const letter of contentBank.letters()) {
      for (const w of contentBank.wordsStartingWith(letter.letter)) {
        expect(contentBank.spelling(w, { niqqud: true }).letters[0].letter, w.id).toBe(letter.letter);
        expect(contentBank.spelling(w, { niqqud: false }).letters[0].letter, w.id).toBe(letter.letter);
      }
    }
  });

  it("start with no final letter form", () => {
    expect(contentBank.wordsStartingWith("ם")).toEqual([]);
  });

  it("are said aloud from their Voweled Spelling", () => {
    const apple = word("תפוח");
    expect(apple.voweledText).toBe("תַּפּוּחַ");
    expect(apple.id).toMatch(/^word-[a-z-]+$/);
  });

  it("each have a Picture file named by the Word's identity", () => {
    expect(word("גזר").picture.src).toBe("/pictures/word-carrot.svg");
  });
});

describe("letters", () => {
  it("include the 22 letters and the 5 final forms", () => {
    const letters = contentBank.letters();
    expect(letters).toHaveLength(27);
    expect(letters.filter((l) => l.final).map((l) => l.letter)).toEqual(["ך", "ם", "ן", "ף", "ץ"]);
  });

  it("are said aloud as their voweled Letter Name", () => {
    const gimel = contentBank.letter("ג");
    expect(gimel?.name).toBe("גִּימֶל");
    expect(gimel?.voweledText).toBe("גִּימֶל");
    expect(contentBank.letter("ם")?.name).toBe("מֵם סוֹפִית");
  });
});

describe("integrity of the whole bank", () => {
  const NIQQUD = "ְ-ׇֽֿׁׂׅׄ";
  const voweled = new RegExp(`^[א-ת${NIQQUD}]+$`);
  const plain = /^[א-ת]+$/;

  it("every Word has a Voweled Spelling with Niqqud and a Plain Spelling without", () => {
    for (const w of contentBank.words()) {
      expect(w.voweled, w.id).toMatch(voweled);
      expect(w.voweled, w.id).not.toMatch(plain);
      expect(w.plain, w.id).toMatch(plain);
    }
  });

  it("every Word has a Category and a Picture file that exists", () => {
    const categories = ["fruits", "vegetables", "animals", "home-objects"];
    for (const w of contentBank.words()) {
      expect(categories, w.id).toContain(w.category);
      const file = join(PUBLIC, ...w.picture.src.split("/"));
      expect(existsSync(file), `${w.id}: ${w.picture.src}`).toBe(true);
      expect(readFileSync(file, "utf8"), w.id).toMatch(/<svg[\s>]/);
    }
  });

  it("every item has a unique identity", () => {
    const ids = [...contentBank.words(), ...contentBank.letters()].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
