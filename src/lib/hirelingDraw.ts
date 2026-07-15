import { HIRELINGS, type Hireling } from "../data/hirelings";
import { shuffleArr } from "./shuffle";

export interface HirelingPick {
  hireling: Hireling;
  demoted: boolean;
}

export interface HirelingDrawResult {
  picks: HirelingPick[];
  /** how many owned, unlocked hirelings the draw was pulled from */
  eligibleCount: number;
}

/** Demote count by player count (Law A.6.2): 3p -> 1, 4p -> 2, 5-6p -> 3.
    The Law is silent on 2 players; 0 demotions continues the same progression. */
export function demoteCount(playerCount: number): number {
  return Math.min(3, Math.max(0, playerCount - 2));
}

/** Owned hirelings whose corresponding faction (if any) isn't in this game (Law A.6.5). */
export function eligibleHirelings(ownedIds: Set<string>, finalFactionIds: Set<string>): Hireling[] {
  return HIRELINGS.filter((h) => ownedIds.has(h.id) && !h.lockedFactionIds.some((fid) => finalFactionIds.has(fid)));
}

export function drawHirelings(
  ownedIds: Set<string>,
  finalFactionIds: Set<string>,
  playerCount: number,
): HirelingDrawResult {
  const eligible = eligibleHirelings(ownedIds, finalFactionIds);
  const dealt = shuffleArr([...eligible]).slice(0, 3);
  const toDemote = new Set(shuffleArr(dealt.map((h) => h.id)).slice(0, demoteCount(playerCount)));
  return {
    picks: dealt.map((hireling) => ({ hireling, demoted: toDemote.has(hireling.id) })),
    eligibleCount: eligible.length,
  };
}
