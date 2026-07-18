import { describe, it, expect } from "vitest";
import { FACTIONS, REACH_TARGET, byId } from "../data/factions";
import {
  giftAcceptReason,
  legalSurvivors,
  leftNeighbor,
  giverOf,
  santaReducer,
  initialSantaState,
  type SantaState,
} from "./santa";

const POOL = FACTIONS.filter((f) => f.id !== "vagabond2");

describe("leftNeighbor / giverOf", () => {
  it("form a full n-cycle that inverts cleanly", () => {
    for (const n of [2, 3, 4, 5, 6]) {
      for (let seat = 0; seat < n; seat++) {
        const receiver = leftNeighbor(seat, n);
        expect(giverOf(receiver, n)).toBe(seat);
      }
      // every seat appears exactly once as a receiver
      const receivers = Array.from({ length: n }, (_, s) => leftNeighbor(s, n));
      expect(new Set(receivers).size).toBe(n);
    }
  });
});

describe("giftAcceptReason", () => {
  const target = REACH_TARGET[4]; // 21

  it("blocks a duplicate — a faction already accepted onto the table", () => {
    const reason = giftAcceptReason(new Set(["marquise"]), "marquise", 4, POOL, target);
    expect(reason).toMatch(/already gifted/i);
  });

  it("blocks the Vagabond/Knaves conflict (A.8.1)", () => {
    const reason = giftAcceptReason(new Set(["vagabond"]), "knaves", 4, POOL, target);
    expect(reason).toMatch(/cannot both be in the same game/i);
  });

  it("blocks a gift that would strand the table below reach", () => {
    // lizard (2) + corvid (3) accepted = 5. Adding woodland (3) leaves one
    // slot; best remaining is marquise (10): 5 + 3 + 10 = 18 < 21.
    const reason = giftAcceptReason(new Set(["lizard", "corvid"]), "woodland", 4, POOL, target);
    expect(reason).toMatch(/best possible total/i);
  });

  it("accepts a gift that keeps the table completable", () => {
    const reason = giftAcceptReason(new Set(["lizard", "corvid"]), "marquise", 4, POOL, target);
    expect(reason).toBeNull();
  });
});

describe("legalSurvivors", () => {
  it("is never empty for a legal partial accepted set with slots remaining", () => {
    const target = REACH_TARGET[4];
    const accepted = new Set(["lizard", "corvid"]);
    const survivors = legalSurvivors(accepted, POOL, 4, target);
    expect(survivors.length).toBeGreaterThan(0);
    expect(survivors).toContain("marquise");
    // never offers something already accepted
    expect(survivors).not.toContain("lizard");
  });
});

function start(seats: string[]): SantaState {
  return santaReducer(initialSantaState, { type: "START", seats });
}

function gift(state: SantaState, id: string): SantaState {
  let next = state;
  if (next.phase === "pass") next = santaReducer(next, { type: "SHOW" });
  return santaReducer(next, { type: "GIFT", id });
}

function reveal(state: SantaState, target: number, count = 1): SantaState {
  return santaReducer(state, { type: "REVEAL", count, available: POOL, target });
}

function repick(state: SantaState, id: string, target: number): SantaState {
  return santaReducer(state, { type: "REPICK", id, available: POOL, target });
}

/** Drives a state all the way to "done", auto-repicking with the first legal
    survivor whenever a gift bounces. Used to stress-test the induction
    invariant regardless of how chaotic the original gifts were. */
function runToDone(state: SantaState, target: number): SantaState {
  let next = state;
  let guard = 0;
  while (next.phase !== "done") {
    if (guard++ > 100) throw new Error("runToDone did not terminate");
    if (next.phase === "repick") {
      const accepted = new Set(next.assign.filter((x): x is string => x !== null));
      const survivors = legalSurvivors(accepted, POOL, next.seats.length, target);
      expect(survivors.length).toBeGreaterThan(0); // the invariant under test
      next = repick(next, survivors[0], target);
    } else {
      next = reveal(next, target, 1);
    }
  }
  return next;
}

