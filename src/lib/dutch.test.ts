import { describe, it, expect } from "vitest";
import { FACTIONS, REACH_TARGET, byId } from "../data/factions";
import { reachBlockReason } from "./reach";
import {
  claimVP,
  dutchReducer,
  initialDutchState,
  normalizeVP,
  remainingSeats,
  type DutchAction,
  type DutchState,
} from "./dutch";

const POOL = FACTIONS.filter((f) => f.id !== "vagabond2");
const T4 = REACH_TARGET[4]; // 21

// A fixed, non-random "deck" ordering used throughout — determinism is the
// point of these tests, so nothing here calls shuffleArr.
const DECK4 = ["lizard", "corvid", "woodland", "vagabond", "marquise", "eyrie", "duchy", "riverfolk", "knaves"];

function run(actions: DutchAction[]): DutchState {
  return actions.reduce(dutchReducer, initialDutchState);
}

const startAction: DutchAction = {
  type: "START",
  seats: ["A", "B", "C", "D"],
  deck: DECK4,
  pool: POOL,
  target: T4,
  range: 4,
};

describe("reveal-deck legality invariant", () => {
  it("only ever reveals a faction that keeps the table completable to target", () => {
    let state = dutchReducer(initialDutchState, startAction);
    const seenIds: string[] = [];
    while (state.phase === "auction") {
      expect(state.currentId).not.toBeNull();
      seenIds.push(state.currentId!);
      const claimedBefore = new Set(state.claims.map((c) => c.id));
      // the reveal must not itself violate the legality gate given what's
      // already been claimed
      const reason = reachBlockReason(claimedBefore, state.currentId!, state.seats.length, POOL, T4);
      expect(reason).toBeNull();
      state = dutchReducer(state, { type: "BEGIN_CLOCK" });
      const seat = remainingSeats(state.seats.length, state.claims)[0];
      state = dutchReducer(state, { type: "CLAIM", seatIndex: seat, price: state.price, pool: POOL, target: T4 });
    }
    expect(state.phase).toBe("done");
    expect(state.claims).toHaveLength(4);
    expect(new Set(seenIds).size).toBe(seenIds.length); // never repeats a reveal
    const total = state.claims.reduce((s, c) => s + byId[c.id].reach, 0);
    expect(total).toBeGreaterThanOrEqual(T4);
  });

  it("never claims the Vagabond alongside the Knaves (A.8.1)", () => {
    let state = dutchReducer(initialDutchState, startAction);
    while (state.phase === "auction") {
      state = dutchReducer(state, { type: "BEGIN_CLOCK" });
      const seat = remainingSeats(state.seats.length, state.claims)[0];
      state = dutchReducer(state, { type: "CLAIM", seatIndex: seat, price: state.price, pool: POOL, target: T4 });
    }
    const ids = new Set(state.claims.map((c) => c.id));
    expect(ids.has("vagabond") && ids.has("knaves")).toBe(false);
  });
});

describe("claim/price bookkeeping", () => {
  it("records the price supplied at tap time, not the reducer's own idea of price", () => {
    let state = dutchReducer(initialDutchState, startAction);
    expect(state.price).toBe(-4);
    expect(state.previewing).toBe(true);
    state = dutchReducer(state, { type: "BEGIN_CLOCK" });
    expect(state.previewing).toBe(false);
    state = dutchReducer(state, { type: "TICK" }); // -3
    state = dutchReducer(state, { type: "TICK" }); // -2
    // claim carries a price different from state.price, on purpose — the
    // action is the source of truth, mirroring a click event captured a tick
    // before the dispatch actually lands.
    const claimedId = state.currentId!;
    state = dutchReducer(state, { type: "CLAIM", seatIndex: 2, price: -1, pool: POOL, target: T4 });
    expect(state.claims).toEqual([{ seatIndex: 2, id: claimedId, price: -1 }]);
  });

  it("resets price to −range and re-arms the preview for the next reveal", () => {
    let state = dutchReducer(initialDutchState, startAction);
    state = dutchReducer(state, { type: "BEGIN_CLOCK" });
    state = dutchReducer(state, { type: "CLAIM", seatIndex: 0, price: -4, pool: POOL, target: T4 });
    expect(state.phase).toBe("auction");
    expect(state.previewing).toBe(true);
    expect(state.price).toBe(-4);
    expect(state.claims).toHaveLength(1);
  });

  it("ignores a CLAIM while still in the preview freeze", () => {
    const state = dutchReducer(initialDutchState, startAction);
    const claimed = dutchReducer(state, { type: "CLAIM", seatIndex: 0, price: -4, pool: POOL, target: T4 });
    expect(claimed).toBe(state); // untouched
  });
});

describe("TICK behavior at the cap", () => {
  it("holds at +range instead of climbing past it, and never auto-assigns", () => {
    let state = dutchReducer(initialDutchState, startAction);
    state = dutchReducer(state, { type: "BEGIN_CLOCK" });
    for (let i = 0; i < 12; i++) state = dutchReducer(state, { type: "TICK" });
    expect(state.price).toBe(4);
    expect(state.phase).toBe("auction"); // still waiting on a tap
    expect(state.claims).toHaveLength(0);
  });
});

