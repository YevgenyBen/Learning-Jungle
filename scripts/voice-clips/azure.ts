import type { Synthesizer } from "./generate";
import type { Transcriber, Transcription } from "./check";

/** The one Voice Clip voice (ADR-0002): a female Azure neural he-IL voice. */
export const VOICE = "he-IL-HilaNeural";
/** Compact MP3 that every browser plays. */
const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
/**
 * Azure's free (F0) tier allows about 20 synthesis requests a minute, so by
 * default requests are at least this far apart.
 */
export const FREE_TIER_INTERVAL_MS = 3100;
/** Transcription is less strict on the free tier; a 429 still makes it wait. */
export const TRANSCRIPTION_INTERVAL_MS = 1000;
const TRANSCRIPTION_API_VERSION = "2024-11-15";
const ATTEMPTS = 5;

export interface AzureOptions {
  readonly key: string;
  /** The Speech resource's region, e.g. "westeurope". */
  readonly region: string;
  readonly minIntervalMs?: number;
  readonly fetch?: typeof globalThis.fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

const escapeXml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const ssml = (text: string) =>
  `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='he-IL'>` +
  `<voice name='${VOICE}'>${escapeXml(text)}</voice></speak>`;

/**
 * Sends requests to one Azure Speech endpoint at least `minInterval` apart,
 * retrying when Azure is busy (429) or failing (5xx).
 */
function createRequester(options: AzureOptions, url: string, defaultInterval: number) {
  const fetch = options.fetch ?? globalThis.fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const now = options.now ?? Date.now;
  const minInterval = options.minIntervalMs ?? defaultInterval;
  let lastRequest: number | undefined;

  const request = async (init: RequestInit) => {
    if (lastRequest !== undefined) {
      const wait = lastRequest + minInterval - now();
      if (wait > 0) await sleep(wait);
    }
    lastRequest = now();
    return fetch(url, init);
  };

  /** The successful response; `init` is called anew for every attempt. */
  return async (init: () => RequestInit, what: string): Promise<Response> => {
    for (let attempt = 1; ; attempt++) {
      const response = await request(init());
      if (response.ok) return response;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === ATTEMPTS) {
        throw new Error(
          `Azure Speech answered ${response.status} ${response.statusText} for ${what}.` +
            (response.status === 401 || response.status === 403
              ? " Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env.azure.local."
              : ""),
        );
      }
      const retryAfter = Number(response.headers.get("Retry-After"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000);
    }
  };
}

/** Azure Speech text to speech over its REST API (no SDK). */
export function createAzureSynthesizer(options: AzureOptions): Synthesizer {
  const send = createRequester(
    options,
    `https://${options.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    FREE_TIER_INTERVAL_MS,
  );
  return {
    voice: VOICE,
    extension: "mp3",
    async synthesize(text) {
      const response = await send(
        () => ({
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": options.key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
            "User-Agent": "learning-jungle-voice-clips",
          },
          body: ssml(text),
        }),
        `"${text}"`,
      );
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

/** The parts of Azure's fast transcription answer that the check reads. */
interface FastTranscription {
  readonly durationMilliseconds?: number;
  readonly phrases?: readonly {
    readonly offsetMilliseconds: number;
    readonly durationMilliseconds: number;
    readonly text: string;
    readonly confidence?: number;
  }[];
}

/** Azure Speech fast transcription (he-IL) over its REST API: hears what a clip says. */
export function createAzureTranscriber(options: AzureOptions): Transcriber {
  const send = createRequester(
    options,
    `https://${options.region}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe` +
      `?api-version=${TRANSCRIPTION_API_VERSION}`,
    TRANSCRIPTION_INTERVAL_MS,
  );
  return {
    async transcribe(audio, file) {
      const response = await send(() => {
        const form = new FormData();
        form.append("audio", new Blob([audio as Uint8Array<ArrayBuffer>]), file);
        form.append("definition", JSON.stringify({ locales: ["he-IL"] }));
        return { method: "POST", headers: { "Ocp-Apim-Subscription-Key": options.key }, body: form };
      }, file);
      return toTranscription((await response.json()) as FastTranscription);
    },
  };
}

function toTranscription(answer: FastTranscription): Transcription {
  const phrases = answer.phrases ?? [];
  const durationMs = answer.durationMilliseconds ?? 0;
  if (phrases.length === 0) return { heard: "", durationMs };
  const last = phrases[phrases.length - 1];
  return {
    heard: phrases.map((phrase) => phrase.text).join(" "),
    confidence: Math.min(...phrases.map((phrase) => phrase.confidence ?? 0)),
    durationMs,
    speechStartMs: phrases[0].offsetMilliseconds,
    speechEndMs: last.offsetMilliseconds + last.durationMilliseconds,
  };
}
