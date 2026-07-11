import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ConfirmResetButton, ARM_TIMEOUT_MS } from "./ConfirmResetButton";

describe("ConfirmResetButton", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("arms on the first tap instead of confirming — a stray tap shouldn't wipe a session", () => {
    const onConfirm = vi.fn();
    render(<ConfirmResetButton onConfirm={onConfirm}>Start over</ConfirmResetButton>);
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveTextContent("Tap again to confirm");
  });

  it("confirms on the second tap and resets its own label", () => {
    const onConfirm = vi.fn();
    render(<ConfirmResetButton onConfirm={onConfirm}>Start over</ConfirmResetButton>);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(button).toHaveTextContent("Start over");
  });

  it("disarms after the timeout, so a tap minutes later starts over from unarmed", () => {
    const onConfirm = vi.fn();
    render(<ConfirmResetButton onConfirm={onConfirm}>Start over</ConfirmResetButton>);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    act(() => {
      vi.advanceTimersByTime(ARM_TIMEOUT_MS + 1);
    });
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(button).toHaveTextContent("Tap again to confirm");
  });
});
