"use client";

import { useEffect, useRef, useState } from "react";

/**
 * How a Game's View sees the model's state. The Game Frame publishes a new
 * snapshot every animation frame without re-rendering React: canvases draw
 * from `subscribe`, and DOM parts re-render only when what they show
 * changes (`useFrameSelector`). Re-rendering React 60 times a second would
 * starve navigations and other transitions on slower devices.
 */
export interface Frames<S> {
  /** The latest snapshot. */
  current(): S;
  /** Calls `onFrame` after every published frame; returns the unsubscribe. */
  subscribe(onFrame: (state: S) => void): () => void;
}

export interface FramePublisher<S> extends Frames<S> {
  publish(state: S): void;
}

export function createFrames<S>(initial: S): FramePublisher<S> {
  let latest = initial;
  const listeners = new Set<(state: S) => void>();
  return {
    current: () => latest,
    subscribe(onFrame) {
      listeners.add(onFrame);
      return () => listeners.delete(onFrame);
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
export function useFrameSelector<S, T>(
  frames: Frames<S>,
  select: (state: S) => T,
  same: (a: T, b: T) => boolean,
): T {
  const [selected, setSelected] = useState(() => select(frames.current()));
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
    check(frames.current());
    return frames.subscribe(check);
  }, [frames]);
  return selected;
}
