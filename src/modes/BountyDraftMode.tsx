import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { reachBlockReason } from "../lib/reach";
import {
  claimVP,
  nextLegalFaction,
  nextSeat,
  normalizeVP,
  rotatedOrder,
  startTokens,
  startingSeat,
  type BountyClaim,
  type BountyLogEntry,
} from "../lib/bounty";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import { byId, REACH_TARGET } from "../data/factions";
import type { Faction } from "../types";
import { PlayerStepper } from "../components/PlayerStepper";
import { Explainer } from "../components/Explainer";
import { NameInputs } from "../components/NameInputs";
import { FactionCard } from "../components/FactionCard";
import { OrderList, type OrderItem } from "../components/OrderList";
import { SummaryList, type SummaryItem } from "../components/SummaryList";
import { SetupChecklist } from "../components/SetupChecklist";
import { ReachStampLine } from "../components/ReachStampLine";
import { ConfirmResetButton } from "../components/ConfirmResetButton";

interface BountyCore {
  phase: "setup" | "act" | "done";
  seats: string[];
  order: number[];
  deck: string[];
  currentId: string | null;
  bounty: number;
  tokens: number[];
  claims: BountyClaim[];
  activeSeat: number;
  log: BountyLogEntry[];
}
interface BountyState extends BountyCore {
  past: BountyCore[];
}

const emptyCore: BountyCore = {
  phase: "setup",
  seats: [],
  order: [],
  deck: [],
  currentId: null,
  bounty: 0,
  tokens: [],
  claims: [],
  activeSeat: 0,
  log: [],
};
const initialState: BountyState = { ...emptyCore, past: [] };

function core(state: BountyState): BountyCore {
  const { past: _past, ...rest } = state;
  return rest;
}

type BountyAction =
  | { type: "START"; seats: string[]; pool: Faction[]; target: number }
  | { type: "PASS" }
  | { type: "CLAIM"; pool: Faction[]; target: number }
  | { type: "CLAIM_FROM_POOL"; id: string }
  | { type: "UNDO" }
  | { type: "RESET" };

function bountyReducer(state: BountyState, action: BountyAction): BountyState {
  switch (action.type) {
    case "START": {
      const order = rotatedOrder(action.seats.length);
      const deck = shuffleArr(action.pool.filter((f) => f.id !== "vagabond2").map((f) => f.id));
      const first = nextLegalFaction(deck, new Set(), action.seats.length, action.pool, action.target);
      return {
        ...emptyCore,
        phase: "act",
        seats: action.seats,
        order,
        deck: first?.rest ?? deck,
        currentId: first?.id ?? null,
        tokens: action.seats.map(() => startTokens(action.seats.length)),
        activeSeat: startingSeat(order, new Set()),
        past: [],
      };
    }
    case "PASS": {
      if (state.phase !== "act" || state.tokens[state.activeSeat] === 0) return state;
      const tokens = state.tokens.slice();
      tokens[state.activeSeat] -= 1;
      const claimedSeats = new Set(state.claims.map((c) => c.seatIndex));
      return {
        ...state,
        past: [...state.past, core(state)],
        tokens,
        bounty: state.bounty + 1,
        activeSeat: nextSeat(state.order, state.activeSeat, claimedSeats),
        log: [...state.log, { type: "pass", seatIndex: state.activeSeat, tokensLeft: tokens[state.activeSeat] }],
      };
    }
    case "CLAIM": {
      if (state.phase !== "act" || state.currentId === null) return state;
      const claim: BountyClaim = {
        seatIndex: state.activeSeat,
        id: state.currentId,
        bounty: state.bounty,
        tokensLeft: state.tokens[state.activeSeat],
      };
      const claims = [...state.claims, claim];
      const log: BountyLogEntry[] = [
        ...state.log,
        { type: "claim", seatIndex: state.activeSeat, id: state.currentId, bounty: state.bounty, tokensLeft: state.tokens[state.activeSeat] },
      ];
      const past = [...state.past, core(state)];
      if (claims.length === state.seats.length) {
        return { ...state, past, claims, log, phase: "done", currentId: null, bounty: 0 };
      }
      const claimedSeats = new Set(claims.map((c) => c.seatIndex));
      const claimedIds = new Set(claims.map((c) => c.id));
      const next = nextLegalFaction(state.deck, claimedIds, state.seats.length, action.pool, action.target);
      return {
        ...state,
        past,
        claims,
        log,
        deck: next?.rest ?? state.deck,
        currentId: next?.id ?? null,
        bounty: 0,
        activeSeat: startingSeat(state.order, claimedSeats),
      };
    }
    case "CLAIM_FROM_POOL": {
      // Only offered once one seat remains: no one left to pass to, so they pick
      // freely from everything still legal instead of being railroaded through
      // whatever the deck happens to reveal next.
      if (state.phase !== "act") return state;
      const bounty = action.id === state.currentId ? state.bounty : 0;
      const claim: BountyClaim = {
        seatIndex: state.activeSeat,
        id: action.id,
        bounty,
        tokensLeft: state.tokens[state.activeSeat],
      };
      return {
        ...state,
        past: [...state.past, core(state)],
        claims: [...state.claims, claim],
        log: [...state.log, { type: "claim", seatIndex: state.activeSeat, id: action.id, bounty, tokensLeft: state.tokens[state.activeSeat] }],
        phase: "done",
        currentId: null,
        bounty: 0,
      };
    }
    case "UNDO": {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return { ...prev, past: state.past.slice(0, -1) };
    }
    case "RESET":
      return initialState;
  }
}

