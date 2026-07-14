import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { RaffleMode } from "./RaffleMode";
import { REACH_TARGET } from "../data/factions";
import { RAFFLE_TICKETS } from "../lib/raffle";

function renderRaffle() {
  return render(
    <AppProvider>
      <RaffleMode />
    </AppProvider>,
  );
}

function start() {
  fireEvent.click(screen.getByRole("button", { name: /shuffle seats & hand out tickets/i }));
}

/** One player's secret turn: acknowledge the gate, drop `n` tickets on the
    first enabled cards, submit. */
function placeTickets(n: number) {
  fireEvent.click(screen.getByRole("button", { name: /show me/i }));
  const grid = document.querySelector(".grid")!;
  const cards = Array.from(grid.querySelectorAll("button")).filter((b) => !(b as HTMLButtonElement).disabled);
  for (let i = 0; i < n; i++) fireEvent.click(cards[i % cards.length]);
  fireEvent.click(screen.getByRole("button", { name: /drop my .* in the urn/i }));
}

describe("RaffleMode happy path (default 4 players)", () => {
  it("collects tickets, draws the urn, and settles a legal table", () => {
    renderRaffle();
    start();

    for (let i = 0; i < 4; i++) placeTickets(3);

    expect(screen.getByText("The Urn")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /draw everything/i }));

    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    const subs = document.querySelectorAll(".summary-list .sub");
    expect(subs).toHaveLength(4);
    subs.forEach((el) => expect(el.textContent).toMatch(/won by ticket|random fill/));

    // every win eagerly burns all now-dead tickets, so no ticket is ever
    // drawn just to burn — the log is wins and fills only
    const log = Array.from(document.querySelectorAll(".reveal-log li")).map((li) => li.textContent!);
    expect(log.every((t) => /wins the|from the leftovers/.test(t))).toBe(true);

    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);
  });

  it("caps a player at the ticket budget", () => {
    renderRaffle();
    start();
    fireEvent.click(screen.getByRole("button", { name: /show me/i }));
    const grid = document.querySelector(".grid")!;
    const card = grid.querySelector("button")!;
    for (let i = 0; i < RAFFLE_TICKETS + 5; i++) fireEvent.click(card);
    expect(screen.getByText(/drop my 10 tickets in the urn/i)).toBeInTheDocument();
  });

  it("removes the last ticket on request", () => {
    renderRaffle();
    start();
    fireEvent.click(screen.getByRole("button", { name: /show me/i }));
    const card = document.querySelector<HTMLButtonElement>(".grid button")!;
    fireEvent.click(card);
    fireEvent.click(card);
    fireEvent.click(screen.getByRole("button", { name: /remove last ticket/i }));
    expect(screen.getByText(/drop my 1 ticket in the urn/i)).toBeInTheDocument();
  });
});

describe("RaffleMode draw stepping", () => {
  it("draws one ticket at a time", () => {
    renderRaffle();
    start();
    for (let i = 0; i < 4; i++) placeTickets(2);

    fireEvent.click(screen.getByRole("button", { name: /^draw a ticket$/i }));
    expect(document.querySelectorAll(".reveal-log li")).toHaveLength(1);
  });
});

describe("RaffleMode session persistence", () => {
  it("survives a simulated page reload mid-tickets", () => {
    const { unmount } = renderRaffle();
    start();
    placeTickets(2);

    unmount(); // stands in for a page refresh

    renderRaffle();
    expect(screen.getByText(/pass the device to/i)).toBeInTheDocument();
    expect(document.querySelectorAll(".order-list .done")).toHaveLength(1);
  });
});
