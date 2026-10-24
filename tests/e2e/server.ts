// The test server's settings, shared by playwright.config.ts and the warm-up.

/** Set E2E_PORT to run beside another checkout's test server. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);

/** The test server's own build folder, apart from a developer's `.next`. */
export const E2E_DIST_DIR = ".next-e2e";
