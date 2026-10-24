import { defineConfig, devices } from "@playwright/test";

// Seam 3: the running app. Tests drive it through keys and taps only.
// Port 3100 and a separate build folder keep the test server apart from a
// dev server the developer may already have running on 3000.
const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
    },
    {
      // Android phone: Chromium with touch emulation at phone size.
      name: "mobile-chromium",
      use: { ...devices["Pixel 7 landscape"] },
    },
    {
      // Approximation of iPhone and iPad Safari.
      name: "mobile-webkit",
      use: { ...devices["iPhone 15 landscape"] },
    },
  ],
  webServer: {
    command: `npx next dev -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    env: { NEXT_DIST_DIR: ".next-e2e" },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
