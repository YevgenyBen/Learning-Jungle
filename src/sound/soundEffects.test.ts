import { describe, expect, it } from "vitest";
import type { SoundEffect } from "@/games/contract";
import { createSoundEffects } from "./soundEffects";

const EFFECTS: SoundEffect[] = ["jump", "collect", "mistake", "challenge-complete", "round-complete"];

/**
 * A stand-in for the browser's Web Audio, recording the tones started on it.
 * `state` is "running" once audio is unlocked, "suspended" while locked.
 */
function fakeAudio(options: { state?: AudioContextState; resume?: () => Promise<void> } = {}) {
  const started: { stopped: boolean }[] = [];
  let resumes = 0;
  const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const context = {
    state: options.state ?? "running",
    currentTime: 0,
    destination: {},
    resume: () => {
      resumes += 1;
      return options.resume ? options.resume() : Promise.resolve();
    },
    createGain: () => ({ gain: param, connect() {} }),
    createOscillator: () => {
      const tone = { stopped: false };
      return {
        type: "sine",
        frequency: param,
        onended: null,
        connect() {},
        start: () => started.push(tone),
        stop: (when?: number) => {
          if (when === undefined) tone.stopped = true;
        },
      };
    },
  };
  return {
    create: () => context as unknown as AudioContext,
    started,
    resumes: () => resumes,
  };
}

describe("Sound Effects where Web Audio is unavailable", () => {
  it("every effect stays silent and nothing throws", () => {
    const effects = createSoundEffects(() => null);
    expect(() => {
      effects.unlock();
      for (const effect of EFFECTS) effects.play(effect);
      effects.stop();
    }).not.toThrow();
  });

  it("stays silent and error-free when the audio context can't be made", () => {
    const effects = createSoundEffects(() => {
      throw new Error("no audio here");
    });
    expect(() => {
      effects.unlock();
      for (const effect of EFFECTS) effects.play(effect);
      effects.stop();
    }).not.toThrow();
  });

  it("swallows errors Web Audio throws while playing", () => {
    const effects = createSoundEffects(
      () =>
        ({
          state: "running",
          currentTime: 0,
          createOscillator: () => {
            throw new Error("broken");
          },
        }) as unknown as AudioContext,
    );
    expect(() => effects.play("jump")).not.toThrow();
  });
});

describe("Sound Effects with Web Audio", () => {
  it("every named effect plays a sound", () => {
    for (const effect of EFFECTS) {
      const audio = fakeAudio();
      createSoundEffects(audio.create).play(effect);
      expect(audio.started.length, effect).toBeGreaterThan(0);
    }
  });

  it("while audio is locked, an effect is skipped rather than saved for later, and audio is asked to start", async () => {
    const audio = fakeAudio({ state: "suspended", resume: () => Promise.reject(new Error("needs a gesture")) });
    const effects = createSoundEffects(audio.create);

    effects.play("collect");
    await Promise.resolve();

    expect(audio.started).toEqual([]);
    expect(audio.resumes()).toBeGreaterThan(0);
  });

  it("unlocking from a Player's gesture asks locked audio to start", () => {
    const audio = fakeAudio({ state: "suspended" });
    createSoundEffects(audio.create).unlock();
    expect(audio.resumes()).toBe(1);
  });

  it("stop cuts off effects still sounding", () => {
    const audio = fakeAudio();
    const effects = createSoundEffects(audio.create);
    effects.play("round-complete");

    effects.stop();

    expect(audio.started.length).toBeGreaterThan(0);
    expect(audio.started.every((tone) => tone.stopped)).toBe(true);
  });
});
