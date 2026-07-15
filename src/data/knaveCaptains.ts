export interface KnaveCaptain {
  id: string;
  name: string;
}

/** All 12 Knave Captain cards (Law Appendix K), verified against
    cards.ledergames.com (tag:Captain). They ship as a complete set with the
    Homeland Expansion (same box as the Knaves faction itself), so unlike
    hirelings or Vagabond characters there's no per-card ownership gate —
    owning the Knaves faction already implies owning all 12. */
export const KNAVE_CAPTAINS: KnaveCaptain[] = [
  { id: "thief", name: "Thief" },
  { id: "tinker", name: "Tinker" },
  { id: "ranger", name: "Ranger" },
  { id: "vagrant", name: "Vagrant" },
  { id: "arbiter", name: "Arbiter" },
  { id: "scoundrel", name: "Scoundrel" },
  { id: "adventurer", name: "Adventurer" },
  { id: "harrier", name: "Harrier" },
  { id: "ronin", name: "Ronin" },
  { id: "cheat", name: "Cheat" },
  { id: "gladiator", name: "Gladiator" },
  { id: "jailor", name: "Jailor" },
];

export const byKnaveCaptainId: Record<string, KnaveCaptain> = Object.fromEntries(
  KNAVE_CAPTAINS.map((c) => [c.id, c]),
);

export function knaveCaptainImageSrc(c: KnaveCaptain): string {
  return `assets/knave-captains/${c.id}.webp`;
}

export function knaveCaptainCardSearchUrl(name: string): string {
  return `https://cards.ledergames.com/search?q=${encodeURIComponent(`Knave Captain ${name}`)}`;
}
