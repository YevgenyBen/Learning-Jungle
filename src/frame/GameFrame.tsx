"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { contentBank } from "@/content";
import type { GameModel, GameRequest, GameState } from "@/games/contract";
import type { GameDefinition } from "@/games/definition";
import { createFrames, type FramePublisher } from "./frames";
import styles from "./GameFrame.module.css";
import { installTestHook } from "./testHook";

/** The shared main-action key; a Game may add its own (GameDefinition.mainActionKeys). */
const MAIN_ACTION_KEYS = ["Space"];
/** Longest time step per frame, so a stalled tab doesn't make the Game leap ahead. */
const MAX_FRAME_STEP = 0.033;
const HOOK_STEP = 1 / 60;
/** How many recent requests the test hook can see. */
const REQUEST_LOG_SIZE = 200;

export interface GameFrameProps<S extends GameState> {
  readonly game: GameDefinition<S, string>;
  /** The Game's Hebrew name, for the screen's accessible name. */
  readonly name: string;
  /** Where "back to Menu" goes: the Game's Subject Menu. */
  readonly backHref: string;
}

interface RunningGame<S extends GameState> {
  readonly model: GameModel<S>;
  readonly frames: FramePublisher<S>;
  /** Recent requests, for the test hook. */
  readonly requestLog: GameRequest[];
  /** Hands the model's requests on and publishes its state to the View. */
  sync(): void;
}

function startGame<S extends GameState>(game: GameDefinition<S, string>): RunningGame<S> {
  const model = game.createModel({
    settings: { niqqud: true, difficulty: game.difficulties[0] },
    content: contentBank,
    random: Math.random,
  });
  const frames = createFrames(model.state());
  const requestLog: GameRequest[] = [];
  return {
    model,
    frames,
    requestLog,
    sync() {
      // Requests are only logged for now: the Sound Effects module (#7) and
      // the voice player (#9) will carry them out here.
      requestLog.push(...model.takeRequests());
      if (requestLog.length > REQUEST_LOG_SIZE) requestLog.splice(0, requestLog.length - REQUEST_LOG_SIZE);
      frames.publish(model.state());
    },
  };
}

/**
 * The Game Frame: the shared surround of every Game. It creates the Game's
 * model, runs time, turns keys, taps and clicks into Player actions, hands
 * the Game's View the model's state, and carries out the model's requests.
 * For now its only control is "back to Menu".
 */
export function GameFrame<S extends GameState>({ game, name, backHref }: GameFrameProps<S>) {
  const router = useRouter();
  // The model starts in the browser only: it draws random Words, so a model
  // made while prerendering the page would not match the browser's.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main className={styles.frame} aria-label={name} data-game={game.id}>
      <header className={styles.controls}>
        <button type="button" className={styles.control} onClick={() => router.push(backHref)}>
          <span aria-hidden="true" className={styles.controlIcon}>
            ➜
          </span>
          <span className={styles.controlLabel}>חזרה</span>
        </button>
      </header>
      {mounted && <Play game={game} />}
    </main>
  );
}

/** The running Game: its model, time, input, the test hook, and its View. */
function Play<S extends GameState>({ game }: { game: GameDefinition<S, string> }) {
  const [running] = useState(() => startGame(game));
  const { model, frames } = running;

  // Time: one model step per animation frame.
  useEffect(() => {
    let frame = 0;
    let last: number | null = null;
    const loop = (now: number) => {
      if (last !== null) model.advance(Math.min(MAX_FRAME_STEP, (now - last) / 1000));
      last = now;
      running.sync();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running, model]);

  // Keys: the main action goes down on keydown and up on keyup.
  useEffect(() => {
    const keys = new Set([...MAIN_ACTION_KEYS, ...(game.mainActionKeys ?? [])]);
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || !keys.has(event.code)) return;
      // Also stops Space from pressing a focused control or scrolling.
      event.preventDefault();
      if (event.repeat) return;
      model.act({ kind: event.type === "keydown" ? "main-press" : "main-release" });
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [game, model]);

  // A press that starts on the play area may end anywhere.
  useEffect(() => {
    const release = () => model.act({ kind: "main-release" });
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [model]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const solveStep = () => {
      if (!game.testDriver) throw new Error(`${game.id} has no test driver`);
      game.testDriver.solveStep(model);
    };
    const andSync =
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        fn(...args);
        running.sync();
      };
    return installTestHook({
      gameId: game.id,
      state: () => model.state(),
      requests: () => {
        running.sync();
        return [...running.requestLog];
      },
      act: andSync((action) => model.act(action)),
      advance: andSync((seconds: number) => {
        for (let left = seconds; left > 1e-9; left -= HOOK_STEP) model.advance(Math.min(HOOK_STEP, left));
      }),
      solveStep: andSync(solveStep),
      completeChallenge: andSync(() => {
        const done = model.state().progress.completed;
        while (model.state().progress.completed === done) solveStep();
      }),
    });
  }, [game, model, running]);

  const onPointerDown = (event: ReactPointerEvent) => {
    if (!event.isPrimary || event.button > 0) return;
    event.preventDefault();
    model.act({ kind: "main-press" });
  };

  const View = game.View;
  return (
    <div className={styles.surface} onPointerDown={onPointerDown} data-testid="game-surface">
      <View frames={frames} />
    </div>
  );
}
