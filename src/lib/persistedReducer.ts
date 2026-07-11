import { useEffect, useReducer, type Reducer } from "react";

/** Same as useReducer, but the state is restored from localStorage on mount
    and written back on every change — so an in-progress session (seating,
    picks, phase) survives an accidental refresh or closed tab. */
export function usePersistedReducer<S, A>(
  key: string,
  reducer: Reducer<S, A>,
  initialState: S,
  serialize: (state: S) => string = JSON.stringify,
  deserialize: (raw: string) => S = JSON.parse,
): [S, React.Dispatch<A>] {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? init : deserialize(raw);
    } catch {
      return init;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, serialize(state));
    } catch {
      /* storage full or unavailable — session just won't survive a refresh */
    }
    // serialize/deserialize are expected to be stable (module-level) functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state]);

  return [state, dispatch];
}
