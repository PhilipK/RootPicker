import { describe, it, expect } from "vitest";
import { FACTIONS, REACH_TARGET } from "../data/factions";
import {
  potluckReducer,
  initialPotluckState,
  pickOrderFor,
  hasCompleteMatching,
  pickBlockReason,
  type PotluckState,
} from "./potluck";

function contribute(state: PotluckState, id: string, target: number) {
  return potluckReducer(state, { type: "CONTRIBUTE", id, available: FACTIONS, target });
}

describe("pickOrderFor", () => {
  it("is the exact reverse of seat order", () => {
    expect(pickOrderFor(4)).toEqual([3, 2, 1, 0]);
    expect(pickOrderFor(2)).toEqual([1, 0]);
    expect(pickOrderFor(1)).toEqual([0]);
  });
});

describe("hasCompleteMatching", () => {
  it("finds a swap-style assignment when the two owners simply trade", () => {
    expect(hasCompleteMatching(["A", "B"], ["A", "B"])).toBe(true);
  });

  it("fails when the sole remaining item is the sole remaining picker's own faction", () => {
    expect(hasCompleteMatching(["A"], ["A"])).toBe(false);
  });

  it("succeeds when a remaining picker's own faction was already claimed by someone else", () => {
    // this picker owns "A", but "A" isn't in the remaining pool any more — no constraint left
    expect(hasCompleteMatching(["A"], ["B"])).toBe(true);
  });

  it("handles a 3-way cycle (no pairwise swap needed)", () => {
    expect(hasCompleteMatching(["A", "B", "C"], ["A", "B", "C"])).toBe(true);
  });
});

describe("potluck reducer: contribute phase gating via reachBlockReason", () => {
  const target = REACH_TARGET[4];

  it("blocks a contribution that would make the final pool unable to reach target", () => {
    let state = potluckReducer(initialPotluckState, { type: "START", seats: ["A", "B", "C", "D"] });
    state = contribute(state, "lizard", target); // reach 2
    state = contribute(state, "corvid", target); // reach 3 — pool so far: 5
    // Contributing "woodland" (reach 3) as the 3rd of 4 leaves one slot for the
    // best remaining faction (marquise, reach 10): 5 + 3 + 10 = 18 < 21 — blocked.
    const before = state.contributions.length;
    state = contribute(state, "woodland", target);
    expect(state.contributions.length).toBe(before);
    expect(state.phase).toBe("contribute");

    // marquise instead: 5 + 10 = 15, one slot left, best remaining (hundreds, 9) gets to 24 — legal.
    state = contribute(state, "marquise", target);
    expect(state.contributions).toEqual(["lizard", "corvid", "marquise"]);
  });

  it("moves to the pick phase once every seat has contributed, with the reverse pick order", () => {
    const seats = ["Alice", "Bob", "Cara", "Dee"];
    let state = potluckReducer(initialPotluckState, { type: "START", seats });
    for (const id of ["marquise", "hundreds", "eyrie", "duchy"]) {
      state = contribute(state, id, target);
    }
    expect(state.phase).toBe("pick");
    expect(state.pool.slice().sort()).toEqual(["duchy", "eyrie", "hundreds", "marquise"].sort());
    expect(state.pickOrder).toEqual([3, 2, 1, 0]);
  });
});

