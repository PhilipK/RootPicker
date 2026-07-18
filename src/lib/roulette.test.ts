import { describe, it, expect } from "vitest";
import { FACTIONS, REACH_TARGET, byId } from "../data/factions";
import { hasLegalLineup, legalLineups, spinLineup, vetoBlockReason } from "./roulette";

const POOL = FACTIONS.filter((f) => f.id !== "vagabond2");
const T4 = REACH_TARGET[4]; // 21

describe("spinLineup", () => {
  it("always returns a legal, full-size lineup drawn from the pool", () => {
    for (let i = 0; i < 50; i++) {
      const lineup = spinLineup(POOL, 4, T4);
      expect(lineup).not.toBeNull();
      const ids = lineup!;
      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(4); // no duplicates
      for (const id of ids) expect(POOL.some((f) => f.id === id)).toBe(true);
      const total = ids.reduce((s, id) => s + byId[id].reach, 0);
      expect(total).toBeGreaterThanOrEqual(T4);
    }
  });

  it("never fields the Vagabond and the Knaves together (A.8.1)", () => {
    for (let i = 0; i < 50; i++) {
      const lineup = spinLineup(POOL, 4, T4)!;
      expect(lineup.includes("vagabond") && lineup.includes("knaves")).toBe(false);
    }
  });

  it("excludes the Second Vagabond even if it sneaks into the pool", () => {
    const poolWithSecond = [...POOL, byId.vagabond2];
    for (let i = 0; i < 50; i++) {
      const lineup = spinLineup(poolWithSecond, 4, T4)!;
      expect(lineup).not.toContain("vagabond2");
    }
  });

  it("returns null when the pool cannot reach the target for this player count", () => {
    const weak = POOL.filter((f) => ["lizard", "corvid", "woodland", "twilight"].includes(f.id)); // 2+3+3+4=12 < 21
    expect(spinLineup(weak, 4, T4)).toBeNull();
  });
});

describe("legalLineups / hasLegalLineup", () => {
  it("agrees on existence", () => {
    expect(hasLegalLineup(POOL, 4, T4)).toBe(true);
    expect(legalLineups(POOL, 4, T4).length).toBeGreaterThan(0);
  });

  it("finds no legal lineup once the pool is too weak", () => {
    const weak = POOL.filter((f) => ["lizard", "corvid", "woodland", "twilight"].includes(f.id));
    expect(hasLegalLineup(weak, 4, T4)).toBe(false);
    expect(legalLineups(weak, 4, T4)).toEqual([]);
  });
});

describe("vetoBlockReason", () => {
  it("allows a veto that still leaves a legal lineup", () => {
    // Full 13-faction pool at 4 players has plenty of slack.
    expect(vetoBlockReason(POOL, new Set(), "marquise", 4, T4)).toBeNull();
  });

  it("blocks a veto that would leave no legal lineup for the table", () => {
    // 6-faction pool, 2 slack over playerCount 4. Reach: marquise 10,
    // hundreds 9, lizard 2, corvid 3, woodland 3, twilight 4. The best
    // 4-subset that excludes marquise is hundreds+twilight+woodland+corvid =
    // 19 < 21, so every legal lineup here needs marquise.
    const pool = POOL.filter((f) =>
      ["marquise", "hundreds", "lizard", "corvid", "woodland", "twilight"].includes(f.id),
    );
    expect(hasLegalLineup(pool, 4, T4)).toBe(true); // marquise+hundreds+twilight+woodland = 26
    expect(vetoBlockReason(pool, new Set(), "marquise", 4, T4)).not.toBeNull();
    // A non-load-bearing faction is still safe to veto.
    expect(vetoBlockReason(pool, new Set(), "lizard", 4, T4)).toBeNull();
  });

  it("accounts for factions already exiled this session", () => {
    // Same 6-faction pool; lizard and corvid already exiled leaves exactly
    // playerCount (4) factions — marquise, hundreds, woodland, twilight —
    // which is already the only possible lineup. Vetoing a fifth would drop
    // the pool below playerCount entirely, so it must be blocked regardless
    // of reach math.
    const pool = POOL.filter((f) =>
      ["marquise", "hundreds", "lizard", "corvid", "woodland", "twilight"].includes(f.id),
    );
    const alreadyExiled = new Set(["lizard", "corvid"]);
    expect(hasLegalLineup(pool.filter((f) => !alreadyExiled.has(f.id)), 4, T4)).toBe(true);
    const reason = vetoBlockReason(pool, alreadyExiled, "twilight", 4, T4);
    expect(reason).not.toBeNull();
  });
});
