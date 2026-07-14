import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { PotluckDraftMode } from "./PotluckDraftMode";
import { REACH_TARGET } from "../data/factions";

function renderPotluck() {
  return render(
    <AppProvider>
      <PotluckDraftMode />
    </AppProvider>,
  );
}

function start() {
  fireEvent.click(screen.getByRole("button", { name: /shuffle seats & start the potluck/i }));
}

/** Clicks the first enabled faction card in the grid — used for both the
    contribute phase (any legal addition) and the pick phase (any legal pick,
    guard-respecting since disabled cards are unclickable). */
function clickFirstEnabledCard() {
  const grid = document.querySelector(".grid")!;
  const card = Array.from(grid.querySelectorAll("button")).find((b) => !(b as HTMLButtonElement).disabled)!;
  fireEvent.click(card);
}

describe("PotluckDraftMode happy path (default 4 players)", () => {
  it("runs contribute then pick through to done", () => {
    renderPotluck();
    start();

    expect(screen.getByText("The Shared Pool")).toBeInTheDocument();
    for (let i = 0; i < 4; i++) clickFirstEnabledCard();

    expect(screen.getByText("Take a Faction")).toBeInTheDocument();
    for (let i = 0; i < 4; i++) clickFirstEnabledCard();

    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    const subs = document.querySelectorAll(".summary-list .sub");
    expect(subs).toHaveLength(4);
    subs.forEach((el) => expect(el.textContent).toMatch(/^brought /));

    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);
  });
});

describe("PotluckDraftMode session persistence", () => {
  it("survives a simulated page reload mid-contribute", () => {
    const { unmount } = renderPotluck();
    start();
    clickFirstEnabledCard();
    expect(document.querySelectorAll(".order-list .done")).toHaveLength(1);

    unmount(); // stands in for a page refresh

    renderPotluck();
    expect(screen.getByText("The Shared Pool")).toBeInTheDocument();
    expect(document.querySelectorAll(".order-list .done")).toHaveLength(1);
  });
});

describe("PotluckDraftMode reset", () => {
  it("requires a second tap to start over", () => {
    renderPotluck();
    start();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    // still mid-potluck — the tap only armed the button
    expect(screen.getByText("The Shared Pool")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /tap again to confirm/i }));
    expect(screen.getByRole("button", { name: /shuffle seats & start the potluck/i })).toBeInTheDocument();
  });
});
