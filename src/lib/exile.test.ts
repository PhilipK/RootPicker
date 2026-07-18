import { describe, it, expect } from "vitest";
import { REACH_TARGET } from "../data/factions";
import {
  banBlockReason,
  banCounts,
  banOrderFor,
  exileReducer,
  firstSeatFor,
  initialExileState,
  legalLineups,
  totalBansFor,
  type ExileState,
} from "./exile";

describe("totalBansFor", () => {
  it("is pool size minus seats minus the 2-slack floor, clamped at 0", () => {
    expect(totalBansFor(13, 4)).toBe(7);
    expect(totalBansFor(6, 4)).toBe(0);
    expect(totalBansFor(5, 4)).toBe(0); // would go negative — clamped
  });
});

describe("banOrderFor", () => {
  it("snakes back and forth across seats, sliced to the total", () => {
    expect(banOrderFor(4, 7)).toEqual([0, 1, 2, 3, 3, 2, 1]);
    expect(banOrderFor(4, 0)).toEqual([]);
    expect(banOrderFor(2, 9)).toEqual([0, 1, 1, 0, 0, 1, 1, 0, 0]);
  });
});

describe("banCounts / firstSeatFor", () => {
  it("counts turns per seat and hands first-player priority to whoever banned fewest", () => {
    const order = banOrderFor(4, 7); // [0,1,2,3,3,2,1] — seat 0 bans once, others twice
    expect(banCounts(4, order)).toEqual([1, 2, 2, 2]);
    expect(firstSeatFor(4, order, [2, 1, 0, 3])).toBe(0);
  });

  it("breaks a genuine tie using the supplied tie-break order", () => {
    const order = [0, 1]; // both seats ban exactly once
    expect(banCounts(2, order)).toEqual([1, 1]);
    expect(firstSeatFor(2, order, [1, 0])).toBe(1);
    expect(firstSeatFor(2, order, [0, 1])).toBe(0);
  });
});

// A hand-picked 6-faction survivor pool (playerCount + 2, as the real game
// always leaves after the last ban) with exactly one militant (marquise), so
// every legal 4-seat lineup is forced to include it.
const SURVIVORS = ["marquise", "riverfolk", "vagabond", "knaves", "twilight", "woodland"];
const TARGET_4 = REACH_TARGET[4]; // 21

describe("banBlockReason", () => {
  it("blocks exiling the pool's only militant", () => {
    expect(banBlockReason(SURVIVORS, "marquise", 4, TARGET_4)).toMatch(/no legal lineup/);
  });

  it("allows exiling a faction that still leaves a legal lineup behind", () => {
    expect(banBlockReason(SURVIVORS, "woodland", 4, TARGET_4)).toBeNull();
  });
});

describe("legalLineups", () => {
  it("enumerates exactly the reach-safe, militant-having, non-conflicting 4-subsets", () => {
    const legal = legalLineups(SURVIVORS, 4, TARGET_4);
    expect(legal).toHaveLength(7);
    for (const lineup of legal) {
      expect(lineup).toContain("marquise"); // the only militant — mandatory in every legal lineup
      expect(lineup.includes("vagabond") && lineup.includes("knaves")).toBe(false);
      const reach = lineup.reduce((s, id) => s + { marquise: 10, riverfolk: 5, vagabond: 5, knaves: 4, twilight: 4, woodland: 3 }[id]!, 0);
      expect(reach).toBeGreaterThanOrEqual(TARGET_4);
    }
  });
});

describe("exileReducer", () => {
  const seats = ["Alice", "Bob", "Cara", "Dee"];

  function start(pool: string[]): ExileState {
    return exileReducer(initialExileState, { type: "START", seats, pool });
  }

  it("goes straight to revealReady when the pool is already at the 2-slack floor", () => {
    const state = start(SURVIVORS);
    expect(state.phase).toBe("revealReady");
    expect(state.banOrder).toEqual([]);
  });

  it("runs a full ban round through to a legal, randomly-seated deal", () => {
    // 7 owned factions beyond the 6 survivors above, so totalBans = 13-4-2 = 7.
    const pool = [...SURVIVORS, "hundreds", "eyrie", "duchy", "keepers", "lilypad", "corvid", "lizard"];
    let state = start(pool);
    expect(state.phase).toBe("ban");
    expect(state.banOrder).toHaveLength(7);

    const toBan = ["hundreds", "eyrie", "duchy", "keepers", "lilypad", "corvid", "lizard"];
    for (const id of toBan) {
      state = exileReducer(state, { type: "BAN", id, target: TARGET_4 });
    }
    expect(state.phase).toBe("revealReady");
    expect(state.pool.slice().sort()).toEqual(SURVIVORS.slice().sort());
    expect(state.bans.map((b) => b.id)).toEqual(toBan);

    const legal = legalLineups(state.pool, 4, TARGET_4);
    state = exileReducer(state, {
      type: "DEAL",
      target: TARGET_4,
      index: 0,
      seatOrder: [3, 1, 0, 2],
    });
    expect(state.phase).toBe("done");
    expect(state.assign).toHaveLength(4);
    // every seat got a distinct faction from the chosen legal lineup
    expect(state.assign.slice().sort()).toEqual(legal[0].slice().sort());
    // seat 0 banned fewest (once, vs. everyone else's twice via the snake order) — first player
    expect(state.firstSeat).toBe(0);
  });

  it("rejects a ban that would strand the table (the guard), leaving state untouched", () => {
    // "corvid" is insurgent, so marquise stays the pool's only militant —
    // totalBans = 7-4-2 = 1.
    const state = exileReducer(initialExileState, {
      type: "START",
      seats,
      pool: [...SURVIVORS, "corvid"],
    });
    expect(state.phase).toBe("ban");
    expect(state.banOrder).toHaveLength(1);
    // marquise is the only militant in this pool too — banning it must be blocked
    const blocked = exileReducer(state, { type: "BAN", id: "marquise", target: TARGET_4 });
    expect(blocked).toBe(state); // reducer returns the same reference when it no-ops
    expect(blocked.bans).toHaveLength(0);

    const allowed = exileReducer(state, { type: "BAN", id: "corvid", target: TARGET_4 });
    expect(allowed.bans).toHaveLength(1);
    expect(allowed.phase).toBe("revealReady");
  });

  it("supports undo back through bans and past a completed deal", () => {
    const pool = [...SURVIVORS, "hundreds"];
    let state = exileReducer(initialExileState, { type: "START", seats, pool });
    state = exileReducer(state, { type: "BAN", id: "hundreds", target: TARGET_4 });
    expect(state.phase).toBe("revealReady");

    state = exileReducer(state, { type: "DEAL", target: TARGET_4, index: 0, seatOrder: [0, 1, 2, 3] });
    expect(state.phase).toBe("done");

    state = exileReducer(state, { type: "UNDO" });
    expect(state.phase).toBe("revealReady");

    state = exileReducer(state, { type: "UNDO" });
    expect(state.phase).toBe("ban");
    expect(state.bans).toHaveLength(0);
  });
});
