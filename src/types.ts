export type FactionType = "militant" | "insurgent";

export interface Faction {
  id: string;
  name: string;
  reach: number;
  type: FactionType;
  corner: boolean;
  /** difficulty: 1 = easiest to learn/play, 13 = hardest (Philip's ranking) */
  difficulty: number;
  /** aggression: 1 = peaceful/reactive, 5 = built to make war (Philip's ranking) */
  aggression: number;
  /** footprint: 1 = compact/single-token presence, 5 = sprawls across the whole board (Philip's ranking) */
  footprint: number;
  /** shares art/id with another faction (Second Vagabond reuses "vagabond") */
  img?: string;
  dealNote?: string;
  /** one-line battle cry shown on the reveal ceremony card */
  flavor?: string;
}

export type ModeId =
  | "simple"
  | "draft"
  | "hand"
  | "fav"
  | "cut"
  | "auction"
  | "bounty"
  | "tt"
  | "wish"
  | "potluck"
  | "trade"
  | "raffle"
  | "omakase"
  | "settings";

export type Tier = "new" | "comfortable" | "expert";

export interface TieredPlayer {
  name: string;
  tier: Tier;
}
