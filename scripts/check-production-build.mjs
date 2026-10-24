// Builds the app for production (static export) and checks that nothing
// development-only made it in: the dev/test Game hook and the Voice Clip
// review page (/dev/voice-clips). Run with `npm run test:build`.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// A build folder of its own, so a running `next dev` (.next) is left alone.
// With a custom distDir, the static export lands in that folder, not out/.
const OUT = ".next-production";
const HOOK = "__learningJungleGame";
// The review page: no built file for its route, and none of its code
// (its root element's test id, which its bundle would certainly contain).
const REVIEW_ROUTE = /(^|[\\/])voice-clips([\\/.]|$)/;
const REVIEW_CODE = "voice-clip-review";
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
    else yield path;
  }
}

const withHook = [];
const reviewRoute = [];
const reviewCode = [];
let controlFound = false;
for (const file of files(OUT)) {
  if (REVIEW_ROUTE.test(relative(OUT, file))) reviewRoute.push(file);
  if (!/\.(js|html|txt|json|rsc)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  if (text.includes(HOOK)) withHook.push(file);
  if (text.includes(REVIEW_CODE)) reviewCode.push(file);
  if (text.includes(CONTROL)) controlFound = true;
}

const failures = [];
if (!controlFound) failures.push(`Scan found no "${CONTROL}" in ${OUT}/: is the rabbit Game in the build?`);
const list = (found) => found.map((file) => `\n  ${file}`).join("");
if (withHook.length > 0) failures.push(`The test hook "${HOOK}" is in the production build:${list(withHook)}`);
if (reviewRoute.length > 0) failures.push(`The Voice Clip review page has a route in the production build:${list(reviewRoute)}`);
if (reviewCode.length > 0) failures.push(`The Voice Clip review page's code is in the production build:${list(reviewCode)}`);
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`OK: no "${HOOK}" and no Voice Clip review page in the production build.`);
