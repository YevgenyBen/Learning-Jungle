import type { Word } from "./types";

/**
 * Draws a Word's Picture. Every Game shows Pictures through this component
 * only, so the Picture file (Twemoji now, illustrations later) can change
 * without touching any Game. Size it with `className` (width and height).
 */
export function WordPicture({ word, className }: { word: Word; className?: string }) {
  return (
    // A plain <img>: the app is a static export, so next/image can't optimise
    // anyway, and SVGs need no optimising.
    <img
      src={word.picture.src}
      alt={word.plain}
      className={className}
      data-picture={word.id}
      draggable={false}
    />
  );
}
