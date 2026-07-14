import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PassDeviceGate } from "./PassDeviceGate";

describe("PassDeviceGate", () => {
  it("hides the secret content behind an interstitial until the confirm button is tapped", () => {
    render(
      <PassDeviceGate actorName="Alex" actorKey="turn-1">
        <p>Secret content</p>
      </PassDeviceGate>,
    );

    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show me/i }));
    expect(screen.getByText("Secret content")).toBeInTheDocument();
  });

  it("focuses the confirm button on mount, without needing a click first", () => {
    render(
      <PassDeviceGate actorName="Sam" actorKey="turn-1">
        <p>Secret content</p>
      </PassDeviceGate>,
    );
    expect(screen.getByRole("button", { name: /show me/i })).toHaveFocus();
  });

  it("calls onAcknowledge exactly once when confirmed", () => {
    const onAcknowledge = vi.fn();
    render(
      <PassDeviceGate actorName="Alex" actorKey="turn-1" onAcknowledge={onAcknowledge}>
        <p>Secret content</p>
      </PassDeviceGate>,
    );
    fireEvent.click(screen.getByRole("button", { name: /show me/i }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it("re-gates when actorKey changes, even if the same component stays mounted", () => {
    const { rerender } = render(
      <PassDeviceGate actorName="Alex" actorKey="turn-1">
        <p>Secret content</p>
      </PassDeviceGate>,
    );
    fireEvent.click(screen.getByRole("button", { name: /show me/i }));
    expect(screen.getByText("Secret content")).toBeInTheDocument();

    // A new turn (different actorKey) — e.g. the next player, or the same
    // player again next round — must be re-acknowledged from scratch.
    rerender(
      <PassDeviceGate actorName="Bo" actorKey="turn-2">
        <p>Secret content</p>
      </PassDeviceGate>,
    );
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
    expect(screen.getByText("Bo")).toBeInTheDocument();
  });

  it("simulates the reload-safety guarantee: a fresh mount always re-gates regardless of prior acknowledgment", () => {
    // Component-local ack state is not persisted, so an unmount+remount
    // (standing in for a page reload mid-turn) must show the gate again —
    // the safe default even if the underlying app state thinks it's mid-turn.
    const { unmount } = render(
      <PassDeviceGate actorName="Alex" actorKey="turn-1">
        <p>Secret content</p>
      </PassDeviceGate>,
    );
    fireEvent.click(screen.getByRole("button", { name: /show me/i }));
    expect(screen.getByText("Secret content")).toBeInTheDocument();
    unmount();

    render(
      <PassDeviceGate actorName="Alex" actorKey="turn-1">
        <p>Secret content</p>
      </PassDeviceGate>,
    );
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });
});
