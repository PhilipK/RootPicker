import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { TradingPostMode } from "./TradingPostMode";
import { REACH_TARGET } from "../data/factions";

function renderTrade() {
  return render(
    <AppProvider>
      <TradingPostMode />
    </AppProvider>,
  );
}

function start() {
  fireEvent.click(screen.getByRole("button", { name: /shuffle seats & deal the market/i }));
}

/** Tap through one player's secret turn: acknowledge the pass gate, then lock
    in with no wishes ranked (keep the deal). */
function keepDeal() {
  fireEvent.click(screen.getByRole("button", { name: /show me/i }));
  fireEvent.click(screen.getByRole("button", { name: /keep my deal/i }));
}

describe("TradingPostMode happy path (default 4 players)", () => {
  it("deals, collects wishes, and settles a legal table when everyone keeps", () => {
    renderTrade();
    start();

    for (let i = 0; i < 4; i++) keepDeal();

    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    expect(document.querySelectorAll(".summary-list li")).toHaveLength(4);
    // four keeps in the trade log
    const keeps = Array.from(document.querySelectorAll(".reveal-log li")).filter((li) =>
      li.textContent!.includes("keeps"),
    );
    expect(keeps).toHaveLength(4);
    // nobody ranked anything, so every summary line says so
    const primaries = Array.from(document.querySelectorAll(".summary-list .fac"));
    primaries.forEach((el) => expect(el.textContent).toContain("(wished for nothing else)"));

    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);
  });

  it("executes a wished trade when a player ranks another dealt faction", () => {
    renderTrade();
    start();

    // first player ranks every tappable faction — guaranteeing at least one
    // want that's dealt or reach-safe in the stalls, so a trade or a keep both
    // remain possible without stranding the run
    fireEvent.click(screen.getByRole("button", { name: /show me/i }));
    const grid = document.querySelector(".grid")!;
    const cards = Array.from(grid.querySelectorAll("button")).filter((b) => !(b as HTMLButtonElement).disabled);
    for (const c of cards) fireEvent.click(c);
    fireEvent.click(screen.getByRole("button", { name: /lock in my/i }));

    for (let i = 0; i < 3; i++) keepDeal();

    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);
    // the ranking player's line reports their wish outcome: either the rank
    // of the wish they landed, or that none panned out
    const primaries = Array.from(document.querySelectorAll(".summary-list .fac")).map((el) => el.textContent!);
    expect(primaries.some((t) => /\(\d+(st|nd|rd|th) choice\)|\(no wish panned out\)/.test(t))).toBe(true);
  });
});

describe("TradingPostMode with the stalls closed", () => {
  it("only offers the dealt lineup for ranking and settles a legal table", () => {
    renderTrade();
    fireEvent.click(screen.getByLabelText(/open the market stalls/i));
    start();

    fireEvent.click(screen.getByRole("button", { name: /show me/i }));
    // 4 dealt factions: 3 rankable plus the player's own disabled card
    expect(document.querySelectorAll(".grid .card")).toHaveLength(4);
    expect(document.querySelectorAll(".grid button:not([disabled])")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /keep my deal/i }));
    for (let i = 0; i < 3; i++) keepDeal();

    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);

    // restore the default for other tests sharing localStorage
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    fireEvent.click(screen.getByRole("button", { name: /tap again to confirm/i }));
    fireEvent.click(screen.getByLabelText(/open the market stalls/i));
  });
});

describe("TradingPostMode secrecy", () => {
  it("hides the ranking screen behind the pass gate", () => {
    renderTrade();
    start();
    expect(screen.getByText(/pass the device to/i)).toBeInTheDocument();
    expect(document.querySelector(".grid")).toBeNull();
  });
});

describe("TradingPostMode session persistence", () => {
  it("survives a simulated page reload mid-ranking", () => {
    const { unmount } = renderTrade();
    start();
    keepDeal();

    unmount(); // stands in for a page refresh

    renderTrade();
    // gate reappears for the second player's secret turn
    expect(screen.getByText(/pass the device to/i)).toBeInTheDocument();
    expect(document.querySelectorAll(".order-list .done")).toHaveLength(1);
  });
});
