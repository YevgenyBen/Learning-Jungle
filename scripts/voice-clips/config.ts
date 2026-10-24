import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import type { ItemId } from "../../src/content";

export interface AzureConfig {
  readonly key: string;
  readonly region: string;
  readonly minIntervalMs?: number;
}

const PLACEHOLDERS = new Set(["your-speech-key", "your-region"]);

/**
 * Reads the Azure Speech key and region from the git-ignored env file
 * (`.env.azure.local`); variables already in the environment win.
 */
export function readAzureConfig(options: {
  readonly file: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}): AzureConfig {
  const fromFile = existsSync(options.file) ? parseEnv(readFileSync(options.file, "utf8")) : {};
  const value = (name: string) => {
    const found = (options.env[name] ?? fromFile[name])?.trim();
    return found && !PLACEHOLDERS.has(found) ? found : undefined;
  };
  const key = value("AZURE_SPEECH_KEY");
  const region = value("AZURE_SPEECH_REGION");
  if (!key || !region) {
    throw new Error(
      `No Azure Speech key: AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must both be set.\n` +
        `Copy .env.azure.example to .env.azure.local (git ignores it) and fill in your Speech resource's key and region.\n` +
        `Looked in ${options.file}.`,
    );
  }
  const intervalText = value("AZURE_SPEECH_MIN_INTERVAL_MS");
  const interval = intervalText === undefined ? NaN : Number(intervalText);
  return { key, region, ...(interval >= 0 ? { minIntervalMs: interval } : {}) };
}

/**
 * The identities to regenerate, as the Voice Clip review page copies them:
 * separated by spaces, and also accepted with commas or new lines.
 */
export function parseItemIds(args: readonly string[]): ItemId[] {
  return args.flatMap((arg) => arg.split(/[\s,]+/)).filter((id) => id !== "");
}
