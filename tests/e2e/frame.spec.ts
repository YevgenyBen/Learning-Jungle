import { expect, test, type Page } from "@playwright/test";
import type { SoundEffect } from "../../src/games/contract";
import { completeChallenge, gameRequests, gameState, solveStep, waitForGame, type RabbitState } from "./game";
import { press } from "./helpers";

// The Game Frame's controls, exercised through the rabbit Game. Key tests
// run on every project too: tablets and phones can have keyboards.

const control = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const pauseControl = (page: Page) => control(page, "עצירה");
const resumeControl = (page: Page) => control(page, "המשך");
const restartControl = (page: Page) => control(page, "מהתחלה");
const muteControl = (page: Page) => control(page, "השתקה");

const gameTime = async (page: Page) => (await gameState<RabbitState>(page)).time;
const completed = async (page: Page) => (await gameState<RabbitState>(page)).progress.completed;
const soundsPlayed = (page: Page) => page.evaluate(() => window.__learningJungleGame!.soundsPlayed());
const soundsRequested = async (page: Page): Promise<SoundEffect[]> =>
  (await gameRequests(page)).flatMap((r) => (r.kind === "sound" ? [r.effect] : []));

async function openGame(page: Page) {
  await page.goto("/games/rabbit");
  await waitForGame(page, "rabbit");
}

/** Game time keeps moving. */
async function expectRunning(page: Page) {
  await expect(resumeControl(page)).toBeHidden();
  const before = await gameTime(page);
  await expect.poll(() => gameTime(page)).toBeGreaterThan(before + 0.1);
}

/** Game time stands still. */
async function expectPaused(page: Page) {
  await expect(resumeControl(page)).toBeVisible();
  const before = await gameTime(page);
  await page.waitForTimeout(400);
  expect(await gameTime(page)).toBe(before);
}

/** Completes a Challenge, then starts the Round over and waits for the fresh Round. */
async function expectRestartedBy(page: Page, restart: () => Promise<void>) {
  await completeChallenge(page);
  expect(await completed(page)).toBe(1);
  const timeBefore = await gameTime(page);

  await restart();

  await expect.poll(() => completed(page)).toBe(0);
  expect(await gameTime(page)).toBeLessThan(timeBefore);
  await expect(page.getByTestId("word-bar").locator('[data-slot="filled"]')).toHaveCount(0);
}

test.describe("pause", () => {
  test("the pause control stops the Game, and the resume control carries on", async ({ page }) => {
    await openGame(page);
    await expectRunning(page);

    await press(pauseControl(page));
    await expectPaused(page);

    await press(resumeControl(page));
    await expectRunning(page);
  });

  for (const key of ["Escape", "KeyP"]) {
    test(`${key} pauses the Game and carries on again`, async ({ page }) => {
      await openGame(page);
      await page.keyboard.press(key);
      await expectPaused(page);

      await page.keyboard.press(key);
      await expectRunning(page);
    });
  }

  test("Space carries on a paused Game without making the rabbit jump", async ({ page }) => {
    await openGame(page);
    await page.keyboard.press("KeyP");
    await expectPaused(page);

    await page.keyboard.press("Space");
    await expectRunning(page);
    const jumps = (await soundsRequested(page)).filter((effect) => effect === "jump");
    expect(jumps).toEqual([]);
  });

  test("the Game pauses by itself when the tab is hidden", async ({ page }) => {
    await openGame(page);
    await expectRunning(page);

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await expectPaused(page);
  });

  test("the Game pauses by itself when the window loses focus", async ({ page }) => {
    await openGame(page);
    await expectRunning(page);

    await page.evaluate(() => window.dispatchEvent(new Event("blur")));

    await expectPaused(page);
    await press(resumeControl(page));
    await expectRunning(page);
  });
});

test.describe("restart", () => {
  test("the restart control starts the Round over", async ({ page }) => {
    await openGame(page);
    await expectRestartedBy(page, () => press(restartControl(page)));
    await expectRunning(page);
  });

  test("Enter starts the Round over", async ({ page }) => {
    await openGame(page);
    await expectRestartedBy(page, () => page.keyboard.press("Enter"));
    await expectRunning(page);
  });

  test("restart works while paused, by control and by Enter", async ({ page }) => {
    await openGame(page);
    await press(pauseControl(page));
    await expectRestartedBy(page, () => press(restartControl(page)));
    await expectRunning(page);

    await page.keyboard.press("KeyP");
    await expectRestartedBy(page, () => page.keyboard.press("Enter"));
    await expectRunning(page);
  });
});

