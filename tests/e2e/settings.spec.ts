import { expect, test, type Page } from "@playwright/test";
import { completeChallenge, gameState, waitForGame, type RabbitState } from "./game";
import { press } from "./helpers";

// The Game Frame's Niqqud and Difficulty controls, and the preferences it
// remembers on the device, exercised through the rabbit Game. Key tests run
// on every project: tablets and phones can have keyboards.

const niqqudControl = (page: Page) => page.getByRole("button", { name: "ניקוד", exact: true });
const difficultyControl = (page: Page) => page.getByRole("button", { name: /^מהירות/ });
const muteControl = (page: Page) => page.getByRole("button", { name: "השתקה", exact: true });
const restartControl = (page: Page) => page.getByRole("button", { name: "מהתחלה", exact: true });
const roundCelebration = (page: Page) => page.getByRole("dialog", { name: "כל הכבוד!" });
const anotherRound = (page: Page) => roundCelebration(page).getByRole("button", { name: "עוד סיבוב" });
const sign = (page: Page) => page.getByTestId("celebration-sign");

const state = (page: Page) => gameState<RabbitState>(page);
const speed = async (page: Page) => (await state(page)).speed;

async function openGame(page: Page) {
  await page.goto("/games/rabbit");
  await waitForGame(page, "rabbit");
}

async function expectDifficulty(page: Page, name: string) {
  await expect(difficultyControl(page)).toHaveAccessibleName(`מהירות: ${name}`);
}

/** Every spelling in the current Challenge comes from the Plain Spelling (true) or the Voweled one. */
async function expectChallengeSpelling(page: Page, plain: boolean) {
  await expect
    .poll(async () => {
      const { challenge } = await state(page);
      return challenge.text === (plain ? challenge.word.plain : challenge.word.voweled);
    })
    .toBe(true);
}

test.describe("the Difficulty control", () => {
  test("offers automatic, slow, medium and fast, starting at automatic, and a change applies at once", async ({
    page,
  }) => {
    await openGame(page);
    await expectDifficulty(page, "אוטומטי");
    expect(await speed(page)).toBe(170);

    for (const [name, px] of [
      ["איטי", 170],
      ["בינוני", 280],
      ["מהיר", 400],
    ] as const) {
      await press(difficultyControl(page));
      await expectDifficulty(page, name);
      await expect.poll(() => speed(page)).toBe(px);
    }
    await press(difficultyControl(page));
    await expectDifficulty(page, "אוטומטי");
    // Automatic eases back down to slow, since no Word has been completed yet.
    await expect.poll(() => speed(page), { timeout: 15_000 }).toBe(170);
  });

  test("D moves on to the next Difficulty", async ({ page }) => {
    await openGame(page);
    await page.keyboard.press("KeyD");
    await expectDifficulty(page, "איטי");
    await page.keyboard.press("KeyD");
    await expectDifficulty(page, "בינוני");
    await expect.poll(() => speed(page)).toBe(280);
  });

  test("automatic speed is announced on the sign, carries into another Round and resets on restart", async ({
    page,
  }) => {
    await openGame(page);
    await completeChallenge(page);
    await expect(sign(page)).toBeVisible();
    await expect(sign(page)).not.toContainText("מהירות עולה!");

    await completeChallenge(page);
    await expect(sign(page)).toContainText("מהירות עולה!");

    await completeChallenge(page);
    await expect(roundCelebration(page)).toBeVisible();
    expect(await speed(page)).toBe(200);

    await press(anotherRound(page));
    await expect(roundCelebration(page)).toBeHidden();
    await expect.poll(async () => (await state(page)).progress.completed).toBe(0);
    expect(await speed(page)).toBe(200);

    await press(restartControl(page));
    await expect.poll(() => speed(page)).toBe(170);
  });
});

test.describe("the Niqqud control", () => {
  test("is on by default and switches the spelling from the next Challenge, by tap and by N", async ({ page }) => {
    await openGame(page);
    await expect(niqqudControl(page)).toHaveAttribute("aria-pressed", "true");
    await expectChallengeSpelling(page, false);

    await press(niqqudControl(page));
    await expect(niqqudControl(page)).toHaveAttribute("aria-pressed", "false");
    // The Word being built keeps its spelling.
    await expectChallengeSpelling(page, false);
    await completeChallenge(page);
    await page.evaluate(() => window.__learningJungleGame!.advance(2));
    await expectChallengeSpelling(page, true);

    await page.keyboard.press("KeyN");
    await expect(niqqudControl(page)).toHaveAttribute("aria-pressed", "true");
    await completeChallenge(page);
    await page.evaluate(() => window.__learningJungleGame!.advance(2));
    await expectChallengeSpelling(page, false);
  });
});

