import { VAGABOND_CHARACTERS, type VagabondCharacter } from "../data/vagabondCharacters";
import { shuffleArr } from "./shuffle";

export function eligibleVagabondCharacters(ownedIds: Set<string>): VagabondCharacter[] {
  return VAGABOND_CHARACTERS.filter((c) => ownedIds.has(c.id));
}

/** Draws `count` distinct random characters — one per Vagabond board in play. */
export function drawVagabondCharacters(ownedIds: Set<string>, count: number): VagabondCharacter[] {
  return shuffleArr([...eligibleVagabondCharacters(ownedIds)]).slice(0, count);
}
