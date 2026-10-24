/**
 * What a Game hands the Game Frame. A Game provides its model, its drawing
 * and its Difficulty options; the Game Frame does the rest (controls, keys,
 * the loop, requests, preferences).
 */
import type { ComponentType } from "react";
import type { Frames } from "@/frame/frames";
import type { CreateGameModel, GameModel, GameState } from "./contract";

export interface GameViewProps<S extends GameState> {
  /**
   * The model's state, a new snapshot every frame. Draw a canvas from
   * `frames.subscribe`; show DOM parts with `useFrameSelector`.
   */
  readonly frames: Frames<S>;
}

/**
 * Plays a Game the way a Player would, through actions and time only, for
 * the dev/test hook. Never used by the app itself.
 */
export interface TestDriver<S extends GameState> {
  /**
   * Makes one correct move in the current Challenge (the rabbit: collects
   * the next needed letter), advancing the model's time as needed.
   */
  solveStep(model: GameModel<S>): void;
}

export interface GameDefinition<S extends GameState = GameState, D extends string = string> {
  /** Same id as the Game's catalog entry and route (/games/<id>). */
  readonly id: string;
  readonly createModel: CreateGameModel<S, D>;
  /** The Game's Difficulty options; the first is the default ("automatic"). */
  readonly difficulties: readonly D[];
  /** Draws the state. Pointer input on it is handled by the Game Frame. */
  readonly View: ComponentType<GameViewProps<S>>;
  /**
   * Extra keys (KeyboardEvent.code) that also do the main action, on top
   * of the shared Space. The rabbit adds ArrowUp and KeyW.
   */
  readonly mainActionKeys?: readonly string[];
  readonly testDriver?: TestDriver<S>;
}
