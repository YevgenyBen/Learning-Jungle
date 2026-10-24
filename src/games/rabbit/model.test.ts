import { describe, expect, it } from "vitest";
import { contentBank, type ContentBank } from "@/content";
import type { GameRequest, GameSettings } from "../contract";
import { seededRandom } from "../random";
import {
  createRabbitModel,
  type RabbitDifficulty,
  type RabbitModel,
  type RabbitState,
  type Tile,
  WORLD,
} from "./model";
import { rabbitTestDriver } from "./testDriver";

// Seam 1: the rabbit Game Model, driven only by Player actions and time.

const STEP = 1 / 60;

function create(seed = 1, settings: Partial<GameSettings<RabbitDifficulty>> = {}): RabbitModel {
  return createRabbitModel({
    settings: { niqqud: true, difficulty: "automatic", ...settings },
    content: contentBank,
    random: seededRandom(seed),
  });
}

/** Lets time pass in frame-sized steps, collecting every request emitted. */
function run(model: RabbitModel, seconds: number, requests: GameRequest[] = []): GameRequest[] {
  for (let t = 0; t < seconds; t += STEP) {
    model.advance(STEP);
    requests.push(...model.takeRequests());
  }
  return requests;
}

function runUntil(
  model: RabbitModel,
  done: (state: RabbitState) => boolean,
  requests: GameRequest[] = [],
  maxSeconds = 120,
): RabbitState {
  for (let t = 0; t < maxSeconds; t += STEP) {
    const state = model.state();
    if (done(state)) return state;
    model.advance(STEP);
    requests.push(...model.takeRequests());
  }
  throw new Error(`gave up after ${maxSeconds} s of game time`);
}

const neededLetter = (state: RabbitState) => state.challenge.letters[state.challenge.next].letter;
const tile = (state: RabbitState, id: number) => state.tiles.find((t) => t.id === id);
const ahead = (state: RabbitState, t: Tile) => t.x - state.rabbit.x;

/** Waits until a live tile matching `which` is coming up, and returns it. */
function waitForTile(
  model: RabbitModel,
  which: (t: Tile, state: RabbitState) => boolean,
  requests: GameRequest[] = [],
): Tile {
  const state = runUntil(
    model,
    (s) => s.tiles.some((t) => !t.collected && ahead(s, t) > 60 && which(t, s)),
    requests,
  );
  return state.tiles.find((t) => !t.collected && ahead(state, t) > 60 && which(t, state))!;
}

/** Runs until the tile is just ahead, then jumps with a full press and lands. */
function jumpUnder(model: RabbitModel, id: number, requests: GameRequest[] = []): void {
  runUntil(model, (s) => ahead(s, tile(s, id)!) < 30, requests);
  model.act({ kind: "main-press" });
  runUntil(model, (s) => !s.rabbit.onGround, requests);
  runUntil(model, (s) => s.rabbit.onGround, requests);
  model.act({ kind: "main-release" });
}

const says = (requests: GameRequest[]) =>
  requests.flatMap((r) => (r.kind === "say" ? [r.item.voweledText] : []));

/**
 * Collects the current Word's letters one by one, as a careful Player would,
 * and returns the moment the Word is complete (mid-jump, under its last letter).
 */
function completeWord(model: RabbitModel, requests: GameRequest[] = []): RabbitState {
  const { word, letters, next } = model.state().challenge;
  for (let i = next; i < letters.length - 1; i++) {
    const need = waitForTile(model, (t, s) => s.challenge.word === word && t.letter === neededLetter(s), requests);
    jumpUnder(model, need.id, requests);
  }
  const last = waitForTile(model, (t, s) => s.challenge.word === word && t.letter === neededLetter(s), requests);
  runUntil(model, (s) => ahead(s, tile(s, last.id)!) < 30, requests);
  model.act({ kind: "main-press" });
  const complete = runUntil(model, (s) => s.challenge.next === s.challenge.letters.length, requests);
  model.act({ kind: "main-release" });
  return complete;
}

