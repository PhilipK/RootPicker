import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { legalLineups, legalReplacements } from "../lib/mulligan";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import { byId, REACH_TARGET } from "../data/factions";
import { Explainer } from "../components/Explainer";
import { NameInputs } from "../components/NameInputs";
import { FactionCard } from "../components/FactionCard";
import { SetupHero } from "../components/SetupHero";
import { PassDeviceGate } from "../components/PassDeviceGate";
import { OrderList, type OrderItem } from "../components/OrderList";
import { SummaryList, type SummaryItem } from "../components/SummaryList";
import { SetupChecklist } from "../components/SetupChecklist";
import { ReachStampLine } from "../components/ReachStampLine";
import { ConfirmResetButton } from "../components/ConfirmResetButton";
import { RevealCeremony, type RevealSeatItem } from "../components/RevealCeremony";
import { HirelingSetup } from "../components/HirelingSetup";
import { VagabondCharacterSetup } from "../components/VagabondCharacterSetup";
import { KnaveCaptainSetup } from "../components/KnaveCaptainSetup";

type Decision = "kept" | "mulligan" | null;

interface MulliganState {
  phase: "setup" | "pass" | "decide" | "seat-reveal" | "done";
  seats: string[];
  /** deal[seatIndex] = the faction that seat was originally dealt */
  deal: string[];
  /** holdings[seatIndex] = what that seat currently holds — starts equal to
      `deal`, updated in place the moment a seat mulligans */
  holdings: string[];
  /** factions not currently held by anyone */
  market: string[];
  /** seat index currently at the device */
  turn: number;
  decisions: Decision[];
  error: string;
}

const initialState: MulliganState = {
  phase: "setup",
  seats: [],
  deal: [],
  holdings: [],
  market: [],
  turn: 0,
  decisions: [],
  error: "",
};

type MulliganAction =
  | { type: "ERROR"; error: string }
  | { type: "START"; seats: string[]; deal: string[]; market: string[] }
  | { type: "SHOW" }
  | { type: "KEEP" }
  | { type: "MULLIGAN"; replacementId: string }
  | { type: "CONTINUE" }
  | { type: "RESET" };

function mulliganReducer(state: MulliganState, action: MulliganAction): MulliganState {
  switch (action.type) {
    case "ERROR":
      return { ...state, error: action.error };
    case "START":
      return {
        ...initialState,
        phase: "pass",
        seats: action.seats,
        deal: action.deal,
        holdings: action.deal.slice(),
        market: action.market,
        decisions: action.seats.map(() => null),
      };
    case "SHOW":
      return state.phase === "pass" ? { ...state, phase: "decide" } : state;
    case "KEEP": {
      if (state.phase !== "decide") return state;
      const decisions = state.decisions.map((d, i) => (i === state.turn ? "kept" : d)) as Decision[];
      const isLast = state.turn + 1 >= state.seats.length;
      return { ...state, decisions, turn: isLast ? state.turn : state.turn + 1, phase: isLast ? "done" : "pass" };
    }
    case "MULLIGAN": {
      if (state.phase !== "decide") return state;
      const holdings = state.holdings.slice();
      const discarded = holdings[state.turn];
      holdings[state.turn] = action.replacementId;
      const market = state.market.filter((id) => id !== action.replacementId).concat([discarded]);
      const decisions = state.decisions.map((d, i) => (i === state.turn ? "mulligan" : d)) as Decision[];
      return { ...state, holdings, market, decisions, phase: "seat-reveal" };
    }
    case "CONTINUE": {
      if (state.phase !== "seat-reveal") return state;
      const isLast = state.turn + 1 >= state.seats.length;
      return { ...state, turn: isLast ? state.turn : state.turn + 1, phase: isLast ? "done" : "pass" };
    }
    case "RESET":
      return initialState;
  }
}

