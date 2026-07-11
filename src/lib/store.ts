import { useCallback, useState } from "react";
import { DEFAULT_OWNED_IDS } from "../data/factions";
import type { Tier } from "../types";

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
