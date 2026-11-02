/**
 * The counting Game's rules: a hedgehog stands at the left of a meadow,
 * where the Player's reading eye ends up, and fruits lie in the grass to
 * its right. Each fruit the Player taps rolls onto the hedgehog's spines
 * and the next number is shown big and said aloud. Once every fruit is on
 * its back, the Player picks how many there are from a few numeral
 * Choices. No drawing, DOM or sound here (see ../contract.ts).
 *
 * The scene is in logical pixels (SCENE) and y grows downward.
 */
import type { Word } from "@/content";
import type { CreateGameModel, GameModel, GameRequest, GameSettings, GameState } from "../contract";
import { between, shuffled, type Random } from "../random";
import { createWordBag } from "../wordBag";

export const SCENE = {
  width: 900,
  height: 360,
} as const;

/** Where the fruits lie: the meadow right of the hedgehog. */
const FIELD = { left: 360, right: 880, top: 40, bottom: 330 } as const;
/** How far a fruit may lie from its grid spot, so the meadow never looks ruled. */
const FRUIT_JITTER = 0.22; // of a grid cell

/** After the last fruit is counted, this long passes before the numeral Choices appear. */
export const COUNTED_PAUSE = 0.6; // s
/** After the right total is picked, this long passes before the next Challenge. */
export const CELEBRATION_PAUSE = 2; // s
/** How long the hedgehog looks puzzled after a wrong total. */
const DOUBT_SECONDS = 0.7;

export const CHALLENGES_PER_ROUND = 5;
/** After this many wrong totals in one Challenge, the Hint highlights the right one. */
const HINT_AFTER_MISTAKES = 2;
/** How many numeral Choices the Player picks the total from. */
export const CHOICE_COUNT = 3;

/** The largest number of fruits each Difficulty lays out; the smallest is always 1 more than the step below. */
export const RANGES = {
  five: { min: 1, max: 5 },
  ten: { min: 4, max: 10 },
  twenty: { min: 8, max: 20 },
} as const;
const STEPS: readonly (keyof typeof RANGES)[] = ["five", "ten", "twenty"];
/** Automatic starts at up to 5 and moves up a range after this many first-try answers. */
const FIRST_TRIES_PER_STEP = 3;

export type HedgehogDifficulty = "automatic" | keyof typeof RANGES;
const isHedgehogDifficulty = (difficulty: string | undefined): difficulty is HedgehogDifficulty =>
  difficulty === "automatic" || (difficulty !== undefined && Object.hasOwn(RANGES, difficulty));

/** One fruit of the Challenge. */
export interface Fruit {
  /** Its index in `fruits`: what `pick` names while counting. */
  readonly index: number;
  /** Where it lies in the meadow (its middle). */
  readonly x: number;
  readonly y: number;
  /** A small tilt in degrees, so the fruits don't look stamped. */
  readonly tilt: number;
  /** Its place in the count (1 for the first counted), or null while it is still in the grass. */
  readonly counted: number | null;
}

/** A numeral Choice for the total. */
export interface NumberChoice {
  readonly value: number;
  /** Picked while it was not the total: it stays, greyed. */
  readonly rejected: boolean;
}

/**
 * - counting: the Player taps fruits; each rolls onto the hedgehog.
 * - counted: every fruit is on its back; a short pause before the Choices.
 * - answering: the Player picks the total from the numeral Choices.
 * - celebrating: the right total was picked; the Challenge Celebration runs.
 */
export type HedgehogPhase = "counting" | "counted" | "answering" | "celebrating";

export interface HedgehogState extends GameState {
  /** Game time in seconds. */
  readonly time: number;
  readonly phase: HedgehogPhase;
  /** Which Challenge of the Round this is (1 for the first): views key their entrances on it. */
  readonly number: number;
  /** The fruit counted this Challenge. */
  readonly fruit: Word;
  readonly fruits: readonly Fruit[];
  /** How many fruits have been counted so far: the big running numeral. */
  readonly count: number;
  /** How many fruits there are: the right Choice. */
  readonly total: number;
  /** The numeral Choices in reading order, once the Player answers (empty while counting). */
  readonly choices: readonly NumberChoice[];
  /** Index into `choices` the keyboard has highlighted, or null. */
  readonly focused: number | null;
  /** Seconds left of the hedgehog's puzzled look after a wrong total. */
  readonly doubt: number;
}

