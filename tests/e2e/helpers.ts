import { test, type Locator } from "@playwright/test";

/** Whether the current project emulates a touch device (a phone or tablet). */
export function isTouch(): boolean {
  return test.info().project.use.hasTouch === true;
}

/**
 * Taps on touch projects, clicks with the mouse on desktop.
 * `force` skips Playwright's "is it enabled" wait, for pressing controls
 * that are deliberately unavailable (aria-disabled).
 */
export async function press(
  target: Locator,
  options: { force?: boolean; position?: { x: number; y: number } } = {},
): Promise<void> {
  if (isTouch()) await target.tap(options);
  else await target.click(options);
}
