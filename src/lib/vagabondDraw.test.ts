import { describe, it, expect } from "vitest";
import { VAGABOND_CHARACTERS, DEFAULT_OWNED_VAGABOND_CHARACTER_IDS } from "../data/vagabondCharacters";
import { drawVagabondCharacters, eligibleVagabondCharacters } from "./vagabondDraw";

const ALL_OWNED = new Set(DEFAULT_OWNED_VAGABOND_CHARACTER_IDS);

describe("eligibleVagabondCharacters", () => {
  it("only returns owned characters", () => {
    const owned = new Set(["thief", "ronin"]);
    expect(eligibleVagabondCharacters(owned).map((c) => c.id).sort()).toEqual(["ronin", "thief"]);
  });
});

describe("drawVagabondCharacters", () => {
  it("draws the requested count, all distinct, all eligible", () => {
    const drawn = drawVagabondCharacters(ALL_OWNED, 2);
    expect(drawn).toHaveLength(2);
    expect(new Set(drawn.map((c) => c.id)).size).toBe(2);
    drawn.forEach((c) => expect(VAGABOND_CHARACTERS.some((x) => x.id === c.id)).toBe(true));
  });

  it("caps at the number of eligible characters", () => {
    const owned = new Set(["thief"]);
    expect(drawVagabondCharacters(owned, 2)).toHaveLength(1);
  });

  it("draws nothing when none are owned", () => {
    expect(drawVagabondCharacters(new Set(), 1)).toHaveLength(0);
  });
});
