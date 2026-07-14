import { useEffect } from "react";
import { AppProvider, useAppContext } from "./context/AppContext";
import { useActiveMode } from "./lib/store";
import { Header } from "./components/Header";
import { Nav } from "./components/Nav";
import { SimpleMode } from "./modes/SimpleMode";
import { DraftMode } from "./modes/DraftMode";
import { HandDraftMode } from "./modes/HandDraftMode";
import { FavBanMode } from "./modes/FavBanMode";
import { CutChooseMode } from "./modes/CutChooseMode";
import { RiverfolkAuctionMode } from "./modes/RiverfolkAuctionMode";
import { BountyDraftMode } from "./modes/BountyDraftMode";
import { TeachingTiersMode } from "./modes/TeachingTiersMode";
import { WishlistMode } from "./modes/WishlistMode";
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
        <Nav mode={mode} onChange={setMode} />
        {mode === "simple" && <SimpleMode />}
        {mode === "draft" && <DraftMode />}
        {mode === "hand" && <HandDraftMode />}
        {mode === "fav" && <FavBanMode />}
        {mode === "cut" && <CutChooseMode />}
        {mode === "auction" && <RiverfolkAuctionMode />}
        {mode === "bounty" && <BountyDraftMode />}
        {mode === "tt" && <TeachingTiersMode />}
        {mode === "wish" && <WishlistMode />}
        {mode === "settings" && <SettingsMode />}
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
