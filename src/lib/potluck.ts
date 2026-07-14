import { reachBlockReason } from "./reach";
import type { Faction } from "../types";

/** Pick order is the exact reverse of contribute/seat order: whoever
    contributes last picks first. That means seat 0 — already the app-wide
    convention for "first player in the real game" (Draft, Bounty, Teaching
    Tiers all star seat 0 or the last element of their own pick order) — is
    always the one who picks last here too. Rule 4 (last picker goes first)
    and the existing seat-0 convention line up for free; no separate
    "first player" bookkeeping needed. */
export function pickOrderFor(seatCount: number): number[] {
  return Array.from({ length: seatCount }, (_, i) => seatCount - 1 - i);
}

/** Bipartite perfect-matching check (Kuhn's algorithm): can every remaining
    picker in `own` (the faction they personally contributed) be assigned a
    distinct faction from `remainingPool`, with nobody assigned their own?
    The pool is capped at 6 factions, so this brute-force-cheap check runs on
    every candidate pick rather than special-casing "the last picker is stuck
    with their own faction" — it also catches subtler stranding a turn or two
    further out (e.g. a 3-remaining choice that dooms the picker after next). */
export function hasCompleteMatching(own: string[], remainingPool: string[]): boolean {
  const n = own.length;
  if (remainingPool.length !== n) return false;
  const matchOf: number[] = new Array(remainingPool.length).fill(-1); // pool index -> picker index

  function augment(picker: number, visited: boolean[]): boolean {
    for (let p = 0; p < remainingPool.length; p++) {
      if (remainingPool[p] === own[picker] || visited[p]) continue;
      visited[p] = true;
      if (matchOf[p] === -1 || augment(matchOf[p], visited)) {
        matchOf[p] = picker;
        return true;
      }
    }
    return false;
  }

  for (let i = 0; i < n; i++) {
    if (!augment(i, new Array(remainingPool.length).fill(false))) return false;
  }
  return true;
}

/** Reason a candidate pick is blocked, or null if it's fine: first the
    personal "not your own" rule, then the deadlock guard — would taking `id`
    leave a state where no assignment of the remaining pool to the remaining
    pickers avoids handing someone their own contribution? */
export function pickBlockReason(
  seatIndex: number,
  id: string,
  pool: string[],
  contributions: string[],
  pickOrder: number[],
  picksMade: number,
): string | null {
  if (id === contributions[seatIndex]) return "You brought this one — take something else";
  const remainingPickers = pickOrder.slice(picksMade + 1);
  const remainingPool = pool.filter((x) => x !== id);
  const remainingOwn = remainingPickers.map((s) => contributions[s]);
  if (!hasCompleteMatching(remainingOwn, remainingPool)) {
    return "Taking this would strand a later picker with only their own faction — pick another";
  }
  return null;
}

export interface PotluckPick {
  seatIndex: number;
  id: string;
}

export interface PotluckCore {
  phase: "setup" | "contribute" | "pick" | "done";
  seats: string[];
  /** contributions[i] = faction seat i brought; filled left-to-right during
      the contribute phase, so its current length also is the next
      contributor's seat index. */
  contributions: string[];
  /** Pickable faction ids. Equals the full contributed set once contribute
      finishes, then shrinks by one on every pick. */
  pool: string[];
  pickOrder: number[];
  picks: PotluckPick[];
}

export interface PotluckState extends PotluckCore {
  past: PotluckCore[];
}

const emptyCore: PotluckCore = {
  phase: "setup",
  seats: [],
  contributions: [],
  pool: [],
  pickOrder: [],
  picks: [],
};
export const initialPotluckState: PotluckState = { ...emptyCore, past: [] };

function core(state: PotluckState): PotluckCore {
  const { past: _past, ...rest } = state;
  return rest;
}

export type PotluckAction =
  | { type: "START"; seats: string[] }
  | { type: "CONTRIBUTE"; id: string; available: Faction[]; target: number }
  | { type: "PICK"; id: string }
  | { type: "UNDO" }
  | { type: "RESET" };

export function potluckReducer(state: PotluckState, action: PotluckAction): PotluckState {
  switch (action.type) {
    case "START":
      return { ...emptyCore, phase: "contribute", seats: action.seats, past: [] };
    case "CONTRIBUTE": {
      if (state.phase !== "contribute") return state;
      const reason = reachBlockReason(
        new Set(state.contributions),
        action.id,
        state.seats.length,
        action.available,
        action.target,
      );
      if (reason) return state;
      const contributions = [...state.contributions, action.id];
      const past = [...state.past, core(state)];
      if (contributions.length === state.seats.length) {
        return {
          ...state,
          past,
          contributions,
          pool: [...contributions],
          pickOrder: pickOrderFor(state.seats.length),
          phase: "pick",
        };
      }
      return { ...state, past, contributions };
    }
    case "PICK": {
      if (state.phase !== "pick") return state;
      const seatIndex = state.pickOrder[state.picks.length];
      if (!state.pool.includes(action.id)) return state;
      const reason = pickBlockReason(
        seatIndex,
        action.id,
        state.pool,
        state.contributions,
        state.pickOrder,
        state.picks.length,
      );
      if (reason) return state;
      const pool = state.pool.filter((x) => x !== action.id);
      const picks = [...state.picks, { seatIndex, id: action.id }];
      const past = [...state.past, core(state)];
      return { ...state, past, pool, picks, phase: picks.length === state.seats.length ? "done" : "pick" };
    }
    case "UNDO": {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return { ...prev, past: state.past.slice(0, -1) };
    }
    case "RESET":
      return initialPotluckState;
  }
}
