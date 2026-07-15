import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { buildTierLineup, tierOf, TIERS, TIER_LABEL } from "../lib/tiers";
import { otherHalf } from "../lib/fav";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import { byId, REACH_TARGET } from "../data/factions";
import type { Tier, TieredPlayer } from "../types";
import { Explainer } from "../components/Explainer";
import { FactionCard } from "../components/FactionCard";
import { GridLegend } from "../components/GridLegend";
import { SetupHero } from "../components/SetupHero";
import { OrderList, type OrderItem } from "../components/OrderList";
import { SummaryList, type SummaryItem } from "../components/SummaryList";
import { SetupChecklist } from "../components/SetupChecklist";
import { ReachStampLine } from "../components/ReachStampLine";
import { ConfirmResetButton } from "../components/ConfirmResetButton";
import { HirelingSetup } from "../components/HirelingSetup";

interface TTPick {
  seatIndex: number;
  id: string;
}
interface TTState {
  phase: "setup" | "pick" | "done";
  seats: TieredPlayer[];
  pool: string[];
  pickOrder: number[];
  picks: TTPick[];
  error: string;
}

const initialState: TTState = { phase: "setup", seats: [], pool: [], pickOrder: [], picks: [], error: "" };

type TTAction =
  | { type: "ERROR"; error: string }
  | { type: "START_OK"; seats: TieredPlayer[]; pool: string[]; pickOrder: number[] }
  | { type: "PICK"; id: string }
  | { type: "UNDO" }
  | { type: "RESET" };

function ttReducer(state: TTState, action: TTAction): TTState {
  switch (action.type) {
    case "ERROR":
      return { ...state, error: action.error };
    case "START_OK":
      return { phase: "pick", seats: action.seats, pool: action.pool, pickOrder: action.pickOrder, picks: [], error: "" };
    case "PICK": {
      const seatIndex = state.pickOrder[state.picks.length];
      const picks = [...state.picks, { seatIndex, id: action.id }];
      return { ...state, picks, phase: picks.length === state.pickOrder.length ? "done" : "pick" };
    }
    case "UNDO":
      if (!state.picks.length) return state;
      return { ...state, picks: state.picks.slice(0, -1), phase: "pick" };
    case "RESET":
      return initialState;
  }
}

const RANK: Record<Tier, number> = { new: 0, comfortable: 1, expert: 2 };

