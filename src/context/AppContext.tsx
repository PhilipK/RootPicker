import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Faction, Tier } from "../types";
import { availableFactions as computeAvailableFactions, effTarget as computeEffTarget } from "../lib/reach";
import {
  useAdventurous,
  useOwnedFactionIds,
  usePlayerCount,
  usePlayerNames,
  useTierAssignments,
  useViewMode,
  useWishCount,
} from "../lib/store";

interface AppContextValue {
  playerCount: number;
  setPlayerCount: (n: number) => void;
  names: string[];
  setNames: (v: string[]) => void;
  playerNames: () => string[];
  ownedIds: Set<string>;
  setOwnedIds: (v: Set<string>) => void;
  availableFactions: Faction[];
  wishCount: number;
  setWishCount: (n: number) => void;
  adventurous: boolean;
  setAdventurous: (v: boolean) => void;
  effTarget: number;
  viewMode: "grid" | "list";
  setViewMode: (v: "grid" | "list") => void;
  tiers: Tier[];
  setTiers: (v: Tier[]) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [playerCount, setPlayerCount] = usePlayerCount();
  const [names, setNames] = usePlayerNames();
  const [ownedIds, setOwnedIds] = useOwnedFactionIds();
  const [wishCount, setWishCount] = useWishCount();
  const [adventurous, setAdventurous] = useAdventurous();
  const [viewMode, setViewMode] = useViewMode();
  const [tiers, setTiers] = useTierAssignments();

  const availableFactions = useMemo(() => computeAvailableFactions(ownedIds), [ownedIds]);
  const effTarget = computeEffTarget(playerCount, adventurous);

  const playerNames = () =>
    Array.from({ length: playerCount }, (_, i) => (names[i] || "").trim() || `Player ${i + 1}`);

  const value: AppContextValue = {
    playerCount,
    setPlayerCount,
    names,
    setNames,
    playerNames,
    ownedIds,
    setOwnedIds,
    availableFactions,
    wishCount,
    setWishCount,
    adventurous,
    setAdventurous,
    effTarget,
    viewMode,
    setViewMode,
    tiers,
    setTiers,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
