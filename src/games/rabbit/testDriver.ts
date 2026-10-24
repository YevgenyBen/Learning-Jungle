import type { GameModel } from "../contract";
import type { TestDriver } from "../definition";
import type { RabbitState } from "./model";

const STEP = 1 / 60;
const GIVE_UP_AFTER = 120; // seconds of game time

/** Jump when the needed tile is this close ahead: any jump then reaches it. */
const JUMP_WHEN_AHEAD = 30;

/**
 * Plays like a careful Player: waits for the needed letter's tile, jumps
 * right under it with a full press, and lands. Only actions and time.
 */
export const rabbitTestDriver: TestDriver<RabbitState> = {
  solveStep(model: GameModel<RabbitState>) {
    let elapsed = 0;
    const tick = () => {
      if (elapsed > GIVE_UP_AFTER) throw new Error("rabbit test driver: the needed letter never came");
      model.advance(STEP);
      elapsed += STEP;
    };

    // A Player waits for a Challenge Celebration to end before the next Word.
    while (model.state().celebration === "challenge") tick();
    if (model.state().roundOver) throw new Error("rabbit test driver: the Round is over");

    const start = model.state();
    const { word } = start.challenge;
    const done = (s: RabbitState) => s.challenge.word !== word || s.challenge.next > start.challenge.next;

    while (!done(model.state())) {
      const s = model.state();
      const need = s.challenge.letters[s.challenge.next].letter;
      const target = s.tiles.find((t) => !t.collected && t.letter === need && t.x - s.rabbit.x > -20);
      if (s.rabbit.onGround && target && target.x - s.rabbit.x < JUMP_WHEN_AHEAD) {
        model.act({ kind: "main-press" });
        while (model.state().rabbit.onGround) tick();
        while (!model.state().rabbit.onGround) tick();
        model.act({ kind: "main-release" });
      } else {
        tick();
      }
    }
  },
};
