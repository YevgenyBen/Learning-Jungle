"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { moveFocus, type MenuLayout } from "./focus";
import styles from "./Menu.module.css";

const BACK_ID = "back";

export interface MenuChoice {
  readonly id: string;
  /** Hebrew label shown under the icon and used as the accessible name. */
  readonly label: string;
  /** What is drawn inside the big icon. */
  readonly icon: ReactNode;
  /** Where choosing it goes; omitted for an unavailable choice. */
  readonly href?: string;
  /** Background colour of the icon (a design token). */
  readonly color?: string;
}

export interface MenuProps {
  readonly title: string;
  readonly choices: readonly MenuChoice[];
  /** The big back control; omitted on the Home Menu. */
  readonly back?: { readonly label: string; readonly href: string };
}

/**
 * A Menu: a row of big, bright icons and an optional big back control.
 * Every choice works by touch, mouse, and arrow keys plus Enter.
 * Unavailable choices stay visible but do nothing when chosen.
 */
export function Menu({ title, choices, back }: MenuProps) {
  const router = useRouter();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const register = (id: string) => (element: HTMLButtonElement | null) => {
    if (element) buttons.current.set(id, element);
    else buttons.current.delete(id);
  };

  const choiceIds = choices.map((choice) => choice.id).join(" ");
  const hasBack = back !== undefined;

  useEffect(() => {
    const ids = choiceIds.split(" ");
    const layout: MenuLayout = hasBack ? [[BACK_ID], ids] : [ids];

    // A keyboard Player can press Enter straight away.
    buttons.current.get(ids[0])?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const focused = [...buttons.current].find(([, el]) => el === document.activeElement);
      const next = moveFocus(layout, focused ? focused[0] : null, event.key);
      if (next === null) return;
      event.preventDefault();
      buttons.current.get(next)?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [choiceIds, hasBack]);

  return (
    <main className={styles.menu}>
      <header className={styles.header}>
        {back && (
          <button
            type="button"
            ref={register(BACK_ID)}
            className={styles.back}
            onClick={() => router.push(back.href)}
          >
            <span aria-hidden="true" className={styles.backArrow}>
              ➜
            </span>
            <span className={styles.backLabel}>{back.label}</span>
          </button>
        )}
        <h1 className={styles.title}>{title}</h1>
      </header>
      <ul className={styles.choices}>
        {choices.map((choice) => {
          const available = choice.href !== undefined;
          return (
            <li key={choice.id}>
              <button
                type="button"
                ref={register(choice.id)}
                className={styles.choice}
                aria-disabled={available ? undefined : true}
                style={{ "--choice-color": choice.color } as CSSProperties}
                onClick={() => {
                  if (choice.href) router.push(choice.href);
                }}
              >
                <span className={styles.icon} aria-hidden="true">
                  {choice.icon}
                  {!available && <span className={styles.soon}>בקרוב</span>}
                </span>
                <span className={styles.label}>{choice.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
