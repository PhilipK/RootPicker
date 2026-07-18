import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { ExileDraftMode } from "./ExileDraftMode";
import { REACH_TARGET } from "../data/factions";

function renderExile() {
  return render(
    <AppProvider>
      <ExileDraftMode />
    </AppProvider>,
  );
}

function start() {
  fireEvent.click(screen.getByRole("button", { name: /shuffle seats & start exiling/i }));
}

/** Clicks the first enabled faction card in the grid — used through the ban
    phase, since disabled (guard-blocked or already-exiled) cards are
    unclickable buttons. */
function clickFirstEnabledCard() {
  const grid = document.querySelector(".grid")!;
  const card = Array.from(grid.querySelectorAll("button")).find((b) => !(b as HTMLButtonElement).disabled)!;
  fireEvent.click(card);
}

/** Default owned pool is 13 factions (Second Vagabond excluded); at the
    default 4 players that's totalBans = 13 - 4 - 2 = 7. */
const DEFAULT_TOTAL_BANS = 7;

describe("ExileDraftMode happy path (default 4 players)", () => {
  it("runs the ban round then reveals a legal, fully-seated lineup", () => {
    renderExile();
    start();

    expect(screen.getByText("The Shared Pool")).toBeInTheDocument();
    for (let i = 0; i < DEFAULT_TOTAL_BANS; i++) clickFirstEnabledCard();

    expect(screen.getByText("The Survivors")).toBeInTheDocument();
    expect(document.querySelectorAll(".grid .card")).toHaveLength(6); // playerCount + 2 slack

    fireEvent.click(screen.getByRole("button", { name: /reveal the woodland/i }));

    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    const subs = document.querySelectorAll(".summary-list .sub");
    // one row per seat plus the faded "Exiled" summary row
    expect(subs.length).toBe(5);
    expect(screen.getByText(/^Exiled$/)).toBeInTheDocument();

    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);
  });
});

describe("ExileDraftMode session persistence", () => {
  it("survives a simulated page reload mid-ban", () => {
    const { unmount } = renderExile();
    start();
    clickFirstEnabledCard();
    expect(document.querySelectorAll(".order-list .done, .order-list li")).toHaveLength(4);
    const bansMadeBefore = document.querySelectorAll(".order-list .current").length;

    unmount(); // stands in for a page refresh

    renderExile();
    expect(screen.getByText("The Shared Pool")).toBeInTheDocument();
    expect(document.querySelectorAll(".order-list .current")).toHaveLength(bansMadeBefore);
  });
});

describe("ExileDraftMode reset", () => {
  it("requires a second tap to start over", () => {
    renderExile();
    start();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    // still mid-round — the tap only armed the button
    expect(screen.getByText("The Shared Pool")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /tap again to confirm/i }));
    expect(screen.getByRole("button", { name: /shuffle seats & start exiling/i })).toBeInTheDocument();
  });
});
