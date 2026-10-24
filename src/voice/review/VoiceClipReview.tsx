"use client";

import { useEffect, useRef, useState } from "react";
import { contentBank, type ItemId } from "@/content";
import { readManifest, VOICE_DIR, VOICE_MANIFEST, type Clip } from "@/voice/voicePlayer";
import styles from "./VoiceClipReview.module.css";

/**
 * The Voice Clip review page (development only, /dev/voice-clips): every
 * spoken Content Bank item with its text and a play button, the missing
 * clips marked, and flags for bad clips that copy out as a ready
 * `npm run voice-clips -- <ids>` command. Nothing is kept beyond the page.
 */
export function VoiceClipReview() {
  const items = contentBank.spokenItems();
  /** The manifest's clips; null until it has been read. */
  const [clips, setClips] = useState<ReadonlyMap<ItemId, Clip> | null>(null);
  const player = useClipPlayer();

  useEffect(() => {
    let live = true;
    fetch(VOICE_MANIFEST, { cache: "no-cache" })
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}))
      .then((manifest) => live && setClips(readManifest(manifest)));
    return () => {
      live = false;
    };
  }, []);

  const missing = clips ? items.filter((item) => !clips.has(item.id)).length : null;

  return (
    <main className={styles.review} data-testid="voice-clip-review" data-ready={clips !== null}>
      <h1 className={styles.title}>בדיקת קטעי קול</h1>
      <p data-testid="review-summary">
        {items.length} פריטים
        {missing !== null && <>, {missing} חסרים</>}
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">מזהה</th>
            <th scope="col">טקסט</th>
            <th scope="col">קטע קול</th>
            <th scope="col">השמעה</th>
            <th scope="col">פגום</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const clip = clips?.get(item.id);
            const status = !clips ? "…" : !clip ? "חסר" : player.status(item.id);
            return (
              <tr key={item.id} className={clips && !clip ? styles.missing : undefined}>
                <td dir="ltr">{item.id}</td>
                <td className={styles.text}>{item.voweledText}</td>
                <td>{status}</td>
                <td>
                  <button
                    type="button"
                    className={styles.play}
                    aria-disabled={!clip}
                    onClick={() => clip && player.play(item.id, clip)}
                  >
                    <span aria-hidden="true">▶ </span>השמעה
                  </button>
                </td>
                <td>
                  <input type="checkbox" aria-label={`פגום: ${item.id}`} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}

/** Plays one clip at a time on one audio element, and tells how each clip did. */
function useClipPlayer() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<ItemId | null>(null);
  const [failed, setFailed] = useState<ReadonlySet<ItemId>>(new Set());

  useEffect(() => () => audio.current?.pause(), []);

  const play = (id: ItemId, clip: Clip) => {
    audio.current ??= new Audio();
    const element = audio.current;
    element.pause();
    // Events from a clip that was cut off are ignored.
    const current = () => element.dataset.item === id;
    const fail = () => {
      if (!current()) return;
      setPlaying(null);
      setFailed((before) => new Set(before).add(id));
    };
    element.dataset.item = id;
    element.onended = () => current() && setPlaying(null);
    element.onerror = fail;
    element.src = VOICE_DIR + clip.file;
    setPlaying(id);
    setFailed((before) => {
      const after = new Set(before);
      after.delete(id);
      return after;
    });
    element.play().catch((error: unknown) => {
      // AbortError: another clip was started before this one could play.
      if ((error as { name?: string } | null)?.name !== "AbortError") fail();
    });
  };

  const status = (id: ItemId) => (failed.has(id) ? "לא מתנגן" : playing === id ? "מתנגן…" : "יש");

  return { play, status };
}
