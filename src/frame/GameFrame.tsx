"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { contentBank } from "@/content";
import type { GameModel, GameRequest, GameSettings, GameState, PlayerAction } from "@/games/contract";
import type { GameDefinition } from "@/games/definition";
import { createSoundEffects } from "@/sound/soundEffects";
import { FrameControls } from "./FrameControls";
import { useFrameKeys } from "./frameKeys";
import { createTicks, type TickPublisher } from "./ticks";
import { useGameScreen } from "./fullScreen";
import styles from "./GameFrame.module.css";
import { createBrowserVoicePlayer, type VoicePlayerWithLog } from "@/voice/voicePlayer";
import { createGameOutput, type GameOutput } from "./output";
import { PauseScreen } from "./PauseScreen";
import { usePreferences, type Preferences } from "./preferences";
import { RoundCelebration } from "./RoundCelebration";
import { SettingsControls } from "./SettingsControls";
import { createHookLog, installTestHook, type HookLog } from "./testHook";

/** Longest time step per tick, so a stalled tab doesn't make the Game leap ahead. */
const MAX_TICK_STEP = 0.033;
const HOOK_STEP = 1 / 60;

export interface GameFrameProps<S extends GameState> {
  readonly game: GameDefinition<S, string>;
  /** Where "back to Menu" goes: the Game's Subject Menu. */
  readonly backHref: string;
}

/** One run of a Game's model, from its start or restart. */
interface RunningGame<S extends GameState> {
  /** Counts restarts, so a restarted Game's View starts fresh. */
  readonly run: number;
  readonly model: GameModel<S>;
  readonly ticks: TickPublisher<S>;
  /** Recent requests, for the test hook. */
  readonly requestLog: HookLog<GameRequest>;
  /** Hands the model's requests on and publishes its state to the View. */
  sync(): void;
}

const settingsOf = ({ niqqud, difficulty }: Preferences): GameSettings => ({ niqqud, difficulty });

function startGame<S extends GameState>(
  game: GameDefinition<S, string>,
  output: GameOutput,
  run: number,
  settings: GameSettings,
) {
  const model = game.createModel({
    settings,
    content: contentBank,
    random: Math.random,
  });
  const ticks = createTicks(model.state());
  const requestLog = createHookLog<GameRequest>();
  const running: RunningGame<S> = {
    run,
    model,
    ticks,
    requestLog,
    sync() {
      const requests = model.takeRequests();
      // Sound Effects, voice and the Round Celebration screen.
      output.carryOut(requests);
      requestLog.push(...requests);
      ticks.publish(model.state());
    },
  };
  return running;
}

/**
 * The Game Frame: the shared surround of every Game. It creates the Game's
 * model, runs time (or not, while paused), turns keys, taps and clicks into
 * Player actions, hands the Game's View the model's state, carries out the
 * model's requests, and holds the controls: back, pause, restart, mute,
 * Niqqud and Difficulty, remembering mute, Niqqud and Difficulty on the
 * device.
 */
