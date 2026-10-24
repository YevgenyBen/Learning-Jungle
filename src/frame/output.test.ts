import { describe, expect, it } from "vitest";
import { contentBank, type SpokenItem } from "@/content";
import type { GameRequest, SoundEffect } from "@/games/contract";
import type { SoundEffects } from "@/sound/soundEffects";
import { createVoicePlayer, type ClipAudio } from "@/voice/voicePlayer";
import { createGameOutput } from "./output";

// Mute at the Game output: the model's `say` and `sound` requests go
// through it to the voice player and Sound Effects. The voice player is the
// real one, with a stand-in audio element; Sound Effects are a stand-in.

const alef = contentBank.letter("א")!;
const word = contentBank.words()[0];
const say = (item: SpokenItem, interrupt: boolean): GameRequest => ({ kind: "say", item, interrupt });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function setUp() {
  const played: string[] = [];
  let pauses = 0;
  const audio: ClipAudio = {
    src: "",
    onended: null,
    onerror: null,
    play: () => {
      played.push(audio.src);
      return Promise.resolve();
    },
    pause: () => {
      pauses += 1;
    },
  };
  const voice = createVoicePlayer({
    loadManifest: async () => ({ clips: { [alef.id]: { file: "alef.wav" }, [word.id]: { file: "word.wav" } } }),
    audio: () => audio,
    speech: null,
  });
  const effectsPlayed: SoundEffect[] = [];
  const effects: SoundEffects = { play: (e) => effectsPlayed.push(e), unlock() {}, stop() {} };
  const output = createGameOutput({ effects, voice });
  await settle();
  return {
    output,
    voice,
    clipsPlayed: () => played.filter((src) => src.startsWith("/voice/")),
    pauses: () => pauses,
    effectsPlayed,
    finishClip: () => audio.onended?.(),
  };
}

describe("mute silences the voice and Sound Effects alike", () => {
  it("while muted, neither Letter Names, Words nor Sound Effects are heard", async () => {
    const { output, voice, clipsPlayed, effectsPlayed } = await setUp();
    output.setMuted(true);

    output.carryOut([say(alef, true), { kind: "sound", effect: "collect" }, say(word, false)]);
    await settle();

    expect(clipsPlayed()).toEqual([]);
    expect(voice.said()).toEqual([]);
    expect(effectsPlayed).toEqual([]);
  });

  it("muting cuts off the letter being said and the Word waiting behind it", async () => {
    const { output, clipsPlayed, pauses, finishClip } = await setUp();

    output.carryOut([say(alef, true), say(word, false)]);
    output.setMuted(true);
    finishClip();
    await settle();

    expect(pauses()).toBeGreaterThan(0);
    expect(clipsPlayed()).toEqual(["/voice/alef.wav"]);
  });

  it("after unmuting, the next letter is heard again", async () => {
    const { output, voice } = await setUp();
    output.setMuted(true);
    output.carryOut([say(alef, true)]);
    output.setMuted(false);

    output.carryOut([say(alef, true)]);
    await settle();

    expect(voice.said()).toEqual([{ id: alef.id, via: "clip" }]);
  });
});
