import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { BountyDraftMode } from "./BountyDraftMode";
import { REACH_TARGET } from "../data/factions";

function renderBounty() {
  return render(
    <AppProvider>
      <BountyDraftMode />
    </AppProvider>,
  );
}

function start() {
  fireEvent.click(screen.getByRole("button", { name: /shuffle seats & start the draft/i }));
}

function claimCurrent() {
  const claimBtn = screen.queryAllByRole("button").find((b) => /^Claim /.test(b.textContent ?? ""));
  if (claimBtn) {
    fireEvent.click(claimBtn);
    return;
  }
  // Last player: no single "Claim X" button — pick the first enabled card from the grid.
  const grid = document.querySelector(".grid")!;
  const card = Array.from(grid.querySelectorAll("button")).find((b) => !(b as HTMLButtonElement).disabled)!;
  fireEvent.click(card);
}

function banner(): string {
  return document.querySelector(".picker-banner")!.textContent!;
}

describe("BountyDraftMode full flow (default 4 players)", () => {
  it("runs claim-only through to done, meeting the reach target and normalizing VP to a 0 floor", () => {
    renderBounty();
    start();

    for (let i = 0; i < 4; i++) {
      expect(document.querySelector(".picker-banner")).toBeInTheDocument();
      claimCurrent();
    }

    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    const reach = Number(screen.getByText(/^Reach/).querySelector("b")!.textContent);
    expect(reach).toBeGreaterThanOrEqual(REACH_TARGET[4]);

    // Claiming immediately every turn means every card has 0 bounty and full unspent
    // tokens, so all four totals are equal and normalization floors them all at +0.
    const subs = document.querySelectorAll(".summary-list .sub");
    expect(subs).toHaveLength(4);
    subs.forEach((el) => expect(el.textContent).toContain("starts at +0 VP"));
  });

  it("passing spends a token and adds +1 bounty to the revealed card", () => {
    renderBounty();
    start();
    expect(banner()).toContain("for 0 VP");
    fireEvent.click(screen.getByRole("button", { name: /pass/i }));
    expect(banner()).toContain("for 1 VP");
  });

  it("gives the last remaining player a free pick from every legal faction instead of a forced single reveal", () => {
    renderBounty();
    start();

    for (let i = 0; i < 3; i++) claimCurrent();

    // Down to one player: the claim/pass single-card UI is gone, replaced by a grid.
    expect(screen.queryByRole("button", { name: /^Claim /i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pass/i })).not.toBeInTheDocument();
    expect(banner()).toMatch(/only one left drafting/);

    const grid = document.querySelector(".grid")!;
    const enabledCards = Array.from(grid.querySelectorAll("button")).filter((b) => !(b as HTMLButtonElement).disabled);
    expect(enabledCards.length).toBeGreaterThan(0);
    fireEvent.click(enabledCards[0]);

    expect(screen.getByText("The Woodland is Set")).toBeInTheDocument();
    const subs = document.querySelectorAll(".summary-list .sub");
    expect(subs).toHaveLength(4);
  });
});

describe("BountyDraftMode session persistence", () => {
  it("survives a simulated page reload mid-draft", () => {
    const { unmount } = renderBounty();
    start();
    fireEvent.click(screen.getByRole("button", { name: /pass/i }));
    expect(banner()).toContain("for 1 VP");

    unmount(); // stands in for a page refresh

    renderBounty();
    expect(banner()).toContain("for 1 VP");
  });
});

describe("BountyDraftMode reset", () => {
  it("requires a second tap to start over", () => {
    renderBounty();
    start();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    // still mid-draft — the tap only armed the button
    expect(document.querySelector(".picker-banner")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /tap again to confirm/i }));
    expect(screen.getByRole("button", { name: /shuffle seats & start the draft/i })).toBeInTheDocument();
  });
});
