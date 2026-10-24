"use client";

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { hasModifierKey, moveFocus } from "@/menus/focus";
import { useFocusGroup } from "@/menus/focusGroup";
import styles from "./RoundCelebration.module.css";

export interface RoundCelebrationProps {
  /** Starts a new Round of the same Game. */
  readonly onAnotherRound: () => void;
  /** Goes back to the Game's Subject Menu. */
  readonly onBack: () => void;
}

/** What the Player can do once a Round is over. */
type RoundEndOption = "another-round" | "back";
/** One row, in reading order: right to left, "another Round" first. */
const LAYOUT = [["another-round", "back"]] as const;
/** Keys that pick the focused option, when they are let go. */
const PICK_KEYS = new Set(["Enter", "NumpadEnter", "Space"]);

/**
 * The Game Frame's Round Celebration screen, shown over any Game whose model
 * asks for its Round's Celebration (`celebrate` "round"): a big "well done"
 * and two big options, another Round or back to the Menu. Works by touch,
 * mouse, and arrow keys plus Enter.
 *
 * It handles its own keys (arrows, Enter, Space) and keeps them from the
 * Game Frame's key handlers, so a key meant for an option never also
 * reaches the Game behind it. The Game Frame also stands down its own Enter
 * (restart) and main action while this screen shows.
 */
export function RoundCelebration({ onAnotherRound, onBack }: RoundCelebrationProps) {
  const options = useFocusGroup<RoundEndOption>();
  /** The key that went down here and picks an option when it comes up. */
  const armed = useRef<string | null>(null);
  const actions: Record<RoundEndOption, () => void> = { "another-round": onAnotherRound, back: onBack };

  // A keyboard Player can press Enter straight away.
  useEffect(() => options.focus("another-round"), [options]);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (hasModifierKey(event)) return;
    if (PICK_KEYS.has(event.code)) {
      // The option is picked when the key comes up, so the rest of the press
      // can't reach the next screen.
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) armed.current = event.code;
      return;
    }
    const next = moveFocus(LAYOUT, options.focused(), event.key) as RoundEndOption | null;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    options.focus(next);
  };

  const onKeyUp = (event: ReactKeyboardEvent) => {
    if (!PICK_KEYS.has(event.code) && moveFocus(LAYOUT, null, event.key) === null) return;
    event.stopPropagation();
    if (event.code !== armed.current) return;
    event.preventDefault();
    armed.current = null;
    actions[options.focused() ?? "another-round"]();
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
        <div className={styles.options}>
          <button
            type="button"
            ref={options.register("another-round")}
            className={`${styles.option} ${styles.anotherRound}`}
            onClick={onAnotherRound}
          >
            <span aria-hidden="true" className={styles.optionIcon}>
              ↻
            </span>
            <span className={styles.optionLabel}>עוד סיבוב</span>
          </button>
          <button type="button" ref={options.register("back")} className={styles.option} onClick={onBack}>
            <span aria-hidden="true" className={styles.optionIcon}>
              ➜
            </span>
            <span className={styles.optionLabel}>חזרה</span>
          </button>
        </div>
      </div>
    </div>
  );
}
