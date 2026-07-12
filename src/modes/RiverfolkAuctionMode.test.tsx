import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { RiverfolkAuctionMode } from "./RiverfolkAuctionMode";
import { REACH_TARGET } from "../data/factions";

function renderAuction() {
  return render(
    <AppProvider>
      <RiverfolkAuctionMode />
    </AppProvider>,
  );
}

function lockBid(vp: number) {
  fireEvent.click(screen.getByRole("button", { name: "Enter my bid" }));
  fireEvent.click(screen.getByRole("button", { name: `${vp} VP` }));
  fireEvent.click(screen.getByRole("button", { name: "Lock in my bid" }));
}

/** Pick the first enabled faction card in the grid; returns its accessible name. */
function pickFirstLegalFaction(): string {
  const grid = document.querySelector(".grid")!;
  const card = within(grid as HTMLElement)
    .getAllByRole("button")
    .find((b) => !(b as HTMLButtonElement).disabled)!;
  const name = within(card).getByAltText(/—/).getAttribute("alt")!;
  fireEvent.click(card);
  return name.split(" — ")[0];
}

describe("RiverfolkAuctionMode full flow (default 4 players)", () => {
  it("runs bids → reveal → picks → done, honoring bid order and reach", () => {
    renderAuction();
    fireEvent.click(screen.getByRole("button", { name: /shuffle seats & start bidding/i }));

    // Distinct bids make the pick order deterministic: 5, 3, 2, 0.
    const bids = [5, 3, 2, 0];
    for (const b of bids) {
      expect(screen.getByText(/pass the device to/i)).toBeInTheDocument();
      lockBid(b);
    }

    // Reveal: highest bidder picks first, zero bid carries no handicap.
    expect(screen.getByText("Bids Revealed")).toBeInTheDocument();
    expect(screen.getByText(/bid 5 VP — picks first — starts at −5 VP/)).toBeInTheDocument();
    expect(screen.getByText(/bid 0 VP — picks #4$/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start picking" }));

    for (let i = 0; i < 4; i++) {
      expect(screen.getByText(/picks now/i)).toBeInTheDocument();
      pickFirstLegalFaction();
    }

    // Done: table meets the recommended reach for 4 players.
    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);
    expect(screen.getByText(/starts at −5 VP \(house rule\)/)).toBeInTheDocument();
  });

  it("keeps the lock button disabled until a bid amount is chosen", () => {
    renderAuction();
    fireEvent.click(screen.getByRole("button", { name: /shuffle seats & start bidding/i }));
    fireEvent.click(screen.getByRole("button", { name: "Enter my bid" }));
    expect(screen.getByRole("button", { name: "Lock in my bid" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "2 VP" }));
    expect(screen.getByRole("button", { name: "Lock in my bid" })).toBeEnabled();
  });
});

describe("RiverfolkAuctionMode session persistence", () => {
  it("survives a simulated page reload mid-bidding", () => {
    const { unmount } = renderAuction();
    fireEvent.click(screen.getByRole("button", { name: /shuffle seats & start bidding/i }));
    lockBid(3);
    expect(screen.getByText(/pass the device to/i)).toBeInTheDocument();

    unmount(); // stands in for a page refresh

    renderAuction();
    expect(screen.getByText(/pass the device to/i)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 4 bids in/)).toBeInTheDocument();
  });
});

describe("RiverfolkAuctionMode reset", () => {
  it("requires a second tap to start over", () => {
    renderAuction();
    fireEvent.click(screen.getByRole("button", { name: /shuffle seats & start bidding/i }));
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    // still mid-auction — the tap only armed the button
    expect(screen.getByText(/pass the device to/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /tap again to confirm/i }));
    expect(screen.getByRole("button", { name: /shuffle seats & start bidding/i })).toBeInTheDocument();
  });
});
