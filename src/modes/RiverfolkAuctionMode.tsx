import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { reachBlockReason } from "../lib/reach";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import { byId, REACH_TARGET } from "../data/factions";
import { PlayerStepper } from "../components/PlayerStepper";
import { Explainer } from "../components/Explainer";
import { NameInputs } from "../components/NameInputs";
import { FactionCard } from "../components/FactionCard";
import { OrderList, type OrderItem } from "../components/OrderList";
import { SummaryList, type SummaryItem } from "../components/SummaryList";
import { SetupChecklist } from "../components/SetupChecklist";
import { ReachStampLine } from "../components/ReachStampLine";
import { ConfirmResetButton } from "../components/ConfirmResetButton";

export const MAX_BID = 5;

interface AuctionPick {
  seatIndex: number;
  id: string;
}
interface AuctionState {
  phase: "setup" | "pass" | "bid" | "reveal" | "pick" | "done";
  seats: string[];
  /** bids[i] is seat i's bid; grows one entry per locked-in bid */
  bids: number[];
  /** seat indices in picking order (highest bid first), set once all bids are in */
  pickOrder: number[];
  picks: AuctionPick[];
}

const initialState: AuctionState = { phase: "setup", seats: [], bids: [], pickOrder: [], picks: [] };

type AuctionAction =
  | { type: "START"; seats: string[] }
  | { type: "SHOW" }
  | { type: "BID"; bid: number; pickOrder: number[] | null }
  | { type: "BEGIN_PICKS" }
  | { type: "PICK"; id: string }
  | { type: "UNDO" }
  | { type: "RESET" };

function auctionReducer(state: AuctionState, action: AuctionAction): AuctionState {
  switch (action.type) {
    case "START":
      return { ...initialState, seats: action.seats, phase: "pass" };
    case "SHOW":
      return { ...state, phase: "bid" };
    case "BID": {
      const bids = [...state.bids, action.bid];
      if (action.pickOrder) return { ...state, bids, pickOrder: action.pickOrder, phase: "reveal" };
      return { ...state, bids, phase: "pass" };
    }
    case "BEGIN_PICKS":
      return { ...state, phase: "pick" };
    case "PICK": {
      const seatIndex = state.pickOrder[state.picks.length];
      const picks = [...state.picks, { seatIndex, id: action.id }];
      return { ...state, picks, phase: picks.length === state.seats.length ? "done" : "pick" };
    }
    case "UNDO":
      if (!state.picks.length) return state;
      return { ...state, picks: state.picks.slice(0, -1), phase: "pick" };
    case "RESET":
      return { ...initialState };
  }
}

/** Seat indices sorted by bid, highest first, ties broken randomly. */
function bidPickOrder(bids: number[]): number[] {
  const salt = bids.map(() => Math.random());
  return bids
    .map((_, i) => i)
    .sort((a, b) => bids[b] - bids[a] || salt[a] - salt[b]);
}

const handicap = (bid: number) => (bid > 0 ? ` — starts at −${bid} VP` : "");

