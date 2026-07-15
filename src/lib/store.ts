import { useCallback, useEffect, useState } from "react";
import { DEFAULT_OWNED_IDS } from "../data/factions";
import { DEFAULT_OWNED_HIRELING_IDS } from "../data/hirelings";
import { MAX_RAFFLE_TICKETS, MIN_RAFFLE_TICKETS } from "./raffle";
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
  "potluck",
  "trade",
  "raffle",
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

export function useOwnedHirelingIds(): [Set<string>, (v: Set<string>) => void] {
  return usePersistedSet("rootpicker.ownedHirelingIds", DEFAULT_OWNED_HIRELING_IDS);
}

export interface StoredHirelingPick {
  id: string;
  demoted: boolean;
}

export interface StoredHirelingDraw {
  /** identifies the inputs this draw was made from — a mismatch means the
      table's picks (or owned packs) changed since, so the draw is stale. */
  fingerprint: string;
  picks: StoredHirelingPick[];
  eligibleCount: number;
}

/** One draw per mode ("simple", "draft", "raffle", etc.) — a distinct key per
    caller, so finishing one mode never clobbers another's in-progress draw. */
export function useHirelingDraw(modeKey: string): [StoredHirelingDraw | null, (v: StoredHirelingDraw | null) => void] {
  return useLocalStorage<StoredHirelingDraw | null>(`rootpicker.hirelings.${modeKey}`, null);
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

/** Raffle ticket budget per player. `null` means "no override yet" — the
    caller defaults it to the current player count, so a fresh install scales
    with the table instead of shipping a fixed guess. Once set, it's an
    explicit override and stays put even if player count changes later. */
export function useRaffleTicketCountOverride(): [number | null, (v: number | null) => void] {
  const [v, setV] = useLocalStorage<number | null>("rootpicker.raffleTicketCount", null);
  const clamp = (n: number) => Math.min(MAX_RAFFLE_TICKETS, Math.max(MIN_RAFFLE_TICKETS, n));
  return [v === null ? null : clamp(v), (n: number | null) => setV(n === null ? null : clamp(n))];
}

export function useExplainerOpen(id: string): [boolean, (v: boolean) => void] {
  return useLocalStorage<boolean>(`rootpicker.explainerOpen.${id}`, true);
}

/**
 * URL hash convention: "home" is the empty hash (no fragment at all), every
 * other mode is `#<modeId>` (e.g. `#draft`). An empty hash is preferred over
 * `#home` so a fresh visit / the settled-at-home state doesn't leave a
 * fragment in the address bar; `#home` is still accepted when read, in case
 * someone bookmarks or shares it, so it round-trips through isActiveMode.
 */
function hashToMode(): ActiveMode | null {
  const raw = window.location.hash.replace(/^#/, "");
  if (raw === "") return null; // no hash present — caller falls back to storage/home
  return isActiveMode(raw) ? raw : null;
}

function modeToHash(mode: ActiveMode): string {
  return mode === "home" ? "" : `#${mode}`;
}

/** history.state tag written on every entry this hook pushes, so we can later
 *  tell whether the CURRENT entry is one of ours (see `set` below). */
interface NavState {
  rootpicker: true;
}

function hasAppNavState(): boolean {
  const s = window.history.state as NavState | null;
  return !!s && s.rootpicker === true;
}

export function useActiveMode(): [ActiveMode, (v: ActiveMode) => void] {
  // First-time visitors (no stored value) land on "home". Legacy stored values
  // like "simple" are still honored, so a reload mid-mode returns to that mode.
  const [stored, setStored] = useLocalStorage<ActiveMode>("rootpicker.mode", "home");

  // A hash present on load wins (deep link); otherwise fall back to whatever
  // was persisted from the last session.
  const [mode, setModeState] = useState<ActiveMode>(() => hashToMode() ?? (isActiveMode(stored) ? stored : "home"));

  // Keep the rendered mode (and its own localStorage mirror) in sync with the
  // physical back/forward buttons and any other same-document hash change
  // (including the ones `set` itself triggers below — updating from the hash
  // is idempotent, so there's no harm reacting to our own writes too).
  useEffect(() => {
    function onHashChange() {
      const next = hashToMode() ?? "home";
      setModeState(next);
      setStored(next);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A session resumed from localStorage (no hash, or a stale one) should
  // still get a URL that matches where it landed — but this is a page load,
  // not a navigation, so use replaceState rather than pushing a new entry.
  useEffect(() => {
    const targetHash = modeToHash(mode);
    if (window.location.hash !== targetHash) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}${targetHash}`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback(
    (next: ActiveMode) => {
      const targetHash = modeToHash(next);
      if (window.location.hash === targetHash) return; // already there

      if (next === "home" && hasAppNavState()) {
        // The entry we're leaving was itself pushed by this hook (i.e. we
        // got here via an in-app navigation, not a fresh deep link), so a
        // real "back" is guaranteed to stay inside the app — and, because
        // this hook only ever pushes mode entries on top of a home entry,
        // it's guaranteed to land back on "home". Preferring it over a
        // fresh push means the resulting history no longer has this mode
        // sitting directly below "home", so a later physical back press
        // won't immediately re-enter the mode the user just left.
        //
        // `history.back()` itself resolves asynchronously (its popstate/
        // hashchange fire on a later task), so update state here rather
        // than waiting on the hashchange listener above — otherwise the
        // UI would lag a tick behind the button press.
        setModeState("home");
        setStored("home");
        window.history.back();
        return;
      }

      setModeState(next);
      setStored(next);
      window.location.hash = targetHash; // pushes a new, navigable history entry
      // Tag the entry we just pushed so a future "back to home" from here
      // (or from a mode reached beyond it) knows it can safely unwind.
      window.history.replaceState({ rootpicker: true } satisfies NavState, "", window.location.href);
    },
    [setStored],
  );

  return [mode, set];
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