/** Lets the Challenge Celebration play out, so the next Word has started. */
const waitOutCelebration = (model: RabbitModel, requests: GameRequest[] = []) =>
  runUntil(model, (s) => s.celebration !== "challenge", requests);

describe("the rabbit running across the meadow", () => {
  it("passes under every letter tile without collecting it when the Player never jumps", () => {
    const model = create();
    const requests = run(model, 30);
    const state = model.state();

    expect(state.distance).toBeGreaterThan(0);
    expect(state.tiles.length).toBeGreaterThan(0);
    expect(state.challenge.next).toBe(0);
    expect(says(requests)).toEqual([]);
    expect(state.tiles.every((t) => !t.collected)).toBe(true);
  });
});

describe("collecting letters", () => {
  it("the right next letter fills its slot and requests its Letter Name", () => {
    const model = create();
    const first = model.state().challenge.letters[0].letter;
    const needed = waitForTile(model, (t) => t.letter === first);

    const requests: GameRequest[] = [];
    jumpUnder(model, needed.id, requests);
    const state = model.state();

    expect(state.challenge.next).toBe(1);
    expect(tile(state, needed.id)?.collected ?? true).toBeTruthy();
    expect(requests).toContainEqual({
      kind: "say",
      item: contentBank.letter(first),
      interrupt: true,
    });
  });

  it("a wrong letter is not collected and empties no slot (ADR-0005)", () => {
    const model = create(3);
    const first = model.state().challenge.letters[0].letter;
    jumpUnder(model, waitForTile(model, (t) => t.letter === first).id);
    expect(model.state().challenge.next).toBe(1);

    const wrong = waitForTile(model, (t, s) => t.letter !== neededLetter(s));
    const requests: GameRequest[] = [];
    jumpUnder(model, wrong.id, requests);
    const state = model.state();

    expect(state.challenge.next).toBe(1);
    expect(tile(state, wrong.id)?.collected).toBe(false);
    expect(says(requests)).toEqual([]);
    expect(requests).toContainEqual({ kind: "sound", effect: "mistake" });
  });

  it("a missed needed letter comes again", () => {
    const model = create(5);
    const first = model.state().challenge.letters[0].letter;
    const missed = waitForTile(model, (t) => t.letter === first);
    runUntil(model, (s) => !tile(s, missed.id) || ahead(s, tile(s, missed.id)!) < -100);

    const again = waitForTile(model, (t) => t.letter === first);
    expect(again.id).not.toBe(missed.id);
    jumpUnder(model, again.id);
    expect(model.state().challenge.next).toBe(1);
  });

  it("completing the Word says it after its last Letter Name and, after its Celebration, starts the next Word", () => {
    const model = create(7);
    const firstWord = model.state().challenge.word;
    const requests: GameRequest[] = [];

    completeWord(model, requests);
    expect(model.state().progress.completed).toBe(1);
    waitOutCelebration(model, requests);
    const state = model.state();
    const lastLetter = contentBank.spelling(firstWord, { niqqud: true }).letters.at(-1)!;

    expect(state.progress.completed).toBe(1);
    expect(state.challenge.word).not.toEqual(firstWord);
    expect(state.challenge.next).toBe(0);
    const spoken = says(requests);
    expect(spoken.slice(-2)).toEqual([contentBank.letter(lastLetter.letter)!.name, firstWord.voweled]);
    expect(requests.find((r) => r.kind === "say" && r.item.id === firstWord.id)).toMatchObject({
      interrupt: false,
    });
    expect(requests).toContainEqual({ kind: "sound", effect: "challenge-complete" });
  });

  it("uses the Voweled Spelling's letters while Niqqud is on", () => {
    const model = create();
    const { word, text, letters } = model.state().challenge;
    expect(text).toBe(word.voweled);
    expect(letters).toEqual(contentBank.spelling(word, { niqqud: true }).letters);
  });
});

