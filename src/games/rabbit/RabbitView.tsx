"use client";

import { useEffect, useRef } from "react";
import { WordPicture } from "@/content/WordPicture";
import { useFrameSelector, type Frames } from "@/frame/frames";
import type { GameViewProps } from "../definition";
import { drawMeadow, type Fonts } from "./draw";
import { WORLD, type RabbitState } from "./model";
import styles from "./RabbitView.module.css";

/** The rabbit Game's drawing: the word bar above the meadow. */
export function RabbitView({ frames }: GameViewProps<RabbitState>) {
  return (
    <div className={styles.view}>
      <WordBar frames={frames} />
      <Meadow frames={frames} />
    </div>
  );
}

type Challenge = RabbitState["challenge"];
const selectChallenge = (state: RabbitState) => state.challenge;
const sameChallenge = (a: Challenge, b: Challenge) =>
  a.word.id === b.word.id && a.next === b.next && a.text === b.text;

function WordBar({ frames }: { frames: Frames<RabbitState> }) {
  const challenge = useFrameSelector(frames, selectChallenge, sameChallenge);
  return (
    <div className={styles.wordBar} data-testid="word-bar" data-word={challenge.word.id}>
      <WordPicture word={challenge.word} className={styles.picture} />
      <ol className={styles.slots} aria-label={challenge.text}>
        {challenge.letters.map((letter, i) => {
          const slot = i < challenge.next ? "filled" : i === challenge.next ? "next" : "empty";
          return (
            <li key={`${challenge.word.id}-${i}`} className={styles.slot} data-slot={slot}>
              {slot === "filled" ? letter.marked : letter.letter}
            </li>
          );
        })}
      </ol>
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
      <canvas ref={canvas} className={styles.canvas} data-testid="meadow" aria-hidden="true" />
    </div>
  );
}
