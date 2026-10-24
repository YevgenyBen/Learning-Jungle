/**
 * What the Menus offer: the two Subjects and the Games in each.
 *
 * Adding a Game: add an entry to its Subject's `games`. While `available` is
 * false the Game shows as an unavailable icon that does nothing. When the
 * Game is built, set `available: true`; it then opens at /games/<id>.
 */
export type SubjectId = "hebrew" | "math";

export interface GameEntry {
  /** Stable identity, also the Game's route segment: /games/<id>. */
  readonly id: string;
  /** Hebrew name, read by screen readers and shown under the icon. */
  readonly name: string;
  /** Placeholder icon until the Game supplies its own Menu icon. */
  readonly icon: string;
  readonly available: boolean;
}

export interface Subject {
  readonly id: SubjectId;
  readonly name: string;
  /** Big glyph drawn on the Subject's icon. */
  readonly glyph: string;
  readonly games: readonly GameEntry[];
}

export const SUBJECTS: readonly Subject[] = [
  {
    id: "hebrew",
    name: "עברית",
    glyph: "אב",
    games: [
      { id: "rabbit", name: "ארנב קופץ", icon: "🐇", available: false },
      { id: "first-letter", name: "האות הראשונה", icon: "🍎", available: false },
    ],
  },
  {
    id: "math",
    name: "חשבון",
    glyph: "1+2",
    games: [
      { id: "counting", name: "ספירה", icon: "🖐️", available: false },
      { id: "addition", name: "חיבור", icon: "➕", available: false },
    ],
  },
];

export function findSubject(id: string): Subject | undefined {
  return SUBJECTS.find((subject) => subject.id === id);
}

export function gameHref(game: GameEntry): string {
  return `/games/${game.id}`;
}