export function RiverfolkAuctionMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.auction", auctionReducer, initialState);
  const [bidChoice, setBidChoice] = useState<number | null>(null);

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  if (state.phase === "setup") {
    return (
      <section>
        <h2>Players &amp; Seats</h2>
        <PlayerStepper />
        <p className="note">Names are optional. Seating order and first player are randomized when you start.</p>
        <NameInputs />
        <Explainer id="exp-auction" summary="How this works">
          Pick order is worth something — so buy it. Each player secretly bids <b>0–{MAX_BID} VP</b>; the highest
          bidder picks their faction first and starts the game that many VP behind (ties broken randomly). Bid 0
          if you don’t care and enjoy picking from what’s left with no handicap. The starting-VP handicap is a
          house rule, not from the Law. Picks are checked so the table always reaches the required total.
        </Explainer>
        <label className="note" style={{ display: "block" }}>
          <input type="checkbox" checked={adventurous} onChange={(e) => setAdventurous(e.target.checked)} />{" "}
          Adventurous group — allow any mix that reaches 17+
        </label>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() => dispatch({ type: "START", seats: shuffleArr(playerNames().slice()) })}
          >
            Shuffle seats &amp; start bidding
          </button>
        </div>
      </section>
    );
  }

  if (state.phase === "pass") {
    return (
      <section>
        <div className="picker-banner">
          Pass the device to <b>{state.seats[state.bids.length]}</b> — only they should look.
          &nbsp;<span className="stamp neutral">{state.bids.length} / {state.seats.length} bids in</span>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => dispatch({ type: "SHOW" })}>
            Enter my bid
          </button>
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  if (state.phase === "bid") {
    const lockBid = () => {
      if (bidChoice === null) return;
      const last = state.bids.length + 1 === state.seats.length;
      const pickOrder = last ? bidPickOrder([...state.bids, bidChoice]) : null;
      dispatch({ type: "BID", bid: bidChoice, pickOrder });
      setBidChoice(null);
    };
    return (
      <section>
        <div className="picker-banner">
          <b>{state.seats[state.bids.length]}</b> — how many VP is picking early worth to you?
        </div>
        <div className="btn-row">
          {Array.from({ length: MAX_BID + 1 }, (_, v) => (
            <button
              key={v}
              className={`btn ${bidChoice === v ? "" : "secondary"}`}
              aria-pressed={bidChoice === v}
              onClick={() => setBidChoice(v)}
            >
              {v} VP
            </button>
          ))}
        </div>
        <p className="note">You’ll start the game at −{bidChoice ?? 0} VP if you bid {bidChoice ?? 0}.</p>
        <div className="btn-row">
          <button className="btn" disabled={bidChoice === null} onClick={lockBid}>
            Lock in my bid
          </button>
        </div>
      </section>
    );
  }

  if (state.phase === "reveal") {
    const items: OrderItem[] = state.pickOrder.map((seatIndex, rank) => ({
      name: state.seats[seatIndex],
      first: seatIndex === 0,
      current: rank === 0,
      done: false,
      who: `bid ${state.bids[seatIndex]} VP — picks ${rank === 0 ? "first" : `#${rank + 1}`}${handicap(state.bids[seatIndex])}`,
    }));
    return (
      <section>
        <h2>Bids Revealed</h2>
        <OrderList items={items} />
        <p className="note">Highest bid picks first; ties were broken randomly. ★ marks the game’s first player.</p>
        <div className="btn-row">
          <button className="btn" onClick={() => dispatch({ type: "BEGIN_PICKS" })}>
            Start picking
          </button>
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  if (state.phase === "pick") {
    const seat = state.pickOrder[state.picks.length];
    const selected = new Set(state.picks.map((p) => p.id));
    const orderItems: OrderItem[] = state.pickOrder.map((seatIndex, rank) => {
      const pick = state.picks.find((p) => p.seatIndex === seatIndex);
      return {
        name: state.seats[seatIndex],
        first: seatIndex === 0,
        current: seatIndex === seat,
        done: !!pick,
        who: pick ? byId[pick.id].name : `bid ${state.bids[seatIndex]} VP — picks #${rank + 1}`,
      };
    });

    return (
      <section>
        <h2>Pick Order</h2>
        <OrderList items={orderItems} />
        <div className="picker-banner">
          <b>{state.seats[seat]}</b> picks now{handicap(state.bids[seat])}.
        </div>
        <div className="grid">
          {availableFactions.map((f) => {
            if (selected.has(f.id)) {
              const takenBy = state.seats[state.picks.find((p) => p.id === f.id)!.seatIndex];
              return <FactionCard key={f.id} faction={f} reachBadge takenBy={takenBy} disabled />;
            }
            const reason = reachBlockReason(selected, f.id, playerCount, availableFactions, effTarget);
            return (
              <FactionCard
                key={f.id}
                faction={f}
                reachBadge
                cornerTag
                dimmed={!!reason}
                disabled={!!reason}
                title={reason ?? undefined}
                onClick={() => dispatch({ type: "PICK", id: f.id })}
              />
            );
          })}
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
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const pick = state.picks.find((p) => p.seatIndex === i)!;
    const f = byId[pick.id];
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
          {name} — {f.name}
        </>
      ),
      sub: `reach ${f.reach} · ${f.type} · bid ${state.bids[i]} VP${
        state.bids[i] > 0 ? ` — starts at −${state.bids[i]} VP (house rule)` : " — no handicap"
      }`,
    };
  });

  return (
    <section>
      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      <p className="note">
        Track a bid handicap by starting that player’s score marker the bid amount before “0” — they must earn
        those points back before they truly score.
      </p>
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <div className="btn-row">
        <button className="btn secondary" onClick={() => dispatch({ type: "UNDO" })}>
          Undo last pick
        </button>
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