describe("santaReducer: clean 4-player run (no conflicts)", () => {
  it("accepts every gift as-is and starts with seat 0", () => {
    const seats = ["Alice", "Bob", "Cara", "Dee"];
    const target = REACH_TARGET[4];
    let state = start(seats);
    // giver i gifts to leftNeighbor(i,4) = i+1 mod 4
    state = gift(state, "marquise"); // giver0 -> receiver1
    state = gift(state, "hundreds"); // giver1 -> receiver2
    state = gift(state, "eyrie"); // giver2 -> receiver3
    state = gift(state, "duchy"); // giver3 -> receiver0
    expect(state.phase).toBe("reveal");

    state = reveal(state, target, 4);
    expect(state.phase).toBe("done");
    expect(state.assign).toEqual(["duchy", "marquise", "hundreds", "eyrie"]);
    expect(state.events.every((e) => e.type === "accepted")).toBe(true);
    expect(state.firstSeat).toBe(0);
  });
});

describe("santaReducer: duplicate gift forces an open re-pick by the giver", () => {
  it("bounces the duplicate, lets the giver re-pick, and compensates the bumped receiver", () => {
    const seats = ["Alice", "Bob", "Cara", "Dee"];
    const target = REACH_TARGET[4];
    // GIFT calls advance giver seat 0,1,2,3 in order; receiver = giver+1 mod 4,
    // so call k (0-based, giver=k) lands in gifts[(k+1)%4].
    let state = start(seats);
    state = gift(state, "duchy"); // giver0 -> gifts[1] = "duchy"
    state = gift(state, "marquise"); // giver1 -> gifts[2] = "marquise"
    state = gift(state, "marquise"); // giver2 -> gifts[3] = "marquise" — duplicate!
    state = gift(state, "eyrie"); // giver3 -> gifts[0] = "eyrie"

    state = reveal(state, target, 1); // receiver0: eyrie — accepted
    expect(state.assign[0]).toBe("eyrie");
    state = reveal(state, target, 1); // receiver1: duchy — accepted
    expect(state.assign[1]).toBe("duchy");
    state = reveal(state, target, 1); // receiver2: marquise — accepted
    expect(state.assign[2]).toBe("marquise");
    state = reveal(state, target, 1); // receiver3: marquise again — bounces
    expect(state.phase).toBe("repick");
    const failedEvent = state.events[state.events.length - 1];
    expect(failedEvent).toMatchObject({ type: "failed", seatIndex: 3, giverSeat: 2 });
    expect(failedEvent.reason).toMatch(/already gifted/i);

    // giver (seat 2) open-repicks something legal instead
    const accepted = new Set(state.assign.filter((x): x is string => x !== null));
    const survivors = legalSurvivors(accepted, POOL, 4, target);
    expect(survivors).not.toContain("marquise");
    expect(survivors).not.toContain("eyrie");
    expect(survivors).not.toContain("duchy");
    state = repick(state, survivors[0], target);
    expect(state.assign[3]).toBe(survivors[0]);
    expect(state.phase).toBe("done");

    // compensation: the bumped receiver (seat 3) opens the real game
    expect(state.firstSeat).toBe(3);
    // final table is legal: no duplicates, reach target met
    expect(new Set(state.assign as string[]).size).toBe(4);
    const total = (state.assign as string[]).reduce((s, id) => s + byId[id].reach, 0);
    expect(total).toBeGreaterThanOrEqual(target);
  });
});

