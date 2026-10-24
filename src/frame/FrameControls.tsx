"use client";

import type { ReactNode } from "react";
import styles from "./FrameControls.module.css";

export interface FrameControlsProps {
  readonly onBack: () => void;
  readonly paused: boolean;
  /** Pauses, or carries on when paused. */
  readonly onPause: () => void;
  readonly onRestart: () => void;
  readonly muted: boolean;
  /** Mutes, or turns the sound back on. */
  readonly onMute: () => void;
  /**
   * The Game's settings controls (Niqqud and Difficulty, #8), kept on the
   * far edge, away from back, pause, restart and mute.
   */
  readonly settings?: ReactNode;
}

/**
 * The Game Frame's controls, in the same places in every Game. On a tall
 * screen they form a row above the Game; on a phone held sideways they
 * stand in columns at the two side edges, so the Game keeps the height.
 * Every key action has one of these as its on-screen equivalent.
 */
export function FrameControls({ onBack, paused, onPause, onRestart, muted, onMute, settings }: FrameControlsProps) {
  return (
    <>
      <header className={styles.rail} data-rail="start">
        <Control icon="➜" label="חזרה" onPress={onBack} />
        <div className={styles.group}>
          <Control icon={"⏸︎" /* ⏸ as text, not a colour emoji */} label="עצירה" pressed={paused} onPress={onPause} />
          <Control icon={"↻︎" /* ↻ */} label="מהתחלה" onPress={onRestart} />
          <Control icon={muted ? "🔇" : "🔊"} label="השתקה" pressed={muted} onPress={onMute} />
        </div>
      </header>
      {settings && (
        <div className={styles.rail} data-rail="end">
          {settings}
        </div>
      )}
    </>
  );
}

/** One big Frame control: an icon, and a label that phones hide to save room. */
export function Control({
  icon,
  label,
  pressed,
  onPress,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  /** For on/off controls (pause, mute). */
  readonly pressed?: boolean;
  readonly onPress: () => void;
}) {
  return (
    <button type="button" className={styles.control} aria-pressed={pressed} onClick={onPress}>
      <span aria-hidden="true" className={styles.icon}>
        {icon}
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
