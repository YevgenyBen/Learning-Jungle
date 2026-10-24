/**
 * The first-letter Game's rules: a cat sits on top of something tall (a
 * tree, a pole or a building). Ahead of it, leftward in Hebrew's reading
 * direction, stand a few more, each with a letter sign: the Choices. A
 * Word's Picture is shown, never its spelling, and the Player picks the
 * Choice whose letter starts the Word. The cat jumps onto it, its perch
 * slides back to where the cat started, and the next Word comes. No
 * drawing, DOM or sound here (see ../contract.ts).
 *
 * The scene is in logical pixels (SCENE) and y grows downward. The scene
 * itself never scrolls: perches slide, sink into the ground and rise.
 */
import type { Letter, Word } from "@/content";
import type { CreateGameModel, GameModel, GameRequest, GameSettings, GameState } from "../contract";
import { between, pick, shuffled, type Random } from "../random";
import { createWordBag } from "../wordBag";

export const SCENE = {
  width: 900,
  height: 360,
  /** y of the ground, where every perch stands. */
  ground: 320,
  /** x of the cat's own perch while the Player chooses. */
  homeX: 790,
} as const;

/** The Choices stand around this x, at most CHOICE_SPACING apart. */
const CHOICES_CENTRE_X = 380;
const CHOICES_SPAN = 530;
const CHOICE_SPACING = 190;
/** How far a Choice may stand from its even spot, so a row never looks ruled. */
const CHOICE_JITTER = 14;
/** Perch tops, where the cat sits: always well below the top of the scene. */
const PERCH_TOP = { min: 115, max: 215 };
const HOME_TOP = 170;

/** The cat's jump from its perch onto the chosen one. */
export const JUMP_SECONDS = 0.75;
/** How far above the higher of the two perches the jump's arc rises. */
const JUMP_ARC = 90;
/** After the cat has landed on the right Choice, this long passes before the scene moves on. */
export const CELEBRATION_PAUSE = 1.6; // s
/** How long the latest Challenge Celebration stays in the state for drawing (sign, confetti). */
const CELEBRATION_SHOWN = 2.2; // s
/** The chosen perch slides home, the others sink and new Choices rise, in this long. */
export const MOVE_SECONDS = 1.1;
/** Parts of the move: the old Choices sink in its first part, the new ones rise in its last. */
const SINK_UNTIL = 0.4;
const RISE_FROM = 0.6;
/** How long the cat looks puzzled after a wrong Choice. */
const DOUBT_SECONDS = 0.7;

export const CHALLENGES_PER_ROUND = 5;

/** After this many wrong Choices in one Challenge, the Hint highlights the right one. */
const HINT_AFTER_MISTAKES = 2;

export const CHOICE_COUNTS = { two: 2, three: 3, four: 4 } as const;
/** Automatic starts with the fewest Choices and adds one after every few first-try answers. */
const FIRST_TRIES_PER_STEP = 2;

export type CatDifficulty = "automatic" | keyof typeof CHOICE_COUNTS;
const isCatDifficulty = (difficulty: string | undefined): difficulty is CatDifficulty =>
  difficulty === "automatic" || (difficulty !== undefined && Object.hasOwn(CHOICE_COUNTS, difficulty));

/**
 * Letters that start Words with the same (or, for a beginner, nearly the
 * same) sound. A decoy never sounds like the right letter, so hearing the
 * Word is always enough to tell them apart.
 */
const SOUND_ALIKE: readonly (readonly string[])[] = [
  ["א", "ע"],
  ["ב", "ו"],
  ["כ", "ק", "ח"],
  ["ט", "ת"],
  ["ס", "ש"],
];
const soundsAlike = (a: string, b: string) => a === b || SOUND_ALIKE.some((group) => group.includes(a) && group.includes(b));

export type PerchKind = "tree" | "pole" | "building";
const KINDS: readonly PerchKind[] = ["tree", "pole", "building"];

/** A letter sign on a perch: one Choice. */
export interface Sign {
  /** The bare letter. */
  readonly letter: string;
  /** Picked while it was not the right letter: it stays, greyed. */
  readonly rejected: boolean;
  /** Seconds since it was picked as a wrong letter (0 if it wasn't), for its gentle shake. */
  readonly sinceRejected: number;
}

