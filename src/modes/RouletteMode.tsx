import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { drawReplacement, nextUnspentSeat, spinLineup, vetoBlockReason } from "../lib/roulette";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import { byId, REACH_TARGET } from "../data/factions";
import { Explainer } from "../components/Explainer";
import { NameInputs } from "../components/NameInputs";
import { FactionCard } from "../components/FactionCard";
import { GridLegend } from "../components/GridLegend";
import { SetupHero } from "../components/SetupHero";
import { DisabledReasonNote } from "../components/DisabledReasonNote";
import { OrderList, type OrderItem } from "../components/OrderList";
import { SummaryList, type SummaryItem } from "../components/SummaryList";
import { SetupChecklist } from "../components/SetupChecklist";
import { ReachStampLine } from "../components/ReachStampLine";
import { ConfirmResetButton } from "../components/ConfirmResetButton";
import { RevealCeremony, type RevealSeatItem } from "../components/RevealCeremony";
import { HirelingSetup } from "../components/HirelingSetup";
import { VagabondCharacterSetup } from "../components/VagabondCharacterSetup";
import { KnaveCaptainSetup } from "../components/KnaveCaptainSetup";

interface RouletteState {
  phase: "setup" | "poll" | "done";
  seats: string[];
  /** faction ids banished for the rest of this session by a veto */
  exiled: string[];
  /** the current proposal: lineup[seatIndex] = faction id */
  lineup: string[];
  /** proposal counter — bumps on every veto (each veto changes one seat) */
  spins: number;
  /** per seat: has this player spent their one veto? */
  vetoSpent: boolean[];
  /** seat indices that passed on the current proposal */
  passed: number[];
  /** seat index currently deciding veto-or-pass; -1 when nobody is left */
  decider: number;
  error: string;
}

const initialState: RouletteState = {
  phase: "setup",
  seats: [],
  exiled: [],
  lineup: [],
  spins: 0,
  vetoSpent: [],
  passed: [],
  decider: -1,
  error: "",
};

/** Older persisted sessions predate the veto-or-pass poll (no `decider`
    field) — treat them as no session rather than crash on the new shape. */
function deserialize(raw: string): RouletteState {
  const parsed = JSON.parse(raw) as RouletteState;
  return typeof parsed.decider === "number" && Array.isArray(parsed.vetoSpent) ? parsed : initialState;
}

type RouletteAction =
  | { type: "START"; seats: string[]; lineup: string[] }
  | { type: "ERROR"; error: string }
  | { type: "VETO"; id: string; replacement: string }
  | { type: "PASS" }
  | { type: "RESET" };

function rouletteReducer(state: RouletteState, action: RouletteAction): RouletteState {
  switch (action.type) {
    case "START": {
      const vetoSpent = action.seats.map(() => false);
      return {
        ...initialState,
        phase: "poll",
        seats: action.seats,
        lineup: action.lineup,
        spins: 1,
        vetoSpent,
        decider: nextUnspentSeat(vetoSpent, -1),
      };
    }
    case "ERROR":
      return { ...state, error: action.error };
    case "VETO": {
      if (state.decider < 0) return state;
      const vetoSpent = state.vetoSpent.map((v, i) => (i === state.decider ? true : v));
      const lineup = state.lineup.map((id) => (id === action.id ? action.replacement : id));
      // A changed proposal is a new question — everyone still holding a
      // token gets a fresh say, starting from the lowest seat.
      const decider = nextUnspentSeat(vetoSpent, -1);
      return {
        ...state,
        phase: decider === -1 ? "done" : "poll",
        exiled: [...state.exiled, action.id],
        lineup,
        spins: state.spins + 1,
        vetoSpent,
        passed: [],
        decider,
      };
    }
    case "PASS": {
      if (state.decider < 0) return state;
      const decider = nextUnspentSeat(state.vetoSpent, state.decider);
      return {
        ...state,
        phase: decider === -1 ? "done" : "poll",
        passed: [...state.passed, state.decider],
        decider,
      };
    }
    case "RESET":
      return initialState;
  }
}

