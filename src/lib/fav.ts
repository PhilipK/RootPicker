import { byId } from "../data/factions";

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
  via: "fav" | "picked";
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
  | { cls: "void-line"; type: "fav-void-removed"; by: number; id: string }
  | { cls: "void-line"; type: "fav-void-pair"; vagabondBy: number; knavesBy: number }
  | { cls: "void-line"; type: "fav-void-collision"; byList: number[]; id: string }
  | { cls: "void-line"; type: "fav-void-infeasible"; by: number; id: string }
  | { cls: "fav-line"; type: "fav-applied"; by: number; id: string }
  | { cls: "fav-line"; type: "assign-applied"; by: number; id: string }
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
  const candidates: FavChoice[] = [];
  for (const [id, group] of byFaction) {
    if (banned.some((b) => b.id === id)) {
      for (const c of group) {
        log.push({ cls: "void-line", type: "fav-void-banned", by: c.seatIndex, id });
        voided.push(c.seatIndex);
      }
      continue;
    }
    if (!pool.includes(id)) {
      for (const c of group) {
        log.push({ cls: "void-line", type: "fav-void-removed", by: c.seatIndex, id });
        voided.push(c.seatIndex);
      }
      continue;
    }
    if (group.length > 1) {
      log.push({ cls: "void-line", type: "fav-void-collision", byList: group.map((c) => c.seatIndex), id });
      voided.push(...group.map((c) => c.seatIndex));
      continue;
    }
    candidates.push(group[0]);
  }

  // A.8.1: Vagabond and Knaves can never both survive — if both are favorited this round,
  // neither has priority over the other, so both are voided rather than picking a "winner".
  const vagPick = candidates.find((c) => c.id === "vagabond");
  const knavesPick = candidates.find((c) => c.id === "knaves");
  const liveCandidates =
    vagPick && knavesPick
      ? (() => {
          log.push({ cls: "void-line", type: "fav-void-pair", vagabondBy: vagPick.seatIndex, knavesBy: knavesPick.seatIndex });
          voided.push(vagPick.seatIndex, knavesPick.seatIndex);
          return candidates.filter((c) => c !== vagPick && c !== knavesPick);
        })()
      : candidates;

  // Everyone's favorite this round is checked as one joint request, not one at a time —
  // otherwise whoever gets resolved first "spends" the table's slack and an equally valid
  // later favorite can get voided for a shortfall that isn't really theirs.
  if (liveCandidates.length) {
    const ids = liveCandidates.map((c) => c.id);
    const halves = ids
      .map((id) => otherHalf(id))
      .filter((h): h is string => !!h && !ids.includes(h));
    const restPool = pool.filter((p) => !ids.includes(p) && !halves.includes(p));
    const { lockedSum, lockedMilitant, slots } = favStateFrom(locked, playerCount);
    const addSum = liveCandidates.reduce((s, c) => s + byId[c.id].reach, 0);
    const addMilitant = liveCandidates.some((c) => byId[c.id].type === "militant");
    const feasible = favFeasible(
      restPool,
      lockedSum + addSum,
      lockedMilitant || addMilitant,
      slots - liveCandidates.length,
      target,
    );
    if (!feasible) {
      for (const c of liveCandidates) {
        log.push({ cls: "void-line", type: "fav-void-infeasible", by: c.seatIndex, id: c.id });
        voided.push(c.seatIndex);
      }
    } else {
      for (const c of liveCandidates) {
        pool = pool.filter((p) => p !== c.id);
        locked = [...locked, { seatIndex: c.seatIndex, id: c.id }];
        log.push({ cls: "fav-line", type: "fav-applied", by: c.seatIndex, id: c.id });
        const half = otherHalf(c.id);
        if (half && pool.includes(half)) {
          pool = pool.filter((p) => p !== half);
          log.push({ cls: "ban-line", type: "half-removed", id: half, causeId: c.id });
        }
      }
    }
  }

  return { pool, banned, locked, log, pending: voided.sort((a, b) => a - b) };
}

/** Once nobody has anything left to ban or favorite, banners pick from what survives —
    first to ban goes last, so banning costs you the pick order favoriting would've earned. */
export function assignPickOrder(banned: FavBanned[]): number[] {
  return banned
    .slice()
    .reverse()
    .map((b) => b.by);
}

/** Apply one banner's pick: locks it in and, per A.8.1, drops its still-unplayed other half. */
export function applyAssignPick(
  pool: string[],
  locked: FavLocked[],
  seatIndex: number,
  id: string,
): { pool: string[]; locked: FavLocked[]; log: FavLogEntry[] } {
  const half = otherHalf(id);
  let newPool = pool.filter((p) => p !== id);
  const log: FavLogEntry[] = [{ cls: "fav-line", type: "assign-applied", by: seatIndex, id }];
  if (half && newPool.includes(half)) {
    newPool = newPool.filter((p) => p !== half);
    log.push({ cls: "ban-line", type: "half-removed", id: half, causeId: id });
  }
  return { pool: newPool, locked: [...locked, { seatIndex, id }], log };
}
