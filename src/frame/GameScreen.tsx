"use client";

import { findGameDefinition } from "@/games/registry";
import { GameFrame } from "./GameFrame";

/** A Game's screen: its definition, looked up on the client, inside the Game Frame. */
export function GameScreen({ gameId, name, backHref }: { gameId: string; name: string; backHref: string }) {
  const game = findGameDefinition(gameId);
  if (!game) throw new Error(`No Game definition for "${gameId}"`);
  return <GameFrame game={game} name={name} backHref={backHref} />;
}
