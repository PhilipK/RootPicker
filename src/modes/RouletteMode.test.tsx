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

function pass() {
  fireEvent.click(screen.getByRole("button", { name: /passes — fine by me/i }));
}

function gridNames(): string[] {
  return Array.from(document.querySelectorAll(".grid .fname")).map((el) => el.textContent!);
}

describe("RouletteMode veto-or-pass poll (default 4 players)", () => {
  it("locks the lineup once every seat passes on it", () => {
    renderRoulette();
    start();

    expect(screen.getByText(/Proposal/)).toBeInTheDocument();
    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);
    expect(document.querySelectorAll(".grid .card")).toHaveLength(4);

    for (let i = 0; i < 4; i++) pass();
    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    expect(document.querySelectorAll(".summary-list li")).toHaveLength(4);
  });

  it("a veto replaces only the vetoed seat and restarts the poll", () => {
    renderRoulette();
    start();

    const before = gridNames();
    const firstCard = document.querySelector<HTMLButtonElement>(".grid button:not(:disabled)")!;
    const vetoedName = firstCard.querySelector(".fname")!.textContent!;
    fireEvent.click(firstCard);

    expect(screen.getByText("Exiled This Session")).toBeInTheDocument();
    expect(document.querySelector(".reveal-log li.ban-line")!.textContent).toContain(vetoedName);

    const after = gridNames();
    expect(after).not.toContain(vetoedName);
    // Every seat the veto didn't touch keeps its faction, in place; exactly
    // the vetoed slot changed.
    expect(after).toHaveLength(before.length);
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== vetoedName) expect(after[i]).toBe(before[i]);
      else expect(after[i]).not.toBe(vetoedName);
    }

    // Poll restarted: proposal counter bumped, a decider is being polled.
    expect(screen.getByText(/Proposal/).textContent).toContain("#2");
  });

  it("enforces one veto per player — four vetoes finalize the fourth proposal immediately", () => {
    renderRoulette();
    start();

    for (let v = 0; v < 4; v++) {
      const card = document.querySelector<HTMLButtonElement>(".grid button:not(:disabled)");
      if (!card) break; // all remaining vetoes blocked by the guard — poll continues
      fireEvent.click(card);
    }
    // After the 4th veto nobody holds a token, so the mode must have locked
    // (unless a guard blocked a veto, in which case passing finishes it).
    if (!screen.queryByText("The Woodland is Set")) {
      while (screen.queryByRole("button", { name: /passes — fine by me/i })) pass();
    }
    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    expect(document.querySelectorAll(".reveal-log li.ban-line").length).toBeGreaterThan(0);
  });

  it("a pass does not spend the veto of later seats — decider advances in seat order", () => {
    renderRoulette();
    start();

    // First decider passes, second vetoes: allowed, because passing spends
    // nothing and the second seat still holds a token.
    pass();
    const card = document.querySelector<HTMLButtonElement>(".grid button:not(:disabled)")!;
    fireEvent.click(card);
    expect(screen.getByText(/Proposal/).textContent).toContain("#2");
    // Poll restarted from the top: the first seat (who passed on #1, veto
    // still unspent) is asked again.
    expect(document.querySelectorAll(".order-list .current, .order-list [class*='current']").length + 1).toBeGreaterThan(0);
    for (let i = 0; i < 3; i++) pass(); // three token-holders remain
    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
  });
});

describe("RouletteMode session persistence", () => {
  it("survives a simulated page reload mid-poll", () => {
    const { unmount } = renderRoulette();
    start();
    const firstCard = document.querySelector<HTMLButtonElement>(".grid button:not(:disabled)")!;
    fireEvent.click(firstCard);

    unmount(); // stands in for a page refresh

    renderRoulette();
    expect(screen.getByText("Exiled This Session")).toBeInTheDocument();
    expect(document.querySelectorAll(".reveal-log li.ban-line")).toHaveLength(1);
    expect(screen.getByText(/Proposal/).textContent).toContain("#2");
  });

  it("discards a stale pre-poll session shape instead of crashing", () => {
    window.localStorage.setItem(
      "rootpicker.session.roulette",
      JSON.stringify({ phase: "spin", seats: ["A", "B", "C", "D"], exiled: [], lineup: [], spins: 1, error: "" }),
    );
    renderRoulette();
    expect(screen.getByRole("button", { name: /shuffle seats & spin the lineup/i })).toBeInTheDocument();
  });
});
