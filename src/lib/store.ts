import { useCallback, useState } from "react";
import { DEFAULT_OWNED_IDS } from "../data/factions";
import type { ModeId, Tier } from "../types";

const MODE_IDS: ModeId[] = [
  "simple",
  "draft",
  "hand",
  "fav",
  "cut",
  "auction",
  "bounty",
  "tt",
  "wish",
  "settings",
];

function isModeId(v: unknown): v is ModeId {
  return typeof v === "string" && (MODE_IDS as string[]).includes(v);
}

/** "home" is the landing / mode-select screen; not a real mode, so it lives outside ModeId. */
export type ActiveMode = ModeId | "home";

function isActiveMode(v: unknown): v is ActiveMode {
  return v === "home" || isModeId(v);
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useLocalStorage<T>(key: string, fallback: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readStorage(key, fallback));
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (prev: T) => T)(prev) : v;
        window.localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    },
    [key],
  );
  return [value, set];
}

export function usePlayerCount(): [number, (v: number) => void] {
  const [v, setV] = useLocalStorage("rootpicker.playerCount", 4);
  const clamp = (n: number) => Math.min(6, Math.max(2, n));
  return [clamp(v), (n: number) => setV(clamp(n))];
}

export function usePlayerNames(): [string[], (v: string[]) => void] {
  return useLocalStorage<string[]>("rootpicker.playerNames", []);
}

export function usePersistedSet(
  key: string,
  fallback: string[] = [],
): [Set<string>, (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void] {
  const [arr, setArr] = useLocalStorage<string[]>(key, fallback);
  const set = (v: Set<string> | ((prev: Set<string>) => Set<string>)) =>
    setArr((prevArr) => {
      const next = typeof v === "function" ? v(new Set(prevArr)) : v;
      return [...next];
    });
  return [new Set(arr), set];
}

export function useOwnedFactionIds(): [Set<string>, (v: Set<string>) => void] {
  return usePersistedSet("rootpicker.ownedFactionIds", DEFAULT_OWNED_IDS);
}

export function useWishCount(): [number, (v: number) => void] {
  const [v, setV] = useLocalStorage("rootpicker.wishCount", 3);
  const clamp = (n: number) => Math.min(5, Math.max(1, n));
  return [clamp(v), (n: number) => setV(clamp(n))];
}

export function useAdventurous(): [boolean, (v: boolean) => void] {
  return useLocalStorage<boolean>("rootpicker.adventurous", false);
}

export function useViewMode(): ["grid" | "list", (v: "grid" | "list") => void] {
  return useLocalStorage<"grid" | "list">("rootpicker.viewMode", "grid");
}

export function useTierAssignments(): [Tier[], (v: Tier[]) => void] {
  return useLocalStorage<Tier[]>("rootpicker.tiers", []);
}

export function useExplainerOpen(id: string): [boolean, (v: boolean) => void] {
  return useLocalStorage<boolean>(`rootpicker.explainerOpen.${id}`, true);
}

export function useActiveMode(): [ActiveMode, (v: ActiveMode) => void] {
  // First-time visitors (no stored value) land on "home". Legacy stored values
  // like "simple" are still honored, so a reload mid-mode returns to that mode.
  const [v, setV] = useLocalStorage<ActiveMode>("rootpicker.mode", "home");
  return [isActiveMode(v) ? v : "home", setV];
}

/**
 * Cheap best-effort check of whether a mode has a session in progress, read
 * straight from its persisted localStorage key. Simple mode stores an array of
 * chosen faction ids; every reducer mode stores an object whose `phase` starts
 * at "setup". Anything past that counts as in progress.
 */
export function modeHasProgress(mode: ModeId): boolean {
  if (mode === "settings") return false;
  try {
    const raw = window.localStorage.getItem(`rootpicker.session.${mode}`);
    if (raw === null) return false;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (parsed && typeof parsed === "object" && "phase" in parsed) {
      return (parsed as { phase: unknown }).phase !== "setup";
    }
    return false;
  } catch {
    return false;
  }
}
