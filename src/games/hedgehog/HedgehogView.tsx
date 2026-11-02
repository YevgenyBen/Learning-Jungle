"use client";

import { useEffect, useRef, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { WordPicture } from "@/content/WordPicture";
import { useTickSelector, type Ticks } from "@/frame/ticks";
import { RoundProgress } from "@/frame/RoundProgress";
import type { PlayerAction } from "../contract";
import type { GameViewProps } from "../definition";
import { SCENE, type HedgehogPhase, type HedgehogState } from "./model";
import styles from "./HedgehogView.module.css";

/** The counting Game's drawing: Round progress above a meadow with the hedgehog and the fruits. */
export function HedgehogView({ ticks, act }: GameViewProps<HedgehogState>) {
  return (
    <div className={styles.view}>
      <div className={styles.top}>
        <RoundProgress ticks={ticks} className={styles.progress} />
      </div>
      <Scene ticks={ticks} act={act} />
    </div>
  );
}

/** The hedgehog's body, in scene pixels: fruits counted stick onto the upper half of it. */
const BODY = { x: 175, y: 255, rx: 135, ry: 80 } as const;

/**
 * Where the n-th counted fruit (0 for the first) sits on the hedgehog's
 * back: rows along the top of the body, the outer row filled first.
 */
export function spinePlace(n: number): { x: number; y: number } {
  const rows = [9, 6, 4, 1];
  const reach = [0.98, 0.68, 0.38, 0];
  let row = 0;
  let i = n;
  while (row < rows.length - 1 && i >= rows[row]) i -= rows[row++];
  const inRow = rows[row];
  const angle = inRow === 1 ? Math.PI / 2 : Math.PI * (0.1 + (0.8 * i) / (inRow - 1));
  const r = reach[row];
  return { x: BODY.x - Math.cos(angle) * BODY.rx * r, y: BODY.y - 18 - Math.sin(angle) * BODY.ry * (0.55 + 0.45 * r) };
}

interface SceneView {
  readonly number: number;
  readonly phase: HedgehogPhase;
  readonly count: number;
  readonly total: number;
  readonly hint: boolean;
  readonly focused: number | null;
  readonly doubting: boolean;
  readonly fruits: HedgehogState["fruits"];
  readonly choices: HedgehogState["choices"];
  readonly fruit: HedgehogState["fruit"];
}
const selectScene = (s: HedgehogState): SceneView => ({
  number: s.number,
  phase: s.phase,
  count: s.count,
  total: s.total,
  hint: s.hint,
  focused: s.focused,
  doubting: s.doubt > 0,
  fruits: s.fruits,
  choices: s.choices,
  fruit: s.fruit,
});
const sceneKey = (v: SceneView) =>
  [v.number, v.phase, v.count, v.hint, v.focused, v.doubting, v.choices.map((c) => `${c.value}${c.rejected ? "x" : ""}`).join(",")].join("|");
const sameScene = (a: SceneView, b: SceneView) => sceneKey(a) === sceneKey(b) && a.fruit.id === b.fruit.id;

/** The meadow, sized to its box in scene proportions; everything on it is placed in scene pixels. */
function Scene({ ticks, act }: { ticks: Ticks<HedgehogState>; act: (action: PlayerAction) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const view = useTickSelector(ticks, selectScene, sameScene);

  useEffect(() => {
    const element = box.current!;
    const fit = () => {
      const { width, height } = element.getBoundingClientRect();
      const scale = Math.min(width / SCENE.width, height / SCENE.height);
      stage.current!.style.width = `${Math.floor(SCENE.width * scale)}px`;
      stage.current!.style.height = `${Math.floor(SCENE.height * scale)}px`;
      element.style.setProperty("--scene-scale", String(scale));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const showRunning = view.phase === "counting" || view.phase === "counted";
  return (
    <div ref={box} className={styles.scene}>
      <div
        ref={stage}
        className={styles.stage}
        data-testid="scene"
        data-phase={view.phase}
        // A tap on the meadow is not the main action: only a tap on a fruit counts it.
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Hedgehog doubting={view.doubting} happy={view.phase === "celebrating"} />
        {showRunning && view.count > 0 && (
          <div key={view.count} className={styles.running} data-testid="running-count" aria-live="polite">
            {view.count}
          </div>
        )}
        <div
          className={styles.fruits}
          role="group"
          aria-label="פירות"
          // The fruits on its back hop along with the hedgehog.
          data-happy={view.phase === "celebrating"}
        >
          {view.fruits.map((fruit) => (
            <FruitButton
              key={`${view.number}-${fruit.index}`}
              fruit={fruit}
              word={view.fruit}
              act={act}
            />
          ))}
        </div>
        {view.phase === "answering" && (
          <div className={styles.choices} role="group" aria-label="כמה פירות?">
            {view.choices.map((choice, i) => (
              <NumberButton
                key={`${view.number}-${choice.value}`}
                index={i}
                value={choice.value}
                look={choice.rejected ? "rejected" : view.hint && choice.value === view.total ? "hinted" : "plain"}
                focused={view.focused === i}
                act={act}
              />
            ))}
          </div>
        )}
        {view.phase === "celebrating" && (
          <div key={view.number} className={styles.celebration} data-testid="celebration-sign">
            <span className={styles.celebrationNumber}>{view.total}</span>
            <WordPicture word={view.fruit} className={styles.celebrationPicture} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Calls `pick` on a tap (stopping it from also being the main action) and on keyboard "clicks". */
function pressHandlers(onPress: () => void) {
  return {
    onPointerDown: (event: PointerEvent) => {
      if (!event.isPrimary || event.button > 0) return;
      event.stopPropagation();
      event.preventDefault();
      onPress();
    },
    onClick: (event: MouseEvent) => {
      if (event.detail === 0) onPress();
    },
  };
}

function FruitButton({ fruit, word, act }: { fruit: HedgehogState["fruits"][number]; word: HedgehogState["fruit"]; act: (a: PlayerAction) => void }) {
  const place = fruit.counted === null ? { x: fruit.x, y: fruit.y } : spinePlace(fruit.counted - 1);
  return (
    <button
      type="button"
      className={styles.fruit}
      data-testid="fruit"
      data-index={fruit.index}
      data-counted={fruit.counted !== null}
      aria-label={word.plain}
      aria-disabled={fruit.counted !== null}
      tabIndex={-1}
      style={{ "--x": place.x, "--y": place.y, "--tilt": `${fruit.tilt}deg` } as CSSProperties}
      {...pressHandlers(() => {
        if (fruit.counted === null) act({ kind: "pick", choice: fruit.index });
      })}
    >
      <WordPicture word={word} className={styles.fruitPicture} />
    </button>
  );
}

function NumberButton({
  index,
  value,
  look,
  focused,
  act,
}: {
  index: number;
  value: number;
  look: "plain" | "rejected" | "hinted";
  focused: boolean;
  act: (a: PlayerAction) => void;
}) {
  return (
    <button
      type="button"
      className={styles.choice}
      data-testid="choice"
      data-value={value}
      data-look={look}
      data-focused={focused}
      aria-disabled={look === "rejected"}
      tabIndex={-1}
      {...pressHandlers(() => act({ kind: "pick", choice: index }))}
    >
      {value}
    </button>
  );
}

/** Spikes around the top of the body, as one polygon. */
function spikes(): string {
  const points: string[] = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (1.02 + (0.98 * i) / n);
    const r = i % 2 === 0 ? 1.18 : 0.98;
    points.push(`${BODY.x + Math.cos(a) * BODY.rx * r},${BODY.y + Math.sin(a) * BODY.ry * r}`);
  }
  points.push(`${BODY.x + BODY.rx * 0.95},${BODY.y + 20}`, `${BODY.x - BODY.rx},${BODY.y + 20}`);
  return points.join(" ");
}
const SPIKES = spikes();

/** The hedgehog, facing the fruits on its right. */
function Hedgehog({ doubting, happy }: { doubting: boolean; happy: boolean }) {
  const { x, y, rx, ry } = BODY;
  return (
    <svg
      className={styles.hedgehog}
      data-doubting={doubting}
      data-happy={happy}
      viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}
      aria-hidden="true"
    >
      <g className={styles.hedgehogBody}>
        <ellipse cx={x - 70} cy={y + ry - 6} rx={18} ry={9} fill="#5b3a24" />
        <ellipse cx={x + 60} cy={y + ry - 6} rx={18} ry={9} fill="#5b3a24" />
        <polygon points={SPIKES} fill="#6b4630" stroke="#3e2617" strokeWidth={4} strokeLinejoin="round" />
        <ellipse cx={x} cy={y + 10} rx={rx * 0.98} ry={ry * 0.8} fill="#8a5a3a" />
        <ellipse cx={x + 10} cy={y + 30} rx={rx * 0.8} ry={ry * 0.5} fill="#e9c9a0" />
        <g className={styles.hedgehogHead}>
          <path
            d={`M ${x + 85} ${y - 30} Q ${x + 175} ${y - 5} ${x + 180} ${y + 25} Q ${x + 150} ${y + 55} ${x + 85} ${y + 50} Z`}
            fill="#e9c9a0"
            stroke="#3e2617"
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <circle cx={x + 182} cy={y + 24} r={10} fill="#22302a" />
          <circle cx={x + 135} cy={y + 5} r={8} fill="#22302a" />
          <circle cx={x + 137} cy={y + 2} r={2.5} fill="#fff" />
          <ellipse cx={x + 130} cy={y + 30} rx={12} ry={7} fill="#f2a3a3" opacity={0.8} />
          <path
            d={happy ? `M ${x + 150} ${y + 32} Q ${x + 162} ${y + 44} ${x + 172} ${y + 34}` : `M ${x + 152} ${y + 38} Q ${x + 162} ${y + 42} ${x + 170} ${y + 37}`}
            fill="none"
            stroke="#22302a"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <ellipse cx={x + 100} cy={y - 28} rx={14} ry={11} fill="#c99a6c" stroke="#3e2617" strokeWidth={3} />
        </g>
      </g>
    </svg>
  );
}
