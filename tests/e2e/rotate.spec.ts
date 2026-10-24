import { expect, test, type Page } from "@playwright/test";
import { isTouch } from "./helpers";

const rotateScreen = (page: Page) => page.getByRole("alert").filter({ hasText: "סובבו" });
const homeMenu = (page: Page) => page.getByRole("button", { name: "עברית", exact: true });

/** Turns the emulated device: swaps the long and short sides of the viewport. */
async function hold(page: Page, orientation: "portrait" | "landscape") {
  const { width, height } = page.viewportSize()!;
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  await page.setViewportSize(
    orientation === "portrait" ? { width: short, height: long } : { width: long, height: short },
  );
}

/** What a finger in the middle of the screen would touch. */
const topmostAtCentre = (page: Page) =>
  page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return el?.closest("[data-testid]")?.getAttribute("data-testid") ?? null;
  });

test.describe("rotate screen on phones and tablets", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isTouch(), "phones and tablets only");
    await page.goto("/home");
  });

  test("held upright, a 'turn the device' screen covers the app", async ({ page }) => {
    await hold(page, "portrait");
    await expect(rotateScreen(page)).toBeVisible();
    expect(await topmostAtCentre(page)).toBe("rotate-screen");
  });

  test("turned sideways, the screen goes away and the Menu is back", async ({ page }) => {
    await hold(page, "portrait");
    await expect(rotateScreen(page)).toBeVisible();
    await hold(page, "landscape");
    await expect(rotateScreen(page)).toBeHidden();
    await expect(homeMenu(page)).toBeVisible();
  });

  test("also covers the opening screen when held upright", async ({ page }) => {
    await hold(page, "portrait");
    await page.goto("/");
    await expect(rotateScreen(page)).toBeVisible();
  });
});

test.describe("rotate screen on a computer", () => {
  test("a tall, narrow browser window does not ask to turn the computer", async ({ page }) => {
    test.skip(isTouch(), "computers only");
    await page.goto("/home");
    await page.setViewportSize({ width: 700, height: 900 });
    await expect(homeMenu(page)).toBeVisible();
    await expect(rotateScreen(page)).toBeHidden();
  });
});
