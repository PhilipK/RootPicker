import { combinations } from "./wish";
import { shuffleArr } from "./shuffle";
import { byId } from "../data/factions";
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

/** The opening spin: pick uniformly among the legal subsets of `pool`, then
    shuffle who gets what. Null means the pool can't field a legal table. */
export function spinLineup(pool: Faction[], playerCount: number, target: number): string[] | null {
  const legal = legalLineups(pool, playerCount, target);
  if (!legal.length) return null;
  const subset = legal[Math.floor(Math.random() * legal.length)];
  return shuffleArr(subset.map((f) => f.id));
}

/** Factions that could take the vetoed seat: not exiled, not already at the
    table, and keeping the (otherwise unchanged) lineup reach-safe and
    A.8.1-safe. A veto swaps one seat's faction; the other seats keep theirs. */
export function replacementOptions(
  pool: Faction[],
  exiled: ReadonlySet<string>,
  lineup: readonly string[],
  vetoId: string,
  target: number,
): Faction[] {
  const kept = lineup.filter((id) => id !== vetoId).map((id) => byId[id]);
  return candidatePool(pool).filter(
    (f) =>
      f.id !== vetoId &&
      !exiled.has(f.id) &&
      !lineup.includes(f.id) &&
      isLegalSubset([...kept, f], target),
  );
}

/** Would vetoing `id` leave its seat with no legal replacement? The one
    guard the app enforces on a veto; budgets are enforced by the poll. */
export function vetoBlockReason(
  pool: Faction[],
  exiled: ReadonlySet<string>,
  lineup: readonly string[],
  id: string,
  target: number,
): string | null {
  if (replacementOptions(pool, exiled, lineup, id, target).length === 0) {
    return "No exiled-free faction could take this seat without leaving the table short — pass instead";
  }
  return null;
}

/** Draw a uniform random legal replacement for the vetoed seat. Null only if
    the caller ignored a blocked veto. */
export function drawReplacement(
  pool: Faction[],
  exiled: ReadonlySet<string>,
  lineup: readonly string[],
  vetoId: string,
  target: number,
): string | null {
  const options = replacementOptions(pool, exiled, lineup, vetoId, target);
  if (!options.length) return null;
  return options[Math.floor(Math.random() * options.length)].id;
}

/** Next seat index after `after` whose veto is unspent, or -1 when nobody
    with a token is left to poll. Pass -1 as `after` to scan from seat 0. */
export function nextUnspentSeat(vetoSpent: readonly boolean[], after: number): number {
  for (let i = after + 1; i < vetoSpent.length; i++) if (!vetoSpent[i]) return i;
  return -1;
}
