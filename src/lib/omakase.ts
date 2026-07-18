import type { Faction } from "../types";
import { bitmaskAssignBy, combinations } from "./wish";

/** A player's mood, dialed 1–5 on three axes. No faction names are ever
    shown while these are being set — see OmakaseMode's slide phase. */
export interface OmakasePlayer {
  name: string;
  aggression: number;
  footprint: number;
  complexity: number;
}

export const SLIDER_MIN = 1;
export const SLIDER_MAX = 5;
export const SLIDER_DEFAULT = 3;

export type OmakaseAxis = "aggression" | "footprint" | "complexity";

/** `difficulty` (1–13, Teaching Tiers' ranking) linearly rescaled to the same
    1–5 range as aggression/footprint, so all three axes are commensurate for
    distance scoring. Kept as a float (not rounded) for finer-grained fit. */
export function normalizedComplexity(f: Faction): number {
  return 1 + ((f.difficulty - 1) * (SLIDER_MAX - SLIDER_MIN)) / 12;
}

/** Manhattan distance between a player's dialed mood and a faction's actual
    profile, across all three axes. 0 = perfect match; worst case (opposite
    ends of all three 1–5 axes) is 12. */
export function factionDistance(player: OmakasePlayer, faction: Faction): number {
  return (
    Math.abs(player.aggression - faction.aggression) +
    Math.abs(player.footprint - faction.footprint) +
    Math.abs(player.complexity - normalizedComplexity(faction))
  );
}

export interface OmakaseAssignment {
  subset: Faction[];
  /** faction id per player index, in seat order */
  assign: string[];
  /** factionDistance(players[i], the faction assign[i] resolves to), per seat */
  distances: number[];
  totalDistance: number;
  /** summed reach of the seated lineup */
  total: number;
}

/** Try every reach-safe faction subset of the right size (same exhaustive
    search as `findBestWishAssignment`), solve each one's best pairing via the
    shared `bitmaskAssignBy` DP with a slider-distance score, and keep a
    random pick among whichever legal subsets minimize total distance.
    Legality is a hard filter applied before any distance is scored — a
    closer-fitting but illegal subset never enters the running. Second
    Vagabond is always excluded, matching every other picker mode. */
export function findBestOmakaseAssignment(
  players: OmakasePlayer[],
  pool: Faction[],
  target: number,
  random: () => number = Math.random,
): OmakaseAssignment | null {
  const N = players.length;
  const cleanPool = pool.filter((f) => f.id !== "vagabond2");
  const candidates: OmakaseAssignment[] = [];
  for (const subset of combinations(cleanPool, N)) {
    if (subset.some((f) => f.id === "vagabond") && subset.some((f) => f.id === "knaves")) continue;
    const total = subset.reduce((s, f) => s + f.reach, 0);
    if (total < target) continue;
    const result = bitmaskAssignBy(subset, N, (p, f) => -factionDistance(players[p], f));
    if (!result) continue;
    const assign = result.assign.map((i) => subset[i].id);
    const distances = players.map((pl, i) => factionDistance(pl, subset[result.assign[i]]));
    const totalDistance = distances.reduce((s, d) => s + d, 0);
    candidates.push({ subset, assign, distances, totalDistance, total });
  }
  if (!candidates.length) return null;
  const minDistance = Math.min(...candidates.map((c) => c.totalDistance));
  const bestOnes = candidates.filter((c) => c.totalDistance === minDistance);
  return bestOnes[Math.floor(random() * bestOnes.length)];
}

export type FitBand = "spot-on" | "close" | "workable" | "stretch";

/** Bands total slider distance (0–12) into four honest buckets. Deterministic
    off the actual number, not randomized, so a page refresh never flips
    someone's justification to a different verdict of the same plate. */
export function fitBand(distance: number): FitBand {
  if (distance <= 2) return "spot-on";
  if (distance <= 5) return "close";
  if (distance <= 8) return "workable";
  return "stretch";
}

/** Hand-written one-line justifications, banded by fit — NOT prose generated
    from the numbers. Two fragments per band so a table with several plates
    in the same band doesn't read like a form letter; the pick is
    deterministic (keyed off the distance itself) rather than randomized. The
    "workable"/"stretch" bands say plainly that the table's legality (reach
    target, A.8.1) came first and the fit is a compromise, not a hidden one. */
export const FIT_FRAGMENTS: Record<FitBand, string[]> = {
  "spot-on": [
    "this plate sits right where you set every dial.",
    "this plate matches the mood you dialed in almost exactly.",
  ],
  close: [
    "this plate is a close match for what you asked for.",
    "this plate leans the way you wanted, give or take a notch.",
  ],
  workable: [
    "this plate isn't a perfect match, but it's a fair compromise for the table.",
    "this plate meets you partway — the lineup's legality came first, and some dials had to give.",
  ],
  stretch: [
    "this plate is a stretch from what you dialed in — the table's reach requirement outweighed your fit.",
    "this plate is further from your sliders than we'd like; balancing everyone at once meant yours gave the most ground.",
  ],
};

/** Picks one of the two fragments for a band, deterministically, so the same
    distance always reads the same way for a given player. */
export function plateLine(distance: number): string {
  const band = fitBand(distance);
  const options = FIT_FRAGMENTS[band];
  return options[Math.round(distance * 10) % options.length];
}