describe("the Hint", () => {
  /** Jumps into one more wrong letter than before. */
  const touchWrongLetter = (model: RabbitModel, requests: GameRequest[] = []) => {
    const wrong = waitForTile(model, (t, s) => !t.rejected && t.letter !== neededLetter(s), requests);
    jumpUnder(model, wrong.id, requests);
    expect(tile(model.state(), wrong.id)?.rejected ?? true).toBe(true);
  };

  it("shows after two wrong letters in the same Challenge, not after one", () => {
    const model = create(3);
    expect(model.state().hint).toBe(false);
    touchWrongLetter(model);
    expect(model.state().hint).toBe(false);
    touchWrongLetter(model);
    expect(model.state().hint).toBe(true);
  });

  it("stays until the Challenge ends and does not carry into the next one", () => {
    const model = create(3);
    touchWrongLetter(model);
    touchWrongLetter(model);
    const word = model.state().challenge.word;
    const first = waitForTile(model, (t, s) => t.letter === neededLetter(s));
    jumpUnder(model, first.id);
    expect(model.state().hint).toBe(true);

    expect(model.state().challenge.word).toBe(word);
    completeWord(model);
    expect(model.state().hint).toBe(false);
    waitOutCelebration(model);
    expect(model.state().hint).toBe(false);

    touchWrongLetter(model);
    expect(model.state().hint).toBe(false);
  });

  it("wrong letters each get gentle feedback and never take a filled slot away (ADR-0005)", () => {
    const model = create(3);
    const first = waitForTile(model, (t, s) => t.letter === neededLetter(s));
    jumpUnder(model, first.id);
    const requests: GameRequest[] = [];
    touchWrongLetter(model, requests);
    touchWrongLetter(model, requests);
    touchWrongLetter(model, requests);

    expect(model.state().challenge.next).toBe(1);
    expect(requests.filter((r) => r.kind === "sound" && r.effect === "mistake")).toHaveLength(3);
  });
});

describe("the Challenge Celebration", () => {
  it("starts when the Word is complete, with the whole Word still shown", () => {
    const model = create(7);
    const word = model.state().challenge.word;
    const requests: GameRequest[] = [];
    completeWord(model, requests);
    const state = model.state();

    expect(requests).toContainEqual({ kind: "celebrate", celebration: "challenge" });
    expect(state.celebration).toBe("challenge");
    expect(state.challenge.word).toBe(word);
    expect(state.challenge.next).toBe(state.challenge.letters.length);
  });

  it("for about 1.6 seconds no tiles spawn and none are collected, even while the Player keeps jumping", () => {
    for (const seed of [1, 2, 3, 4]) {
      const model = create(seed);
      const at = completeWord(model);
      const newest = Math.max(0, ...at.tiles.map((t) => t.id));
      const collectedBefore = at.tiles.filter((t) => t.collected).map((t) => t.id);

      const requests: GameRequest[] = [];
      while (model.state().time < at.time + 1.5) {
        model.act({ kind: "main-press" });
        run(model, STEP * 3, requests);
        model.act({ kind: "main-release" });
      }
      const state = model.state();

      expect(state.celebration).toBe("challenge");
      expect(state.tiles.filter((t) => t.id > newest)).toEqual([]);
      expect(state.tiles.filter((t) => t.collected && !collectedBefore.includes(t.id))).toEqual([]);
      expect(requests.filter((r) => r.kind !== "sound" || r.effect !== "jump")).toEqual([]);
    }
  });

  it("its sign shows the completed Word, also for a moment after the next Word has started", () => {
    const model = create(7);
    const { word, text } = model.state().challenge;
    const complete = completeWord(model);
    expect(complete.celebrated).toMatchObject({ word, text, since: 0 });

    const next = waitOutCelebration(model);
    expect(next.challenge.word).not.toBe(word);
    expect(next.celebrated?.word).toBe(word);
    expect(next.celebrated?.since).toBeCloseTo(1.6, 1);

    expect(runUntil(model, (s) => s.celebrated === null).time - complete.time).toBeGreaterThan(1.8);
  });

  it("ends after about 1.6 seconds, and the next Word starts", () => {
    const model = create(7);
    const word = model.state().challenge.word;
    const start = completeWord(model).time;

    const state = waitOutCelebration(model);
    expect(state.time - start).toBeGreaterThan(1.5);
    expect(state.time - start).toBeLessThan(1.7);
    expect(state.celebration).toBeNull();
    expect(state.challenge.word).not.toBe(word);
    expect(state.challenge.next).toBe(0);
  });
});

