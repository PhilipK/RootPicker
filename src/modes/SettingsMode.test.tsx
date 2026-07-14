import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { SettingsMode } from "./SettingsMode";

function renderSettings() {
  return render(
    <AppProvider>
      <SettingsMode />
    </AppProvider>,
  );
}

describe("SettingsMode: Woodland Raffle ticket budget", () => {
  it("defaults to the current player count with no reset button shown", () => {
    renderSettings();
    expect(screen.getByText("4")).toBeInTheDocument(); // default player count
    expect(screen.queryByRole("button", { name: /match player count again/i })).toBeNull();
  });

  it("becomes an explicit override once adjusted, with a reset control", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: /more tickets/i }));
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("rootpicker.raffleTicketCount")!)).toBe(5);

    const resetBtn = screen.getByRole("button", { name: /match player count again/i });
    fireEvent.click(resetBtn);
    expect(JSON.parse(window.localStorage.getItem("rootpicker.raffleTicketCount")!)).toBeNull();
    expect(screen.queryByRole("button", { name: /match player count again/i })).toBeNull();
  });

  it("clamps at the upper bound", () => {
    renderSettings();
    const more = screen.getByRole("button", { name: /more tickets/i });
    for (let i = 0; i < 20; i++) fireEvent.click(more);
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(more).toBeDisabled();
  });
});
