import { reachBlockReason } from "./reach";
import type { Faction } from "../types";

/** Personal pass tokens each seat starts with. */
export const startTokens = (playerCount: number) => playerCount;

export interface BountyClaim {
  seatIndex: number;
  id: string;
  bounty: number;
  tokensLeft: number;
}

export type BountyLogEntry =
  | { type: "pass"; seatIndex: number; tokensLeft: number }
  | { type: "claim"; seatIndex: number; id: string; bounty: number; tokensLeft: number };

/** Turn order for the draft: the last seat in normal turn order goes first
    (compensation for picking last everywhere else), then wraps forward. */
export function rotatedOrder(seatCount: number): number[] {
  return Array.from({ length: seatCount }, (_, i) => (seatCount - 1 + i) % seatCount);
}

/** First seat in rotated order that hasn't claimed yet — gets first refusal on a fresh reveal. */
export function startingSeat(order: number[], claimedSeats: Set<number>): number {
  return order.find((s) => !claimedSeats.has(s))!;
}

/** Next seat in rotated order after `seat`, skipping seats that have already claimed. */
export function nextSeat(order: number[], seat: number, claimedSeats: Set<number>): number {
  const i = order.indexOf(seat);
  for (let k = 1; k <= order.length; k++) {
    const cand = order[(i + k) % order.length];
    if (!claimedSeats.has(cand)) return cand;
  }
  return seat;
}

/** First still-legal faction in deck order — one whose claim can't strand the table
    below target, using the same best-case check every other mode gates picks with. */
export function nextLegalFaction(
  deck: string[],
  claimedIds: Set<string>,
  capacity: number,
  pool: Faction[],
  target: number,
): { id: string; rest: string[] } | null {
  for (let i = 0; i < deck.length; i++) {
    const id = deck[i];
    if (!reachBlockReason(claimedIds, id, capacity, pool, target)) {
      return { id, rest: [...deck.slice(0, i), ...deck.slice(i + 1)] };
    }
  }
  return null;
}

/** A claim's final VP: the bounty that piled up on the card, plus unspent tokens
    (banked as VP 1:1) — "whatever bounty you already have". */
export const claimVP = (c: BountyClaim) => c.bounty + c.tokensLeft;

/** Normalize so the lowest starting VP in the table is 0 — only relative VP matters. */
export function normalizeVP(claims: BountyClaim[]): number[] {
  const raw = claims.map(claimVP);
  const min = Math.min(...raw);
  return raw.map((v) => v - min);
}
