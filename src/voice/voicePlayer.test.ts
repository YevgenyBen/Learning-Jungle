import { describe, expect, it } from "vitest";
import { contentBank, type SpokenItem } from "@/content";
import { createVoicePlayer, type ClipAudio, type SpeechSynthesisLike, type UtteranceLike } from "./voicePlayer";

// The voice player at its interface: `say`, `stop` and `unlock`, with the
// audio element and the device's speech synthesis replaced by stand-ins
// that record what they were asked to play or speak.

const alef = contentBank.letter("א")!;
const bet = contentBank.letter("ב")!;
const gimel = contentBank.letter("ג")!;
const word = contentBank.words()[0];

/** A Voice Clip that exists only for these tests. */
const TEST_CLIP = "test-clip.wav";

/** A stand-in for one <audio> element. `finish()` ends what it's playing. */
function fakeAudio(options: { play?: () => Promise<void> } = {}) {
  const played: string[] = [];
  let pauses = 0;
  const audio: ClipAudio = {
    src: "",
    onended: null,
    onerror: null,
    play() {
      played.push(audio.src);
      return options.play ? options.play() : Promise.resolve();
    },
    pause() {
      pauses += 1;
    },
  };
  return {
    create: () => audio,
    played,
    pauses: () => pauses,
    finish: () => audio.onended?.(),
    fail: () => audio.onerror?.(),
  };
}

interface FakeVoice {
  readonly lang: string;
  readonly name: string;
}

/** A stand-in for speechSynthesis with the given device voices. */
function fakeSpeech(voices: FakeVoice[] = [{ lang: "he-IL", name: "Carmit" }]) {
  const spoken: UtteranceLike[] = [];
  let cancels = 0;
  const synthesis: SpeechSynthesisLike = {
    speak: (utterance) => spoken.push(utterance),
    cancel: () => {
      cancels += 1;
    },
    getVoices: () => voices as unknown as SpeechSynthesisVoice[],
  };
  const utterance = (text: string): UtteranceLike => ({ text, lang: "", voice: null, onend: null, onerror: null });
  return {
    speech: { synthesis, utterance },
    spoken,
    texts: () => spoken.map((u) => u.text),
    cancels: () => cancels,
    finish: () => spoken.at(-1)?.onend?.(),
  };
}

/** A manifest listing a clip for each of these items, named by the item's identity. */
const manifestFor = (...items: SpokenItem[]) => ({
  clips: Object.fromEntries(items.map((item) => [item.id, { file: `${item.id}.wav` }])),
});
const clipOf = (item: SpokenItem) => `/voice/${item.id}.wav`;

