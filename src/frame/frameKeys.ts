"use client";

import { useEffect, useRef } from "react";
import { hasModifierKey } from "@/menus/focus";

/** The shared main-action key; a Game may add its own (GameDefinition.mainActionKeys). */
const MAIN_ACTION_KEYS = ["Space"];

export interface FrameKeyHandlers {
  /** The main action went down (true) or up (false). */
  main(down: boolean): void;
  move(direction: "next" | "previous"): void;
  togglePause(): void;
  restart(): void;
  toggleMute(): void;
  toggleNiqqud(): void;
  /** Moves on to the next Difficulty option. */
  nextDifficulty(): void;
}

/** What every other Frame key does (KeyboardEvent.code -> action), on its way down. */
const KEY_ACTIONS: ReadonlyMap<string, (on: FrameKeyHandlers) => void> = new Map([
  // Moving between Choices. Hebrew reads right to left, so left is "next".
  ["ArrowLeft", (on) => on.move("next")],
  ["ArrowRight", (on) => on.move("previous")],
  ["Escape", (on) => on.togglePause()],
  ["KeyP", (on) => on.togglePause()],
  ["Enter", (on) => on.restart()],
  ["NumpadEnter", (on) => on.restart()],
  ["KeyM", (on) => on.toggleMute()],
  ["KeyN", (on) => on.toggleNiqqud()],
  ["KeyD", (on) => on.nextDifficulty()],
]);

/**
 * The shared key layout of every Game: Space (and the Game's own extra
 * keys) is the main action, left and right arrows move between Choices,
 * Esc or P pauses, Enter restarts, M mutes, N switches Niqqud on or off
 * and D moves on to the next Difficulty. Keys the Frame uses never also
 * press a focused control or scroll the page.
 */
export function useFrameKeys(handlers: FrameKeyHandlers, gameMainKeys: readonly string[] = []): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  const extraKeys = gameMainKeys.join(" ");

  useEffect(() => {
    const mainKeys = new Set([...MAIN_ACTION_KEYS, ...extraKeys.split(" ").filter(Boolean)]);
    const onKey = (event: KeyboardEvent) => {
      if (hasModifierKey(event)) return;
      const { code } = event;
      const down = event.type === "keydown";
      const on = latest.current;
      if (mainKeys.has(code)) {
        event.preventDefault();
        if (!event.repeat) on.main(down);
        return;
      }
      const action = KEY_ACTIONS.get(code);
      if (!action) return;
      event.preventDefault();
      if (down && !event.repeat) action(on);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [extraKeys]);
}
