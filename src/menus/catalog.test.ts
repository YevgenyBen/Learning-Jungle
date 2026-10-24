import { describe, expect, it } from "vitest";
import { registeredGames } from "@/games/registry";
import { availableGames, findSubject, SUBJECTS } from "./catalog";

describe("the Menu catalog", () => {
  it("offers the rabbit Game first in the Hebrew Menu, with the Game's own name and Menu icon", () => {
    expect(findSubject("hebrew")!.games[0]).toEqual({
      id: "rabbit",
      name: "ארנב קופץ",
      icon: "🐇",
      available: true,
    });
  });

  it("offers every registered Game exactly once, available, in its own Subject's Menu", () => {
    for (const game of registeredGames()) {
      const entries = SUBJECTS.flatMap((subject) =>
        subject.games.filter((entry) => entry.id === game.id).map((entry) => ({ subject: subject.id, entry })),
      );
      expect(entries).toEqual([
        { subject: game.subject, entry: { id: game.id, name: game.name, icon: game.icon, available: true } },
      ]);
    }
  });

  it("can be played only where a Game is registered; planned Games show as unavailable", () => {
    expect(availableGames().map(({ game }) => game.id)).toEqual(registeredGames().map((game) => game.id));
    const planned = SUBJECTS.flatMap((subject) => subject.games).filter((entry) => !entry.available);
    expect(planned.map((entry) => entry.id)).toEqual(["first-letter", "counting", "addition"]);
  });
});
