import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import {
  findBestOmakaseAssignment,
  plateLine,
  SLIDER_DEFAULT,
  SLIDER_MAX,
  SLIDER_MIN,
  type OmakaseAssignment,
  type OmakaseAxis,
  type OmakasePlayer,
} from "../lib/omakase";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import { byId, REACH_TARGET } from "../data/factions";
import { Explainer } from "../components/Explainer";
import { NameInputs } from "../components/NameInputs";
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

interface OmakaseState {
  phase: "setup" | "pass" | "slide" | "done";
  seats: OmakasePlayer[];
  turn: number;
  result: OmakaseAssignment | null;
  error: string;
}

const initialState: OmakaseState = { phase: "setup", seats: [], turn: 0, result: null, error: "" };

type OmakaseAction =
  | { type: "START"; seats: OmakasePlayer[] }
  | { type: "SHOW" }
  | { type: "SET_AXIS"; axis: OmakaseAxis; value: number }
  | { type: "SUBMIT"; result: OmakaseAssignment | null }
  | { type: "RESET" };

function omakaseReducer(state: OmakaseState, action: OmakaseAction): OmakaseState {
  switch (action.type) {
    case "START":
      return { phase: "pass", seats: action.seats, turn: 0, result: null, error: "" };
    case "SHOW":
      return { ...state, phase: "slide" };
    case "SET_AXIS": {
      const seats = state.seats.map((p, i) => (i === state.turn ? { ...p, [action.axis]: action.value } : p));
      return { ...state, seats };
    }
    case "SUBMIT": {
      const newTurn = state.turn + 1;
      if (newTurn < state.seats.length) return { ...state, turn: newTurn, phase: "pass" };
      if (!action.result)
        return {
          ...state,
          phase: "slide",
          error: "Couldn’t find a reach-safe lineup for this many players — try the adventurous toggle.",
        };
      return { ...state, turn: newTurn, result: action.result, phase: "done" };
    }
    case "RESET":
      return initialState;
  }
}

const AXES: Array<{ key: OmakaseAxis; label: string; low: string; high: string }> = [
  { key: "aggression", label: "Aggression", low: "Peaceful", high: "Warlike" },
  { key: "footprint", label: "Footprint", low: "Compact", high: "Sprawling" },
  { key: "complexity", label: "Complexity", low: "Simple", high: "Brain-burning" },
];

export function OmakaseMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.omakase", omakaseReducer, initialState);

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  const handleConfirm = () => {
    const isLast = state.turn + 1 >= state.seats.length;
    const result = isLast
      ? findBestOmakaseAssignment(state.seats, availableFactions, effTarget, Math.random)
      : null;
    dispatch({ type: "SUBMIT", result });
  };

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-omakase" summary="How this works">
          Everyone secretly sets three mood sliders — aggression, footprint, complexity — describing the game they
          want to play, not the faction they want to play. No faction names or art show up until the reveal, so
          nobody can dial toward a favorite. The app then checks every reach-safe combination of factions and seats
          whichever legal assignment fits the whole table's dials best overall, with an honest one-line note on how
          close each plate actually landed.
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
              dispatch({
                type: "START",
                seats: shuffleArr(
                  playerNames().map((name) => ({
                    name,
                    aggression: SLIDER_DEFAULT,
                    footprint: SLIDER_DEFAULT,
                    complexity: SLIDER_DEFAULT,
                  })),
                ),
              })
            }
          >
            Shuffle seats &amp; start
          </button>
        </div>
      </section>
    );
  }

  const orderItems: OrderItem[] = state.seats.map((p, i) => {
    const submitted = state.phase === "done" || i < state.turn;
    const isCurrent = state.phase !== "done" && i === state.turn;
    return {
      name: p.name,
      first: i === 0,
      current: isCurrent,
      done: submitted,
      who: submitted ? "sliders set" : isCurrent ? "up now" : i === 0 ? "first player" : `turn ${i + 1}`,
    };
  });

  if (state.phase === "pass" || state.phase === "slide") {
    const player = state.seats[state.turn];
    const actorKey = `omakase-${state.turn}`;

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
            <b>{player.name}</b> — set the mood for the game you want, not the faction. No one else can see this.
          </div>
          {state.error && (
            <p className="note" style={{ color: "var(--danger)" }}>
              {state.error}
            </p>
          )}
          {AXES.map(({ key, label, low, high }) => (
            <div className="mood-slider" key={key}>
              <div className="mood-slider-labels">
                <span>{low}</span>
                <b>{label}</b>
                <span>{high}</span>
              </div>
              <input
                type="range"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={1}
                value={player[key]}
                aria-label={`${label}: ${low} to ${high}`}
                onChange={(e) => dispatch({ type: "SET_AXIS", axis: key, value: Number(e.target.value) })}
              />
            </div>
          ))}
          <div className="btn-row">
            <button className="btn" onClick={handleConfirm}>
              Lock in my mood
            </button>
          </div>
        </section>
      </PassDeviceGate>
    );
  }

  // done
  const { assign, distances, total } = state.result!;
  const rec = REACH_TARGET[playerCount];
  const finalFactionIds = new Set(assign);
  const summaryItems: SummaryItem[] = state.seats.map((p, i) => {
    const f = byId[assign[i]];
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
          {p.name} — {f.name}
        </>
      ),
      sub: `reach ${f.reach} · ${f.type} · ${plateLine(distances[i])}`,
    };
  });

  return (
    <section>
      <h2>The Kitchen Has Decided</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <HirelingSetup storageKey="omakase" finalFactionIds={finalFactionIds} />
      <VagabondCharacterSetup storageKey="omakase" finalFactionIds={finalFactionIds} />
      <KnaveCaptainSetup storageKey="omakase" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
