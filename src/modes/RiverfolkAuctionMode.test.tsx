import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { RiverfolkAuctionMode, startingBonuses } from "./RiverfolkAuctionMode";
import { REACH_TARGET } from "../data/factions";

function renderAuction() {
  return render(
    <AppProvider>
      <RiverfolkAuctionMode />
    </AppProvider>,
  );
}

function lockBid(vp: number) {
  fireEvent.click(screen.getByRole("button", { name: /show me/i }));
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

describe("startingBonuses", () => {
  it("gives non-bidders the winner's cost as bonus VP instead of negatives", () => {
    // 4 vs three 0s: the 4 is trimmed to cost 1 (one above the 0s), so the
    // winner starts at 0 and everyone else starts at +1.
    expect(startingBonuses([4, 0, 0, 0])).toEqual([0, 1, 1, 1]);
  });

  it("trims an overbid to one above the bid below it", () => {
    // 5 over 3 only costs 4, so after shifting the 3-bidder starts at just +1.
    expect(startingBonuses([3, 5])).toEqual([1, 0]);
  });

  it("charges tied bids the same trimmed cost", () => {
    expect(startingBonuses([4, 4, 0])).toEqual([0, 0, 1]);
  });

  it("keeps an all-equal table at 0", () => {
    expect(startingBonuses([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
    expect(startingBonuses([3, 3, 3])).toEqual([0, 0, 0]);
  });

  it("never produces a negative start and always anchors the biggest spender at 0", () => {
    const bonuses = startingBonuses([5, 4, 2, 1]);
    expect(Math.min(...bonuses)).toBe(0);
    expect(bonuses.every((b) => b >= 0)).toBe(true);
  });
});

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

    // Reveal: highest bidder picks first; costs are trimmed (5→4, 2→1) and
    // shifted so the biggest spender starts at 0 and the rest start ahead.
    expect(screen.getByText("Bids Revealed")).toBeInTheDocument();
    expect(screen.getByText(/bid 5 VP — picks first — starts at 0 VP/)).toBeInTheDocument();
    expect(screen.getByText(/bid 3 VP — picks #2 — starts at \+1 VP/)).toBeInTheDocument();
    expect(screen.getByText(/bid 2 VP — picks #3 — starts at \+3 VP/)).toBeInTheDocument();
    expect(screen.getByText(/bid 0 VP — picks #4 — starts at \+4 VP/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start picking" }));

    for (let i = 0; i < 4; i++) {
      expect(screen.getByText(/picks now/i)).toBeInTheDocument();
      pickFirstLegalFaction();
    }

    // Done: table meets the recommended reach for 4 players.
    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);
    expect(screen.getByText(/bid 5 VP — starts at 0 VP \(house rule\)/)).toBeInTheDocument();
    expect(screen.getByText(/bid 0 VP — starts at \+4 VP \(house rule\)/)).toBeInTheDocument();
  });

  it("keeps the lock button disabled until a bid amount is chosen", () => {
    renderAuction();
    fireEvent.click(screen.getByRole("button", { name: /shuffle seats & start bidding/i }));
    fireEvent.click(screen.getByRole("button", { name: /show me/i }));
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
