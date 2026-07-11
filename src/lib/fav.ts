import { byId } from "../data/factions";
import type { Faction } from "../types";
import { shuffleArr } from "./shuffle";

export const otherHalf = (id: string): string | null =>
  id === "vagabond" ? "knaves" : id === "knaves" ? "vagabond" : null;

/** Can `slots` players still be served from `poolIds` so the table makes `target`
    with a militant, never fielding both the Vagabond and the Knaves? */
export function favFeasible(
  poolIds: string[],
  lockedSum: number,
  lockedMilitant: boolean,
  slots: number,
  target: number,
): boolean {
  if (slots < 0 || poolIds.length < slots) return false;
  if (slots === 0) return lockedMilitant && lockedSum >= target;
  const pool = poolIds.map((id) => byId[id]);
  const variants =
    pool.some((f) => f.id === "vagabond") && pool.some((f) => f.id === "knaves")
      ? [pool.filter((f) => f.id !== "vagabond"), pool.filter((f) => f.id !== "knaves")]
      : [pool];
  for (const p of variants) {
    if (p.length < slots) continue;
    const sorted = p.slice().sort((a, b) => b.reach - a.reach);
    const top = sorted.slice(0, slots);
    let sum = lockedSum + top.reduce((s, f) => s + f.reach, 0);
    if (!lockedMilitant && !top.some((f) => f.type === "militant")) {
      const swapIn = sorted.slice(slots).find((f) => f.type === "militant");
      if (!swapIn) continue;
      sum = sum - top[top.length - 1].reach + swapIn.reach;
    }
    if (sum >= target) return true;
  }
  return false;
}

export interface FavState {
  pool: string[];
  lockedSum: number;
  lockedMilitant: boolean;
  slots: number;
  target: number;
}

export function favBlockReason(kind: "fav" | "ban", id: string, state: FavState): string | null {
  const { pool, lockedSum, lockedMilitant, slots, target } = state;
  if (kind === "ban") {
    return favFeasible(pool.filter((p) => p !== id), lockedSum, lockedMilitant, slots, target)
      ? null
      : "Banning this would leave the table unable to reach the total";
  }
  const half = otherHalf(id);
  const rest = pool.filter((p) => p !== id && p !== half);
  const f = byId[id];
  return favFeasible(rest, lockedSum + f.reach, lockedMilitant || f.type === "militant", slots - 1, target)
    ? null
    : "Locking this would leave the table unable to reach the total";
}

export interface FavLocked {
  seatIndex: number;
  id: string;
}
export interface FavBanned {
  id: string;
  by: number;
}
export interface FavChoice {
  seatIndex: number;
  kind: "fav" | "ban";
  id: string;
}
export interface FavAssigned {
  seatIndex: number;
  id: string;
  via: "fav" | "random";
}

export function favStateFrom(locked: FavLocked[], playerCount: number) {
  return {
    lockedSum: locked.reduce((s, l) => s + byId[l.id].reach, 0),
    lockedMilitant: locked.some((l) => byId[l.id].type === "militant"),
    slots: playerCount - locked.length,
  };
}

export type FavLogEntry =
  | { cls: "ban-line"; type: "ban-already-gone"; by: number; id: string }
  | { cls: "void-line"; type: "ban-void"; by: number; id: string }
  | { cls: "ban-line"; type: "ban-applied"; by: number; id: string }
  | { cls: "void-line"; type: "fav-void-banned"; by: number; id: string }
  | { cls: "void-line"; type: "fav-void-collision"; byList: number[]; id: string }
  | { cls: "void-line"; type: "fav-void-infeasible"; by: number; id: string }
  | { cls: "fav-line"; type: "fav-applied"; by: number; id: string }
  | { cls: "ban-line"; type: "half-removed"; id: string; causeId: string };

