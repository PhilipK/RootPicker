import type { Faction } from "../types";

/* difficulty: 1 = easiest to learn/play, 13 = hardest (Philip's ranking)
   aggression/footprint: 1–5, added for Omakase mode's mood sliders (Philip's
   ranking — judgment calls, not from the Law; aggression is "how much this
   faction wants to fight", footprint is "how much of the board it touches"). */
export const FACTIONS: Faction[] = [
  { id: "marquise", name: "Marquise de Cat", reach: 10, type: "militant", corner: true, difficulty: 1,
    aggression: 4, footprint: 5,
    flavor: "The forest belongs to the industrious." },
  { id: "hundreds", name: "Lord of the Hundreds", reach: 9, type: "militant", corner: true, difficulty: 2,
    aggression: 5, footprint: 5,
    flavor: "More. Always more." },
  { id: "eyrie", name: "Eyrie Dynasties", reach: 7, type: "militant", corner: true, difficulty: 3,
    aggression: 4, footprint: 4,
    flavor: "The Decree must be obeyed." },
  { id: "duchy", name: "Underground Duchy", reach: 8, type: "militant", corner: true, difficulty: 5,
    aggression: 3, footprint: 5,
    flavor: "Dig deep, stand tall." },
  { id: "keepers", name: "Keepers in Iron", reach: 8, type: "militant", corner: true, difficulty: 6,
    aggression: 4, footprint: 4,
    flavor: "The relics must go home." },
  { id: "lilypad", name: "Lilypad Diaspora", reach: 7, type: "militant", corner: false, difficulty: 7,
    aggression: 3, footprint: 3,
    flavor: "New waters will be home." },
  { id: "riverfolk", name: "Riverfolk Company", reach: 5, type: "insurgent", corner: false, difficulty: 8,
    aggression: 1, footprint: 2,
    flavor: "Everything has a price." },
  {
    id: "vagabond", name: "Vagabond", reach: 5, type: "insurgent", corner: false, difficulty: 4,
    aggression: 3, footprint: 1,
    dealNote: "Deal 1 random character card next to it (A.8.2.III)",
    flavor: "No masters, no borders.",
  },
  {
    id: "knaves", name: "Knaves of the Deepwood", reach: 4, type: "insurgent", corner: false, difficulty: 9,
    aggression: 4, footprint: 3,
    dealNote: "Deal 4 random Captain cards next to it; choose 3 in setup (A.8.2.IV)",
    flavor: "Honor among thieves — for a cut.",
  },
  { id: "twilight", name: "Twilight Council", reach: 4, type: "insurgent", corner: true, difficulty: 10,
    aggression: 2, footprint: 3,
    flavor: "The council sees every path." },
  { id: "woodland", name: "Woodland Alliance", reach: 3, type: "insurgent", corner: false, difficulty: 11,
    aggression: 3, footprint: 4,
    flavor: "The people will rise." },
  { id: "corvid", name: "Corvid Conspiracy", reach: 3, type: "insurgent", corner: false, difficulty: 12,
    aggression: 2, footprint: 2,
    flavor: "Every shadow hides a plot." },
  { id: "lizard", name: "The Lizard Cult", reach: 2, type: "insurgent", corner: true, difficulty: 13,
    aggression: 1, footprint: 2,
    flavor: "The outcasts shall be exalted." },
  {
    id: "vagabond2", name: "Second Vagabond", reach: 2, type: "insurgent", corner: false, img: "vagabond", difficulty: 4,
    aggression: 3, footprint: 1,
    dealNote: "Deal 1 random character card next to it (A.8.2.III)",
    flavor: "The woods are wide enough for two.",
  },
];

export const byId: Record<string, Faction> = Object.fromEntries(FACTIONS.map((f) => [f.id, f]));

export const imgSrc = (f: Faction) => `assets/factions/${f.img ?? f.id}.png`;

/** Recommended reach total by player count (Law 5.2). */
export const REACH_TARGET: Record<number, number> = { 2: 17, 3: 18, 4: 21, 5: 25, 6: 28 };

export const TRACK_MAX = 32;

export const DEFAULT_OWNED_IDS = FACTIONS.filter((f) => f.id !== "vagabond2").map((f) => f.id);
