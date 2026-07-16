import { StrictMode } from "react";
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEffectSkipFirst } from "./useEffectSkipFirst";

describe("useEffectSkipFirst", () => {
  it("does not run on mount", () => {
    const effect = vi.fn();
    renderHook(({ dep }) => useEffectSkipFirst(effect, [dep]), { initialProps: { dep: 1 } });
    expect(effect).not.toHaveBeenCalled();
  });

  it("runs when a dependency changes after mount", () => {
    const effect = vi.fn();
    const { rerender } = renderHook(({ dep }) => useEffectSkipFirst(effect, [dep]), { initialProps: { dep: 1 } });
    rerender({ dep: 2 });
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("does not re-run just because the component re-rendered with the same deps", () => {
    const effect = vi.fn();
    const { rerender } = renderHook(({ dep }) => useEffectSkipFirst(effect, [dep]), { initialProps: { dep: 1 } });
    rerender({ dep: 1 });
    expect(effect).not.toHaveBeenCalled();
  });

  it("does not fire on StrictMode's dev-only double effect run", () => {
    // StrictMode runs mount effects twice with the same deps; a naive
    // skip-first flag treats the second run as "after mount" and fires,
    // which used to reset a session restored from localStorage on reload.
    const effect = vi.fn();
    const { rerender } = renderHook(({ dep }) => useEffectSkipFirst(effect, [dep]), {
      initialProps: { dep: 1 },
      wrapper: StrictMode,
    });
    expect(effect).not.toHaveBeenCalled();

    // a real dep change must still get through, exactly once
    rerender({ dep: 2 });
    expect(effect).toHaveBeenCalledTimes(1);
  });
});
