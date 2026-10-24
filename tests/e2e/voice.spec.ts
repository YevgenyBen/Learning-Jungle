import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { contentBank } from "../../src/content/bank";
import type { Said } from "../../src/voice/voicePlayer";
import { completeChallenge, gameRequests, gameState, waitForGame, type RabbitState } from "./game";
import { press } from "./helpers";

// The voice player in the running rabbit Game. These tests serve their own
// Voice Clip manifest, so the result never depends on the clips in
// public/voice/: one that lists a tiny test clip (tests/fixtures/voice) for
// every letter and Word, or an empty one for Speech Fallback.

const TEST_CLIP = path.join(__dirname, "../fixtures/voice/test-clip.wav");

const voiceSaid = (page: Page): Promise<Said[]> => page.evaluate(() => window.__learningJungleGame!.voiceSaid());
const soundsPlayed = (page: Page) => page.evaluate(() => window.__learningJungleGame!.soundsPlayed());
const muteControl =(page: Page) => page.getByRole("button", { name: "השתקה", exact: true });

/** Serves a manifest listing the test clip for every letter and Word. */
async function serveTestClips(page: Page) {
  const ids = [...contentBank.letters(), ...contentBank.words()].map((item) => item.id);
  const clips = Object.fromEntries(ids.map((id) => [id, { file: "test-clip.wav" }]));
  await page.route("**/voice/manifest.json", (route) => route.fulfill({ json: { clips } }));
  await page.route("**/voice/test-clip.wav", (route) =>
    route.fulfill({ path: TEST_CLIP, contentType: "audio/wav" }),
  );
}

/** Serves a manifest with no clips, so every item falls back to speech. */
async function serveNoClips(page: Page) {
  await page.route("**/voice/manifest.json", (route) => route.fulfill({ json: { clips: {} } }));
}

/** Gives the page a speech synthesis with only these voices, recording what it is asked to say. */
async function fakeSpeech(page: Page, voices: { lang: string; name: string }[]) {
  await page.addInitScript((list) => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    class Utterance {
      lang = "";
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    const synthesis = {
      speak: (u: Utterance) => {
        spoken.push(u.text);
        setTimeout(() => u.onend?.(), 50);
      },
      cancel() {},
      getVoices: () => list,
    };
    Object.defineProperty(window, "speechSynthesis", { value: synthesis, configurable: true });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true });
  }, voices);
}

/** Opens the rabbit Game once its manifest has loaded, after one key press (a Player's gesture). */
async function openGame(page: Page) {
  const manifest = page.waitForResponse("**/voice/manifest.json");
  await page.goto("/games/rabbit");
  await waitForGame(page, "rabbit");
  await manifest;
  // A gesture lets the browser start audio; the Player always makes one before collecting.
  await page.keyboard.press("Space");
}

/** The ids of what the model asked to be said, in order. */
async function requestedSays(page: Page) {
  return (await gameRequests(page)).flatMap((r) => (r.kind === "say" ? [r.item.id] : []));
}

test.describe("Voice Clips", () => {
  test("a clip in the manifest is played: the last Letter Name, then the Word after it", async ({ page, browserName }) => {
    test.skip(
      browserName === "webkit" && process.platform === "win32",
      "Playwright's WebKit for Windows has no media playback (every clip fails with NotSupportedError)",
    );
    await serveTestClips(page);
    await openGame(page);
    const { challenge } = await gameState<RabbitState>(page);

    await completeChallenge(page);
    const said = await requestedSays(page);
    const lastLetter = said.at(-2)!;
    expect(said.at(-1)).toBe(challenge.word.id);

    await expect
      .poll(() => voiceSaid(page))
      .toEqual([
        { id: lastLetter, via: "clip" },
        { id: challenge.word.id, via: "clip" },
      ]);
  });

  test("mute silences the voice as well as Sound Effects", async ({ page }) => {
    await serveTestClips(page);
    await openGame(page);
    await press(muteControl(page));
    await expect(muteControl(page)).toHaveAttribute("aria-pressed", "true");
    const soundsBefore = await soundsPlayed(page);

    await completeChallenge(page);
    await page.waitForTimeout(500);

    expect(await requestedSays(page)).not.toEqual([]);
    expect(await voiceSaid(page)).toEqual([]);
    expect(await soundsPlayed(page)).toEqual(soundsBefore);
  });
});

test.describe("Speech Fallback", () => {
  test.beforeEach(({ page }) => serveNoClips(page));

  test("with no clip, the device's Hebrew voice reads the Letter Names and the Word", async ({ page }) => {
    await fakeSpeech(page, [
      { lang: "en-US", name: "English" },
      { lang: "he-IL", name: "Hebrew" },
    ]);
    await openGame(page);
    const { challenge } = await gameState<RabbitState>(page);

    await completeChallenge(page);

    await expect.poll(() => voiceSaid(page)).toContainEqual({ id: challenge.word.id, via: "speech" });
    const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
    expect(spoken.at(-1)).toBe(challenge.word.voweled);
  });

  for (const [name, setUp] of [
    ["no Hebrew device voice", (page: Page) => fakeSpeech(page, [{ lang: "en-US", name: "English" }])],
    [
      "no speech synthesis at all",
      (page: Page) =>
        page.addInitScript(() => {
          for (const name of ["speechSynthesis", "SpeechSynthesisUtterance"]) {
            Object.defineProperty(window, name, { value: undefined, configurable: true });
          }
        }),
    ],
  ] as const) {
    test(`with no clip and ${name}, the Game plays on silently with no errors`, async ({ page }) => {
      const errors: Error[] = [];
      page.on("pageerror", (error) => errors.push(error));
      await setUp(page);
      await openGame(page);

      await completeChallenge(page);
      await completeChallenge(page);

      expect((await gameState<RabbitState>(page)).progress.completed).toBe(2);
      expect(await voiceSaid(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
});
