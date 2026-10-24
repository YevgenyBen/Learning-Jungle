"use client";

import type { DifficultyControl } from "@/games/definition";
import { Control } from "./FrameControls";

export interface SettingsControlsProps<D extends string> {
  readonly control: DifficultyControl<D>;
  readonly niqqud: boolean;
  readonly onNiqqud: () => void;
  readonly difficulty: D;
  /** Moves on to the Game's next Difficulty option, after the last back to the first. */
  readonly onDifficulty: () => void;
}

/**
 * The Game Frame's settings controls: Niqqud on or off, and the Game's
 * Difficulty, which one press moves on to the next option. N and D are
 * their keys.
 */
export function SettingsControls<D extends string>({
  control,
  niqqud,
  onNiqqud,
  difficulty,
  onDifficulty,
}: SettingsControlsProps<D>) {
  const option = control.options[difficulty];
  return (
    <>
      <Control icon={niqqud ? "אָ" : "א"} label="ניקוד" pressed={niqqud} onPress={onNiqqud} />
      <Control icon={option.icon} label={`${control.label}: ${option.name}`} onPress={onDifficulty} />
    </>
  );
}
