import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import {
  countVotesForFaction,
  emptyBallots,
  findBestTypecastAssignment,
  typecastTargets,
  type Ballots,
  type TypecastAssignment,
} from "../lib/typecast";
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
import { FloatingConfirm } from "../components/FloatingConfirm";
import { RevealCeremony, type RevealSeatItem } from "../components/RevealCeremony";
import { HirelingSetup } from "../components/HirelingSetup";
import { VagabondCharacterSetup } from "../components/VagabondCharacterSetup";
import { KnaveCaptainSetup } from "../components/KnaveCaptainSetup";

interface TypecastState {
  phase: "setup" | "pass" | "nominate" | "done";
  seats: string[];
  turn: number;
  subTurn: number;
  votes: Ballots;
  result: TypecastAssignment | null;
  error: string;
}

const initialState: TypecastState = {
  phase: "setup",
  seats: [],
  turn: 0,
  subTurn: 0,
  votes: [],
  result: null,
  error: "",
};

type TypecastAction =
  | { type: "START"; seats: string[] }
  | { type: "SHOW" }
  | { type: "SET_VOTE"; id: string }
  | { type: "SUBMIT"; result: TypecastAssignment | null }
  | { type: "RESET" };

function typecastReducer(state: TypecastState, action: TypecastAction): TypecastState {
  switch (action.type) {
    case "START":
      return {
        phase: "pass",
        seats: action.seats,
        turn: 0,
        subTurn: 0,
        votes: emptyBallots(action.seats.length),
        result: null,
        error: "",
      };
    case "SHOW":
      return { ...state, phase: "nominate" };
    case "SET_VOTE": {
      const targets = typecastTargets(state.turn, state.seats.length);
      const targetIndex = targets[state.subTurn];
      const votes = state.votes.map((row, i) =>
        i === state.turn ? row.map((v, j) => (j === targetIndex ? action.id : v)) : row,
      );
      return { ...state, votes };
    }
    case "SUBMIT": {
      const targets = typecastTargets(state.turn, state.seats.length);
      const nextSub = state.subTurn + 1;
      if (nextSub < targets.length) return { ...state, subTurn: nextSub };
      const nextTurn = state.turn + 1;
      if (nextTurn < state.seats.length) return { ...state, turn: nextTurn, subTurn: 0, phase: "pass" };
      if (!action.result)
        return {
          ...state,
          phase: "nominate",
          error: "Couldn’t find a reach-safe combination of factions for this many players — try the adventurous toggle.",
        };
      return { ...state, turn: nextTurn, result: action.result, phase: "done" };
    }
    case "RESET":
      return initialState;
  }
}

export function TypecastMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.typecast", typecastReducer, initialState);

  const pool = availableFactions.filter((f) => f.id !== "vagabond2");

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  const targets = state.seats.length ? typecastTargets(state.turn, state.seats.length) : [];
  const targetIndex = targets[state.subTurn];

  const handleConfirm = () => {
    const isLastSub = state.subTurn + 1 >= targets.length;
    const isLastActor = state.turn + 1 >= state.seats.length;
    const isFinal = isLastSub && isLastActor;
    const result = isFinal ? findBestTypecastAssignment(state.votes, pool, effTarget) : null;
    dispatch({ type: "SUBMIT", result });
  };

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-typecast" summary="How this works">
          The device passes around once. Each player secretly nominates a faction for <b>every other player</b> —
          never for themselves — one "I think you should play this" per teammate. Nobody sees anyone else's
          nominations. Once every ballot is in, the app checks every reach-safe combination of factions and picks
          whichever legal assignment gives the table the most matching nominations overall — ties broken at random.
          The reveal shows how many of the other players called it for each seat, but never who cast which vote.
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
          <button className="btn" onClick={() => dispatch({ type: "START", seats: shuffleArr(playerNames().slice()) })}>
            Shuffle seats &amp; start
          </button>
        </div>
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
      who: submitted ? "ballot locked in" : isCurrent ? "up now" : i === 0 ? "first player" : `turn ${i + 1}`,
    };
  });

  if (state.phase === "pass" || state.phase === "nominate") {
    const actor = state.seats[state.turn];
    const targetName = state.seats[targetIndex];
    const selected = state.votes[state.turn]?.[targetIndex] ?? "";
    const actorKey = `typecast-${state.turn}`;

    return (
      <PassDeviceGate
        actorName={actor}
        actorKey={actorKey}
        onAcknowledge={() => {
          if (state.phase === "pass") dispatch({ type: "SHOW" });
        }}
        detail={<OrderList items={orderItems} />}
      >
        <section>
          <div className="picker-banner">
            <b>{actor}</b> — who should <b>{targetName}</b> play? ({state.subTurn + 1} / {targets.length})
          </div>
          {state.error && (
            <p className="note" style={{ color: "var(--danger)" }}>
              {state.error}
            </p>
          )}
          <GridLegend />
          <div className="grid">
            {pool.map((f) => (
              <FactionCard
                key={f.id}
                faction={f}
                reachBadge
                selected={selected === f.id}
                onClick={() => dispatch({ type: "SET_VOTE", id: f.id })}
              />
            ))}
          </div>
          <FloatingConfirm ready={!!selected} hint={`Pick a faction for ${targetName}`}>
            <button className="btn" onClick={handleConfirm}>
              Nominate for {targetName}
            </button>
          </FloatingConfirm>
        </section>
      </PassDeviceGate>
    );
  }

  // done
  const { assign, score, total } = state.result!;
  const rec = REACH_TARGET[playerCount];
  const finalFactionIds = new Set(assign);
  const maxScore = state.seats.length * (state.seats.length - 1);
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const f = byId[assign[i]];
    const votes = countVotesForFaction(state.votes, i, assign[i]);
    const maxVotes = state.seats.length - 1;
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
          {name} — {f.name}{" "}
          <span className="law-ref">
            ({votes} / {maxVotes} vote{maxVotes === 1 ? "" : "s"})
          </span>
        </>
      ),
      sub: `reach ${f.reach} · ${f.type}`,
    };
  });
  const revealItems: RevealSeatItem[] = state.seats.map((name, i) => {
    const votes = countVotesForFaction(state.votes, i, assign[i]);
    const maxVotes = state.seats.length - 1;
    return {
      name,
      faction: byId[assign[i]],
      first: i === 0,
      note: `${votes} / ${maxVotes} vote${maxVotes === 1 ? "" : "s"}`,
    };
  });

  return (
    <section>
      <RevealCeremony storageKey="typecast" items={revealItems} />
      <h2>The Woodland is Cast</h2>
      <ReachStampLine
        total={total}
        recommended={rec}
        extra={
          <>
            &nbsp;·&nbsp; Votes matched <b>{score}</b> / {maxScore}
          </>
        }
      />
      <SummaryList items={summaryItems} />
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <HirelingSetup storageKey="typecast" finalFactionIds={finalFactionIds} />
      <VagabondCharacterSetup storageKey="typecast" finalFactionIds={finalFactionIds} />
      <KnaveCaptainSetup storageKey="typecast" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
