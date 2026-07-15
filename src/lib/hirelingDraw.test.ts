import { describe, it, expect } from "vitest";
import { HIRELINGS, DEFAULT_OWNED_HIRELING_IDS } from "../data/hirelings";
import { demoteCount, eligibleHirelings, drawHirelings } from "./hirelingDraw";

const ALL_OWNED = new Set(DEFAULT_OWNED_HIRELING_IDS);

describe("demoteCount", () => {
  it("follows the Law A.6.2 progression", () => {
    expect(demoteCount(2)).toBe(0);
    expect(demoteCount(3)).toBe(1);
    expect(demoteCount(4)).toBe(2);
    expect(demoteCount(5)).toBe(3);
    expect(demoteCount(6)).toBe(3);
  });
});

describe("eligibleHirelings", () => {
  it("excludes hirelings the table doesn't own", () => {
    const owned = new Set(["exile"]);
    expect(eligibleHirelings(owned, new Set())).toEqual([HIRELINGS.find((h) => h.id === "exile")]);
  });

  it("excludes hirelings whose corresponding faction is already in the game", () => {
    const eligible = eligibleHirelings(ALL_OWNED, new Set(["keepers"]));
    expect(eligible.some((h) => h.id === "vault-keepers")).toBe(false);
  });

  it("The Exile locks out on either Vagabond board or the Knaves", () => {
    expect(eligibleHirelings(ALL_OWNED, new Set(["vagabond"])).some((h) => h.id === "exile")).toBe(false);
    expect(eligibleHirelings(ALL_OWNED, new Set(["vagabond2"])).some((h) => h.id === "exile")).toBe(false);
    expect(eligibleHirelings(ALL_OWNED, new Set(["knaves"])).some((h) => h.id === "exile")).toBe(false);
  });

  it("keeps hirelings with no corresponding faction regardless of the lineup", () => {
    const eligible = eligibleHirelings(ALL_OWNED, new Set(HIRELINGS.flatMap((h) => h.lockedFactionIds)));
    expect(eligible.map((h) => h.id).sort()).toEqual(
      ["popular-band", "highway-bandits", "furious-protector", "prosperous-farmers"].sort(),
    );
  });
});

describe("drawHirelings", () => {
  it("deals at most 3, only from eligible hirelings", () => {
    const { picks, eligibleCount } = drawHirelings(ALL_OWNED, new Set(), 4);
    expect(picks).toHaveLength(3);
    expect(eligibleCount).toBe(HIRELINGS.length);
    const eligibleIds = new Set(HIRELINGS.map((h) => h.id));
    picks.forEach((p) => expect(eligibleIds.has(p.hireling.id)).toBe(true));
    expect(new Set(picks.map((p) => p.hireling.id)).size).toBe(3); // no duplicates
  });

  it("deals fewer than 3 when fewer are eligible", () => {
    const owned = new Set(["exile", "popular-band"]);
    const { picks, eligibleCount } = drawHirelings(owned, new Set(), 4);
    expect(eligibleCount).toBe(2);
    expect(picks).toHaveLength(2);
  });

  it("deals none when nothing is eligible", () => {
    const { picks, eligibleCount } = drawHirelings(new Set(), new Set(), 4);
    expect(picks).toHaveLength(0);
    expect(eligibleCount).toBe(0);
  });

  it("demotes exactly demoteCount(playerCount) of the dealt hirelings", () => {
    for (const playerCount of [2, 3, 4, 5, 6]) {
      const { picks } = drawHirelings(ALL_OWNED, new Set(), playerCount);
      const demoted = picks.filter((p) => p.demoted).length;
      expect(demoted).toBe(Math.min(demoteCount(playerCount), picks.length));
    }
  });
});
