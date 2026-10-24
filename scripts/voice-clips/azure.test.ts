import { describe, expect, it } from "vitest";
import { createAzureSynthesizer } from "./azure";

// The Azure Speech REST adapter, driven with a stand-in fetch: no request
// ever leaves the machine.

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: string;
}

function fakeFetch(responses: Response[]) {
  const sent: Sent[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({
      url: String(url),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: String(init?.body),
    });
    const response = responses.shift();
    if (!response) throw new Error("no more responses");
    return response;
  };
  return { fetch: fetch as typeof globalThis.fetch, sent };
}

const audio = (bytes: number[]) => new Response(new Uint8Array(bytes), { status: 200 });
const noWait = { sleep: async () => {}, now: () => 0 };

describe("the Azure synthesizer", () => {
  it("asks the region's Speech endpoint for the text in the he-IL Hila voice as compact MP3", async () => {
    const { fetch, sent } = fakeFetch([audio([1, 2, 3])]);
    const azure = createAzureSynthesizer({ key: "test-key", region: "westeurope", fetch, ...noWait });

    const clip = await azure.synthesize("תַּפּוּחַ");

    expect([...clip]).toEqual([1, 2, 3]);
    expect(azure.voice).toBe("he-IL-HilaNeural");
    expect(azure.extension).toBe("mp3");
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1");
    expect(sent[0].headers["ocp-apim-subscription-key"]).toBe("test-key");
    expect(sent[0].headers["content-type"]).toBe("application/ssml+xml");
    expect(sent[0].headers["x-microsoft-outputformat"]).toBe("audio-24khz-48kbitrate-mono-mp3");
    expect(sent[0].body).toContain("xml:lang='he-IL'");
    expect(sent[0].body).toContain("<voice name='he-IL-HilaNeural'>תַּפּוּחַ</voice>");
  });

  it("escapes the text so it cannot break the SSML", async () => {
    const { fetch, sent } = fakeFetch([audio([1])]);
    const azure = createAzureSynthesizer({ key: "k", region: "r", fetch, ...noWait });

    await azure.synthesize(`a<b & "c'`);

    expect(sent[0].body).toContain("a&lt;b &amp; &quot;c&apos;");
  });

  it("fails with the status and a hint at the key when Azure refuses", async () => {
    const { fetch } = fakeFetch([new Response("", { status: 401, statusText: "Unauthorized" })]);
    const azure = createAzureSynthesizer({ key: "wrong", region: "westeurope", fetch, ...noWait });

    await expect(azure.synthesize("אָלֶף")).rejects.toThrow(/401.*AZURE_SPEECH_KEY/s);
  });

  it("waits and tries again when Azure says too many requests", async () => {
    const waits: number[] = [];
    const { fetch, sent } = fakeFetch([
      new Response("", { status: 429, headers: { "Retry-After": "7" } }),
      audio([9]),
    ]);
    const azure = createAzureSynthesizer({
      key: "k",
      region: "r",
      fetch,
      now: () => 0,
      sleep: async (ms) => void waits.push(ms),
    });

    const clip = await azure.synthesize("בֵּית");

    expect([...clip]).toEqual([9]);
    expect(sent).toHaveLength(2);
    expect(waits).toContain(7000);
  });

  it("spaces its requests out to stay within the free tier's rate", async () => {
    const waits: number[] = [];
    let clock = 0;
    const { fetch } = fakeFetch([audio([1]), audio([2])]);
    const azure = createAzureSynthesizer({
      key: "k",
      region: "r",
      fetch,
      minIntervalMs: 3000,
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    });

    await azure.synthesize("א");
    clock += 500;
    await azure.synthesize("ב");

    expect(waits).toEqual([2500]);
  });
});
