import { expect, test, type Page } from "@playwright/test";
import { gameRequests, gameState, waitForGame, type HedgehogState } from "./game";
import { isTouch, press } from "./helpers";

// The counting Game: tap fruits onto the hedgehog's spines, counting them,
// then pick how many there are.

const menuEntry = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const uncounted = (page: Page) => page.locator('[data-testid="fruit"][data-counted="false"]');
const choice = (page: Page, value: number) => page.locator(`[data-testid="choice"][data-value="${value}"]`);
const roundProgress = (page: Page) => page.getByRole("progressbar", { name: "סיבוב" });
const roundCelebration = (page: Page) => page.getByRole("dialog", { name: "כל הכבוד!" });

async function openGame(page: Page) {
  await page.goto("/games/counting");
  await waitForGame(page, "counting");
}

async function phase(page: Page, wanted: HedgehogState["phase"]): Promise<HedgehogState> {
  await expect.poll(async () => (await gameState<HedgehogState>(page)).phase, { timeout: 10_000 }).toBe(wanted);
  return gameState<HedgehogState>(page);
}

async function countAll(page: Page): Promise<HedgehogState> {
  const state = await phase(page, "counting");
  for (let i = 1; i <= state.total; i++) {
    await press(uncounted(page).first());
    if (i < state.total) await expect(page.getByTestId("running-count")).toHaveText(String(i));
  }
  return phase(page, "answering");
}

test.describe("the counting Game", () => {
  test("opens from the Math Subject Menu, and back returns to it", async ({ page }) => {
    await page.goto("/subjects/math");
    await press(menuEntry(page, "ספירה"));
    await expect(page).toHaveURL(/\/games\/counting$/);
    await waitForGame(page, "counting");
    await expect(page.getByTestId("scene")).toBeVisible();

    await press(page.getByRole("button", { name: /חזרה/ }));
    await expect(page.getByRole("heading", { name: "חשבון" })).toBeVisible();
  });

  test("opens straight from its address without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await openGame(page);
    await expect(uncounted(page).first()).toBeVisible();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test("each tapped fruit rolls onto the hedgehog and is counted aloud, then the total is picked", async ({ page }) => {
    await openGame(page);
    const before = await phase(page, "counting");
    await expect(uncounted(page)).toHaveCount(before.total);

    const state = await countAll(page);
    await expect(uncounted(page)).toHaveCount(0);
    const said = (await gameRequests(page)).flatMap((r) => (r.kind === "say" ? [r.item.id] : []));
    expect(said).toEqual(Array.from({ length: state.total }, (_, i) => `number-${i + 1}`));

    const wrong = state.choices.find((c) => c.value !== state.total)!.value;
    await press(choice(page, wrong));
    await expect(choice(page, wrong)).toHaveAttribute("data-look", "rejected");
    expect((await gameState<HedgehogState>(page)).progress.completed).toBe(0);

    await press(choice(page, state.total));
    await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", "1");
    await expect(page.getByTestId("celebration-sign")).toContainText(String(state.total));
  });

  test("a tap on the meadow, away from the fruits, counts nothing", async ({ page }) => {
    await openGame(page);
    await phase(page, "counting");
    await press(page.getByTestId("scene"), { position: { x: 5, y: 5 } });
    await page.waitForTimeout(200);
    expect((await gameState<HedgehogState>(page)).count).toBe(0);
  });

  test("Space counts fruits and picks the total with the arrow keys", async ({ page }) => {
    test.skip(isTouch(), "keys are checked on desktop");
    await openGame(page);
    const start = await phase(page, "counting");
    for (let i = 0; i < start.total; i++) await page.keyboard.press("Space");
    const state = await phase(page, "answering");
    const right = state.choices.findIndex((c) => c.value === state.total);
    await page.keyboard.press("ArrowLeft");
    for (let i = 0; i < right; i++) await page.keyboard.press("ArrowLeft");
    await expect(choice(page, state.total)).toHaveAttribute("data-focused", "true");
    await page.keyboard.press("Space");
    await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", "1");
  });

  test("a Round of five can be played to its end with taps or clicks", async ({ page }) => {
    await openGame(page);
    for (const completed of [1, 2, 3, 4, 5]) {
      const state = await countAll(page);
      await press(choice(page, state.total));
      await expect(roundProgress(page)).toHaveAttribute("aria-valuenow", String(completed));
    }
    await expect(roundCelebration(page)).toBeVisible();
  });
});
