import { describe, expect, it } from "vitest";
import { contentBank } from "@/content";
import { seededRandom } from "../random";
import { CHALLENGES_PER_ROUND, createCatModel } from "./model";
import { catTestDriver } from "./testDriver";

// The test driver plays the first-letter Game the way a Player would (only
// actions and time), so Playwright can complete Challenges on demand.

const create = (seed: number) =>
  createCatModel({
    settings: { niqqud: true, difficulty: "automatic" },
    content: contentBank,
    random: seededRandom(seed),
  });

describe("the first-letter Game's test driver", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`completes the Challenge with one step (seed ${seed})`, () => {
      const model = create(seed);
      catTestDriver.solveStep(model);
      expect(model.state().progress.completed).toBe(1);
      expect(model.state().celebration).toBe("challenge");
    });
  }

  it("a step during the Celebration waits for the next Word and completes it", () => {
    const model = create(1);
    const first = model.state().challenge.word;
    catTestDriver.solveStep(model);
    catTestDriver.solveStep(model);
    expect(model.state().challenge.word).not.toBe(first);
    expect(model.state().progress.completed).toBe(2);
  });

  it("completes a whole Round, and then has no step left to make", () => {
    const model = create(1);
    for (let i = 0; i < CHALLENGES_PER_ROUND; i++) catTestDriver.solveStep(model);
    model.advance(2);
    expect(model.state().roundOver).toBe(true);
    expect(() => catTestDriver.solveStep(model)).toThrow(/Round is over/);
  });
});