describe("a Round", () => {
  const roundRequests = (requests: GameRequest[]) =>
    requests.filter(
      (r) => (r.kind === "celebrate" && r.celebration === "round") || (r.kind === "sound" && r.effect === "round-complete"),
    );

  it("is three Words, with progress counting the completed ones", () => {
    const model = create(11);
    expect(model.state().progress).toEqual({ completed: 0, total: 3 });
    const requests: GameRequest[] = [];
    for (const completed of [1, 2]) {
      completeWord(model, requests);
      waitOutCelebration(model, requests);
      expect(model.state().progress).toEqual({ completed, total: 3 });
      expect(model.state().roundOver).toBe(false);
    }
    expect(roundRequests(requests)).toEqual([]);

    completeWord(model, requests);
    expect(model.state().roundOver).toBe(false);
    const state = waitOutCelebration(model, requests);

    expect(state.progress).toEqual({ completed: 3, total: 3 });
    expect(state.roundOver).toBe(true);
    expect(state.celebration).toBe("round");
    expect(roundRequests(requests)).toEqual([
      { kind: "celebrate", celebration: "round" },
      { kind: "sound", effect: "round-complete" },
    ]);
  });

  it("brings no new letters once it is over, and nothing more is collected", () => {
    const model = create(11);
    for (let i = 0; i < 3; i++) {
      completeWord(model);
      waitOutCelebration(model);
    }
    const over = model.state();
    const newest = Math.max(0, ...over.tiles.map((t) => t.id));

    const requests: GameRequest[] = [];
    for (let i = 0; i < 40; i++) {
      model.act({ kind: "main-press" });
      run(model, 0.25, requests);
      model.act({ kind: "main-release" });
    }
    const state = model.state();

    expect(state.roundOver).toBe(true);
    expect(state.progress.completed).toBe(3);
    expect(state.tiles.filter((t) => t.id > newest)).toEqual([]);
    expect(requests.filter((r) => r.kind !== "sound" || r.effect !== "jump")).toEqual([]);
  });
});

describe("the Words of a Challenge", () => {
  /** The Content Bank, with only these Words in it. */
  const bankOf = (...ids: string[]): ContentBank => ({
    ...contentBank,
    words: () => contentBank.words().filter((w) => ids.includes(w.id)),
  });

  /** Plays until `count` Words are completed, returning them in order (as said aloud). */
  const wordsPlayed = (model: RabbitModel, count: number): string[] => {
    const said: string[] = [];
    while (said.length < count) {
      rabbitTestDriver.solveStep(model);
      for (const r of model.takeRequests()) {
        if (r.kind === "say" && r.item.id.startsWith("word-")) said.push(r.item.id);
      }
    }
    return said;
  };

  it("come from the whole Content Bank", () => {
    const ids = new Set(contentBank.words().map((w) => w.id));
    for (let seed = 1; seed <= 20; seed++) {
      expect(ids).toContain(create(seed).state().challenge.word.id);
    }
    const firsts = new Set(Array.from({ length: 20 }, (_, i) => create(i + 1).state().challenge.word.id));
    expect(firsts.size).toBeGreaterThan(10);
  });

  it("don't repeat until the other Words have appeared, even when every Word has been used", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const model = createRabbitModel({
        settings: { niqqud: true, difficulty: "automatic" },
        content: bankOf("word-fish", "word-turtle"),
        random: seededRandom(seed),
      });
      const [first, second, third] = wordsPlayed(model, 3);
      expect(second, `seed ${seed}`).not.toBe(first);
      expect(third, `seed ${seed}`).not.toBe(second);
    }
  });
});

