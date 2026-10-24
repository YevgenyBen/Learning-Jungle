"use client";

import { useEffect, useRef, useState } from "react";
import { contentBank, type ItemId } from "@/content";
import { readManifest, VOICE_DIR, VOICE_MANIFEST, type Clip } from "@/voice/voicePlayer";
import { regenerationCommand } from "./command";
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
  /** The flagged items: only in the page's state, gone on reload. */
  const [flagged, setFlagged] = useState<ReadonlySet<ItemId>>(new Set());
  /** What happened on the last copy, if anything since the flags changed. */
  const [copied, setCopied] = useState<string | null>(null);
  const commandBox = useRef<HTMLTextAreaElement>(null);

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
  const flaggedIds = items.filter((item) => flagged.has(item.id)).map((item) => item.id);
  const command = flaggedIds.length > 0 ? regenerationCommand(flaggedIds) : "";

  const toggleFlag = (id: ItemId) => {
    setCopied(null);
    setFlagged((before) => {
      const after = new Set(before);
      if (!after.delete(id)) after.add(id);
      return after;
    });
  };

  const copy = async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied("הועתק");
    } catch {
      // No clipboard (e.g. over plain http from another device) or not allowed.
      setCopied("לא ניתן להעתיק אוטומטית. הפקודה מסומנת: אפשר להעתיק ידנית (Ctrl+C).");
      commandBox.current?.focus();
      commandBox.current?.select();
    }
  };

  return (
    <main className={styles.review} data-testid="voice-clip-review" data-ready={clips !== null}>
      <header className={styles.header}>
        <h1 className={styles.title}>בדיקת קטעי קול</h1>
        <p data-testid="review-summary">
          {items.length} פריטים
          {missing !== null && <>, {missing} חסרים</>}, {flaggedIds.length} מסומנים
        </p>
        <p className={styles.help}>
          סמנו קטעים פגומים והעתיקו את הפקודה שמייצרת אותם מחדש. קטעים חסרים נוצרים בהרצת{" "}
          <code dir="ltr">npm run voice-clips</code> בלי מזהים.
        </p>
        <div className={styles.copy}>
          <label className={styles.commandLabel}>
            פקודה
            <textarea
              ref={commandBox}
              className={styles.command}
              dir="ltr"
              rows={2}
              readOnly
              value={command}
              placeholder="סמנו קטעים פגומים כדי לקבל פקודה"
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <button type="button" className={styles.copyButton} aria-disabled={!command} onClick={copy}>
            העתקה
          </button>
          <p role="status" className={styles.copied}>
            {copied}
          </p>
        </div>
      </header>
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
                <td className={styles.status}>{status}</td>
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
                  <input
                    type="checkbox"
                    className={styles.flag}
                    aria-label={`פגום: ${item.id}`}
                    checked={flagged.has(item.id)}
                    onChange={() => toggleFlag(item.id)}
                  />
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
