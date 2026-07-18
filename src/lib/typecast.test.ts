import { describe, it, expect } from "vitest";
import { FACTIONS, REACH_TARGET } from "../data/factions";
import type { Faction } from "../types";
import {
  bitmaskAssignVotes,
  countVotesForFaction,
  emptyBallots,
  findBestTypecastAssignment,
  typecastTargets,
  type Ballots,
} from "./typecast";

const POOL = FACTIONS.filter((f) => f.id !== "vagabond2");
const T3 = REACH_TARGET[3]; // 18
const T4 = REACH_TARGET[4]; // 21

function fac(id: string, reach: number): Faction {
  return { id, name: id, reach, type: "militant", corner: false, difficulty: 1 };
}

describe("typecastTargets", () => {
  it("lists every other seat, in seat order, never the actor themselves", () => {
    expect(typecastTargets(0, 4)).toEqual([1, 2, 3]);
    expect(typecastTargets(2, 4)).toEqual([0, 1, 3]);
    expect(typecastTargets(3, 4)).toEqual([0, 1, 2]);
  });
});

describe("emptyBallots", () => {
  it("builds an NxN grid of empty strings", () => {
    const b = emptyBallots(3);
    expect(b).toHaveLength(3);
    expect(b.every((row) => row.length === 3 && row.every((v) => v === ""))).toBe(true);
  });
});

describe("countVotesForFaction", () => {
  it("counts only nominations from other seats, never the target's own row", () => {
    const votes: Ballots = [
      ["", "A", "A"],
      ["A", "", "B"],
      ["A", "B", ""],
    ];
    // seat 0 receives "A" from seat 1 and seat 2
    expect(countVotesForFaction(votes, 0, "A")).toBe(2);
    // seat 1 receives "A" from seat 0 only
    expect(countVotesForFaction(votes, 1, "A")).toBe(1);
    expect(countVotesForFaction(votes, 1, "B")).toBe(1);
    // a faction nobody nominated for that seat scores 0
    expect(countVotesForFaction(votes, 2, "Z")).toBe(0);
  });
});

describe("bitmaskAssignVotes", () => {
  it("finds the unanimous assignment when every seat has a clear, non-conflicting favorite", () => {
    const factions = [fac("A", 1), fac("B", 1), fac("C", 1)];
    const votes: Ballots = [
      ["", "B", "C"], // seat 0 nominates B for seat 1, C for seat 2
      ["A", "", "C"], // seat 1 nominates A for seat 0, C for seat 2
      ["A", "B", ""], // seat 2 nominates A for seat 0, B for seat 1
    ];
    const result = bitmaskAssignVotes(factions, votes);
    expect(result).not.toBeNull();
    // every seat's assigned faction matches both other seats' nominations: 2+2+2
    expect(result!.score).toBe(6);
    expect(result!.assign).toEqual(["A", "B", "C"]);
  });

  it("picks the single best home for a faction everyone wants, rather than splitting votes", () => {
    // all three seats nominate "A" for both other seats; nobody nominates
    // "B" or "C" for anyone. Only one seat can hold "A" (2 votes); the other
    // two seats necessarily end up with zero-vote factions.
    const factions = [fac("A", 1), fac("B", 1), fac("C", 1)];
    const votes: Ballots = [
      ["", "A", "A"],
      ["A", "", "A"],
      ["A", "A", ""],
    ];
    const result = bitmaskAssignVotes(factions, votes);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(2);
    expect(result!.assign.filter((id) => id === "A")).toHaveLength(1);
  });

});

