import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { fillRemaining, resolveTicket, ticketsToUrn, type RaffleEvent, type RaffleTicket } from "../lib/raffle";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import { byId, REACH_TARGET } from "../data/factions";
import type { Faction } from "../types";
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

interface RaffleState {
  phase: "setup" | "pass" | "tickets" | "draw" | "done";
  seats: string[];
  turn: number;
  /** tickets[seatIndex] = one faction id per ticket, in tap order (≤ the configured budget) */
  tickets: string[][];
  /** the shuffled urn, fixed when the last player submits */
  urn: RaffleTicket[];
  /** pre-shuffled randomness for the end-of-urn fill */
  fillSeats: number[];
  fillFactions: string[];
  /** how many urn tickets have been drawn so far */
  drawn: number;
  events: RaffleEvent[];
  assign: (string | null)[];
  firstSeat: number;
}

const initialState: RaffleState = {
  phase: "setup",
  seats: [],
  turn: 0,
  tickets: [],
  urn: [],
  fillSeats: [],
  fillFactions: [],
  drawn: 0,
  events: [],
  assign: [],
  firstSeat: 0,
};

type RaffleAction =
  | { type: "START"; seats: string[] }
  | { type: "SHOW" }
  | { type: "ADD_TICKET"; id: string; limit: number }
  | { type: "REMOVE_LAST_TICKET" }
  | { type: "SUBMIT"; urn?: RaffleTicket[]; fillSeats?: number[]; fillFactions?: string[] }
  | { type: "DRAW"; count: number; available: Faction[]; target: number }
  | { type: "RESET" };

function finishIfSettled(state: RaffleState, available: Faction[], target: number): RaffleState {
  const settled = state.assign.every((x) => x !== null);
  if (!settled && state.drawn < state.urn.length) return state;
  const fills = fillRemaining(state.assign, state.fillSeats, state.fillFactions, available, target);
  const assign = state.assign.slice();
  for (const e of fills) assign[e.seatIndex] = e.id;
  return {
    ...state,
    assign,
    events: [...state.events, ...fills],
    // the least-served seat opens the game: first to need a random fill, else seat 0
    firstSeat: fills.length ? fills[0].seatIndex : 0,
    phase: "done",
  };
}

function raffleReducer(state: RaffleState, action: RaffleAction): RaffleState {
  switch (action.type) {
    case "START":
      return {
        ...initialState,
        phase: "pass",
        seats: action.seats,
        tickets: action.seats.map(() => []),
        assign: action.seats.map(() => null),
      };
    case "SHOW":
      return { ...state, phase: "tickets" };
    case "ADD_TICKET": {
      if (state.tickets[state.turn].length >= action.limit) return state;
      const tickets = state.tickets.map((t, i) => (i === state.turn ? [...t, action.id] : t));
      return { ...state, tickets };
    }
    case "REMOVE_LAST_TICKET": {
      const tickets = state.tickets.map((t, i) => (i === state.turn ? t.slice(0, -1) : t));
      return { ...state, tickets };
    }
    case "SUBMIT": {
      const newTurn = state.turn + 1;
      if (newTurn < state.seats.length) return { ...state, turn: newTurn, phase: "pass" };
      return {
        ...state,
        turn: newTurn,
        urn: action.urn!,
        fillSeats: action.fillSeats!,
        fillFactions: action.fillFactions!,
        phase: "draw",
      };
    }
    case "DRAW": {
      if (state.phase !== "draw") return state;
      let next = state;
      for (let k = 0; k < action.count && next.phase === "draw"; k++) {
        if (next.drawn >= next.urn.length) break;
        const ticket = next.urn[next.drawn];
        let ev = resolveTicket(ticket, next.assign, action.available, action.target);
        const assign = next.assign.slice();
        let urn = next.urn;
        if (ev.type === "won") {
          assign[ev.seatIndex] = ev.id;
          // Claims only ever tighten what the table can still hold, so a
          // ticket dead now is dead forever — burn every one of them with the
          // win (the winner's own leftovers, rival tickets on the claimed
          // faction, and anything the reach math just killed) instead of
          // drawing them out one anticlimax at a time.
          const rest = urn.slice(next.drawn + 1);
          const live = rest.filter((t) => resolveTicket(t, assign, action.available, action.target).type === "won");
          const purged = rest.length - live.length;
          if (purged) {
            urn = [...urn.slice(0, next.drawn + 1), ...live];
            ev = { ...ev, purged };
          }
        }
        next = { ...next, urn, drawn: next.drawn + 1, events: [...next.events, ev], assign };
        next = finishIfSettled(next, action.available, action.target);
      }
      return next;
    }
    case "RESET":
      return initialState;
  }
}

