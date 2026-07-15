import { describe, it, expect } from "vitest";
import { KNAVE_CAPTAINS } from "../data/knaveCaptains";
import { drawKnaveCaptains } from "./knaveCaptainDraw";

describe("drawKnaveCaptains", () => {
  it("deals 4 distinct captains from the full set of 12", () => {
    const dealt = drawKnaveCaptains();
    expect(dealt).toHaveLength(4);
    expect(new Set(dealt.map((c) => c.id)).size).toBe(4);
    dealt.forEach((c) => expect(KNAVE_CAPTAINS.some((x) => x.id === c.id)).toBe(true));
  });
});
