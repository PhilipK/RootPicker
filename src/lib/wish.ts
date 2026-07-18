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
    assigning the first popcount(mask) players to the item-index set `mask`.
    Generic over what "score" means — the caller supplies a per-(player
    index, item) function — so any mode that needs "best pairing of N players
    to N items" can reuse the exact same search. `bitmaskAssign` below (wish
    ranks) and Omakase's slider-distance scoring (`src/lib/omakase.ts`) are
    both thin callers over this one DP. */
export function bitmaskAssignBy<T>(
  items: T[],
  playerCount: number,
  scoreOf: (playerIndex: number, item: T) => number,
): { score: number; assign: number[] } | null {
  const N = playerCount;
  if (items.length !== N) return null;
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
      const sc = dp[mask] + scoreOf(p, items[f]);
      const nmask = mask | (1 << f);
      if (sc > dp[nmask]) {
        dp[nmask] = sc;
        parent[nmask] = f;
      }
    }
  }
  if (dp[full] === -Infinity) return null;
  let mask = full;
  const assign: number[] = new Array(N);
  for (let p = N - 1; p >= 0; p--) {
    const f = parent[mask];
    assign[p] = f;
    mask ^= 1 << f;
  }
  return { score: dp[full], assign };
}

/** Optimal assignment problem via bitmask DP: dp[mask] = best total score
    assigning the first popcount(mask) players to the faction-index set `mask`. */
export function bitmaskAssign(
  factions: Faction[],
  players: WishPlayer[],
  wishCount: number,
): { score: number; assign: string[] } | null {
  const result = bitmaskAssignBy(factions, players.length, (p, f) => wishScore(players[p].picks, f.id, wishCount));
  if (!result) return null;
  return { score: result.score, assign: result.assign.map((i) => factions[i].id) };
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
