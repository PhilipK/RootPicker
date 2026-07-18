import { describe, it, expect } from "vitest";
import { FACTIONS, REACH_TARGET } from "../data/factions";
import { legalLineups, legalReplacements, multisetLegal } from "./mulligan";

const T4 = REACH_TARGET[4]; // 21

describe("legalLineups", () => {
  it("only returns playerCount-sized subsets that are reach-legal and respect A.8.1", () => {
    const pool = FACTIONS.filter((f) =>
      ["marquise", "hundreds", "eyrie", "duchy", "vagabond", "knaves", "lizard"].includes(f.id),
    );
    const lineups = legalLineups(pool, 4, T4);
    expect(lineups.length).toBeGreaterThan(0);
    for (const subset of lineups) {
      expect(subset).toHaveLength(4);
      const ids = subset.map((f) => f.id);
      expect(multisetLegal(ids, T4)).toBe(true);
    }
  });

  it("finds nothing when even the best-case subset can't reach the target", () => {
    const pool = FACTIONS.filter((f) => ["lizard", "corvid", "woodland", "twilight", "riverfolk"].includes(f.id));
    expect(legalLineups(pool, 4, T4)).toEqual([]);
  });
});

describe("legalReplacements", () => {
  it("only returns candidates that keep the holdings multiset legal — the deal starts exactly at target", () => {
    const holdings = ["eyrie", "duchy", "woodland", "corvid"]; // 7+8+3+3 = 21, no slack
    const market = ["marquise", "lizard"]; // 10 vs 2
    // swapping into seat 2 (woodland, reach 3): marquise clears the bar, lizard doesn't
    expect(legalReplacements(market, holdings, 2, T4)).toEqual(["marquise"]);
  });

  it("rejects a swap that would pair Vagabond and Knaves (A.8.1), independent of reach", () => {
    const holdings = ["vagabond", "hundreds", "eyrie", "duchy"]; // 5+9+7+8 = 29
    const market = ["knaves", "marquise"];
    // swapping into seat 1 (hundreds): knaves would keep reach at 24 (still ≥ 21) but
    // pairs with the held Vagabond, so only marquise survives
    expect(legalReplacements(market, holdings, 1, T4)).toEqual(["marquise"]);
  });

  it("bars a seat from drawing back the faction it currently holds", () => {
    // even though swapping it "in" would trivially keep the multiset legal
    // (it's already there), it's not a real mulligan for the seat that holds it
    const holdings = ["lizard", "hundreds", "eyrie", "duchy"]; // 2+9+7+8 = 26
    const market = ["lizard", "marquise"];
    expect(legalReplacements(market, holdings, 0, T4)).toEqual(["marquise"]);
  });

  it("lets a later seat draw a faction an earlier seat already mulliganed away", () => {
    // seat 0 already resolved (mulliganed "hundreds" for "marquise"); "hundreds" sits
    // back in the market now and is open to seat 1's mulligan, not barred for them
    const holdings = ["marquise", "eyrie", "duchy", "riverfolk"]; // 10+7+8+5 = 30
    const market = ["lizard", "hundreds"];
    const candidates = legalReplacements(market, holdings, 1, T4);
    expect(candidates).toContain("hundreds");
  });

  it("blocks the mulligan entirely when no market faction can legally replace the holding", () => {
    const holdings = ["eyrie", "duchy", "woodland", "corvid"]; // 7+8+3+3 = 21, no slack
    const market = ["lizard"]; // reach 2 — any swap in drops the table below target
    expect(legalReplacements(market, holdings, 2, T4)).toEqual([]);
  });
});
