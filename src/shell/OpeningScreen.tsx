"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { Logo } from "./Logo";
import styles from "./OpeningScreen.module.css";

/** How long the logo stays up before the app moves on by itself. */
export const OPENING_DURATION_MS = 2000;

/**
 * Shows the logo, then moves on to the Home Menu after about two seconds,
 * or earlier on any tap, click or key. It never waits for a tap to unlock
 * sound (ADR-0004).
 *
 * It moves on at the end of the gesture (click, keyup) rather than its start,
 * so the rest of that gesture can't land on the Home Menu and choose a
 * Subject by accident.
 */
export function OpeningScreen() {
  const router = useRouter();
  const done = useRef(false);

  const moveOn = useCallback(() => {
    if (done.current) return;
    done.current = true;
    router.replace("/home");
  }, [router]);

  useEffect(() => {
    router.prefetch("/home");
    const timer = window.setTimeout(moveOn, OPENING_DURATION_MS);
    window.addEventListener("keyup", moveOn);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keyup", moveOn);
    };
  }, [router, moveOn]);

  // The click handler sits on the screen itself, not on window: iOS Safari
  // only fires click for a tap on an element that handles clicks.
  return (
    <main className={styles.opening} data-testid="opening" onClick={moveOn}>
      <Logo />
    </main>
  );
}
