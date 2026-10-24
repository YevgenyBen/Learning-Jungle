"use client";

import { useEffect } from "react";

type FullScreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FullScreenDocument = Document & { webkitFullscreenElement?: Element | null };
type LockableOrientation = ScreenOrientation & { lock?: (orientation: "landscape") => Promise<void> };

const isFullScreen = () => {
  const doc = document as FullScreenDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
};

/**
 * Asks for full screen and then a landscape lock. Browsers allow both only
 * inside or just after a Player's gesture; where either is missing or
 * refused (iPhone has neither) the Game simply carries on as it is.
 * Resolves to whether the page ended up in full screen.
 */
async function requestGameScreen(): Promise<boolean> {
  try {
    if (!isFullScreen()) {
      const root = document.documentElement as FullScreenElement;
      const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
      if (!request) return false;
      await request();
    }
    const orientation = (screen as Screen & { orientation?: LockableOrientation }).orientation;
    await orientation?.lock?.("landscape").catch(() => {});
  } catch {
    // Refused or unsupported: the Game plays in the window it has.
  }
  return isFullScreen();
}

/**
 * While a Game is on screen: asks for full screen and a landscape lock as
 * it starts (the Menu tap that opened it still counts as a gesture), and,
 * if that didn't work (say the Game was opened from its address), once
 * more on the Player's first tap, click or key in it.
 */
export function useGameScreen(): void {
  useEffect(() => {
    let settled = false;
    const attempt = () => {
      if (settled) return;
      void requestGameScreen().then((full) => {
        if (full) settled = true;
      });
    };
    const onGesture = () => {
      attempt();
      // Only the first gesture: a Player who leaves full screen stays out.
      settled = true;
      removeListeners();
    };
    const removeListeners = () => {
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
    };
    attempt();
    window.addEventListener("pointerdown", onGesture, true);
    window.addEventListener("keydown", onGesture, true);
    return () => {
      settled = true;
      removeListeners();
    };
  }, []);
}
