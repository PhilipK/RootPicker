import { useEffect, useRef, type DependencyList } from "react";

/** Like useEffect, but only runs when the deps have actually changed from the
    previous run — which skips both the run on mount (no previous deps yet)
    and StrictMode's dev-only effect re-run, which fires without a dep change.
    Used for "reset this mode if playerCount/owned-factions change while it's
    active" — those resets must only fire on a real change, or they'd stomp on
    a session restored from localStorage. */
export function useEffectSkipFirst(effect: () => void, deps: DependencyList) {
  const prevDeps = useRef<DependencyList | null>(null);
  useEffect(() => {
    const prev = prevDeps.current;
    prevDeps.current = deps;
    const changed = prev !== null && (prev.length !== deps.length || deps.some((d, i) => !Object.is(d, prev[i])));
    if (changed) effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
