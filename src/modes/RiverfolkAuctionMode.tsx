import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { reachBlockReason } from "../lib/reach";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import { byId, REACH_TARGET } from "../data/factions";
import { Explainer } from "../components/Explainer";
import { NameInputs } from "../components/NameInputs";
import { FactionCard } from "../components/FactionCard";
import { GridLegend } from "../components/GridLegend";
import { SetupHero } from "../components/SetupHero";
import { DisabledReasonNote } from "../components/DisabledReasonNote";
import { PassDeviceGate } from "../components/PassDeviceGate";
import { OrderList, type OrderItem } from "../components/OrderList";
import { SummaryList, type SummaryItem } from "../components/SummaryList";
import { SetupChecklist } from "../components/SetupChecklist";
import { ReachStampLine } from "../components/ReachStampLine";
import { ConfirmResetButton } from "../components/ConfirmResetButton";
import { HirelingSetup } from "../components/HirelingSetup";
import { VagabondCharacterSetup } from "../components/VagabondCharacterSetup";
import { KnaveCaptainSetup } from "../components/KnaveCaptainSetup";

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

/**
 * Effective VP cost per seat: you never pay more than one above the highest
 * bid strictly below yours, so overbidding blind can't cost more than needed
 * to keep your spot (tied bids pay the same).
 */
function effectiveCosts(bids: number[]): number[] {
  return bids.map((bid) => {
    const lower = bids.filter((b) => b < bid);
    return lower.length ? Math.min(bid, Math.max(...lower) + 1) : bid;
  });
}

/**
 * Starting VP per seat: effective costs shifted so the biggest spender starts
 * at 0 and everyone else starts ahead — the Root score track has no negatives.
 */
export function startingBonuses(bids: number[]): number[] {
  const costs = effectiveCosts(bids);
  const max = Math.max(0, ...costs);
  return costs.map((c) => max - c);
}

const startsAt = (vp: number) => ` — starts at ${vp > 0 ? `+${vp}` : "0"} VP`;

export function RiverfolkAuctionMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.auction", auctionReducer, initialState);
  const [bidChoice, setBidChoice] = useState<number | null>(null);
  const [tapReason, setTapReason] = useState<string | null>(null);

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-auction" summary="How this works">
          Pick order is worth something — so buy it. Each player secretly bids <b>0–{MAX_BID} VP</b>; the highest
          bidder picks their faction first (ties broken randomly). Overbids are trimmed to one above the highest
          bid below them, and since the score track has no negatives, everyone is then shifted up so the biggest
          spender starts at 0 and the rest start with bonus VP. Bid 0 if you don’t care and enjoy picking from
          what’s left with a head start. The starting-VP system is a house rule, not from the Law. Picks are
          checked so the table always reaches the required total.
        </Explainer>
        <SetupHero />
        <h2>Seats</h2>
        <p className="note">Names are optional. Seating order and first player are randomized when you start.</p>
        <NameInputs />
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

  if (state.phase === "pass" || state.phase === "bid") {
    const actorName = state.seats[state.bids.length];
    const actorKey = `auction-bid-${state.bids.length}`;
    const lockBid = () => {
      if (bidChoice === null) return;
      const last = state.bids.length + 1 === state.seats.length;
      const pickOrder = last ? bidPickOrder([...state.bids, bidChoice]) : null;
      dispatch({ type: "BID", bid: bidChoice, pickOrder });
      setBidChoice(null);
    };
    return (
      <PassDeviceGate
        actorName={actorName}
        actorKey={actorKey}
        onAcknowledge={() => {
          if (state.phase === "pass") dispatch({ type: "SHOW" });
        }}
        detail={
          <p className="note">
            <span className="stamp neutral">
              {state.bids.length} / {state.seats.length} bids in
            </span>
          </p>
        }
        footer={<ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>}
      >
        <section>
          <div className="picker-banner">
            <b>{actorName}</b> — how many VP is picking early worth to you?
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
          <p className="note">
            You never pay more than one above the highest bid below yours, and once all bids are in, scores are
            shifted so the biggest spender starts at 0 — everyone else starts with bonus VP.
          </p>
          <div className="btn-row">
            <button className="btn" disabled={bidChoice === null} onClick={lockBid}>
              Lock in my bid
            </button>
          </div>
        </section>
      </PassDeviceGate>
    );
  }

  if (state.phase === "reveal") {
    const bonuses = startingBonuses(state.bids);
    const items: OrderItem[] = state.pickOrder.map((seatIndex, rank) => ({
      name: state.seats[seatIndex],
      first: seatIndex === 0,
      current: rank === 0,
      done: false,
      who: `bid ${state.bids[seatIndex]} VP — picks ${rank === 0 ? "first" : `#${rank + 1}`}${startsAt(bonuses[seatIndex])}`,
    }));
    return (
      <section>
        <h2>Bids Revealed</h2>
        {/* lines flip in from the bottom of the list upward, so the winning bid lands last */}
        <div className="bid-reveal">
          <OrderList items={items} />
        </div>
        <p className="note">
          Highest bid picks first; ties were broken randomly. Overbids were trimmed to one above the next bid,
          then everyone was shifted up so the biggest spender starts at 0 — no negative scores to track. ★ marks
          the game’s first player.
        </p>
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
    const bonuses = startingBonuses(state.bids);
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
          <b>{state.seats[seat]}</b> picks now{startsAt(bonuses[seat])}.
        </div>
        <GridLegend corner />
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
                onDisabledTap={reason ? () => setTapReason(reason) : undefined}
                onClick={() => dispatch({ type: "PICK", id: f.id })}
              />
            );
          })}
        </div>
        <DisabledReasonNote reason={tapReason} onDismiss={() => setTapReason(null)} />
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
  const doneBonuses = startingBonuses(state.bids);
  const finalFactionIds = new Set(state.picks.map((p) => p.id));
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
      sub: `reach ${f.reach} · ${f.type} · bid ${state.bids[i]} VP${startsAt(doneBonuses[i])} (house rule)`,
    };
  });

  return (
    <section>
      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      <p className="note">
        Start each player’s score marker on the value shown above — the biggest spender starts at 0 and everyone
        else starts ahead, so there are no negative scores to track.
      </p>
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <HirelingSetup storageKey="auction" finalFactionIds={finalFactionIds} />
      <VagabondCharacterSetup storageKey="auction" finalFactionIds={finalFactionIds} />
      <KnaveCaptainSetup storageKey="auction" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <button className="btn secondary" onClick={() => dispatch({ type: "UNDO" })}>
          Undo last pick
        </button>
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