export function GameFrame<S extends GameState>({ game, backHref }: GameFrameProps<S>) {
  const router = useRouter();
  const [voice] = useState(createBrowserVoicePlayer);
  // Shown when the model asks for the Round's Celebration, until another Round or a restart.
  const [roundCelebration, setRoundCelebration] = useState(false);
  const [output] = useState(() =>
    createGameOutput({
      effects: createSoundEffects(),
      voice,
      celebrate: (celebration) => {
        if (celebration === "round") setRoundCelebration(true);
      },
    }),
  );
  // The model starts in the browser only: it draws random Words, so a model
  // made while prerendering the page would not match the browser's.
  const [running, setRunning] = useState<RunningGame<S> | null>(null);
  const [paused, setPaused] = useState(false);
  // Mute, Niqqud and Difficulty, as remembered on this device (null until read).
  const [preferences, changePreferences] = usePreferences(game.id, game.difficulties);
  const muted = preferences?.muted ?? false;
  const loaded = preferences !== null;
  const latestPreferences = useRef(preferences);
  useEffect(() => {
    latestPreferences.current = preferences;
  });

  useEffect(() => {
    if (!loaded) return;
    setRunning(startGame(game, output, 0, settingsOf(latestPreferences.current!)));
    setRoundCelebration(false);
    return () => output.silence();
  }, [game, output, loaded]);
  useEffect(() => output.setMuted(muted), [output, muted]);
  // A change of Niqqud or Difficulty applies to the running model.
  const niqqud = preferences?.niqqud;
  const difficulty = preferences?.difficulty;
  useEffect(() => {
    if (niqqud !== undefined && difficulty !== undefined) running?.model.configure({ niqqud, difficulty });
  }, [running, niqqud, difficulty]);
  // Pausing lets go of a held main action and cuts off sound in progress.
  useEffect(() => {
    if (!paused) return;
    running?.model.act({ kind: "main-release" });
    output.silence();
  }, [paused, running, output]);

  // Restart makes a fresh model: nothing the Game adjusted to the Player carries on.
  const restart = () => {
    if (!preferences) return;
    output.silence();
    const settings = settingsOf(preferences);
    setRunning((current) => startGame(game, output, (current?.run ?? 0) + 1, settings));
    setRoundCelebration(false);
    setPaused(false);
  };
  // Another Round goes on with the same model, so automatic Difficulty carries on.
  const anotherRound = () => {
    if (!running) return;
    output.silence();
    running.model.nextRound();
    running.sync();
    setRoundCelebration(false);
    setPaused(false);
  };
  const togglePause = () => setPaused((p) => !p);
  const toggleMute = () => changePreferences((p) => ({ muted: !p.muted }));
  const toggleNiqqud = () => changePreferences((p) => ({ niqqud: !p.niqqud }));
  const nextDifficulty = () =>
    changePreferences((p) => {
      const options = game.difficulties;
      return { difficulty: options[(options.indexOf(p.difficulty) + 1) % options.length] };
    });
  const act = (action: PlayerAction) => {
    if (!paused) running?.model.act(action);
  };
  // While the Round Celebration screen shows, it takes the keys: Enter and
  // Space pick its focused option instead of restarting or jumping.
  const roundOver = roundCelebration;

  useFrameKeys(
    {
      main(down) {
        if (roundOver) return;
        if (!paused) act({ kind: down ? "main-press" : "main-release" });
        else if (down) setPaused(false);
      },
      move: (direction) => act({ kind: "move", direction }),
      togglePause: () => {
        if (!roundOver) togglePause();
      },
      restart: () => {
        if (!roundOver) restart();
      },
      toggleMute,
      toggleNiqqud,
      nextDifficulty,
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
  useTestHook(game, running, output, voice, { paused, muted });

  return (
    <main className={styles.frame} aria-label={game.name} data-game={game.id}>
      <FrameControls
        onBack={() => router.push(backHref)}
        paused={paused}
        onPause={togglePause}
        onRestart={restart}
        muted={muted}
        onMute={toggleMute}
        settings={
          <SettingsControls
            control={game.difficultyControl}
            niqqud={preferences?.niqqud ?? true}
            onNiqqud={toggleNiqqud}
            difficulty={preferences?.difficulty ?? game.difficulties[0]}
            onDifficulty={nextDifficulty}
          />
        }
      />
      <div className={styles.stage}>
        {running && <Play key={running.run} game={game} running={running} paused={paused} />}
        {paused && !roundOver && <PauseScreen onResume={() => setPaused(false)} />}
        {roundOver && <RoundCelebration onAnotherRound={anotherRound} onBack={() => router.push(backHref)} />}
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
  voice: VoicePlayerWithLog,
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
        return running.requestLog.entries();
      },
      paused: () => latest.current.paused,
      muted: () => latest.current.muted,
      soundsPlayed: () => {
        running.sync();
        return output.played();
      },
      voiceSaid: () => {
        running.sync();
        return voice.said();
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
  }, [game, running, output, voice]);
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
  const { model, ticks } = running;
  const pausedNow = useRef(paused);
  // Before the browser can run another frame: once the pause screen shows, time has stopped.
  useLayoutEffect(() => {
    pausedNow.current = paused;
  }, [paused]);

  // Time: one model step per animation frame, none while paused.
  useEffect(() => {
    let request = 0;
    let last: number | null = null;
    const loop = (now: number) => {
      if (last !== null && !pausedNow.current) model.advance(Math.min(MAX_TICK_STEP, (now - last) / 1000));
      last = now;
      running.sync();
      request = requestAnimationFrame(loop);
    };
    request = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(request);
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

  // The View's own controls (a tapped Choice); stable for the run, like `ticks`.
  const [act] = useState(() => (action: PlayerAction) => {
    if (!pausedNow.current) model.act(action);
  });

  const View = game.View;
  return (
    <div className={styles.surface} onPointerDown={onPointerDown} data-testid="game-surface">
      <View ticks={ticks} act={act} />
    </div>
  );
}
