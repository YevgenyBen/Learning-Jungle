"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { GameState } from "@/games/contract";
import { moveFocus } from "@/menus/focus";
import type { Frames } from "./frames";
import styles from "./RoundCelebration.module.css";

/**
 * Whether the running Game's Round is over, so the Game Frame can show the
 * Round Celebration screen. Re-renders only when that changes.
 */
export function useRoundOver(frames: Frames<GameState> | undefined): boolean {
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!frames) return;
    let last = frames.current().roundOver;
    setOver(last);
    return frames.subscribe((state) => {
      if (state.roundOver === last) return;
      last = state.roundOver;
      setOver(last);
    });
  }, [frames]);
  return over;
}

export interface RoundCelebrationProps {
  /** Starts a new Round of the same Game. */
  readonly onAnotherRound: () => void;
  /** Goes back to the Game's Subject Menu. */
  readonly onBack: () => void;
}

type ChoiceId = "another-round" | "back";
/** One row, in reading order: right to left, "another Round" first. */
const LAYOUT = [["another-round", "back"]] as const;
/** Keys that pick the focused choice, when they are let go. */
const PICK_KEYS = new Set(["Enter", "NumpadEnter", "Space"]);

/**
 * The Game Frame's Round Celebration screen, shown over any Game whose
 * Round is over: a big "well done" and two big choices, another Round or
 * back to the Menu. Works by touch, mouse, and arrow keys plus Enter.
 *
 * It handles its own keys (arrows, Enter, Space) and keeps them from the
 * Game Frame's key handlers, so a key meant for a choice never also reaches
 * the Game behind it. The Game Frame also stands down its own Enter
 * (restart) and main action while this screen shows.
 */
export function RoundCelebration({ onAnotherRound, onBack }: RoundCelebrationProps) {
  const buttons = useRef(new Map<ChoiceId, HTMLButtonElement>());
  /** The key that went down here and picks a choice when it comes up. */
  const armed = useRef<string | null>(null);
  const register = (id: ChoiceId) => (element: HTMLButtonElement | null) => {
    if (element) buttons.current.set(id, element);
    else buttons.current.delete(id);
  };
  const actions: Record<ChoiceId, () => void> = { "another-round": onAnotherRound, back: onBack };

  // A keyboard Player can press Enter straight away.
  useEffect(() => {
    buttons.current.get("another-round")?.focus({ preventScroll: true });
  }, []);

  const focusedChoice = (): ChoiceId | null =>
    [...buttons.current].find(([, element]) => element === document.activeElement)?.[0] ?? null;

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (PICK_KEYS.has(event.code)) {
      // The choice is picked when the key comes up, so the rest of the press
      // can't reach the next screen.
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) armed.current = event.code;
      return;
    }
    const next = moveFocus(LAYOUT, focusedChoice(), event.key) as ChoiceId | null;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    buttons.current.get(next)?.focus({ preventScroll: true });
  };

  const onKeyUp = (event: ReactKeyboardEvent) => {
    if (!PICK_KEYS.has(event.code) && moveFocus(LAYOUT, null, event.key) === null) return;
    event.stopPropagation();
    if (event.code !== armed.current) return;
    event.preventDefault();
    armed.current = null;
    actions[focusedChoice() ?? "another-round"]();
  };

  return (
    <div
      className={styles.screen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="round-celebration-title"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      data-testid="round-celebration"
    >
      <div className={styles.card}>
        <div className={styles.stars} aria-hidden="true">
          <span className={styles.star} />
          <span className={styles.star} />
          <span className={styles.star} />
        </div>
        <h2 id="round-celebration-title" className={styles.title}>
          כל הכבוד!
        </h2>
        <div className={styles.choices}>
          <button
            type="button"
            ref={register("another-round")}
            className={`${styles.choice} ${styles.anotherRound}`}
            onClick={onAnotherRound}
          >
            <span aria-hidden="true" className={styles.choiceIcon}>
              ↻
            </span>
            <span className={styles.choiceLabel}>עוד סיבוב</span>
          </button>
          <button type="button" ref={register("back")} className={styles.choice} onClick={onBack}>
            <span aria-hidden="true" className={styles.choiceIcon}>
              ➜
            </span>
            <span className={styles.choiceLabel}>חזרה</span>
          </button>
        </div>
      </div>
    </div>
  );
}
