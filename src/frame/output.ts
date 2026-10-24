/**
 * Where the Game Frame carries out a model's requests: what is to be heard
 * goes to Sound Effects and the voice player, Celebrations to the Frame's
 * screens. Mute silences sound only; a Celebration is always seen
 * (ADR-0004). Nothing here ever waits for sound.
 */
import type { CelebrationKind, GameRequest, SoundEffect } from "@/games/contract";
import type { SoundEffects } from "@/sound/soundEffects";
import type { VoicePlayer } from "@/voice/voicePlayer";
import { createHookLog } from "./testHook";

export interface GameOutput {
  /** Carries out the model's requests, oldest first. */
  carryOut(requests: readonly GameRequest[]): void;
  setMuted(muted: boolean): void;
  /** Cuts off anything still sounding: pause, restart, leaving the Game. */
  silence(): void;
  /** Lets locked audio start; call from inside a Player's tap, click or key. */
  unlock(): void;
  /** The Sound Effects played out loud (not silenced by mute), oldest first. For the test hook. */
  played(): SoundEffect[];
}

export interface GameOutputDeps {
  readonly effects: SoundEffects;
  readonly voice: VoicePlayer;
  /**
   * Carries out a `celebrate` request. The Game Frame shows its Round
   * Celebration screen for "round"; a Game draws its own Challenge
   * Celebration from its state.
   */
  readonly celebrate: (celebration: CelebrationKind) => void;
}

export function createGameOutput({ effects, voice, celebrate }: GameOutputDeps): GameOutput {
  let muted = false;
  const played = createHookLog<SoundEffect>();
  const silence = () => {
    effects.stop();
    voice.stop();
  };
  return {
    carryOut(requests) {
      for (const request of requests) {
        if (request.kind === "celebrate") {
          celebrate(request.celebration);
        } else if (muted) {
          continue;
        } else if (request.kind === "sound") {
          effects.play(request.effect);
          played.push(request.effect);
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
    played: () => played.entries(),
  };
}
