import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistedReducer } from "./persistedReducer";

type CountState = { count: number };
type CountAction = { type: "INC" };
function countReducer(state: CountState, action: CountAction): CountState {
  switch (action.type) {
    case "INC":
      return { count: state.count + 1 };
  }
}

describe("usePersistedReducer", () => {
  it("starts from initialState when nothing is stored yet", () => {
    const { result } = renderHook(() => usePersistedReducer("test.count", countReducer, { count: 0 }));
    expect(result.current[0]).toEqual({ count: 0 });
  });

  it("writes state to localStorage on every change", () => {
    const { result } = renderHook(() => usePersistedReducer("test.count", countReducer, { count: 0 }));
    act(() => result.current[1]({ type: "INC" }));
    expect(JSON.parse(localStorage.getItem("test.count")!)).toEqual({ count: 1 });
  });

  it("restores an in-progress session on the next mount — surviving an accidental refresh", () => {
    const { result, unmount } = renderHook(() => usePersistedReducer("test.count", countReducer, { count: 0 }));
    act(() => result.current[1]({ type: "INC" }));
    act(() => result.current[1]({ type: "INC" }));
    unmount(); // stands in for a page refresh / tab close

    const { result: reloaded } = renderHook(() => usePersistedReducer("test.count", countReducer, { count: 0 }));
    expect(reloaded.current[0]).toEqual({ count: 2 });
  });

  it("keeps separate sessions independent by storage key", () => {
    const { result: a } = renderHook(() => usePersistedReducer("test.a", countReducer, { count: 0 }));
    const { result: b } = renderHook(() => usePersistedReducer("test.b", countReducer, { count: 0 }));
    act(() => a.current[1]({ type: "INC" }));
    expect(a.current[0]).toEqual({ count: 1 });
    expect(b.current[0]).toEqual({ count: 0 });
  });

  it("supports a custom serialize/deserialize pair for state that JSON can't round-trip (e.g. a Set)", () => {
    interface SetState {
      ids: Set<string>;
    }
    type SetAction = { type: "ADD"; id: string };
    const setReducer = (state: SetState, action: SetAction): SetState => {
      const ids = new Set(state.ids);
      ids.add(action.id);
      return { ids };
    };
    const serialize = (s: SetState) => JSON.stringify({ ids: [...s.ids] });
    const deserialize = (raw: string): SetState => ({ ids: new Set(JSON.parse(raw).ids as string[]) });

    const { result, unmount } = renderHook(() =>
      usePersistedReducer("test.lineup", setReducer, { ids: new Set<string>() }, serialize, deserialize),
    );
    act(() => result.current[1]({ type: "ADD", id: "vagabond" }));
    unmount();

    const { result: reloaded } = renderHook(() =>
      usePersistedReducer("test.lineup", setReducer, { ids: new Set<string>() }, serialize, deserialize),
    );
    expect(reloaded.current[0].ids.has("vagabond")).toBe(true);
  });
});
