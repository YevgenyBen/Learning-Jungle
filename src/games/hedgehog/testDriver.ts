import type { GameModel } from "../contract";
import type { TestDriver } from "../definition";
import type { HedgehogState } from "./model";

const STEP = 1 / 60;
const GIVE_UP_AFTER = 30; // seconds of game time

/**
 * Plays like a careful Player: waits for a new Challenge, taps every fruit
 * onto the hedgehog, then picks the total. Only actions and time.
 */
export const hedgehogTestDriver: TestDriver<HedgehogState> = {
  solveStep(model: GameModel<HedgehogState>) {
    let elapsed = 0;
    const tick = () => {
      if (elapsed > GIVE_UP_AFTER) throw new Error("hedgehog test driver: the Challenge never came");
      model.advance(STEP);
      elapsed += STEP;
    };

    while (!model.state().roundOver && model.state().phase === "celebrating") tick();
    if (model.state().roundOver) throw new Error("hedgehog test driver: the Round is over");

    for (const fruit of model.state().fruits) if (fruit.counted === null) model.act({ kind: "pick", choice: fruit.index });
    while (model.state().phase !== "answering") tick();
    const s = model.state();
    model.act({ kind: "pick", choice: s.choices.findIndex((c) => c.value === s.total) });
  },
};