function eventLine(ev: RaffleEvent, seats: string[], firstSeat: number): { cls: string; text: string } {
  const name = seats[ev.seatIndex];
  const faction = byId[ev.id].name;
  switch (ev.type) {
    case "won":
      return {
        cls: "fav-line",
        text: `${name} wins the ${faction}!${
          ev.purged
            ? ` ${ev.purged} ticket${ev.purged === 1 ? "" : "s"} that can no longer win burn${ev.purged === 1 ? "s" : ""} with it.`
            : ""
        }`,
      };
    case "burn":
      return {
        cls: "void-line",
        text:
          ev.reason === "faction-taken"
            ? `${name}'s ticket for the ${faction} burns — already claimed`
            : ev.reason === "seat-settled"
              ? `${name}'s ticket for the ${faction} burns — they already have a faction`
              : `${name}'s ticket for the ${faction} burns — it would strand the table below reach`,
      };
    case "fill":
      return {
        cls: "ban-line",
        text: `${name} gets the ${faction} from the leftovers${ev.seatIndex === firstSeat ? " — and first player for it" : ""}`,
      };
  }
}

export function RaffleMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget, raffleTicketCount } =
    useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.raffle", raffleReducer, initialState);

  const rafflePool = availableFactions.filter((f) => f.id !== "vagabond2");

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  const handleConfirm = () => {
    const isLast = state.turn + 1 >= state.seats.length;
    if (!isLast) {
      dispatch({ type: "SUBMIT" });
      return;
    }
    dispatch({
      type: "SUBMIT",
      urn: shuffleArr(ticketsToUrn(state.tickets)),
      fillSeats: shuffleArr(state.seats.map((_, i) => i)),
      fillFactions: shuffleArr(rafflePool.map((f) => f.id)),
    });
  };

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-raffle" summary="How this works">
          Every player secretly spreads <b>{raffleTicketCount} raffle tickets</b> across the factions they want —
          all-in on one is greed, spreading out is a hedge. All tickets go into one urn and are drawn one at a
          time on the shared screen. A drawn ticket wins its faction for its player — and every ticket that can
          no longer win (the winner's leftovers, rival tickets on the claimed faction, anything the reach math
          just killed) burns with the win, so what stays in the urn is always live. Tickets are lottery entries,
          not orders: bad bets cost exactly their own weight. When the urn empties, anyone still empty-handed
          gets a random reach-safe faction from the leftovers, and the first player filled that way opens the
          game as compensation. This structure is a
          house rule, not from the Law, but nothing about scoring changes. Adjust the ticket budget in Settings.
        </Explainer>
        <SetupHero />
        <h2>Seats</h2>
        <p className="note">Names are optional. Seating order is randomized when you start.</p>
        <NameInputs />
        <label className="note" style={{ display: "block" }}>
          <input type="checkbox" checked={adventurous} onChange={(e) => setAdventurous(e.target.checked)} />{" "}
          Adventurous group — allow any mix that reaches 17+
        </label>
        <div className="btn-row">
          <button className="btn" onClick={() => dispatch({ type: "START", seats: shuffleArr(playerNames().slice()) })}>
            Shuffle seats &amp; hand out tickets
          </button>
        </div>
      </section>
    );
  }

  const orderItems: OrderItem[] = state.seats.map((name, i) => {
    const submitted = state.phase !== "pass" && state.phase !== "tickets" ? true : i < state.turn;
    const isCurrent = (state.phase === "pass" || state.phase === "tickets") && i === state.turn;
    const assigned = state.assign[i];
    return {
      name,
      first: state.phase === "done" ? i === state.firstSeat : false,
      current: isCurrent,
      done: submitted,
      who:
        state.phase === "draw" || state.phase === "done"
          ? assigned
            ? byId[assigned].name
            : "waiting on the urn"
          : submitted
            ? "tickets in the urn"
            : isCurrent
              ? "up now"
              : `turn ${i + 1}`,
    };
  });

  if (state.phase === "pass" || state.phase === "tickets") {
    const seat = state.turn;
    const list = state.tickets[seat];
    const left = raffleTicketCount - list.length;
    const counts = new Map<string, number>();
    for (const id of list) counts.set(id, (counts.get(id) ?? 0) + 1);

    return (
      <PassDeviceGate
        actorName={state.seats[seat]}
        actorKey={`raffle-${seat}`}
        onAcknowledge={() => {
          if (state.phase === "pass") dispatch({ type: "SHOW" });
        }}
        detail={<OrderList items={orderItems} />}
      >
        <section>
          <div className="picker-banner">
            <b>{state.seats[seat]}</b> — tap factions to drop tickets on them. <b>{left}</b> ticket
            {left === 1 ? "" : "s"} left.
          </div>
          <GridLegend />
          <div className="grid">
            {rafflePool.map((f) => {
              const n = counts.get(f.id) ?? 0;
              return (
                <FactionCard
                  key={f.id}
                  faction={f}
                  reachBadge
                  selected={n > 0}
                  rankBadge={n > 0 ? n : undefined}
                  disabled={left === 0 && n === 0}
                  title={left === 0 && n === 0 ? "No tickets left — remove one first" : undefined}
                  onClick={() => dispatch({ type: "ADD_TICKET", id: f.id, limit: raffleTicketCount })}
                />
              );
            })}
          </div>
          <div className="btn-row">
            <button
              className="btn secondary"
              disabled={!list.length}
              onClick={() => dispatch({ type: "REMOVE_LAST_TICKET" })}
            >
              Remove last ticket
            </button>
            <button className="btn" disabled={!list.length} onClick={handleConfirm}>
              {list.length ? `Drop my ${list.length} ticket${list.length === 1 ? "" : "s"} in the urn` : "Place at least one ticket"}
            </button>
          </div>
        </section>
      </PassDeviceGate>
    );
  }

  const rec = REACH_TARGET[playerCount];
  const logItems = state.events
    .map((ev, i) => ({ ev, i }))
    .reverse()
    .map(({ ev, i }) => {
      const { cls, text } = eventLine(ev, state.seats, state.firstSeat);
      return (
        <li key={i} className={cls}>
          {text}
        </li>
      );
    });

  if (state.phase === "draw") {
    return (
      <section>
        <h2>The Urn</h2>
        <OrderList items={orderItems} />
        <div className="picker-banner">
          Ticket <b>{state.drawn}</b> of <b>{state.urn.length}</b> drawn.
        </div>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() => dispatch({ type: "DRAW", count: 1, available: rafflePool, target: effTarget })}
          >
            Draw a ticket
          </button>
          <button
            className="btn secondary"
            onClick={() => dispatch({ type: "DRAW", count: state.urn.length, available: rafflePool, target: effTarget })}
          >
            Draw everything
          </button>
        </div>
        <ul className="reveal-log">{logItems}</ul>
        <div className="btn-row">
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  // done
  const total = state.assign.reduce((s, id) => s + byId[id!].reach, 0);
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const f = byId[state.assign[i]!];
    const via = state.events.find((e) => (e.type === "won" || e.type === "fill") && e.seatIndex === i)!;
    const spread = [...new Set(state.tickets[i])]
      .map((id) => `${state.tickets[i].filter((x) => x === id).length} ${byId[id].name}`)
      .join(", ");
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === state.firstSeat ? "★ " : ""}
          {name} — {f.name}
        </>
      ),
      sub: `${via.type === "won" ? "won by ticket" : "random fill"} · tickets: ${spread} · reach ${f.reach} · ${f.type}`,
    };
  });

  return (
    <section>
      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      <h2>The Draw, Ticket by Ticket</h2>
      <ul className="reveal-log">{logItems}</ul>
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <div className="btn-row">
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
