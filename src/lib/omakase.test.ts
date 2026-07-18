import { describe, it, expect } from "vitest";
import { byId, FACTIONS, REACH_TARGET } from "../data/factions";
import {
  factionDistance,
  fitBand,
  findBestOmakaseAssignment,
  normalizedComplexity,
  plateLine,
  type OmakasePlayer,
} from "./omakase";

describe("normalizedComplexity", () => {
  it("rescales difficulty 1..13 linearly onto 1..5", () => {
    expect(normalizedComplexity({ ...byId.marquise, difficulty: 1 })).toBeCloseTo(1);
    expect(normalizedComplexity({ ...byId.lizard, difficulty: 13 })).toBeCloseTo(5);
    expect(normalizedComplexity({ ...byId.marquise, difficulty: 7 })).toBeCloseTo(3);
  });
});

describe("factionDistance", () => {
  it("is 0 for a perfect match on all three axes", () => {
    const f = { ...byId.marquise, difficulty: 1 }; // aggression 4, footprint 5, complexity 1
    const player: OmakasePlayer = { name: "P", aggression: 4, footprint: 5, complexity: 1 };
    expect(factionDistance(player, f)).toBeCloseTo(0);
  });

  it("sums absolute per-axis gaps", () => {
    // marquise: aggression 4, footprint 5, difficulty 1 -> complexity 1
    const player: OmakasePlayer = { name: "P", aggression: 5, footprint: 5, complexity: 5 };
    expect(factionDistance(player, byId.marquise)).toBeCloseTo(1 + 0 + 4);
  });

  it("prefers the faction closer to a player's dials", () => {
    // a peaceful, compact, simple-minded player
    const player: OmakasePlayer = { name: "P", aggression: 1, footprint: 1, complexity: 1 };
    const lizardDist = factionDistance(player, byId.lizard); // aggression 1, footprint 2, complexity ~5
    const hundredsDist = factionDistance(player, byId.hundreds); // aggression 5, footprint 5, complexity ~1.33
    expect(lizardDist).toBeLessThan(hundredsDist);
  });
});

describe("fitBand", () => {
  it("bands total distance into four honest buckets", () => {
    expect(fitBand(0)).toBe("spot-on");
    expect(fitBand(2)).toBe("spot-on");
    expect(fitBand(2.1)).toBe("close");
    expect(fitBand(5)).toBe("close");
    expect(fitBand(5.1)).toBe("workable");
    expect(fitBand(8)).toBe("workable");
    expect(fitBand(8.1)).toBe("stretch");
    expect(fitBand(12)).toBe("stretch");
  });
});

describe("plateLine", () => {
  it("is deterministic for a given distance", () => {
    expect(plateLine(1)).toBe(plateLine(1));
    expect(plateLine(6.4)).toBe(plateLine(6.4));
  });

  it("only ever returns a fragment from the matching band", () => {
    expect([
      "this plate sits right where you set every dial.",
      "this plate matches the mood you dialed in almost exactly.",
    ]).toContain(plateLine(1));
    expect([
      "this plate is a stretch from what you dialed in — the table's reach requirement outweighed your fit.",
      "this plate is further from your sliders than we'd like; balancing everyone at once meant yours gave the most ground.",
    ]).toContain(plateLine(10));
  });
});