describe("jumping", () => {
  /** How high the rabbit's feet get for a press held this long. */
  const peakHeight = (model: RabbitModel, holdSeconds: number) => {
    let peak = 0;
    const track = (s: RabbitState) => (peak = Math.max(peak, WORLD.ground - s.rabbit.y));
    model.act({ kind: "main-press" });
    runUntil(model, (s) => (track(s), s.time >= holdSeconds));
    model.act({ kind: "main-release" });
    runUntil(model, (s) => (track(s), s.rabbit.onGround));
    return peak;
  };

  it("a press makes the rabbit leave the ground with a jump Sound Effect", () => {
    const model = create();
    model.act({ kind: "main-press" });
    const requests = run(model, STEP * 2);
    expect(model.state().rabbit.onGround).toBe(false);
    expect(requests).toContainEqual({ kind: "sound", effect: "jump" });
  });

  it("a longer press jumps higher than a short one", () => {
    const short = peakHeight(create(), STEP);
    const long = peakHeight(create(), 0.4);
    // Even the shortest hop reaches a tile; a held press goes about 120 px up.
    expect(short).toBeGreaterThan(20);
    expect(long).toBeGreaterThan(110);
    expect(long).toBeGreaterThan(short * 2);
  });

  it("lands back on the ground and stays there without a press", () => {
    const model = create();
    model.act({ kind: "main-press" });
    model.act({ kind: "main-release" });
    run(model, 2);
    expect(model.state().rabbit.onGround).toBe(true);
    expect(model.state().rabbit.y).toBe(WORLD.ground);
  });
});

describe("automatic speed", () => {
  /** Completes a Word and lets its Celebration play out. */
  const playWord = (model: RabbitModel) => {
    completeWord(model);
    return waitOutCelebration(model);
  };

  it("starts slow and rises one step after the second completed Word, easing in after the Celebration", () => {
    const model = create(11);
    expect(model.state().speed).toBe(170);
    playWord(model);
    run(model, 3);
    expect(model.state().speed).toBe(170);

    const complete = completeWord(model);
    expect(complete.speed).toBe(170);
    const after = waitOutCelebration(model);
    // Frozen during the Celebration, then eased in rather than jumped to.
    expect(after.speed).toBeLessThan(171);
    run(model, 0.3);
    expect(model.state().speed).toBeGreaterThan(170);
    expect(model.state().speed).toBeLessThan(200);
    run(model, 1);
    expect(model.state().speed).toBe(200);
  });

  it("never rises with time or distance alone", () => {
    const model = create(2);
    run(model, 90);
    expect(model.state().distance).toBeGreaterThan(10_000);
    expect(model.state().speed).toBe(170);
  });

  it("carries into another Round, which starts afresh with the next Word", () => {
    const model = create(11);
    const seen = [0, 1, 2].map(() => {
      const word = model.state().challenge.word.id;
      playWord(model);
      return word;
    });
    expect(model.state().roundOver).toBe(true);
    expect(model.state().speed).toBe(200);

    model.nextRound();
    const state = model.state();
    expect(state.roundOver).toBe(false);
    expect(state.celebration).toBeNull();
    expect(state.progress).toEqual({ completed: 0, total: 3 });
    expect(state.challenge.next).toBe(0);
    expect(seen).not.toContain(state.challenge.word.id);
    expect(state.speed).toBe(200);

    // The fourth Word completed since the start brings the next step.
    playWord(model);
    run(model, 1);
    expect(model.state().speed).toBe(230);
  });

  it("caps at fast", () => {
    const model = create(4);
    const speeds: number[] = [];
    for (let word = 0; word < 18; word++) {
      if (playWord(model).roundOver) model.nextRound();
      run(model, 1);
      speeds.push(model.state().speed);
    }
    expect(speeds).toEqual([
      170, 200, 200, 230, 230, 260, 260, 290, 290, 320, 320, 350, 350, 380, 380, 400, 400, 400,
    ]);
  });

  it("is announced on the Celebration sign of each Word that brings a rise, and only then", () => {
    const model = create(4);
    const announced: boolean[] = [];
    for (let word = 0; word < 18; word++) {
      announced.push(completeWord(model).celebrated!.speedRising);
      if (waitOutCelebration(model).roundOver) model.nextRound();
    }
    const rises = announced.flatMap((rising, i) => (rising ? [i + 1] : []));
    expect(rises).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
  });
});