export function MulliganMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.mulligan", mulliganReducer, initialState);

  const mulliganPool = availableFactions.filter((f) => f.id !== "vagabond2");

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  const handleStart = () => {
    const lineups = legalLineups(mulliganPool, playerCount, effTarget);
    if (!lineups.length) {
      dispatch({
        type: "ERROR",
        error: "Couldn’t find a reach-safe lineup for this many players — try the adventurous toggle.",
      });
      return;
    }
    const subset = lineups[Math.floor(Math.random() * lineups.length)];
    const deal = shuffleArr(subset.map((f) => f.id));
    const dealt = new Set(deal);
    const market = mulliganPool.map((f) => f.id).filter((id) => !dealt.has(id));
    dispatch({ type: "START", seats: shuffleArr(playerNames().slice()), deal, market });
  };

  const handleMulligan = () => {
    const candidates = legalReplacements(state.market, state.holdings, state.turn, effTarget);
    if (!candidates.length) return; // button is disabled in this case — belt and suspenders
    const replacementId = candidates[Math.floor(Math.random() * candidates.length)];
    dispatch({ type: "MULLIGAN", replacementId });
  };

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-mulligan" summary="How this works">
          Everyone is secretly dealt a faction from a reach-safe lineup, exactly like Trading Post. The device then
          passes once, seat by seat: each player either <b>keeps</b> their deal, or <b>mulligans</b> it — discarding
          it back to the market for a random replacement, drawn from whatever market faction keeps the table legal.
          The replacement is binding and shown to you immediately; there's no second mulligan on what you drew. Your
          discard goes back into the market for a later player to possibly draw, but it can never come back to you.
          If nothing in the market could legally replace your deal, mulligan is unavailable and you keep it. Whether
          the last player kept or mulliganed shows up as the device reaches you, but not what anyone drew — that
          stays secret until the reveal at the end, which replays every decision. Reach target, Vagabond/Knaves
          exclusion (A.8.1), and the Second Vagabond sitting out are all enforced exactly as in Trading Post.
        </Explainer>
        <SetupHero />
        <h2>Seats</h2>
        <p className="note">Names are optional. Seating order, the deal, and first player are randomized when you start.</p>
        <NameInputs />
        <label className="note" style={{ display: "block" }}>
          <input type="checkbox" checked={adventurous} onChange={(e) => setAdventurous(e.target.checked)} />{" "}
          Adventurous group — allow any mix that reaches 17+
        </label>
        <div className="btn-row">
          <button className="btn" onClick={handleStart}>
            Shuffle seats &amp; deal the lineup
          </button>
        </div>
        <p className="note" style={{ color: "var(--danger)" }}>
          {state.error}
        </p>
      </section>
    );
  }

  const orderItems: OrderItem[] = state.seats.map((name, i) => {
    const decision = state.decisions[i];
    const submitted = state.phase === "done" || i < state.turn;
    const isCurrent = state.phase !== "done" && i === state.turn;
    return {
      name,
      first: i === 0,
      current: isCurrent,
      done: submitted,
      who:
        submitted && decision
          ? decision === "kept"
            ? "kept"
            : "mulliganed"
          : isCurrent
            ? "up now"
            : i === 0
              ? "first player"
              : `turn ${i + 1}`,
    };
  });

  if (state.phase === "pass" || state.phase === "decide" || state.phase === "seat-reveal") {
    const seat = state.turn;
    const actorName = state.seats[seat];
    const dealtFaction = byId[state.deal[seat]];
    const currentFaction = byId[state.holdings[seat]];
    const candidates = legalReplacements(state.market, state.holdings, seat, effTarget);
    const canMulligan = candidates.length > 0;

    return (
      <PassDeviceGate
        actorName={actorName}
        actorKey={`mulligan-${seat}`}
        onAcknowledge={() => {
          if (state.phase === "pass") dispatch({ type: "SHOW" });
        }}
        detail={<OrderList items={orderItems} />}
        footer={<ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>}
      >
        <section>
          {state.phase === "seat-reveal" ? (
            <>
              <div className="picker-banner">
                <b>{actorName}</b> — you mulliganed away the <b>{dealtFaction.name}</b>. Your replacement, binding:
              </div>
              <div className="grid">
                <FactionCard faction={currentFaction} reachBadge />
              </div>
              <div className="btn-row">
                <button className="btn" onClick={() => dispatch({ type: "CONTINUE" })}>
                  {seat + 1 < state.seats.length ? "Continue — pass the device" : "See the reveal"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="picker-banner">
                <b>{actorName}</b> — you were dealt the <b>{dealtFaction.name}</b>. Keep it, or mulligan for a blind,
                binding replacement from the market.
              </div>
              <div className="grid">
                <FactionCard faction={dealtFaction} reachBadge lockBadge="your deal" />
              </div>
              <div className="btn-row">
                <button className="btn" onClick={() => dispatch({ type: "KEEP" })}>
                  Keep the {dealtFaction.name}
                </button>
                <button
                  className="btn secondary"
                  disabled={!canMulligan}
                  title={
                    canMulligan
                      ? undefined
                      : "No faction in the market could replace this without breaking the table's reach total or the Vagabond/Knaves rule (A.8.1)."
                  }
                  onClick={handleMulligan}
                >
                  Mulligan — draw blind from the market
                </button>
              </div>
              {!canMulligan && (
                <p className="note" style={{ color: "var(--danger)" }}>
                  No legal replacement exists in the market right now — mulligan is unavailable, you keep your deal.
                </p>
              )}
            </>
          )}
        </section>
      </PassDeviceGate>
    );
  }

  // done
  const finalFactionIds = new Set(state.holdings);
  const total = state.holdings.reduce((s, id) => s + byId[id].reach, 0);
  const rec = REACH_TARGET[playerCount];

  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const f = byId[state.holdings[i]];
    const dealt = byId[state.deal[i]];
    const mulliganed = state.decisions[i] === "mulligan";
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
          {name} — {f.name}
        </>
      ),
      sub: mulliganed
        ? `mulliganed away ${dealt.name} · reach ${f.reach} · ${f.type}`
        : `kept their deal · reach ${f.reach} · ${f.type}`,
    };
  });
  if (state.market.length) {
    summaryItems.push({
      primary: "Stayed in the market",
      sub: state.market.map((id) => byId[id].name).join(", "),
      faded: true,
    });
  }

  const revealItems: RevealSeatItem[] = state.seats.map((name, i) => ({
    name,
    faction: byId[state.holdings[i]],
    first: i === 0,
    note: state.decisions[i] === "mulligan" ? `mulliganed away the ${byId[state.deal[i]].name}` : "kept their deal",
  }));

  return (
    <section>
      <RevealCeremony storageKey="mulligan" items={revealItems} />
      <h2>The Mulligans</h2>
      <ul className="reveal-log">
        {state.seats.map((name, i) =>
          state.decisions[i] === "mulligan" ? (
            <li key={i} className="fav-line">
              {name} mulligans away the {byId[state.deal[i]].name} — draws the {byId[state.holdings[i]].name}
            </li>
          ) : (
            <li key={i} className="void-line">
              {name} keeps the {byId[state.deal[i]].name}
            </li>
          ),
        )}
      </ul>

      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <HirelingSetup storageKey="mulligan" finalFactionIds={finalFactionIds} />
      <VagabondCharacterSetup storageKey="mulligan" finalFactionIds={finalFactionIds} />
      <KnaveCaptainSetup storageKey="mulligan" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
