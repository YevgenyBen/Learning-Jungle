"use client";

import { usePathname } from "next/navigation";
import styles from "./RotateScreen.module.css";

/**
 * The app is landscape only. On a phone or tablet held upright this covers
 * everything with a big "turn the device" picture. Whether it shows is pure
 * CSS (see the module), so it shows before any script runs and follows the
 * device as it turns. Computers (fine pointer) never see it, whatever the
 * window shape.
 *
 * The Opening Screen (`/`) is left uncovered: the logo is shown first, held
 * any way, and the request to turn the device comes once it moves on.
 */
export function RotateScreen() {
  if (usePathname() === "/") return null;
  return (
    <div className={styles.rotate} data-testid="rotate-screen" role="alert">
      {/* The device turns a quarter counter-clockwise about its centre
          (100, 100); the arrow arcs the same way over its top, wider than
          the turning device so the two never touch. */}
      <svg className={styles.picture} viewBox="10 7 180 160" aria-hidden="true">
        <g className={styles.device}>
          <rect x="70" y="45" width="60" height="110" rx="10" />
          {/* The camera, at the top while the device is upright. */}
          <circle cx="100" cy="58" r="5" />
        </g>
        <path className={styles.arrow} d="M169.3 60 A80 80 0 0 0 30.7 60" />
        <path className={styles.arrowHead} d="M45.2 53.3 L30.7 60 L29.3 44.1" />
      </svg>
      <p className={styles.message}>סובבו את המכשיר</p>
    </div>
  );
}
