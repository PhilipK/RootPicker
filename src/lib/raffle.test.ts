import { describe, it, expect } from "vitest";
import { FACTIONS, REACH_TARGET, byId } from "../data/factions";
import { fillRemaining, resolveTicket, ticketsToUrn } from "./raffle";

const POOL = FACTIONS.filter((f) => f.id !== "vagabond2");
const T4 = REACH_TARGET[4]; // 21

describe("ticketsToUrn", () => {
  it("flattens per-seat ticket lists into one entry per ticket", () => {
    const urn = ticketsToUrn([
      ["marquise", "lizard", "marquise"],
      ["eyrie", "eyrie", "eyrie"],
    ]);
    expect(urn).toHaveLength(6);
    expect(urn.filter((t) => t.seatIndex === 0 && t.id === "marquise")).toHaveLength(2);
    expect(urn.filter((t) => t.seatIndex === 1 && t.id === "eyrie")).toHaveLength(3);
  });
});

describe("resolveTicket", () => {
  it("assigns an uncontested, reach-safe ticket", () => {
    const ev = resolveTicket({ seatIndex: 0, id: "marquise" }, [null, null, null, null], POOL, T4);
    expect(ev).toEqual({ type: "won", seatIndex: 0, id: "marquise" });
  });

  it("burns a ticket for an already-claimed faction", () => {
    const ev = resolveTicket({ seatIndex: 1, id: "marquise" }, ["marquise", null, null, null], POOL, T4);
    expect(ev).toEqual({ type: "burn", seatIndex: 1, id: "marquise", reason: "faction-taken" });
  });

  it("burns a ticket for a seat that already settled", () => {
    const ev = resolveTicket({ seatIndex: 0, id: "eyrie" }, ["marquise", null, null, null], POOL, T4);
    expect(ev).toEqual({ type: "burn", seatIndex: 0, id: "eyrie", reason: "seat-settled" });
  });

  it("burns a ticket whose assignment would strand the table below reach", () => {
    // lizard 2 + corvid 3 already claimed: 5. Adding woodland (3) leaves one
    // slot; best remaining is marquise (10): 5 + 3 + 10 = 18 < 21.
    const ev = resolveTicket({ seatIndex: 2, id: "woodland" }, ["lizard", "corvid", null, null], POOL, T4);
    expect(ev).toEqual({ type: "burn", seatIndex: 2, id: "woodland", reason: "reach" });
  });

  it("burns a Knaves ticket when the Vagabond is already at the table (A.8.1)", () => {
    const ev = resolveTicket({ seatIndex: 1, id: "knaves" }, ["vagabond", null, null, null], POOL, T4);
    expect(ev).toEqual({ type: "burn", seatIndex: 1, id: "knaves", reason: "reach" });
  });
});

describe("fillRemaining", () => {
  it("fills every unsettled seat with a distinct, reach-safe faction", () => {
    const assign: (string | null)[] = ["lizard", null, null, null];
    const events = fillRemaining(assign, [3, 1, 2], POOL.map((f) => f.id), POOL, T4);
    expect(events).toHaveLength(3);
    expect(events[0].seatIndex).toBe(3); // fillSeats order respected
    const final = assign.slice();
    for (const e of events) final[e.seatIndex] = e.id;
    expect(final.every((x) => x !== null)).toBe(true);
    expect(new Set(final).size).toBe(4);
    const total = final.reduce((s, id) => s + byId[id!].reach, 0);
    expect(total).toBeGreaterThanOrEqual(T4);
  });

  it("skips low-reach fill candidates that would strand the table", () => {
    // Offer lizard (2) first: with lizard + corvid claimed (5) and two seats
    // to fill, taking woodland (3) would cap out at 18 — the fill must skip
    // past it to something reach-safe.
    const assign: (string | null)[] = ["lizard", "corvid", null, null];
    const events = fillRemaining(assign, [2, 3], ["woodland", "twilight", "marquise", "hundreds"], POOL, T4);
    const final = assign.slice();
    for (const e of events) final[e.seatIndex] = e.id;
    const total = final.reduce((s, id) => s + byId[id!].reach, 0);
    expect(total).toBeGreaterThanOrEqual(T4);
    expect(final.slice(2)).toEqual(["marquise", "hundreds"]);
  });

  it("leaves already-settled seats untouched", () => {
    const assign: (string | null)[] = ["marquise", "hundreds", "eyrie", null];
    const events = fillRemaining(assign, [0, 1, 2, 3], POOL.map((f) => f.id), POOL, T4);
    expect(events).toHaveLength(1);
    expect(events[0].seatIndex).toBe(3);
  });
});
