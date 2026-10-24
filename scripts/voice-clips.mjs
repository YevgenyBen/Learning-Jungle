// Runs the Voice Clip generation script (scripts/voice-clips/cli.ts) with
// Node's own TypeScript support. The Content Bank imports its modules without
// file extensions, as the app's bundler allows; this hook lets Node find them.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith(".")) throw error;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try {
          return nextResolve(candidate, context);
        } catch {
          // try the next candidate
        }
      }
      throw error;
    }
  },
});

await import("./voice-clips/cli.ts");
