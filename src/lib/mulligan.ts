import { combinations } from "./wish";
import { multisetLegal } from "./trade";
import type { Faction } from "../types";

// Reach + A.8.1 legality is identical to Trading Post's — reuse it rather
// than re-deriving the same rule twice.
export { multisetLegal };

/** Every legal playerCount-subset of `pool`: reach ≥ target and never
    Vagabond + Knaves together (A.8.1). Same construction as Trading Post's
    deal — enumerate every combination via `combinations`, keep the ones
    `multisetLegal` accepts. Pool is capped low enough (owned factions minus
    Second Vagabond, ≤13) that this is always cheap. */
export function legalLineups(pool: Faction[], playerCount: number, target: number): Faction[][] {
  return combinations(pool, playerCount).filter((subset) => multisetLegal(subset.map((f) => f.id), target));
}

/**
 * Which market factions could legally replace seat `seatIndex`'s current
 * holding?
 *
 * A candidate must:
 *  - not be the faction that seat itself currently holds — drawing your own
 *    discard straight back isn't a real mulligan, and this bar applies only
 *    to the discarder; the same faction is fully open to anyone else who
 *    mulligans later, once it's genuinely sitting in the market.
 *  - keep the whole table's holdings multiset legal once swapped in (reach
 *    ≥ target, A.8.1), via `multisetLegal`.
 *
 * An empty result means the mulligan is blocked: nothing in the market can
 * replace this seat's holding without breaking the table.
 */
export function legalReplacements(
  market: string[],
  holdings: string[],
  seatIndex: number,
  target: number,
): string[] {
  const own = holdings[seatIndex];
  return market.filter((id) => {
    if (id === own) return false;
    const next = holdings.slice();
    next[seatIndex] = id;
    return multisetLegal(next, target);
  });
}
