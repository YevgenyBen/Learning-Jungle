import { describe, expect, it } from "vitest";
import { contentBank } from "@/content";
import type { GameRequest, GameSettings } from "../contract";
import { seededRandom } from "../random";
import {
  CELEBRATION_PAUSE,
  CHALLENGES_PER_ROUND,
  createCatModel,
  JUMP_SECONDS,
  MOVE_SECONDS,
  SCENE,
  type CatDifficulty,
  type CatModel,
  type CatState,
} from "./model";
import { catTestDriver } from "./testDriver";

// Seam 1: the first-letter Game Model, driven only by Player actions and time.

const STEP = 1 / 60;

function create(seed = 1, settings: Partial<GameSettings<CatDifficulty>> = {}): CatModel {
  return createCatModel({
    settings: { niqqud: true, difficulty: "automatic", ...settings },
    content: contentBank,
    random: seededRandom(seed),
  });
}

function run(model: CatModel, seconds: number, requests: GameRequest[] = []): GameRequest[] {
  for (let t = 0; t < seconds; t += STEP) {
    model.advance(STEP);
    requests.push(...model.takeRequests());
  }
  return requests;
}

/** The letters on the Choices, in `pick` order. */
const choiceLetters = (state: CatState) =>
  state.choices.map((id) => state.perches.find((p) => p.id === id)!.sign!.letter);
const rightChoice = (state: CatState) => choiceLetters(state).indexOf(state.challenge.letter);
const wrongChoice = (state: CatState, skip = 0) =>
  choiceLetters(state).findIndex((l, i) => l !== state.challenge.letter && i >= skip);
const sign = (state: CatState, choice: number) =>
  state.perches.find((p) => p.id === state.choices[choice])!.sign!;
const says = (requests: GameRequest[]) => requests.flatMap((r) => (r.kind === "say" ? [r.item.id] : []));
const sounds = (requests: GameRequest[]) => requests.flatMap((r) => (r.kind === "sound" ? [r.effect] : []));

/** Lets the Celebration and the move pass, until the Player can choose again. */
function untilChoosing(model: CatModel, requests: GameRequest[] = []): void {
  for (let t = 0; t < 10; t += STEP) {
    if (model.state().phase === "choosing" || model.state().roundOver) return;
    model.advance(STEP);
    requests.push(...model.takeRequests());
  }
  throw new Error("never back to choosing");
}

