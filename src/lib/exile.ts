import { favFeasible } from "./fav";
import { combinations } from "./wish";

/** Total bans for the round: owned pool minus playerCount minus 2 slots of
    slack, so the survivor pool the final deal draws from is always exactly
    `playerCount + 2` factions — small enough that "does a legal lineup still
    exist" and "enumerate every legal lineup" are both cheap, no search
    needed. Clamped at 0 for tiny pools (nothing to ban). */
export function totalBansFor(poolSize: number, seatCount: number): number {
  return Math.max(0, poolSize - seatCount - 2);
}

/** Round-robin snake order over seat indices — 0..n-1, then n-1..0, then
    0..n-1 again, and so on — so bans distribute as evenly as the total
    allows. When `totalBans` isn't a multiple of `seatCount` some seats end
    up with one fewer ban than others; that shortfall is compensated later
    via `firstSeatFor`, not by this function. */
export function banOrderFor(seatCount: number, totalBans: number): number[] {
  const order: number[] = [];
  let forward = true;
  while (order.length < totalBans) {
    const lap = Array.from({ length: seatCount }, (_, i) => (forward ? i : seatCount - 1 - i));
    order.push(...lap);
    forward = !forward;
  }
  return order.slice(0, totalBans);
}

/** How many turns each seat actually gets across the full ban order. */
export function banCounts(seatCount: number, banSeatIndices: number[]): number[] {
  const counts = new Array(seatCount).fill(0);
  for (const s of banSeatIndices) counts[s]++;
  return counts;
}

/** Compensation for uneven ban splits: whoever banned fewest times gets
    priority for the first-player seat. Ties (including "everyone banned the
    same number of times") are broken by `tieBreakOrder`, a random permutation
    of seat indices supplied by the caller. */
export function firstSeatFor(seatCount: number, banSeatIndices: number[], tieBreakOrder: number[]): number {
  const counts = banCounts(seatCount, banSeatIndices);
  const min = Math.min(...counts);
  for (const s of tieBreakOrder) if (counts[s] === min) return s;
  return 0;
}

/** Reason a candidate exile is blocked, or null if it's fine: does a legal
    playerCount-subset of the pool survive without `id`? Mirrors
    `reachBlockReason`'s "best case" framing but as an existence check over
    the whole remaining pool rather than a single running selection — which is
    exactly what `favFeasible` (Fav/Ban's ban-feasibility check) already
    computes, so it's reused here rather than re-derived. */
export function banBlockReason(pool: string[], id: string, seatCount: number, target: number): string | null {
  const remaining = pool.filter((p) => p !== id);
  if (remaining.length < seatCount) return "Exiling this would leave too few factions for the table";
  return favFeasible(remaining, 0, false, seatCount, target)
    ? null
    : "Exiling this would leave no legal lineup for the table";
}

/** Every legal playerCount-sized lineup the survivor pool can still field —
    reach ≥ target, at least one militant, never both Vagabond and Knaves.
    `favFeasible` checks exactly this for a candidate subset when `slots`
    equals the subset's own size (no further picks left to make), so it
    doubles as the per-subset legality filter here — the same "legality-aware
    roll" Fav/Ban already has, reused instead of duplicated. The pool is
    always ≤ playerCount + 2 by the time this runs, so the full enumeration is
    tiny (at most C(playerCount+2, playerCount) = C(playerCount+2, 2)). */
export function legalLineups(poolIds: string[], seatCount: number, target: number): string[][] {
  return combinations(poolIds, seatCount).filter((subset) => favFeasible(subset, 0, false, subset.length, target));
}

export interface ExileBan {
  seatIndex: number;
  id: string;
}

export type ExilePhase = "setup" | "ban" | "revealReady" | "done";

export interface ExileCore {
  phase: ExilePhase;
  seats: string[];
  /** current survivor pool; shrinks by one on every ban */
  pool: string[];
  /** seat index per ban turn, fixed once the round starts */
  banOrder: number[];
  bans: ExileBan[];
  /** assign[seatIndex] = the faction dealt to that seat; empty until "done" */
  assign: string[];
  firstSeat: number;
}

export interface ExileState extends ExileCore {
  past: ExileCore[];
}

const emptyCore: ExileCore = {
  phase: "setup",
  seats: [],
  pool: [],
  banOrder: [],
  bans: [],
  assign: [],
  firstSeat: 0,
};
export const initialExileState: ExileState = { ...emptyCore, past: [] };

function core(state: ExileState): ExileCore {
  const { past: _past, ...rest } = state;
  return rest;
}

export type ExileAction =
  | { type: "START"; seats: string[]; pool: string[] }
  | { type: "BAN"; id: string; target: number }
  | { type: "DEAL"; target: number; index: number; seatOrder: number[] }
  | { type: "UNDO" }
  | { type: "RESET" };

export function exileReducer(state: ExileState, action: ExileAction): ExileState {
  switch (action.type) {
    case "START": {
      const banOrder = banOrderFor(action.seats.length, totalBansFor(action.pool.length, action.seats.length));
      return {
        phase: banOrder.length === 0 ? "revealReady" : "ban",
        seats: action.seats,
        pool: action.pool,
        banOrder,
        bans: [],
        assign: [],
        firstSeat: 0,
        past: [],
      };
    }
    case "BAN": {
      if (state.phase !== "ban") return state;
      const seatIndex = state.banOrder[state.bans.length];
      if (seatIndex === undefined) return state;
      if (!state.pool.includes(action.id)) return state;
      const reason = banBlockReason(state.pool, action.id, state.seats.length, action.target);
      if (reason) return state;
      const pool = state.pool.filter((x) => x !== action.id);
      const bans = [...state.bans, { seatIndex, id: action.id }];
      const past = [...state.past, core(state)];
      return { ...state, past, pool, bans, phase: bans.length === state.banOrder.length ? "revealReady" : "ban" };
    }
    case "DEAL": {
      if (state.phase !== "revealReady") return state;
      const legal = legalLineups(state.pool, state.seats.length, action.target);
      if (!legal.length) return state; // shouldn't happen — the ban guard keeps a legal lineup alive throughout
      const chosen = legal[action.index % legal.length];
      const assign = new Array(state.seats.length).fill("");
      for (let i = 0; i < chosen.length; i++) assign[action.seatOrder[i]] = chosen[i];
      const firstSeat = firstSeatFor(state.seats.length, state.banOrder, action.seatOrder);
      const past = [...state.past, core(state)];
      return { ...state, past, assign, firstSeat, phase: "done" };
    }
    case "UNDO": {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return { ...prev, past: state.past.slice(0, -1) };
    }
    case "RESET":
      return initialExileState;
  }
}