/** Lets the manifest load and pending play() promises settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the voice player picks a Voice Clip, else Speech Fallback, else silence", () => {
  it("plays the item's Voice Clip when the manifest lists one, and doesn't use the device's voice", async () => {
    const audio = fakeAudio();
    const speech = fakeSpeech();
    const voice = createVoicePlayer({
      loadManifest: async () => ({ clips: { [alef.id]: { file: TEST_CLIP } } }),
      audio: audio.create,
      speech: speech.speech,
    });
    await settle();

    voice.say(alef, true);
    await settle();

    expect(audio.played).toEqual([`/voice/${TEST_CLIP}`]);
    expect(speech.spoken).toEqual([]);
    expect(voice.said()).toEqual([{ id: alef.id, via: "clip" }]);
  });

  it("reads the item's voweled text with the device's Hebrew voice when the manifest has no clip for it", async () => {
    const audio = fakeAudio();
    const speech = fakeSpeech([
      { lang: "en-US", name: "Samantha" },
      { lang: "he-IL", name: "Carmit" },
    ]);
    const voice = createVoicePlayer({
      loadManifest: async () => manifestFor(bet),
      audio: audio.create,
      speech: speech.speech,
    });
    await settle();

    voice.say(alef, true);

    expect(audio.played).toEqual([]);
    expect(speech.texts()).toEqual([alef.voweledText]);
    expect(speech.spoken[0].voice).toMatchObject({ name: "Carmit" });
    expect(speech.spoken[0].lang).toBe("he-IL");
    expect(voice.said()).toEqual([{ id: alef.id, via: "speech" }]);
  });

  it.each([
    ["the device has no Hebrew voice", () => fakeSpeech([{ lang: "en-US", name: "Samantha" }]).speech],
    ["the device has no voices at all", () => fakeSpeech([]).speech],
    ["the browser has no speech synthesis", () => null],
  ])("stays silent without errors when there is no clip and %s", async (_, speech) => {
    const audio = fakeAudio();
    const voice = createVoicePlayer({ loadManifest: async () => manifestFor(), audio: audio.create, speech: speech() });
    await settle();

    expect(() => {
      voice.unlock();
      voice.say(alef, true);
      voice.say(word, false);
      voice.say(bet, true);
      voice.stop();
    }).not.toThrow();
    await settle();

    expect(audio.played.filter((src) => src.startsWith("/voice/"))).toEqual([]);
    expect(voice.said()).toEqual([]);
  });

  it("stays silent without errors when a clip is listed but the browser has no audio element and no Hebrew voice", async () => {
    const voice = createVoicePlayer({
      loadManifest: async () => manifestFor(alef),
      audio: () => null,
      speech: fakeSpeech([]).speech,
    });
    await settle();

    expect(() => voice.say(alef, true)).not.toThrow();
    await settle();
    expect(voice.said()).toEqual([]);
  });

  it.each([
    ["can't be fetched", () => Promise.reject(new Error("offline"))],
    ["isn't a manifest", async () => ["not", "a", "manifest"]],
    ["lists a clip without a file", async () => ({ clips: { [alef.id]: { text: "x" } } })],
  ])("falls back to the device's voice when the manifest %s", async (_, loadManifest) => {
    const audio = fakeAudio();
    const speech = fakeSpeech();
    const voice = createVoicePlayer({ loadManifest, audio: audio.create, speech: speech.speech });
    await settle();

    voice.say(alef, true);
    await settle();

    expect(audio.played).toEqual([]);
    expect(speech.texts()).toEqual([alef.voweledText]);
  });

  it("uses Speech Fallback for anything said before the manifest has loaded, and clips once it has", async () => {
    const audio = fakeAudio();
    const speech = fakeSpeech();
    let loaded: (manifest: unknown) => void = () => {};
    const voice = createVoicePlayer({
      loadManifest: () => new Promise((resolve) => (loaded = resolve)),
      audio: audio.create,
      speech: speech.speech,
    });

    voice.say(alef, true);
    expect(speech.texts()).toEqual([alef.voweledText]);

    loaded(manifestFor(bet));
    await settle();
    voice.say(bet, true);
    await settle();
    expect(audio.played).toEqual([clipOf(bet)]);
  });
});

/** A voice player whose manifest lists clips for these items, with stand-ins for audio and speech. */
async function playerWithClipsFor(...items: SpokenItem[]) {
  const audio = fakeAudio();
  const speech = fakeSpeech();
  const voice = createVoicePlayer({
    loadManifest: async () => manifestFor(...items),
    audio: audio.create,
    speech: speech.speech,
  });
  await settle();
  return { voice, audio, speech };
}