describe("the first-letter Game's Challenge", () => {
  it("shows a Word and Choices, exactly one of them with the Word's first letter", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const state = create(seed, { difficulty: "four" }).state();
      const letters = choiceLetters(state);
      expect(letters).toHaveLength(4);
      expect(new Set(letters).size).toBe(4);
      expect(letters.filter((l) => l === state.challenge.letter)).toHaveLength(1);
      expect(contentBank.wordsStartingWith(state.challenge.letter)).toContain(state.challenge.word);
    }
  });

  it("never offers a decoy that sounds like the right letter", () => {
    const alike: Record<string, string[]> = { ק: ["כ", "ח"], כ: ["ק", "ח"], ת: ["ט"], ט: ["ת"], א: ["ע"], ע: ["א"], ס: ["ש"], ש: ["ס"] };
    for (let seed = 1; seed <= 60; seed++) {
      const state = create(seed, { difficulty: "four" }).state();
      for (const other of alike[state.challenge.letter] ?? []) expect(choiceLetters(state)).not.toContain(other);
    }
  });

  it("stands the Choices left of the cat, in reading order, the cat on its own perch", () => {
    const state = create(3, { difficulty: "four" }).state();
    const xs = state.choices.map((id) => state.perches.find((p) => p.id === id)!.x);
    expect(xs).toEqual([...xs].sort((a, b) => b - a));
    expect(Math.max(...xs)).toBeLessThan(SCENE.homeX - 60);
    expect(state.cat).toMatchObject({ x: SCENE.homeX, airborne: false });
  });

  it("says the Word when it comes", () => {
    const model = create();
    expect(says(model.takeRequests())).toEqual([model.state().challenge.word.id]);
  });

  it("the right Choice: the cat jumps onto it, and on landing the Letter Name and the Word are said and the Celebration starts", () => {
    const model = create();
    model.takeRequests();
    const start = model.state();
    const right = rightChoice(start);
    const targetId = start.choices[right];

    model.act({ kind: "pick", choice: right });
    const requests = model.takeRequests();
    expect(sounds(requests)).toEqual(["jump"]);
    expect(model.state().phase).toBe("jumping");

    run(model, JUMP_SECONDS / 2, requests);
    expect(model.state().cat.airborne).toBe(true);
    run(model, JUMP_SECONDS / 2 + 0.05, requests);

    const landed = model.state();
    const target = landed.perches.find((p) => p.id === targetId)!;
    expect(landed.cat).toMatchObject({ x: target.x, y: target.top, airborne: false });
    expect(landed.progress.completed).toBe(1);
    expect(landed.celebration).toBe("challenge");
    const letter = contentBank.letter(start.challenge.letter)!;
    expect(says(requests)).toEqual([letter.id, start.challenge.word.id]);
    expect(requests).toContainEqual({ kind: "celebrate", celebration: "challenge" });
  });

  it("after the Celebration the cat's perch slides home and the next Word comes with new Choices", () => {
    const model = create();
    const first = model.state();
    const targetId = first.choices[rightChoice(first)];
    model.act({ kind: "pick", choice: rightChoice(first) });
    run(model, JUMP_SECONDS + CELEBRATION_PAUSE + 0.05);
    expect(model.state().phase).toBe("moving");

    const requests = run(model, MOVE_SECONDS + 0.05);
    const next = model.state();
    expect(next.phase).toBe("choosing");
    expect(next.challenge.word.id).not.toBe(first.challenge.word.id);
    const home = next.perches.find((p) => p.id === targetId)!;
    expect(home).toMatchObject({ x: SCENE.homeX, sign: null });
    expect(next.cat.x).toBe(SCENE.homeX);
    expect(next.choices.every((id) => !first.choices.includes(id))).toBe(true);
    expect(next.perches.every((p) => p.rise === 1)).toBe(true);
    expect(says(requests)).toEqual([next.challenge.word.id]);
  });

  it("a wrong Choice is greyed with gentle feedback and costs nothing: no jump, no progress lost", () => {
    const model = create(2, { difficulty: "three" });
    model.takeRequests();
    const wrong = wrongChoice(model.state());

    model.act({ kind: "pick", choice: wrong });
    const state = model.state();
    expect(sounds(model.takeRequests())).toEqual(["mistake"]);
    expect(sign(state, wrong).rejected).toBe(true);
    expect(state.phase).toBe("choosing");
    expect(state.cat.doubt).toBeGreaterThan(0);
    expect(state.progress.completed).toBe(0);

    // Picking it again does nothing more.
    model.act({ kind: "pick", choice: wrong });
    expect(model.takeRequests()).toEqual([]);

    // The right one still works.
    model.act({ kind: "pick", choice: rightChoice(state) });
    run(model, JUMP_SECONDS + 0.05);
    expect(model.state().progress.completed).toBe(1);
  });

  it("two wrong Choices turn the Hint on, and it clears with the next Challenge", () => {
    const model = create(4, { difficulty: "four" });
    const state = model.state();
    const first = wrongChoice(state);
    model.act({ kind: "pick", choice: first });
    expect(model.state().hint).toBe(false);
    model.act({ kind: "pick", choice: wrongChoice(state, first + 1) });
    expect(model.state().hint).toBe(true);

    model.act({ kind: "pick", choice: rightChoice(state) });
    run(model, JUMP_SECONDS + 0.05);
    expect(model.state().hint).toBe(false);
  });

  it("nothing can be picked while the cat jumps, celebrates or moves", () => {
    const model = create();
    const state = model.state();
    model.act({ kind: "pick", choice: rightChoice(state) });
    // Mid-jump, mid-Celebration, mid-move.
    for (const [seconds, phase] of [[JUMP_SECONDS / 2, "jumping"], [JUMP_SECONDS, "celebrating"], [CELEBRATION_PAUSE, "moving"]] as const) {
      run(model, seconds);
      const now = model.state();
      expect(now.phase).toBe(phase);
      for (let i = 0; i < now.choices.length; i++) model.act({ kind: "pick", choice: i });
      model.act({ kind: "main-press" });
      model.act({ kind: "move", direction: "next" });
      expect(model.state()).toEqual(now);
      expect(model.takeRequests()).toEqual([]);
    }
  });
});

describe("keys: arrows move between Choices, Space picks", () => {
  it("the first Space only highlights the first Choice; the next one picks it", () => {
    const model = create(5, { difficulty: "three" });
    expect(model.state().focused).toBeNull();
    model.act({ kind: "main-press" });
    expect(model.state().focused).toBe(0);
    model.act({ kind: "main-release" });

    while (model.state().focused !== rightChoice(model.state())) model.act({ kind: "move", direction: "next" });
    model.act({ kind: "main-press" });
    expect(model.state().phase).toBe("jumping");
  });

  it("'next' goes leftward (reading order) and stops at the end; rejected Choices are skipped", () => {
    const model = create(6, { difficulty: "four" });
    model.act({ kind: "move", direction: "next" });
    expect(model.state().focused).toBe(0);
    for (let i = 0; i < 5; i++) model.act({ kind: "move", direction: "next" });
    expect(model.state().focused).toBe(3);
    model.act({ kind: "move", direction: "previous" });
    expect(model.state().focused).toBe(2);

    const fresh = create(6, { difficulty: "four" });
    const wrong = wrongChoice(fresh.state());
    fresh.act({ kind: "pick", choice: wrong });
    for (let i = 0; i < 4; i++) {
      fresh.act({ kind: "move", direction: "next" });
      expect(fresh.state().focused).not.toBe(wrong);
    }
  });
});

