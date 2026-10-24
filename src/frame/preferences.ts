"use client";

/**
 * The settings the Game Frame remembers on this device: mute for
 * the whole app, and Niqqud and Difficulty for each Game. Nothing else is
 * ever stored: no progress, scores or identities.
 *
 * Storage is read defensively. Missing, blocked, full or corrupt storage,
 * and values of the wrong kind, fall back to the defaults: sound on,
 * Niqqud on, the Game's first Difficulty ("automatic").
 */
import { useCallback, useEffect, useState } from "react";

export interface Preferences<D extends string = string> {
  readonly muted: boolean;
  readonly niqqud: boolean;
  readonly difficulty: D;
}

/** New values, or a function of the current ones (for toggling and cycling). */
export type PreferenceChange<D extends string> =
  | Partial<Preferences<D>>
  | ((current: Preferences<D>) => Partial<Preferences<D>>);

const MUTED_KEY = "learning-jungle.muted";
const gameKey = (gameId: string) => `learning-jungle.game.${gameId}`;

/** localStorage, or null where the browser blocks it (reading the property itself can throw). */
function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read(key: string): unknown {
  try {
    const raw = storage()?.getItem(key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Full or blocked storage: the setting still holds until the page closes.
  }
}

export function readPreferences<D extends string>(gameId: string, difficulties: readonly D[]): Preferences<D> {
  const muted = read(MUTED_KEY);
  const game = read(gameKey(gameId));
  const saved = typeof game === "object" && game !== null ? (game as Record<string, unknown>) : {};
  return {
    muted: typeof muted === "boolean" ? muted : false,
    niqqud: typeof saved.niqqud === "boolean" ? saved.niqqud : true,
    difficulty: difficulties.find((d) => d === saved.difficulty) ?? difficulties[0],
  };
}

function savePreferences<D extends string>(gameId: string, before: Preferences<D>, after: Preferences<D>): void {
  if (after.muted !== before.muted) write(MUTED_KEY, after.muted);
  if (after.niqqud !== before.niqqud || after.difficulty !== before.difficulty) {
    write(gameKey(gameId), { niqqud: after.niqqud, difficulty: after.difficulty });
  }
}

/**
 * The Game's preferences, read once the page is in the browser (null until
 * then, so the prerendered page and the browser's first render agree), and
 * a way to change them that also remembers the change.
 */
export function usePreferences<D extends string>(
  gameId: string,
  difficulties: readonly D[],
): readonly [Preferences<D> | null, (changes: PreferenceChange<D>) => void] {
  const [preferences, setPreferences] = useState<Preferences<D> | null>(null);
  useEffect(() => {
    setPreferences(readPreferences(gameId, difficulties));
  }, [gameId, difficulties]);

  const change = useCallback(
    (changes: PreferenceChange<D>) =>
      setPreferences((before) => {
        // Nothing can be changed before the preferences have been read.
        if (!before) return before;
        const after = { ...before, ...(typeof changes === "function" ? changes(before) : changes) };
        savePreferences(gameId, before, after);
        return after;
      }),
    [gameId],
  );
  return [preferences, change] as const;
}
