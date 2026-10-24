import type { GameDefinition } from "../definition";
import { createRabbitModel, RABBIT_DIFFICULTIES, type RabbitDifficulty, type RabbitState } from "./model";
import { RabbitView } from "./RabbitView";
import { rabbitTestDriver } from "./testDriver";

/** The rabbit Game: jump to collect a Word's letters in order. */
export const rabbitGame: GameDefinition<RabbitState, RabbitDifficulty> = {
  id: "rabbit",
  createModel: createRabbitModel,
  difficulties: RABBIT_DIFFICULTIES,
  View: RabbitView,
  // Space is the shared main action; the rabbit also jumps on up arrow and W.
  mainActionKeys: ["ArrowUp", "KeyW"],
  testDriver: rabbitTestDriver,
};
