import type { GameState } from "./contract";
import type { GameDefinition } from "./definition";
import { rabbitGame } from "./rabbit";

/**
 * Every built Game, by id. A Game listed here should also be `available`
 * in the Menu catalog (src/menus/catalog.ts), which gives it its route.
 */
// Each Game has its own state and Difficulty types; the Game Frame only
// relies on what they have in common.
const GAMES: Readonly<Record<string, GameDefinition<any, any>>> = {
  [rabbitGame.id]: rabbitGame,
};

export function findGameDefinition(id: string): GameDefinition<GameState, string> | undefined {
  return GAMES[id];
}
