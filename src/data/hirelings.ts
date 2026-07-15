export type HirelingPackId = "marauder" | "riverfolk" | "underworld" | "homeland";

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

/** Real card art, downloaded from cards.ledergames.com and bundled locally
    (public/assets/hirelings) so it works offline like the faction art. Direct
    links to a card's own page 404 at that site's CDN edge for a fresh/direct
    hit — confirmed even for known-good ids — so this links to the site's own
    search instead, which is a real top-level route (always resolves). */
export function hirelingCardSearchUrl(cardName: string): string {
  return `https://cards.ledergames.com/search?q=${encodeURIComponent(cardName)}`;
}

export function hirelingImageSrc(hireling: Hireling, demoted: boolean): string {
  return `assets/hirelings/${hireling.id}${demoted ? "-demoted" : ""}.webp`;
}

export const HIRELING_PACKS: { id: HirelingPackId; label: string }[] = [
  { id: "marauder", label: "Marauder Hirelings Pack & Hireling Box" },
  { id: "riverfolk", label: "Riverfolk Hirelings Pack" },
  { id: "underworld", label: "Underworld Hirelings Pack" },
  { id: "homeland", label: "Homeland Hirelings Pack" },
];

/** All 16 hireling cards, verified against cards.ledergames.com (tag:Hirelings,
    32 results = 16 pairs) — including 3 (Last Dynasty, Forest Patrol, Spring
    Uprising) that ship in the Marauder box but aren't mentioned on Leder's own
    product-page marketing copy for it. Pack membership and promoted/demoted
    pairing (art suffix -big/-small) both confirmed per-card from each card's
    own page, not just marketing text. */
export const HIRELINGS: Hireling[] = [
  { id: "exile", promoted: "The Exile", demoted: "The Brigand", pack: "marauder", lockedFactionIds: ["vagabond", "vagabond2", "knaves"] },
  { id: "vault-keepers", promoted: "Vault Keepers", demoted: "Badger Bodyguards", pack: "marauder", lockedFactionIds: ["keepers"] },
  { id: "flame-bearers", promoted: "Flame Bearers", demoted: "Rat Smugglers", pack: "marauder", lockedFactionIds: ["hundreds"] },
  { id: "popular-band", promoted: "Popular Band", demoted: "Street Band", pack: "marauder", lockedFactionIds: [] },
  { id: "last-dynasty", promoted: "Last Dynasty", demoted: "Bluebird Nobles", pack: "marauder", lockedFactionIds: ["eyrie"] },
  { id: "forest-patrol", promoted: "Forest Patrol", demoted: "Feline Physicians", pack: "marauder", lockedFactionIds: ["marquise"] },
  { id: "spring-uprising", promoted: "Spring Uprising", demoted: "Rabbit Scouts", pack: "marauder", lockedFactionIds: ["woodland"] },
  { id: "highway-bandits", promoted: "Highway Bandits", demoted: "Bandit Gangs", pack: "riverfolk", lockedFactionIds: [] },
  { id: "warm-sun-prophets", promoted: "Warm Sun Prophets", demoted: "Lizard Envoys", pack: "riverfolk", lockedFactionIds: ["lizard"] },
  { id: "riverfolk-flotilla", promoted: "Riverfolk Flotilla", demoted: "Otter Divers", pack: "riverfolk", lockedFactionIds: ["riverfolk"] },
  { id: "corvid-spies", promoted: "Corvid Spies", demoted: "Raven Sentries", pack: "underworld", lockedFactionIds: ["corvid"] },
  { id: "sunward-expedition", promoted: "Sunward Expedition", demoted: "Mole Artisans", pack: "underworld", lockedFactionIds: ["duchy"] },
  { id: "furious-protector", promoted: "Furious Protector", demoted: "Stoic Protector", pack: "underworld", lockedFactionIds: [] },
  { id: "sunny-advocates", promoted: "Sunny Advocates", demoted: "Bat Messengers", pack: "homeland", lockedFactionIds: ["twilight"] },
  { id: "river-roamers", promoted: "River Roamers", demoted: "Frog Tinkers", pack: "homeland", lockedFactionIds: ["lilypad"] },
  { id: "prosperous-farmers", promoted: "Prosperous Farmers", demoted: "Struggling Farmers", pack: "homeland", lockedFactionIds: [] },
];

export const byHirelingId: Record<string, Hireling> = Object.fromEntries(HIRELINGS.map((h) => [h.id, h]));

export const DEFAULT_OWNED_HIRELING_IDS = HIRELINGS.map((h) => h.id);
