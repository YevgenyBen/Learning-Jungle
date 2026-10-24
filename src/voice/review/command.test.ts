import { describe, expect, it } from "vitest";
import { parseItemIds } from "../../../scripts/voice-clips/config";
import { regenerationCommand } from "./command";

describe("regenerationCommand", () => {
  it("is the generation script's command with the flagged identities on one line", () => {
    expect(regenerationCommand(["word-apple", "sound-ba", "number-21"])).toBe(
      "npm run voice-clips -- word-apple sound-ba number-21",
    );
  });

  it("gives the script exactly the flagged identities", () => {
    const ids = ["letter-final-mem", "word-apple", "sound-ba"];
    const [, args] = regenerationCommand(ids).split(" -- ");
    expect(parseItemIds([args])).toEqual(ids);
  });
});
