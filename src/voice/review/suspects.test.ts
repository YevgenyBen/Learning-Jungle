import { describe, expect, it } from "vitest";
import { contentBank } from "@/content";
import { plainForComparison, suspectClips, type ClipCheck, type ClipChecks } from "./suspects";

// Which clips the Voice Clip check makes suspect, judged against the real
// Content Bank from what speech to text heard.

const heard = (text: string): ClipCheck => ({
  audio: "0000000000000000",
  heard: text,
  durationMs: 1872,
  ...(text ? { confidence: 0.5, speechStartMs: 300, speechEndMs: 900 } : {}),
});

/** The suspicion for one item, given what was heard in its clip. */
const judged = (id: string, text: string) => suspectClips(contentBank, { checks: { [id]: heard(text) } }).get(id) ?? null;

describe("comparing heard text", () => {
  it("drops Niqqud and punctuation, and reads final letters as regular ones", () => {
    expect(plainForComparison("תַּפּוּחַ.")).toBe("תפוח");
    expect(plainForComparison(" כַּף  סוֹפִית! ")).toBe("כפ סופית");
  });
});

describe("suspect Voice Clips", () => {
  it("a Word heard as itself, with or without full spelling, is fine", () => {
    expect(judged("word-apple", "תפוח.")).toBeNull();
    expect(judged("word-tomato", "עגבנייה")).toBeNull();
    expect(judged("word-tomato", "עגבניה")).toBeNull();
  });

  it("a Word heard as something else is misheard, and one with no speech is silent", () => {
    expect(judged("word-fish", "דיג")).toBe("misheard");
    expect(judged("word-strawberry", "טעות.")).toBe("misheard");
    expect(judged("word-peacock", "")).toBe("silent");
    expect(judged("word-peacock", "That's.")).toBe("misheard");
  });

  it("a Letter Name may be heard as the letter, or spelled any way that sounds the same", () => {
    expect(judged("letter-gimel", "ג.")).toBeNull();
    expect(judged("letter-het", "חייט.")).toBeNull();
    expect(judged("letter-shin", "שיין")).toBeNull();
    expect(judged("letter-pe", "פה")).toBeNull();
    expect(judged("letter-alef", "1000.")).toBeNull();
    expect(judged("letter-he", "היי")).toBeNull();
  });

  it("a Letter Name heard as another name is misheard", () => {
    expect(judged("letter-ayin", "האם")).toBe("misheard");
    expect(judged("letter-final-pe", "וסופית")).toBe("misheard");
  });

  it("a number may be heard in digits or in words, but not as another number", () => {
    expect(judged("number-21", "21.")).toBeNull();
    expect(judged("number-21", "עשרים ואחת")).toBeNull();
    expect(judged("number-2", "שתיים.")).toBeNull();
    expect(judged("number-21", "22.")).toBe("misheard");
  });

  it("a sound is judged only by the consonant it is heard to start with, letters heard alike included", () => {
    expect(judged("sound-ba", "בא")).toBeNull();
    expect(judged("sound-ka", "קה")).toBeNull();
    expect(judged("sound-va", "וא")).toBeNull();
    expect(judged("sound-u", "הוא")).toBeNull();
    expect(judged("sound-gi", "די")).toBe("misheard");
    expect(judged("sound-do", "")).toBe("silent");
  });

  it("only checked clips can be suspect, listed in Content Bank order", () => {
    const checks: ClipChecks = {
      checks: { "number-21": heard("22"), "word-fish": heard("דיג"), "word-apple": heard("תפוח") },
    };

    expect([...suspectClips(contentBank, checks).keys()]).toEqual(["word-fish", "number-21"]);
  });
});
