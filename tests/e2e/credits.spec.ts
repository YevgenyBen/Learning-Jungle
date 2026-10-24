import { expect, test, type Page } from "@playwright/test";
import { isTouch, press } from "./helpers";

const parentControl = (page: Page) => page.getByRole("link", { name: "להורים" });
const back = (page: Page) => page.getByRole("button", { name: /חזרה/ });
const subject = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

test.describe("the Parent control and the credits screen", () => {
  test("the Parent control on Home opens the credits with the Twemoji attribution, and back returns Home", async ({
    page,
  }) => {
    await page.goto("/home");
    await press(parentControl(page));

    await expect(page).toHaveURL(/\/credits$/);
    await expect(page.getByRole("heading", { name: "קרדיטים" })).toBeVisible();
    const attribution = page.getByTestId("twemoji-attribution");
    await expect(attribution).toContainText("Twemoji");
    await expect(attribution).toContainText("CC-BY 4.0");
    await expect(attribution.getByRole("link", { name: "CC-BY 4.0" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by/4.0/",
    );

    await press(back(page));
    await expect(page).toHaveURL(/\/home$/);
    await expect(subject(page, "עברית")).toBeVisible();
  });

  test("the Parent control is smaller than the Subject icons but still big enough to hit", async ({ page }) => {
    await page.goto("/home");
    const control = (await parentControl(page).boundingBox())!;
    const hebrew = (await subject(page, "עברית").boundingBox())!;
    expect(control.width * control.height).toBeLessThan((hebrew.width * hebrew.height) / 4);
    expect(control.width).toBeGreaterThanOrEqual(44);
    expect(control.height).toBeGreaterThanOrEqual(44);
  });

  test("on the credits screen, back has focus and Enter returns Home", async ({ page }) => {
    test.skip(isTouch(), "keyboard use is checked on desktop");
    await page.goto("/credits");
    await expect(back(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(subject(page, "עברית")).toBeFocused();
  });
});
