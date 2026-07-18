import { nextLegalFaction } from "./bounty";
import type { Faction } from "../types";

/** Bounds for the configurable price range (Settings): the clock runs from
    −range to +range VP. */
export const MIN_DUTCH_RANGE = 2;
export const MAX_DUTCH_RANGE = 8;
export const DEFAULT_DUTCH_RANGE = 4;

/** Bounds for the configurable seconds-per-tick (Settings). The reducer never
    reads a clock itself — this is purely how often the component's timer
    dispatches TICK. */
export const MIN_DUTCH_TICK_SECONDS = 0.5;
export const MAX_DUTCH_TICK_SECONDS = 5;
export const DEFAULT_DUTCH_TICK_SECONDS = 1.5;

/** VP the price moves per TICK. Fixed — only the range and the pacing are
    exposed as settings. */
export const DUTCH_STEP = 1;

/** How long each fresh reveal sits frozen (button disabled) before the clock
    starts, in ms. Component-only timing, not reducer state. */
export const DUTCH_PREVIEW_MS = 2000;

export interface DutchClaim {
  seatIndex: number;
  id: string;
  /** the price showing at the moment of the claiming tap (VP) */
  price: number;
}

export type DutchLogEntry = {
  type: "claim";
  seatIndex: number;
  id: string;
  price: number;
  /** true for the final seat, auto-resolved with no clock or tap */
  auto?: boolean;
};

/** Seat indices among `seatCount` that have not yet claimed anything, in
    ascending order — there's no fixed turn order here, so "who's left" is
    just "everyone whose seat isn't in a claim yet". */
export function remainingSeats(seatCount: number, claims: DutchClaim[]): number[] {
  const claimedSeats = new Set(claims.map((c) => c.seatIndex));
  return Array.from({ length: seatCount }, (_, i) => i).filter((i) => !claimedSeats.has(i));
}

/** A claim's final VP is just the price it was taken at — could be negative
    if someone jumped in while the clock was still below 0. */
export const claimVP = (c: DutchClaim) => c.price;

/** Normalize so the lowest starting VP in the table is 0 — only relative VP
    matters, same convention as Bounty Draft. */
export function normalizeVP(claims: DutchClaim[]): number[] {
  const raw = claims.map(claimVP);
  const min = Math.min(...raw);
  return raw.map((v) => v - min);
}

interface DutchCore {
  phase: "setup" | "auction" | "done";
  seats: string[];
  /** price range: the clock runs from −range to +range VP */
  range: number;
  deck: string[];
  currentId: string | null;
  /** current showing price (VP), meaningful while phase is "auction" */
  price: number;
  /** true = frozen preview, CLAIM disabled, before the clock has started for
      this reveal */
  previewing: boolean;
  claims: DutchClaim[];
  log: DutchLogEntry[];
}
export interface DutchState extends DutchCore {
  past: DutchCore[];
}

const emptyCore: DutchCore = {
  phase: "setup",
  seats: [],
  range: DEFAULT_DUTCH_RANGE,
  deck: [],
  currentId: null,
  price: 0,
  previewing: true,
  claims: [],
  log: [],
};
export const initialDutchState: DutchState = { ...emptyCore, past: [] };

function core(state: DutchState): DutchCore {
  const { past: _past, ...rest } = state;
  return rest;
}

export type DutchAction =
  | { type: "START"; seats: string[]; deck: string[]; pool: Faction[]; target: number; range: number }
  | { type: "BEGIN_CLOCK" }
  | { type: "TICK" }
  | { type: "CLAIM"; seatIndex: number; price: number; pool: Faction[]; target: number }
  | { type: "UNDO" }
  | { type: "RESET" };

/**
 * Pure state machine — no timers, no Math.random, no Date.now(). The deck
 * arrives pre-shuffled in the START action and every other input is supplied
 * by the caller, so a fixed sequence of actions always replays to the same
 * final state (the property the tests below lean on for TICK/CLAIM replay).
 * The component owns the interval that dispatches TICK and the timeout that
 * dispatches BEGIN_CLOCK after the preview freeze; CLAIM carries the price
 * that was showing at tap time rather than trusting the reducer to still be
 * looking at the same tick when the action lands.
 */
export function dutchReducer(state: DutchState, action: DutchAction): DutchState {
  switch (action.type) {
    case "START": {
      const capacity = action.seats.length;
      const first = nextLegalFaction(action.deck, new Set(), capacity, action.pool, action.target);
      return {
        ...emptyCore,
        phase: "auction",
        seats: action.seats,
        range: action.range,
        deck: first?.rest ?? action.deck,
        currentId: first?.id ?? null,
        price: -action.range,
        previewing: true,
        claims: [],
        log: [],
        past: [],
      };
    }
    case "BEGIN_CLOCK": {
      if (state.phase !== "auction" || !state.previewing || state.currentId === null) return state;
      return { ...state, previewing: false };
    }
    case "TICK": {
      if (state.phase !== "auction" || state.previewing || state.currentId === null) return state;
      if (state.price >= state.range) return state; // holds at the cap — no auto-assign
      return { ...state, price: Math.min(state.range, state.price + DUTCH_STEP) };
    }
    case "CLAIM": {
      if (state.phase !== "auction" || state.currentId === null || state.previewing) return state;
      const claim: DutchClaim = { seatIndex: action.seatIndex, id: state.currentId, price: action.price };
      const claims = [...state.claims, claim];
      const log: DutchLogEntry[] = [
        ...state.log,
        { type: "claim", seatIndex: action.seatIndex, id: state.currentId, price: action.price },
      ];
      const past = [...state.past, core(state)];
      const claimedIds = new Set(claims.map((c) => c.id));
      const left = remainingSeats(state.seats.length, claims);

      if (left.length === 0) {
        return { ...state, past, claims, log, phase: "done", currentId: null };
      }

      if (left.length === 1) {
        // Nobody left to race against — hand the last seat the final reveal
        // at the top of the clock, no preview, no tap required.
        const finalSeat = left[0];
        const next = nextLegalFaction(state.deck, claimedIds, state.seats.length, action.pool, action.target);
        if (!next) {
          // Defensive: the legality invariant should always find one more —
          // if it somehow can't, leave the table one seat short rather than crash.
          return { ...state, past, claims, log, phase: "done", currentId: null };
        }
        const finalClaim: DutchClaim = { seatIndex: finalSeat, id: next.id, price: state.range };
        return {
          ...state,
          past,
          claims: [...claims, finalClaim],
          log: [...log, { type: "claim", seatIndex: finalSeat, id: next.id, price: state.range, auto: true }],
          phase: "done",
          currentId: null,
          deck: next.rest,
        };
      }

      const next = nextLegalFaction(state.deck, claimedIds, state.seats.length, action.pool, action.target);
      return {
        ...state,
        past,
        claims,
        log,
        deck: next?.rest ?? state.deck,
        currentId: next?.id ?? null,
        price: -state.range,
        previewing: true,
      };
    }
    case "UNDO": {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return { ...prev, past: state.past.slice(0, -1) };
    }
    case "RESET":
      return initialDutchState;
  }
}