describe("findBestTypecastAssignment", () => {
  it("maximizes total votes matched among reach-legal, distinct-faction assignments", () => {
    const votes: Ballots = emptyBallots(3);
    // everyone nominates marquise (reach 10) for whoever else they can, so
    // any legal 3-faction subset containing marquise concentrates votes there
    votes[0][1] = "marquise";
    votes[0][2] = "eyrie";
    votes[1][0] = "marquise";
    votes[1][2] = "eyrie";
    votes[2][0] = "marquise";
    votes[2][1] = "eyrie";
    const best = findBestTypecastAssignment(votes, POOL, T3);
    expect(best).not.toBeNull();
    expect(best!.total).toBeGreaterThanOrEqual(T3);
    // seat 0 gets 2 marquise votes (from seats 1 and 2), seat 2 gets 2 eyrie
    // votes (from seats 0 and 1); seat 1 is left with a zero-vote faction
    const marquiseSeat = best!.assign.indexOf("marquise");
    const eyrieSeat = best!.assign.indexOf("eyrie");
    expect(marquiseSeat).toBe(0);
    expect(eyrieSeat).toBe(2);
    expect(best!.score).toBe(4);
  });

  it("never seats the Vagabond and the Knaves together, even if both are heavily nominated (A.8.1)", () => {
    const votes: Ballots = emptyBallots(4);
    votes[1][0] = "vagabond";
    votes[2][0] = "vagabond";
    votes[3][0] = "vagabond";
    votes[0][1] = "knaves";
    votes[2][1] = "knaves";
    votes[3][1] = "knaves";
    const best = findBestTypecastAssignment(votes, POOL, T4);
    expect(best).not.toBeNull();
    const hasVagabond = best!.assign.includes("vagabond");
    const hasKnaves = best!.assign.includes("knaves");
    expect(hasVagabond && hasKnaves).toBe(false);
    // one of the two heavily-voted factions should still win its seat
    expect(hasVagabond || hasKnaves).toBe(true);
  });

  it("never returns a subset below the reach target, even at the cost of every vote", () => {
    const votes: Ballots = emptyBallots(4);
    // everyone piles votes onto the lowest-reach factions, which alone can't
    // reach the 4-player target of 21
    votes[1][0] = "lizard"; // reach 2
    votes[2][0] = "lizard";
    votes[3][0] = "lizard";
    votes[0][1] = "corvid"; // reach 3
    votes[2][1] = "corvid";
    votes[3][1] = "corvid";
    votes[0][2] = "woodland"; // reach 3
    votes[1][2] = "woodland";
    votes[3][2] = "woodland";
    votes[0][3] = "twilight"; // reach 4
    votes[1][3] = "twilight";
    votes[2][3] = "twilight";
    // lizard+corvid+woodland+twilight = 2+3+3+4 = 12, well under 21
    const best = findBestTypecastAssignment(votes, POOL, T4);
    expect(best).not.toBeNull();
    expect(best!.total).toBeGreaterThanOrEqual(T4);
  });

  it("returns a legal, zero-vote assignment when the only reach-legal subset shares no votes with the ballots", () => {
    // duchy+keepers+riverfolk (8+8+5=21) is the only 3-faction subset of this
    // trimmed pool, and it meets the 3-player target of 18 — but every ballot
    // nominates marquise, which isn't in the pool at all. Legality has to win.
    const soloPool = POOL.filter((f) => ["duchy", "keepers", "riverfolk"].includes(f.id));
    const votes: Ballots = emptyBallots(3);
    votes[1][0] = "marquise";
    votes[2][0] = "marquise";
    votes[0][1] = "marquise";
    votes[2][1] = "marquise";
    votes[0][2] = "marquise";
    votes[1][2] = "marquise";
    const best = findBestTypecastAssignment(votes, soloPool, T3);
    expect(best).not.toBeNull();
    expect(best!.score).toBe(0);
    expect(new Set(best!.assign)).toEqual(new Set(["duchy", "keepers", "riverfolk"]));
    expect(best!.total).toBeGreaterThanOrEqual(T3);
  });

  it("excludes the Second Vagabond when the caller pre-filters the pool, matching Wishlist's precedent", () => {
    const votes: Ballots = emptyBallots(4);
    votes[1][0] = "vagabond";
    votes[2][0] = "vagabond";
    votes[3][0] = "vagabond";
    const best = findBestTypecastAssignment(votes, POOL, T4);
    expect(best).not.toBeNull();
    expect(best!.assign).not.toContain("vagabond2");
    expect(POOL.some((f) => f.id === "vagabond2")).toBe(false);
  });

  it("returns null when the pool can't supply enough distinct factions", () => {
    const votes: Ballots = emptyBallots(3);
    const tinyPool = POOL.slice(0, 2);
    expect(findBestTypecastAssignment(votes, tinyPool, T3)).toBeNull();
  });
});
