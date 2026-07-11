import type { Faction } from "../types";

/* difficulty: 1 = easiest to learn/play, 13 = hardest (Philip's ranking) */
export const FACTIONS: Faction[] = [
  { id: "marquise", name: "Marquise de Cat", reach: 10, type: "militant", corner: true, difficulty: 1 },
  { id: "hundreds", name: "Lord of the Hundreds", reach: 9, type: "militant", corner: true, difficulty: 2 },
  { id: "eyrie", name: "Eyrie Dynasties", reach: 7, type: "militant", corner: true, difficulty: 3 },
  { id: "duchy", name: "Underground Duchy", reach: 8, type: "militant", corner: true, difficulty: 5 },
  { id: "keepers", name: "Keepers in Iron", reach: 8, type: "militant", corner: true, difficulty: 6 },
  { id: "lilypad", name: "Lilypad Diaspora", reach: 7, type: "militant", corner: false, difficulty: 7 },
  { id: "riverfolk", name: "Riverfolk Company", reach: 5, type: "insurgent", corner: false, difficulty: 8 },
  {
    id: "vagabond", name: "Vagabond", reach: 5, type: "insurgent", corner: false, difficulty: 4,
    dealNote: "Deal 1 random character card next to it (A.8.2.III)",
  },
  {
    id: "knaves", name: "Knaves of the Deepwood", reach: 4, type: "insurgent", corner: false, difficulty: 9,
    dealNote: "Deal 4 random Captain cards next to it; choose 3 in setup (A.8.2.IV)",
  },
  { id: "twilight", name: "Twilight Council", reach: 4, type: "insurgent", corner: true, difficulty: 10 },
  { id: "woodland", name: "Woodland Alliance", reach: 3, type: "insurgent", corner: false, difficulty: 11 },
  { id: "corvid", name: "Corvid Conspiracy", reach: 3, type: "insurgent", corner: false, difficulty: 12 },
  { id: "lizard", name: "The Lizard Cult", reach: 2, type: "insurgent", corner: true, difficulty: 13 },
  {
    id: "vagabond2", name: "Second Vagabond", reach: 2, type: "insurgent", corner: false, img: "vagabond", difficulty: 4,
    dealNote: "Deal 1 random character card next to it (A.8.2.III)",
  },
];

export const byId: Record<string, Faction> = Object.fromEntries(FACTIONS.map((f) => [f.id, f]));

export const imgSrc = (f: Faction) => `assets/factions/${f.img ?? f.id}.png`;

/** Recommended reach total by player count (Law 5.2). */
export const REACH_TARGET: Record<number, number> = { 2: 17, 3: 18, 4: 21, 5: 25, 6: 28 };

export const TRACK_MAX = 32;

export const DEFAULT_OWNED_IDS = FACTIONS.filter((f) => f.id !== "vagabond2").map((f) => f.id);
