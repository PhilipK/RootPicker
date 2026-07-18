import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Faction, Tier } from "../types";
import { availableFactions as computeAvailableFactions, effTarget as computeEffTarget } from "../lib/reach";
import {
  useAdventurous,
  useDutchRange,
  useDutchTickSeconds,
  useOwnedFactionIds,
  useOwnedHirelingIds,
  useOwnedVagabondCharacterIds,
  usePlayerCount,
  usePlayerNames,
  useRaffleTicketCountOverride,
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
  ownedHirelingIds: Set<string>;
  setOwnedHirelingIds: (v: Set<string>) => void;
  ownedVagabondCharacterIds: Set<string>;
  setOwnedVagabondCharacterIds: (v: Set<string>) => void;
  wishCount: number;
  setWishCount: (n: number) => void;
  adventurous: boolean;
  setAdventurous: (v: boolean) => void;
  effTarget: number;
  viewMode: "grid" | "list";
  setViewMode: (v: "grid" | "list") => void;
  tiers: Tier[];
  setTiers: (v: Tier[]) => void;
  /** Effective raffle ticket budget: the override once set, else the
      current player count. */
  raffleTicketCount: number;
  /** Whether that value is still tracking player count (no override yet). */
  raffleTicketCountIsAuto: boolean;
  setRaffleTicketCount: (n: number) => void;
  resetRaffleTicketCount: () => void;
  /** Dutch Flower Auction: the clock runs from −dutchRange to +dutchRange VP. */
  dutchRange: number;
  setDutchRange: (n: number) => void;
  /** Dutch Flower Auction: seconds between ticks of the clock. */
  dutchTickSeconds: number;
  setDutchTickSeconds: (n: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [playerCount, setPlayerCount] = usePlayerCount();
  const [names, setNames] = usePlayerNames();
  const [ownedIds, setOwnedIds] = useOwnedFactionIds();
  const [ownedHirelingIds, setOwnedHirelingIds] = useOwnedHirelingIds();
  const [ownedVagabondCharacterIds, setOwnedVagabondCharacterIds] = useOwnedVagabondCharacterIds();
  const [wishCount, setWishCount] = useWishCount();
  const [adventurous, setAdventurous] = useAdventurous();
  const [viewMode, setViewMode] = useViewMode();
  const [tiers, setTiers] = useTierAssignments();
  const [raffleTicketOverride, setRaffleTicketOverride] = useRaffleTicketCountOverride();
  const [dutchRange, setDutchRange] = useDutchRange();
  const [dutchTickSeconds, setDutchTickSeconds] = useDutchTickSeconds();

  const availableFactions = useMemo(() => computeAvailableFactions(ownedIds), [ownedIds]);
  const effTarget = computeEffTarget(playerCount, adventurous);
  const raffleTicketCount = raffleTicketOverride ?? playerCount;

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
    ownedHirelingIds,
    setOwnedHirelingIds,
    ownedVagabondCharacterIds,
    setOwnedVagabondCharacterIds,
    wishCount,
    setWishCount,
    adventurous,
    setAdventurous,
    effTarget,
    viewMode,
    setViewMode,
    tiers,
    setTiers,
    raffleTicketCount,
    raffleTicketCountIsAuto: raffleTicketOverride === null,
    setRaffleTicketCount: setRaffleTicketOverride,
    resetRaffleTicketCount: () => setRaffleTicketOverride(null),
    dutchRange,
    setDutchRange,
    dutchTickSeconds,
    setDutchTickSeconds,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
