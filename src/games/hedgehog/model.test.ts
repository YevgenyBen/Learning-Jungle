import { describe, expect, it } from "vitest";
import { contentBank } from "@/content";
import type { GameRequest, GameSettings } from "../contract";
import { seededRandom } from "../random";
import {
  CELEBRATION_PAUSE,
  CHALLENGES_PER_ROUND,
  CHOICE_COUNT,
  COUNTED_PAUSE,
  createHedgehogModel,
  RANGES,
  SCENE,
  type HedgehogDifficulty,
  type HedgehogModel,
} from "./model";
import { hedgehogTestDriver } from "./testDriver";

// The counting Game Model, driven only by Player actions and time.

const STEP = 1 / 60;

function create(seed = 1, settings: Partial<GameSettings<HedgehogDifficulty>> = {}): HedgehogModel {
  return createHedgehogModel({
    settings: { niqqud: true, difficulty: "automatic", ...settings },
    content: contentBank,
    random: seededRandom(seed),
  });
}

function run(model: HedgehogModel, seconds: number, requests: GameRequest[] = []): GameRequest[] {
  for (let t = 0; t < seconds; t += STEP) {
    model.advance(STEP);
    requests.push(...model.takeRequests());
  }
  return requests;
}

const says = (requests: GameRequest[]) => requests.flatMap((r) => (r.kind === "say" ? [r.item.id] : []));
const sounds = (requests: GameRequest[]) => requests.flatMap((r) => (r.kind === "sound" ? [r.effect] : []));

function countAll(model: HedgehogModel): void {
  for (const fruit of model.state().fruits) model.act({ kind: "pick", choice: fruit.index });
}
function toAnswering(model: HedgehogModel): void {
  countAll(model);
  run(model, COUNTED_PAUSE + 0.1);
}
const rightChoice = (model: HedgehogModel) => model.state().choices.findIndex((c) => c.value === model.state().total);
const wrongChoice = (model: HedgehogModel, skip = 0) =>
  model.state().choices.findIndex((c, i) => c.value !== model.state().total && i >= skip);

