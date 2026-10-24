/**
 * The voice player: says Content Bank items aloud (ADR-0002). An item is
 * played from its Voice Clip when the Voice Clip manifest lists one, else
 * read by Speech Fallback with a Hebrew device voice if the device has one,
 * else skipped silently. Nothing ever waits for it (ADR-0004).
 *
 * The Voice Clip manifest is `public/voice/manifest.json`, written by the
 * clip generation script. It lists the clips by item identity, each with
 * the name of its audio file in `public/voice/` (no folders):
 *
 *   { "clips": { "letter-alef": { "file": "letter-alef.mp3" }, ... } }
 *
 * An item missing from `clips` has no Voice Clip. The player reads only
 * `file`; other fields on a clip are free for the script's own use.
 */
import type { ItemId, SpokenItem } from "@/content";

/** Where Voice Clips and their manifest are served from (`public/voice/`). */
export const VOICE_DIR = "/voice/";

/** An event handler; the voice player ignores the event, so any event fits. */
type Handler = ((...event: never[]) => void) | null;

/** The parts of an <audio> element the voice player uses. */
export interface ClipAudio {
  src: string;
  play(): Promise<void> | void;
  pause(): void;
  onended: Handler;
  onerror: Handler;
}

/** The parts of `speechSynthesis` the voice player uses. */
export interface SpeechSynthesisLike {
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  getVoices(): readonly SpeechSynthesisVoice[];
}

/** The parts of a `SpeechSynthesisUtterance` the voice player uses. */
export interface UtteranceLike {
  text: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  onend: Handler;
  onerror: Handler;
}

export interface SpeechFallback {
  readonly synthesis: SpeechSynthesisLike;
  readonly utterance: (text: string) => UtteranceLike;
}

/** How an item was said: from its Voice Clip or by Speech Fallback. */
export interface Said {
  readonly id: ItemId;
  readonly via: "clip" | "speech";
}

/** The Game Frame's `VoicePlayer` (src/frame/output.ts), plus a log for the test hook. */
export interface VoicePlayerWithLog {
  /** `interrupt` cuts off whatever is being said and drops what waits; otherwise it waits its turn. */
  say(item: SpokenItem, interrupt: boolean): void;
  /** Cuts off what is being said and drops what waits. */
  stop(): void;
  unlock(): void;
  /** What was said out loud, oldest first (the last 200). */
  said(): Said[];
}

export interface VoicePlayerDeps {
  /** Fetches the Voice Clip manifest (parsed JSON, any shape; a bad one counts as empty). */
  readonly loadManifest: () => Promise<unknown>;
  /** Makes the one audio element clips play on, or null where there is none. */
  readonly audio: () => ClipAudio | null;
  /** The device's speech synthesis, or null where there is none. */
  readonly speech: SpeechFallback | null;
}

interface Clip {
  readonly file: string;
}

/** The clips a manifest lists, skipping anything that isn't a clip; a bad manifest lists none. */
function readManifest(manifest: unknown): Map<ItemId, Clip> {
  const clips = new Map<ItemId, Clip>();
  const listed = (manifest as { clips?: unknown } | null)?.clips;
  if (typeof listed !== "object" || listed === null || Array.isArray(listed)) return clips;
  for (const [id, clip] of Object.entries(listed)) {
    const file = (clip as { file?: unknown } | null)?.file;
    if (typeof file === "string" && file !== "") clips.set(id, { file });
  }
  return clips;
}