/** Something tall the cat can sit on. */
export interface Perch {
  /** Unique within one model, for following a perch across snapshots. */
  readonly id: number;
  readonly kind: PerchKind;
  /** x of its middle. */
  readonly x: number;
  /** y of its top, where the cat sits. */
  readonly top: number;
  /** 1 standing, 0 sunk into the ground: perches sink and rise between Challenges. */
  readonly rise: number;
  /** A fixed number in [0, 1) for its colours and details, so it looks the same every frame. */
  readonly look: number;
  /** Its letter sign, if it is one of the current Challenge's Choices. */
  readonly sign: Sign | null;
}

/**
 * - choosing: the Player picks a Choice.
 * - jumping: the cat is in the air on its way to the right Choice.
 * - celebrating: the cat has landed; the Challenge Celebration runs (and after the last, the Round is over).
 * - moving: the cat's new perch slides home and the next Challenge's Choices rise.
 */
export type CatPhase = "choosing" | "jumping" | "celebrating" | "moving";

/** The latest Challenge Celebration, for drawing its sign and confetti. */
export interface CelebratedWord {
  readonly word: Word;
  /** The Word's spelling, and its first letter with that letter's marks. */
  readonly text: string;
  readonly first: string;
  /** Which Challenge of the Round it was (1 for the first), so each Celebration differs. */
  readonly number: number;
  /** Seconds since the cat landed. */
  readonly since: number;
}

export interface CatState extends GameState {
  /** Game time in seconds. */
  readonly time: number;
  /** How far the cat has travelled, in px: the background drifts with it. */
  readonly distance: number;
  readonly phase: CatPhase;
  readonly perches: readonly Perch[];
  /** The ids of the perches with a sign, in reading order (rightmost first): `pick` counts in this order. */
  readonly choices: readonly number[];
  /** Index into `choices` the keyboard has highlighted, or null before the arrows or Space are used. */
  readonly focused: number | null;
  readonly cat: {
    readonly x: number;
    /** y of its feet. */
    readonly y: number;
    readonly airborne: boolean;
    /** Seconds left of its puzzled look after a wrong Choice. */
    readonly doubt: number;
  };
  /** The current Challenge: pick the letter this Word starts with. */
  readonly challenge: {
    readonly word: Word;
    /** The bare first letter: the right Choice's letter. */
    readonly letter: string;
  };
  /** Kept a little past the Celebration's pause, until it has been fully drawn. */
  readonly celebrated: CelebratedWord | null;
}

