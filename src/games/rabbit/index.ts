import { difficultySettings, type GameDefinition } from "../definition";
import { createRabbitModel, type RabbitDifficulty, type RabbitState } from "./model";
import { RabbitView } from "./RabbitView";
import { rabbitTestDriver } from "./testDriver";

/** The rabbit Game: jump to collect a Word's letters in order. */
export const rabbitGame: GameDefinition<RabbitState, RabbitDifficulty> = {
  id: "rabbit",
  name: "ארנב קופץ",
  icon: "🐇",
  subject: "hebrew",
  createModel: createRabbitModel,
  // Difficulty is the rabbit's speed, automatic by default.
  ...difficultySettings("מהירות", [
    { difficulty: "automatic", name: "אוטומטי", icon: "✨" },
    { difficulty: "slow", name: "איטי", icon: "🐢" },
    { difficulty: "medium", name: "בינוני", icon: "🐇" },
    { difficulty: "fast", name: "מהיר", icon: "🐆" },
  ]),
  View: RabbitView,
  // Space is the shared main action; the rabbit also jumps on up arrow and W.
  mainActionKeys: ["ArrowUp", "KeyW"],
  testDriver: rabbitTestDriver,
};