describe("a newer letter interrupts; the Word waits for its last letter", () => {
  it("a second letter cuts off the first letter's clip and plays at once", async () => {
    const { voice, audio } = await playerWithClipsFor(alef, bet);

    voice.say(alef, true);
    voice.say(bet, true);
    await settle();

    expect(audio.played).toEqual([clipOf(alef), clipOf(bet)]);
    expect(audio.pauses()).toBeGreaterThan(0);
  });

  it("the Word waits until its last letter's clip has ended, then plays", async () => {
    const { voice, audio } = await playerWithClipsFor(alef, word);

    voice.say(alef, true);
    voice.say(word, false);
    await settle();
    expect(audio.played).toEqual([clipOf(alef)]);

    audio.finish();
    await settle();
    expect(audio.played).toEqual([clipOf(alef), clipOf(word)]);
    expect(voice.said().map((s) => s.id)).toEqual([alef.id, word.id]);
  });

  it("the Word waits for its last letter read by Speech Fallback too", async () => {
    const { voice, speech } = await playerWithClipsFor();

    voice.say(alef, true);
    voice.say(word, false);
    expect(speech.texts()).toEqual([alef.voweledText]);

    speech.finish();
    expect(speech.texts()).toEqual([alef.voweledText, word.voweledText]);
  });

  it("a letter read by Speech Fallback is cut off by the next one", async () => {
    const { voice, speech } = await playerWithClipsFor();

    voice.say(alef, true);
    voice.say(bet, true);

    expect(speech.cancels()).toBeGreaterThan(0);
    expect(speech.texts()).toEqual([alef.voweledText, bet.voweledText]);
  });

  it("something said without interrupting plays at once when nothing is being said", async () => {
    const { voice, audio } = await playerWithClipsFor(word);

    voice.say(word, false);
    await settle();

    expect(audio.played).toEqual([clipOf(word)]);
  });

  it("a newer letter drops a Word still waiting behind the previous letter", async () => {
    const { voice, audio } = await playerWithClipsFor(alef, bet, word);

    voice.say(alef, true);
    voice.say(word, false);
    voice.say(bet, true);
    audio.finish();
    await settle();

    expect(audio.played).toEqual([clipOf(alef), clipOf(bet)]);
  });

  it("the end of an interrupted letter doesn't let the waiting Word start early", async () => {
    const { voice, speech } = await playerWithClipsFor();

    voice.say(alef, true);
    const first = speech.spoken[0];
    voice.say(bet, true);
    voice.say(word, false);
    // Browsers report a cancelled utterance as ended or failed, a little later.
    first.onend?.();
    first.onerror?.();

    expect(speech.texts()).toEqual([alef.voweledText, bet.voweledText]);
    speech.finish();
    expect(speech.texts()).toEqual([alef.voweledText, bet.voweledText, word.voweledText]);
  });

  it("a clip that fails to load is read by Speech Fallback instead, and what waits behind it still follows", async () => {
    const { voice, audio, speech } = await playerWithClipsFor(alef, word);

    voice.say(alef, true);
    voice.say(word, false);
    audio.fail();
    expect(speech.texts()).toEqual([alef.voweledText]);

    speech.finish();
    await settle();
    expect(audio.played).toEqual([clipOf(alef), clipOf(word)]);
  });

  it("a clip the browser won't play yet (audio still locked) is skipped silently and the Word still gets its turn", async () => {
    const locked = Object.assign(new Error("locked"), { name: "NotAllowedError" });
    const audio = fakeAudio({ play: () => Promise.reject(locked) });
    const speech = fakeSpeech();
    const voice = createVoicePlayer({
      loadManifest: async () => manifestFor(alef, word),
      audio: audio.create,
      speech: speech.speech,
    });
    await settle();

    voice.say(alef, true);
    voice.say(word, false);
    await settle();

    expect(audio.played).toEqual([clipOf(alef), clipOf(word)]);
    expect(speech.spoken).toEqual([]);
    expect(voice.said()).toEqual([]);
  });
});

describe("stopping and unlocking", () => {
  it("stop cuts off what is being said and drops what was waiting", async () => {
    const { voice, audio, speech } = await playerWithClipsFor(alef, word);

    voice.say(alef, true);
    voice.say(word, false);
    voice.stop();
    audio.finish();
    await settle();

    expect(audio.pauses()).toBeGreaterThan(0);
    expect(audio.played).toEqual([clipOf(alef)]);
    expect(speech.spoken).toEqual([]);
    expect(voice.said()).toEqual([]);
  });

  it("after stopping, the next item plays as usual", async () => {
    const { voice, audio } = await playerWithClipsFor(alef, bet);

    voice.say(alef, true);
    voice.stop();
    voice.say(bet, false);
    await settle();

    expect(audio.played).toEqual([clipOf(alef), clipOf(bet)]);
  });

  it("unlock starts the audio element and speech synthesis once, from inside the Player's gesture", async () => {
    const { voice, audio, speech } = await playerWithClipsFor(alef);

    voice.unlock();
    await settle();
    voice.unlock();
    await settle();

    expect(audio.played).toHaveLength(1);
    expect(speech.texts()).toEqual([""]);
    expect(voice.said()).toEqual([]);
  });

  it("unlock never cuts off what is being said", async () => {
    const { voice, audio, speech } = await playerWithClipsFor(alef);

    voice.say(alef, true);
    const [pauses, cancels] = [audio.pauses(), speech.cancels()];
    voice.unlock();
    await settle();

    expect(audio.played).toEqual([clipOf(alef)]);
    expect(audio.pauses()).toBe(pauses);
    expect(speech.cancels()).toBe(cancels);
    expect(voice.said()).toEqual([{ id: alef.id, via: "clip" }]);
  });

  it("unlock tries again on the next gesture while audio is still locked", async () => {
    const locked = Object.assign(new Error("locked"), { name: "NotAllowedError" });
    const audio = fakeAudio({ play: () => Promise.reject(locked) });
    const voice = createVoicePlayer({ loadManifest: async () => manifestFor(), audio: audio.create, speech: null });
    await settle();

    voice.unlock();
    await settle();
    voice.unlock();
    await settle();

    expect(audio.played).toHaveLength(2);
  });
});
