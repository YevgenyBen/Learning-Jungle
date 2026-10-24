import { describe, expect, it } from "vitest";
import { contentBank, type ContentBank } from "@/content";
import type { GameRequest } from "../contract";
import { seededRandom } from "../random";
import { createRabbitModel, type RabbitModel, type RabbitState, type Tile, WORLD } from "./model";
import { rabbitTestDriver } from "./testDriver";

// Seam 1: the rabbit Game Model, driven only by Player actions and time.

const STEP = 1 / 60;

function create(seed = 1): RabbitModel {
  return createRabbitModel({
    settings: { niqqud: true, difficulty: "automatic" },
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

  it("completing the Word says it after its last Letter Name and starts the next Word", () => {
    const model = create(7);
    const firstWord = model.state().challenge.word;
    const requests: GameRequest[] = [];

    const length = model.state().challenge.letters.length;
    for (let i = 0; i < length; i++) {
      const need = waitForTile(model, (t, s) => s.challenge.word === firstWord && t.letter === neededLetter(s));
      jumpUnder(model, need.id, requests);
    }
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
