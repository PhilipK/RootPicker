import { useEffect, useReducer } from "react";
import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { buildTierLineup, tierOf, TIERS, TIER_LABEL } from "../lib/tiers";
import { byId, REACH_TARGET } from "../data/factions";
import type { Tier, TieredPlayer } from "../types";
import { Explainer } from "../components/Explainer";
import { FactionCard } from "../components/FactionCard";
import { OrderList, type OrderItem } from "../components/OrderList";
import { SummaryList, type SummaryItem } from "../components/SummaryList";
import { SetupChecklist } from "../components/SetupChecklist";
import { ReachStampLine } from "../components/ReachStampLine";

interface TTPick {
  seatIndex: number;
  id: string;
}
interface TTState {
  phase: "setup" | "pick" | "done";
  seats: TieredPlayer[];
  lineup: string[];
  pickOrder: number[];
  picks: TTPick[];
  error: string;
}

const initialState: TTState = { phase: "setup", seats: [], lineup: [], pickOrder: [], picks: [], error: "" };

type TTAction =
  | { type: "ERROR"; error: string }
  | { type: "START_OK"; seats: TieredPlayer[]; lineup: string[]; pickOrder: number[] }
  | { type: "PICK"; id: string }
  | { type: "UNDO" }
  | { type: "RESET" };

function ttReducer(state: TTState, action: TTAction): TTState {
  switch (action.type) {
    case "ERROR":
      return { ...state, error: action.error };
    case "START_OK":
      return { phase: "pick", seats: action.seats, lineup: action.lineup, pickOrder: action.pickOrder, picks: [], error: "" };
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
  const [state, dispatch] = useReducer(ttReducer, initialState);

  useEffect(() => {
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
    const seats = shuffleArr(players.slice());
    const pickOrder = seats.map((_, i) => i).sort((a, b) => RANK[seats[a].tier] - RANK[seats[b].tier]);
    dispatch({ type: "START_OK", seats, lineup: built.lineup, pickOrder });
  };

  if (state.phase === "setup") {
    return (
      <section>
        <h2>Players &amp; Experience</h2>
        <p className="note">
          Names are optional. Tag each player <b>New</b>, <b>Comfortable</b>, or <b>Expert</b>. Seating order and
          first player are randomized when you start.
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
        <Explainer id="exp-tt" summary="How this works">
          The app builds one lineup with enough beginner-friendly factions for your New players and enough
          moderate ones for your Comfortable players, then everyone picks — New players choose first from the
          easy end, Experts pick last from whatever’s left.
        </Explainer>
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

  const orderItems: OrderItem[] = state.seats.map((p, i) => {
    const pick = state.picks.find((x) => x.seatIndex === i);
    const isCurrent = state.phase === "pick" && i === state.pickOrder[state.picks.length];
    return {
      name: p.name,
      first: i === 0,
      current: isCurrent,
      done: !!pick,
      who: pick ? byId[pick.id].name : i === 0 ? "first player" : "waiting to pick",
      nameExtra: <span className={`tier-tag ${p.tier}`}>{TIER_LABEL[p.tier]}</span>,
    };
  });

  if (state.phase === "pick") {
    const seat = state.pickOrder[state.picks.length];
    const player = state.seats[seat];
    const maxTier = player.tier === "new" ? 1 : player.tier === "comfortable" ? 2 : 3;
    const taken = new Set(state.picks.map((p) => p.id));

    return (
      <section>
        <h2>Turn Order</h2>
        <OrderList items={orderItems} />
        <div className="picker-banner">
          <b>{player.name}</b> <span className={`tier-tag ${player.tier}`}>{TIER_LABEL[player.tier]}</span> picks
          now.
        </div>
        <div className="grid">
          {state.lineup
            .filter((id) => !taken.has(id) && tierOf(byId[id]) <= maxTier)
            .map((id) => (
              <FactionCard key={id} faction={byId[id]} reachBadge onClick={() => dispatch({ type: "PICK", id })} />
            ))}
        </div>
        <div className="btn-row">
          <button className="btn secondary" disabled={!state.picks.length} onClick={() => dispatch({ type: "UNDO" })}>
            Undo last pick
          </button>
          <button className="btn secondary" onClick={() => dispatch({ type: "RESET" })}>
            Start over
          </button>
        </div>
      </section>
    );
  }

  // done
  const total = state.lineup.reduce((s, id) => s + byId[id].reach, 0);
  const rec = REACH_TARGET[playerCount];
  const summaryItems: SummaryItem[] = state.seats.map((p, i) => {
    const pick = state.picks.find((x) => x.seatIndex === i)!;
    const f = byId[pick.id];
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
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
      <div className="btn-row">
        <button className="btn secondary" onClick={() => dispatch({ type: "UNDO" })}>
          Undo last pick
        </button>
        <button className="btn secondary" onClick={() => dispatch({ type: "RESET" })}>
          New game
        </button>
      </div>
    </section>
  );
}
