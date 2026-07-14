import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import type { Faction } from "../types";
import { Explainer } from "../components/Explainer";
import { NameInputs } from "../components/NameInputs";
import { FactionCard } from "../components/FactionCard";
import { OrderList, type OrderItem } from "../components/OrderList";
import { SummaryList, type SummaryItem } from "../components/SummaryList";
import { SetupChecklist } from "../components/SetupChecklist";
import { ConfirmResetButton } from "../components/ConfirmResetButton";

interface PoolSlot {
  faction: Faction;
  lockedInsurgent: boolean;
  takenBy: string | null;
}
interface Pick {
  seatIndex: number;
  poolIndex: number;
}
interface DraftState {
  phase: "setup" | "draft" | "done";
  seats: string[];
  pool: PoolSlot[];
  pickQueue: number[];
  picks: Pick[];
  error: string;
}

const initialState: DraftState = { phase: "setup", seats: [], pool: [], pickQueue: [], picks: [], error: "" };

type DraftAction =
  | { type: "DEAL_ERROR"; error: string }
  | { type: "DEAL_OK"; seats: string[]; pool: PoolSlot[]; pickQueue: number[] }
  | { type: "PICK"; poolIndex: number }
  | { type: "UNDO" }
  | { type: "RESET" };

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "DEAL_ERROR":
      return { ...state, error: action.error };
    case "DEAL_OK":
      return { phase: "draft", seats: action.seats, pool: action.pool, pickQueue: action.pickQueue, picks: [], error: "" };
    case "PICK": {
      const seatIndex = state.pickQueue[state.picks.length];
      const pool = state.pool.map((slot, i) =>
        i === action.poolIndex ? { ...slot, takenBy: state.seats[seatIndex] } : slot,
      );
      const picks = [...state.picks, { seatIndex, poolIndex: action.poolIndex }];
      return { ...state, pool, picks, phase: picks.length === state.seats.length ? "done" : "draft" };
    }
    case "UNDO": {
      if (!state.picks.length) return state;
      const last = state.picks[state.picks.length - 1];
      const pool = state.pool.map((slot, i) => (i === last.poolIndex ? { ...slot, takenBy: null } : slot));
      return { ...state, pool, picks: state.picks.slice(0, -1), phase: "draft" };
    }
    case "RESET":
      return initialState;
  }
}

