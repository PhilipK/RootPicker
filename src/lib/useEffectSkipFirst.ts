import { useEffect, useRef, type DependencyList } from "react";

/** Like useEffect, but skips the run on mount. Used for "reset this mode if
    playerCount/owned-factions change while it's active" — those effects must
    not fire on mount too, or they'd immediately stomp on a session restored
    from localStorage. */
export function useEffectSkipFirst(effect: () => void, deps: DependencyList) {
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