describe("findBestOmakaseAssignment: legality", () => {
  const noTie = () => 0; // always take the first tied candidate — deterministic tests

  it("never seats both Vagabond and Knaves (A.8.1)", () => {
    const players: OmakasePlayer[] = Array.from({ length: 4 }, (_, i) => ({
      name: `P${i}`,
      aggression: 3,
      footprint: 3,
      complexity: 3,
    }));
    const result = findBestOmakaseAssignment(players, FACTIONS, REACH_TARGET[4], noTie);
    expect(result).not.toBeNull();
    const ids = new Set(result!.assign);
    expect(ids.has("vagabond") && ids.has("knaves")).toBe(false);
  });

  it("never seats the Second Vagabond, even if it's in the supplied pool", () => {
    const players: OmakasePlayer[] = Array.from({ length: 4 }, (_, i) => ({
      name: `P${i}`,
      aggression: 3,
      footprint: 3,
      complexity: 3,
    }));
    const result = findBestOmakaseAssignment(players, FACTIONS, REACH_TARGET[4], noTie);
    expect(result).not.toBeNull();
    expect(result!.assign).not.toContain("vagabond2");
  });

  it("always reaches the target total reach", () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const players: OmakasePlayer[] = Array.from({ length: n }, (_, i) => ({
        name: `P${i}`,
        aggression: (i % 5) + 1,
        footprint: ((i + 2) % 5) + 1,
        complexity: ((i + 4) % 5) + 1,
      }));
      const result = findBestOmakaseAssignment(players, FACTIONS, REACH_TARGET[n], noTie);
      expect(result).not.toBeNull();
      expect(result!.total).toBeGreaterThanOrEqual(REACH_TARGET[n]);
      expect(result!.subset).toHaveLength(n);
      expect(new Set(result!.assign).size).toBe(n); // no faction dealt twice
    }
  });

  it("returns null when no reach-safe subset of the right size exists", () => {
    const players: OmakasePlayer[] = [{ name: "P", aggression: 3, footprint: 3, complexity: 3 }];
    const tinyPool = [byId.lizard]; // reach 2, only one faction — can't seat 2 players
    const twoPlayers: OmakasePlayer[] = [players[0], { ...players[0], name: "Q" }];
    expect(findBestOmakaseAssignment(twoPlayers, tinyPool, REACH_TARGET[2], noTie)).toBeNull();
  });
});

describe("findBestOmakaseAssignment: legality gates fit, not the other way around", () => {
  it("picks the only legal subset even when a better-fitting one exists but fails reach", () => {
    // Hand-built 3-faction pool, 2 players, both peaceful/compact/simple.
    // lizard+corvid (reach 5) fits their mood best but fails a target of 8;
    // only corvid+riverfolk (reach 8) clears it, despite riverfolk being a
    // worse mood match than lizard.
    const pool = [byId.lizard, byId.corvid, byId.riverfolk];
    expect(byId.lizard.reach + byId.corvid.reach).toBe(5);
    expect(byId.lizard.reach + byId.riverfolk.reach).toBe(7);
    expect(byId.corvid.reach + byId.riverfolk.reach).toBe(8);

    const players: OmakasePlayer[] = [
      { name: "A", aggression: 1, footprint: 1, complexity: 1 },
      { name: "B", aggression: 1, footprint: 1, complexity: 1 },
    ];
    const result = findBestOmakaseAssignment(players, pool, 8, () => 0);
    expect(result).not.toBeNull();
    expect(result!.subset.map((f) => f.id).sort()).toEqual(["corvid", "riverfolk"]);
    expect(result!.total).toBe(8);
  });

  it("optimizes fit within the legal subsets when several clear the target", () => {
    // Two very different players and two well-separated factions, reach
    // requirement set low (0) so every subset is legal — isolates the
    // scoring logic from the legality filter.
    const warlike: OmakasePlayer = { name: "Warlike", aggression: 5, footprint: 5, complexity: 5 };
    const peaceful: OmakasePlayer = { name: "Peaceful", aggression: 1, footprint: 1, complexity: 1 };
    const pool = [byId.hundreds, byId.lizard]; // hundreds: 5/5/~1.33; lizard: 1/2/5
    const result = findBestOmakaseAssignment([warlike, peaceful], pool, 0, () => 0);
    expect(result).not.toBeNull();
    expect(result!.assign[0]).toBe("hundreds"); // warlike player gets the warlike faction
    expect(result!.assign[1]).toBe("lizard"); // peaceful player gets the peaceful faction
  });
});