describe("santaReducer: Vagabond/Knaves conflict forces an open re-pick", () => {
  it("bounces a Knaves gift when the Vagabond is already accepted (A.8.1)", () => {
    const seats = ["A", "B", "C"];
    const target = REACH_TARGET[3]; // 18
    // call k (giver=k) lands in gifts[(k+1)%3]: gift[1] from call0, gift[2]
    // from call1, gift[0] from call2 — set them so reveal order (0,1,2) sees
    // marquise, then vagabond, then the conflicting knaves.
    let state = start(seats);
    state = gift(state, "vagabond"); // giver0 -> gifts[1] = "vagabond"
    state = gift(state, "knaves"); // giver1 -> gifts[2] = "knaves"
    state = gift(state, "marquise"); // giver2 -> gifts[0] = "marquise"

    state = reveal(state, target, 1); // receiver0: marquise (reach 10) — accepted
    state = reveal(state, target, 1); // receiver1: vagabond (reach 5) — accepted
    state = reveal(state, target, 1); // receiver2: knaves — bounces, conflicts with vagabond
    expect(state.phase).toBe("repick");
    const failedEvent = state.events[state.events.length - 1];
    expect(failedEvent.reason).toMatch(/cannot both be in the same game/i);

    const accepted = new Set(state.assign.filter((x): x is string => x !== null));
    const survivors = legalSurvivors(accepted, POOL, 3, target);
    expect(survivors).not.toContain("knaves");
    state = repick(state, survivors[0], target);
    expect(state.phase).toBe("done");
    expect(state.assign).not.toContain("knaves");
    expect(state.assign.includes("vagabond")).toBe(true);
  });
});

describe("santaReducer: induction keeps the table legal under chaos", () => {
  it("stays legal-completable at every step even when every gift is the same faction", () => {
    for (const n of [3, 4, 5, 6]) {
      const seats = Array.from({ length: n }, (_, i) => `S${i}`);
      const target = REACH_TARGET[n];
      let state = start(seats);
      for (let i = 0; i < n; i++) state = gift(state, "marquise"); // maximal chaos: all identical
      state = runToDone(state, target);

      expect(state.phase).toBe("done");
      expect(state.assign.every((x) => x !== null)).toBe(true);
      expect(new Set(state.assign as string[]).size).toBe(n); // no duplicates survived
      const final = state.assign as string[];
      expect(!(final.includes("vagabond") && final.includes("knaves"))).toBe(true);
      const total = final.reduce((s, id) => s + byId[id].reach, 0);
      expect(total).toBeGreaterThanOrEqual(target);
    }
  });
});

describe("santaReducer: 2-player mutual exchange", () => {
  it("degenerates into a clean swap when the two gifts differ", () => {
    const target = REACH_TARGET[2]; // 17
    let state = start(["A", "B"]);
    state = gift(state, "hundreds"); // giver0 -> receiver1
    state = gift(state, "marquise"); // giver1 -> receiver0
    expect(state.phase).toBe("reveal");
    state = reveal(state, target, 2);
    expect(state.phase).toBe("done");
    expect(state.assign).toEqual(["marquise", "hundreds"]);
    expect(state.firstSeat).toBe(0); // no bounce, standard seat-0 convention
  });

  it("forces a re-pick when both players happen to gift the same faction", () => {
    const target = REACH_TARGET[2];
    let state = start(["A", "B"]);
    state = gift(state, "marquise"); // giver0 -> receiver1
    state = gift(state, "marquise"); // giver1 -> receiver0 — same faction!
    state = reveal(state, target, 1); // receiver0 gets marquise first — accepted
    expect(state.assign[0]).toBe("marquise");
    state = reveal(state, target, 1); // receiver1's marquise bounces — duplicate
    expect(state.phase).toBe("repick");
    expect(state.events[state.events.length - 1]).toMatchObject({ seatIndex: 1, giverSeat: 0 });

    const accepted = new Set(state.assign.filter((x): x is string => x !== null));
    const survivors = legalSurvivors(accepted, POOL, 2, target);
    state = repick(state, survivors[0], target);
    expect(state.phase).toBe("done");
    expect(state.assign[1]).toBe(survivors[0]);
    expect(state.firstSeat).toBe(1); // the bumped receiver opens the game
  });
});
