import { expect, test, type Page } from "@playwright/test";
import { gameRequests, gameState, waitForGame, type CatState } from "./game";
import { isTouch, press } from "./helpers";

// The first-letter Game: the cat jumps onto the perch whose letter starts
// the pictured Word. Played with taps, clicks and keys on the letter signs.

const menuEntry = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const pictureCard = (page: Page) => page.getByTestId("picture-card");
const choices = (page: Page) => page.getByTestId("choice");
const choice = (page: Page, letter: string) => page.locator(`[data-testid="choice"][data-letter="${letter}"]`);
const roundProgress = (page: Page) => page.getByRole("progressbar", { name: "סיבוב" });
const roundCelebration = (page: Page) => page.getByRole("dialog", { name: "כל הכבוד!" });

async function openGame(page: Page) {
  await page.goto("/games/first-letter");
  await waitForGame(page, "first-letter");
}

/** Waits until the Player can choose, and returns the state then. */
async function choosing(page: Page): Promise<CatState> {
  await expect.poll(async () => (await gameState<CatState>(page)).phase, { timeout: 10_000 }).toBe("choosing");
  return gameState<CatState>(page);
}

const letters = (state: CatState) =>
  state.choices.map((id) => state.perches.find((p) => p.id === id)!.sign!.letter);
const wrongLetter = (state: CatState) => letters(state).find((l) => l !== state.challenge.letter)!;

test.describe("the first-letter Game", () => {
  test("opens from the Hebrew Subject Menu, and back returns to it", async ({ page }) => {
    await page.goto("/subjects/hebrew");
    await press(menuEntry(page, "האות הראשונה"));
    await expect(page).toHaveURL(/\/games\/first-letter$/);
    await waitForGame(page, "first-letter");
    await expect(page.getByRole("main", { name: "האות הראשונה" })).toBeVisible();
    await expect(page.getByTestId("scene")).toBeVisible();

    await press(page.getByRole("button", { name: /חזרה/ }));
    await expect(page.getByRole("heading", { name: "עברית" })).toBeVisible();
  });

  test("opens straight from its address without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await openGame(page);
    await expect(pictureCard(page)).toBeVisible();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test("shows the Word's Picture, never its spelling, and letter signs with its first letter among them", async ({ page }) => {
    await openGame(page);
    const state = await choosing(page);
    const { word } = state.challenge;

    await expect(pictureCard(page).getByRole("img", { name: word.plain })).toHaveAttribute("src", `/pictures/${word.id}.svg`);
    await expect(pictureCard(page)).not.toContainText(word.plain);
    await expect(choices(page)).toHaveCount(state.choices.length);
    await expect(choice(page, state.challenge.letter)).toBeVisible();
    for (const letter of letters(state)) await expect(choice(page, letter)).toHaveText(letter);
  });

  test("tapping the right sign: the cat jumps onto it, the Word is celebrated and the next one comes", async ({ page }) => {
    await openGame(page);
    const before = await choosing(page);

    await press(choice(page, before.challenge.letter));
    await expect(choice(page, before.challenge.letter)).toHaveAttribute("data-look", "right");
    await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", "1");
    await expect(page.getByTestId("celebration-sign")).toContainText(before.challenge.word.voweled);
    const said = (await gameRequests(page)).flatMap((r) => (r.kind === "say" ? [r.item.id] : []));
    expect(said.slice(-2)).toEqual([expect.stringMatching(/^letter-/), before.challenge.word.id]);

    const after = await choosing(page);
    expect(after.challenge.word.id).not.toBe(before.challenge.word.id);
    await expect(pictureCard(page)).toHaveAttribute("data-word", after.challenge.word.id);
  });

  test("tapping a wrong sign greys it and costs nothing", async ({ page }) => {
    await openGame(page);
    const state = await choosing(page);
    const wrong = wrongLetter(state);

    await press(choice(page, wrong));
    await expect(choice(page, wrong)).toHaveAttribute("data-look", "rejected");
    await expect(choice(page, wrong)).toHaveAttribute("aria-disabled", "true");
    const now = await gameState<CatState>(page);
    expect(now.phase).toBe("choosing");
    expect(now.progress.completed).toBe(0);

    await press(choice(page, state.challenge.letter));
    await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", "1");
  });

  test("arrow keys highlight a sign and Space jumps to it", async ({ page }) => {
    test.skip(isTouch(), "keys are checked on desktop");
    await openGame(page);
    const state = await choosing(page);
    const right = letters(state).indexOf(state.challenge.letter);

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator('[data-testid="choice"][data-focused="true"]')).toHaveCount(1);
    for (let i = 0; i < right; i++) await page.keyboard.press("ArrowLeft");
    await expect(choice(page, state.challenge.letter)).toHaveAttribute("data-focused", "true");

    await page.keyboard.press("Space");
    await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", "1");
  });

  test("a Round of five Words can be played to its end with taps or clicks", async ({ page }) => {
    await openGame(page);
    for (const completed of [1, 2, 3, 4, 5]) {
      const state = await choosing(page);
      await press(choice(page, state.challenge.letter));
      await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", String(completed));
    }
    await expect(roundCelebration(page)).toBeVisible();
    expect((await gameState<CatState>(page)).roundOver).toBe(true);
  });
});
