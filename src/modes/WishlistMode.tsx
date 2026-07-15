import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { findBestWishAssignment, rankLabel, wishPoints, type WishAssignment, type WishPlayer } from "../lib/wish";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import { byId, REACH_TARGET } from "../data/factions";
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
import { HirelingSetup } from "../components/HirelingSetup";
import { VagabondCharacterSetup } from "../components/VagabondCharacterSetup";
import { KnaveCaptainSetup } from "../components/KnaveCaptainSetup";

interface WishState {
  phase: "setup" | "pass" | "rank" | "done";
  seats: WishPlayer[];
  turn: number;
  result: WishAssignment | null;
  error: string;
}

const initialState: WishState = { phase: "setup", seats: [], turn: 0, result: null, error: "" };

type WishAction =
  | { type: "START"; seats: WishPlayer[] }
  | { type: "SHOW" }
  | { type: "TOGGLE_PICK"; id: string; wishCount: number }
  | { type: "SUBMIT"; result: WishAssignment | null }
  | { type: "RESET" };

function wishReducer(state: WishState, action: WishAction): WishState {
  switch (action.type) {
    case "START":
      return { phase: "pass", seats: action.seats, turn: 0, result: null, error: "" };
    case "SHOW":
      return { ...state, phase: "rank" };
    case "TOGGLE_PICK": {
      const seats = state.seats.map((p, i) => {
        if (i !== state.turn) return p;
        const rank = p.picks.indexOf(action.id);
        let picks: string[];
        if (rank >= 0) {
          picks = p.picks.slice();
          picks.splice(rank, 1);
        } else if (p.picks.length < action.wishCount) {
          picks = [...p.picks, action.id];
        } else {
          picks = p.picks;
        }
        return { ...p, picks };
      });
      return { ...state, seats };
    }
    case "SUBMIT": {
      const newTurn = state.turn + 1;
      if (newTurn < state.seats.length) return { ...state, turn: newTurn, phase: "pass" };
      if (!action.result)
        return {
          ...state,
          phase: "rank",
          error: "Couldn’t find a reach-safe combination of 13 factions for this many players — try the adventurous toggle.",
        };
      return { ...state, turn: newTurn, result: action.result, phase: "done" };
    }
    case "RESET":
      return initialState;
  }
}

export function WishlistMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget, wishCount } =
    useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.wish", wishReducer, initialState);

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  const handleConfirm = () => {
    const isLast = state.turn + 1 >= state.seats.length;
    const result = isLast
      ? findBestWishAssignment(state.seats, availableFactions.filter((f) => f.id !== "vagabond2"), effTarget, wishCount)
      : null;
    dispatch({ type: "SUBMIT", result });
  };

  if (state.phase === "setup") {
    const pointsNote = Array.from({ length: wishCount }, (_, i) => wishPoints(i, wishCount)).join(" / ");
    return (
      <section>
        <Explainer id="exp-wish" summary="How this works">
          Everyone secretly ranks their top <b>{wishCount}</b> factions, best to worst. The app then checks every
          reach-safe combination of factions and picks whichever assignment makes the table happiest overall
          (points double with each better rank — <span>{pointsNote}</span>) — nobody sees the others’ picks until
          the reveal. If someone ends up with none of their <span>{wishCount}</span> picks, the reveal suggests
          giving them a +1 VP head start — a house rule, not from the Law, so use it or skip it as you like.
          Adjust how many picks each player gets in Settings.
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
            onClick={() =>
              dispatch({ type: "START", seats: shuffleArr(playerNames().map((name) => ({ name, picks: [] }))) })
            }
          >
            Shuffle seats &amp; start
          </button>
        </div>
      </section>
    );
  }

  const orderItems: OrderItem[] = state.seats.map((p, i) => {
    const submitted = p.picks.length === wishCount && (state.phase === "done" || i < state.turn);
    const isCurrent = state.phase !== "done" && i === state.turn;
    return {
      name: p.name,
      first: i === 0,
      current: isCurrent,
      done: submitted,
      who: submitted ? "picks locked in" : isCurrent ? "up now" : i === 0 ? "first player" : `turn ${i + 1}`,
    };
  });

  if (state.phase === "pass" || state.phase === "rank") {
    const player = state.seats[state.turn];
    const actorKey = `wish-${state.turn}`;

    return (
      <PassDeviceGate
        actorName={player.name}
        actorKey={actorKey}
        onAcknowledge={() => {
          if (state.phase === "pass") dispatch({ type: "SHOW" });
        }}
        detail={<OrderList items={orderItems} />}
      >
        <section>
          <div className="picker-banner">
            <b>{player.name}</b> — tap {wishCount} factions in the order you want them, best to worst.
          </div>
          <GridLegend />
          <div className="grid">
            {availableFactions
              .filter((f) => f.id !== "vagabond2")
              .map((f) => {
                const rank = player.picks.indexOf(f.id);
                return (
                  <FactionCard
                    key={f.id}
                    faction={f}
                    reachBadge
                    selected={rank >= 0}
                    rankBadge={rank >= 0 ? rank + 1 : undefined}
                    onClick={() => dispatch({ type: "TOGGLE_PICK", id: f.id, wishCount })}
                  />
                );
              })}
          </div>
          <div className="btn-row">
            <button className="btn" disabled={player.picks.length !== wishCount} onClick={handleConfirm}>
              {player.picks.length === wishCount ? `Lock in my top ${wishCount}` : `Pick ${wishCount - player.picks.length} more`}
            </button>
          </div>
          <p className="note" style={{ color: "var(--danger)" }}>
            {state.error}
          </p>
        </section>
      </PassDeviceGate>
    );
  }

  // done
  const { assign, score, total } = state.result!;
  const rec = REACH_TARGET[playerCount];
  const maxScore = state.seats.length * wishPoints(0, wishCount);
  const finalFactionIds = new Set(assign);
  const summaryItems: SummaryItem[] = state.seats.map((p, i) => {
    const id = assign[i];
    const f = byId[id];
    const rank = p.picks.indexOf(id);
    const matchLabel = rank >= 0 ? rankLabel(rank) : "not on their list";
    const wishlistNames = p.picks.map((pid) => byId[pid].name).join(" › ");
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
          {p.name} — {f.name} <span className="law-ref">({matchLabel})</span>{" "}
          {rank < 0 && <span className="tier-tag comfortable">+1 VP suggested (house rule)</span>}
        </>
      ),
      sub: `reach ${f.reach} · ${f.type} · wanted: ${wishlistNames}`,
    };
  });

  return (
    <section>
      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} extra={
        <>
          &nbsp;·&nbsp; Happiness <b>{score}</b> / {maxScore}
        </>
      } />
      <SummaryList items={summaryItems} />
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <HirelingSetup storageKey="wish" finalFactionIds={finalFactionIds} />
      <VagabondCharacterSetup storageKey="wish" finalFactionIds={finalFactionIds} />
      <KnaveCaptainSetup storageKey="wish" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
