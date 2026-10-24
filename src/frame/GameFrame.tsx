"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { contentBank } from "@/content";
import type { GameModel, GameRequest, GameState, PlayerAction } from "@/games/contract";
import type { GameDefinition } from "@/games/definition";
import { createSoundEffects } from "@/sound/soundEffects";
import { FrameControls } from "./FrameControls";
import { useFrameKeys } from "./frameKeys";
import { createFrames, type FramePublisher } from "./frames";
import { useGameScreen } from "./fullScreen";
import styles from "./GameFrame.module.css";
import { createGameOutput, silentVoice, type GameOutput } from "./output";
import { PauseScreen } from "./PauseScreen";
import { installTestHook } from "./testHook";

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

/** One run of a Game's model, from its start or restart. */
interface RunningGame<S extends GameState> {
  /** Counts restarts, so a restarted Game's View starts fresh. */
  readonly run: number;
  readonly model: GameModel<S>;
  readonly frames: FramePublisher<S>;
  /** Recent requests, for the test hook. */
  readonly requestLog: GameRequest[];
  /** Hands the model's requests on and publishes its state to the View. */
  sync(): void;
}

function startGame<S extends GameState>(game: GameDefinition<S, string>, output: GameOutput, run: number) {
  const model = game.createModel({
    settings: { niqqud: true, difficulty: game.difficulties[0] },
    content: contentBank,
    random: Math.random,
  });
  const frames = createFrames(model.state());
  const requestLog: GameRequest[] = [];
  const running: RunningGame<S> = {
    run,
    model,
    frames,
    requestLog,
    sync() {
      const requests = model.takeRequests();
      // Sound Effects and voice; Celebrations are carried out by the screens.
      output.carryOut(requests);
      requestLog.push(...requests);
      if (requestLog.length > REQUEST_LOG_SIZE) requestLog.splice(0, requestLog.length - REQUEST_LOG_SIZE);
      frames.publish(model.state());
    },
  };
  return running;
}

/**
 * The Game Frame: the shared surround of every Game. It creates the Game's
 * model, runs time (or not, while paused), turns keys, taps and clicks into
 * Player actions, hands the Game's View the model's state, carries out the
 * model's requests, and holds the controls: back, pause, restart, mute.
 */
export function GameFrame<S extends GameState>({ game, name, backHref }: GameFrameProps<S>) {
  const router = useRouter();
  const [output] = useState(() => createGameOutput({ effects: createSoundEffects(), voice: silentVoice }));
  // The model starts in the browser only: it draws random Words, so a model
  // made while prerendering the page would not match the browser's.
  const [running, setRunning] = useState<RunningGame<S> | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setRunning(startGame(game, output, 0));
    return () => output.silence();
  }, [game, output]);
  useEffect(() => output.setMuted(muted), [output, muted]);
  // Pausing lets go of a held main action and cuts off sound in progress.
  useEffect(() => {
    if (!paused) return;
    running?.model.act({ kind: "main-release" });
    output.silence();
  }, [paused, running, output]);

  const restart = () => {
    output.silence();
    setRunning((current) => startGame(game, output, (current?.run ?? 0) + 1));
    setPaused(false);
  };
  const togglePause = () => setPaused((p) => !p);
  const toggleMute = () => setMuted((m) => !m);
  const act = (action: PlayerAction) => {
    if (!paused) running?.model.act(action);
  };

  useFrameKeys(
    {
      main(down) {
        if (!paused) act({ kind: down ? "main-press" : "main-release" });
        else if (down) setPaused(false);
      },
      move: (direction) => act({ kind: "move", direction }),
      togglePause,
      restart,
      toggleMute,
    },
    game.mainActionKeys,
  );
  useAutoPause(() => setPaused(true));
  useGameScreen();
  // Every tap, click or key may be the gesture that lets locked audio start.
  useEffect(() => {
    const unlock = () => output.unlock();
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, [output]);
  useTestHook(game, running, output, { paused, muted });

  return (
    <main className={styles.frame} aria-label={name} data-game={game.id}>
      <FrameControls
        onBack={() => router.push(backHref)}
        paused={paused}
        onPause={togglePause}
        onRestart={restart}
        muted={muted}
        onMute={toggleMute}
      />
      <div className={styles.stage}>
        {running && <Play key={running.run} game={game} running={running} paused={paused} />}
        {paused && <PauseScreen onResume={() => setPaused(false)} />}
      </div>
    </main>
  );
}

/** Pauses when the Player switches to another tab or app, or the window loses focus. */
function useAutoPause(pause: () => void): void {
  const latest = useRef(pause);
  useEffect(() => {
    latest.current = pause;
  });
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") latest.current();
    };
    const onBlur = () => latest.current();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
}

/** Lets Playwright see and drive the running Game (dev and test builds only). */
function useTestHook<S extends GameState>(
  game: GameDefinition<S, string>,
  running: RunningGame<S> | null,
  output: GameOutput,
  frame: { paused: boolean; muted: boolean },
): void {
  const latest = useRef(frame);
  useEffect(() => {
    latest.current = frame;
  });
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !running) return;
    const { model } = running;
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
      paused: () => latest.current.paused,
      muted: () => latest.current.muted,
      soundsPlayed: () => {
        running.sync();
        return output.played();
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
  }, [game, running, output]);
}

/** The running Game: time, pointer input on the play area, and the Game's View. */
function Play<S extends GameState>({
  game,
  running,
  paused,
}: {
  game: GameDefinition<S, string>;
  running: RunningGame<S>;
  paused: boolean;
}) {
  const { model, frames } = running;
  const pausedNow = useRef(paused);
  // Before the browser can run another frame: once the pause screen shows, time has stopped.
  useLayoutEffect(() => {
    pausedNow.current = paused;
  }, [paused]);

  // Time: one model step per animation frame, none while paused.
  useEffect(() => {
    let frame = 0;
    let last: number | null = null;
    const loop = (now: number) => {
      if (last !== null && !pausedNow.current) model.advance(Math.min(MAX_FRAME_STEP, (now - last) / 1000));
      last = now;
      running.sync();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running, model]);

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

  const onPointerDown = (event: ReactPointerEvent) => {
    if (!event.isPrimary || event.button > 0 || pausedNow.current) return;
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
