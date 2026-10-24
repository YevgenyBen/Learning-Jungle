/**
 * What the Menus offer: the two Subjects and the Games in each.
 *
 * A built Game comes from the Game registry (src/games/registry.ts): its
 * definition names its Subject, its Hebrew name and its Menu icon, so adding
 * a Game is one entry there. Games that are planned but not built yet are
 * listed below; they show as an unavailable icon that does nothing until a
 * Game with the same id is registered.
 */
import { registeredGames } from "@/games/registry";

export type SubjectId = "hebrew" | "math";

export interface GameEntry {
  /** Stable identity, also the Game's route segment: /games/<id>. */
  readonly id: string;
  /** Hebrew name, read by screen readers and shown under the icon. */
  readonly name: string;
  /** The Game's Menu icon (a placeholder for a planned Game). */
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

type PlannedGame = Omit<GameEntry, "available">;

/** The Subjects in Menu order, each with the Games planned for it but not built yet. */
const SUBJECT_PLANS: readonly (Omit<Subject, "games"> & { readonly planned: readonly PlannedGame[] })[] = [
  {
    id: "hebrew",
    name: "עברית",
    glyph: "אב",
    planned: [{ id: "first-letter", name: "האות הראשונה", icon: "🍎" }],
  },
  {
    id: "math",
    name: "חשבון",
    glyph: "1+2",
    planned: [
      { id: "counting", name: "ספירה", icon: "🖐️" },
      { id: "addition", name: "חיבור", icon: "➕" },
    ],
  },
];

/** Built Games first, in registry order, then the planned ones not built yet. */
export const SUBJECTS: readonly Subject[] = SUBJECT_PLANS.map(({ planned, ...subject }) => {
  const built = registeredGames().filter((game) => game.subject === subject.id);
  return {
    ...subject,
    games: [
      ...built.map(({ id, name, icon }) => ({ id, name, icon, available: true })),
      ...planned
        .filter((game) => !built.some((b) => b.id === game.id))
        .map((game) => ({ ...game, available: false })),
    ],
  };
});

export function findSubject(id: string): Subject | undefined {
  return SUBJECTS.find((subject) => subject.id === id);
}

/** Every Game that can be played, with the Subject it belongs to. */
export function availableGames(): { game: GameEntry; subject: Subject }[] {
  return SUBJECTS.flatMap((subject) =>
    subject.games.filter((game) => game.available).map((game) => ({ game, subject })),
  );
}

export function gameHref(game: GameEntry): string {
  return `/games/${game.id}`;
}
