// Copies each Word's Twemoji SVG from the pinned `@twemoji/svg` package into
// public/pictures/<word id>.svg. Run with `npm run pictures` after adding Words.
//
// Only missing files are copied: a Picture already in public/pictures/ (for
// example a custom illustration under the same identity) is never overwritten.
// Pass --force to recopy every Twemoji Picture.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Node strips the types from the authored data (Node 23.6 or later).
import { WORDS } from "../src/content/data/words.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const twemoji = dirname(createRequire(import.meta.url).resolve("@twemoji/svg/package.json"));
const target = join(root, "public", "pictures");
const force = process.argv.includes("--force");

/** Twemoji names a file by its code points in hex, without the U+FE0F variation selector. */
const twemojiFile = (emoji) =>
  [...emoji]
    .map((char) => char.codePointAt(0))
    .filter((point) => point !== 0xfe0f)
    .map((point) => point.toString(16))
    .join("-") + ".svg";

mkdirSync(target, { recursive: true });
let copied = 0;
const missing = [];
for (const word of WORDS) {
  const destination = join(target, `${word.id}.svg`);
  if (existsSync(destination) && !force) continue;
  const source = join(twemoji, twemojiFile(word.emoji));
  if (!existsSync(source)) {
    missing.push(`${word.id} (${word.emoji} -> ${twemojiFile(word.emoji)})`);
    continue;
  }
  copyFileSync(source, destination);
  copied++;
}

console.log(`Copied ${copied} Picture(s) into public/pictures/.`);
if (missing.length > 0) {
  console.error(`No Twemoji file for:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
