/**
 * The dev/test-only hook that lets Playwright see and drive the running
 * Game. The Game Frame installs it on `window.__learningJungleGame` in
 * development and test builds; it never exists in a production build
 * (`npm run test:build` checks the exported files).
 */
import type { GameRequest, GameState, PlayerAction, SoundEffect } from "@/games/contract";
import type { Said } from "@/voice/voicePlayer";

export interface GameTestHook<S extends GameState = GameState> {
  /** The running Game's id, e.g. "rabbit". */
  readonly gameId: string;
  /** A snapshot of the model's state. */
  state(): S;
  /** Every request the model has emitted since the Game started, oldest first. */
  requests(): GameRequest[];
  /** Whether the Game Frame is paused (time stands still). */
  paused(): boolean;
  /** Whether the Game Frame is muted. */
  muted(): boolean;
  /** The Sound Effects played out loud (not silenced by mute) since the Game opened, oldest first. */
  soundsPlayed(): SoundEffect[];
  /**
   * What the voice player said out loud (not cut off, not silenced by mute),
   * oldest first: each item's id and whether its Voice Clip or Speech
   * Fallback said it.
   */
  voiceSaid(): Said[];
  /** Feeds the model a Player action, exactly as a key or tap would. */
  act(action: PlayerAction): void;
  /** Lets this much game time pass at once, on top of the real-time loop. */
  advance(seconds: number): void;
  /** Makes one correct move in the current Challenge through actions and time. */
  solveStep(): void;
  /** Solves steps until the current Challenge is complete. */
  completeChallenge(): void;
}

declare global {
  interface Window {
    __learningJungleGame?: GameTestHook;
  }
}

/** Installs the hook (dev and test builds only) and returns its removal. */
export function installTestHook(hook: GameTestHook): () => void {
  if (process.env.NODE_ENV === "production") return () => {};
  window.__learningJungleGame = hook;
  return () => {
    if (window.__learningJungleGame === hook) delete window.__learningJungleGame;
  };
}
