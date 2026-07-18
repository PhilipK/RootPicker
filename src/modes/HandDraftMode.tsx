import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { accumFromPicks, bannedAfter, dealHand, draftSolvable } from "../lib/handDraft";
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

interface HandPick {
  seatIndex: number;
  factionId: string;
}
interface HandState {
  phase: "setup" | "pass" | "pick" | "done";
  seats: string[];
  /** Pick-order indexed: hands[j] is the hand dealt to pickQueue[j]. Hands
      append as they're dealt — one ahead of `picks` — so undo and the
      "passed on" summary lines both stay correct. */
  hands: string[][];
  pickQueue: number[];
  picks: HandPick[];
  error: string;
}

const initialState: HandState = { phase: "setup", seats: [], hands: [], pickQueue: [], picks: [], error: "" };

type HandAction =
  | { type: "DEAL_ERROR"; error: string }
  | { type: "START"; seats: string[]; pickQueue: number[]; firstHand: string[] }
  | { type: "SHOW" }
  | { type: "CHOOSE"; factionId: string; nextHand: string[] | null; playerCount: number }
  | { type: "UNDO" }
  | { type: "RESET" };

function handReducer(state: HandState, action: HandAction): HandState {
  switch (action.type) {
    case "DEAL_ERROR":
      return { ...state, error: action.error };
    case "START":
      return { phase: "pass", seats: action.seats, hands: [action.firstHand], pickQueue: action.pickQueue, picks: [], error: "" };
    case "SHOW":
      return { ...state, phase: "pick" };
    case "CHOOSE": {
      const seatIndex = state.pickQueue[state.picks.length];
      const picks = [...state.picks, { seatIndex, factionId: action.factionId }];
      const hands = action.nextHand ? [...state.hands, action.nextHand] : state.hands;
      return { ...state, picks, hands, phase: picks.length === action.playerCount ? "done" : "pass" };
    }
    case "UNDO":
      if (!state.picks.length) return state;
      return { ...state, picks: state.picks.slice(0, -1), hands: state.hands.slice(0, -1), phase: "pass" };
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

  const ownedDeckIds = () => availableFactions.filter((f) => f.id !== "vagabond2").map((f) => f.id);

  const handleDeal = () => {
    const deckIds = ownedDeckIds();
    const target = effTarget;
    if (!draftSolvable(deckIds, playerCount, 0, false, null, target)) {
      dispatch({ type: "DEAL_ERROR", error: "Couldn’t deal hands that reach the total — try the adventurous toggle." });
      return;
    }
    const seats = shuffleArr(playerNames().slice());
    const pickQueue = Array.from({ length: playerCount }, (_, i) => playerCount - 1 - i);
    const firstHand = dealHand(deckIds, playerCount, 0, false, null, target, shuffleArr);
    dispatch({ type: "START", seats, pickQueue, firstHand });
  };

  /** Compute the next player's hand just-in-time, right after the current
      player's choice — the reducer stays pure; all randomness (which safe
      candidates get shown, in what order) is injected here via `shuffleArr`
      and carried into the dispatched action. */
  const handleChoose = (factionId: string) => {
    const pickedIds = [...state.picks.map((p) => p.factionId), factionId];
    const playersRemaining = playerCount - pickedIds.length;
    let nextHand: string[] | null = null;
    if (playersRemaining > 0) {
      const pool = ownedDeckIds().filter((id) => !pickedIds.includes(id));
      const { sum, mil } = accumFromPicks(pickedIds);
      const banned = bannedAfter(pickedIds);
      nextHand = dealHand(pool, playersRemaining, sum, mil, banned, effTarget, shuffleArr);
    }
    dispatch({ type: "CHOOSE", factionId, nextHand, playerCount });
  };

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-hand-deal" summary="How this works">
          Each player gets a secret hand of <span>three</span> factions and picks one, passing the device around.
          Hands are dealt just-in-time — one player at a time, right before their turn — so every card you see is
          guaranteed pickable: whichever one you take, the table can still reach the required total and field at
          least one militant. Nothing is ever hidden or apologized for. The Second Vagabond sits out. The Vagabond
          and the Knaves can both turn up while neither has been picked yet, but the moment one is taken the other
          is retired from every hand dealt for the rest of the draft (A.8.1).
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
    // Dealt just-in-time for this exact turn: every card in it is already
    // guaranteed pickable, so it's shown as-is — nothing to filter or hide.
    const hand = state.hands[qi];

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
            {hand.map((id) => {
              const f = byId[id];
              return (
                <FactionCard key={id} faction={f} reachBadge onClick={() => handleChoose(id)} />
              );
            })}
          </div>
          <p className="note">
            Pick one — every card here is guaranteed pickable. It becomes public and you set it up right away. The
            rest of your hand stays secret until the end.
          </p>
        </section>
      </PassDeviceGate>
    );
  }

  // done
  const total = state.picks.reduce((s, p) => s + byId[p.factionId].reach, 0);
  const rec = REACH_TARGET[playerCount];
  const finalFactionIds = new Set(state.picks.map((p) => p.factionId));
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const pick = state.picks.find((p) => p.seatIndex === i)!;
    const f = byId[pick.factionId];
    const hand = state.hands[state.pickQueue.indexOf(i)];
    const passed = hand.filter((id) => id !== pick.factionId).map((id) => byId[id].name);
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
      <HirelingSetup storageKey="hand" finalFactionIds={finalFactionIds} />
      <VagabondCharacterSetup storageKey="hand" finalFactionIds={finalFactionIds} />
      <KnaveCaptainSetup storageKey="hand" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <button className="btn secondary" onClick={() => dispatch({ type: "UNDO" })}>
          Undo last pick
        </button>
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New deal</ConfirmResetButton>
      </div>
    </section>
  );
}
