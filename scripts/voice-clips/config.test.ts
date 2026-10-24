import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseItemIds, readAzureConfig } from "./config";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "voice-config-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("the Azure key", () => {
  it("is read with its region from the local env file", () => {
    const file = join(dir, ".env.azure.local");
    writeFileSync(file, "# my Speech resource\nAZURE_SPEECH_KEY=abc123\nAZURE_SPEECH_REGION=westeurope\n");

    expect(readAzureConfig({ file, env: {} })).toEqual({ key: "abc123", region: "westeurope" });
  });

  it("can come from the environment instead", () => {
    const env = { AZURE_SPEECH_KEY: "from-env", AZURE_SPEECH_REGION: "northeurope" };
    expect(readAzureConfig({ file: join(dir, "absent"), env })).toEqual({ key: "from-env", region: "northeurope" });
  });

  it("missing fails with a message that says how to add it", () => {
    expect(() => readAzureConfig({ file: join(dir, ".env.azure.local"), env: {} })).toThrow(
      /AZURE_SPEECH_KEY.*\.env\.azure\.example.*\.env\.azure\.local/s,
    );
  });

  it("left as the example's placeholder counts as missing", () => {
    const file = join(dir, ".env.azure.local");
    writeFileSync(file, readFileSync(join(ROOT, ".env.azure.example"), "utf8"));

    expect(() => readAzureConfig({ file, env: {} })).toThrow(/AZURE_SPEECH_KEY/);
  });

  it("lives in a file git ignores", () => {
    const ignored = execFileSync("git", ["check-ignore", ".env.azure.local"], { cwd: ROOT, encoding: "utf8" });
    expect(ignored.trim()).toBe(".env.azure.local");
  });
});

describe("the identities to regenerate", () => {
  it("are read from the review page's copied list, separated by spaces, commas or new lines", () => {
    expect(parseItemIds(["word-apple sound-ba,number-21\nletter-alef"])).toEqual([
      "word-apple",
      "sound-ba",
      "number-21",
      "letter-alef",
    ]);
    expect(parseItemIds(["word-apple", "sound-ba"])).toEqual(["word-apple", "sound-ba"]);
    expect(parseItemIds([])).toEqual([]);
  });
});
