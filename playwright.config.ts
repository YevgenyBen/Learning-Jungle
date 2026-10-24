import { defineConfig, devices } from "@playwright/test";
import { E2E_DIST_DIR, E2E_PORT as PORT } from "./tests/e2e/server";

// Seam 3: the running app. Tests drive it through keys and taps only.
// Port 3100 and a separate build folder keep the test server apart from a
// dev server the developer may already have running on 3000. Set E2E_PORT
// to run beside another checkout's test server.

export default defineConfig({
  testDir: "./tests/e2e",
  // Opens every route once before the tests, so they never race the dev
  // server's first compile (see tests/e2e/warm-up.ts).
  globalSetup: "./tests/e2e/warm-up.ts",
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
    env: { NEXT_DIST_DIR: E2E_DIST_DIR },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
