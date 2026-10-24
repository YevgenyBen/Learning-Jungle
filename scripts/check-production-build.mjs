// Builds the app for production (static export) and checks that
// the dev/test-only Game hook is absent from every exported file.
// Run with `npm run test:build`.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A build folder of its own, so a running `next dev` (.next) is left alone.
// With a custom distDir, the static export lands in that folder, not out/.
const OUT = ".next-production";
const HOOK = "__learningJungleGame";
// Something the rabbit Game's bundle certainly contains, to prove the scan
// looks at the Game's code at all.
const CONTROL = "word-tomato";

const build = spawnSync("npx next build", {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: OUT },
});
if (build.status !== 0) {
  console.error("next build failed");
  process.exit(1);
}

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.(js|html|txt)$/.test(entry.name)) yield path;
  }
}

const withHook = [];
let controlFound = false;
for (const file of files(OUT)) {
  const text = readFileSync(file, "utf8");
  if (text.includes(HOOK)) withHook.push(file);
  if (text.includes(CONTROL)) controlFound = true;
}

if (!controlFound) {
  console.error(`Scan found no "${CONTROL}" in ${OUT}/: is the rabbit Game in the build?`);
  process.exit(1);
}
if (withHook.length > 0) {
  console.error(`The test hook "${HOOK}" is in the production build:\n  ${withHook.join("\n  ")}`);
  process.exit(1);
}
console.log(`OK: no "${HOOK}" in the production build.`);
