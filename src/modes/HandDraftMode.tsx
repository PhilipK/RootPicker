import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { draftSolvable, legalIds, strongOk } from "../lib/handDraft";
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

interface HandPick {
  seatIndex: number;
  factionId: string;
}
interface HandState {
  phase: "setup" | "pass" | "pick" | "done";
  seats: string[];
  hands: string[][];
  pickQueue: number[];
  picks: HandPick[];
  error: string;
}

const initialState: HandState = { phase: "setup", seats: [], hands: [], pickQueue: [], picks: [], error: "" };

type HandAction =
  | { type: "DEAL_ERROR"; error: string }
  | { type: "DEAL_OK"; seats: string[]; hands: string[][]; pickQueue: number[] }
  | { type: "SHOW" }
  | { type: "CHOOSE"; factionId: string; playerCount: number }
  | { type: "UNDO" }
  | { type: "RESET" };

function handReducer(state: HandState, action: HandAction): HandState {
  switch (action.type) {
    case "DEAL_ERROR":
      return { ...state, error: action.error };
    case "DEAL_OK":
      return { phase: "pass", seats: action.seats, hands: action.hands, pickQueue: action.pickQueue, picks: [], error: "" };
    case "SHOW":
      return { ...state, phase: "pick" };
    case "CHOOSE": {
      const seatIndex = state.pickQueue[state.picks.length];
      const picks = [...state.picks, { seatIndex, factionId: action.factionId }];
      return { ...state, picks, phase: picks.length === action.playerCount ? "done" : "pass" };
    }
    case "UNDO":
      if (!state.picks.length) return state;
      return { ...state, picks: state.picks.slice(0, -1), phase: "pass" };
    case "RESET":
      return initialState;
  }
}