describe("fixed speeds", () => {
  for (const [difficulty, speed] of [
    ["slow", 170],
    ["medium", 280],
    ["fast", 400],
  ] as const) {
    it(`${difficulty} never changes on its own and is never announced`, () => {
      const model = create(4, { difficulty });
      expect(model.state().speed).toBe(speed);
      for (let word = 0; word < 6; word++) {
        expect(completeWord(model).celebrated!.speedRising).toBe(false);
        if (waitOutCelebration(model).roundOver) model.nextRound();
        run(model, 1);
        expect(model.state().speed).toBe(speed);
      }
    });
  }
});

describe("Niqqud", () => {
  const tomato = contentBank.words().find((w) => w.id === "word-tomato")!;
  /** A model whose every Challenge is the tomato. */
  const tomatoModel = (niqqud: boolean) =>
    createRabbitModel({
      settings: { niqqud, difficulty: "automatic" },
      content: { ...contentBank, words: () => [tomato] },
      random: seededRandom(1),
    });
  const letters = (state: RabbitState) => state.challenge.letters.map((l) => l.letter).join("");

  it("on: the Challenge is the Voweled Spelling, and עַגְבָנִיָּה gives six letters", () => {
    const { challenge } = tomatoModel(true).state();
    expect(challenge.text).toBe("עַגְבָנִיָּה");
    expect(challenge.letters.map((l) => l.letter)).toEqual(["ע", "ג", "ב", "נ", "י", "ה"]);
    expect(challenge.letters.map((l) => l.marked)).toEqual(["עַ", "גְ", "בָ", "נִ", "יָּ", "ה"]);
  });

  it("off: the Challenge is the Plain Spelling, and עגבנייה gives seven letters", () => {
    const { challenge } = tomatoModel(false).state();
    expect(challenge.text).toBe("עגבנייה");
    expect(challenge.letters.map((l) => l.letter)).toEqual(["ע", "ג", "ב", "נ", "י", "י", "ה"]);
    expect(challenge.letters.map((l) => l.marked)).toEqual(["ע", "ג", "ב", "נ", "י", "י", "ה"]);
  });

  it("a change applies from the next Challenge, not to the Word being built", () => {
    const model = tomatoModel(true);
    jumpUnder(model, waitForTile(model, (t, s) => t.letter === neededLetter(s)).id);
    model.configure({ niqqud: false });
    expect(model.state().challenge.text).toBe("עַגְבָנִיָּה");
    expect(model.state().challenge.next).toBe(1);

    const complete = completeWord(model);
    expect(complete.celebrated?.text).toBe("עַגְבָנִיָּה");
    const next = waitOutCelebration(model);
    expect(next.challenge.text).toBe("עגבנייה");
    expect(letters(next)).toBe("עגבנייה");

    model.configure({ niqqud: true });
    completeWord(model);
    expect(letters(waitOutCelebration(model))).toBe("עגבניה");
  });
});

describe("changing the Difficulty of a running Game", () => {
  it("a fixed speed applies at once, also from another fixed speed", () => {
    const model = create(2);
    run(model, 2);
    model.configure({ difficulty: "fast" });
    expect(model.state().speed).toBe(400);
    model.configure({ difficulty: "medium" });
    expect(model.state().speed).toBe(280);
    run(model, 5);
    expect(model.state().speed).toBe(280);
  });

  it("automatic eases from the current speed toward the speed the completed Words have earned", () => {
    const model = create(2, { difficulty: "fast" });
    model.configure({ difficulty: "automatic" });
    run(model, 1);
    expect(model.state().speed).toBeLessThan(400);
    expect(model.state().speed).toBeGreaterThan(300);
    run(model, 10);
    expect(model.state().speed).toBe(170);
  });
});