export function TeachingTiersMode() {
  const {
    playerCount,
    availableFactions,
    playerNames,
    adventurous,
    setAdventurous,
    effTarget,
    tiers,
    setTiers,
    names,
    setNames,
  } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.tt", ttReducer, initialState);

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  const tierAt = (i: number): Tier => tiers[i] || "comfortable";
  const setTierAt = (i: number, tier: Tier) => {
    const next = tiers.slice();
    next[i] = tier;
    setTiers(next);
  };

  const handleStart = () => {
    const names = playerNames();
    const players: TieredPlayer[] = names.map((name, i) => ({ name, tier: tierAt(i) }));
    const nNew = players.filter((p) => p.tier === "new").length;
    const nComf = players.filter((p) => p.tier === "comfortable").length;
    const nExp = players.filter((p) => p.tier === "expert").length;

    const built = buildTierLineup(nNew, nComf, nExp, availableFactions, effTarget);
    if (!built) {
      dispatch({
        type: "ERROR",
        error:
          nNew > 4
            ? "Too many New players — there aren’t that many beginner-friendly factions. Mark someone Comfortable instead."
            : "Couldn’t build a lineup that reaches the total for this class mix — try the adventurous toggle.",
      });
      return;
    }
    const pool = availableFactions.filter((f) => f.id !== "vagabond2").map((f) => f.id);
    const seats = shuffleArr(players.slice());
    const pickOrder = seats.map((_, i) => i).sort((a, b) => RANK[seats[a].tier] - RANK[seats[b].tier]);
    dispatch({ type: "START_OK", seats, pool, pickOrder });
  };

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-tt" summary="How this works">
          New players choose first, only from beginner-friendly factions; then Comfortable, then Expert picks
          last from whatever’s left. To offset the draft advantage, turn order in the game is reversed — whoever
          picked last goes first.
        </Explainer>
        <SetupHero />
        <h2>Players &amp; Experience</h2>
        <p className="note">
          Names are optional. Tag each player <b>New</b>, <b>Comfortable</b>, or <b>Expert</b>. Seating order is
          randomized when you start; whoever picks last goes first in the game.
        </p>
        <div>
          {Array.from({ length: playerCount }, (_, i) => (
            <div className="tt-row" style={{ margin: "6px 0" }} key={i}>
              <span className="seat">{i + 1}.</span>
              <input
                type="text"
                placeholder={`Player ${i + 1}`}
                value={names[i] || ""}
                onChange={(e) => {
                  const next = names.slice();
                  next[i] = e.target.value;
                  setNames(next);
                }}
              />
              <div className="tt-tiers">
                {TIERS.map((t) => (
                  <button
                    key={t}
                    className={t}
                    aria-pressed={tierAt(i) === t}
                    onClick={() => setTierAt(i, t)}
                  >
                    {TIER_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <label className="note" style={{ display: "block" }}>
          <input type="checkbox" checked={adventurous} onChange={(e) => setAdventurous(e.target.checked)} />{" "}
          Adventurous group — allow any mix that reaches 17+
        </label>
        <div className="btn-row">
          <button className="btn" onClick={handleStart}>
            Shuffle seats &amp; build lineup
          </button>
        </div>
        <p className="note" style={{ color: "var(--danger)" }}>
          {state.error}
        </p>
      </section>
    );
  }

  const firstSeat = state.pickOrder[state.pickOrder.length - 1];
  const orderItems: OrderItem[] = state.seats.map((p, i) => {
    const pick = state.picks.find((x) => x.seatIndex === i);
    const isCurrent = state.phase === "pick" && i === state.pickOrder[state.picks.length];
    return {
      name: p.name,
      first: i === firstSeat,
      current: isCurrent,
      done: !!pick,
      who: pick ? byId[pick.id].name : isCurrent ? "up now" : i === firstSeat ? "first player" : `turn ${i + 1}`,
      nameExtra: <span className={`tier-tag ${p.tier}`}>{TIER_LABEL[p.tier]}</span>,
    };
  });

  if (state.phase === "pick") {
    const seat = state.pickOrder[state.picks.length];
    const player = state.seats[seat];
    const maxTier = player.tier === "new" ? 1 : player.tier === "comfortable" ? 2 : 3;
    const taken = new Set(state.picks.map((p) => p.id));
    const blocked = new Set(state.picks.map((p) => otherHalf(p.id)).filter((id): id is string => !!id));
    const accReach = state.picks.reduce((s, p) => s + byId[p.id].reach, 0);
    const remaining = state.pickOrder.slice(state.picks.length + 1).map((i) => state.seats[i].tier);
    const remCounts = { new: 0, comfortable: 0, expert: 0 } as Record<Tier, number>;
    remaining.forEach((t) => remCounts[t]++);

    const stillFeasible = (id: string) => {
      const half = otherHalf(id);
      const poolAfter = state.pool
        .filter((x) => x !== id && x !== half && !taken.has(x) && !blocked.has(x))
        .map((x) => byId[x]);
      const remTarget = effTarget - accReach - byId[id].reach;
      return !!buildTierLineup(remCounts.new, remCounts.comfortable, remCounts.expert, poolAfter, remTarget);
    };
    const candidates = state.pool.filter(
      (id) => !taken.has(id) && !blocked.has(id) && tierOf(byId[id]) <= maxTier && stillFeasible(id),
    );

    return (
      <section>
        <h2>Turn Order</h2>
        <OrderList items={orderItems} />
        <div className="picker-banner">
          <b>{player.name}</b> <span className={`tier-tag ${player.tier}`}>{TIER_LABEL[player.tier]}</span> picks
          now.
        </div>
        <GridLegend />
        <div className="grid">
          {candidates.map((id) => (
            <FactionCard key={id} faction={byId[id]} reachBadge onClick={() => dispatch({ type: "PICK", id })} />
          ))}
        </div>
        <div className="btn-row">
          <button className="btn secondary" disabled={!state.picks.length} onClick={() => dispatch({ type: "UNDO" })}>
            Undo last pick
          </button>
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  // done
  const total = state.picks.reduce((s, p) => s + byId[p.id].reach, 0);
  const rec = REACH_TARGET[playerCount];
  const finalFactionIds = new Set(state.picks.map((p) => p.id));
  const summaryItems: SummaryItem[] = state.seats.map((p, i) => {
    const pick = state.picks.find((x) => x.seatIndex === i)!;
    const f = byId[pick.id];
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === firstSeat ? "★ " : ""}
          {p.name} — {f.name} <span className={`tier-tag ${p.tier}`}>{TIER_LABEL[p.tier]}</span>
        </>
      ),
      sub: `reach ${f.reach} · ${f.type}`,
    };
  });

  return (
    <section>
      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <HirelingSetup storageKey="tt" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <button className="btn secondary" onClick={() => dispatch({ type: "UNDO" })}>
          Undo last pick
        </button>
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
