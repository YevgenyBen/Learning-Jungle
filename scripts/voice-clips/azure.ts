import type { Synthesizer } from "./generate";

/** The one Voice Clip voice (ADR-0002): a female Azure neural he-IL voice. */
export const VOICE = "he-IL-HilaNeural";
/** Compact MP3 that every browser plays. */
const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
/**
 * Azure's free (F0) tier allows about 20 synthesis requests a minute, so by
 * default requests are at least this far apart.
 */
export const FREE_TIER_INTERVAL_MS = 3100;
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

/** Azure Speech text to speech over its REST API (no SDK). */
export function createAzureSynthesizer(options: AzureOptions): Synthesizer {
  const fetch = options.fetch ?? globalThis.fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const now = options.now ?? Date.now;
  const minInterval = options.minIntervalMs ?? FREE_TIER_INTERVAL_MS;
  const url = `https://${options.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  let lastRequest: number | undefined;

  const request = async (text: string) => {
    if (lastRequest !== undefined) {
      const wait = lastRequest + minInterval - now();
      if (wait > 0) await sleep(wait);
    }
    lastRequest = now();
    return fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": options.key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
        "User-Agent": "learning-jungle-voice-clips",
      },
      body: ssml(text),
    });
  };

  return {
    voice: VOICE,
    extension: "mp3",
    async synthesize(text) {
      for (let attempt = 1; ; attempt++) {
        const response = await request(text);
        if (response.ok) return new Uint8Array(await response.arrayBuffer());
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === ATTEMPTS) {
          throw new Error(
            `Azure Speech answered ${response.status} ${response.statusText} for "${text}".` +
              (response.status === 401 || response.status === 403
                ? " Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env.azure.local."
                : ""),
          );
        }
        const retryAfter = Number(response.headers.get("Retry-After"));
        await sleep(retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000);
      }
    },
  };
}
