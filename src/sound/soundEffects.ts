/**
 * Sound Effects: the short non-speech sounds of every Game, by name.
 *
 * For now each effect is made in code with Web Audio (as in the prototype):
 * a few short tones. Any effect can later become an audio file by changing
 * only this module; Games and the Game Frame just name the effect.
 *
 * Sound is optional (ADR-0004): where Web Audio is missing, locked or
 * failing, every call quietly does nothing and nothing ever waits for it.
 */
import type { SoundEffect } from "@/games/contract";

export interface SoundEffects {
  /** Plays the effect now, or silently does nothing if audio isn't available. */
  play(effect: SoundEffect): void;
  /**
   * Call from inside a Player's tap, click or key handler. iPhone and iPad
   * keep audio locked until a gesture lets it start; this uses the gestures
   * the Player makes anyway and never asks for one.
   */
  unlock(): void;
  /** Cuts off any effect still sounding (mute, restart, leaving the Game). */
  stop(): void;
}

/** Makes the audio context, or returns null where there is no Web Audio. */
export type CreateAudioContext = () => AudioContext | null;

interface Tone {
  /** Seconds after the effect starts. */
  readonly at: number;
  /** Frequency glides from `from` to `to` Hz over `duration` seconds. */
  readonly from: number;
  readonly to: number;
  readonly duration: number;
  readonly wave: OscillatorType;
  readonly volume: number;
}

const tone = (from: number, to: number, duration: number, wave: OscillatorType, volume: number, at = 0): Tone => ({
  at,
  from,
  to,
  duration,
  wave,
  volume,
});

/** C5 E5 G5 C6, the prototype's Word-complete arpeggio. */
const ARPEGGIO = [523, 659, 784, 1047];

const RECIPES: Record<SoundEffect, readonly Tone[]> = {
  jump: [tone(380, 760, 0.14, "square", 0.045)],
  collect: [tone(880, 1320, 0.12, "sine", 0.06)],
  // Gentle on purpose (ADR-0005): a soft low "hm", not the prototype's buzz.
  mistake: [tone(330, 247, 0.18, "triangle", 0.05)],
  "challenge-complete": ARPEGGIO.map((f, i) => tone(f, f * 1.01, 0.18, "sine", 0.06, i * 0.09)),
  // The arpeggio, then a high, longer C-E-G chord.
  "round-complete": [
    ...ARPEGGIO.map((f, i) => tone(f, f * 1.01, 0.16, "sine", 0.06, i * 0.1)),
    ...[1047, 1319, 1568].map((f) => tone(f, f, 0.6, "sine", 0.04, 0.42)),
  ],
};

/** The browser's own audio context, if it has one (webkit prefix for older Safari). */
export const browserAudioContext: CreateAudioContext = () => {
  if (typeof window === "undefined") return null;
  const Context =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Context ? new Context() : null;
};

export function createSoundEffects(createContext: CreateAudioContext = browserAudioContext): SoundEffects {
  let context: AudioContext | null | undefined;
  const sounding = new Set<OscillatorNode>();

  /** The context, made on first use; null for good if it can't be made. */
  const audio = (): AudioContext | null => {
    if (context === undefined) {
      try {
        context = createContext();
      } catch {
        context = null;
      }
    }
    return context;
  };

  const resume = (ctx: AudioContext) => {
    try {
      void ctx.resume().catch(() => {});
    } catch {
      // Some browsers throw instead of rejecting; sound just stays off.
    }
  };

  const start = (ctx: AudioContext, { at, from, to, duration, wave, volume }: Tone) => {
    const begin = ctx.currentTime + at;
    const end = begin + duration;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(from, begin);
    oscillator.frequency.exponentialRampToValueAtTime(to, end);
    gain.gain.setValueAtTime(volume, begin);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    sounding.add(oscillator);
    oscillator.onended = () => sounding.delete(oscillator);
    oscillator.start(begin);
    oscillator.stop(end);
  };

  return {
    play(effect) {
      const ctx = audio();
      if (!ctx) return;
      // A locked context would play everything at once when it unlocks, so
      // an effect that can't sound now is simply skipped.
      if (ctx.state !== "running") {
        resume(ctx);
        return;
      }
      try {
        for (const t of RECIPES[effect]) start(ctx, t);
      } catch {
        // Sound is never worth an error.
      }
    },
    unlock() {
      const ctx = audio();
      if (ctx && ctx.state !== "running") resume(ctx);
    },
    stop() {
      for (const oscillator of sounding) {
        try {
          oscillator.stop();
        } catch {
          // Already stopped.
        }
      }
      sounding.clear();
    },
  };
}
