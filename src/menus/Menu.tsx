"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { hasModifierKey, moveFocus, type MenuLayout } from "./focus";
import { useFocusGroup } from "./focusGroup";
import styles from "./Menu.module.css";

const BACK_ID = "back";
const FOOTER_ID = "footer";

/** One big icon in a Menu: a Subject, or a Game of a Subject. */
export interface MenuEntry {
  readonly id: string;
  /** Hebrew label shown under the icon and used as the accessible name. */
  readonly label: string;
  /** What is drawn inside the big icon. */
  readonly icon: ReactNode;
  /** Where picking it goes; omitted for an unavailable entry. */
  readonly href?: string;
  /** Background colour of the icon (a design token). */
  readonly color?: string;
}

export interface MenuProps {
  readonly title: string;
  readonly entries: readonly MenuEntry[];
  /** The big back control; omitted on the Home Menu. */
  readonly back?: { readonly label: string; readonly href: string };
  /**
   * A small control below the entries, such as the Parent control on Home.
   * Its first link or button is the Menu's last row for the arrow keys.
   */
  readonly footer?: ReactNode;
}

/**
 * A Menu: a row of big, bright icons and an optional big back control.
 * Every entry works by touch, mouse, and arrow keys plus Enter.
 * Unavailable entries stay visible but do nothing when picked.
 */
export function Menu({ title, entries, back, footer }: MenuProps) {
  const router = useRouter();
  const controls = useFocusGroup<string>();
  const footerBox = useRef<HTMLDivElement>(null);

  const entryIds = entries.map((entry) => entry.id).join(" ");
  const hasBack = back !== undefined;

  useEffect(() => {
    const ids = entryIds.split(" ");
    const footerControl = footerBox.current?.querySelector<HTMLElement>("a[href], button") ?? null;
    const registerFooter = controls.register(FOOTER_ID);
    registerFooter(footerControl);
    const layout: MenuLayout = [...(hasBack ? [[BACK_ID]] : []), ids, ...(footerControl ? [[FOOTER_ID]] : [])];

    // A keyboard Player can press Enter straight away.
    controls.focus(ids[0]);

    const onKeyDown = (event: KeyboardEvent) => {
      if (hasModifierKey(event)) return;
      const next = moveFocus(layout, controls.focused(), event.key);
      if (next === null) return;
      event.preventDefault();
      controls.focus(next);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      registerFooter(null);
    };
  }, [entryIds, hasBack, controls]);

  return (
    <main className={styles.menu}>
      <header className={styles.header}>
        {back && (
          <button
            type="button"
            ref={controls.register(BACK_ID)}
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
      <ul className={styles.entries}>
        {entries.map((entry) => {
          const available = entry.href !== undefined;
          return (
            <li key={entry.id}>
              <button
                type="button"
                ref={controls.register(entry.id)}
                className={styles.entry}
                aria-disabled={available ? undefined : true}
                style={{ "--entry-color": entry.color } as CSSProperties}
                onClick={() => {
                  if (entry.href) router.push(entry.href);
                }}
              >
                <span className={styles.icon} aria-hidden="true">
                  {entry.icon}
                  {!available && <span className={styles.soon}>בקרוב</span>}
                </span>
                <span className={styles.label}>{entry.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {footer && (
        <div ref={footerBox} className={styles.footer}>
          {footer}
        </div>
      )}
    </main>
  );
}