test.describe("preferences on the device", () => {
  test("mute, Niqqud and Difficulty survive a reload", async ({ page }) => {
    await openGame(page);
    await press(muteControl(page));
    await press(niqqudControl(page));
    await page.keyboard.press("KeyD");
    await page.keyboard.press("KeyD");
    await page.keyboard.press("KeyD");
    await expectDifficulty(page, "מהיר");

    await page.reload();
    await waitForGame(page, "rabbit");

    await expect(muteControl(page)).toHaveAttribute("aria-pressed", "true");
    await expect(niqqudControl(page)).toHaveAttribute("aria-pressed", "false");
    await expectDifficulty(page, "מהיר");
    expect(await page.evaluate(() => window.__learningJungleGame!.muted())).toBe(true);
    expect(await speed(page)).toBe(400);
    await expectChallengeSpelling(page, true);
  });

  test("nothing but the preferences is stored, even after playing", async ({ page }) => {
    await openGame(page);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);

    await press(muteControl(page));
    await press(niqqudControl(page));
    await completeChallenge(page);
    await completeChallenge(page);

    const stored = await page.evaluate(() => ({
      local: Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])),
      session: sessionStorage.length,
      cookie: document.cookie,
    }));
    expect(stored.session).toBe(0);
    expect(stored.cookie).toBe("");
    const values = Object.values(stored.local).join(" ");
    const { challenge } = await state(page);
    expect(values).not.toContain("word-");
    expect(values).not.toContain(challenge.word.id);
    expect(Object.keys(stored.local)).toHaveLength(2);
  });

  test("corrupt preferences fall back to the defaults", async ({ page }) => {
    await openGame(page);
    await press(muteControl(page));
    await press(niqqudControl(page));
    await press(difficultyControl(page));
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) localStorage.setItem(key, "{not json");
    });

    await page.reload();
    await waitForGame(page, "rabbit");

    await expect(muteControl(page)).toHaveAttribute("aria-pressed", "false");
    await expect(niqqudControl(page)).toHaveAttribute("aria-pressed", "true");
    await expectDifficulty(page, "אוטומטי");
  });

  test("preferences of the wrong kind fall back to the defaults", async ({ page }) => {
    await openGame(page);
    await press(muteControl(page));
    await press(niqqudControl(page));
    await press(difficultyControl(page));
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        localStorage.setItem(key, JSON.stringify({ niqqud: "no", difficulty: "turbo", muted: 7 }));
      }
    });

    await page.reload();
    await waitForGame(page, "rabbit");

    await expect(muteControl(page)).toHaveAttribute("aria-pressed", "false");
    await expect(niqqudControl(page)).toHaveAttribute("aria-pressed", "true");
    await expectDifficulty(page, "אוטומטי");
  });

  test("the Game works with its defaults where storage is blocked", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("storage is blocked", "SecurityError");
        },
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await openGame(page);
    await expect(niqqudControl(page)).toHaveAttribute("aria-pressed", "true");
    await expectDifficulty(page, "אוטומטי");
    await expect(muteControl(page)).toHaveAttribute("aria-pressed", "false");

    await press(niqqudControl(page));
    await press(difficultyControl(page));
    await press(muteControl(page));
    await expect(niqqudControl(page)).toHaveAttribute("aria-pressed", "false");
    await expectDifficulty(page, "איטי");
    await expect(muteControl(page)).toHaveAttribute("aria-pressed", "true");
    await completeChallenge(page);
    expect(errors).toEqual([]);
  });

  test("the Game works with its defaults where writing to storage fails", async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("full", "QuotaExceededError");
      };
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await openGame(page);
    await press(niqqudControl(page));
    await press(muteControl(page));
    await expect(niqqudControl(page)).toHaveAttribute("aria-pressed", "false");
    await expect(muteControl(page)).toHaveAttribute("aria-pressed", "true");
    await completeChallenge(page);
    expect(errors).toEqual([]);
  });
});
