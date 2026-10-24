import type { GameModel } from "../contract";
import type { TestDriver } from "../definition";
import type { CatState } from "./model";

const STEP = 1 / 60;
const GIVE_UP_AFTER = 30; // seconds of game time

/**
 * Plays like a careful Player: waits until the Choices stand, picks the
 * one with the Word's first letter and waits for the cat to land on it.
 * Only actions and time.
 */
export const catTestDriver: TestDriver<CatState> = {
  solveStep(model: GameModel<CatState>) {
    let elapsed = 0;
    const tick = () => {
      if (elapsed > GIVE_UP_AFTER) throw new Error("cat test driver: the Choices never came");
      model.advance(STEP);
      elapsed += STEP;
    };

    // A Player waits for the Celebration and the move to end before the next Word.
    while (!model.state().roundOver && model.state().phase !== "choosing") tick();
    if (model.state().roundOver) throw new Error("cat test driver: the Round is over");

    const s = model.state();
    const right = s.choices.findIndex(
      (id) => s.perches.find((p) => p.id === id)?.sign?.letter === s.challenge.letter,
    );
    model.act({ kind: "pick", choice: right });
    while (model.state().phase === "jumping") tick();
  },
};
