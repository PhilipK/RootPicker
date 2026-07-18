import { describe, it, expect } from "vitest";
import { FACTIONS, REACH_TARGET, byId } from "../data/factions";
import { accumFromPicks, bannedAfter, dealHand, draftSolvable, safeCandidates, HAND_SIZE, type Banned } from "./handDraft";

const FULL_DECK = FACTIONS.filter((f) => f.id !== "vagabond2").map((f) => f.id); // 13 ids

/** Identity "shuffle" — keeps candidate order stable so tests are deterministic. */
function noShuffle<T>(arr: T[]): T[] {
  return arr;
}

/** Play out a full just-in-time draft, always taking the first offered card,
    asserting every dealt card stays legal at the moment it's offered. */
function simulateDraft(playerCount: number, target: number, deck: string[]) {
  let pool = deck.slice();
  const picks: string[] = [];
  let banned: Banned = null;
  const handSizes: number[] = [];

  for (let turn = 0; turn < playerCount; turn++) {
    const { sum, mil } = accumFromPicks(picks);
    const playersRemaining = playerCount - turn;
    const hand = dealHand(pool, playersRemaining, sum, mil, banned, target, noShuffle);
    expect(hand.length).toBeGreaterThan(0);
    handSizes.push(hand.length);

    for (const id of hand) {
      const f = byId[id];
      const nextPool = pool.filter((x) => x !== id);
      const nextBanned: Banned = banned ?? (id === "vagabond" ? "knaves" : id === "knaves" ? "vagabond" : null);
      expect(
        draftSolvable(nextPool, playersRemaining - 1, sum + f.reach, mil || f.type === "militant", nextBanned, target),
      ).toBe(true);
    }

    const chosen = hand[0];
    picks.push(chosen);
    pool = pool.filter((x) => x !== chosen);
    banned = bannedAfter(picks);
  }

  return { picks, handSizes };
}

describe("draftSolvable", () => {
  it("is feasible from the full owned deck at every player count (feasibility check at start)", () => {
    for (const pc of [2, 3, 4, 5, 6]) {
      expect(draftSolvable(FULL_DECK, pc, 0, false, null, REACH_TARGET[pc])).toBe(true);
    }
  });

  it("is infeasible when the deck can't reach the target", () => {
    const weakDeck = ["lizard", "corvid", "woodland"]; // reach 2+3+3=8, no militant
    expect(draftSolvable(weakDeck, 3, 0, false, null, REACH_TARGET[3])).toBe(false);
  });

  it("is infeasible when reach is fine but no militant is available", () => {
    const noMilitant = ["lizard", "corvid", "woodland", "twilight", "riverfolk"]; // all insurgent
    expect(draftSolvable(noMilitant, 3, 0, false, null, 5)).toBe(false);
  });

  it("becomes solvable once a militant is folded in", () => {
    const withMilitant = ["lizard", "corvid", "woodland", "marquise"];
    expect(draftSolvable(withMilitant, 2, 0, false, null, 5)).toBe(true);
  });
});

describe("safeCandidates / dealHand — every dealt card is always legal", () => {
  for (const pc of [2, 3, 4, 5, 6]) {
    it(`holds across a full ${pc}-player draft`, () => {
      const { picks } = simulateDraft(pc, REACH_TARGET[pc], FULL_DECK);
      expect(picks).toHaveLength(pc);
      // militant guarantee
      const { sum, mil } = accumFromPicks(picks);
      expect(mil).toBe(true);
      expect(sum).toBeGreaterThanOrEqual(REACH_TARGET[pc]);
      // A.8.1: never both Vagabond and Knaves at the final table
      expect(picks.includes("vagabond") && picks.includes("knaves")).toBe(false);
    });
  }

  it("deals 3-card hands at 5 players (recycling restores the full hand size)", () => {
    const { handSizes } = simulateDraft(5, REACH_TARGET[5], FULL_DECK);
    expect(handSizes.every((n) => n === HAND_SIZE)).toBe(true);
  });

  it("deals 3-card hands at 6 players (recycling restores the full hand size)", () => {
    const { handSizes } = simulateDraft(6, REACH_TARGET[6], FULL_DECK);
    expect(handSizes.every((n) => n === HAND_SIZE)).toBe(true);
  });
});

describe("A.8.1 dynamic exclusion", () => {
  it("offers both Vagabond and Knaves in the same hand before either is picked", () => {
    const candidates = safeCandidates(FULL_DECK, 4, 0, false, null, REACH_TARGET[4]);
    expect(candidates).toContain("vagabond");
    expect(candidates).toContain("knaves");
  });

  it("bans Knaves from every future pool once Vagabond is picked", () => {
    const picks = ["vagabond"];
    const banned = bannedAfter(picks);
    expect(banned).toBe("knaves");
    const pool = FULL_DECK.filter((id) => id !== "vagabond"); // knaves still physically in pool
    expect(pool).toContain("knaves");
    const { sum, mil } = accumFromPicks(picks);
    const candidates = safeCandidates(pool, 3, sum, mil, banned, REACH_TARGET[4]);
    expect(candidates).not.toContain("knaves");
  });

  it("bans Vagabond from every future pool once Knaves is picked", () => {
    const picks = ["knaves"];
    const banned = bannedAfter(picks);
    expect(banned).toBe("vagabond");
    const pool = FULL_DECK.filter((id) => id !== "knaves");
    const { sum, mil } = accumFromPicks(picks);
    const candidates = safeCandidates(pool, 3, sum, mil, banned, REACH_TARGET[4]);
    expect(candidates).not.toContain("vagabond");
  });

  it("never deals a Knaves-then-Vagabond (or reverse) combination across a full draft", () => {
    for (const pc of [2, 3, 4, 5, 6]) {
      const { picks } = simulateDraft(pc, REACH_TARGET[pc], FULL_DECK);
      expect(picks.includes("vagabond") && picks.includes("knaves")).toBe(false);
    }
  });
});
