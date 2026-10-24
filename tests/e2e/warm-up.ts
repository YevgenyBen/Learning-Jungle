/**
 * Global setup: opens every route once, one after another, before any test
 * starts, so the tests never race the dev server's first compile.
 *
 * Why: the first request for a route with `generateStaticParams`
 * (/subjects/[subject], /games/[game]) makes `next dev` work out its static
 * params in the background and then rewrite `<distDir>/dev/prerender-manifest.json`
 * with a plain, non-atomic `writeFile`. Every page request reads that file.
 * On a fresh `.next-e2e`, with the tests' parallel workers opening pages at
 * once, a request now and then reads it half-written (empty) and the page
 * fails with "SyntaxError: Unexpected end of JSON input", on the server and
 * then in the browser. Once each dynamic route is recorded the file is
 * never rewritten, so recording them one at a time here removes the race.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { E2E_DIST_DIR } from "./server";

/** Every route the tests open, with each dynamic route's pattern where it has one. */
const ROUTES: readonly { readonly path: string; readonly pattern?: string }[] = [
  { path: "/" },
  { path: "/home" },
  { path: "/subjects/hebrew", pattern: "/subjects/[subject]" },
  { path: "/subjects/math", pattern: "/subjects/[subject]" },
  { path: "/games/rabbit", pattern: "/games/[game]" },
  { path: "/games/first-letter", pattern: "/games/[game]" },
  { path: "/credits" },
  { path: "/dev/voice-clips" },
];

const PRERENDER_MANIFEST = path.join(__dirname, "../..", E2E_DIST_DIR, "dev", "prerender-manifest.json");
const ATTEMPTS = 3;
const RECORD_TIMEOUT = 60_000;

export default async function warmUp(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL;
  if (!baseURL) throw new Error("warm-up: no baseURL in playwright.config.ts");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const route of ROUTES) {
      await open(page, baseURL + route.path);
      if (route.pattern) await recorded(route.pattern);
    }
  } finally {
    await browser.close();
  }
}

/** Opens a page until it loads without an error status (a cold compile can still fail once). */
async function open(page: import("@playwright/test").Page, url: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const response = await page.goto(url, { waitUntil: "load", timeout: 120_000 }).catch((error: Error) => error);
    if (!(response instanceof Error) && response?.ok()) return;
    if (attempt === ATTEMPTS) {
      const why = response instanceof Error ? response.message : `status ${response?.status()}`;
      throw new Error(`warm-up: ${url} did not load (${why})`);
    }
  }
}

/** Waits until the dev server has written this dynamic route into its prerender manifest. */
async function recorded(pattern: string): Promise<void> {
  const deadline = Date.now() + RECORD_TIMEOUT;
  for (;;) {
    const manifest = await readPrerenderManifest();
    // No manifest at all: a server reused from elsewhere (another build folder). Nothing to wait for.
    if (manifest === "missing") return;
    if (manifest?.dynamicRoutes && pattern in manifest.dynamicRoutes) return;
    if (Date.now() > deadline) {
      throw new Error(`warm-up: ${pattern} never appeared in ${PRERENDER_MANIFEST}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** The manifest, "missing" if there is no such file, or null while it is half-written. */
async function readPrerenderManifest(): Promise<{ dynamicRoutes?: Record<string, unknown> } | "missing" | null> {
  let text: string;
  try {
    text = await readFile(PRERENDER_MANIFEST, "utf8");
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT" ? "missing" : null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
