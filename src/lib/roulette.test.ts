import { describe, it, expect } from "vitest";
import { FACTIONS, REACH_TARGET, byId } from "../data/factions";
import {
  drawReplacement,
  hasLegalLineup,
  legalLineups,
  nextUnspentSeat,
  replacementOptions,
  spinLineup,
  vetoBlockReason,
} from "./roulette";

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

describe("replacementOptions / drawReplacement (single-seat veto)", () => {
  // A concrete proposal: marquise 10 + eyrie 7 + duchy 8 + lizard 2 = 27.
  const lineup = ["marquise", "eyrie", "duchy", "lizard"];

  it("offers only factions outside the lineup and exile list, keeping the table legal", () => {
    const exiled = new Set(["corvid"]);
    const options = replacementOptions(POOL, exiled, lineup, "lizard", T4);
    expect(options.length).toBeGreaterThan(0);
    for (const f of options) {
      expect(lineup).not.toContain(f.id);
      expect(exiled.has(f.id)).toBe(false);
      expect(f.id).not.toBe("vagabond2");
      const kept = lineup.filter((id) => id !== "lizard");
      const total = [...kept, f.id].reduce((s, id) => s + byId[id].reach, 0);
      expect(total).toBeGreaterThanOrEqual(T4);
    }
  });

  it("keeps the other seats untouched — only the vetoed seat is in play", () => {
    // Vetoing lizard must never offer a swap that requires touching the
    // kept three; every option is judged against exactly those three.
    const options = replacementOptions(POOL, new Set(), lineup, "lizard", T4);
    // marquise+eyrie+duchy = 25 ≥ 21 already, so every non-lineup faction
    // except a Vagabond/Knaves conflict partner qualifies.
    const ids = options.map((f) => f.id).sort();
    const expected = POOL.filter((f) => !lineup.includes(f.id))
      .map((f) => f.id)
      .sort();
    expect(ids).toEqual(expected);
  });

  it("respects A.8.1 against the kept seats", () => {
    const withVagabond = ["vagabond", "marquise", "duchy", "lizard"]; // 5+10+8+2 = 25
    const options = replacementOptions(POOL, new Set(), withVagabond, "lizard", T4);
    expect(options.some((f) => f.id === "knaves")).toBe(false);
  });

  it("draws only from the legal options", () => {
    const exiled = new Set(["hundreds"]);
    for (let i = 0; i < 25; i++) {
      const id = drawReplacement(POOL, exiled, lineup, "lizard", T4);
      expect(id).not.toBeNull();
      expect(lineup).not.toContain(id!);
      expect(id).not.toBe("hundreds");
    }
  });
});

describe("vetoBlockReason", () => {
  it("allows a veto whose seat has a legal replacement", () => {
    expect(vetoBlockReason(POOL, new Set(), ["marquise", "eyrie", "duchy", "lizard"], "lizard", T4)).toBeNull();
  });

  it("blocks a veto when no faction could take the seat", () => {
    // Pool of exactly five: the lineup's four plus corvid (reach 3). Lineup
    // marquise+twilight+woodland+corvid... build: lineup uses marquise 10,
    // twilight 4, woodland 3, corvid 3 = 20 < 21 — not a valid fixture.
    // Instead: lineup marquise+hundreds+twilight+woodland = 26; pool adds
    // only lizard (reach 2). Vetoing marquise leaves 9+4+3+2 = 18 < 21 →
    // blocked; vetoing woodland leaves 10+9+4+2 = 25 → allowed.
    const pool = POOL.filter((f) =>
      ["marquise", "hundreds", "twilight", "woodland", "lizard"].includes(f.id),
    );
    const lineup = ["marquise", "hundreds", "twilight", "woodland"];
    expect(vetoBlockReason(pool, new Set(), lineup, "marquise", T4)).not.toBeNull();
    expect(vetoBlockReason(pool, new Set(), lineup, "woodland", T4)).toBeNull();
  });

  it("accounts for factions already exiled this session", () => {
    // Same five-faction pool, but lizard is already exiled: now NOTHING can
    // replace any seat, so every veto is blocked.
    const pool = POOL.filter((f) =>
      ["marquise", "hundreds", "twilight", "woodland", "lizard"].includes(f.id),
    );
    const lineup = ["marquise", "hundreds", "twilight", "woodland"];
    const exiled = new Set(["lizard"]);
    for (const id of lineup) {
      expect(vetoBlockReason(pool, exiled, lineup, id, T4)).not.toBeNull();
    }
  });
});

describe("nextUnspentSeat", () => {
  it("walks seat order, skipping spent vetoes", () => {
    expect(nextUnspentSeat([false, false, false], -1)).toBe(0);
    expect(nextUnspentSeat([true, false, false], -1)).toBe(1);
    expect(nextUnspentSeat([false, true, false], 0)).toBe(2);
    expect(nextUnspentSeat([false, true, true], 0)).toBe(-1);
    expect(nextUnspentSeat([true, true, true], -1)).toBe(-1);
  });
});
