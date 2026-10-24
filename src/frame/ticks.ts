"use client";

import { useEffect, useRef, useState } from "react";

/**
 * How a Game's View sees the model's state. The Game Frame publishes a new
 * snapshot on every tick (one per animation frame) without re-rendering
 * React: canvases draw from `subscribe`, and DOM parts re-render only when
 * what they show changes (`useTickSelector`). Re-rendering React 60 times a
 * second would starve navigations and other transitions on slower devices.
 */
export interface Ticks<S> {
  /** The latest snapshot. */
  current(): S;
  /** Calls `onTick` after every published snapshot; returns the unsubscribe. */
  subscribe(onTick: (state: S) => void): () => void;
}

export interface TickPublisher<S> extends Ticks<S> {
  publish(state: S): void;
}

export function createTicks<S>(initial: S): TickPublisher<S> {
  let latest = initial;
  const listeners = new Set<(state: S) => void>();
  return {
    current: () => latest,
    subscribe(onTick) {
      listeners.add(onTick);
      return () => listeners.delete(onTick);
    },
    publish(state) {
      latest = state;
      for (const listener of listeners) listener(state);
    },
  };
}

/**
 * A piece of the state for drawing in the DOM. The component re-renders only
 * when `same` says the selected piece changed.
 */
export function useTickSelector<S, T>(
  ticks: Ticks<S>,
  select: (state: S) => T,
  same: (a: T, b: T) => boolean,
): T {
  const [selected, setSelected] = useState(() => select(ticks.current()));
  const latest = useRef({ select, same, selected });
  latest.current = { select, same, selected };

  useEffect(() => {
    let last = latest.current.selected;
    const check = (state: S) => {
      const next = latest.current.select(state);
      if (latest.current.same(last, next)) return;
      last = next;
      setSelected(next);
    };
    check(ticks.current());
    return ticks.subscribe(check);
  }, [ticks]);
  return selected;
}
