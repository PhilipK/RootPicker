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

/** Optimal assignment problem via bitmask DP: dp[mask] = best total score
    assigning the first popcount(mask) players to the faction-index set `mask`. */
export function bitmaskAssign(
  factions: Faction[],
  players: WishPlayer[],
  wishCount: number,
): { score: number; assign: string[] } | null {
  const N = players.length;
  const full = (1 << N) - 1;
  const dp = new Array(1 << N).fill(-Infinity);
  const parent = new Array(1 << N).fill(-1);
  dp[0] = 0;
  for (let mask = 0; mask <= full; mask++) {
    if (dp[mask] === -Infinity) continue;
    let p = 0;
    for (let m = mask; m; m >>= 1) p += m & 1;
    if (p >= N) continue;
    for (let f = 0; f < N; f++) {
      if (mask & (1 << f)) continue;
      const sc = dp[mask] + wishScore(players[p].picks, factions[f].id, wishCount);
      const nmask = mask | (1 << f);
      if (sc > dp[nmask]) {
        dp[nmask] = sc;
        parent[nmask] = f;
      }
    }
  }
  if (dp[full] === -Infinity) return null;
  let mask = full;
  const assign = new Array(N);
  for (let p = N - 1; p >= 0; p--) {
    const f = parent[mask];
    assign[p] = factions[f].id;
    mask ^= 1 << f;
  }
  return { score: dp[full], assign };
}

export interface WishAssignment {
  subset: Faction[];
  assign: string[];
  score: number;
  total: number;
}

/** Try every reach-safe faction subset of the right size (small enough to be
    exhaustive: at most C(13,6)=1716), solve each one optimally, and keep a
    random pick among whichever subsets achieve the best total happiness. */
export function findBestWishAssignment(
  players: WishPlayer[],
  pool: Faction[],
  target: number,
  wishCount: number,
): WishAssignment | null {
  const N = players.length;
  const candidates: WishAssignment[] = [];
  for (const subset of combinations(pool, N)) {
    if (subset.some((f) => f.id === "vagabond") && subset.some((f) => f.id === "knaves")) continue;
    const total = subset.reduce((s, f) => s + f.reach, 0);
    if (total < target) continue;
    const result = bitmaskAssign(subset, players, wishCount);
    if (!result) continue;
    candidates.push({ subset, assign: result.assign, score: result.score, total });
  }
  if (!candidates.length) return null;
  const maxScore = Math.max(...candidates.map((c) => c.score));
  const bestOnes = candidates.filter((c) => c.score === maxScore);
  return bestOnes[Math.floor(Math.random() * bestOnes.length)];
}
