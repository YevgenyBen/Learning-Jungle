/**
 * What a Game hands the app. A Game provides its model, its drawing, its
 * Difficulty options and its Menu icon; the Menus and the Game Frame do the
 * rest (the Menu entry and route, controls, keys, the loop, requests,
 * preferences). Adding a Game is one entry in ./registry.ts.
 */
import type { ComponentType } from "react";
import type { Frames } from "@/frame/frames";
import type { SubjectId } from "@/menus/catalog";
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

/** How the Game Frame's Difficulty control names the Game's Difficulty and each option. */
export interface DifficultyControl<D extends string> {
  /** What Difficulty is in this Game, e.g. "מהירות" (speed) for the rabbit. */
  readonly label: string;
  /** Each option's name, and an icon that stands for it where labels are hidden. */
  readonly options: Readonly<Record<D, { readonly name: string; readonly icon: string }>>;
}

export interface GameDefinition<S extends GameState = GameState, D extends string = string> {
  /** Stable identity, also the Game's route segment: /games/<id>. */
  readonly id: string;
  /** Hebrew name, shown under the Menu icon and read by screen readers. */
  readonly name: string;
  /** The Game's Menu icon: what is drawn inside its big Menu button. */
  readonly icon: string;
  /** The Subject whose Menu offers the Game. */
  readonly subject: SubjectId;
  readonly createModel: CreateGameModel<S, D>;
  /** The Game's Difficulty options; the first is the default ("automatic"). */
  readonly difficulties: readonly D[];
  readonly difficultyControl: DifficultyControl<D>;
  /** Draws the state. Pointer input on it is handled by the Game Frame. */
  readonly View: ComponentType<GameViewProps<S>>;
  /**
   * Extra keys (KeyboardEvent.code) that also do the main action, on top
   * of the shared Space. The rabbit adds ArrowUp and KeyW.
   */
  readonly mainActionKeys?: readonly string[];
  readonly testDriver?: TestDriver<S>;
}
