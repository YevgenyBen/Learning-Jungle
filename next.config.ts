import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// ADR-0001: no server features. `output: "export"` makes `next build` fail
// if anything needs a server (API routes, server actions, request-time
// rendering), so the app stays hostable as static files.
export default function nextConfig(phase: string): NextConfig {
  return {
    output: "export",
    // Playwright runs its own dev server with a separate build folder, so it
    // never collides with a dev server the developer already has running.
    distDir: process.env.NEXT_DIST_DIR ?? ".next",
    // Development-only pages are `page.dev.tsx`: only `next dev` routes them,
    // so a production build has no such route at all (the Voice Clip review
    // page, /dev/voice-clips). `npm run test:build` checks this.
    pageExtensions: phase === PHASE_DEVELOPMENT_SERVER ? ["dev.tsx", "tsx", "ts", "jsx", "js"] : ["tsx", "ts", "jsx", "js"],
    // Let phones and tablets on the same Wi-Fi load dev assets (HMR, chunks).
    allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
    // The floating dev-tools badge would sit on top of the Menus and Games.
    devIndicators: false,
  };
}
