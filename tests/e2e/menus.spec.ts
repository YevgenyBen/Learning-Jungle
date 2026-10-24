import { expect, test, type Page } from "@playwright/test";
import { press } from "./helpers";

const entry = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const back = (page: Page) => page.getByRole("button", { name: /חזרה/ });

test.describe("Menus by touch or mouse", () => {
  test("Home shows the Hebrew and Math Subject icons", async ({ page }) => {
    await page.goto("/home");
    await expect(entry(page, "עברית")).toBeVisible();
    await expect(entry(page, "חשבון")).toBeVisible();
  });

  for (const subject of [
    { name: "עברית", games: ["ארנב קופץ", "האות הראשונה"], available: ["ארנב קופץ"] },
    { name: "חשבון", games: ["ספירה", "חיבור"], available: [] as string[] },
  ]) {
    test(`${subject.name} opens its Subject Menu, and back returns Home`, async ({ page }) => {
      await page.goto("/home");
      await press(entry(page, subject.name));

      await expect(page.getByRole("heading", { name: subject.name })).toBeVisible();
      for (const game of subject.games) {
        await expect(entry(page, game)).toBeVisible();
        if (subject.available.includes(game)) {
          await expect(entry(page, game)).not.toHaveAttribute("aria-disabled", "true");
        } else {
          await expect(entry(page, game)).toHaveAttribute("aria-disabled", "true");
        }
      }

      await press(back(page));
      await expect(entry(page, "עברית")).toBeVisible();
      await expect(entry(page, "חשבון")).toBeVisible();
    });
  }

  test("an unavailable Game does nothing when chosen", async ({ page }) => {
    await page.goto("/home");
    await press(entry(page, "עברית"));
    await expect(page.getByRole("heading", { name: "עברית" })).toBeVisible();
    const menuUrl = page.url();

    await press(entry(page, "האות הראשונה"), { force: true });
    await page.waitForTimeout(500);
    expect(page.url()).toBe(menuUrl);
    await expect(page.getByRole("heading", { name: "עברית" })).toBeVisible();
  });

  for (const path of ["/home", "/subjects/hebrew"]) {
    test(`every control on ${path} is big enough for a small finger`, async ({ page }) => {
      await page.goto(path);
      const buttons = await page.getByRole("button").all();
      expect(buttons.length).toBeGreaterThan(1);
      for (const button of buttons) {
        const box = await button.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(60);
        expect(box!.height).toBeGreaterThanOrEqual(60);
      }
    });
  }
});

test.describe("Menus by keyboard", () => {
  test("arrow keys and Enter reach every Subject, its Games and back", async ({ page }) => {
    await page.goto("/home");
    // The first Subject has focus straight away.
    await expect(entry(page, "עברית")).toBeFocused();

    // Right-to-left: ArrowLeft moves to the next Subject.
    await page.keyboard.press("ArrowLeft");
    await expect(entry(page, "חשבון")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "חשבון" })).toBeVisible();

    // The first Game has focus; an unavailable Game does nothing.
    await expect(entry(page, "ספירה")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(entry(page, "חיבור")).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await expect(page.getByRole("heading", { name: "חשבון" })).toBeVisible();

    // ArrowUp reaches the back control, Enter returns Home.
    await page.keyboard.press("ArrowUp");
    await expect(back(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(entry(page, "עברית")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "עברית" })).toBeVisible();
    await expect(entry(page, "ארנב קופץ")).toBeFocused();
  });

  test("ArrowDown on Home reaches the Parent control, ArrowUp leaves it, and Enter opens the credits", async ({
    page,
  }) => {
    const parentControl = page.getByRole("link", { name: "להורים" });
    await page.goto("/home");
    await expect(entry(page, "עברית")).toBeFocused();
    await page.keyboard.press("ArrowLeft");

    await page.keyboard.press("ArrowDown");
    await expect(parentControl).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(entry(page, "עברית")).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/credits$/);
    await expect(page.getByRole("heading", { name: "קרדיטים" })).toBeVisible();
  });

  test("an arrow key brings focus back to the Menu after a click elsewhere", async ({ page }) => {
    await page.goto("/home");
    await expect(entry(page, "עברית")).toBeFocused();
    await page.mouse.click(5, 5);
    await expect(entry(page, "עברית")).not.toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(entry(page, "עברית")).toBeFocused();
  });
});