describe("last-player auto-claim", () => {
  it("hands the final seat the last reveal at +range with no tap and no preview", () => {
    let state = dutchReducer(initialDutchState, startAction);
    // Two interactive claims leave two seats open; the third interactive
    // claim below drops the remaining count to 1, which the reducer
    // resolves immediately in the same action — no separate tap needed.
    for (let i = 0; i < 2; i++) {
      state = dutchReducer(state, { type: "BEGIN_CLOCK" });
      const seat = remainingSeats(state.seats.length, state.claims)[0];
      state = dutchReducer(state, { type: "CLAIM", seatIndex: seat, price: state.price, pool: POOL, target: T4 });
    }
    expect(state.claims).toHaveLength(2);
    expect(state.phase).toBe("auction");
    state = dutchReducer(state, { type: "BEGIN_CLOCK" });
    const seat = remainingSeats(state.seats.length, state.claims)[0];
    state = dutchReducer(state, { type: "CLAIM", seatIndex: seat, price: state.price, pool: POOL, target: T4 });
    // that single CLAIM resolved both the tapped seat and the last one
    expect(state.phase).toBe("done");
    expect(state.claims).toHaveLength(4);
    const finalClaim = state.claims[3];
    expect(finalClaim.price).toBe(4);
    expect(state.log[state.log.length - 1]).toMatchObject({ auto: true, price: 4 });
    // every seat is accounted for exactly once
    expect(new Set(state.claims.map((c) => c.seatIndex)).size).toBe(4);
  });
});

describe("0-floor normalization", () => {
  it("shifts every price up so the lowest sits at 0", () => {
    const claims = [
      { seatIndex: 0, id: "marquise", price: -3 },
      { seatIndex: 1, id: "eyrie", price: 1 },
      { seatIndex: 2, id: "lizard", price: 4 },
      { seatIndex: 3, id: "woodland", price: -3 },
    ];
    expect(normalizeVP(claims)).toEqual([0, 4, 7, 0]);
    expect(claims.map(claimVP)).toEqual([-3, 1, 4, -3]);
  });

  it("leaves an all-positive table's shape intact, just shifted", () => {
    const claims = [
      { seatIndex: 0, id: "marquise", price: 2 },
      { seatIndex: 1, id: "eyrie", price: 4 },
    ];
    expect(normalizeVP(claims)).toEqual([0, 2]);
  });
});

describe("deterministic TICK/CLAIM replay", () => {
  const script: DutchAction[] = [
    startAction,
    { type: "BEGIN_CLOCK" },
    { type: "TICK" },
    { type: "TICK" },
    { type: "CLAIM", seatIndex: 1, price: -2, pool: POOL, target: T4 },
    { type: "BEGIN_CLOCK" },
    { type: "TICK" },
    { type: "CLAIM", seatIndex: 0, price: -3, pool: POOL, target: T4 },
    { type: "BEGIN_CLOCK" },
    { type: "CLAIM", seatIndex: 3, price: -4, pool: POOL, target: T4 },
  ];

  it("replays the exact same sequence to the exact same final state", () => {
    const a = run(script);
    const b = run(script);
    expect(a).toEqual(b);
    expect(a.phase).toBe("done"); // last seat (2) auto-resolved after the 3rd claim
    expect(a.claims).toHaveLength(4);
  });

  it("is unaffected by extra no-op TICKs interleaved at any point", () => {
    const withExtraTicks = [
      startAction,
      { type: "TICK" }, // no-op: still previewing
      { type: "BEGIN_CLOCK" },
      { type: "TICK" },
      { type: "TICK" },
      { type: "TICK" }, // harmless extra tick before the claim below
      { type: "CLAIM", seatIndex: 1, price: -2, pool: POOL, target: T4 },
      { type: "BEGIN_CLOCK" },
      { type: "TICK" },
      { type: "CLAIM", seatIndex: 0, price: -3, pool: POOL, target: T4 },
      { type: "BEGIN_CLOCK" },
      { type: "CLAIM", seatIndex: 3, price: -4, pool: POOL, target: T4 },
    ] as DutchAction[];
    const a = run(script);
    const b = run(withExtraTicks);
    // same claims land the same way — the stray TICK before claiming seat 1
    // didn't change anything because CLAIM's price is supplied, not derived
    expect(a.claims).toEqual(b.claims);
    expect(a.phase).toBe(b.phase);
  });
});

describe("UNDO / RESET", () => {
  it("undo restores the exact pre-claim snapshot, including the price that was showing", () => {
    let state = dutchReducer(initialDutchState, startAction);
    state = dutchReducer(state, { type: "BEGIN_CLOCK" });
    state = dutchReducer(state, { type: "TICK" });
    const beforeClaim = state;
    state = dutchReducer(state, { type: "CLAIM", seatIndex: 0, price: -3, pool: POOL, target: T4 });
    expect(state.claims).toHaveLength(1);
    const undone = dutchReducer(state, { type: "UNDO" });
    expect(undone.claims).toHaveLength(0);
    expect(undone.currentId).toBe(beforeClaim.currentId);
    expect(undone.price).toBe(beforeClaim.price);
    expect(undone.previewing).toBe(beforeClaim.previewing);
  });

  it("reset returns to the initial setup state", () => {
    let state = dutchReducer(initialDutchState, startAction);
    state = dutchReducer(state, { type: "RESET" });
    expect(state).toEqual(initialDutchState);
  });
});
