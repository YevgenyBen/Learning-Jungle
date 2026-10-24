/**
 * The rabbit Game's rules: the rabbit runs across a meadow, letter tiles
 * float ahead of it, and the Player jumps to collect the letters of a Word
 * in order. No drawing, DOM or sound here (see ../contract.ts).
 *
 * The world is in logical pixels (WORLD), y grows downward, and the rabbit
 * stays at a fixed x while the world scrolls past it. Numbers are ported
 * from the single-page prototype (deleted; see docs/prototype-parity.md).
 */
import type { Letter, SpelledLetter, Word } from "@/content";
import type { CreateGameModel, GameModel, GameRequest, GameSettings, GameState } from "../contract";
import { between, pick } from "../random";
import { createWordBag } from "../wordBag";

export const WORLD = {
  width: 900,
  height: 360,
  /** y of the rabbit's feet when standing: the top of the grass. */
  ground: 290,
  /** The rabbit's fixed x. */
  rabbitX: 160,
} as const;

const GRAVITY = 2300; // px/s²
const JUMP_VELOCITY = -760; // px/s
/** Letting go early caps the upward speed at this: a short press is a small hop. */
const SHORT_HOP_VELOCITY = -330;
/** A press up to this long before landing still jumps on landing. */
const JUMP_BUFFER = 0.12; // s
const FULL_JUMP_AIRTIME = (2 * -JUMP_VELOCITY) / GRAVITY;

/** Tiles float this far above the ground: out of reach running, in reach of any jump. */
const TILE_HEIGHT = { min: 104, max: 112 };
/** The rabbit's body, from its feet up to its ear tips, and half its width. */
const REACH = { up: 95, down: 30, half: 32 };
/** A needed tile counts as still coming while it is less than this far behind the rabbit. */
const PENDING_BEHIND = 40;
const SPAWN_AHEAD = WORLD.width + 120;
const CULL_BEHIND = -50;
/** How long a collected tile stays in the state, so it can be drawn fading away. */
const COLLECTED_FADE = 1 / 3; // s
/** How long a landing stays in the state, so its puff of dust can be drawn settling. */
const LANDING_DUST = 0.5; // s

export const WORDS_PER_ROUND = 3;

/** After a Word is complete, this long passes with no tiles spawned or collected. */
export const CELEBRATION_PAUSE = 1.6; // s

/**
 * How long the latest Challenge Celebration stays in the state for drawing:
 * the sign and the dance last 1.8 s, the last confetti falls by 2.6 s.
 */
const CELEBRATION_SHOWN = 2.6; // s

/** After this many wrong letters in one Challenge, the Hint highlights the needed letter. */
const HINT_AFTER_MISTAKES = 2;

export const SPEEDS = { slow: 170, medium: 280, fast: 400 } as const; // px/s

/** Automatic speed rises this much after every WORDS_PER_SPEED_STEP completed Words, up to fast. */
const AUTO_SPEED_STEP = 30; // px/s
const WORDS_PER_SPEED_STEP = 2;
/** Automatic speed eases toward its target at most this fast. */
const AUTO_SPEED_EASING = 40; // px/s per second

export type RabbitDifficulty = "automatic" | keyof typeof SPEEDS;
const isRabbitDifficulty = (difficulty: string | undefined): difficulty is RabbitDifficulty =>
  difficulty === "automatic" || (difficulty !== undefined && Object.hasOwn(SPEEDS, difficulty));

export interface Tile {
  /** Unique within one model, for following a tile across snapshots. */
  readonly id: number;
  /** The bare letter, what the Player matches. */
  readonly letter: string;
  /**
   * The letter as the tile shows it: with Niqqud on, the needed letter with
   * its marks in the Word, and a decoy with the same vowel.
   */
  readonly marked: string;
  /** Centre of the tile. */
  readonly x: number;
  readonly y: number;
  /** Phase of the tile's gentle bob, for drawing. */
  readonly bob: number;
  readonly collected: boolean;
  /** Seconds since it was collected (0 if it wasn't). */
  readonly sinceCollected: number;
  /** Touched while it was not the needed letter: it stays where it is. */
  readonly rejected: boolean;
  /** Seconds since it was touched as a wrong letter (0 if it wasn't), for its gentle shake. */
  readonly sinceRejected: number;
}

