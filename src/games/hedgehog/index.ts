import { difficultySettings, type GameDefinition } from "../definition";
import { HedgehogView } from "./HedgehogView";
import { createHedgehogModel, type HedgehogDifficulty, type HedgehogState } from "./model";
import { hedgehogTestDriver } from "./testDriver";

/** The counting Game: tap fruits onto the hedgehog's spines, counting them, then pick how many. */
export const hedgehogGame: GameDefinition<HedgehogState, HedgehogDifficulty> = {
  id: "counting",
  name: "ספירה",
  icon: "🦔",
  subject: "math",
  createModel: createHedgehogModel,
  // Difficulty is how many fruits there can be, automatic by default.
  ...difficultySettings("עד", [
    { difficulty: "automatic", name: "אוטומטי", icon: "✨" },
    { difficulty: "five", name: "5", icon: "5" },
    { difficulty: "ten", name: "10", icon: "10" },
    { difficulty: "twenty", name: "20", icon: "20" },
  ]),
  View: HedgehogView,
  testDriver: hedgehogTestDriver,
};
