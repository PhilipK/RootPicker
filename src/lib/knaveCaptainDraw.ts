import { KNAVE_CAPTAINS, type KnaveCaptain } from "../data/knaveCaptains";
import { shuffleArr } from "./shuffle";

/** Deals 4 random Captain cards (Law A.8.2.IV); the Knaves player later
    chooses 3 of these to keep in their own faction setup (18.3.2). */
export function drawKnaveCaptains(): KnaveCaptain[] {
  return shuffleArr([...KNAVE_CAPTAINS]).slice(0, 4);
}
