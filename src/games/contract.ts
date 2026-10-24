/**
 * The Game Model contract, shared by every Game.
 *
 * A Game's rules live in a model with no drawing, DOM or sound in it. The
 * Game Frame creates the model, feeds it Player actions and the passage of
 * time, draws its state, and carries out the requests it emits.
 *
 *   created from   settings + Content Bank + random source
 *   driven by      act(PlayerAction), advance(seconds)
 *   exposes        state()            for drawing and for the test hook
 *   emits          takeRequests()     say / sound / celebrate
 *   changed by     configure(settings), nextRound()
 *
 * Pause is the Game Frame not calling advance(). Restart is creating a
 * fresh model with the same settings. "Another Round" is nextRound() on
 * the same model, so what the Game adjusted to the Player carries on.
 */
import type { ContentBank, SpokenItem } from "@/content";
import type { Random } from "./random";

/**
 * The shared vocabulary of Player actions. The Game Frame turns keys,
 * taps and clicks into these; a Game ignores the ones it has no use for.
 */
export type PlayerAction =
  /** The main action (Space, a tap or click on the play area) went down. */
  | { readonly kind: "main-press" }
  /** The main action was let go. */
  | { readonly kind: "main-release" }
  /** Move between Choices; "next" is the reading direction (leftward in Hebrew). */
  | { readonly kind: "move"; readonly direction: "next" | "previous" }
  /** Pick a Choice, by its index in the current Challenge's Choices. */
  | { readonly kind: "pick"; readonly choice: number };

/** The named Sound Effects. The Sound Effects module decides how each sounds. */
export type SoundEffect = "jump" | "collect" | "mistake" | "challenge-complete" | "round-complete";

export type CelebrationKind = "challenge" | "round";

/** What a model asks the Game Frame to do. The model never waits for any of it. */
export type GameRequest =
  /**
   * Say an item aloud (its Voice Clip, else Speech Fallback, else nothing).
   * `interrupt` stops whatever is being said; otherwise it queues behind it.
   */
  | { readonly kind: "say"; readonly item: SpokenItem; readonly interrupt: boolean }
  | { readonly kind: "sound"; readonly effect: SoundEffect }
  | { readonly kind: "celebrate"; readonly celebration: CelebrationKind };

/** Settings every Game is created with. `D` is the Game's own Difficulty options. */
export interface GameSettings<D extends string = string> {
  /** Show Niqqud (Voweled Spelling) or not (Plain Spelling). */
  readonly niqqud: boolean;
  /** One of the Game's Difficulty options, "automatic" by default. */
  readonly difficulty: D;
}

/** What every Game's state has, whatever else it holds for drawing. */
export interface GameState {
  /** Challenges completed in this Round, out of how many the Round has. */
  readonly progress: { readonly completed: number; readonly total: number };
  /** Whether a Hint is showing for the current Challenge. */
  readonly hint: boolean;
  /** The Celebration running now, if any. */
  readonly celebration: CelebrationKind | null;
  /** Whether the Round has ended. */
  readonly roundOver: boolean;
}

export interface GameModel<S extends GameState = GameState> {
  /** A snapshot of the current state. Plain data: safe to keep, compare or serialise. */
  state(): S;
  act(action: PlayerAction): void;
  /** Let time pass. The Game Frame calls this every frame with a small step. */
  advance(seconds: number): void;
  /** The requests emitted since the last call, oldest first. */
  takeRequests(): GameRequest[];
  /**
   * Starts another Round on this model once the Round is over. What the
   * Game has learnt about the Player (the rabbit's automatic speed) carries
   * on, and so do the Words already shown. A restart makes a fresh model
   * instead, which carries nothing on.
   */
  nextRound(): void;
  /**
   * Changes settings on the running model: Difficulty applies at once,
   * Niqqud from the next Challenge.
   */
  configure(settings: Partial<GameSettings>): void;
}

export interface GameModelDeps<D extends string = string> {
  readonly settings: GameSettings<D>;
  readonly content: ContentBank;
  /** Injected so tests can seed it; the app passes Math.random. */
  readonly random: Random;
}

export type CreateGameModel<S extends GameState = GameState, D extends string = string> = (
  deps: GameModelDeps<D>,
) => GameModel<S>;
