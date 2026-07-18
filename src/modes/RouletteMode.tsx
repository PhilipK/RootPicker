import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { spinLineup, vetoBlockReason } from "../lib/roulette";
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
  phase: "setup" | "spin" | "done";
  seats: string[];
  /** faction ids banished for the rest of this session by a veto */
  exiled: string[];
  /** the current proposal: lineup[seatIndex] = faction id */
  lineup: string[];
  /** how many times the table has vetoed and re-spun — flavor/counter only */
  spins: number;
  error: string;
}

const initialState: RouletteState = {
  phase: "setup",
  seats: [],
  exiled: [],
  lineup: [],
  spins: 0,
  error: "",
};

type RouletteAction =
  | { type: "START"; seats: string[]; lineup: string[] }
  | { type: "ERROR"; error: string }
  | { type: "VETO"; id: string; lineup: string[] }
  | { type: "LOCK" }
  | { type: "RESET" };

function rouletteReducer(state: RouletteState, action: RouletteAction): RouletteState {
  switch (action.type) {
    case "START":
      return { ...initialState, phase: "spin", seats: action.seats, lineup: action.lineup, spins: 1 };
    case "ERROR":
      return { ...state, error: action.error };
    case "VETO":
      return {
        ...state,
        exiled: [...state.exiled, action.id],
        lineup: action.lineup,
        spins: state.spins + 1,
      };
    case "LOCK":
      return { ...state, phase: "done" };
    case "RESET":
      return initialState;
  }
}

export function RouletteMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.roulette", rouletteReducer, initialState);
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
    const reason = vetoBlockReason(roulettePool, exiledSet, id, playerCount, effTarget);
    if (reason) {
      setTapReason(reason);
      return;
    }
    const nextExiled = new Set(exiledSet);
    nextExiled.add(id);
    const remainingPool = roulettePool.filter((f) => !nextExiled.has(f.id));
    const lineup = spinLineup(remainingPool, playerCount, effTarget);
    // vetoBlockReason already guarantees a legal lineup exists after this
    // exile, so `lineup` is never null here.
    dispatch({ type: "VETO", id, lineup: lineup! });
  };

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-roulette" summary="How this works">
          The app spins a fully random, reach-safe lineup and hands it straight to the seats. Anyone at the table —
          for their own faction or someone else's — can veto <b>one</b> faction from the current spin: it's exiled
          for the rest of the session and the app spins a fresh lineup from what's left. Everyone gets one veto to
          spend across the whole session, honor system — the app doesn't track who's used theirs, so the table
          polices it itself. A veto is blocked outright if it would leave no legal lineup at all. Once a spin goes
          by with nobody vetoing, lock it in. Nothing about scoring changes; the only lever anyone has is exiling
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

  if (state.phase === "spin") {
    const orderItems: OrderItem[] = state.seats.map((name, i) => ({
      name,
      first: i === 0,
      current: false,
      done: false,
      who: byId[state.lineup[i]].name,
    }));

    return (
      <section>
        <div className="picker-banner">
          Spin <b>#{state.spins}</b> — tap a faction below to <b>veto</b> it (exiled for the rest of the session, and
          the app re-spins). Happy with this one? Lock it in.
        </div>
        <OrderList items={orderItems} />
        <ReachStampLine total={total} recommended={rec} />
        <GridLegend />
        <div className="grid">
          {state.lineup.map((id) => {
            const f = byId[id];
            const reason = vetoBlockReason(roulettePool, exiledSet, id, playerCount, effTarget);
            return (
              <FactionCard
                key={id}
                faction={f}
                reachBadge
                disabled={!!reason}
                title={reason ? reason : "Tap to veto — exiled for the rest of the session"}
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
          <button className="btn" onClick={() => dispatch({ type: "LOCK" })}>
            Lock this lineup in
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
      sub: `reach ${f.reach} · ${f.type}${state.spins > 1 ? ` · settled after ${state.spins} spins` : ""}`,
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