describe("Rounds", () => {
  it(`a Round is ${CHALLENGES_PER_ROUND} Challenges, ending with a Round Celebration`, () => {
    const model = create();
    const requests: GameRequest[] = [];
    for (let i = 0; i < CHALLENGES_PER_ROUND; i++) {
      catTestDriver.solveStep(model);
      requests.push(...model.takeRequests());
    }
    expect(model.state().roundOver).toBe(false);
    run(model, CELEBRATION_PAUSE + 0.05, requests);
    expect(model.state()).toMatchObject({ roundOver: true, celebration: "round" });
    expect(requests).toContainEqual({ kind: "celebrate", celebration: "round" });
    expect(sounds(requests)).toContain("round-complete");
  });

  it("another Round starts from zero with a new Word", () => {
    const model = create();
    for (let i = 0; i < CHALLENGES_PER_ROUND; i++) catTestDriver.solveStep(model);
    run(model, CELEBRATION_PAUSE + 0.05);
    const last = model.state().challenge.word;
    model.nextRound();
    untilChoosing(model);
    expect(model.state()).toMatchObject({ roundOver: false, celebration: null, progress: { completed: 0 } });
    expect(model.state().challenge.word).not.toBe(last);
  });

  it("no Word comes twice in a Round", () => {
    const model = create(9);
    const seen = new Set<string>();
    for (let i = 0; i < CHALLENGES_PER_ROUND; i++) {
      untilChoosing(model);
      seen.add(model.state().challenge.word.id);
      catTestDriver.solveStep(model);
    }
    expect(seen.size).toBe(CHALLENGES_PER_ROUND);
  });
});

describe("Difficulty: how many Choices", () => {
  it("fixed options give two, three or four Choices, every Challenge", () => {
    for (const [difficulty, count] of [["two", 2], ["three", 3], ["four", 4]] as const) {
      const model = create(1, { difficulty });
      for (let i = 0; i < 4; i++) {
        untilChoosing(model);
        expect(model.state().choices).toHaveLength(count);
        catTestDriver.solveStep(model);
      }
    }
  });

  it("automatic starts with two and adds one after every two first-try answers, up to four", () => {
    const model = create(1);
    const counts: number[] = [];
    for (let i = 0; i < CHALLENGES_PER_ROUND; i++) {
      untilChoosing(model);
      counts.push(model.state().choices.length);
      catTestDriver.solveStep(model);
    }
    run(model, CELEBRATION_PAUSE + 0.05);
    model.nextRound();
    for (let i = 0; i < 2; i++) {
      untilChoosing(model);
      counts.push(model.state().choices.length);
      catTestDriver.solveStep(model);
    }
    expect(counts).toEqual([2, 2, 3, 3, 4, 4, 4]);
  });

  it("automatic doesn't grow after an answer with a mistake", () => {
    const model = create(1);
    for (let i = 0; i < 2; i++) {
      untilChoosing(model);
      const state = model.state();
      model.act({ kind: "pick", choice: wrongChoice(state) });
      catTestDriver.solveStep(model);
    }
    untilChoosing(model);
    expect(model.state().choices).toHaveLength(2);
  });

  it("a change applies at once: the same Word gets the new number of Choices", () => {
    const model = create(1, { difficulty: "two" });
    const word = model.state().challenge.word;
    model.configure({ difficulty: "four" });
    const state = model.state();
    expect(state.challenge.word).toBe(word);
    expect(choiceLetters(state)).toHaveLength(4);
    expect(choiceLetters(state)).toContain(state.challenge.letter);
  });

  it("Niqqud picks the spelling the Celebration shows, its first letter with its marks", () => {
    for (const niqqud of [true, false]) {
      const model = create(1, { niqqud });
      const word = model.state().challenge.word;
      catTestDriver.solveStep(model);
      const celebrated = model.state().celebrated!;
      expect(celebrated.text).toBe(niqqud ? word.voweled : word.plain);
      expect(celebrated.text.startsWith(celebrated.first)).toBe(true);
      expect(celebrated.first.startsWith(model.state().challenge.letter)).toBe(true);
    }
  });
  it("with Niqqud on, the signs show the right letter as the Word marks it and decoys with its vowel", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = create(seed, { difficulty: "four" }).state();
      const first = contentBank.spelling(state.challenge.word, { niqqud: true }).letters[0];
      expect(state.challenge.marked).toBe(first.marked);
      for (let i = 0; i < state.choices.length; i++) {
        const { letter, marked } = sign(state, i);
        if (letter === state.challenge.letter) expect(marked).toBe(first.marked);
        else expect(contentBank.writtenLike(letter, first.marked)).toContain(marked);
      }
    }
  });

  it("with Niqqud off, every sign shows the bare letter", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = create(seed, { niqqud: false, difficulty: "four" }).state();
      expect(state.challenge.marked).toBe(state.challenge.letter);
      for (let i = 0; i < state.choices.length; i++) expect(sign(state, i).marked).toBe(sign(state, i).letter);
    }
  });
});
