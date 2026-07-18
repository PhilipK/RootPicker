import { byId } from "../data/factions";

/** Cards this many wide, dealt fresh for whoever's turn it is. Recycling
    (unpicked hand cards simply stay in the shared pool) keeps this feasible
    even at 5-6 players — see the module doc below. */
export const HAND_SIZE = 3;

/** A.8.1: once one of Vagabond/Knaves is picked, the other is banned from
    every future pool. Both can still appear in the same hand before either
    is picked — the exclusion only bites once one is actually taken. */
export type Banned = "vagabond" | "knaves" | null;

export function bannedAfter(pickedIds: string[]): Banned {
  if (pickedIds.includes("vagabond")) return "knaves";
  if (pickedIds.includes("knaves")) return "vagabond";
  return null;
}

/** Reach total and militant coverage of an already-picked set. */
export function accumFromPicks(pickedIds: string[]): { sum: number; mil: boolean } {
  return {
    sum: pickedIds.reduce((s, id) => s + byId[id].reach, 0),
    mil: pickedIds.some((id) => byId[id].type === "militant"),
  };
}

/**
 * Can the rest of the draft still finish legally (reach >= target, at least
 * one militant) if `playersRemaining` more players each take one card out of
 * the shared `pool`? Unlike the old partitioned-hands dealer, cards that are
 * dealt but not picked simply stay in `pool` for later turns ("recycling") —
 * so this only has to reason about one shared pool shrinking by exactly one
 * card per remaining turn, not a fixed partition per hand. Memoized on pool
 * membership since the same subset recurs along many removal orders.
 */
export function draftSolvable(
  pool: string[],
  playersRemaining: number,
  sum: number,
  mil: boolean,
  banned: Banned,
  target: number,
  memo: Map<string, boolean> = new Map(),
): boolean {
  if (playersRemaining === 0) return mil && sum >= target;
  const key = `${playersRemaining}|${sum}|${mil}|${banned}|${pool.slice().sort().join(",")}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  let ok = false;
  for (const id of pool) {
    if (id === banned) continue;
    const f = byId[id];
    const nextPool = pool.filter((x) => x !== id);
    const nextBanned: Banned = banned ?? (id === "vagabond" ? "knaves" : id === "knaves" ? "vagabond" : null);
    if (draftSolvable(nextPool, playersRemaining - 1, sum + f.reach, mil || f.type === "militant", nextBanned, target, memo)) {
      ok = true;
      break;
    }
  }
  memo.set(key, ok);
  return ok;
}

/** Every card from `pool` that's safe to show: picking it still leaves the
    remaining draft (one turn shorter) solvable. Every card returned here is
    guaranteed pickable — nothing needs to be hidden or apologized for. */
export function safeCandidates(
  pool: string[],
  playersRemaining: number,
  sum: number,
  mil: boolean,
  banned: Banned,
  target: number,
): string[] {
  const memo = new Map<string, boolean>();
  return pool.filter((id) => {
    if (id === banned) return false;
    const f = byId[id];
    const nextPool = pool.filter((x) => x !== id);
    const nextBanned: Banned = banned ?? (id === "vagabond" ? "knaves" : id === "knaves" ? "vagabond" : null);
    return draftSolvable(nextPool, playersRemaining - 1, sum + f.reach, mil || f.type === "militant", nextBanned, target, memo);
  });
}

/** The hand to actually show: up to `HAND_SIZE` safe candidates, in an order
    the caller controls (inject real randomness from the component so this
    function — and the reducer that stores its result — stay pure/testable). */
export function dealHand(
  pool: string[],
  playersRemaining: number,
  sum: number,
  mil: boolean,
  banned: Banned,
  target: number,
  shuffle: <T>(arr: T[]) => T[],
): string[] {
  const candidates = safeCandidates(pool, playersRemaining, sum, mil, banned, target);
  return shuffle(candidates.slice()).slice(0, HAND_SIZE);
}
