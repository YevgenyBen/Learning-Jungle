"use client";

import { useEffect, useState } from "react";
import { contentBank, type ItemId } from "@/content";
import { readManifest, VOICE_MANIFEST, type Clip } from "@/voice/voicePlayer";
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

  return (
    <main className={styles.review} data-testid="voice-clip-review" data-ready={clips !== null}>
      <h1 className={styles.title}>בדיקת קטעי קול</h1>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">מזהה</th>
            <th scope="col">טקסט</th>
            <th scope="col">פגום</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td dir="ltr">{item.id}</td>
              <td>{item.voweledText}</td>
              <td>
                <input type="checkbox" aria-label={`פגום: ${item.id}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