export function createVoicePlayer({ loadManifest, audio: createAudio, speech }: VoicePlayerDeps): VoicePlayerWithLog {
  // Until the manifest has loaded, everything goes to Speech Fallback.
  let clips = new Map<ItemId, Clip>();
  try {
    loadManifest().then(
      (manifest) => (clips = readManifest(manifest)),
      () => {},
    );
  } catch {
    // No manifest: Speech Fallback for everything.
  }
  const audio = safely(createAudio, null);
  const said: Said[] = [];
  /** What is being said now; anything reported about an older one is ignored. */
  let current: object | null = null;
  /** Items waiting for the current one to end. */
  const queue: SpokenItem[] = [];
  let audioUnlocked = false;
  let speechUnlocked = false;

  const record = (entry: Said) => {
    said.push(entry);
    if (said.length > SAID_LOG_SIZE) said.shift();
  };

  /** Says the next waiting item, once the one behind `playing` has ended. */
  const ended = (playing: object) => {
    if (playing !== current) return;
    current = null;
    const next = queue.shift();
    if (next) start(next);
  };

  const start = (item: SpokenItem) => {
    const playing = {};
    current = playing;
    const clip = clips.get(item.id);
    if (clip && audio) playClip(item, clip, playing);
    else speak(item, playing);
  };

  const playClip = (item: SpokenItem, clip: Clip, playing: object) => {
    if (!audio) return;
    let fellBack = false;
    // A clip that can't be loaded or decoded is read by Speech Fallback instead.
    const fallBack = () => {
      if (playing !== current || fellBack) return;
      fellBack = true;
      speak(item, playing);
    };
    audio.onended = () => ended(playing);
    audio.onerror = fallBack;
    try {
      audio.src = VOICE_DIR + clip.file;
      Promise.resolve(audio.play()).then(
        () => {
          if (playing === current && !fellBack) record({ id: item.id, via: "clip" });
        },
        (error: unknown) => {
          // Audio still locked (iPhone, iPad, before the first touch): skip it.
          if ((error as { name?: string } | null)?.name === "NotAllowedError") ended(playing);
          else fallBack();
        },
      );
    } catch {
      fallBack();
    }
  };

  const speak = (item: SpokenItem, playing: object) => {
    const voice = speech && safely(() => speech.synthesis.getVoices().find(isHebrew), undefined);
    if (!speech || !voice) return ended(playing);
    try {
      const utterance = speech.utterance(item.voweledText);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.onend = () => ended(playing);
      utterance.onerror = () => ended(playing);
      speech.synthesis.speak(utterance);
      record({ id: item.id, via: "speech" });
    } catch {
      ended(playing);
    }
  };

  /** Cuts off whatever is being said now. */
  const cutOff = () => {
    current = null;
    if (audio) safely(() => audio.pause(), undefined);
    if (speech) safely(() => speech.synthesis.cancel(), undefined);
  };

  return {
    say(item: SpokenItem, interrupt: boolean) {
      if (interrupt) {
        queue.length = 0;
        cutOff();
        start(item);
      } else if (current) {
        queue.push(item);
      } else {
        start(item);
      }
    },
    stop() {
      queue.length = 0;
      cutOff();
    },
    /**
     * Call from inside a Player's tap, click or key. iPhone and iPad only
     * let an audio element or speech synthesis start sound after it has
     * once been started during a gesture, so this starts both with
     * nothing to say. It never cuts off what is being said.
     */
    unlock() {
      if (current) return;
      if (audio && !audioUnlocked) {
        try {
          audio.onended = null;
          audio.onerror = null;
          audio.src = SILENCE;
          Promise.resolve(audio.play()).then(
            () => (audioUnlocked = true),
            () => {},
          );
        } catch {
          // Still locked; the next gesture tries again.
        }
      }
      if (speech && !speechUnlocked) {
        speechUnlocked = true;
        safely(() => speech.synthesis.speak(speech.utterance("")), undefined);
      }
    },
    said: () => [...said],
  };
}

/**
 * The voice player for this browser: the shipped manifest, one <audio>
 * element and `speechSynthesis`, each only where the browser has it. While
 * prerendering (no window) it stays silent.
 */
export function createBrowserVoicePlayer(): VoicePlayerWithLog {
  if (typeof window === "undefined") {
    return createVoicePlayer({ loadManifest: async () => ({}), audio: () => null, speech: null });
  }
  const synthesis = window.speechSynthesis;
  const Utterance = window.SpeechSynthesisUtterance;
  return createVoicePlayer({
    // Revalidated on every visit, so newly generated clips are picked up.
    loadManifest: () =>
      fetch(`${VOICE_DIR}manifest.json`, { cache: "no-cache" }).then((response) => (response.ok ? response.json() : {})),
    audio: () => (typeof Audio === "function" ? new Audio() : null),
    speech: synthesis && typeof Utterance === "function" ? { synthesis, utterance: (text) => new Utterance(text) } : null,
  });
}

/** A WAV file with no samples, played to unlock the audio element. */
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/** How many recent items the test hook can see. */
const SAID_LOG_SIZE = 200;

/** A Hebrew voice: `he-IL`, `he_IL` (Android) or the old code `iw`. */
const isHebrew = (voice: SpeechSynthesisVoice) => /^(he|iw)([-_]|$)/i.test(voice.lang);

/** Runs `fn`, or returns `otherwise` if it throws: sound is never worth an error. */
function safely<T>(fn: () => T, otherwise: T): T {
  try {
    return fn();
  } catch {
    return otherwise;
  }
}
