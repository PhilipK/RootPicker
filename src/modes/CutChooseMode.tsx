import { useEffect, useReducer } from "react";
import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { reachBlockReason } from "../lib/reach";
import { byId, REACH_TARGET } from "../data/factions";
import { PlayerStepper } from "../components/PlayerStepper";
import { Explainer } from "../components/Explainer";
import { NameInputs } from "../components/NameInputs";
import { FactionCard } from "../components/FactionCard";
import { OrderList, type OrderItem } from "../components/OrderList";
import { SummaryList, type SummaryItem } from "../components/SummaryList";
import { SetupChecklist } from "../components/SetupChecklist";
import { ReachStampLine } from "../components/ReachStampLine";

interface CutPick {
  seatIndex: number;
  id: string;
}
interface CutState {
  phase: "setup" | "build" | "pick" | "done";
  seats: string[];
  wardenIdx: number;
  lineup: Set<string>;
  pickOrder: number[];
  picks: CutPick[];
  wardenPick: string | null;
}

const initialState: CutState = {
  phase: "setup",
  seats: [],
  wardenIdx: 0,
  lineup: new Set(),
  pickOrder: [],
  picks: [],
  wardenPick: null,
};

type CutAction =
  | { type: "START"; seats: string[]; wardenIdx: number }
  | { type: "TOGGLE"; id: string }
  | { type: "CONFIRM_LINEUP" }
  | { type: "PICK"; id: string }
  | { type: "UNDO" }
  | { type: "RESET" };

function cutReducer(state: CutState, action: CutAction): CutState {
  switch (action.type) {
    case "START":
      return { ...initialState, seats: action.seats, wardenIdx: action.wardenIdx, phase: "build" };
    case "TOGGLE": {
      const lineup = new Set(state.lineup);
      if (lineup.has(action.id)) lineup.delete(action.id);
      else lineup.add(action.id);
      if (action.id === "vagabond" && !lineup.has("vagabond")) lineup.delete("vagabond2");
      return { ...state, lineup };
    }
    case "CONFIRM_LINEUP": {
      const pickOrder = state.seats.map((_, i) => i).filter((i) => i !== state.wardenIdx);
      return { ...state, pickOrder, picks: [], phase: "pick" };
    }
    case "PICK": {
      const seatIndex = state.pickOrder[state.picks.length];
      const picks = [...state.picks, { seatIndex, id: action.id }];
      if (picks.length === state.pickOrder.length) {
        const taken = new Set(picks.map((p) => p.id));
        const wardenPick = [...state.lineup].find((id) => !taken.has(id)) ?? null;
        return { ...state, picks, wardenPick, phase: "done" };
      }
      return { ...state, picks };
    }
    case "UNDO":
      if (!state.picks.length) return state;
      return { ...state, picks: state.picks.slice(0, -1), wardenPick: null, phase: "pick" };
    case "RESET":
      return { ...initialState };
  }
}

export function CutChooseMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = useReducer(cutReducer, initialState);

  useEffect(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  if (state.phase === "setup") {
    return (
      <section>
        <h2>Players &amp; Seats</h2>
        <PlayerStepper />
        <p className="note">
          Names are optional. Seating order, first player, and the Warden are randomized when you start.
        </p>
        <NameInputs />
        <Explainer id="exp-cut" summary="How this works">
          One randomly chosen player is the <b>Warden</b>. They build a lineup of exactly as many factions as
          there are players, meeting the reach total. Then everyone else picks one from the lineup, in turn order
          — and the Warden plays whatever’s left. Classic cut-and-choose: the fairest lineup is one the Warden
          would be happy to end up with.
        </Explainer>
        <label className="note" style={{ display: "block" }}>
          <input type="checkbox" checked={adventurous} onChange={(e) => setAdventurous(e.target.checked)} />{" "}
          Adventurous group — allow any mix that reaches 17+
        </label>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() =>
              dispatch({
                type: "START",
                seats: shuffleArr(playerNames().slice()),
                wardenIdx: Math.floor(Math.random() * playerCount),
              })
            }
          >
            Shuffle seats &amp; choose Warden
          </button>
        </div>
      </section>
    );
  }

  if (state.phase === "build") {
    const total = [...state.lineup].reduce((s, id) => s + byId[id].reach, 0);
    const full = state.lineup.size === playerCount;
    const cls = total >= effTarget && full ? "ok" : "neutral";

    return (
      <section>
        <div className="picker-banner">
          <b>{state.seats[state.wardenIdx]}</b> is the Warden — build a lineup of exactly <b>{playerCount}</b>{" "}
          factions with reach <b>{effTarget}+</b>. You’ll play whatever’s left once everyone else has picked.{" "}
          &nbsp;
          <span className={`stamp ${cls}`}>
            {state.lineup.size} / {playerCount} chosen · reach {total} / {effTarget}
          </span>
        </div>

        <div className="grid">
          {availableFactions
            .filter((f) => f.id !== "vagabond2" || state.lineup.has("vagabond"))
            .map((f) => {
              const isSel = state.lineup.has(f.id);
              const reason = isSel ? null : reachBlockReason(state.lineup, f.id, playerCount, availableFactions, effTarget);
              return (
                <FactionCard
                  key={f.id}
                  faction={f}
                  reachBadge
                  cornerTag
                  selected={isSel}
                  dimmed={!!reason}
                  disabled={!!reason}
                  title={reason ?? undefined}
                  onClick={() => dispatch({ type: "TOGGLE", id: f.id })}
                />
              );
            })}
        </div>
        <div className="btn-row">
          <button className="btn" disabled={!(full && total >= effTarget)} onClick={() => dispatch({ type: "CONFIRM_LINEUP" })}>
            Lock in the lineup
          </button>
        </div>
      </section>
    );
  }

  const orderItems: OrderItem[] = state.seats.map((name, i) => {
    if (i === state.wardenIdx) {
      return {
        name,
        first: i === 0,
        current: false,
        done: state.phase === "done",
        who: state.wardenPick ? `Warden — ${byId[state.wardenPick].name}` : "Warden — gets what’s left",
      };
    }
    const pick = state.picks.find((p) => p.seatIndex === i);
    const isCurrent = state.phase === "pick" && i === state.pickOrder[state.picks.length];
    return {
      name,
      first: i === 0,
      current: isCurrent,
      done: !!pick,
      who: pick ? byId[pick.id].name : i === 0 ? "first player" : "waiting to pick",
    };
  });

  if (state.phase === "pick") {
    const seat = state.pickOrder[state.picks.length];
    const taken = new Set(state.picks.map((p) => p.id));

    return (
      <section>
        <h2>Turn Order</h2>
        <OrderList items={orderItems} />
        <div className="picker-banner">
          <b>{state.seats[seat]}</b> picks now.
        </div>
        <div className="grid">
          {[...state.lineup]
            .filter((id) => !taken.has(id))
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
  const total = [...state.lineup].reduce((s, id) => s + byId[id].reach, 0);
  const rec = REACH_TARGET[playerCount];
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const id = i === state.wardenIdx ? state.wardenPick! : state.picks.find((p) => p.seatIndex === i)!.id;
    const f = byId[id];
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
          {name} — {f.name}
        </>
      ),
      sub: `reach ${f.reach} · ${f.type} · ${i === state.wardenIdx ? "Warden’s leftover" : "picked"}`,
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
