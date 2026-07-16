import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { combinations, rankLabel } from "../lib/wish";
import { runTrade, type TradeResult } from "../lib/trade";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useLocalStorage } from "../lib/store";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import { byId, REACH_TARGET } from "../data/factions";
import type { Faction } from "../types";
import { Explainer } from "../components/Explainer";
import { NameInputs } from "../components/NameInputs";
import { FactionCard } from "../components/FactionCard";
import { GridLegend } from "../components/GridLegend";
import { SetupHero } from "../components/SetupHero";
import { PassDeviceGate } from "../components/PassDeviceGate";
import { OrderList, type OrderItem } from "../components/OrderList";
import { SummaryList, type SummaryItem } from "../components/SummaryList";
import { SetupChecklist } from "../components/SetupChecklist";
import { ReachStampLine } from "../components/ReachStampLine";
import { ConfirmResetButton } from "../components/ConfirmResetButton";
import { FloatingConfirm } from "../components/FloatingConfirm";
import { RevealCeremony, type RevealSeatItem } from "../components/RevealCeremony";
import { HirelingSetup } from "../components/HirelingSetup";
import { VagabondCharacterSetup } from "../components/VagabondCharacterSetup";
import { KnaveCaptainSetup } from "../components/KnaveCaptainSetup";

interface TradeState {
  phase: "setup" | "pass" | "rank" | "done";
  seats: string[];
  /** deal[seatIndex] = the faction that seat was dealt (its TTC endowment) */
  deal: string[];
  /** unheld factions sitting in the market stalls at the start */
  stalls: string[];
  /** shuffled seat order the stalls "prefer" players in (TTC pointing rule) */
  stallPriority: number[];
  turn: number;
  /** prefs[seatIndex] = factions that seat would rather play, best first */
  prefs: string[][];
  result: TradeResult | null;
  error: string;
}

const initialState: TradeState = {
  phase: "setup",
  seats: [],
  deal: [],
  stalls: [],
  stallPriority: [],
  turn: 0,
  prefs: [],
  result: null,
  error: "",
};

type TradeAction =
  | { type: "START"; seats: string[]; deal: string[]; stalls: string[]; stallPriority: number[] }
  | { type: "SHOW" }
  | { type: "TOGGLE_PICK"; id: string }
  | { type: "SUBMIT"; result: TradeResult | null }
  | { type: "ERROR"; error: string }
  | { type: "RESET" };

function tradeReducer(state: TradeState, action: TradeAction): TradeState {
  switch (action.type) {
    case "START":
      return {
        ...initialState,
        phase: "pass",
        seats: action.seats,
        deal: action.deal,
        stalls: action.stalls,
        stallPriority: action.stallPriority,
        prefs: action.seats.map(() => []),
      };
    case "SHOW":
      return { ...state, phase: "rank" };
    case "TOGGLE_PICK": {
      const prefs = state.prefs.map((p, i) => {
        if (i !== state.turn) return p;
        return p.includes(action.id) ? p.filter((x) => x !== action.id) : [...p, action.id];
      });
      return { ...state, prefs };
    }
    case "SUBMIT": {
      const newTurn = state.turn + 1;
      if (newTurn < state.seats.length) return { ...state, turn: newTurn, phase: "pass" };
      return { ...state, turn: newTurn, result: action.result, phase: "done" };
    }
    case "ERROR":
      return { ...state, error: action.error };
    case "RESET":
      return initialState;
  }
}

/** Random legal lineup: pick uniformly among reach-safe playerCount-subsets
    of the pool (Second Vagabond excluded), then shuffle who gets what. */
function dealLineup(pool: Faction[], playerCount: number, target: number): string[] | null {
  const legal = combinations(pool, playerCount).filter((subset) => {
    if (subset.some((f) => f.id === "vagabond") && subset.some((f) => f.id === "knaves")) return false;
    return subset.reduce((s, f) => s + f.reach, 0) >= target;
  });
  if (!legal.length) return null;
  const subset = legal[Math.floor(Math.random() * legal.length)];
  return shuffleArr(subset.map((f) => f.id));
}

