import { expect, test, type Page } from "@playwright/test";
import { completeChallenge, gameState, waitForGame, type RabbitState } from "./game";
import { isTouch, press } from "./helpers";

// A Round of the rabbit Game, played through the test hook, and the Game
// Frame's Round Celebration screen at its end.

const roundProgress = (page: Page) => page.getByRole("progressbar", { name: "סיבוב" });
const roundCelebration = (page: Page) => page.getByRole("dialog", { name: "כל הכבוד!" });
const anotherRound = (page: Page) => roundCelebration(page).getByRole("button", { name: "עוד סיבוב" });
const backToMenu = (page: Page) => roundCelebration(page).getByRole("button", { name: "חזרה" });

async function openGame(page: Page) {
  await page.goto("/games/rabbit");
  await waitForGame(page, "rabbit");
}

/** Completes the Round's three Words; the Round Celebration screen then comes up. */
async function playRound(page: Page) {
  for (const completed of [1, 2, 3]) {
    await completeChallenge(page);
    await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", String(completed));
  }
  await expect(roundCelebration(page)).toBeVisible();
}

/**
 * Lets game time pass, through the hook, until the rabbit stands just before
 * the needed letter's tile (true), or the Round is over (false).
 */
async function runUpToNeededTile(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const hook = window.__learningJungleGame!;
    const state = () => hook.state() as unknown as RabbitState;
    for (let t = 0; t < 60; t += 1 / 60) {
      const s = state();
      if (s.roundOver) return false;
      if (s.celebration === null && s.rabbit.onGround) {
        const need = s.challenge.letters[s.challenge.next].letter;
        const ahead = s.tiles.find((tile) => !tile.collected && tile.letter === need && tile.x - s.rabbit.x > -20);
        if (ahead && ahead.x - s.rabbit.x < 30) return true;
      }
      hook.advance(1 / 60);
    }
    throw new Error("the needed letter never came");
  });
}

/** Lets game time pass until the rabbit has left the ground (true) and landed again (false). */
async function runUntilRabbit(page: Page, airborne: boolean): Promise<void> {
  await page.evaluate((airborne) => {
    const hook = window.__learningJungleGame!;
    for (let t = 0; t < 2; t += 1 / 60) {
      if ((hook.state() as unknown as RabbitState).rabbit.onGround !== airborne) return;
      hook.advance(1 / 60);
    }
    throw new Error(airborne ? "the rabbit didn't jump" : "the rabbit didn't land");
  }, airborne);
}

test.describe("a Round of the rabbit Game", () => {
  test("can be played to its end with real jumps: Space on desktop, taps on touch screens", async ({ page }) => {
    // Real time stops once the Game is open, so the Game moves only when the
    // test lets time pass: each jump comes exactly when the Player would make it.
    await page.clock.install();
    await openGame(page);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    const surface = (await page.getByTestId("game-surface").boundingBox())!;

    let jumps = 0;
    while (await runUpToNeededTile(page)) {
      if (isTouch()) {
        await page.touchscreen.tap(surface.x + surface.width / 2, surface.y + surface.height / 2);
        await runUntilRabbit(page, true);
        await runUntilRabbit(page, false);
      } else {
        await page.keyboard.down("Space");
        await runUntilRabbit(page, true);
        await runUntilRabbit(page, false);
        await page.keyboard.up("Space");
      }
      jumps++;
    }

    const state = await gameState<RabbitState>(page);
    expect(state.roundOver).toBe(true);
    expect(state.progress).toEqual({ completed: 3, total: 3 });
    // One jump per letter, at least three letters in each of the three Words.
    expect(jumps).toBeGreaterThanOrEqual(9);
    await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", "3");
    await expect(roundCelebration(page)).toBeVisible();
  });

  test("shows its progress, celebrates each Word, and another Round starts a new Round", async ({ page }) => {
    await openGame(page);
    await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", "0");
    await expect(roundProgress(page)).toHaveAttribute("aria-valuemax", "3");

    const { challenge } = await gameState<RabbitState>(page);
    await completeChallenge(page);
    await expect(page.getByTestId("celebration-sign")).toContainText(challenge.text);
    await expect(
      page.getByTestId("celebration-sign").getByRole("img", { name: challenge.word.plain }),
    ).toHaveAttribute("src", `/pictures/${challenge.word.id}.svg`);
    await expect(roundCelebration(page)).toBeHidden();

    await completeChallenge(page);
    await completeChallenge(page);
    await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", "3");
    await expect(roundCelebration(page)).toBeVisible();
    expect((await gameState<RabbitState>(page)).roundOver).toBe(true);

    await press(anotherRound(page));
    await expect(roundCelebration(page)).toBeHidden();
    await waitForGame(page, "rabbit");
    await expect.poll(async () => (await gameState<RabbitState>(page)).progress.completed).toBe(0);
    expect((await gameState<RabbitState>(page)).roundOver).toBe(false);
    await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", "0");

    // The new Round plays like the first.
    await completeChallenge(page);
    await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", "1");
  });

  test("back on the Round Celebration screen returns to the Subject Menu", async ({ page }) => {
    await openGame(page);
    await playRound(page);
    await press(backToMenu(page));
    await expect(page).toHaveURL(/\/subjects\/hebrew$/);
    await expect(page.getByRole("heading", { name: "עברית" })).toBeVisible();
  });

  test("the Round Celebration screen works with arrow keys and Enter", async ({ page }) => {
    test.skip(isTouch(), "keys are checked on desktop");
    await openGame(page);
    await playRound(page);

    // "Another Round" is focused first: Enter picks it.
    await expect(anotherRound(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(roundCelebration(page)).toBeHidden();
    await expect.poll(async () => (await gameState<RabbitState>(page)).progress.completed).toBe(0);

    await playRound(page);
    // Right to left: ArrowLeft moves on to "back".
    await page.keyboard.press("ArrowLeft");
    await expect(backToMenu(page)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(anotherRound(page)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/subjects\/hebrew$/);
  });
});
