import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { SecretSantaMode } from "./SecretSantaMode";
import { REACH_TARGET } from "../data/factions";

function renderSanta() {
  return render(
    <AppProvider>
      <SecretSantaMode />
    </AppProvider>,
  );
}

function start() {
  fireEvent.click(screen.getByRole("button", { name: /shuffle seats & start gifting/i }));
}

/** One giver's secret turn: acknowledge the gate, gift the card at `index`
    in the grid (ungated — every card is always clickable). */
function giftCardAt(index: number) {
  fireEvent.click(screen.getByRole("button", { name: /show me/i }));
  const grid = document.querySelector(".grid")!;
  const cards = Array.from(grid.querySelectorAll("button"));
  fireEvent.click(cards[index]);
}

describe("SecretSantaMode happy path (default 4 players, distinct gifts)", () => {
  it("runs gift → reveal through to done with every gift accepted", () => {
    renderSanta();
    start();

    expect(screen.getByText(/pass the device to/i)).toBeInTheDocument();
    // each giver gifts a different faction (grid index == turn), so nothing
    // should ever bounce
    for (let i = 0; i < 4; i++) giftCardAt(i);

    expect(screen.getByText("The Reveal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reveal the rest/i }));

    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    const subs = document.querySelectorAll(".summary-list .sub");
    expect(subs).toHaveLength(4);
    subs.forEach((el) => expect(el.textContent).toMatch(/^gifted by /));

    const log = Array.from(document.querySelectorAll(".reveal-log li")).map((li) => li.textContent!);
    expect(log).toHaveLength(4);
    expect(log.every((t) => /accepted/.test(t))).toBe(true);

    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);
  });
});

describe("SecretSantaMode duplicate gifts force an open re-pick", () => {
  it("bounces a repeated gift and lets the giver pick a legal replacement", () => {
    renderSanta();
    start();

    // every giver gifts the very first card in the grid — guaranteed pile-up
    for (let i = 0; i < 4; i++) giftCardAt(0);

    expect(screen.getByText("The Reveal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reveal the rest/i }));

    // the second identical gift to resolve must bounce — the repick banner appears
    expect(document.querySelector(".picker-banner")!.textContent).toMatch(/bounces —/);
    expect(document.querySelectorAll(".reveal-log li")[0].textContent).toMatch(/bounces —/);

    // giver open-repicks the first legal survivor offered
    const grid = document.querySelector(".grid")!;
    fireEvent.click(grid.querySelector("button")!);

    // may take another round of "reveal the rest" if more duplicates remain
    while (screen.queryByText("The Woodland is Set") === null) {
      const repickBanner = document.querySelector(".picker-banner");
      if (repickBanner && /bounces —/.test(repickBanner.textContent ?? "")) {
        fireEvent.click(document.querySelector(".grid button")!);
      } else {
        fireEvent.click(screen.getByRole("button", { name: /reveal the rest/i }));
      }
    }

    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    const finalIds = new Set(
      Array.from(document.querySelectorAll(".summary-list .fac")).map((el) => el.textContent),
    );
    expect(finalIds.size).toBe(4); // no duplicate factions survived
    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);
  });
});

describe("SecretSantaMode session persistence", () => {
  it("survives a simulated page reload mid-gift", () => {
    const { unmount } = renderSanta();
    start();
    giftCardAt(0);

    unmount(); // stands in for a page refresh

    renderSanta();
    expect(screen.getByText(/pass the device to/i)).toBeInTheDocument();
    expect(document.querySelectorAll(".order-list .done")).toHaveLength(1);
  });
});