describe("the counting Game's Challenge", () => {
  it("lays out a number of fruits of one kind, in range, inside the meadow and none counted", () => {
    for (const difficulty of ["five", "ten", "twenty"] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        const s = create(seed, { difficulty }).state();
        expect(s.total).toBeGreaterThanOrEqual(RANGES[difficulty].min);
        expect(s.total).toBeLessThanOrEqual(RANGES[difficulty].max);
        expect(s.fruits).toHaveLength(s.total);
        expect(s.fruit.category).toBe("fruits");
        expect(s.count).toBe(0);
        for (const f of s.fruits) {
          expect(f.counted).toBeNull();
          expect(f.x).toBeGreaterThan(SCENE.width * 0.35);
          expect(f.x).toBeLessThan(SCENE.width);
          expect(f.y).toBeGreaterThan(0);
          expect(f.y).toBeLessThan(SCENE.height);
        }
      }
    }
  });

  it("fruits never lie on top of each other", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { fruits } = create(seed, { difficulty: "twenty" }).state();
      for (const a of fruits)
        for (const b of fruits) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(30);
    }
  });

  it("each tapped fruit counts the next number, shows it and says it", () => {
    const model = create(2, { difficulty: "ten" });
    const { fruits, total } = model.state();
    const order = [...fruits].reverse();
    order.forEach((fruit, i) => {
      model.act({ kind: "pick", choice: fruit.index });
      const s = model.state();
      expect(s.count).toBe(i + 1);
      expect(s.fruits[fruit.index].counted).toBe(i + 1);
      const requests = model.takeRequests();
      expect(says(requests)).toEqual([`number-${i + 1}`]);
      expect(sounds(requests)).toEqual(["collect"]);
    });
    expect(model.state().count).toBe(total);
    expect(model.state().phase).toBe("counted");
  });

  it("tapping a fruit already on the hedgehog does nothing", () => {
    const model = create(3, { difficulty: "ten" });
    model.act({ kind: "pick", choice: 0 });
    model.takeRequests();
    model.act({ kind: "pick", choice: 0 });
    expect(model.state().count).toBe(1);
    expect(model.takeRequests()).toEqual([]);
  });

  it("Space counts the next fruit in reading order, rightmost first", () => {
    const model = create(4, { difficulty: "ten" });
    const rightmost = [...model.state().fruits].sort((a, b) => b.x - a.x)[0];
    model.act({ kind: "main-press" });
    expect(model.state().fruits[rightmost.index].counted).toBe(1);
  });

  it("once all are counted, numeral Choices appear with the total once among them", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const model = create(seed, { difficulty: "five" });
      countAll(model);
      expect(model.state().choices).toEqual([]);
      run(model, COUNTED_PAUSE + 0.1);
      const s = model.state();
      expect(s.phase).toBe("answering");
      const values = s.choices.map((c) => c.value);
      expect(values).toHaveLength(CHOICE_COUNT);
      expect(new Set(values).size).toBe(CHOICE_COUNT);
      expect(values.filter((v) => v === s.total)).toHaveLength(1);
      for (const v of values) expect(v).toBeGreaterThanOrEqual(1);
    }
  });

  it("a wrong total greys it and costs nothing; the right one celebrates and says the number, never the fruit", () => {
    const model = create(5);
    toAnswering(model);
    model.takeRequests();
    model.act({ kind: "pick", choice: wrongChoice(model) });
    expect(model.state().choices[wrongChoice(model)].rejected).toBe(true);
    expect(sounds(model.takeRequests())).toEqual(["mistake"]);
    expect(model.state().progress.completed).toBe(0);
    expect(model.state().phase).toBe("answering");

    const { total } = model.state();
    model.act({ kind: "pick", choice: rightChoice(model) });
    const requests = model.takeRequests();
    expect(says(requests)).toEqual([`number-${total}`]);
    expect(model.state().celebration).toBe("challenge");
    expect(model.state().progress.completed).toBe(1);
  });

  it("shows the Hint after two wrong totals", () => {
    const model = create(6, { difficulty: "ten" });
    toAnswering(model);
    model.act({ kind: "pick", choice: wrongChoice(model) });
    expect(model.state().hint).toBe(false);
    model.act({ kind: "pick", choice: wrongChoice(model, wrongChoice(model) + 1) });
    expect(model.state().hint).toBe(true);
  });

  it("brings a new Challenge after the Celebration, never with the same number of fruits", () => {
    const model = create(7);
    const before = model.state();
    toAnswering(model);
    model.act({ kind: "pick", choice: rightChoice(model) });
    run(model, CELEBRATION_PAUSE + 0.1);
    const after = model.state();
    expect(after.phase).toBe("counting");
    expect(after.number).toBe(2);
    expect(after.count).toBe(0);
    expect(after.total).not.toBe(before.total);
    expect(after.hint).toBe(false);
  });
});

describe("the counting Game's Round and Difficulty", () => {
  it("is five Challenges, then the Round Celebration; another Round starts afresh", () => {
    const model = create(8);
    const requests: GameRequest[] = [];
    for (let i = 0; i < CHALLENGES_PER_ROUND; i++) {
      hedgehogTestDriver.solveStep(model);
      requests.push(...model.takeRequests());
    }
    run(model, CELEBRATION_PAUSE + 0.1, requests);
    expect(model.state().roundOver).toBe(true);
    expect(model.state().celebration).toBe("round");
    expect(requests).toContainEqual({ kind: "celebrate", celebration: "round" });

    model.nextRound();
    expect(model.state().roundOver).toBe(false);
    expect(model.state().progress.completed).toBe(0);
    expect(model.state().phase).toBe("counting");
  });

  it("automatic starts at up to 5 and grows after first-try answers", () => {
    const model = create(9);
    expect(model.state().total).toBeLessThanOrEqual(RANGES.five.max);
    for (let i = 0; i < 3; i++) {
      hedgehogTestDriver.solveStep(model);
      run(model, CELEBRATION_PAUSE + 0.1);
    }
    expect(model.state().total).toBeGreaterThanOrEqual(RANGES.ten.min);
  });

  it("a Difficulty change applies at once to a Challenge not started, and leaves a half-counted one alone", () => {
    const model = create(10, { difficulty: "five" });
    model.configure({ difficulty: "twenty" });
    expect(model.state().total).toBeGreaterThanOrEqual(RANGES.twenty.min);
    model.act({ kind: "pick", choice: 0 });
    const total = model.state().total;
    model.configure({ difficulty: "five" });
    expect(model.state().total).toBe(total);
    expect(model.state().count).toBe(1);
  });
});
