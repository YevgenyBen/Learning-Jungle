"use client";

import type { GameState } from "@/games/contract";
import { useTickSelector, type Ticks } from "./ticks";
import styles from "./RoundProgress.module.css";

type Progress = GameState["progress"];
const selectProgress = (state: GameState) => state.progress;
const sameProgress = (a: Progress, b: Progress) => a.completed === b.completed && a.total === b.total;

/**
 * How far through the Round the Player is: one star per Challenge, lit
 * once it is completed. Any Game's View can show it where it fits.
 */
export function RoundProgress({ ticks, className }: { ticks: Ticks<GameState>; className?: string }) {
  const { completed, total } = useTickSelector(ticks, selectProgress, sameProgress);
  return (
    <div
      className={`${styles.progress} ${className ?? ""}`}
      role="progressbar"
      aria-label="סיבוב"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
      aria-valuetext={`${completed} מתוך ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={styles.star} data-done={i < completed} />
      ))}
    </div>
  );
}
