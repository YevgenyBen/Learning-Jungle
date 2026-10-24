import { describe, expect, it } from "vitest";
import { moveFocus } from "./focus";

// A Subject Menu: the back control on its own row above a row of Games.
// Rows are listed in reading order, so in right-to-left Hebrew the first
// item of a row is the one furthest to the right.
const subjectMenu = [["back"], ["rabbit", "first-letter", "reading"]];

describe("moving between Menu entries with arrow keys (right-to-left)", () => {
  it("ArrowLeft moves to the next entry, the one to its left", () => {
    expect(moveFocus(subjectMenu, "rabbit", "ArrowLeft")).toBe("first-letter");
  });

  it("ArrowRight moves back to the previous entry, the one to its right", () => {
    expect(moveFocus(subjectMenu, "first-letter", "ArrowRight")).toBe("rabbit");
  });

  it("stops at the ends of a row instead of wrapping", () => {
    expect(moveFocus(subjectMenu, "reading", "ArrowLeft")).toBe("reading");
    expect(moveFocus(subjectMenu, "rabbit", "ArrowRight")).toBe("rabbit");
  });

  it("ArrowUp from a Game reaches the back control", () => {
    expect(moveFocus(subjectMenu, "first-letter", "ArrowUp")).toBe("back");
  });

  it("ArrowDown from the back control reaches the first Game", () => {
    expect(moveFocus(subjectMenu, "back", "ArrowDown")).toBe("rabbit");
  });

  it("stays put at the top and bottom rows", () => {
    expect(moveFocus(subjectMenu, "back", "ArrowUp")).toBe("back");
    expect(moveFocus(subjectMenu, "rabbit", "ArrowDown")).toBe("rabbit");
  });

  it("starts at the first entry of the first row when nothing has focus yet", () => {
    expect(moveFocus(subjectMenu, null, "ArrowLeft")).toBe("back");
    expect(moveFocus([["hebrew", "math"]], null, "ArrowDown")).toBe("hebrew");
  });

  it("ignores keys that are not arrows", () => {
    expect(moveFocus(subjectMenu, "rabbit", "Enter")).toBeNull();
  });
});
