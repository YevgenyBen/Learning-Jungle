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

test.describe("a Round of the rabbit Game", () => {
  test("shows its progress, celebrates each Word, and another Round starts a new Round", async ({ page }) => {
    await openGame(page);
    await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", "0");
    await expect(roundProgress(page)).toHaveAttribute("aria-valuemax", "3");

    const { challenge } = await gameState<RabbitState>(page);
    await completeChallenge(page);
    await expect(page.getByTestId("celebration-sign")).toContainText(challenge.text);
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
