export type FactionType = "militant" | "insurgent";

export interface Faction {
  id: string;
  name: string;
  reach: number;
  type: FactionType;
  corner: boolean;
  /** difficulty: 1 = easiest to learn/play, 13 = hardest (Philip's ranking) */
  difficulty: number;
  /** shares art/id with another faction (Second Vagabond reuses "vagabond") */
  img?: string;
  dealNote?: string;
}

export type ModeId =
  | "simple"
  | "draft"
  | "hand"
  | "fav"
  | "cut"
  | "auction"
  | "tt"
  | "wish"
  | "settings";

export type Tier = "new" | "comfortable" | "expert";

export interface TieredPlayer {
  name: string;
  tier: Tier;
}
