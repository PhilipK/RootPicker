export type VagabondCharacterPackId = "base" | "riverfolk" | "vagabondPack" | "homeland";

export interface VagabondCharacter {
  id: string;
  name: string;
  pack: VagabondCharacterPackId;
}

export const VAGABOND_CHARACTER_PACKS: { id: VagabondCharacterPackId; label: string }[] = [
  { id: "base", label: "Base Root" },
  { id: "riverfolk", label: "Riverfolk Expansion" },
  { id: "vagabondPack", label: "Vagabond Pack" },
  { id: "homeland", label: "Homeland Expansion" },
];

/** All 12 Vagabond character cards (Law Appendix V), verified against
    cards.ledergames.com (tag:Vagabond). */
export const VAGABOND_CHARACTERS: VagabondCharacter[] = [
  { id: "thief", name: "Thief", pack: "base" },
  { id: "tinker", name: "Tinker", pack: "base" },
  { id: "ranger", name: "Ranger", pack: "base" },
  { id: "vagrant", name: "Vagrant", pack: "riverfolk" },
  { id: "arbiter", name: "Arbiter", pack: "riverfolk" },
  { id: "scoundrel", name: "Scoundrel", pack: "riverfolk" },
  { id: "adventurer", name: "Adventurer", pack: "vagabondPack" },
  { id: "harrier", name: "Harrier", pack: "vagabondPack" },
  { id: "ronin", name: "Ronin", pack: "vagabondPack" },
  { id: "cheat", name: "Cheat", pack: "homeland" },
  { id: "gladiator", name: "Gladiator", pack: "homeland" },
  { id: "jailor", name: "Jailor", pack: "homeland" },
];

export const byVagabondCharacterId: Record<string, VagabondCharacter> = Object.fromEntries(
  VAGABOND_CHARACTERS.map((c) => [c.id, c]),
);

export const DEFAULT_OWNED_VAGABOND_CHARACTER_IDS = VAGABOND_CHARACTERS.map((c) => c.id);

export function vagabondCharacterImageSrc(c: VagabondCharacter): string {
  return `assets/vagabond/${c.id}.webp`;
}

export function vagabondCharacterCardSearchUrl(name: string): string {
  return `https://cards.ledergames.com/search?q=${encodeURIComponent(name)}`;
}