export function TradingPostMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.trade", tradeReducer, initialState);
  const [stallsOpen, setStallsOpen] = useLocalStorage("rootpicker.tradeStallsOpen", true);

  const tradePool = availableFactions.filter((f) => f.id !== "vagabond2");

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  const handleStart = () => {
    const deal = dealLineup(tradePool, playerCount, effTarget);
    if (!deal) {
      dispatch({
        type: "ERROR",
        error: "Couldn’t find a reach-safe lineup for this many players — try the adventurous toggle.",
      });
      return;
    }
    const dealt = new Set(deal);
    dispatch({
      type: "START",
      seats: shuffleArr(playerNames().slice()),
      deal,
      stalls: stallsOpen ? tradePool.map((f) => f.id).filter((id) => !dealt.has(id)) : [],
      stallPriority: shuffleArr(deal.map((_, i) => i)),
    });
  };

  const handleConfirm = () => {
    const isLast = state.turn + 1 >= state.seats.length;
    const result = isLast
      ? runTrade(state.deal, state.prefs, state.stalls, state.stallPriority, effTarget)
      : null;
    dispatch({ type: "SUBMIT", result });
  };

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-trade" summary="How this works">
          Everyone is secretly dealt a faction from a reach-safe lineup. Each player then privately ranks the
          factions they'd <b>rather</b> play — ranking nothing means keeping the deal. The app runs Top Trading
          Cycles, the same algorithm real kidney exchanges use: every circle of players whose wishes close a loop
          trades. With the market stalls open, every undealt faction is up for trade too — a player can swap into
          a stall faction when reach allows, releasing theirs to the market. That grants far more wishes, but
          most trades go through the stalls rather than between players; close the stalls for the purist version,
          where only the dealt factions circulate and the deal really matters. Nobody ever ends up worse than
          their deal by their own ranking, and honest ranking is (near enough) the best strategy. This structure
          is a house rule, not from the Law, but nothing about scoring changes.
        </Explainer>
        <SetupHero />
        <h2>Seats</h2>
        <p className="note">Names are optional. Seating order, the deal, and first player are randomized when you start.</p>
        <NameInputs />
        <label className="note" style={{ display: "block" }}>
          <input type="checkbox" checked={stallsOpen} onChange={(e) => setStallsOpen(e.target.checked)} />{" "}
          Open the market stalls — undealt factions can be traded into
        </label>
        <label className="note" style={{ display: "block" }}>
          <input type="checkbox" checked={adventurous} onChange={(e) => setAdventurous(e.target.checked)} />{" "}
          Adventurous group — allow any mix that reaches 17+
        </label>
        <div className="btn-row">
          <button className="btn" onClick={handleStart}>
            Shuffle seats &amp; deal the market
          </button>
        </div>
        <p className="note" style={{ color: "var(--danger)" }}>
          {state.error}
        </p>
      </section>
    );
  }

  const orderItems: OrderItem[] = state.seats.map((name, i) => {
    const submitted = state.phase === "done" || i < state.turn;
    const isCurrent = state.phase !== "done" && i === state.turn;
    return {
      name,
      first: i === 0,
      current: isCurrent,
      done: submitted,
      who: submitted ? "wishes locked in" : isCurrent ? "up now" : i === 0 ? "first player" : `turn ${i + 1}`,
    };
  });

  if (state.phase === "pass" || state.phase === "rank") {
    const seat = state.turn;
    const own = byId[state.deal[seat]];
    const picks = state.prefs[seat];
    // Stalls closed: only the dealt lineup circulates, so only it is worth
    // ranking. The lineup itself (not who holds what) becomes open info,
    // same as any dealt draft pool.
    const dealtSet = new Set(state.deal);
    const rankPool = state.stalls.length ? tradePool : tradePool.filter((f) => dealtSet.has(f.id));

    return (
      <PassDeviceGate
        actorName={state.seats[seat]}
        actorKey={`trade-${seat}`}
        onAcknowledge={() => {
          if (state.phase === "pass") dispatch({ type: "SHOW" });
        }}
        detail={<OrderList items={orderItems} />}
      >
        <section>
          <div className="picker-banner">
            <b>{state.seats[seat]}</b> — you were dealt the <b>{own.name}</b>. Tap the factions you'd{" "}
            <b>rather</b> play, best first. Tap nothing to keep your deal.
          </div>
          <GridLegend />
          <div className="grid">
            {rankPool.map((f) => {
              const isOwn = f.id === own.id;
              const rank = picks.indexOf(f.id);
              return (
                <FactionCard
                  key={f.id}
                  faction={f}
                  reachBadge
                  lockBadge={isOwn ? "your deal" : undefined}
                  selected={rank >= 0}
                  rankBadge={rank >= 0 ? rank + 1 : undefined}
                  disabled={isOwn}
                  title={isOwn ? "This is the faction you hold — you keep it unless a trade improves on it" : undefined}
                  onClick={() => dispatch({ type: "TOGGLE_PICK", id: f.id })}
                />
              );
            })}
          </div>
          <FloatingConfirm ready>
            <button className="btn" onClick={handleConfirm}>
              {picks.length ? `Lock in my ${picks.length} trade ${picks.length === 1 ? "wish" : "wishes"}` : "Keep my deal"}
            </button>
          </FloatingConfirm>
        </section>
      </PassDeviceGate>
    );
  }

  // done
  const { assign, cycles } = state.result!;
  const total = assign.reduce((s, id) => s + byId[id].reach, 0);
  const rec = REACH_TARGET[playerCount];
  const finalFactionIds = new Set(assign);

  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const f = byId[assign[i]];
    const dealt = byId[state.deal[i]];
    const wishes = state.prefs[i];
    const rank = wishes.indexOf(assign[i]);
    // A seat only ever moves to a faction it ranked, so kept-vs-traded and
    // the wish rank between them cover every outcome.
    const matchLabel =
      rank >= 0 ? rankLabel(rank) : wishes.length ? "no wish panned out" : "wished for nothing else";
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
          {name} — {f.name} <span className="law-ref">({matchLabel})</span>
        </>
      ),
      sub:
        assign[i] === state.deal[i]
          ? `kept their deal · reach ${f.reach} · ${f.type}`
          : `dealt ${dealt.name} · reach ${f.reach} · ${f.type}`,
    };
  });

  const revealItems: RevealSeatItem[] = state.seats.map((name, i) => ({
    name,
    faction: byId[assign[i]],
    first: i === 0,
    note: assign[i] === state.deal[i] ? "kept their deal" : `traded away the ${byId[state.deal[i]].name}`,
  }));

  return (
    <section>
      <RevealCeremony storageKey="trade" items={revealItems} />
      <h2>The Trades</h2>
      <ul className="reveal-log">
        {cycles.map((c, i) => {
          if (c.moves.length === 1 && c.moves[0].from === c.moves[0].to) {
            return (
              <li key={i} className="void-line">
                {state.seats[c.moves[0].seatIndex]} keeps the {byId[c.moves[0].from].name}
              </li>
            );
          }
          const moves = c.moves
            .map((m) => `${state.seats[m.seatIndex]} takes the ${byId[m.to].name}`)
            .join(", ");
          const stallNote = c.fromStalls.length
            ? ` — ${c.fromStalls.map((id) => byId[id].name).join(", ")} came out of the stalls; ${c.released
                .map((id) => byId[id].name)
                .join(", ")} went back in`
            : "";
          return (
            <li key={i} className="fav-line">
              Trade: {moves}
              {stallNote}
            </li>
          );
        })}
      </ul>

      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <HirelingSetup storageKey="trade" finalFactionIds={finalFactionIds} />
      <VagabondCharacterSetup storageKey="trade" finalFactionIds={finalFactionIds} />
      <KnaveCaptainSetup storageKey="trade" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
