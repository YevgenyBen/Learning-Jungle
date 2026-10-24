/**
 * Where the Game Frame sends what a model asks to be heard: Sound Effects
 * and the voice player. Mute silences both. Nothing here ever waits for
 * sound (ADR-0004).
 */
import type { SpokenItem } from "@/content";
import type { GameRequest, SoundEffect } from "@/games/contract";
import type { SoundEffects } from "@/sound/soundEffects";

/**
 * Says items aloud: their Voice Clip, else Speech Fallback, else nothing
 * (ADR-0002). The Game Frame uses `createBrowserVoicePlayer()` from
 * src/voice/voicePlayer.ts.
 */
export interface VoicePlayer {
  /** `interrupt` stops whatever is being said; otherwise it queues behind it. */
  say(item: SpokenItem, interrupt: boolean): void;
  /** Stops speaking and drops anything queued. */
  stop(): void;
  /** Call from inside a Player's gesture, for browsers that keep audio locked until one. */
  unlock?(): void;
}

/** How many recent Sound Effects the test hook can see. */
const PLAYED_LOG_SIZE = 200;

export interface GameOutput {
  /** Carries out the model's `say` and `sound` requests (others are not for it). */
  carryOut(requests: readonly GameRequest[]): void;
  setMuted(muted: boolean): void;
  /** Cuts off anything still sounding: pause, restart, leaving the Game. */
  silence(): void;
  /** Lets locked audio start; call from inside a Player's tap, click or key. */
  unlock(): void;
  /** The Sound Effects played out loud (not silenced by mute), oldest first. For the test hook. */
  played(): SoundEffect[];
}

export function createGameOutput({ effects, voice }: { effects: SoundEffects; voice: VoicePlayer }): GameOutput {
  let muted = false;
  const played: SoundEffect[] = [];
  const silence = () => {
    effects.stop();
    voice.stop();
  };
  return {
    carryOut(requests) {
      if (muted) return;
      for (const request of requests) {
        if (request.kind === "sound") {
          effects.play(request.effect);
          played.push(request.effect);
          if (played.length > PLAYED_LOG_SIZE) played.shift();
        } else if (request.kind === "say") {
          voice.say(request.item, request.interrupt);
        }
      }
    },
    setMuted(next) {
      muted = next;
      if (muted) silence();
    },
    silence,
    unlock() {
      effects.unlock();
      voice.unlock?.();
    },
    played: () => [...played],
  };
}
