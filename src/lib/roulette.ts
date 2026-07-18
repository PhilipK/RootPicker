import { combinations } from "./wish";
import { shuffleArr } from "./shuffle";
import type { Faction } from "../types";

/** Reach + A.8.1 legality for one candidate subset — the same rule every
    other mode's random-deal gate (Trading Post's `dealLineup`, Wishlist's
    `findBestWishAssignment`) already checks. */
function isLegalSubset(subset: Faction[], target: number): boolean {
  if (subset.some((f) => f.id === "vagabond") && subset.some((f) => f.id === "knaves")) return false;
  return subset.reduce((s, f) => s + f.reach, 0) >= target;
}

/** Second Vagabond never enters this mode (same as Trading Post/Raffle's
    dealt pools) — filtered here too, defensively, so this stays true even if
    a stray "vagabond2" ends up in `pool`. */
function candidatePool(pool: Faction[]): Faction[] {
  return pool.filter((f) => f.id !== "vagabond2");
}

/** Every legal playerCount-subset of `pool`. Pool is capped at 13 real
    factions, so this is always cheap (≤ C(13,6) = 1716), the same bound
    Trading Post and Wishlist rely on for their own subset enumeration. */
export function legalLineups(pool: Faction[], playerCount: number, target: number): Faction[][] {
  return combinations(candidatePool(pool), playerCount).filter((subset) => isLegalSubset(subset, target));
}

/** Does at least one legal lineup still exist for this pool? */
export function hasLegalLineup(pool: Faction[], playerCount: number, target: number): boolean {
  return legalLineups(pool, playerCount, target).length > 0;
}

/** One spin: pick uniformly among the legal subsets of `pool`, then shuffle
    who gets what. Null means the pool can no longer field a legal table —
    should only happen if a caller ignores a blocked veto. */
export function spinLineup(pool: Faction[], playerCount: number, target: number): string[] | null {
  const legal = legalLineups(pool, playerCount, target);
  if (!legal.length) return null;
  const subset = legal[Math.floor(Math.random() * legal.length)];
  return shuffleArr(subset.map((f) => f.id));
}

/** Would exiling `id` — on top of whatever's already exiled this session —
    leave zero legal lineups? The spec's guard: "veto blocked if it would
    leave no legal lineup." Vetoing budgets (1 per player) are honor-system
    only and never checked here — this is the one guard the app enforces. */
export function vetoBlockReason(
  pool: Faction[],
  exiled: ReadonlySet<string>,
  id: string,
  playerCount: number,
  target: number,
): string | null {
  const remaining = pool.filter((f) => f.id !== id && !exiled.has(f.id));
  if (!hasLegalLineup(remaining, playerCount, target)) {
    return "Vetoing this would leave no legal lineup for this table — lock this one in instead";
  }
  return null;
}
