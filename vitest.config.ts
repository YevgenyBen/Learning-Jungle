import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests (Seam 1: Game Models, Seam 2: Content Bank, plus small pure
// modules) live next to the code they test as `*.test.ts`.
// Playwright tests (Seam 3: the running app) live in tests/e2e.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
