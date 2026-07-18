import type { Faction } from "../types";
import { combinations } from "./wish";

/**
 * Ballot matrix: `votes[i][j]` is the faction seat `i` nominated for seat `j`
 * (i.e. "I think you should play X"). `votes[i][i]` is never read — nobody
 * nominates for themselves — and is left as `""` by `emptyBallots`.
 */
export type Ballots = string[][];

export function emptyBallots(seatCount: number): Ballots {
  return Array.from({ length: seatCount }, () => Array.from({ length: seatCount }, () => ""));
}

/** The seats a given actor still owes a nomination to: every other seat, in
    seat order. Pure so the pass-the-device turn sequencing is unit-testable
    on its own. */
export function typecastTargets(actorIndex: number, seatCount: number): number[] {
  return Array.from({ length: seatCount }, (_, i) => i).filter((i) => i !== actorIndex);
}

/** How many *other* seats nominated `factionId` for `targetIndex` — the vote
    tally a candidate assignment would earn that seat if it received that
    faction. Anonymous by construction: only a count comes out, never who cast
    which vote. */
export function countVotesForFaction(votes: Ballots, targetIndex: number, factionId: string): number {
  let n = 0;
  for (let i = 0; i < votes.length; i++) {
    if (i === targetIndex) continue;
    if (votes[i][targetIndex] === factionId) n++;
  }
  return n;
}

/** Optimal assignment problem via bitmask DP: dp[mask] = best total votes
    matched assigning the first popcount(mask) seats to the faction-index set
    `mask`. Mirrors `bitmaskAssign` in `wish.ts` with the score function
    swapped from "this player's own ranked picks" to "how many other players
    nominated this faction for this seat". */
export function bitmaskAssignVotes(factions: Faction[], votes: Ballots): { score: number; assign: string[] } | null {
  const N = votes.length;
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
      const sc = dp[mask] + countVotesForFaction(votes, p, factions[f].id);
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

export interface TypecastAssignment {
  subset: Faction[];
  assign: string[];
  score: number;
  total: number;
}

/** Try every reach-safe faction subset of the right size (same exhaustive
    search as `findBestWishAssignment`: at most C(13,6)=1716 subsets), solve
    each one optimally for total votes matched, and keep a random pick among
    whichever subsets tie for best. A subset with zero votes matched anywhere
    is a perfectly valid result — legality always wins over turnout. */
export function findBestTypecastAssignment(votes: Ballots, pool: Faction[], target: number): TypecastAssignment | null {
  const N = votes.length;
  const candidates: TypecastAssignment[] = [];
  for (const subset of combinations(pool, N)) {
    if (subset.some((f) => f.id === "vagabond") && subset.some((f) => f.id === "knaves")) continue;
    const total = subset.reduce((s, f) => s + f.reach, 0);
    if (total < target) continue;
    const result = bitmaskAssignVotes(subset, votes);
    if (!result) continue;
    candidates.push({ subset, assign: result.assign, score: result.score, total });
  }
  if (!candidates.length) return null;
  const maxScore = Math.max(...candidates.map((c) => c.score));
  const bestOnes = candidates.filter((c) => c.score === maxScore);
  return bestOnes[Math.floor(Math.random() * bestOnes.length)];
}
