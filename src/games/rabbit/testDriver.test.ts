import { describe, expect, it } from "vitest";
import { contentBank } from "@/content";
import { seededRandom } from "../random";
import { createRabbitModel } from "./model";
import { rabbitTestDriver } from "./testDriver";

// The test driver plays the rabbit Game the way a Player would (only
// actions and time), so Playwright can complete Challenges on demand.

const create = (seed: number) =>
  createRabbitModel({
    settings: { niqqud: true, difficulty: "automatic" },
    content: contentBank,
    random: seededRandom(seed),
  });

describe("the rabbit Game's test driver", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`collects the next needed letter (seed ${seed})`, () => {
      const model = create(seed);
      rabbitTestDriver.solveStep(model);
      expect(model.state().challenge.next).toBe(1);
    });

    it(`solving step after step completes the Word (seed ${seed})`, () => {
      const model = create(seed);
      const length = model.state().challenge.letters.length;
      for (let i = 0; i < length; i++) rabbitTestDriver.solveStep(model);
      expect(model.state().progress.completed).toBe(1);
      expect(model.state().celebration).toBe("challenge");
    });

    it(`a step during the Challenge Celebration waits for the next Word and collects its first letter (seed ${seed})`, () => {
      const model = create(seed);
      const first = model.state().challenge.word;
      const length = model.state().challenge.letters.length;
      for (let i = 0; i < length; i++) rabbitTestDriver.solveStep(model);

      rabbitTestDriver.solveStep(model);
      const state = model.state();
      expect(state.challenge.word).not.toBe(first);
      expect(state.challenge.next).toBe(1);
    });
  }

  it("completes a whole Round, and then has no step left to make", () => {
    const model = create(1);
    while (model.state().progress.completed < 3) rabbitTestDriver.solveStep(model);
    model.advance(2);
    expect(model.state().roundOver).toBe(true);
    expect(() => rabbitTestDriver.solveStep(model)).toThrow(/Round is over/);
  });
});
