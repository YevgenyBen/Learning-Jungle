"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { WordPicture } from "@/content/WordPicture";
import { useTickSelector, type Ticks } from "@/frame/ticks";
import { RoundProgress } from "@/frame/RoundProgress";
import type { PlayerAction } from "../contract";
import type { GameViewProps } from "../definition";
import { drawScene, SIGN_SECONDS, signPlace } from "./draw";
import { SCENE, type CatState, type CelebratedWord } from "./model";
import styles from "./CatView.module.css";

/** The first-letter Game's drawing: the Word's Picture and Round progress above the scene. */
export function CatView({ ticks, act }: GameViewProps<CatState>) {
  return (
    <div className={styles.view}>
      <div className={styles.top}>
        <PictureCard ticks={ticks} />
        <RoundProgress ticks={ticks} className={styles.progress} />
      </div>
      <Scene ticks={ticks} act={act} />
    </div>
  );
}

const selectWord = (state: CatState) => state.challenge.word;
const sameWord = (a: CatState["challenge"]["word"], b: CatState["challenge"]["word"]) => a.id === b.id;

/** The Word's Picture, and only its Picture: the Player names it to find its first letter. */
function PictureCard({ ticks }: { ticks: Ticks<CatState> }) {
  const word = useTickSelector(ticks, selectWord, sameWord);
  return (
    <div className={styles.pictureCard} data-testid="picture-card" data-word={word.id}>
      <WordPicture key={word.id} word={word} className={styles.picture} />
    </div>
  );
}

/** One letter sign as the buttons show it; where it stands is set on every tick, outside React. */
interface SignView {
  readonly perch: number;
  readonly letter: string;
  /** Its index for `pick`, or -1 for a sign on its way out. */
  readonly choice: number;
  readonly look: "plain" | "rejected" | "hinted" | "right";
  readonly focused: boolean;
}

function selectSigns(state: CatState): SignView[] {
  return state.perches.flatMap((perch) => {
    if (!perch.sign) return [];
    const choice = state.choices.indexOf(perch.id);
    const right = perch.sign.letter === state.challenge.letter && choice >= 0;
    const look =
      perch.sign.rejected ? "rejected"
      : right && (state.phase === "jumping" || state.phase === "celebrating") ? "right"
      : right && state.hint ? "hinted"
      : "plain";
    return [{ perch: perch.id, letter: perch.sign.letter, choice, look, focused: choice >= 0 && choice === state.focused }];
  });
}
const signKey = (signs: SignView[]) => signs.map((s) => `${s.perch}:${s.choice}:${s.look}:${s.focused}`).join(" ");
const sameSigns = (a: SignView[], b: SignView[]) => signKey(a) === signKey(b);

const MAX_PIXEL_RATIO = 2;