export type HedgehogModel = GameModel<HedgehogState>;

type MutableFruit = { -readonly [K in keyof Fruit]: Fruit[K] };
type MutableChoice = { -readonly [K in keyof NumberChoice]: NumberChoice[K] };

export const createHedgehogModel: CreateGameModel<HedgehogState, HedgehogDifficulty> = ({
  settings,
  content,
  random,
}) => {
  let current: GameSettings<HedgehogDifficulty> = { niqqud: settings.niqqud, difficulty: settings.difficulty };
  /** Challenges answered right on the first try since the model was made: automatic follows these. */
  let firstTries = 0;
  const range = () =>
    RANGES[
      current.difficulty === "automatic"
        ? STEPS[Math.min(STEPS.length - 1, Math.floor(firstTries / FIRST_TRIES_PER_STEP))]
        : current.difficulty
    ];
  const fruitWords = createWordBag(content.words({ category: "fruits" }), random);

  let time = 0;
  let phase: HedgehogPhase = "counting";
  let inPhase = 0;
  let completed = 0;
  let number = 1;
  let roundOver = false;
  let mistakes = 0;
  let doubt = 0;
  let focused: number | null = null;
  let requests: GameRequest[] = [];
  const emit = (request: GameRequest) => requests.push(request);

  let fruit: Word = fruitWords.next();
  let total = 0;
  let count = 0;
  let fruits: MutableFruit[] = [];
  let choices: MutableChoice[] = [];
  /** The last total, so two Challenges in a row never have the same number of fruits. */
  let lastTotal = 0;
  newChallenge();

  function newChallenge(): void {
    const { min, max } = range();
    do total = Math.floor(between(random, min, max + 1));
    while (total === lastTotal && max > min);
    lastTotal = total;
    fruit = fruitWords.next();
    fruits = layOut(total);
    count = 0;
    choices = [];
    focused = null;
    mistakes = 0;
    doubt = 0;
    phase = "counting";
    inPhase = 0;
  }

  /** `n` fruits on a jittered grid in the meadow, at random free cells. */
  function layOut(n: number): MutableFruit[] {
    const columns = n <= 5 ? 3 : n <= 10 ? 4 : 6;
    const rows = Math.ceil(n / columns) + (n <= 5 ? 1 : 0);
    const cellW = (FIELD.right - FIELD.left) / columns;
    const cellH = (FIELD.bottom - FIELD.top) / rows;
    const cells = shuffled(random, Array.from({ length: columns * rows }, (_, i) => i)).slice(0, n);
    return cells.map((cell, index) => ({
      index,
      x: FIELD.left + cellW * ((cell % columns) + 0.5 + between(random, -FRUIT_JITTER, FRUIT_JITTER)),
      y: FIELD.top + cellH * (Math.floor(cell / columns) + 0.5 + between(random, -FRUIT_JITTER, FRUIT_JITTER)),
      tilt: between(random, -20, 20),
      counted: null,
    }));
  }

  /** The total and two neighbours, all at least 1, in a random reading order. */
  function newChoices(): MutableChoice[] {
    const near = shuffled(random, [-2, -1, 1, 2].map((d) => total + d).filter((v) => v >= 1));
    // Prefer the closest neighbours: they make the Player look, not guess.
    near.sort((a, b) => Math.abs(a - total) - Math.abs(b - total));
    const values = shuffled(random, [total, ...near.slice(0, CHOICE_COUNT - 1)]);
    return values.map((value) => ({ value, rejected: false }));
  }

  function countFruit(index: number): void {
    if (phase !== "counting") return;
    const f = fruits[index];
    // A fruit already on the hedgehog's back does nothing.
    if (!f || f.counted !== null) return;
    count++;
    f.counted = count;
    emit({ kind: "sound", effect: "collect" });
    const spoken = content.number(count);
    if (spoken) emit({ kind: "say", item: spoken, interrupt: true });
    if (count === total) begin("counted");
  }

  /** The next fruit in reading order (rightmost first), for Space. */
  function nextFruit(): number {
    const left = fruits.filter((f) => f.counted === null).sort((a, b) => b.x - a.x);
    return left[0]?.index ?? -1;
  }

  function answer(index: number): void {
    if (phase !== "answering") return;
    const choice = choices[index];
    if (!choice || choice.rejected) return;
    if (choice.value !== total) {
      choice.rejected = true;
      mistakes++;
      doubt = DOUBT_SECONDS;
      emit({ kind: "sound", effect: "mistake" });
      if (focused === index) focused = firstLive(0, 1);
      return;
    }
    completed++;
    if (mistakes === 0) firstTries++;
    focused = null;
    begin("celebrating");
    const spoken = content.number(total);
    // Only the number is said: the fruit's name would distract from how many there are.
    if (spoken) emit({ kind: "say", item: spoken, interrupt: true });
    emit({ kind: "sound", effect: "challenge-complete" });
    emit({ kind: "celebrate", celebration: "challenge" });
  }

  const live = (i: number) => choices[i] !== undefined && !choices[i].rejected;
  function firstLive(from: number, by: number): number | null {
    for (let i = from; i >= 0 && i < choices.length; i += by) if (live(i)) return i;
    return null;
  }
  function move(direction: "next" | "previous"): void {
    if (phase !== "answering") return;
    const by = direction === "next" ? 1 : -1;
    if (focused === null) {
      focused = firstLive(by === 1 ? 0 : choices.length - 1, by);
      return;
    }
    const next = firstLive(focused + by, by);
    if (next !== null) focused = next;
  }

  function begin(next: HedgehogPhase): void {
    phase = next;
    inPhase = 0;
  }

  function step(dt: number): void {
    time += dt;
    inPhase += dt;
    doubt = Math.max(0, doubt - dt);
    if (phase === "counted" && inPhase >= COUNTED_PAUSE) {
      choices = newChoices();
      begin("answering");
    } else if (phase === "celebrating" && !roundOver && inPhase >= CELEBRATION_PAUSE) {
      if (completed < CHALLENGES_PER_ROUND) {
        number++;
        newChallenge();
      } else {
        roundOver = true;
        emit({ kind: "celebrate", celebration: "round" });
        emit({ kind: "sound", effect: "round-complete" });
      }
    }
  }

  return {
    state: () => ({
      progress: { completed, total: CHALLENGES_PER_ROUND },
      hint: mistakes >= HINT_AFTER_MISTAKES,
      celebration: roundOver ? "round" : phase === "celebrating" ? "challenge" : null,
      roundOver,
      time,
      phase,
      number,
      fruit,
      fruits: fruits.map((f) => ({ ...f })),
      count,
      total,
      choices: choices.map((c) => ({ ...c })),
      focused,
      doubt,
    }),
    act: (action) => {
      if (action.kind === "pick") {
        if (phase === "counting") countFruit(action.choice);
        else answer(action.choice);
      } else if (action.kind === "move") move(action.direction);
      else if (action.kind === "main-press") {
        // Space counts the next fruit; while answering, the first press highlights a Choice and the next picks it.
        if (phase === "counting") countFruit(nextFruit());
        else if (phase === "answering") {
          if (focused === null) focused = firstLive(0, 1);
          else answer(focused);
        }
      }
    },
    advance: (seconds) => {
      let left = seconds;
      while (left > 1e-9) {
        const dt = Math.min(left, 1 / 30);
        step(dt);
        left -= dt;
      }
    },
    takeRequests: () => {
      const taken = requests;
      requests = [];
      return taken;
    },
    nextRound: () => {
      if (!roundOver) return;
      roundOver = false;
      completed = 0;
      number = 1;
      newChallenge();
    },
    configure: (changes) => {
      if (changes.niqqud !== undefined) current = { ...current, niqqud: changes.niqqud };
      const { difficulty } = changes;
      if (!isHedgehogDifficulty(difficulty) || difficulty === current.difficulty) return;
      current = { ...current, difficulty };
      // A change applies at once to a Challenge not yet started; a half-counted one is left alone.
      if (phase === "counting" && count === 0) newChallenge();
    },
  };
};
