import { byId } from "../data/factions";

/** Can one faction per remaining hand still give reach ≥ target with a militant
    at the table? Hands are tiny (≤3 cards, ≤6 hands), so brute force is fine. */
export function draftSolvable(
  hands: string[][],
  sum: number,
  hasMilitant: boolean,
  target: number,
): boolean {
  if (!hands.length) return hasMilitant && sum >= target;
  const rest = hands.slice(1);
  for (const id of hands[0]) {
    const f = byId[id];
    if (draftSolvable(rest, sum + f.reach, hasMilitant || f.type === "militant", target)) return true;
  }
  return false;
}

/** Cards the player at queue position qi can pick without stranding the table. */
export function legalIds(
  handsQ: string[][],
  qi: number,
  sum: number,
  mil: boolean,
  target: number,
): string[] {
  const rest = handsQ.slice(qi + 1);
  return handsQ[qi].filter((id) => {
    const f = byId[id];
    return draftSolvable(rest, sum + f.reach, mil || f.type === "militant", target);
  });
}

/** True if, from queue position qi on, every player is guaranteed at least two
    legal cards no matter what the players before them picked. */
export function strongOk(
  handsQ: string[][],
  qi: number,
  sum: number,
  mil: boolean,
  target: number,
  memo: Map<string, boolean>,
): boolean {
  if (qi >= handsQ.length) return true;
  const key = `${qi}|${sum}|${mil}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const legal = legalIds(handsQ, qi, sum, mil, target);
  let ok = legal.length >= 2;
  for (const id of ok ? legal : []) {
    const f = byId[id];
    if (!strongOk(handsQ, qi + 1, sum + f.reach, mil || f.type === "militant", target, memo)) {
      ok = false;
      break;
    }
  }
  memo.set(key, ok);
  return ok;
}
