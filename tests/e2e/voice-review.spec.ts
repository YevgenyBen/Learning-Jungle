import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { contentBank } from "../../src/content/bank";

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
});