export function HandDraftMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.hand", handReducer, initialState);

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  const handleDeal = () => {
    const K = playerCount >= 5 ? 2 : 3;
    const drop = Math.random() < 0.5 ? "vagabond" : "knaves"; // never both in one game (A.8.1)
    const deck0 = availableFactions.filter((f) => f.id !== "vagabond2" && f.id !== drop);
    const target = effTarget;
    // First hunt for a deal where every player is guaranteed a real choice
    // (two or more legal cards) whatever happens; settle for merely solvable.
    let fallback: string[][] | null = null;
    for (let t = 0; t < 800; t++) {
      const deck = shuffleArr(deck0.slice());
      const hands = Array.from({ length: playerCount }, (_, i) => deck.slice(i * K, (i + 1) * K).map((f) => f.id));
      if (!draftSolvable(hands, 0, false, target)) continue;
      const handsQ = hands.slice().reverse(); // pick order: last seat first
      if (strongOk(handsQ, 0, 0, false, target, new Map())) {
        fallback = hands;
        break;
      }
      fallback = fallback || hands;
    }
    if (fallback) {
      const seats = shuffleArr(playerNames().slice());
      const pickQueue = Array.from({ length: playerCount }, (_, i) => playerCount - 1 - i);
      dispatch({ type: "DEAL_OK", seats, hands: fallback, pickQueue });
      return;
    }
    dispatch({ type: "DEAL_ERROR", error: "Couldn’t deal hands that reach the total — try the adventurous toggle." });
  };

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-hand-deal" summary="How this works">
          Each player gets a secret hand of <span>{playerCount >= 5 ? "two" : "three"}</span> factions and picks
          one, passing the device around. Hands are dealt so the table can always reach the required total and
          field at least one militant. The Second Vagabond sits out, and either the Vagabond or the Knaves is
          randomly left out of the deck (A.8.1).
        </Explainer>
        <SetupHero />
        <h2>Seats</h2>
        <p className="note">Names are optional. Seating order and first player are randomized when you deal.</p>
        <NameInputs />

        <h2>Deal</h2>
        <label className="note" style={{ display: "block" }}>
          <input type="checkbox" checked={adventurous} onChange={(e) => setAdventurous(e.target.checked)} />{" "}
          Adventurous group — allow any mix that reaches 17+
        </label>
        <div className="btn-row">
          <button className="btn" onClick={handleDeal}>
            Shuffle seats &amp; deal hands
          </button>
        </div>
        <p className="note" style={{ color: "var(--danger)" }}>
          {state.error}
        </p>
      </section>
    );
  }

  const orderItems: OrderItem[] = state.seats.map((name, i) => {
    const pick = state.picks.find((p) => p.seatIndex === i);
    const isCurrent = i === state.pickQueue[state.picks.length];
    return {
      name,
      first: i === 0,
      current: isCurrent,
      done: !!pick,
      who: pick ? byId[pick.factionId].name : isCurrent ? "up now" : i === 0 ? "first player" : `turn ${i + 1}`,
    };
  });

  if (state.phase === "pass" || state.phase === "pick") {
    const qi = state.picks.length;
    const seat = state.pickQueue[qi];
    const actorName = state.seats[seat];
    const actorKey = `hand-${qi}`;

    const handsQ = state.pickQueue.map((si) => state.hands[si]);
    const sum = state.picks.reduce((s, p) => s + byId[p.factionId].reach, 0);
    const mil = state.picks.some((p) => byId[p.factionId].type === "militant");
    const target = effTarget;
    const legal = legalIds(handsQ, qi, sum, mil, target);
    // Prefer picks that leave every later player two or more legal cards.
    const strong = legal.filter((id) => {
      const f = byId[id];
      return strongOk(handsQ, qi + 1, sum + f.reach, mil || f.type === "militant", target, new Map());
    });
    const shown = strong.length ? strong : legal;
    const hiddenCount = state.hands[seat].length - shown.length;

    return (
      <PassDeviceGate
        actorName={actorName}
        actorKey={actorKey}
        onAcknowledge={() => {
          if (state.phase === "pass") dispatch({ type: "SHOW" });
        }}
        detail={
          <>
            <OrderList items={orderItems} />
          </>
        }
        footer={
          <>
            <button
              type="button"
              className="btn secondary"
              disabled={!state.picks.length}
              onClick={() => dispatch({ type: "UNDO" })}
            >
              Undo last pick
            </button>
            <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
          </>
        }
      >
        <section>
          <div className="picker-banner">
            <b>{actorName}</b> — pick one faction.
          </div>
          <GridLegend />
          <div className="grid">
            {shown.map((id) => {
              const f = byId[id];
              return (
                <FactionCard
                  key={id}
                  faction={f}
                  reachBadge
                  onClick={() => dispatch({ type: "CHOOSE", factionId: id, playerCount })}
                />
              );
            })}
          </div>
          <p className="note" style={{ color: "var(--danger)" }}>
            {hiddenCount
              ? `${hiddenCount === 1 ? "One dealt faction is" : hiddenCount + " dealt factions are"} hidden: picking ${
                  hiddenCount === 1 ? "it" : "them"
                } would leave the table short on reach or militants, or leave a later player with no real choice. ${
                  hiddenCount === 1 ? "It shows up" : "They show up"
                } in the reveal at the end.`
              : ""}
          </p>
          <p className="note">
            Pick one — it becomes public and you set it up right away. The rest of your hand stays secret until the
            end.
          </p>
        </section>
      </PassDeviceGate>
    );
  }

  // done
  const total = state.picks.reduce((s, p) => s + byId[p.factionId].reach, 0);
  const rec = REACH_TARGET[playerCount];
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const pick = state.picks.find((p) => p.seatIndex === i)!;
    const f = byId[pick.factionId];
    const passed = state.hands[i].filter((id) => id !== pick.factionId).map((id) => byId[id].name);
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
          {name} — {f.name}
        </>
      ),
      sub: `turn ${i + 1}${i === 0 ? " (first player)" : ""} · reach ${f.reach} · ${f.type} · passed on ${passed.join(" and ")}`,
    };
  });
  const dealt = new Set(state.hands.flat());
  const undealt = availableFactions.filter((f) => f.id !== "vagabond2" && !dealt.has(f.id)).map((f) => f.name);
  if (undealt.length) {
    summaryItems.push({ primary: "Never dealt", sub: `${undealt.join(", ")} — return them to the box`, faded: true });
  }

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
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New deal</ConfirmResetButton>
      </div>
    </section>
  );
}
