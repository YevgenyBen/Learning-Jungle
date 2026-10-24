"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { WordPicture } from "@/content/WordPicture";
import { useFrameSelector, type Frames } from "@/frame/frames";
import { RoundProgress } from "@/frame/RoundProgress";
import type { GameViewProps } from "../definition";
import { drawMeadow, SIGN_SECONDS, type Fonts } from "./draw";
import { WORLD, type CelebratedWord, type RabbitState } from "./model";
import styles from "./RabbitView.module.css";

/** The rabbit Game's drawing: the word bar and Round progress above the meadow. */
export function RabbitView({ frames }: GameViewProps<RabbitState>) {
  return (
    <div className={styles.view}>
      <div className={styles.top}>
        <WordBar frames={frames} />
        <RoundProgress frames={frames} className={styles.progress} />
      </div>
      <Meadow frames={frames} />
    </div>
  );
}

interface Bar {
  readonly challenge: RabbitState["challenge"];
  readonly hint: boolean;
}
const selectBar = (state: RabbitState): Bar => ({ challenge: state.challenge, hint: state.hint });
const sameBar = (a: Bar, b: Bar) =>
  a.hint === b.hint &&
  a.challenge.word.id === b.challenge.word.id &&
  a.challenge.next === b.challenge.next &&
  a.challenge.text === b.challenge.text;

function WordBar({ frames }: { frames: Frames<RabbitState> }) {
  const { challenge, hint } = useFrameSelector(frames, selectBar, sameBar);
  const complete = challenge.next >= challenge.letters.length;
  return (
    <div
      className={styles.wordBar}
      data-testid="word-bar"
      data-word={challenge.word.id}
      data-complete={complete}
      data-hint={hint}
    >
      <WordPicture word={challenge.word} className={styles.picture} />
      <ol className={styles.slots} aria-label={challenge.text}>
        {challenge.letters.map((letter, i) => {
          const slot = i < challenge.next ? "filled" : i === challenge.next ? "next" : "empty";
          return (
            <li
              key={`${challenge.word.id}-${i}`}
              className={styles.slot}
              data-slot={slot}
              style={{ "--slot-index": i } as CSSProperties}
            >
              {slot === "filled" ? letter.marked : letter.letter}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The Word whose sign is up, if any. */
type Sign = Pick<CelebratedWord, "word" | "text" | "number"> | null;
const selectSign = (state: RabbitState): Sign =>
  state.celebrated && state.celebrated.since < SIGN_SECONDS ? state.celebrated : null;
const sameSign = (a: Sign, b: Sign) => a?.number === b?.number;

/** The springy sign with the completed Word and its Picture, during its Celebration. */
function CelebrationSign({ frames }: { frames: Frames<RabbitState> }) {
  const sign = useFrameSelector(frames, selectSign, sameSign);
  if (!sign) return null;
  return (
    <div key={sign.number} className={styles.sign} data-testid="celebration-sign">
      <WordPicture word={sign.word} className={styles.signPicture} />
      <span className={styles.signWord}>{sign.text}</span>
    </div>
  );
}

const MAX_PIXEL_RATIO = 2;

/** The meadow, drawn on a canvas every frame without re-rendering React. */
function Meadow({ frames }: { frames: Frames<RabbitState> }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = box.current!;
    const surface = canvas.current!;
    const ctx = surface.getContext("2d");
    if (!ctx) return;
    const display = getComputedStyle(element).getPropertyValue("--font-display").trim();
    const fonts: Fonts = { display: display || "sans-serif" };

    const draw = (state: RabbitState) => {
      const scale = surface.width / WORLD.width;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawMeadow(ctx, state, fonts);
    };

    // Fit the canvas into its box, keeping the meadow's proportions.
    const fit = () => {
      const { width, height } = element.getBoundingClientRect();
      const scale = Math.min(width / WORLD.width, height / WORLD.height);
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const cssWidth = Math.floor(WORLD.width * scale);
      const cssHeight = Math.floor(WORLD.height * scale);
      surface.style.width = `${cssWidth}px`;
      surface.style.height = `${cssHeight}px`;
      // Lets the DOM parts over the meadow (the sign) size themselves in world pixels.
      element.style.setProperty("--meadow-scale", String(cssWidth / WORLD.width));
      surface.width = Math.max(1, Math.round(cssWidth * ratio));
      surface.height = Math.max(1, Math.round(cssHeight * ratio));
      draw(frames.current());
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    const unsubscribe = frames.subscribe(draw);
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [frames]);

  return (
    <div ref={box} className={styles.meadow}>
      <div className={styles.stage}>
        <canvas ref={canvas} className={styles.canvas} data-testid="meadow" aria-hidden="true" />
        <CelebrationSign frames={frames} />
      </div>
    </div>
  );
}
