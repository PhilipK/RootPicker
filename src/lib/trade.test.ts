import { describe, it, expect } from "vitest";
import { REACH_TARGET } from "../data/factions";
import { multisetLegal, runTrade } from "./trade";

const T4 = REACH_TARGET[4]; // 21

describe("multisetLegal", () => {
  it("accepts a lineup at or above target", () => {
    // marquise 10 + hundreds 9 + eyrie 7 + duchy 8 = 34
    expect(multisetLegal(["marquise", "hundreds", "eyrie", "duchy"], T4)).toBe(true);
  });

  it("rejects a lineup below target", () => {
    // lizard 2 + corvid 3 + woodland 3 + twilight 4 = 12
    expect(multisetLegal(["lizard", "corvid", "woodland", "twilight"], T4)).toBe(false);
  });

  it("rejects Vagabond + Knaves together regardless of reach (A.8.1)", () => {
    expect(multisetLegal(["vagabond", "knaves", "marquise", "hundreds"], T4)).toBe(false);
  });
});

describe("runTrade: seat-only cycles", () => {
  it("keeps everyone in place when nobody ranks anything", () => {
    const deal = ["marquise", "hundreds", "eyrie", "duchy"];
    const { assign, cycles } = runTrade(deal, [[], [], [], []], ["lizard"], [0, 1, 2, 3], T4);
    expect(assign).toEqual(deal);
    // four self-loop cycles
    expect(cycles).toHaveLength(4);
    for (const c of cycles) {
      expect(c.moves).toHaveLength(1);
      expect(c.moves[0].from).toBe(c.moves[0].to);
      expect(c.fromStalls).toEqual([]);
    }
  });

  it("executes a pairwise swap when two players want each other's deal", () => {
    const deal = ["marquise", "hundreds", "eyrie", "duchy"];
    const prefs = [["hundreds"], ["marquise"], [], []];
    const { assign, cycles } = runTrade(deal, prefs, [], [0, 1, 2, 3], T4);
    expect(assign).toEqual(["hundreds", "marquise", "eyrie", "duchy"]);
    const swap = cycles.find((c) => c.moves.length === 2)!;
    expect(swap.moves.map((m) => m.seatIndex).sort()).toEqual([0, 1]);
  });

  it("resolves a 3-way cycle no pairwise swap could", () => {
    const deal = ["marquise", "hundreds", "eyrie", "duchy"];
    // 0 wants 1's, 1 wants 2's, 2 wants 0's
    const prefs = [["hundreds"], ["eyrie"], ["marquise"], []];
    const { assign, cycles } = runTrade(deal, prefs, [], [0, 1, 2, 3], T4);
    expect(assign).toEqual(["hundreds", "eyrie", "marquise", "duchy"]);
    expect(cycles.find((c) => c.moves.length === 3)).toBeTruthy();
  });

  it("stops a player's wants at their own deal — lower ranks never trade them down", () => {
    const deal = ["marquise", "hundreds", "eyrie", "duchy"];
    // seat 0 ranks their own deal first: everything after it is irrelevant
    const prefs = [["marquise", "hundreds"], ["marquise"], [], []];
    const { assign } = runTrade(deal, prefs, [], [0, 1, 2, 3], T4);
    expect(assign[0]).toBe("marquise");
  });
});

describe("runTrade: stall trades", () => {
  it("lets a player swap into an unheld faction when reach allows", () => {
    const deal = ["marquise", "hundreds", "eyrie", "duchy"]; // 34 reach
    const prefs = [["riverfolk"], [], [], []]; // riverfolk reach 5 → 29, still ≥ 21
    const { assign, cycles } = runTrade(deal, prefs, ["riverfolk", "lizard"], [0, 1, 2, 3], T4);
    expect(assign).toEqual(["riverfolk", "hundreds", "eyrie", "duchy"]);
    const stallCycle = cycles.find((c) => c.fromStalls.length)!;
    expect(stallCycle.fromStalls).toEqual(["riverfolk"]);
    expect(stallCycle.released).toEqual(["marquise"]);
  });

  it("blocks a stall swap that would drop the table below reach, falling through to the next want", () => {
    // 10 + 5 + 3 + 3 = 21, exactly at target: swapping marquise (10) for
    // lizard (2) lands at 13 — illegal, so seat 0's second want (a legal
    // player swap) resolves instead.
    const deal = ["marquise", "riverfolk", "woodland", "corvid"];
    const prefs = [["lizard", "riverfolk"], ["marquise"], [], []];
    const { assign } = runTrade(deal, prefs, ["lizard"], [0, 1, 2, 3], T4);
    expect(assign).toEqual(["riverfolk", "marquise", "woodland", "corvid"]);
  });

  it("blocks a stall swap that would field Vagabond and Knaves together", () => {
    const deal = ["knaves", "marquise", "hundreds", "duchy"]; // 31 reach
    const prefs = [[], ["vagabond"], [], []]; // vagabond joining knaves — illegal
    const { assign } = runTrade(deal, prefs, ["vagabond"], [0, 1, 2, 3], T4);
    expect(assign).toEqual(deal);
  });

  it("releases the traded-away faction so a later cycle can pick it up", () => {
    const deal = ["marquise", "hundreds", "eyrie", "duchy"];
    // seat 0 swaps marquise into the stalls; seat 1 wants marquise, which is
    // only reachable once seat 0's stall trade has released it.
    const prefs = [["keepers"], ["marquise"], [], []];
    const { assign } = runTrade(deal, prefs, ["keepers"], [1, 0, 2, 3], T4);
    expect(assign[0]).toBe("keepers");
    expect(assign[1]).toBe("marquise");
  });

  it("never assigns the same faction twice and always ends legal", () => {
    // everyone chasing the same wants, plus stall churn
    const deal = ["marquise", "hundreds", "eyrie", "duchy"];
    const prefs = [
      ["keepers", "hundreds"],
      ["keepers", "marquise"],
      ["keepers", "lilypad"],
      ["keepers", "riverfolk", "lizard"],
    ];
    const { assign } = runTrade(deal, prefs, ["keepers", "lilypad", "riverfolk", "lizard"], [2, 0, 3, 1], T4);
    expect(new Set(assign).size).toBe(4);
    expect(multisetLegal(assign, T4)).toBe(true);
  });
});

describe("runTrade: two players", () => {
  it("handles the minimal table", () => {
    const T2 = REACH_TARGET[2]; // 17
    const deal = ["marquise", "hundreds"]; // 19
    const prefs = [["hundreds"], ["marquise"]];
    const { assign } = runTrade(deal, prefs, [], [1, 0], T2);
    expect(assign).toEqual(["hundreds", "marquise"]);
  });
});
