// Runs the Voice Clip check (scripts/voice-clips/check-cli.ts) with Node's
// own TypeScript support.
import "./ts-resolve.mjs";

await import("./voice-clips/check-cli.ts");
