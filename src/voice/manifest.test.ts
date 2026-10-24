import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contentBank } from "@/content";

// The Voice Clip manifest shipped with the app (public/voice/manifest.json).
// The generation script (#10) writes it; these checks keep it honest.

const VOICE_DIR = fileURLToPath(new URL("../../public/voice/", import.meta.url));
const manifest = JSON.parse(readFileSync(`${VOICE_DIR}manifest.json`, "utf8")) as {
  clips: Record<string, { file: string }>;
};

/** Everything in the Content Bank that can be said aloud. */
const spokenIds = new Set([
  ...contentBank.words().map((w) => w.id),
  ...contentBank.letters().map((l) => l.id),
  ...contentBank.letterSounds().map((s) => s.sound.id),
  ...contentBank.numbers().map((n) => n.id),
]);

describe("the shipped Voice Clip manifest", () => {
  it("lists clips by item identity", () => {
    expect(typeof manifest.clips).toBe("object");
    expect(Array.isArray(manifest.clips)).toBe(false);
  });

  it("lists only items the Content Bank says aloud", () => {
    const unknown = Object.keys(manifest.clips).filter((id) => !spokenIds.has(id));
    expect(unknown).toEqual([]);
  });

  it("names a file next to it for every clip it lists", () => {
    const missing = Object.entries(manifest.clips).filter(
      ([, clip]) => typeof clip.file !== "string" || clip.file.includes("/") || !existsSync(VOICE_DIR + clip.file),
    );
    expect(missing).toEqual([]);
  });
});
