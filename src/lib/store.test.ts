import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useActiveMode, useRaffleTicketCountOverride } from "./store";

/** Reset the shared jsdom location/history between tests so hash-routing
 *  state from one test can't leak into the next. */
function resetLocation() {
  window.history.replaceState(null, "", "/");
}

describe("useActiveMode — hash routing", () => {
  beforeEach(resetLocation);
  afterEach(resetLocation);

  it("falls back to home when there is no hash and nothing stored", () => {
    const { result } = renderHook(() => useActiveMode());
    expect(result.current[0]).toBe("home");
  });

  it("restores a stored mode when there is no hash on load", () => {
    window.localStorage.setItem("rootpicker.mode", JSON.stringify("wish"));
    const { result } = renderHook(() => useActiveMode());
    expect(result.current[0]).toBe("wish");
  });

  it("a valid hash on load wins as a deep link, even over a stored mode", () => {
    window.localStorage.setItem("rootpicker.mode", JSON.stringify("wish"));
    window.location.hash = "#draft";
    const { result } = renderHook(() => useActiveMode());
    expect(result.current[0]).toBe("draft");
  });

  it("an invalid hash on load falls back to the stored mode", () => {
    window.localStorage.setItem("rootpicker.mode", JSON.stringify("fav"));
    window.location.hash = "#not-a-real-mode";
    const { result } = renderHook(() => useActiveMode());
    expect(result.current[0]).toBe("fav");
  });

  it("changing mode updates the URL hash", () => {
    const { result } = renderHook(() => useActiveMode());
    act(() => result.current[1]("cut"));
    expect(result.current[0]).toBe("cut");
    expect(window.location.hash).toBe("#cut");
  });

  it("returning to home clears the hash", async () => {
    const { result } = renderHook(() => useActiveMode());
    act(() => result.current[1]("cut"));

    // We arrived at "cut" via an in-app push, so `set("home")` prefers a real
    // `history.back()` over pushing a fresh entry (see store.ts). The mode
    // state updates immediately; `history.back()` itself resolves
    // asynchronously, so the address bar catches up a tick later — same as
    // a real back-button press.
    act(() => result.current[1]("home"));
    expect(result.current[0]).toBe("home");

    // jsdom (like real browsers) resolves history.back() over a few queued
    // tasks rather than synchronously, so poll instead of assuming one tick.
    await waitFor(() => expect(window.location.hash).toBe(""));
  });

  it("a simulated hashchange (physical back/forward) updates the active mode", () => {
    const { result } = renderHook(() => useActiveMode());
    act(() => result.current[1]("auction"));
    expect(result.current[0]).toBe("auction");

    // Simulate the browser's back button: the hash reverts and the browser
    // dispatches "hashchange" for us (we don't call `set` in this path).
    act(() => {
      window.location.hash = "";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current[0]).toBe("home");
  });

  it("persists the active mode to localStorage as it changes", () => {
    const { result } = renderHook(() => useActiveMode());
    act(() => result.current[1]("bounty"));
    expect(JSON.parse(window.localStorage.getItem("rootpicker.mode")!)).toBe("bounty");
  });
});

describe("useRaffleTicketCountOverride", () => {
  it("has no override until one is set — callers default it to player count", () => {
    const { result } = renderHook(() => useRaffleTicketCountOverride());
    expect(result.current[0]).toBeNull();
  });

  it("clamps a set override to [1, 20]", () => {
    const { result } = renderHook(() => useRaffleTicketCountOverride());
    act(() => result.current[1](99));
    expect(result.current[0]).toBe(20);
    act(() => result.current[1](0));
    expect(result.current[0]).toBe(1);
  });

  it("returns to null (auto) when reset", () => {
    const { result } = renderHook(() => useRaffleTicketCountOverride());
    act(() => result.current[1](7));
    expect(result.current[0]).toBe(7);
    act(() => result.current[1](null));
    expect(result.current[0]).toBeNull();
  });
});
