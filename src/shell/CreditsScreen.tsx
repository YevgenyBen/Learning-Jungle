"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./CreditsScreen.module.css";

/**
 * The credits screen, reached from the Parent control on Home. It holds the
 * attributions the bundled assets require (Twemoji is CC-BY 4.0).
 */
export function CreditsScreen() {
  const router = useRouter();
  const back = useRef<HTMLButtonElement>(null);

  // A keyboard user can press Enter straight away to go back.
  useEffect(() => back.current?.focus({ preventScroll: true }), []);

  return (
    <main className={styles.credits}>
      <header className={styles.header}>
        <button type="button" ref={back} className={styles.back} onClick={() => router.push("/home")}>
          <span aria-hidden="true" className={styles.backArrow}>
            ➜
          </span>
          <span>חזרה</span>
        </button>
        <h1 className={styles.title}>קרדיטים</h1>
      </header>
      <section className={styles.body}>
        <h2 className={styles.subtitle}>תמונות</h2>
        <p data-testid="twemoji-attribution">
          תמונות המילים הן{" "}
          <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noreferrer">
            <bdi>Twemoji</bdi>
          </a>
          , ‏© <bdi>Twitter, Inc</bdi> ותורמים נוספים, ברישיון{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            <bdi>CC-BY 4.0</bdi>
          </a>
          .
        </p>
      </section>
    </main>
  );
}
