import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { DraftMode } from "./DraftMode";
import { ARM_TIMEOUT_MS } from "../components/ConfirmResetButton";

function renderDraft() {
  return render(
    <AppProvider>
      <DraftMode />
    </AppProvider>,
  );
}

describe("DraftMode session persistence", () => {
  it("survives a simulated page reload mid-draft", () => {
    const { unmount } = renderDraft();
    fireEvent.click(screen.getByRole("button", { name: /shuffle seats & deal/i }));
    expect(screen.getByText(/picks now/i)).toBeInTheDocument();

    unmount(); // stands in for a page refresh

    renderDraft();
    expect(screen.getByText(/picks now/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /shuffle seats & deal/i })).not.toBeInTheDocument();
  });
});

describe("DraftMode's \"Start over\" requires a second tap", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not discard the draft on a single accidental tap", () => {
    renderDraft();
    fireEvent.click(screen.getByRole("button", { name: /shuffle seats & deal/i }));
    expect(screen.getByText(/picks now/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    // still mid-draft — the tap only armed the button
    expect(screen.getByText(/picks now/i)).toBeInTheDocument();
  });

  it("discards the draft once the second tap confirms", () => {
    renderDraft();
    fireEvent.click(screen.getByRole("button", { name: /shuffle seats & deal/i }));

    const resetButton = screen.getByRole("button", { name: "Start over" });
    fireEvent.click(resetButton);
    fireEvent.click(screen.getByRole("button", { name: /tap again to confirm/i }));

    expect(screen.getByRole("button", { name: /shuffle seats & deal/i })).toBeInTheDocument();
  });

  it("re-arms rather than reset if the second tap comes after the confirm window closes", () => {
    renderDraft();
    fireEvent.click(screen.getByRole("button", { name: /shuffle seats & deal/i }));

    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    act(() => {
      vi.advanceTimersByTime(ARM_TIMEOUT_MS + 1);
    });
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));

    // draft should still be intact
    expect(screen.getByText(/picks now/i)).toBeInTheDocument();
  });
});
