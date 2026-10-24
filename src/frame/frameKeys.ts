"use client";

import { useEffect, useRef } from "react";

/** The shared main-action key; a Game may add its own (GameDefinition.mainActionKeys). */
const MAIN_ACTION_KEYS = ["Space"];
const PAUSE_KEYS = ["Escape", "KeyP"];
const RESTART_KEYS = ["Enter", "NumpadEnter"];
const MUTE_KEYS = ["KeyM"];
/** Moving between Choices. Hebrew reads right to left, so left is "next". */
const MOVE_KEYS: Record<string, "next" | "previous"> = { ArrowLeft: "next", ArrowRight: "previous" };

export interface FrameKeyHandlers {
  /** The main action went down (true) or up (false). */
  main(down: boolean): void;
  move(direction: "next" | "previous"): void;
  togglePause(): void;
  restart(): void;
  toggleMute(): void;
}

/**
 * The shared key layout of every Game: Space (and the Game's own extra
 * keys) is the main action, left and right arrows move between Choices,
 * Esc or P pauses, Enter restarts, M mutes. Keys the Frame uses never also
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
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const { code } = event;
      const down = event.type === "keydown";
      const on = latest.current;
      if (mainKeys.has(code)) {
        event.preventDefault();
        if (!event.repeat) on.main(down);
        return;
      }
      const direction = MOVE_KEYS[code];
      const known = direction || PAUSE_KEYS.includes(code) || RESTART_KEYS.includes(code) || MUTE_KEYS.includes(code);
      if (!known) return;
      event.preventDefault();
      if (!down || event.repeat) return;
      if (direction) on.move(direction);
      else if (PAUSE_KEYS.includes(code)) on.togglePause();
      else if (RESTART_KEYS.includes(code)) on.restart();
      else on.toggleMute();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [extraKeys]);
}
