import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { TypecastMode } from "./TypecastMode";
import { REACH_TARGET } from "../data/factions";

function renderTypecast() {
  return render(
    <AppProvider>
      <TypecastMode />
    </AppProvider>,
  );
}

function start() {
  fireEvent.click(screen.getByRole("button", { name: /shuffle seats & start/i }));
}

/** One player's secret turn: acknowledge the gate, then nominate one faction
    for each of the other `n` seats in turn. */
function castBallot(n: number) {
  fireEvent.click(screen.getByRole("button", { name: /show me/i }));
  for (let i = 0; i < n; i++) {
    const grid = document.querySelector(".grid")!;
    const cards = Array.from(grid.querySelectorAll("button"));
    fireEvent.click(cards[i % cards.length]);
    fireEvent.click(screen.getByRole("button", { name: /nominate for/i }));
  }
}

describe("TypecastMode happy path (default 4 players)", () => {
  it("collects a full ballot from every seat and settles a legal table", () => {
    renderTypecast();
    start();

    // default player count is 4: each seat nominates for the other 3
    for (let i = 0; i < 4; i++) castBallot(3);

    expect(screen.getByText("The Woodland is Cast")).toBeInTheDocument();
    const subs = document.querySelectorAll(".summary-list .sub");
    expect(subs).toHaveLength(4);

    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);

    // every seat's assigned faction is distinct
    const facs = Array.from(document.querySelectorAll(".summary-list .fac")).map((el) => el.textContent);
    expect(new Set(facs).size).toBe(4);
  });

  it("survives a simulated page reload mid-ballot", () => {
    const { unmount } = renderTypecast();
    start();
    castBallot(3); // seat 0 finishes their ballot, device passes to seat 1

    unmount();
    renderTypecast();

    // still mid-session: the pass-device gate for the next seat reappears
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
