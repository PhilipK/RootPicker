import { byId } from "../data/factions";

/** Legality of the set of factions players actually hold: reach total and the
    Vagabond/Knaves exclusion (A.8.1). Militant presence is deliberately not
    enforced, matching Wishlist's subset legality. Second Vagabond never enters
    this mode, so its pairing rule doesn't apply. */
export function multisetLegal(ids: string[], target: number): boolean {
  if (ids.includes("vagabond") && ids.includes("knaves")) return false;
  return ids.reduce((s, id) => s + byId[id].reach, 0) >= target;
}

/** One executed trading cycle, in execution order. `moves` covers every seat
    in the cycle (a self-loop is a single move with from === to). Stall trades
    additionally list the factions that entered play from the market and the
    ones released back into it. */
export interface TradeCycle {
  moves: { seatIndex: number; from: string; to: string }[];
  fromStalls: string[];
  released: string[];
}

export interface TradeResult {
  /** assign[seatIndex] = faction the seat ends up playing */
  assign: string[];
  cycles: TradeCycle[];
}

interface Node {
  kind: "seat" | "stall";
  /** seat index, or the stall's faction id */
  ref: number | string;
}

const nodeKey = (n: Node) => (n.kind === "seat" ? `s${n.ref}` : `v${n.ref}`);

/**
 * Top Trading Cycles over the dealt lineup plus market stalls (unheld
 * factions). Each seat points at the current holder of its most-preferred
 * still-available faction — its own deal acting as the implicit end of its
 * ranking — and each stall points at the highest-priority unfinalized seat.
 * Cycles execute one at a time. Seat-only cycles permute the player multiset
 * and are always legal; a cycle through stalls swaps factions in and out of
 * play, so it only executes if the resulting player multiset stays legal —
 * otherwise the offending want is blocked and the pointer moves down the
 * ranking. Blocks are cleared after every executed cycle, since a trade that
 * was illegal earlier can become legal once the market has moved.
 *
 * Deterministic: all randomness (deal, stall priority) is injected by the
 * caller.
 */
export function runTrade(
  deal: string[],
  prefs: string[][],
  stallsIn: string[],
  stallPriority: number[],
  target: number,
): TradeResult {
  const n = deal.length;
  const assign: (string | null)[] = new Array(n).fill(null);
  const stalls = new Set(stallsIn);
  const cycles: TradeCycle[] = [];
  const blocked = new Set<string>(); // `${seat}|${factionId}`

  // Ranked wants with the seat's own deal as the cutoff: anything a player
  // ranked below what they already hold can never improve their lot.
  const effPrefs = deal.map((own, i) => {
    const list = prefs[i].slice(0, prefs[i].includes(own) ? prefs[i].indexOf(own) : undefined);
    return [...list, own];
  });

  const unfinalized = () => deal.map((_, i) => i).filter((i) => assign[i] === null);

  const holderOf = (id: string): Node | null => {
    const seat = unfinalized().find((i) => deal[i] === id);
    if (seat !== undefined) return { kind: "seat", ref: seat };
    if (stalls.has(id)) return { kind: "stall", ref: id };
    return null;
  };

  const playerMultiset = () =>
    deal.map((held, i) => assign[i] ?? held);

  while (unfinalized().length) {
    // Build the pointer graph. Every node has out-degree exactly 1, so a walk
    // from any node must close a cycle.
    const pointers = new Map<string, { node: Node; wants: string }>();
    for (const i of unfinalized()) {
      const want = effPrefs[i].find((id) => holderOf(id) !== null && !blocked.has(`${i}|${id}`))!;
      pointers.set(`s${i}`, { node: holderOf(want)!, wants: want });
    }
    const stallTarget = stallPriority.find((i) => assign[i] === null)!;
    for (const id of stalls) {
      pointers.set(`v${id}`, { node: { kind: "seat", ref: stallTarget }, wants: deal[stallTarget] });
    }

    // Walk until a node repeats, then slice out the cycle.
    const seen: string[] = [];
    let cur: Node = { kind: "seat", ref: unfinalized()[0] };
    while (!seen.includes(nodeKey(cur))) {
      seen.push(nodeKey(cur));
      cur = pointers.get(nodeKey(cur))!.node;
    }
    const cycle = seen.slice(seen.indexOf(nodeKey(cur)));

    const cycleSeats = cycle.filter((k) => k.startsWith("s")).map((k) => Number(k.slice(1)));
    const cycleStalls = cycle.filter((k) => k.startsWith("v")).map((k) => k.slice(1));

    if (cycleStalls.length) {
      // Stall factions enter play; the factions of the seats stalls point at
      // leave it. Gate the swap on the resulting player multiset.
      const entering = cycleSeats.map((i) => pointers.get(`s${i}`)!.wants).filter((id) => cycleStalls.includes(id));
      const leaving = cycleStalls.map((id) => pointers.get(`v${id}`)!.wants);
      const next = playerMultiset().filter((id) => !leaving.includes(id)).concat(entering);
      if (!multisetLegal(next, target)) {
        for (const i of cycleSeats) {
          const wants = pointers.get(`s${i}`)!.wants;
          if (cycleStalls.includes(wants)) {
            blocked.add(`${i}|${wants}`);
            break; // breaking one pointer breaks the cycle
          }
        }
        continue;
      }
    }

    // Execute: every seat in the cycle receives what it points at and exits;
    // every stall in the cycle releases the pointed seat's faction back into
    // the market in exchange for the one it gave up.
    const moves = cycleSeats.map((i) => ({ seatIndex: i, from: deal[i], to: pointers.get(`s${i}`)!.wants }));
    const released = cycleStalls.map((id) => pointers.get(`v${id}`)!.wants);
    for (const m of moves) assign[m.seatIndex] = m.to;
    for (const id of cycleStalls) stalls.delete(id);
    for (const id of released) stalls.add(id);
    cycles.push({ moves, fromStalls: cycleStalls, released });
    blocked.clear();
  }

  return { assign: assign as string[], cycles };
}