/** Reveal: bans first (ban trumps favorite), then favorites; collisions void both. */
export function resolveFavRound(
  poolIn: string[],
  lockedIn: FavLocked[],
  bannedIn: FavBanned[],
  choices: FavChoice[],
  playerCount: number,
  target: number,
): { pool: string[]; banned: FavBanned[]; locked: FavLocked[]; log: FavLogEntry[]; pending: number[] } {
  let pool = poolIn.slice();
  let locked = lockedIn.slice();
  let banned = bannedIn.slice();
  const log: FavLogEntry[] = [];
  const voided: number[] = [];

  for (const c of choices.filter((c) => c.kind === "ban")) {
    if (banned.some((b) => b.id === c.id)) {
      log.push({ cls: "ban-line", type: "ban-already-gone", by: c.seatIndex, id: c.id });
      continue;
    }
    const { lockedSum, lockedMilitant, slots } = favStateFrom(locked, playerCount);
    if (!favFeasible(pool.filter((p) => p !== c.id), lockedSum, lockedMilitant, slots, target)) {
      log.push({ cls: "void-line", type: "ban-void", by: c.seatIndex, id: c.id });
      voided.push(c.seatIndex);
      continue;
    }
    pool = pool.filter((p) => p !== c.id);
    banned = [...banned, { id: c.id, by: c.seatIndex }];
    log.push({ cls: "ban-line", type: "ban-applied", by: c.seatIndex, id: c.id });
  }

  const favs = choices.filter((c) => c.kind === "fav");
  const byFaction = new Map<string, FavChoice[]>();
  for (const c of favs) {
    const arr = byFaction.get(c.id) ?? [];
    arr.push(c);
    byFaction.set(c.id, arr);
  }
  for (const [id, group] of byFaction) {
    if (banned.some((b) => b.id === id)) {
      for (const c of group) {
        log.push({ cls: "void-line", type: "fav-void-banned", by: c.seatIndex, id });
        voided.push(c.seatIndex);
      }
      continue;
    }
    if (group.length > 1) {
      log.push({ cls: "void-line", type: "fav-void-collision", byList: group.map((c) => c.seatIndex), id });
      voided.push(...group.map((c) => c.seatIndex));
      continue;
    }
    const c = group[0];
    const half = otherHalf(id);
    const rest = pool.filter((p) => p !== id && p !== half);
    const { lockedSum, lockedMilitant, slots } = favStateFrom(locked, playerCount);
    const f = byId[id];
    if (!favFeasible(rest, lockedSum + f.reach, lockedMilitant || f.type === "militant", slots - 1, target)) {
      log.push({ cls: "void-line", type: "fav-void-infeasible", by: c.seatIndex, id });
      voided.push(c.seatIndex);
      continue;
    }
    pool = pool.filter((p) => p !== id);
    locked = [...locked, { seatIndex: c.seatIndex, id }];
    log.push({ cls: "fav-line", type: "fav-applied", by: c.seatIndex, id });
    if (half && pool.includes(half)) {
      pool = pool.filter((p) => p !== half);
      log.push({ cls: "ban-line", type: "half-removed", id: half, causeId: id });
    }
  }

  return { pool, banned, locked, log, pending: voided.sort((a, b) => a - b) };
}

/** Once nobody has anything left to ban or favorite, randomly assign a reach-safe,
    militant-including, Vagabond/Knaves-exclusive combo to whoever isn't locked in yet. */
export function finishFav(playerCount: number, pool: string[], locked: FavLocked[], target: number): FavAssigned[] {
  const undecided = Array.from({ length: playerCount }, (_, i) => i).filter(
    (i) => !locked.some((l) => l.seatIndex === i),
  );
  const { lockedSum, lockedMilitant } = favStateFrom(locked, playerCount);
  const poolFactions = pool.map((id) => byId[id]);
  const combos: Faction[][] = [];
  (function rec(start: number, combo: Faction[]) {
    if (combo.length === undecided.length) {
      const sum = lockedSum + combo.reduce((s, f) => s + f.reach, 0);
      const militant = lockedMilitant || combo.some((f) => f.type === "militant");
      const pair = combo.some((f) => f.id === "vagabond") && combo.some((f) => f.id === "knaves");
      if (sum >= target && militant && !pair) combos.push(combo.slice());
      return;
    }
    for (let i = start; i <= poolFactions.length - (undecided.length - combo.length); i++) {
      combo.push(poolFactions[i]);
      rec(i + 1, combo);
      combo.pop();
    }
  })(0, []);
  const combo = shuffleArr(combos[Math.floor(Math.random() * combos.length)].slice());
  const assigned: FavAssigned[] = locked.map((l) => ({ seatIndex: l.seatIndex, id: l.id, via: "fav" }));
  undecided.forEach((si, i) => assigned.push({ seatIndex: si, id: combo[i].id, via: "random" }));
  return assigned;
}
