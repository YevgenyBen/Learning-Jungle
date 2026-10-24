import type { Page } from "@playwright/test";
import type { CatState } from "../../src/games/cat/model";
import type { RabbitState } from "../../src/games/rabbit/model";
import type { GameRequest } from "../../src/games/contract";
import type { GameTestHook } from "../../src/frame/testHook";

// Helpers for driving a running Game through the dev/test hook
// (window.__learningJungleGame, see src/frame/testHook.ts).

export type { CatState, RabbitState };

/** Waits until the Game Frame has installed the hook for this Game. */
export async function waitForGame(page: Page, gameId: string): Promise<void> {
  await page.waitForFunction((id) => window.__learningJungleGame?.gameId === id, gameId);
}

export async function gameState<S>(page: Page): Promise<S> {
  return (await page.evaluate(() => window.__learningJungleGame!.state())) as unknown as S;
}

/** Whether the hook exists at all (it must not in a production build). */
export async function hasTestHook(page: Page): Promise<boolean> {
  return page.evaluate(() => "__learningJungleGame" in window);
}

export type { GameTestHook };

export async function gameRequests(page: Page): Promise<GameRequest[]> {
  return page.evaluate(() => window.__learningJungleGame!.requests());
}

export async function solveStep(page: Page): Promise<void> {
  await page.evaluate(() => window.__learningJungleGame!.solveStep());
}

export async function completeChallenge(page: Page): Promise<void> {
  await page.evaluate(() => window.__learningJungleGame!.completeChallenge());
}

/**
 * Records, frame by frame in the page, how high the rabbit has got since
 * this call; `rabbitPeak` reads it.
 */
export async function trackRabbitHeight(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __rabbitPeak: number; __rabbitTrack?: number };
    if (w.__rabbitTrack) cancelAnimationFrame(w.__rabbitTrack);
    const ground = (window.__learningJungleGame!.state() as unknown as RabbitState).rabbit.y;
    w.__rabbitPeak = 0;
    const sample = () => {
      const { y } = (window.__learningJungleGame!.state() as unknown as RabbitState).rabbit;
      w.__rabbitPeak = Math.max(w.__rabbitPeak, ground - y);
      w.__rabbitTrack = requestAnimationFrame(sample);
    };
    sample();
  });
}

export async function rabbitPeak(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __rabbitPeak: number }).__rabbitPeak);
}