/** The scene, drawn on a canvas every tick without re-rendering React, with the letter signs over it. */
function Scene({ ticks, act }: { ticks: Ticks<CatState>; act: (action: PlayerAction) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const signs = useTickSelector(ticks, selectSigns, sameSigns);

  useEffect(() => {
    const element = box.current!;
    const surface = canvas.current!;
    const ctx = surface.getContext("2d");
    if (!ctx) return;

    const draw = (state: CatState) => {
      const scale = surface.width / SCENE.width;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawScene(ctx, state);
      placeSigns(stage.current!, state);
    };

    // Fit the canvas into its box, keeping the scene's proportions.
    const fit = () => {
      const { width, height } = element.getBoundingClientRect();
      const scale = Math.min(width / SCENE.width, height / SCENE.height);
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const cssWidth = Math.floor(SCENE.width * scale);
      const cssHeight = Math.floor(SCENE.height * scale);
      surface.style.width = `${cssWidth}px`;
      surface.style.height = `${cssHeight}px`;
      // Lets the DOM parts over the scene (signs, the Celebration sign) size themselves in scene pixels.
      element.style.setProperty("--scene-scale", String(cssWidth / SCENE.width));
      surface.width = Math.max(1, Math.round(cssWidth * ratio));
      surface.height = Math.max(1, Math.round(cssHeight * ratio));
      draw(ticks.current());
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    const unsubscribe = ticks.subscribe(draw);
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [ticks]);

  // New sign buttons stand in place before the browser paints them.
  useLayoutEffect(() => placeSigns(stage.current!, ticks.current()), [ticks, signs]);

  return (
    <div ref={box} className={styles.scene}>
      <div ref={stage} className={styles.stage}>
        <canvas ref={canvas} className={styles.canvas} data-testid="scene" aria-hidden="true" />
        <div className={styles.signs} role="group" aria-label="אותיות">
          {signs.map((sign) => (
            <LetterSign key={sign.perch} sign={sign} act={act} />
          ))}
        </div>
        <CelebrationSign ticks={ticks} />
      </div>
    </div>
  );
}

/** Moves each sign button to its perch, in scene pixels, as perches slide, sink and rise. */
function placeSigns(stage: HTMLElement, state: CatState): void {
  for (const perch of state.perches) {
    if (!perch.sign) continue;
    const element = stage.querySelector<HTMLElement>(`[data-perch="${perch.id}"]`);
    if (!element) continue;
    const { x, y, shown } = signPlace(perch);
    element.style.setProperty("--x", String(x));
    element.style.setProperty("--y", String(y));
    element.style.setProperty("--shown", String(shown));
  }
}

function LetterSign({ sign, act }: { sign: SignView; act: (action: PlayerAction) => void }) {
  const pick = () => {
    if (sign.choice >= 0) act({ kind: "pick", choice: sign.choice });
  };
  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button > 0) return;
    // A tap on a sign picks it; it is not also the main action on the play area.
    event.stopPropagation();
    event.preventDefault();
    pick();
  };
  // Keyboard and assistive technology "clicks" (a pointer already picked on its way down).
  const onClick = (event: MouseEvent) => {
    if (event.detail === 0) pick();
  };
  return (
    <button
      type="button"
      className={styles.sign}
      data-testid="choice"
      data-perch={sign.perch}
      data-letter={sign.letter}
      data-look={sign.look}
      data-focused={sign.focused}
      aria-label={sign.letter}
      aria-disabled={sign.choice < 0 || sign.look === "rejected"}
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {sign.letter}
    </button>
  );
}

/** The Word whose sign is up, if any, and the x of the sign's middle: over the half of the scene away from the cat. */
type Celebrated = (Pick<CelebratedWord, "word" | "text" | "first" | "number"> & { readonly x: number }) | null;
const selectCelebrated = (state: CatState): Celebrated =>
  state.celebrated && state.celebrated.since < SIGN_SECONDS
    ? { ...state.celebrated, x: state.cat.x < SCENE.width / 2 ? SCENE.width * 0.72 : SCENE.width * 0.28 }
    : null;
// The sign stays where it first stood while the scene moves on.
const sameCelebrated = (a: Celebrated, b: Celebrated) => a?.number === b?.number && a?.word.id === b?.word.id;

/** The springy sign with the Word, its first letter picked out, and its Picture. */
function CelebrationSign({ ticks }: { ticks: Ticks<CatState> }) {
  const sign = useTickSelector(ticks, selectCelebrated, sameCelebrated);
  if (!sign) return null;
  return (
    <div
      key={`${sign.number}-${sign.word.id}`}
      className={styles.celebration}
      style={{ "--x": sign.x } as CSSProperties}
      data-testid="celebration-sign"
    >
      <WordPicture word={sign.word} className={styles.celebrationPicture} />
      <span className={styles.celebrationWord}>
        <span className={styles.firstLetter}>{sign.first}</span>
        {sign.text.slice(sign.first.length)}
      </span>
    </div>
  );
}
