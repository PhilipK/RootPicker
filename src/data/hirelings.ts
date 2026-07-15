export type HirelingPackId = "box" | "marauder" | "riverfolk" | "underworld" | "homeland";

export interface Hireling {
  id: string;
  /** front (non-demoted) side */
  promoted: string;
  /** back side, marked "D" (Law A.6.2) */
  demoted: string;
  pack: HirelingPackId;
  /** faction ids barred from the game while this hireling is dealt in (Law A.6.5) */
  lockedFactionIds: string[];
}

export const HIRELING_PACKS: { id: HirelingPackId; label: string }[] = [
  { id: "box", label: "Hireling Box" },
  { id: "marauder", label: "Marauder Hirelings Pack" },
  { id: "riverfolk", label: "Riverfolk Hirelings Pack" },
  { id: "underworld", label: "Underworld Hirelings Pack" },
  { id: "homeland", label: "Homeland Hirelings Pack" },
];

/** All 13 hireling cards across the base Hireling Box and the four themed
    packs. lockedFactionIds is empty for cards with no named counterpart in
    the Woodland (e.g. porcupine, deer) — they never bar a faction. */
export const HIRELINGS: Hireling[] = [
  { id: "exile", promoted: "The Exile", demoted: "The Brigand", pack: "box", lockedFactionIds: ["vagabond", "vagabond2", "knaves"] },
  { id: "vault-keepers", promoted: "Vault Keepers", demoted: "Badger Bodyguards", pack: "marauder", lockedFactionIds: ["keepers"] },
  { id: "flame-bearers", promoted: "Flame Bearers", demoted: "Rat Smugglers", pack: "marauder", lockedFactionIds: ["hundreds"] },
  { id: "popular-band", promoted: "Popular Band", demoted: "Street Band", pack: "marauder", lockedFactionIds: [] },
  { id: "riverfolk-flotilla", promoted: "Riverfolk Flotilla", demoted: "Otter Divers", pack: "riverfolk", lockedFactionIds: ["riverfolk"] },
  { id: "highway-bandits", promoted: "Highway Bandits", demoted: "Bandit Gangs", pack: "riverfolk", lockedFactionIds: [] },
  { id: "warm-sun-prophets", promoted: "Warm Sun Prophets", demoted: "Lizard Envoys", pack: "riverfolk", lockedFactionIds: ["lizard"] },
  { id: "sunward-expedition", promoted: "Sunward Expedition", demoted: "Mole Artisans", pack: "underworld", lockedFactionIds: ["duchy"] },
  { id: "furious-protector", promoted: "Furious Protector", demoted: "Stoic Protector", pack: "underworld", lockedFactionIds: [] },
  { id: "corvid-spies", promoted: "Corvid Spies", demoted: "Raven Sentries", pack: "underworld", lockedFactionIds: ["corvid"] },
  { id: "river-roamers", promoted: "River Roamers", demoted: "Frog Tinkers", pack: "homeland", lockedFactionIds: ["lilypad"] },
  { id: "sunny-advocates", promoted: "Sunny Advocates", demoted: "Bat Messengers", pack: "homeland", lockedFactionIds: ["twilight"] },
  { id: "prosperous-farmers", promoted: "Prosperous Farmers", demoted: "Struggling Farmers", pack: "homeland", lockedFactionIds: [] },
];

export const byHirelingId: Record<string, Hireling> = Object.fromEntries(HIRELINGS.map((h) => [h.id, h]));

export const DEFAULT_OWNED_HIRELING_IDS = HIRELINGS.map((h) => h.id);