export function RouletteMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer(
    "rootpicker.session.roulette",
    rouletteReducer,
    initialState,
    JSON.stringify,
    deserialize,
  );
  const [tapReason, setTapReason] = useState<string | null>(null);

  const roulettePool = availableFactions.filter((f) => f.id !== "vagabond2");

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  const handleStart = () => {
    const lineup = spinLineup(roulettePool, playerCount, effTarget);
    if (!lineup) {
      dispatch({
        type: "ERROR",
        error: "Couldn’t find a reach-safe lineup for this many players — try the adventurous toggle or own more packs.",
      });
      return;
    }
    dispatch({ type: "START", seats: shuffleArr(playerNames().slice()), lineup });
  };

  const exiledSet = new Set(state.exiled);

  const handleVeto = (id: string) => {
    const reason = vetoBlockReason(roulettePool, exiledSet, state.lineup, id, effTarget);
    if (reason) {
      setTapReason(reason);
      return;
    }
    const replacement = drawReplacement(roulettePool, exiledSet, state.lineup, id, effTarget);
    // vetoBlockReason already guarantees at least one legal replacement, so
    // `replacement` is never null here.
    dispatch({ type: "VETO", id, replacement: replacement! });
  };

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-roulette" summary="How this works">
          The app spins a fully random, reach-safe lineup, then polls the table seat by seat: on your turn either
          <b> pass</b> — this lineup is fine by you — or spend your <b>one veto</b> on any faction in it, yours or
          someone else's. A vetoed faction is exiled for the rest of the session and <b>only that seat</b> draws a
          fresh faction; everyone else keeps theirs. Any veto restarts the poll on the new proposal. When everyone
          still holding a veto has passed — or nobody has one left — the lineup locks. A veto is blocked if no
          faction could legally take that seat. Nothing about scoring changes; the only lever anyone has is exiling
          what they refuse to see at the table.
        </Explainer>
        <SetupHero />
        <h2>Seats</h2>
        <p className="note">Names are optional. Seating order and the first spin are randomized when you start.</p>
        <NameInputs />
        <label className="note" style={{ display: "block" }}>
          <input type="checkbox" checked={adventurous} onChange={(e) => setAdventurous(e.target.checked)} />{" "}
          Adventurous group — allow any mix that reaches 17+
        </label>
        <div className="btn-row">
          <button className="btn" onClick={handleStart}>
            Shuffle seats &amp; spin the lineup
          </button>
        </div>
        <p className="note" style={{ color: "var(--danger)" }}>
          {state.error}
        </p>
      </section>
    );
  }

  const total = state.lineup.reduce((s, id) => s + byId[id].reach, 0);
  const rec = REACH_TARGET[playerCount];

  if (state.phase === "poll") {
    const deciderName = state.seats[state.decider];
    const orderItems: OrderItem[] = state.seats.map((name, i) => {
      const status = state.vetoSpent[i]
        ? "veto spent"
        : state.passed.includes(i)
          ? "passed"
          : i === state.decider
            ? "veto or pass"
            : "waiting";
      return {
        name,
        first: i === 0,
        current: i === state.decider,
        done: state.vetoSpent[i] || state.passed.includes(i),
        who: `${byId[state.lineup[i]].name} · ${status}`,
      };
    });

    return (
      <section>
        <div className="picker-banner">
          Proposal <b>#{state.spins}</b> — <b>{deciderName}</b>: tap a faction to <b>veto</b> it (exiled for the
          session, that seat redraws), or pass.
        </div>
        <OrderList items={orderItems} />
        <ReachStampLine total={total} recommended={rec} />
        <GridLegend />
        <div className="grid">
          {state.lineup.map((id, i) => {
            const f = byId[id];
            const reason = vetoBlockReason(roulettePool, exiledSet, state.lineup, id, effTarget);
            return (
              <FactionCard
                key={id}
                faction={f}
                reachBadge
                disabled={!!reason}
                title={reason ? reason : `Tap to veto — exiled for the session, ${state.seats[i]}'s seat redraws`}
                onDisabledTap={reason ? () => setTapReason(reason) : undefined}
                onClick={() => handleVeto(id)}
              />
            );
          })}
        </div>
        <DisabledReasonNote reason={tapReason} onDismiss={() => setTapReason(null)} />
        {state.exiled.length > 0 && (
          <>
            <h2>Exiled This Session</h2>
            <ul className="reveal-log">
              {state.exiled.map((id, i) => (
                <li key={i} className="ban-line">
                  {byId[id].name} — vetoed, out for the rest of the session
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="btn-row">
          <button className="btn" onClick={() => dispatch({ type: "PASS" })}>
            {deciderName} passes — fine by me
          </button>
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  // done
  const finalFactionIds = new Set(state.lineup);
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const f = byId[state.lineup[i]];
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
          {name} — {f.name}
        </>
      ),
      sub: `reach ${f.reach} · ${f.type}${state.spins > 1 ? ` · settled after ${state.spins} proposals` : ""}`,
    };
  });
  const revealItems: RevealSeatItem[] = state.seats.map((name, i) => ({
    name,
    faction: byId[state.lineup[i]],
    first: i === 0,
  }));

  return (
    <section>
      <RevealCeremony storageKey="roulette" items={revealItems} />
      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      {state.exiled.length > 0 && (
        <>
          <h2>Exiled This Session</h2>
          <ul className="reveal-log">
            {state.exiled.map((id, i) => (
              <li key={i} className="ban-line">
                {byId[id].name}
              </li>
            ))}
          </ul>
        </>
      )}
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <HirelingSetup storageKey="roulette" finalFactionIds={finalFactionIds} />
      <VagabondCharacterSetup storageKey="roulette" finalFactionIds={finalFactionIds} />
      <KnaveCaptainSetup storageKey="roulette" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