describe("potluck reducer: own-faction blocking, incl. the 2-player forced swap", () => {
  it("rejects a pick of your own contribution, and the last picker ends up with what the first picker didn't take", () => {
    const target = REACH_TARGET[2];
    let state = potluckReducer(initialPotluckState, { type: "START", seats: ["A", "B"] });
    state = contribute(state, "marquise", target); // seat 0 brings marquise
    state = contribute(state, "hundreds", target); // seat 1 brings hundreds
    expect(state.phase).toBe("pick");
    expect(state.pickOrder).toEqual([1, 0]); // seat 1 (last contributor) picks first

    // Seat 1 tries to take their own contribution — blocked.
    const blocked = potluckReducer(state, { type: "PICK", id: "hundreds" });
    expect(blocked.picks).toHaveLength(0);

    // Seat 1 takes the only other option instead.
    state = potluckReducer(state, { type: "PICK", id: "marquise" });
    expect(state.picks).toEqual([{ seatIndex: 1, id: "marquise" }]);

    // Seat 0 is left with seat 1's contribution — the forced swap.
    state = potluckReducer(state, { type: "PICK", id: "hundreds" });
    expect(state.phase).toBe("done");
    expect(state.picks).toEqual([
      { seatIndex: 1, id: "marquise" },
      { seatIndex: 0, id: "hundreds" },
    ]);
  });
});

describe("potluck reducer: deadlock guard", () => {
  it("blocks a pick that would leave a later picker stuck with only their own faction", () => {
    // Hand-built mid-pick state: 4 seats, contributions ["D","E","A","B"] for
    // seats [0,1,2,3]. Seats 3 and 2 have already picked (A and E respectively),
    // leaving pool ["D","B"] for seats 1 then 0 (owning "E" — already gone —
    // and "D"). If seat 1 takes "B", seat 0 is stuck with "D", their own.
    const midState: PotluckState = {
      phase: "pick",
      seats: ["S0", "S1", "S2", "S3"],
      contributions: ["D", "E", "A", "B"],
      pool: ["D", "B"],
      pickOrder: [3, 2, 1, 0],
      picks: [
        { seatIndex: 3, id: "A" },
        { seatIndex: 2, id: "E" },
      ],
      past: [],
    };

    expect(
      pickBlockReason(1, "B", midState.pool, midState.contributions, midState.pickOrder, midState.picks.length),
    ).toMatch(/strand/);
    expect(
      pickBlockReason(1, "D", midState.pool, midState.contributions, midState.pickOrder, midState.picks.length),
    ).toBeNull();

    const blocked = potluckReducer(midState, { type: "PICK", id: "B" });
    expect(blocked.picks).toHaveLength(2); // rejected, no change

    const afterGoodPick = potluckReducer(midState, { type: "PICK", id: "D" });
    expect(afterGoodPick.picks).toHaveLength(3);
    expect(afterGoodPick.pool).toEqual(["B"]);

    const done = potluckReducer(afterGoodPick, { type: "PICK", id: "B" });
    expect(done.phase).toBe("done");
    expect(done.picks).toHaveLength(4);
    done.picks.forEach((p) => expect(p.id).not.toBe(done.contributions[p.seatIndex]));
  });
});

describe("potluck reducer: full contribute + pick completion", () => {
  it("finishes with every seat holding a faction that isn't the one it brought", () => {
    const seats = ["Alice", "Bob", "Cara", "Dee"];
    const target = REACH_TARGET[4];
    let state = potluckReducer(initialPotluckState, { type: "START", seats });
    for (const id of ["marquise", "hundreds", "eyrie", "duchy"]) {
      state = contribute(state, id, target);
    }
    expect(state.phase).toBe("pick");

    while (state.phase === "pick") {
      const seatIndex = state.pickOrder[state.picks.length];
      const candidate = state.pool.find(
        (id) => !pickBlockReason(seatIndex, id, state.pool, state.contributions, state.pickOrder, state.picks.length),
      );
      expect(candidate).toBeDefined();
      state = potluckReducer(state, { type: "PICK", id: candidate! });
    }

    expect(state.phase).toBe("done");
    expect(state.picks).toHaveLength(4);
    expect(state.pool).toHaveLength(0);
    state.picks.forEach((p) => expect(p.id).not.toBe(state.contributions[p.seatIndex]));
    // Seat 0 both contributes first and picks last — the "picks last, goes first" seat.
    expect(state.pickOrder[state.pickOrder.length - 1]).toBe(0);
  });
});
