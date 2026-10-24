import type { Word } from "@/content";
import { shuffled, type Random } from "./random";

/** Draws Words in a shuffled order, without repeats until every Word has come up. */
export function createWordBag(all: readonly Word[], random: Random) {
  let bag: Word[] = [];
  let last: Word | undefined;
  return {
    next(): Word {
      if (bag.length === 0) {
        bag = shuffled(random, all);
        // A fresh bag must not start with the Word that ended the last one.
        if (bag.length > 1 && bag[bag.length - 1] === last) {
          [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
        }
      }
      last = bag.pop()!;
      return last;
    },
  };
}
