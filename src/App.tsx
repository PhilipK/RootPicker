import { useEffect } from "react";
import { AppProvider, useAppContext } from "./context/AppContext";
import { useActiveMode } from "./lib/store";
import { Header } from "./components/Header";
import { ModeSelect } from "./components/ModeSelect";
import { ModeBar } from "./components/ModeBar";
import { SimpleMode } from "./modes/SimpleMode";
import { DraftMode } from "./modes/DraftMode";
import { HandDraftMode } from "./modes/HandDraftMode";
import { FavBanMode } from "./modes/FavBanMode";
import { CutChooseMode } from "./modes/CutChooseMode";
import { RiverfolkAuctionMode } from "./modes/RiverfolkAuctionMode";
import { BountyDraftMode } from "./modes/BountyDraftMode";
import { TeachingTiersMode } from "./modes/TeachingTiersMode";
import { WishlistMode } from "./modes/WishlistMode";
import { PotluckDraftMode } from "./modes/PotluckDraftMode";
import { TradingPostMode } from "./modes/TradingPostMode";
import { RaffleMode } from "./modes/RaffleMode";
import { OmakaseMode } from "./modes/OmakaseMode";
import { SettingsMode } from "./modes/SettingsMode";

function AppShell() {
  const [mode, setMode] = useActiveMode();
  const { viewMode } = useAppContext();

  useEffect(() => {
    document.body.classList.toggle("list-view", viewMode === "list");
  }, [viewMode]);

  useEffect(() => {
    document.body.style.paddingBottom = mode === "simple" ? "" : "0";
  }, [mode]);

  return (
    <>
      <Header />
      <main>
        {mode === "home" ? (
          <ModeSelect onSelect={setMode} />
        ) : (
          <>
            <ModeBar mode={mode} onBack={() => setMode("home")} />
            {mode === "simple" && <SimpleMode />}
            {mode === "draft" && <DraftMode />}
            {mode === "hand" && <HandDraftMode />}
            {mode === "fav" && <FavBanMode />}
            {mode === "cut" && <CutChooseMode />}
            {mode === "auction" && <RiverfolkAuctionMode />}
            {mode === "bounty" && <BountyDraftMode />}
            {mode === "tt" && <TeachingTiersMode />}
            {mode === "wish" && <WishlistMode />}
            {mode === "potluck" && <PotluckDraftMode />}
            {mode === "trade" && <TradingPostMode />}
            {mode === "raffle" && <RaffleMode />}
            {mode === "omakase" && <OmakaseMode />}
            {mode === "settings" && <SettingsMode />}
          </>
        )}
      </main>
    </>
  );
}

export function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
