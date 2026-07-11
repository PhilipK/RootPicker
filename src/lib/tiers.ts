import type { Faction, Tier } from "../types";
import { shuffleArr } from "./shuffle";

export const TIERS: Tier[] = ["new", "comfortable", "expert"];
export const TIER_LABEL: Record<Tier, string> = { new: "New", comfortable: "Comfortable", expert: "Expert" };
export const tierOf = (f: Faction): 1 | 2 | 3 => (f.difficulty <= 4 ? 1 : f.difficulty <= 9 ? 2 : 3);

export interface TierLineup {
  lineup: string[];
  dropHalf: string;
}

/** Build one reach-safe lineup of exactly playerCount factions with enough
    tier-1 cards for New players, and enough tier-≤2 cards for New+Comfortable
    combined (Hall's-theorem condition for the nested New⊂Comfortable⊂Expert
    eligibility). Returns null if genuinely impossible. */
export function buildTierLineup(
  nNew: number,
  nComf: number,
  nExp: number,
  pool: Faction[],
  target: number,
): TierLineup | null {
  for (const dropHalf of shuffleArr(["vagabond", "knaves"])) {
    const deck = pool.filter((f) => f.id !== "vagabond2" && f.id !== dropHalf);
    const t1 = deck.filter((f) => tierOf(f) === 1);
    const t12 = deck.filter((f) => tierOf(f) <= 2);
    if (t1.length < nNew || t12.length < nNew + nComf) continue;
    for (let attempt = 0; attempt < 400; attempt++) {
      const remaining = new Map(shuffleArr(deck.slice()).map((f) => [f.id, f] as const));
      const take = (pred: (f: Faction) => boolean, count: number) => {
        const avail = [...remaining.values()].filter(pred);
        const chosen = avail.slice(0, count);
        chosen.forEach((f) => remaining.delete(f.id));
        return chosen;
      };
      const newPicks = take((f) => tierOf(f) === 1, nNew);
      const comfPicks = take((f) => tierOf(f) <= 2, nComf);
      const expPicks = take(() => true, nExp);
      if (newPicks.length < nNew || comfPicks.length < nComf || expPicks.length < nExp) break;
      const lineup = [...newPicks, ...comfPicks, ...expPicks];
      const total = lineup.reduce((s, f) => s + f.reach, 0);
      if (total >= target) return { lineup: lineup.map((f) => f.id), dropHalf };
    }
  }
  return null;
}