export function DraftMode() {
  const { playerCount, availableFactions, playerNames } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.draft", draftReducer, initialState);
  const [keepInsurgents, setKeepInsurgents] = useState(false);

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  const handleDeal = () => {
    const doKeepInsurgents = playerCount !== 2 || keepInsurgents;
    const drop = Math.random() < 0.5 ? "vagabond" : "knaves"; // never both in one game (A.8.1)
    let cards = availableFactions.filter((f) => f.id !== "vagabond2" && f.id !== drop);
    if (!doKeepInsurgents) cards = cards.filter((f) => f.type === "militant");

    const militants = cards.filter((f) => f.type === "militant");
    const others = cards.filter((f) => f.type !== "militant");
    if (militants.length === 0) {
      dispatch({ type: "DEAL_ERROR", error: "The pool needs at least one militant faction (A.8.2)." });
      return;
    }
    if (cards.length < playerCount + 1) {
      dispatch({
        type: "DEAL_ERROR",
        error: `Not enough factions in the pool: need ${playerCount + 1}, have ${cards.length}.`,
      });
      return;
    }

    // A.4 — random seating and first player
    const seats = shuffleArr(playerNames().slice());

    // A.8.2 — one militant first, then one card per player from the rest
    shuffleArr(militants);
    const seed = militants.shift()!;
    const rest = shuffleArr(militants.concat(others)).slice(0, playerCount);
    const pool: PoolSlot[] = [seed, ...rest].map((f) => ({ faction: f, lockedInsurgent: false, takenBy: null }));
    const last = pool[pool.length - 1];
    if (last.faction.type === "insurgent") last.lockedInsurgent = true; // A.8.2.II

    // A.8.3 — picks start with the last player in turn order, going backwards
    const pickQueue = Array.from({ length: playerCount }, (_, i) => playerCount - 1 - i);
    dispatch({ type: "DEAL_OK", seats, pool, pickQueue });
  };

  if (state.phase === "setup") {
    return (
      <section>
        <h2>Seats <span className="law-ref">(A.4)</span></h2>
        <p className="note">Names are optional. Seating order and first player are randomized when you deal.</p>
        <NameInputs />

        {playerCount === 2 && (
          <>
            <p className="note">Two players: all insurgent setup cards are removed before dealing (A.8.2.I).</p>
            <label className="note" style={{ display: "block" }}>
              <input type="checkbox" checked={keepInsurgents} onChange={(e) => setKeepInsurgents(e.target.checked)} />{" "}
              Keep insurgents in the deal (two-player groups playing with hirelings, feeling adventurous)
            </label>
          </>
        )}

        <div className="btn-row">
          <button className="btn" onClick={handleDeal}>
            Shuffle seats &amp; deal
          </button>
        </div>
        <p className="note" style={{ color: "var(--danger)" }}>
          {state.error}
        </p>
      </section>
    );
  }

  const militantChosen = state.picks.some((p) => state.pool[p.poolIndex].faction.type === "militant");
  const currentPicker = state.pickQueue[state.picks.length];

  if (state.phase === "draft") {
    const orderItems: OrderItem[] = state.seats.map((name, i) => {
      const pick = state.picks.find((p) => p.seatIndex === i);
      return {
        name,
        first: i === 0,
        current: i === currentPicker,
        done: !!pick,
        who: pick ? state.pool[pick.poolIndex].faction.name : i === 0 ? "first player" : `turn ${i + 1}`,
      };
    });

    return (
      <section>
        <h2>Turn Order</h2>
        <OrderList items={orderItems} />

        <h2>Draft Pool <span className="law-ref">(A.8.2)</span></h2>
        <Explainer id="exp-draft-board" summary="How this works">
          One militant was dealt first, then one card per player. Picks go from the last player in turn order,
          backwards. Set up your faction immediately when you pick (A.8.3).
        </Explainer>
        <div className="picker-banner">
          <b>{state.seats[currentPicker]}</b> picks now — tap a faction, then set it up before the next pick.
        </div>
        <div className="grid">
          {state.pool.map((slot, idx) => {
            const locked = slot.lockedInsurgent && !militantChosen && !slot.takenBy;
            return (
              <div key={idx}>
                <FactionCard
                  faction={slot.faction}
                  reachBadge
                  lockBadge={
                    locked ? (
                      <>
                        <span className="padlock">🔒</span>locked until a militant is chosen (A.8.2.II)
                      </>
                    ) : undefined
                  }
                  takenBy={slot.takenBy ?? undefined}
                  disabled={locked || !!slot.takenBy}
                  onClick={() => dispatch({ type: "PICK", poolIndex: idx })}
                />
                {slot.faction.dealNote && !slot.takenBy && <p className="pool-note">{slot.faction.dealNote}</p>}
              </div>
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
  const leftover = state.pool.find((s) => !s.takenBy);
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const pick = state.picks.find((p) => p.seatIndex === i)!;
    const f = state.pool[pick.poolIndex].faction;
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
          {name} — {f.name}
        </>
      ),
      sub: `turn ${i + 1}${i === 0 ? " (first player)" : ""} · reach ${f.reach} · ${f.type}`,
    };
  });
  if (leftover) {
    summaryItems.push({
      img: `assets/factions/${leftover.faction.img ?? leftover.faction.id}.png`,
      primary: `Left in the pool — ${leftover.faction.name}`,
      sub: "return it to the box",
      faded: true,
    });
  }

  return (
    <section>
      <h2>The Woodland is Set</h2>
      <SummaryList items={summaryItems} />
      <h2>Before You Begin</h2>
      <SetupChecklist variant="advanced" />
      <div className="btn-row">
        <button className="btn secondary" onClick={() => dispatch({ type: "UNDO" })}>
          Undo last pick
        </button>
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New draft</ConfirmResetButton>
      </div>
    </section>
  );
}