export function BountyDraftMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.bounty", bountyReducer, initialState);

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  if (state.phase === "setup") {
    return (
      <section>
        <h2>Players &amp; Seats</h2>
        <PlayerStepper />
        <p className="note">Names are optional. Seating order and first player are randomized when you start.</p>
        <NameInputs />
        <Explainer id="exp-bounty" summary="How this works">
          A “No Thanks!”-style auction. The app reveals factions one at a time, no shuffling by hand. On your turn
          you either <b>claim</b> the faction — you start the game with the VP bounty sitting on it, plus any of
          your <b>{startTokens(playerCount)}</b> pass tokens you still have banked as VP — or <b>pass</b>, spending
          one token to add +1 VP bounty and hand the decision to the next player. Out of tokens means you must
          claim. A faction is never discarded, so bounty only grows until someone takes it. Whoever's picked last
          everywhere else gets first refusal on every fresh reveal here. Once only one player's left drafting,
          there's no one left to pass to, so they get a free pick from everything still legal instead of being
          stuck with whatever the deck reveals next. Once everyone's starting VP is set, the
          whole table's totals are shifted down so the lowest sits at 0 — only the gap between players matters.
          Reach target and the Vagabond/Knaves exclusion (A.8.1) are enforced on every reveal, same as Simple mode.
          Starting VP is a house rule, not from the Law.
        </Explainer>
        <label className="note" style={{ display: "block" }}>
          <input type="checkbox" checked={adventurous} onChange={(e) => setAdventurous(e.target.checked)} />{" "}
          Adventurous group — allow any mix that reaches 17+
        </label>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() =>
              dispatch({ type: "START", seats: shuffleArr(playerNames().slice()), pool: availableFactions, target: effTarget })
            }
          >
            Shuffle seats &amp; start the draft
          </button>
        </div>
      </section>
    );
  }

  const orderItems: OrderItem[] = state.seats.map((name, i) => {
    const claim = state.claims.find((c) => c.seatIndex === i);
    return {
      name,
      first: i === 0,
      current: state.phase === "act" && i === state.activeSeat,
      done: !!claim,
      who: claim
        ? `${byId[claim.id].name} — ${claimVP(claim)} VP`
        : `${state.tokens[i]} token${state.tokens[i] === 1 ? "" : "s"} left`,
    };
  });

  if (state.phase === "act") {
    const faction = state.currentId ? byId[state.currentId] : null;
    const tokensLeft = state.tokens[state.activeSeat];
    const forced = tokensLeft === 0;
    const lastPlayer = state.seats.length - state.claims.length === 1;
    const claimedIds = new Set(state.claims.map((c) => c.id));

    return (
      <section>
        <h2>Turn Order</h2>
        <OrderList items={orderItems} />
        {lastPlayer && (
          <>
            <div className="picker-banner">
              <b>{state.seats[state.activeSeat]}</b> is the only one left drafting — no one to pass to, so pick
              any faction that still fits, bounty and all. Unclaimed ones sit at 0 bounty; you'll still bank your{" "}
              {tokensLeft} unspent token{tokensLeft === 1 ? "" : "s"} as VP either way.
            </div>
            <div className="grid">
              {availableFactions
                .filter((f) => !claimedIds.has(f.id))
                .map((f) => {
                  const reason = reachBlockReason(claimedIds, f.id, state.seats.length, availableFactions, effTarget);
                  const bounty = f.id === state.currentId ? state.bounty : 0;
                  return (
                    <div key={f.id}>
                      <FactionCard
                        faction={f}
                        reachBadge
                        cornerTag
                        dimmed={!!reason}
                        disabled={!!reason}
                        title={reason ?? undefined}
                        onClick={() => dispatch({ type: "CLAIM_FROM_POOL", id: f.id })}
                      />
                      <p className="pool-note">{bounty > 0 ? `${bounty} bounty VP` : "no bounty yet"}</p>
                    </div>
                  );
                })}
            </div>
          </>
        )}
        {!lastPlayer && faction && (
          <>
            <div className="picker-banner">
              <b>{state.seats[state.activeSeat]}</b> — claim <b>{faction.name}</b> for{" "}
              <span className="stamp ok">{state.bounty} VP</span>, or pass and add +1 VP bounty (
              {tokensLeft} token{tokensLeft === 1 ? "" : "s"} left)
              {forced ? " — out of tokens, must claim" : ""}.
            </div>
            <div className="grid">
              <FactionCard faction={faction} reachBadge cornerTag />
            </div>
            <div className="btn-row">
              <button className="btn" onClick={() => dispatch({ type: "CLAIM", pool: availableFactions, target: effTarget })}>
                Claim {faction.name}
              </button>
              <button className="btn secondary" disabled={forced} onClick={() => dispatch({ type: "PASS" })}>
                Pass (−1 token, +1 bounty)
              </button>
            </div>
          </>
        )}
        {state.log.length > 0 && (
          <ul className="reveal-log">
            {state.log
              .slice(-6)
              .reverse()
              .map((entry, i) => (
                <li key={state.log.length - i}>
                  {entry.type === "pass"
                    ? `${state.seats[entry.seatIndex]} passes — ${entry.tokensLeft} token${entry.tokensLeft === 1 ? "" : "s"} left.`
                    : `${state.seats[entry.seatIndex]} claims ${byId[entry.id].name} — ${entry.bounty} bounty + ${entry.tokensLeft} token${entry.tokensLeft === 1 ? "" : "s"} left.`}
                </li>
              ))}
          </ul>
        )}
        <div className="btn-row">
          <button className="btn secondary" disabled={!state.past.length} onClick={() => dispatch({ type: "UNDO" })}>
            Undo last action
          </button>
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  // done
  const normalized = normalizeVP(state.claims);
  const total = state.claims.reduce((s, c) => s + byId[c.id].reach, 0);
  const rec = REACH_TARGET[playerCount];
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const idx = state.claims.findIndex((c) => c.seatIndex === i);
    const claim = state.claims[idx];
    const f = byId[claim.id];
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
          {name} — {f.name}
        </>
      ),
      sub: `reach ${f.reach} · ${f.type} · starts at +${normalized[idx]} VP (${claim.bounty} bounty + ${claim.tokensLeft} token${claim.tokensLeft === 1 ? "" : "s"}, normalized)`,
    };
  });

  return (
    <section>
      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      <p className="note">
        Track a starting-VP bonus by moving that player's score marker forward from “0” by their normalized total
        before the game begins — house rule, not from the Law.
      </p>
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <div className="btn-row">
        <button className="btn secondary" disabled={!state.past.length} onClick={() => dispatch({ type: "UNDO" })}>
          Undo last action
        </button>
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
