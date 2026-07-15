import { describe, it, expect } from "vitest";
import { FACTIONS } from "../data/factions";
import { findBestWishAssignment, wishPoints, wishScore } from "./wish";

const pool = FACTIONS.filter((f) => f.id !== "vagabond2");

/** Deterministic LCG so the statistical tests are reproducible. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("wishPoints", () => {
  it("doubles per rank and is 0 off-list", () => {
    expect(wishPoints(0, 3)).toBe(4);
    expect(wishPoints(1, 3)).toBe(2);
    expect(wishPoints(2, 3)).toBe(1);
    expect(wishPoints(-1, 3)).toBe(0);
    expect(wishPoints(3, 3)).toBe(0);
  });
});

describe("findBestWishAssignment", () => {
  it("returns null when no subset can reach the target", () => {
    const players = [
      { name: "A", picks: ["eyrie"] },
      { name: "B", picks: ["duchy"] },
    ];
    expect(findBestWishAssignment(players, pool, 1000, 1)).toBeNull();
  });

  it("never pairs Vagabond with the Knaves", () => {
    const players = [
      { name: "A", picks: ["vagabond", "knaves"] },
      { name: "B", picks: ["knaves", "vagabond"] },
    ];
    const rand = lcg(7);
    for (let i = 0; i < 50; i++) {
      const r = findBestWishAssignment(players, pool, 17, 2, rand)!;
      const ids = new Set(r.assign);
      expect(ids.has("vagabond") && ids.has("knaves")).toBe(false);
    }
  });

  // Regression for the "4 players, 3 distinct wishes" table: everyone wanted
  // some order of Hundreds/Eyrie/Duchy, so exactly one player must go
  // off-list. Reach must play no role (the wished trio alone totals 24 ≥ 21),
  // the total happiness must hit the provable optimum of 10, and Daniel —
  // the only player whose 1st choice is uncontested — must always get it.
  const table = [
    { name: "Daniel", picks: ["hundreds", "eyrie", "duchy"] },
    { name: "Philip", picks: ["eyrie", "hundreds", "duchy"] },
    { name: "Tobias", picks: ["eyrie", "duchy", "hundreds"] },
    { name: "Andreas", picks: ["eyrie", "duchy", "hundreds"] },
  ];

  it("finds the optimal score when wishes collide", () => {
    const rand = lcg(42);
    const r = findBestWishAssignment(table, pool, 21, 3, rand)!;
    expect(r.score).toBe(10);
    expect(r.total).toBeGreaterThanOrEqual(21);
    expect(r.assign[0]).toBe("hundreds");
    const offList = table.filter((p, i) => wishScore(p.picks, r.assign[i], 3) === 0);
    expect(offList.length).toBe(1);
  });

  it("draws the short straw and the filler faction without ordering bias", () => {
    const rand = lcg(123);
    const runs = 3000;
    const victim: Record<string, number> = {};
    const filler: Record<string, number> = {};
    for (let k = 0; k < runs; k++) {
      const r = findBestWishAssignment(table, pool, 21, 3, rand)!;
      table.forEach((p, i) => {
        if (wishScore(p.picks, r.assign[i], 3) === 0) victim[p.name] = (victim[p.name] ?? 0) + 1;
      });
      const extra = r.assign.find((id) => !["hundreds", "eyrie", "duchy"].includes(id))!;
      filler[extra] = (filler[extra] ?? 0) + 1;
    }
    // Daniel's 1st choice is uncontested; he can never be the victim. The
    // optimal assignments split 2:1:1 between Philip, Tobias and Andreas.
    expect(victim["Daniel"]).toBeUndefined();
    expect(victim["Philip"]).toBeGreaterThan(runs * 0.45);
    expect(victim["Philip"]).toBeLessThan(runs * 0.55);
    for (const name of ["Tobias", "Andreas"]) {
      expect(victim[name]).toBeGreaterThan(runs * 0.2);
      expect(victim[name]).toBeLessThan(runs * 0.3);
    }
    // Reach never constrains the filler here (24 + worst-case 2 ≥ 21), so all
    // ten leftover factions must appear roughly uniformly.
    const fillers = Object.keys(filler);
    expect(fillers.length).toBe(10);
    for (const id of fillers) {
      expect(filler[id]).toBeGreaterThan(runs * 0.066);
      expect(filler[id]).toBeLessThan(runs * 0.133);
    }
  });

  it("prefers spreading picks over leaving a player empty-handed on equal points", () => {
    // Max points is 12 both ways: P1→marquise(4), P2→hundreds(4), P3→eyrie(4)
    // strands P4 at 0, while P1→marquise(4), P4→hundreds(2), P2→duchy(2),
    // P3→eyrie(4) covers everyone. The tie-break must always pick coverage.
    const players = [
      { name: "P1", picks: ["marquise", "hundreds", "eyrie"] },
      { name: "P2", picks: ["hundreds", "duchy", "keepers"] },
      { name: "P3", picks: ["eyrie", "lilypad", "riverfolk"] },
      { name: "P4", picks: ["marquise", "hundreds", "eyrie"] },
    ];
    const rand = lcg(99);
    for (let k = 0; k < 50; k++) {
      const r = findBestWishAssignment(players, pool, 21, 3, rand)!;
      expect(r.score).toBe(12);
      players.forEach((p, i) => {
        expect(wishScore(p.picks, r.assign[i], 3)).toBeGreaterThan(0);
      });
    }
  });
});
