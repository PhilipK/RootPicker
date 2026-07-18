import { reachBlockReason } from "./reach";
import type { Faction } from "../types";

/** Seat `seat`'s left neighbor — the seat they gift to. A full n-cycle: every
    seat gifts exactly once and receives exactly once, direction is arbitrary
    (could as well be "right"), just needs to be consistent. */
export function leftNeighbor(seat: number, n: number): number {
  return (seat + 1) % n;
}

/** The giver of whatever `receiverSeat` was gifted — the inverse of
    `leftNeighbor`. */
export function giverOf(receiverSeat: number, n: number): number {
  return (receiverSeat - 1 + n) % n;
}

/** Reason a gift can't be accepted onto the table as-is, or null if it's fine.
    Three checks, matching the spec exactly: no duplicate (someone else's
    gift, already accepted, claimed the same faction), no Vagabond/Knaves
    conflict (A.8.1), and the accepted set plus this gift must still be able
    to reach the table's target — the same completability guard every other
    mode runs per pick (`reachBlockReason`, `src/lib/reach.ts`). */
export function giftAcceptReason(
  accepted: Set<string>,
  id: string,
  capacity: number,
  pool: Faction[],
  target: number,
): string | null {
  if (accepted.has(id)) return "Already gifted to someone else at the table";
  return reachBlockReason(accepted, id, capacity, pool, target);
}

/** Factions the giver can open-repick from once their original gift bounces:
    anything in the pool that would still be accepted onto the current table. */
export function legalSurvivors(accepted: Set<string>, pool: Faction[], capacity: number, target: number): string[] {
  return pool.filter((f) => !giftAcceptReason(accepted, f.id, capacity, pool, target)).map((f) => f.id);
}

export interface SantaEvent {
  type: "accepted" | "failed" | "repicked";
  seatIndex: number;
  giverSeat: number;
  id: string;
  reason?: string;
}

export interface SantaCore {
  phase: "setup" | "pass" | "gift" | "reveal" | "repick" | "done";
  seats: string[];
  /** gifts[seatIndex] = the faction that seat's right-hand neighbor gifted
      them, filled during the gift phase in giver-seat order. */
  gifts: (string | null)[];
  /** assign[seatIndex] = the faction that seat ends up with, once resolved */
  assign: (string | null)[];
  events: SantaEvent[];
  /** next receiver seat the reveal will resolve, in seat order */
  revealPointer: number;
  firstSeat: number;
}

export interface SantaState extends SantaCore {}

const emptyCore: SantaCore = {
  phase: "setup",
  seats: [],
  gifts: [],
  assign: [],
  events: [],
  revealPointer: 0,
  firstSeat: 0,
};

export const initialSantaState: SantaState = { ...emptyCore };

export type SantaAction =
  | { type: "START"; seats: string[] }
  | { type: "SHOW" }
  | { type: "GIFT"; id: string }
  | { type: "REVEAL"; count: number; available: Faction[]; target: number }
  | { type: "REPICK"; id: string; available: Faction[]; target: number }
  | { type: "RESET" };

/** Current giver's seat index — count of gifts already handed out. Givers go
    in seat order 0..n-1, same pass-the-device convention as every other mode. */
export function currentGiver(state: SantaState): number {
  return state.gifts.filter((g) => g !== null).length;
}

/** Wrap up the reveal: the first seat whose gift needed an open re-pick opens
    the real game — compensation for ending up with an arbitrary substitute
    instead of the gift a friend actually picked for them. Nobody needed a
    re-pick: seat 0, the app's standing "first player" convention. */
function finish(state: SantaState): SantaState {
  const failed = state.events.find((e) => e.type === "failed");
  return { ...state, phase: "done", firstSeat: failed ? failed.seatIndex : 0 };
}

export function santaReducer(state: SantaState, action: SantaAction): SantaState {
  switch (action.type) {
    case "START": {
      const n = action.seats.length;
      return {
        ...emptyCore,
        phase: "pass",
        seats: action.seats,
        gifts: new Array(n).fill(null),
        assign: new Array(n).fill(null),
      };
    }
    case "SHOW":
      if (state.phase !== "pass") return state;
      return { ...state, phase: "gift" };
    case "GIFT": {
      if (state.phase !== "gift") return state;
      const n = state.seats.length;
      const giver = currentGiver(state);
      const receiver = leftNeighbor(giver, n);
      const gifts = state.gifts.slice();
      gifts[receiver] = action.id;
      const done = giver + 1 >= n;
      return { ...state, gifts, phase: done ? "reveal" : "pass" };
    }
    case "REVEAL": {
      if (state.phase !== "reveal") return state;
      const n = state.seats.length;
      let next = state;
      for (let k = 0; k < action.count && next.phase === "reveal"; k++) {
        const r = next.revealPointer;
        if (r >= n) {
          next = finish(next);
          break;
        }
        const giftId = next.gifts[r]!;
        const accepted = new Set(next.assign.filter((x): x is string => x !== null));
        const giverSeat = giverOf(r, n);
        const reason = giftAcceptReason(accepted, giftId, n, action.available, action.target);
        if (!reason) {
          const assign = next.assign.slice();
          assign[r] = giftId;
          next = {
            ...next,
            assign,
            revealPointer: r + 1,
            events: [...next.events, { type: "accepted", seatIndex: r, giverSeat, id: giftId }],
          };
          if (next.revealPointer >= n) next = finish(next);
        } else {
          next = {
            ...next,
            phase: "repick",
            events: [...next.events, { type: "failed", seatIndex: r, giverSeat, id: giftId, reason }],
          };
        }
      }
      return next;
    }
    case "REPICK": {
      if (state.phase !== "repick") return state;
      const n = state.seats.length;
      const r = state.revealPointer;
      const giverSeat = giverOf(r, n);
      const accepted = new Set(state.assign.filter((x): x is string => x !== null));
      if (giftAcceptReason(accepted, action.id, n, action.available, action.target)) return state;
      const assign = state.assign.slice();
      assign[r] = action.id;
      let next: SantaState = {
        ...state,
        assign,
        revealPointer: r + 1,
        phase: "reveal",
        events: [...state.events, { type: "repicked", seatIndex: r, giverSeat, id: action.id }],
      };
      if (next.revealPointer >= n) next = finish(next);
      return next;
    }
    case "RESET":
      return initialSantaState;
  }
}