/** A recent landing of the rabbit, for drawing its puff of dust. */
export interface Landing {
  /** Unique within one model, so each puff gets its own shape. */
  readonly id: number;
  /** Seconds since the rabbit landed. */
  readonly since: number;
}

/** The latest Challenge Celebration, for drawing its sign, dance and confetti. */
export interface CelebratedWord {
  readonly word: Word;
  /** The spelling the Word was built in. */
  readonly text: string;
  /** Which Word of the Round it was (1 for the first), so each Celebration differs. */
  readonly number: number;
  /** Seconds since the Word was completed. */
  readonly since: number;
  /** Where the rabbit's feet were when it completed the Word: the star burst starts there. */
  readonly rabbitY: number;
  /** Automatic speed is about to rise after this Celebration: the sign says so. */
  readonly speedRising: boolean;
}

export interface RabbitState extends GameState {
  /** Game time in seconds. */
  readonly time: number;
  /** How far the meadow has scrolled, in px. */
  readonly distance: number;
  /** Running speed, px/s. */
  readonly speed: number;
  readonly rabbit: {
    readonly x: number;
    /** y of the feet. */
    readonly y: number;
    readonly vy: number;
    readonly onGround: boolean;
    /** 1 right after landing, easing to 0: for the landing squash. */
    readonly squash: number;
  };
  readonly tiles: readonly Tile[];
  /** Landings in the last half second, oldest first. */
  readonly landings: readonly Landing[];
  /** The current Challenge: build this Word. */
  readonly challenge: {
    readonly word: Word;
    /** The spelling in use, as it is shown in the word bar. */
    readonly text: string;
    readonly letters: readonly SpelledLetter[];
    /** Index of the next needed letter: slots before it are filled. */
    readonly next: number;
  };
  /** Kept a little past the Celebration's pause, until it has been fully drawn. */
  readonly celebrated: CelebratedWord | null;
}

export type RabbitModel = GameModel<RabbitState>;

