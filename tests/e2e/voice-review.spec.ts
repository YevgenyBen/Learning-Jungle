import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { contentBank } from "../../src/content/bank";
import { press } from "./helpers";

// The Voice Clip review page (development only). Each test serves its own
// Voice Clip manifest, so the result never depends on which clips have
// been generated in public/voice/.

const TEST_CLIP = path.join(__dirname, "../fixtures/voice/test-clip.wav");
const REVIEW = "/dev/voice-clips";

/** Serves a manifest listing these items' clips, and the test clip for `test-clip.wav`. */
async function serveManifest(page: Page, clips: Record<string, string>) {
  const listed = Object.fromEntries(Object.entries(clips).map(([id, file]) => [id, { file }]));
  await page.route("**/voice/manifest.json", (route) => route.fulfill({ json: { clips: listed } }));
  await page.route("**/voice/test-clip.wav", (route) => route.fulfill({ path: TEST_CLIP, contentType: "audio/wav" }));
}

/** Opens the review page and waits until it has read the manifest. */
async function openReview(page: Page) {
  await page.goto(REVIEW);
  await expect(page.getByTestId("voice-clip-review")).toHaveAttribute("data-ready", "true");
}

/** The row of the item with this identity. */
const row = (page: Page, id: string) => page.getByRole("row").filter({ has: page.getByText(id, { exact: true }) });

test.describe("Voice Clip review page", () => {
  test("every spoken item appears once, with its identity and text", async ({ page }) => {
    await serveManifest(page, {});
    await openReview(page);

    const items = contentBank.spokenItems();
    await expect(page.getByRole("row").filter({ has: page.getByRole("checkbox") })).toHaveCount(items.length);
    // A Word, a Letter Name, a Letter Sound's sound and a number.
    for (const id of ["word-apple", "letter-gimel", "sound-ba", "number-21"]) {
      const item = items.find((i) => i.id === id)!;
      await expect(row(page, id)).toContainText(item.voweledText);
    }
  });

  test("a shared sound's row shows every Letter Sound that says it, so every Letter Sound appears with its text", async ({
    page,
  }) => {
    await serveManifest(page, {});
    await openReview(page);

    // כָּ and קָ are read the same: one Voice Clip, both written forms on its row.
    await expect(row(page, "sound-ka")).toContainText("כָּ");
    await expect(row(page, "sound-ka")).toContainText("קָ");

    const texts = new Map(
      await page
        .locator("tbody tr")
        .evaluateAll((rows) =>
          rows.map((r) => [(r as HTMLTableRowElement).cells[0].textContent, (r as HTMLTableRowElement).cells[1].textContent]),
        ),
    );
    const letterSounds = contentBank.letterSounds();
    expect(letterSounds.filter((s) => !texts.get(s.sound.id)?.includes(s.written)).map((s) => s.id)).toEqual([]);
  });

  test("items without a clip are marked missing, with no clip to play", async ({ page }) => {
    await serveManifest(page, { "word-apple": "test-clip.wav" });
    await openReview(page);

    await expect(row(page, "letter-gimel")).toContainText("חסר");
    await expect(row(page, "letter-gimel").getByRole("button", { name: "השמעה" })).toHaveAttribute("aria-disabled", "true");
    await expect(row(page, "word-apple")).not.toContainText("חסר");
    await expect(row(page, "word-apple").getByRole("button", { name: "השמעה" })).not.toHaveAttribute("aria-disabled", "true");
    await expect(page.getByTestId("review-summary")).toContainText(`${contentBank.spokenItems().length - 1} חסרים`);
  });

  test("the play button plays the item's clip file", async ({ page, browserName }) => {
    test.skip(
      browserName === "webkit" && process.platform === "win32",
      "Playwright's WebKit for Windows has no media playback (every clip fails with NotSupportedError)",
    );
    await serveManifest(page, { "word-apple": "test-clip.wav" });
    await openReview(page);

    const fetched = page.waitForRequest("**/voice/test-clip.wav");
    await press(row(page, "word-apple").getByRole("button", { name: "השמעה" }));
    await fetched;
  });

  test("a clip whose file can't be played is marked", async ({ page }) => {
    await serveManifest(page, { "word-apple": "gone.mp3" });
    await page.route("**/voice/gone.mp3", (route) => route.fulfill({ status: 404 }));
    await openReview(page);

    await press(row(page, "word-apple").getByRole("button", { name: "השמעה" }));
    await expect(row(page, "word-apple")).toContainText("לא מתנגן");
  });

  test("flagged identities make up the regeneration command, in list order", async ({ page }) => {
    await serveManifest(page, {});
    await openReview(page);
    const command = page.getByRole("textbox", { name: "פקודה" });
    await expect(page.getByRole("button", { name: "העתקה" })).toHaveAttribute("aria-disabled", "true");

    await press(row(page, "sound-ba").getByRole("checkbox"));
    await press(row(page, "word-apple").getByRole("checkbox"));
    await press(row(page, "number-21").getByRole("checkbox"));
    await expect(command).toHaveValue("npm run voice-clips -- word-apple sound-ba number-21");

    await press(row(page, "word-apple").getByRole("checkbox"));
    await expect(command).toHaveValue("npm run voice-clips -- sound-ba number-21");
    await expect(page.getByTestId("review-summary")).toContainText("2 מסומנים");
  });

  test("copying puts the command on the clipboard", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Only Chromium lets a test read the clipboard");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await serveManifest(page, {});
    await openReview(page);

    await press(row(page, "sound-ba").getByRole("checkbox"));
    await press(page.getByRole("button", { name: "העתקה" }));
    await expect(page.getByRole("status")).toHaveText("הועתק");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("npm run voice-clips -- sound-ba");
  });

  test("without a clipboard, the command is selected to copy by hand", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new DOMException("blocked", "NotAllowedError")) },
        configurable: true,
      });
    });
    await serveManifest(page, {});
    await openReview(page);

    await press(row(page, "sound-ba").getByRole("checkbox"));
    await press(page.getByRole("button", { name: "העתקה" }));
    await expect(page.getByRole("status")).toContainText("להעתיק ידנית");
    const command = page.getByRole("textbox", { name: "פקודה" });
    await expect(command).toBeFocused();
    expect(await command.evaluate((box: HTMLTextAreaElement) => box.value.slice(box.selectionStart, box.selectionEnd))).toBe(
      "npm run voice-clips -- sound-ba",
    );
  });
});
