import type { ItemId } from "@/content";

/**
 * The command that regenerates these Voice Clips (README, "Regenerate
 * flagged clips"): the identities separated by single spaces, on one line.
 */
export function regenerationCommand(ids: readonly ItemId[]): string {
  return `npm run voice-clips -- ${ids.join(" ")}`;
}
