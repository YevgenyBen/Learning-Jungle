import type { GameState } from "./contract";
import type { GameDefinition } from "./definition";
import { rabbitGame } from "./rabbit";

/**
 * Every built Game, in the order its Subject's Menu shows them. Adding a
 * Game is one entry here: the Menu catalog (src/menus/catalog.ts) offers it
 * in its Subject's Menu and it opens at /games/<id>.
 */
// Each Game has its own state and Difficulty types; the app only relies on
// what they have in common.
const GAMES: readonly GameDefinition<any, any>[] = [rabbitGame];

export function registeredGames(): readonly GameDefinition<GameState, string>[] {
  return GAMES;
}

export function findGameDefinition(id: string): GameDefinition<GameState, string> | undefined {
  return GAMES.find((game) => game.id === id);
}
