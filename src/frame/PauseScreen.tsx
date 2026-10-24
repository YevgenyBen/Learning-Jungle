"use client";

import styles from "./PauseScreen.module.css";

/**
 * Covers the paused Game with one big "carry on" control. Space, P and
 * Esc carry on too; the Frame's controls stay usable around it.
 */
export function PauseScreen({ onResume }: { readonly onResume: () => void }) {
  return (
    <div className={styles.screen} data-testid="pause-screen">
      <button type="button" className={styles.resume} onClick={onResume}>
        <span aria-hidden="true" className={styles.icon}>
          {"▶︎" /* ▶ as text, not a colour emoji */}
        </span>
        <span className={styles.label}>המשך</span>
      </button>
    </div>
  );
}