test.describe("mute and Sound Effects", () => {
  test("every Sound Effect the Game asks for plays: jump, collect and Challenge complete", async ({ page }) => {
    await openGame(page);
    await completeChallenge(page);

    const requested = await soundsRequested(page);
    expect(requested).toEqual(expect.arrayContaining(["jump", "collect", "challenge-complete"]));
    expect(await soundsPlayed(page)).toEqual(requested);
  });

  test("the mute control silences every Sound Effect, and pressing it again brings them back", async ({ page }) => {
    await openGame(page);
    await press(muteControl(page));
    await expect(muteControl(page)).toHaveAttribute("aria-pressed", "true");

    await completeChallenge(page);
    expect(await soundsRequested(page)).not.toEqual([]);
    expect(await soundsPlayed(page)).toEqual([]);

    await press(muteControl(page));
    await expect(muteControl(page)).toHaveAttribute("aria-pressed", "false");
    await solveStep(page);
    expect(await soundsPlayed(page)).not.toEqual([]);
  });

  test("M mutes and unmutes", async ({ page }) => {
    await openGame(page);
    await page.keyboard.press("KeyM");
    await expect(muteControl(page)).toHaveAttribute("aria-pressed", "true");

    await completeChallenge(page);
    expect(await soundsPlayed(page)).toEqual([]);

    await page.keyboard.press("KeyM");
    await expect(muteControl(page)).toHaveAttribute("aria-pressed", "false");
    await solveStep(page);
    expect(await soundsPlayed(page)).not.toEqual([]);
  });

  test("the Game plays on without errors where Web Audio is missing", async ({ page }) => {
    await page.addInitScript(() => {
      const audio = window as { AudioContext?: unknown; webkitAudioContext?: unknown };
      delete audio.AudioContext;
      delete audio.webkitAudioContext;
    });
    const errors = collectErrors(page);
    await openGame(page);
    await completeChallenge(page);
    await expectRunning(page);
    expect(errors).toEqual([]);
  });
});

test.describe("controls", () => {
  test("every Frame control is big enough for a small finger, the pause screen's too", async ({ page }) => {
    await openGame(page);
    await press(pauseControl(page));
    await expect(resumeControl(page)).toBeVisible();

    const buttons = await page.getByRole("button").all();
    expect(buttons.length).toBeGreaterThanOrEqual(5);
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(60);
      expect(box!.height).toBeGreaterThanOrEqual(60);
    }
  });

  test("the controls and the Game all fit on the screen", async ({ page }) => {
    await openGame(page);
    const viewport = page.viewportSize()!;
    for (const target of [...(await page.getByRole("button").all()), page.getByTestId("meadow")]) {
      const box = (await target.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
  });
});

test.describe("full screen", () => {
  test("starting a Game from its Menu asks for full screen and a landscape lock", async ({ page }) => {
    await page.addInitScript(() => {
      const asked: string[] = [];
      (window as unknown as { __asked: string[] }).__asked = asked;
      Element.prototype.requestFullscreen = function () {
        asked.push("full-screen");
        return Promise.resolve();
      };
      // Stubbed on the prototype: screen.orientation may not exist yet when this runs.
      const orientation = window.ScreenOrientation?.prototype as { lock?: unknown } | undefined;
      if (orientation) {
        orientation.lock = (to: string) => {
          asked.push(`lock:${to}`);
          return Promise.resolve();
        };
      }
    });
    await page.goto("/subjects/hebrew");
    await press(page.getByRole("button", { name: "ארנב קופץ", exact: true }));
    await waitForGame(page, "rabbit");

    const asked = () => page.evaluate(() => (window as unknown as { __asked: string[] }).__asked);
    await expect.poll(asked).toContain("full-screen");
    if (await page.evaluate(() => "ScreenOrientation" in window)) {
      await expect.poll(asked).toContain("lock:landscape");
    }
  });

  test("where full screen and orientation lock are missing or refused, the Game just plays", async ({ page }) => {
    await page.addInitScript(() => {
      const proto = Element.prototype as Partial<Element> & { webkitRequestFullscreen?: unknown };
      delete proto.requestFullscreen;
      delete proto.webkitRequestFullscreen;
      const orientation = window.ScreenOrientation?.prototype as { lock?: unknown } | undefined;
      if (orientation) {
        orientation.lock = () => Promise.reject(new DOMException("no", "NotSupportedError"));
      }
    });
    const errors = collectErrors(page);
    await page.goto("/subjects/hebrew");
    await press(page.getByRole("button", { name: "ארנב קופץ", exact: true }));
    await waitForGame(page, "rabbit");
    await press(page.getByTestId("meadow"));
    await expectRunning(page);
    expect(errors).toEqual([]);
  });
});

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}
