/**
 * Arrow-key movement between Menu entries (and the Round Celebration's options).
 *
 * A Menu's layout is a list of rows, top to bottom; each row lists its
 * entry ids in reading order. The app is right-to-left (ADR-0003), so the
 * first id of a row is drawn furthest to the right: ArrowLeft moves forward
 * through a row and ArrowRight moves back. Movement stops at the edges.
 *
 * Returns the id that should receive focus, or null when the key is not an
 * arrow key (so the caller leaves the event alone).
 */
export type MenuLayout = readonly (readonly string[])[];

const ROW_STEP: Record<string, number> = { ArrowLeft: 1, ArrowRight: -1 };
const COLUMN_STEP: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

export function moveFocus(
  layout: MenuLayout,
  current: string | null,
  key: string,
): string | null {
  if (!(key in ROW_STEP) && !(key in COLUMN_STEP)) return null;

  const rows = layout.filter((row) => row.length > 0);
  if (rows.length === 0) return null;

  const row = current === null ? -1 : rows.findIndex((r) => r.includes(current));
  if (row === -1) return rows[0][0];
  const index = rows[row].indexOf(current!);

  if (key in ROW_STEP) {
    const next = clamp(index + ROW_STEP[key], 0, rows[row].length - 1);
    return rows[row][next];
  }

  const nextRow = clamp(row + COLUMN_STEP[key], 0, rows.length - 1);
  if (nextRow === row) return current;
  // Moving between rows always lands on the row's first entry: rows in the
  // Menus are short, and a predictable landing spot is easiest for a Player.
  return rows[nextRow][0];
}

/**
 * Alt, Ctrl or Cmd is held: the key combination belongs to the browser or
 * the system (copy, reload, switching tabs), never to the app.
 */
export function hasModifierKey(event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
  return event.altKey || event.ctrlKey || event.metaKey;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
