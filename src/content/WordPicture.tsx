import type { Word } from "./types";

/**
 * Draws a Word's Picture. Every Game shows Pictures through this component
 * only, so the Picture can become a file (Twemoji, later illustrations)
 * without touching any Game.
 */
export function WordPicture({ word, className }: { word: Word; className?: string }) {
  return (
    <span role="img" aria-label={word.plain} className={className} data-picture={word.id}>
      {word.picture.emoji}
    </span>
  );
}