/** The model's own, changeable copy of a shape it hands out read-only. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type MutableTile = Mutable<Tile>;

export const createRabbitModel: CreateGameModel<RabbitState, RabbitDifficulty> = ({
  settings,
  content,
  random,
}) => {
  const decoys = content.letters().filter((l) => !l.final);
  /** The settings in force; configure() changes them on the running model. */
  let current: GameSettings<RabbitDifficulty> = { niqqud: settings.niqqud, difficulty: settings.difficulty };
  let speed: number = current.difficulty === "automatic" ? SPEEDS.slow : SPEEDS[current.difficulty];
  /** Words completed since the model was made: automatic speed follows these. */
  let wordsDone = 0;
  const autoSpeed = () =>
    Math.min(SPEEDS.fast, SPEEDS.slow + AUTO_SPEED_STEP * Math.floor(wordsDone / WORDS_PER_SPEED_STEP));
  const words = createWordBag(content.words(), random);

  let time = 0;
  let distance = 0;
  let spawnCursor = WORLD.width + 220;
  let nextTileId = 1;
  let tiles: MutableTile[] = [];
  const rabbit = { y: WORLD.ground, vy: 0, onGround: true, squash: 0 };
  let jumpBuffer = 0;
  let landings: { id: number; since: number }[] = [];
  let nextLandingId = 1;
  let completed = 0;
  /** Seconds left of the Challenge Celebration's pause; 0 when none is running. */
  let celebrating = 0;
  let roundOver = false;
  /** Wrong letters touched in the current Challenge. */
  let mistakes = 0;
  let celebrated: CelebratedWord | null = null;
  /** Letters come and can be collected only between Celebrations, while the Round lasts. */
  const playing = () => celebrating === 0 && !roundOver;
  let requests: GameRequest[] = [];

  let challenge: Mutable<RabbitState["challenge"]> = newChallenge();

  function newChallenge(): Mutable<RabbitState["challenge"]> {
    const word = words.next();
    const { text, letters } = content.spelling(word, current);
    return { word, text, letters, next: 0 };
  }
  function startChallenge(): void {
    challenge = newChallenge();
  }

  const emit = (request: GameRequest) => requests.push(request);
  const needed = () => challenge.letters[challenge.next];

  function spawn(): void {
    while (spawnCursor < SPAWN_AHEAD) {
      const slot = Math.min(280, Math.max(70, between(random, 0.32, 0.62) * speed * FULL_JUMP_AIRTIME));
      const gap = between(random, 1.0, 2.2) * speed * FULL_JUMP_AIRTIME + 90;
      maybeTile(spawnCursor + slot + gap / 2);
      spawnCursor += slot + gap;
    }
  }

  // At most one needed tile is ever ahead of the rabbit; once it has passed,
  // the next slot very likely brings it again. Other slots get a decoy or stay empty.
  function maybeTile(x: number): void {
    // Slots that come up during a Celebration or after the Round stay empty.
    if (!playing()) return;
    const need = needed();
    const pending = tiles.some((t) => !t.collected && t.letter === need.letter && t.x > WORLD.rabbitX - PENDING_BEHIND);
    const y = WORLD.ground - between(random, TILE_HEIGHT.min, TILE_HEIGHT.max);
    let letter: SpelledLetter | null = null;
    if (!pending && random() < 0.85) letter = need;
    else if (random() < 0.4) letter = pickDecoy(need);
    if (letter === null) return;
    tiles.push({
      id: nextTileId++,
      letter: letter.letter,
      marked: letter.marked,
      x,
      y,
      bob: between(random, 0, 6),
      collected: false,
      sinceCollected: 0,
      rejected: false,
      sinceRejected: 0,
    });
  }

  /** A random other letter, written with the needed letter's vowel. */
  function pickDecoy(need: SpelledLetter): SpelledLetter {
    let letter: Letter;
    do letter = pick(random, decoys);
    while (letter.letter === need.letter);
    return { letter: letter.letter, marked: pick(random, content.writtenLike(letter.letter, need.marked)) };
  }

  function touch(tile: MutableTile): void {
    if (tile.letter !== needed().letter) {
      // One gentle mistake per tile, however long the rabbit touches it.
      if (!tile.rejected) {
        mistakes++;
        emit({ kind: "sound", effect: "mistake" });
      }
      tile.rejected = true;
      return;
    }
    tile.collected = true;
    const letter = content.letter(tile.letter);
    if (letter) emit({ kind: "say", item: letter, interrupt: true });
    challenge.next++;
    if (challenge.next < challenge.letters.length) {
      emit({ kind: "sound", effect: "collect" });
      return;
    }
    completed++;
    wordsDone++;
    // The Challenge has ended, and its Hint with it.
    mistakes = 0;
    emit({ kind: "say", item: challenge.word, interrupt: false });
    emit({ kind: "sound", effect: "challenge-complete" });
    emit({ kind: "celebrate", celebration: "challenge" });
    celebrating = CELEBRATION_PAUSE;
    const speedRising = current.difficulty === "automatic" && autoSpeed() > speed + 1;
    celebrated = { word: challenge.word, text: challenge.text, number: completed, since: 0, rabbitY: rabbit.y, speedRising };
  }

  /** After a Word's Celebration: the next Word, or the end of the Round. */
  function endChallenge(): void {
    if (completed < WORDS_PER_ROUND) {
      startChallenge();
      return;
    }
    roundOver = true;
    emit({ kind: "celebrate", celebration: "round" });
    emit({ kind: "sound", effect: "round-complete" });
  }

  function step(dt: number): void {
    time += dt;
    if (celebrated) {
      celebrated = { ...celebrated, since: celebrated.since + dt };
      if (celebrated.since >= CELEBRATION_SHOWN) celebrated = null;
    }
    if (celebrating > 0) {
      celebrating = Math.max(0, celebrating - dt);
      if (celebrating === 0) endChallenge();
    }
    // Automatic speed changes only between Celebrations, easing toward its target.
    if (current.difficulty === "automatic" && playing()) {
      const target = autoSpeed();
      speed += Math.max(-AUTO_SPEED_EASING * dt, Math.min(AUTO_SPEED_EASING * dt, target - speed));
    }
    const dx = speed * dt;
    distance += dx;
    spawnCursor -= dx;
    for (const t of tiles) {
      t.x -= dx;
      t.bob += dt;
      if (t.collected) t.sinceCollected += dt;
      if (t.rejected) t.sinceRejected += dt;
    }
    tiles = tiles.filter((t) => t.x > CULL_BEHIND && !(t.collected && t.sinceCollected >= COLLECTED_FADE));
    spawn();

    for (const l of landings) l.since += dt;
    landings = landings.filter((l) => l.since < LANDING_DUST);

    jumpBuffer = Math.max(0, jumpBuffer - dt);
    if (jumpBuffer > 0 && rabbit.onGround) {
      rabbit.vy = JUMP_VELOCITY;
      rabbit.onGround = false;
      jumpBuffer = 0;
      emit({ kind: "sound", effect: "jump" });
    }
    if (!rabbit.onGround) {
      rabbit.vy += GRAVITY * dt;
      rabbit.y += rabbit.vy * dt;
      if (rabbit.vy > 0 && rabbit.y >= WORLD.ground) {
        rabbit.y = WORLD.ground;
        rabbit.vy = 0;
        rabbit.onGround = true;
        rabbit.squash = 1;
        landings.push({ id: nextLandingId++, since: 0 });
      }
    }
    rabbit.squash = Math.max(0, rabbit.squash - dt * 6);

    for (const t of tiles) {
      // Nothing is collected during a Celebration or after the Round.
      if (!playing()) break;
      if (t.collected) continue;
      const inReach =
        Math.abs(t.x - WORLD.rabbitX) < REACH.half &&
        t.y > rabbit.y - REACH.up &&
        t.y < rabbit.y + REACH.down;
      if (inReach) touch(t);
    }
  }

  return {
    state: () => ({
      progress: { completed, total: WORDS_PER_ROUND },
      hint: mistakes >= HINT_AFTER_MISTAKES,
      celebration: roundOver ? "round" : celebrating > 0 ? "challenge" : null,
      roundOver,
      time,
      distance,
      speed,
      rabbit: { x: WORLD.rabbitX, ...rabbit },
      tiles: tiles.map((t) => ({ ...t })),
      landings: landings.map((l) => ({ ...l })),
      challenge: { ...challenge },
      celebrated,
    }),
    act: (action) => {
      if (action.kind === "main-press") {
        jumpBuffer = JUMP_BUFFER;
      } else if (action.kind === "main-release") {
        if (!rabbit.onGround && rabbit.vy < SHORT_HOP_VELOCITY) rabbit.vy = SHORT_HOP_VELOCITY;
      }
    },
    advance: (seconds) => {
      // Small fixed-size steps keep jumps and collisions the same at any frame rate.
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
      // A fresh meadow and the next Word; speed and the Word bag carry on.
      roundOver = false;
      completed = 0;
      mistakes = 0;
      celebrated = null;
      tiles = [];
      spawnCursor = WORLD.width + 220;
      jumpBuffer = 0;
      startChallenge();
    },
    configure: (changes) => {
      if (changes.niqqud !== undefined) current = { ...current, niqqud: changes.niqqud };
      const { difficulty } = changes;
      if (!isRabbitDifficulty(difficulty) || difficulty === current.difficulty) return;
      current = { ...current, difficulty };
      // A change applies at once: a fixed speed, or what the Words have earned for automatic.
      // Only automatic's own step-ups after a Celebration ease in.
      speed = difficulty === "automatic" ? autoSpeed() : SPEEDS[difficulty];
    },
  };
};
