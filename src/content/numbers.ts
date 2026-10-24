import {
  AND_UNITS,
  HUNDRED,
  NUMBER_PRONUNCIATIONS,
  TENS,
  TEN_TO_NINETEEN,
  UNITS,
} from "./data/numbers";
import type { HebrewNumber } from "./types";

/** The Content Bank's number queries (part of `ContentBank`). */
export interface NumberQueries {
  /** The numbers 0-100, in order. */
  numbers(): readonly HebrewNumber[];
  /** A number from 0 to 100 by its value. */
  number(value: number): HebrewNumber | undefined;
}

function feminine(value: number): string {
  if (value < 10) return UNITS[value];
  if (value < 20) return TEN_TO_NINETEEN[value - 10];
  if (value === 100) return HUNDRED;
  const tens = TENS[Math.floor(value / 10) - 2];
  const unit = value % 10;
  return unit === 0 ? tens : `${tens} ${AND_UNITS[unit - 1]}`;
}

export function createNumberQueries(): NumberQueries {
  const numbers: readonly HebrewNumber[] = Array.from({ length: 101 }, (_, value) => {
    const text = feminine(value).normalize("NFC");
    const pronunciation = NUMBER_PRONUNCIATIONS[value];
    return {
      id: `number-${value}`,
      voweledText: text,
      ...(pronunciation ? { pronunciation } : {}),
      value,
      feminine: text,
    };
  });
  return {
    numbers: () => numbers,
    number: (value) => numbers[value],
  };
}
