import { expect, test, type Page } from "@playwright/test";
import { waitForGame } from "./game";
import { press } from "./helpers";

// The company logo after the Opening Screen: on the Home Menu, on Subject
// Menus, and on the pause screen, but never while a Game is being played.

/** The visible logo outside the Opening Screen, whichever size it shows at. */
const shownLogo = (page: Page) => page.locator('[data-testid^="logo-"]:visible');

test("the Home Menu shows the logo without covering a Subject", async ({ page }) => {
  await page.goto("/home");
  await expect(shownLogo(page)).toHaveCount(1);
  const logo = (await shownLogo(page).boundingBox())!;
  for (const name of ["עברית", "חשבון"]) {
    const subject = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
    const overlaps =
      logo.x < subject.x + subject.width &&
      subject.x < logo.x + logo.width &&
      logo.y < subject.y + subject.height &&
      subject.y < logo.y + logo.height;
    expect(overlaps).toBe(false);
  }
});

test("a Subject Menu shows the logo", async ({ page }) => {
  await page.goto("/subjects/math");
  await expect(shownLogo(page)).toHaveCount(1);
});

test("no logo while playing; the pause screen shows it", async ({ page }) => {
  await page.goto("/games/rabbit");
  await waitForGame(page, "rabbit");
  await expect(shownLogo(page)).toHaveCount(0);

  await press(page.getByRole("button", { name: "עצירה", exact: true }));
  await expect(page.getByTestId("logo-pause")).toBeVisible();

  await press(page.getByRole("button", { name: "המשך", exact: true }));
  await expect(shownLogo(page)).toHaveCount(0);
});
