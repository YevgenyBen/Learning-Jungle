import { expect, test, type Page } from "@playwright/test";
import {
  completeChallenge,
  gameRequests,
  gameState,
  rabbitPeak,
  solveStep,
  trackRabbitHeight,
  waitForGame,
  type RabbitState,
} from "./game";
import { isTouch, press } from "./helpers";

const choice = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const back = (page: Page) => page.getByRole("button", { name: /חזרה/ });
const wordBar = (page: Page) => page.getByTestId("word-bar");
const slots = (page: Page) => wordBar(page).getByRole("listitem");

async function openFromMenu(page: Page) {
  await page.goto("/subjects/hebrew");
  await press(choice(page, "ארנב קופץ"));
  await expect(page).toHaveURL(/\/games\/rabbit$/);
  await waitForGame(page, "rabbit");
}

test.describe("the rabbit Game", () => {
  test("opens from the Hebrew Subject Menu, and back returns to it", async ({ page }) => {
    await openFromMenu(page);
    await expect(page.getByRole("main", { name: "ארנב קופץ" })).toBeVisible();
    await expect(page.getByTestId("meadow")).toBeVisible();

    await press(back(page));
    await expect(page.getByRole("heading", { name: "עברית" })).toBeVisible();
    await expect(choice(page, "ארנב קופץ")).toBeVisible();
  });

  test("opens straight from its address without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/games/rabbit");
    await waitForGame(page, "rabbit");
    await expect(page.getByTestId("word-bar")).toBeVisible();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test("the word bar shows the Word's Picture and a slot per letter, the first one next", async ({ page }) => {
    await openFromMenu(page);
    const { challenge } = await gameState<RabbitState>(page);

    await expect(wordBar(page).getByRole("img", { name: challenge.word.plain })).toBeVisible();
    await expect(slots(page)).toHaveCount(challenge.letters.length);
    await expect(slots(page).first()).toHaveAttribute("data-slot", "next");
    await expect(slots(page).first()).toHaveText(challenge.letters[0].letter);
    await expect(wordBar(page).locator('[data-slot="filled"]')).toHaveCount(0);
  });

  for (const key of ["Space", "ArrowUp", "KeyW"]) {
    test(`the rabbit jumps on ${key}`, async ({ page }) => {
      test.skip(isTouch(), "keyboard jumps are checked on desktop");
      await openFromMenu(page);
      await trackRabbitHeight(page);
      await page.keyboard.down(key);
      await expect.poll(() => rabbitPeak(page)).toBeGreaterThan(30);
      await page.keyboard.up(key);
    });
  }

  test("the rabbit jumps on a tap or click on the meadow", async ({ page }) => {
    await openFromMenu(page);
    await trackRabbitHeight(page);
    await press(page.getByTestId("meadow"));
    await expect.poll(() => rabbitPeak(page)).toBeGreaterThan(30);
  });

  test("a longer press jumps higher", async ({ page }) => {
    test.skip(isTouch(), "press length is checked with the keyboard on desktop");
    await openFromMenu(page);

    const jump = async (holdMs: number) => {
      await expect.poll(async () => (await gameState<RabbitState>(page)).rabbit.onGround).toBe(true);
      await trackRabbitHeight(page);
      await page.keyboard.down("Space");
      await page.waitForTimeout(holdMs);
      await page.keyboard.up("Space");
      await page.waitForTimeout(900);
      return rabbitPeak(page);
    };
    const short = await jump(40);
    const long = await jump(450);
    expect(long).toBeGreaterThan(100);
    expect(short).toBeLessThan(long - 20);
  });

  test("collecting the right letter fills its slot", async ({ page }) => {
    await openFromMenu(page);
    const { challenge } = await gameState<RabbitState>(page);

    await solveStep(page);
    await expect(slots(page).first()).toHaveAttribute("data-slot", "filled");
    await expect(slots(page).first()).toHaveText(challenge.letters[0].marked);
    await expect(wordBar(page).locator('[data-slot="filled"]')).toHaveCount(1);
  });

  test("completing a Word through the test hook starts the next Word after its Celebration", async ({ page }) => {
    await openFromMenu(page);
    const before = await gameState<RabbitState>(page);

    await completeChallenge(page);
    const celebrating = await gameState<RabbitState>(page);
    expect(celebrating.progress.completed).toBe(1);
    expect(celebrating.celebration).toBe("challenge");
    await expect(wordBar(page).locator('[data-slot="filled"]')).toHaveCount(before.challenge.letters.length);

    await expect.poll(async () => (await gameState<RabbitState>(page)).celebration).toBeNull();
    const after = await gameState<RabbitState>(page);
    expect(after.challenge.word.id).not.toBe(before.challenge.word.id);
    await expect(wordBar(page)).toHaveAttribute("data-word", after.challenge.word.id);
    await expect(wordBar(page).locator('[data-slot="filled"]')).toHaveCount(0);

    const said = (await gameRequests(page)).flatMap((r) => (r.kind === "say" ? [r.item.id] : []));
    expect(said.at(-1)).toBe(before.challenge.word.id);
  });
});
