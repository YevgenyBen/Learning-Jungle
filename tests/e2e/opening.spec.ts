import { expect, test, type Page } from "@playwright/test";
import { press } from "./helpers";

const homeMenu = (page: Page) => page.getByRole("button", { name: "עברית", exact: true });

/** Waits until the opening screen listens for taps and keys (it has hydrated). */
async function openingReady(page: Page) {
  await expect(page.getByTestId("logo")).toBeVisible();
  await expect(page.getByTestId("opening")).toHaveAttribute("data-ready", "true");
}

test.describe("opening screen", () => {
  test("shows the logo in a right-to-left Hebrew page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("logo")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("moves on to the Home Menu by itself after about two seconds", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("logo")).toBeVisible();
    const shownAt = Date.now();
    await expect(homeMenu(page)).toBeVisible({ timeout: 6_000 });
    // Not instantly: the logo stays up for roughly two seconds.
    expect(Date.now() - shownAt).toBeGreaterThan(1_200);
  });

  test("moves on earlier on a tap or click", async ({ page }) => {
    await page.goto("/");
    await openingReady(page);
    await press(page.getByTestId("opening"));
    await expect(homeMenu(page)).toBeVisible({ timeout: 1_500 });
  });

  test("moves on earlier on any key", async ({ page }) => {
    await page.goto("/");
    await openingReady(page);
    await page.keyboard.press("x");
    await expect(homeMenu(page)).toBeVisible({ timeout: 1_500 });
  });

  test("the key that skips it does not also choose a Subject", async ({ page }) => {
    await page.goto("/");
    await openingReady(page);
    await page.keyboard.press("Space");
    await expect(homeMenu(page)).toBeVisible({ timeout: 1_500 });
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/home\/?$/);
  });

  test("the tap that skips it does not also choose a Subject", async ({ page }) => {
    // Find where the Hebrew Subject icon sits on the Home Menu...
    await page.goto("/home");
    const icon = (await homeMenu(page).boundingBox())!;
    const spot = { x: icon.x + icon.width / 2, y: icon.y + icon.height / 2 };

    // ...and skip the opening screen with a tap on exactly that spot.
    await page.goto("/");
    await openingReady(page);
    await press(page.getByTestId("opening"), { position: spot });
    await expect(homeMenu(page)).toBeVisible({ timeout: 1_500 });
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/home\/?$/);
  });
});
