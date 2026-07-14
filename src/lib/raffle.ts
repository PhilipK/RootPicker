import { reachBlockReason } from "./reach";
import type { Faction } from "../types";

/** Tickets each player gets to spread across factions. */
export const RAFFLE_TICKETS = 10;

export interface RaffleTicket {
  seatIndex: number;
  id: string;
}

export type RaffleEvent =
  | { type: "won"; seatIndex: number; id: string; purged?: number }
  | { type: "burn"; seatIndex: number; id: string; reason: "faction-taken" | "seat-settled" | "reach" }
  | { type: "fill"; seatIndex: number; id: string };

/** Flatten per-seat ticket lists (one faction id per ticket, in tap order)
    into individual urn entries. */
export function ticketsToUrn(tickets: string[][]): RaffleTicket[] {
  return tickets.flatMap((list, seatIndex) => list.map((id) => ({ seatIndex, id })));
}

/** Resolve one drawn ticket against the current assignments. The reach gate is
    the same completability check Simple mode runs per pick, so the partial
    table stays legal-completable after every event. */
export function resolveTicket(
  ticket: RaffleTicket,
  assign: (string | null)[],
  pool: Faction[],
  target: number,
): RaffleEvent {
  if (assign[ticket.seatIndex] !== null) return { type: "burn", seatIndex: ticket.seatIndex, id: ticket.id, reason: "seat-settled" };
  if (assign.includes(ticket.id)) return { type: "burn", seatIndex: ticket.seatIndex, id: ticket.id, reason: "faction-taken" };
  const taken = new Set(assign.filter((x): x is string => x !== null));
  if (reachBlockReason(taken, ticket.id, assign.length, pool, target)) {
    return { type: "burn", seatIndex: ticket.seatIndex, id: ticket.id, reason: "reach" };
  }
  return { type: "won", seatIndex: ticket.seatIndex, id: ticket.id };
}

/** Random legal fill for seats whose tickets never landed. `fillSeats` and
    `fillFactions` carry the caller's randomness (pre-shuffled), keeping this
    deterministic: each unsettled seat, in `fillSeats` order, takes the first
    faction from `fillFactions` that keeps the table completable. */
export function fillRemaining(
  assign: (string | null)[],
  fillSeats: number[],
  fillFactions: string[],
  pool: Faction[],
  target: number,
): RaffleEvent[] {
  const events: RaffleEvent[] = [];
  const current = assign.slice();
  for (const seatIndex of fillSeats) {
    if (current[seatIndex] !== null) continue;
    const taken = new Set(current.filter((x): x is string => x !== null));
    const id = fillFactions.find(
      (f) => !taken.has(f) && !reachBlockReason(taken, f, current.length, pool, target),
    )!;
    current[seatIndex] = id;
    events.push({ type: "fill", seatIndex, id });
  }
  return events;
}
