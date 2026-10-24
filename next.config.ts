import type { NextConfig } from "next";

// ADR-0001: no server features. `output: "export"` makes `next build` fail
// if anything needs a server (API routes, server actions, request-time
// rendering), so the app stays hostable as static files.
const nextConfig: NextConfig = {
  output: "export",
  // Playwright runs its own dev server with a separate build folder, so it
  // never collides with a dev server the developer already has running.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Let phones and tablets on the same Wi-Fi load dev assets (HMR, chunks).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  // The floating dev-tools badge would sit on top of the Menus and Games.
  devIndicators: false,
};

export default nextConfig;
