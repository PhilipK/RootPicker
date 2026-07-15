import type { Faction } from "../types";

export const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th"];
export function rankLabel(rank: number): string {
  return `${ORDINAL[rank] || `${rank + 1}th`} choice`;
}

export function combinations<T>(arr: T[], k: number): T[][] {
  const results: T[][] = [];
  (function rec(start: number, combo: T[]) {
    if (combo.length === k) {
      results.push(combo.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      rec(i + 1, combo);
      combo.pop();
    }
  })(0, []);
  return results;
}

/** Points double with each better rank: worst-ranked pick is worth 1,
    each rank above that doubles, so best pick is worth 2^(wishCount-1). */
export function wishPoints(rank: number, wishCount: number): number {
  return rank < 0 || rank >= wishCount ? 0 : 2 ** (wishCount - 1 - rank);
}

export function wishScore(picks: string[], factionId: string, wishCount: number): number {
  return wishPoints(picks.indexOf(factionId), wishCount);
}

export interface WishPlayer {
  name: string;
  picks: string[];
}

interface SubsetSolution {
  /** best composite total achievable on this subset */
  best: number;
  /** number of distinct assignments achieving it */
  ways: number;
  /** draw one of those optimal assignments uniformly at random */
  sample(rand: () => number): string[];
}

/** Assignment DP over player bitmasks: dp[mask] = best composite total
    assigning the first popcount(mask) players to the faction-index set `mask`,
    ways[mask] = how many assignments achieve it. The composite value makes
    happiness points dominate and, among equal totals, favours assignments
    that leave fewer players empty-handed: points are scaled by N+1 so the
    coverage bonus (at most 1 per player) can never outweigh a single point.
    Sampling walks back from the full mask weighting each optimal branch by
    its way count, so every optimal assignment is equally likely — who ends
    up off-list is never an artifact of seat or data-file order. */
function solveSubset(factions: Faction[], players: WishPlayer[], wishCount: number): SubsetSolution {
  const N = players.length;
  const full = (1 << N) - 1;
  const value = players.map((p) =>
    factions.map((f) => {
      const pts = wishScore(p.picks, f.id, wishCount);
      return pts * (N + 1) + (pts > 0 ? 1 : 0);
    }),
  );
  const dp = new Array(full + 1).fill(-1);
  const ways = new Array(full + 1).fill(0);
  dp[0] = 0;
  ways[0] = 1;
  for (let mask = 0; mask < full; mask++) {
    let p = 0;
    for (let m = mask; m; m >>= 1) p += m & 1;
    for (let f = 0; f < N; f++) {
      if (mask & (1 << f)) continue;
      const sc = dp[mask] + value[p][f];
      const nmask = mask | (1 << f);
      if (sc > dp[nmask]) {
        dp[nmask] = sc;
        ways[nmask] = ways[mask];
      } else if (sc === dp[nmask]) {
        ways[nmask] += ways[mask];
      }
    }
  }
  const sample = (rand: () => number): string[] => {
    const assign = new Array<string>(N);
    let mask = full;
    for (let p = N - 1; p >= 0; p--) {
      let pickAt = rand() * ways[mask];
      for (let f = 0; f < N; f++) {
        if (!(mask & (1 << f))) continue;
        const prev = mask ^ (1 << f);
        if (dp[prev] + value[p][f] !== dp[mask]) continue;
        pickAt -= ways[prev];
        if (pickAt < 0) {
          assign[p] = factions[f].id;
          mask = prev;
          break;
        }
      }
    }
    return assign;
  };
  return { best: dp[full], ways: ways[full], sample };
}

export interface WishAssignment {
  subset: Faction[];
  assign: string[];
  score: number;
  total: number;
}

/** Try every reach-safe faction subset of the right size (small enough to be
    exhaustive: at most C(13,6)=1716), solve each one optimally, and draw
    uniformly among ALL optimal assignments across all tied-best subsets.
    Happiness points are maximised first; among equal totals, assignments
    that leave fewer players without any of their picks win; the remaining
    ties — which faction fills a gap, who draws the short straw when someone
    must go off-list — are a fair uniform draw. */
export function findBestWishAssignment(
  players: WishPlayer[],
  pool: Faction[],
  target: number,
  wishCount: number,
  rand: () => number = Math.random,
): WishAssignment | null {
  const candidates: { subset: Faction[]; total: number; solution: SubsetSolution }[] = [];
  let best = -1;
  for (const subset of combinations(pool, players.length)) {
    if (subset.some((f) => f.id === "vagabond") && subset.some((f) => f.id === "knaves")) continue;
    const total = subset.reduce((s, f) => s + f.reach, 0);
    if (total < target) continue;
    const solution = solveSubset(subset, players, wishCount);
    if (solution.best > best) best = solution.best;
    candidates.push({ subset, total, solution });
  }
  if (!candidates.length) return null;
  const bestOnes = candidates.filter((c) => c.solution.best === best);
  let pickAt = rand() * bestOnes.reduce((s, c) => s + c.solution.ways, 0);
  let chosen = bestOnes[bestOnes.length - 1];
  for (const c of bestOnes) {
    pickAt -= c.solution.ways;
    if (pickAt < 0) {
      chosen = c;
      break;
    }
  }
  const assign = chosen.solution.sample(rand);
  const score = players.reduce((s, p, i) => s + wishScore(p.picks, assign[i], wishCount), 0);
  return { subset: chosen.subset, assign, score, total: chosen.total };
}
