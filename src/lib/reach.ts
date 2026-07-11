import { byId, FACTIONS, REACH_TARGET } from "../data/factions";
import type { Faction } from "../types";

/** Real factions the table can actually deal from, per the Settings page.
    vagabond2 tags along with vagabond since it's the same box's second character deck,
    not a separate purchase. */
export function availableFactions(ownedIds: Set<string>): Faction[] {
  return FACTIONS.filter((f) => ownedIds.has(f.id === "vagabond2" ? "vagabond" : f.id));
}

export function effTarget(playerCount: number, adventurous: boolean): number {
  return adventurous ? 17 : REACH_TARGET[playerCount];
}

/** Could the table still reach the recommended total if `id` is added to `sel`?
    Checks the best case: current picks + candidate + the highest-reach factions
    still available for the remaining seats (up to `capacity` factions total). */
export function reachBlockReason(
  sel: Set<string>,
  id: string,
  capacity: number,
  pool: Faction[],
  target: number,
): string | null {
  if (id === "vagabond2" && !sel.has("vagabond")) return "Select the Vagabond first";
  const S = new Set(sel);
  S.add(id);
  if (S.has("vagabond") && S.has("knaves"))
    return "The Vagabond and the Knaves cannot both be in the same game (A.8.1)";
  const slots = capacity - S.size;
  if (slots < 0) return `You already have ${capacity} factions — deselect one first`;
  let rest = pool.filter((f) => !S.has(f.id));
  if (S.has("knaves")) rest = rest.filter((f) => f.id !== "vagabond" && f.id !== "vagabond2");
  if (!S.has("vagabond") && !rest.some((f) => f.id === "vagabond"))
    rest = rest.filter((f) => f.id !== "vagabond2");
  const best =
    [...S].reduce((s, fid) => s + byId[fid].reach, 0) +
    rest.map((f) => f.reach).sort((a, b) => b - a).slice(0, slots).reduce((s, r) => s + r, 0);
  if (best < target) return `Best possible total would be ${best} — can’t reach ${target}`;
  return null;
}

export function reachVerdict(total: number, recommended: number): { cls: "ok" | "adventurous" | "bad"; label: string } {
  if (total >= recommended) return { cls: "ok", label: "good fit" };
  if (total >= 17) return { cls: "adventurous", label: "adventurous (17+)" };
  return { cls: "bad", label: "not enough reach" };
}
