import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { RouletteMode } from "./RouletteMode";
import { REACH_TARGET } from "../data/factions";

function renderRoulette() {
  return render(
    <AppProvider>
      <RouletteMode />
    </AppProvider>,
  );
}

function start() {
  fireEvent.click(screen.getByRole("button", { name: /shuffle seats & spin the lineup/i }));
}

describe("RouletteMode happy path (default 4 players)", () => {
  it("spins a legal lineup and locks it in", () => {
    renderRoulette();
    start();

    expect(screen.getByText(/spin/i)).toBeInTheDocument();
    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);
    expect(document.querySelectorAll(".grid .card")).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: /lock this lineup in/i }));
    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    expect(document.querySelectorAll(".summary-list li")).toHaveLength(4);
  });

  it("vetoing a faction exiles it and re-spins without it", () => {
    renderRoulette();
    start();

    const firstCard = document.querySelector<HTMLButtonElement>(".grid button:not(:disabled)")!;
    const vetoedName = firstCard.querySelector(".fname")!.textContent;
    fireEvent.click(firstCard);

    expect(screen.getByText("Exiled This Session")).toBeInTheDocument();
    const exiledLine = document.querySelector(".reveal-log li.ban-line")!;
    expect(exiledLine.textContent).toContain(vetoedName);

    // the new spin never brings the exiled faction back
    const namesNow = Array.from(document.querySelectorAll(".grid .fname")).map((el) => el.textContent);
    expect(namesNow).not.toContain(vetoedName);

    fireEvent.click(screen.getByRole("button", { name: /lock this lineup in/i }));
    const summaryText = document.querySelector(".summary-list")!.textContent!;
    expect(summaryText).not.toContain(vetoedName);
  });
});

describe("RouletteMode session persistence", () => {
  it("survives a simulated page reload mid-spin", () => {
    const { unmount } = renderRoulette();
    start();
    const firstCard = document.querySelector<HTMLButtonElement>(".grid button:not(:disabled)")!;
    fireEvent.click(firstCard);

    unmount(); // stands in for a page refresh

    renderRoulette();
    expect(screen.getByText("Exiled This Session")).toBeInTheDocument();
    expect(document.querySelectorAll(".reveal-log li.ban-line")).toHaveLength(1);
  });
});