export type CatModel = GameModel<CatState>;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type MutablePerch = Mutable<Omit<Perch, "sign">> & { sign: Mutable<Sign> | null };

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export const createCatModel: CreateGameModel<CatState, CatDifficulty> = ({ settings, content, random }) => {
  const decoys = content.letters().filter((l) => !l.final);
  let current: GameSettings<CatDifficulty> = { niqqud: settings.niqqud, difficulty: settings.difficulty };
  /** Challenges answered right on the first try since the model was made: automatic follows these. */
  let firstTries = 0;
  const choiceCount = () =>
    current.difficulty === "automatic"
      ? Math.min(CHOICE_COUNTS.four, CHOICE_COUNTS.two + Math.floor(firstTries / FIRST_TRIES_PER_STEP))
      : CHOICE_COUNTS[current.difficulty];
  const words = createWordBag(content.words(), random);

  let time = 0;
  let distance = 0;
  let nextPerchId = 1;
  let phase: CatPhase = "choosing";
  /** Seconds since the current phase began. */
  let inPhase = 0;
  let completed = 0;
  let roundOver = false;
  let mistakes = 0;
  let focused: number | null = null;
  let doubt = 0;
  let celebrated: CelebratedWord | null = null;
  let requests: GameRequest[] = [];
  const emit = (request: GameRequest) => requests.push(request);

  let home: MutablePerch = newPerch("tree", SCENE.homeX, HOME_TOP, 1);
  /** The perch the cat is jumping to or has landed on. */
  let target: MutablePerch | null = null;
  /** Where the target stood when the move began, and perches on their way out. */
  let moveFrom = 0;
  let leaving: MutablePerch[] = [];
  let challenge = newChallenge();
  let choicePerches: MutablePerch[] = newChoices(1);
  emit({ kind: "say", item: challenge.word, interrupt: false });

  function newPerch(kind: PerchKind, x: number, top: number, rise: number): MutablePerch {
    return { id: nextPerchId++, kind, x, top, rise, look: random(), sign: null };
  }

  function newChallenge(): CatState["challenge"] {
    const word = words.next();
    // Both spellings start with the same letter; the plain one has no marks to strip.
    return { word, letter: content.spelling(word, { niqqud: false }).letters[0].letter };
  }

  /** The Challenge's Choices, in reading order: the right letter once, at a random place. */
  function newChoices(rise: number): MutablePerch[] {
    const count = choiceCount();
    const letters = shuffled(random, [challenge.letter, ...pickDecoys(challenge.letter, count - 1)]);
    const step = Math.min(CHOICE_SPACING, CHOICES_SPAN / Math.max(1, count - 1));
    const first = CHOICES_CENTRE_X + (step * (count - 1)) / 2;
    return letters.map((letter, i) => {
      const x = first - i * step + between(random, -CHOICE_JITTER, CHOICE_JITTER);
      const perch = newPerch(pick(random, KINDS), x, between(random, PERCH_TOP.min, PERCH_TOP.max), rise);
      perch.sign = { letter, rejected: false, sinceRejected: 0 };
      return perch;
    });
  }

  function pickDecoys(right: string, count: number): string[] {
    const chosen: string[] = [];
    const usable = (l: Letter) => !soundsAlike(l.letter, right) && !chosen.includes(l.letter);
    const pool = () => decoys.filter(usable);
    while (chosen.length < count && pool().length > 0) chosen.push(pick(random, pool()).letter);
    return chosen;
  }

  const live = (index: number) => {
    const sign = choicePerches[index]?.sign;
    return sign !== undefined && sign !== null && !sign.rejected;
  };

  function choose(index: number): void {
    if (phase !== "choosing") return;
    const perch = choicePerches[index];
    if (!perch?.sign || perch.sign.rejected) return;
    if (perch.sign.letter !== challenge.letter) {
      perch.sign.rejected = true;
      mistakes++;
      doubt = DOUBT_SECONDS;
      emit({ kind: "sound", effect: "mistake" });
      // The highlight moves off a sign that can no longer be picked.
      if (focused === index) focused = nearestLive(index);
      return;
    }
    target = perch;
    focused = null;
    begin("jumping");
    emit({ kind: "sound", effect: "jump" });
  }

  /** The live Choice nearest to `index`, looking in reading order first. */
  function nearestLive(index: number): number | null {
    for (let d = 1; d < choicePerches.length; d++) {
      if (live(index + d)) return index + d;
      if (live(index - d)) return index - d;
    }
    return null;
  }

  function move(direction: "next" | "previous"): void {
    if (phase !== "choosing") return;
    const by = direction === "next" ? 1 : -1;
    if (focused === null) {
      focused = firstLive(direction === "next" ? 0 : choicePerches.length - 1, by);
      return;
    }
    for (let i = focused + by; i >= 0 && i < choicePerches.length; i += by) {
      if (live(i)) {
        focused = i;
        return;
      }
    }
  }

  function firstLive(from: number, by: number): number | null {
    for (let i = from; i >= 0 && i < choicePerches.length; i += by) if (live(i)) return i;
    return null;
  }

  function begin(next: CatPhase): void {
    phase = next;
    inPhase = 0;
  }

  function land(): void {
    completed++;
    if (mistakes === 0) firstTries++;
    // The Challenge has ended, and its Hint with it.
    mistakes = 0;
    doubt = 0;
    begin("celebrating");
    const letter = content.letter(challenge.letter);
    if (letter) emit({ kind: "say", item: letter, interrupt: true });
    emit({ kind: "say", item: challenge.word, interrupt: false });
    emit({ kind: "sound", effect: "challenge-complete" });
    emit({ kind: "celebrate", celebration: "challenge" });
    const { text, letters } = content.spelling(challenge.word, current);
    celebrated = { word: challenge.word, text, first: letters[0].marked, number: completed, since: 0 };
  }

  /** After a Challenge's Celebration: the next Challenge, or the end of the Round. */
  function endCelebration(): void {
    if (completed < CHALLENGES_PER_ROUND) {
      startMove();
      return;
    }
    roundOver = true;
    emit({ kind: "celebrate", celebration: "round" });
    emit({ kind: "sound", effect: "round-complete" });
  }

  /** The cat's perch slides home, the other perches leave and the next Challenge's Choices rise. */
  function startMove(): void {
    const perch = target ?? home;
    leaving = [home, ...choicePerches].filter((p) => p !== perch);
    perch.sign = null;
    home = perch;
    target = null;
    moveFrom = perch.x;
    challenge = newChallenge();
    choicePerches = newChoices(0);
    focused = null;
    begin("moving");
  }

  function stepMove(): void {
    const t = clamp01(inPhase / MOVE_SECONDS);
    const x = moveFrom + (SCENE.homeX - moveFrom) * easeOut(t);
    const dx = x - home.x;
    home.x = x;
    distance += dx;
    for (const p of leaving) {
      // The cat's old perch slides away with the scene; the unpicked Choices sink.
      if (p.sign) p.rise = 1 - clamp01(t / SINK_UNTIL);
      else p.x += dx;
    }
    for (const p of choicePerches) p.rise = clamp01((t - RISE_FROM) / (1 - RISE_FROM));
    if (t < 1) return;
    leaving = [];
    begin("choosing");
    emit({ kind: "say", item: challenge.word, interrupt: true });
  }

  function step(dt: number): void {
    time += dt;
    inPhase += dt;
    doubt = Math.max(0, doubt - dt);
    if (celebrated) {
      celebrated = { ...celebrated, since: celebrated.since + dt };
      if (celebrated.since >= CELEBRATION_SHOWN) celebrated = null;
    }
    for (const p of choicePerches) if (p.sign?.rejected) p.sign.sinceRejected += dt;
    if (phase === "jumping" && inPhase >= JUMP_SECONDS) land();
    else if (phase === "celebrating" && !roundOver && inPhase >= CELEBRATION_PAUSE) endCelebration();
    else if (phase === "moving") stepMove();
  }

  function catPosition(): { x: number; y: number } {
    if (phase !== "jumping" || !target) {
      const perch = target ?? home;
      return { x: perch.x, y: perch.top };
    }
    const t = clamp01(inPhase / JUMP_SECONDS);
    // A parabola through both perch tops, rising about JUMP_ARC above the higher one.
    const arc = JUMP_ARC + Math.abs(target.top - home.top) / 2;
    const y = home.top + (target.top - home.top) * t - 4 * arc * t * (1 - t);
    return { x: home.x + (target.x - home.x) * t, y };
  }

  const copy = (p: MutablePerch): Perch => ({ ...p, sign: p.sign && { ...p.sign } });

  return {
    state: () => ({
      progress: { completed, total: CHALLENGES_PER_ROUND },
      hint: mistakes >= HINT_AFTER_MISTAKES,
      celebration: roundOver ? "round" : phase === "celebrating" ? "challenge" : null,
      roundOver,
      time,
      distance,
      phase,
      perches: [...leaving, home, ...choicePerches].map(copy),
      choices: choicePerches.map((p) => p.id),
      focused,
      cat: { ...catPosition(), airborne: phase === "jumping", doubt },
      challenge: { ...challenge },
      celebrated,
    }),
    act: (action) => {
      if (action.kind === "pick") choose(action.choice);
      else if (action.kind === "move") move(action.direction);
      else if (action.kind === "main-press" && phase === "choosing") {
        // Space jumps to the highlighted Choice; the first press only highlights one.
        if (focused === null) focused = firstLive(0, 1);
        else choose(focused);
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
      // The cat carries on from where it is; how many Choices automatic gives carries on too.
      roundOver = false;
      completed = 0;
      mistakes = 0;
      celebrated = null;
      startMove();
    },
    configure: (changes) => {
      if (changes.niqqud !== undefined) current = { ...current, niqqud: changes.niqqud };
      const { difficulty } = changes;
      if (!isCatDifficulty(difficulty) || difficulty === current.difficulty) return;
      current = { ...current, difficulty };
      // A change applies at once: while the Player chooses, the same Word gets the new number of Choices.
      if (phase !== "choosing") return;
      choicePerches = newChoices(1);
      focused = null;
    },
  };
};
