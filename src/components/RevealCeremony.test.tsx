import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RevealCeremony, type RevealSeatItem } from "./RevealCeremony";
import { byId } from "../data/factions";

const items: RevealSeatItem[] = [
  { name: "Anna", faction: byId.marquise, first: true, note: "won by ticket" },
  { name: "Ben", faction: byId.eyrie },
];

describe("RevealCeremony", () => {
  it("plays the ceremony for a result it hasn't seen", () => {
    render(<RevealCeremony storageKey="test" items={items} />);
    expect(screen.getByRole("dialog", { name: /faction reveal/i })).toBeInTheDocument();
    expect(screen.getByText(/Anna/)).toBeInTheDocument();
    expect(screen.getByText("Marquise de Cat")).toBeInTheDocument();
    expect(screen.getByText("won by ticket")).toBeInTheDocument();
    // the default flavor line stands in when no note is given
    expect(screen.getByText("reach 7 · militant")).toBeInTheDocument();
    expect(screen.getByText("first player")).toBeInTheDocument();
  });

  it("skips to the finale, then dismisses and offers a replay", () => {
    render(<RevealCeremony storageKey="test" items={items} />);

    fireEvent.click(screen.getByRole("button", { name: /skip the ceremony/i }));
    expect(screen.getByText("The Clearings Have Chosen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /onward to setup/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /replay the reveal/i })).toBeInTheDocument();
  });

  it("stays quiet on remount for a result already seen, until replayed", () => {
    const { unmount } = render(<RevealCeremony storageKey="test" items={items} />);
    fireEvent.click(screen.getByRole("button", { name: /skip the ceremony/i }));
    fireEvent.click(screen.getByRole("button", { name: /onward to setup/i }));
    unmount(); // stands in for a page reload on the done screen

    render(<RevealCeremony storageKey="test" items={items} />);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /replay the reveal/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("plays again for a genuinely new result", () => {
    const { unmount } = render(<RevealCeremony storageKey="test" items={items} />);
    fireEvent.click(screen.getByRole("button", { name: /skip the ceremony/i }));
    fireEvent.click(screen.getByRole("button", { name: /onward to setup/i }));
    unmount();

    const rematch: RevealSeatItem[] = [
      { name: "Anna", faction: byId.eyrie, first: true },
      { name: "Ben", faction: byId.marquise },
    ];
    render(<RevealCeremony storageKey="test" items={rematch} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("flips a card on a tap anywhere on the stage", () => {
    render(<RevealCeremony storageKey="test" items={items} />);
    expect(document.querySelectorAll(".ceremony-card.flipped")).toHaveLength(0);
    fireEvent.click(screen.getByRole("dialog"));
    expect(document.querySelectorAll(".ceremony-card.flipped")).toHaveLength(1);
  });
});
