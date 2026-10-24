"use client";

import { useState } from "react";

/**
 * The focusable controls of one screen, by id, so arrow keys can move focus
 * between them (see `moveFocus` in ./focus.ts). Used by the Menus and the
 * Round Celebration screen.
 */
export interface FocusGroup<Id extends string> {
  /** A ref callback that adds the control with this id, and drops it when it goes. */
  register(id: Id): (element: HTMLElement | null) => void;
  /** Focuses the control with this id, if it is there. */
  focus(id: Id | null): void;
  /** The id of the control that has focus, or null if none of them has. */
  focused(): Id | null;
}

export function useFocusGroup<Id extends string>(): FocusGroup<Id> {
  const [group] = useState<FocusGroup<Id>>(() => {
    const elements = new Map<Id, HTMLElement>();
    return {
      register: (id) => (element) => {
        if (element) elements.set(id, element);
        else elements.delete(id);
      },
      focus: (id) => {
        if (id !== null) elements.get(id)?.focus({ preventScroll: true });
      },
      focused: () => [...elements].find(([, element]) => element === document.activeElement)?.[0] ?? null,
    };
  });
  return group;
}
