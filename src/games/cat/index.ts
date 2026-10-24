import { difficultySettings, type GameDefinition } from "../definition";
import { CatView } from "./CatView";
import { createCatModel, type CatDifficulty, type CatState } from "./model";
import { catTestDriver } from "./testDriver";

/** The first-letter Game: the cat jumps onto the perch whose letter starts the pictured Word. */
export const catGame: GameDefinition<CatState, CatDifficulty> = {
  id: "first-letter",
  name: "האות הראשונה",
  icon: "🐈",
  subject: "hebrew",
  createModel: createCatModel,
  // Difficulty is how many Choices stand ahead of the cat, automatic by default.
  ...difficultySettings("אותיות", [
    { difficulty: "automatic", name: "אוטומטי", icon: "✨" },
    { difficulty: "two", name: "שתיים", icon: "2" },
    { difficulty: "three", name: "שלוש", icon: "3" },
    { difficulty: "four", name: "ארבע", icon: "4" },
  ]),
  View: CatView,
  testDriver: catTestDriver,
};
