import type { ReactNode } from "react";
import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import {
  applyAssignPick,
  assignPickOrder,
  favBlockReason,
  favStateFrom,
  resolveFavRound,
  type FavAssigned,
  type FavBanned,
  type FavChoice,
  type FavLocked,
  type FavLogEntry,
} from "../lib/fav";
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
import { RevealCeremony, type RevealSeatItem } from "../components/RevealCeremony";
import { HirelingSetup } from "../components/HirelingSetup";
import { VagabondCharacterSetup } from "../components/VagabondCharacterSetup";
import { KnaveCaptainSetup } from "../components/KnaveCaptainSetup";

interface FavModeState {
  phase: "setup" | "pass" | "choose" | "reveal" | "assign-pass" | "assign-choose" | "assign-reveal" | "done";
  seats: string[];
  pool: string[];
  banned: FavBanned[];
  locked: FavLocked[];
  pending: number[];
  choiceIdx: number;
  choices: FavChoice[];
  round: number;
  assigned: FavAssigned[];
  log: FavLogEntry[];
  pickKind: "fav" | "ban";
  pickId: string | null;
  assignOrder: number[];
  assignIdx: number;
  assignPickId: string | null;
}

const initialState: FavModeState = {
  phase: "setup",
  seats: [],
  pool: [],
  banned: [],
  locked: [],
  pending: [],
  choiceIdx: 0,
  choices: [],
  round: 1,
  assigned: [],
  log: [],
  pickKind: "fav",
  pickId: null,
  assignOrder: [],
  assignIdx: 0,
  assignPickId: null,
};

type FavModeAction =
  | { type: "START"; seats: string[]; pool: string[] }
  | { type: "SHOW" }
  | { type: "SET_KIND"; kind: "fav" | "ban" }
  | { type: "SET_PICK_ID"; id: string }
  | { type: "CONFIRM"; playerCount: number; target: number }
  | { type: "CONTINUE"; playerCount: number; target: number }
  | { type: "ASSIGN_SHOW" }
  | { type: "ASSIGN_SET_PICK"; id: string }
  | { type: "ASSIGN_CONFIRM" }
  | { type: "ASSIGN_CONTINUE" }
  | { type: "RESET" };

function favReducer(state: FavModeState, action: FavModeAction): FavModeState {
  switch (action.type) {
    case "START":
      return { ...initialState, seats: action.seats, pool: action.pool, pending: action.seats.map((_, i) => i), phase: "pass" };
    case "SHOW":
      return { ...state, phase: "choose", pickKind: "fav", pickId: null };
    case "SET_KIND":
      return { ...state, pickKind: action.kind, pickId: null };
    case "SET_PICK_ID":
      return { ...state, pickId: action.id };
    case "CONFIRM": {
      if (state.pickId === null) return state;
      const choices = [...state.choices, { seatIndex: state.pending[state.choiceIdx], kind: state.pickKind, id: state.pickId }];
      const choiceIdx = state.choiceIdx + 1;
      if (choiceIdx < state.pending.length) return { ...state, choices, choiceIdx, phase: "pass" };
      const resolved = resolveFavRound(state.pool, state.locked, state.banned, choices, action.playerCount, action.target);
      return {
        ...state,
        pool: resolved.pool,
        banned: resolved.banned,
        locked: resolved.locked,
        log: resolved.log,
        pending: resolved.pending,
        choices: [],
        choiceIdx: 0,
        phase: "reveal",
      };
    }
    case "CONTINUE": {
      if (state.pending.length) return { ...state, round: state.round + 1, phase: "pass" };
      const assignOrder = assignPickOrder(state.banned);
      if (!assignOrder.length) {
        const assigned: FavAssigned[] = state.locked.map((l) => ({ seatIndex: l.seatIndex, id: l.id, via: "fav" }));
        return { ...state, assigned, phase: "done" };
      }
      return { ...state, assignOrder, assignIdx: 0, assignPickId: null, phase: "assign-pass" };
    }
    case "ASSIGN_SHOW":
      return { ...state, phase: "assign-choose", assignPickId: null };
    case "ASSIGN_SET_PICK":
      return { ...state, assignPickId: action.id };
    case "ASSIGN_CONFIRM": {
      if (state.assignPickId === null) return state;
      const { pool, locked, log } = applyAssignPick(
        state.pool,
        state.locked,
        state.assignOrder[state.assignIdx],
        state.assignPickId,
      );
      return { ...state, pool, locked, log, phase: "assign-reveal" };
    }
    case "ASSIGN_CONTINUE": {
      const assignIdx = state.assignIdx + 1;
      if (assignIdx < state.assignOrder.length) {
        return { ...state, assignIdx, assignPickId: null, phase: "assign-pass" };
      }
      const assigned: FavAssigned[] = state.locked.map((l) => ({
        seatIndex: l.seatIndex,
        id: l.id,
        via: state.assignOrder.includes(l.seatIndex) ? "picked" : "fav",
      }));
      return { ...state, assigned, phase: "done" };
    }
    case "RESET":
      return initialState;
  }
}

function renderLogEntry(entry: FavLogEntry, seats: string[]): ReactNode {
  const name = (si: number) => <b>{seats[si]}</b>;
  const fname = (id: string) => <b>{byId[id].name}</b>;
  switch (entry.type) {
    case "ban-already-gone":
      return <>{name(entry.by)} also banned {fname(entry.id)} — already gone.</>;
    case "ban-void":
      return (
        <>
          {name(entry.by)} tried to ban {fname(entry.id)}, but the table couldn’t reach the total without it — they
          choose again.
        </>
      );
    case "ban-applied":
      return <>✖ {name(entry.by)} banned {fname(entry.id)}.</>;
    case "fav-void-banned":
      return (
        <>
          {name(entry.by)} favorited {fname(entry.id)}, but the ban trumps it — they choose again.
        </>
      );
    case "fav-void-removed":
      return (
        <>
          {name(entry.by)} favorited {fname(entry.id)}, but it just left the pool — never in the same game as its
          other half (A.8.1) — they choose again.
        </>
      );
    case "fav-void-pair":
      return (
        <>
          {name(entry.vagabondBy)} favorited {fname("vagabond")} and {name(entry.knavesBy)} favorited{" "}
          {fname("knaves")} — they can never both survive (A.8.1), so neither wins; both stay in the pool and
          choose again.
        </>
      );
    case "fav-void-collision":
      return (
        <>
          {entry.byList.map((si, i) => (
            <span key={si}>
              {i > 0 && " and "}
              {name(si)}
            </span>
          ))}{" "}
          both favorited {fname(entry.id)} — it stays in the pool and both choose again.
        </>
      );
    case "fav-void-infeasible":
      return (
        <>
          {name(entry.by)} favorited {fname(entry.id)}, but locking it would leave the table short — they choose
          again.
        </>
      );
    case "fav-applied":
      return <>♥ {name(entry.by)} plays {fname(entry.id)}.</>;
    case "assign-applied":
      return <>🎯 {name(entry.by)} picks {fname(entry.id)}.</>;
    case "half-removed":
      return (
        <>
          {fname(entry.id)} leaves the pool — never in the same game as {fname(entry.causeId)} (A.8.1).
        </>
      );
  }
}

export function FavBanMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.fav", favReducer, initialState);

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-fav" summary="How this works">
          In secret, each player either <b>♥ favorites</b> one faction (it’s locked to them) or <b>✖ bans</b> one
          (nobody can play it). Then everything is revealed: bans trump favorites, and if two players favorited the
          same faction it stays in the pool and both choose again — new bans allowed. Repeat until settled. Then
          banners pick from what survives, one at a time, first-to-ban going last — so banning costs you the pick
          order favoriting would've earned. Every pick is still constrained so the table makes its reach total with
          at least one militant. The Second Vagabond sits out, and the Vagabond and Knaves can never both end up in
          play (A.8.1).
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
                seats: shuffleArr(playerNames().slice()),
                pool: availableFactions.filter((f) => f.id !== "vagabond2").map((f) => f.id),
              })
            }
          >
            Shuffle seats &amp; start
          </button>
        </div>
      </section>
    );
  }

  const orderItems: OrderItem[] = state.seats.map((name, i) => {
    const lock = state.locked.find((l) => l.seatIndex === i);
    const isCurrent = i === state.pending[state.choiceIdx];
    const waiting = state.pending.slice(state.choiceIdx).includes(i);
    const chosen = state.pending.slice(0, state.choiceIdx).includes(i);
    return {
      name,
      first: i === 0,
      current: isCurrent,
      done: !!lock || chosen,
      who: lock
        ? `♥ ${byId[lock.id].name}`
        : chosen
          ? "has chosen"
          : isCurrent
            ? "up now"
            : waiting
              ? "choosing this round"
              : i === 0
                ? "first player"
                : `turn ${i + 1}`,
    };
  });

  if (state.phase === "pass" || state.phase === "choose") {
    const seatIdx = state.pending[state.choiceIdx];
    const actorName = state.seats[seatIdx];
    const actorKey = `fav-choose-${state.round}-${state.choiceIdx}`;
    const bannedNames = state.banned.map((b) => byId[b.id].name);
    const { lockedSum, lockedMilitant, slots } = favStateFrom(state.locked, playerCount);

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
            {bannedNames.length > 0 && <p className="note">Banned so far: {bannedNames.join(", ")}.</p>}
          </>
        }
        footer={<ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>}
      >
        <section>
          <div className="picker-banner">
            <b>{actorName}</b> — favorite one faction or ban one, in secret.
          </div>
          <div className="kind-toggle">
            <button className="fav" aria-pressed={state.pickKind === "fav"} onClick={() => dispatch({ type: "SET_KIND", kind: "fav" })}>
              ♥ Favorite — I want to play this
            </button>
            <button className="ban" aria-pressed={state.pickKind === "ban"} onClick={() => dispatch({ type: "SET_KIND", kind: "ban" })}>
              ✖ Ban — nobody plays this
            </button>
          </div>
          <GridLegend />
          <div className="grid">
            {state.pool.map((id) => {
              const f = byId[id];
              const reason = favBlockReason(state.pickKind, id, { pool: state.pool, lockedSum, lockedMilitant, slots, target: effTarget });
              return (
                <div key={id}>
                  <FactionCard
                    faction={f}
                    reachBadge
                    selected={state.pickId === id && state.pickKind === "fav"}
                    selectedBan={state.pickId === id && state.pickKind === "ban"}
                    dimmed={!!reason}
                    disabled={!!reason}
                    onClick={() => dispatch({ type: "SET_PICK_ID", id })}
                  />
                  {reason && <p className="pool-note">{reason}</p>}
                </div>
              );
            })}
          </div>
          <div className="btn-row">
            <button
              className="btn"
              disabled={!state.pickId}
              onClick={() => dispatch({ type: "CONFIRM", playerCount, target: effTarget })}
            >
              {state.pickId
                ? state.pickKind === "fav"
                  ? `Lock in ♥ ${byId[state.pickId].name}`
                  : `Lock in ✖ ban ${byId[state.pickId].name}`
                : "Lock in"}
            </button>
          </div>
        </section>
      </PassDeviceGate>
    );
  }

  if (state.phase === "reveal") {
    return (
      <section>
        <h2>{state.round === 1 ? "The Reveal" : `The Reveal — round ${state.round}`}</h2>
        <ul className="reveal-log">
          {state.log.map((entry, i) => (
            <li key={i} className={entry.cls}>
              {renderLogEntry(entry, state.seats)}
            </li>
          ))}
        </ul>
        <div className="btn-row">
          <button className="btn" onClick={() => dispatch({ type: "CONTINUE", playerCount, target: effTarget })}>
            {state.pending.length ? `Continue — ${state.pending.map((si) => state.seats[si]).join(" and ")} choose again` : "Assign the rest"}
          </button>
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  if (state.phase === "assign-pass" || state.phase === "assign-choose") {
    const actorName = state.seats[state.assignOrder[state.assignIdx]];
    const actorKey = `fav-assign-${state.assignIdx}`;
    const { lockedSum, lockedMilitant, slots } = favStateFrom(state.locked, playerCount);

    return (
      <PassDeviceGate
        actorName={actorName}
        actorKey={actorKey}
        onAcknowledge={() => {
          if (state.phase === "assign-pass") dispatch({ type: "ASSIGN_SHOW" });
        }}
        detail={
          <p className="note">
            Banners pick from what's left, first-to-ban going last:{" "}
            {state.assignOrder.map((si) => state.seats[si]).join(", ")}.
          </p>
        }
        footer={<ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>}
      >
        <section>
          <div className="picker-banner">
            <b>{actorName}</b> — pick a faction from what survives.
          </div>
          <GridLegend />
          <div className="grid">
            {state.pool.map((id) => {
              const f = byId[id];
              const reason = favBlockReason("fav", id, { pool: state.pool, lockedSum, lockedMilitant, slots, target: effTarget });
              return (
                <div key={id}>
                  <FactionCard
                    faction={f}
                    reachBadge
                    selected={state.assignPickId === id}
                    dimmed={!!reason}
                    disabled={!!reason}
                    onClick={() => dispatch({ type: "ASSIGN_SET_PICK", id })}
                  />
                  {reason && <p className="pool-note">{reason}</p>}
                </div>
              );
            })}
          </div>
          <div className="btn-row">
            <button className="btn" disabled={!state.assignPickId} onClick={() => dispatch({ type: "ASSIGN_CONFIRM" })}>
              {state.assignPickId ? `Pick ${byId[state.assignPickId].name}` : "Pick"}
            </button>
          </div>
        </section>
      </PassDeviceGate>
    );
  }

  if (state.phase === "assign-reveal") {
    return (
      <section>
        <h2>Picked</h2>
        <ul className="reveal-log">
          {state.log.map((entry, i) => (
            <li key={i} className={entry.cls}>
              {renderLogEntry(entry, state.seats)}
            </li>
          ))}
        </ul>
        <div className="btn-row">
          <button className="btn" onClick={() => dispatch({ type: "ASSIGN_CONTINUE" })}>
            {state.assignIdx + 1 < state.assignOrder.length
              ? `Continue — ${state.seats[state.assignOrder[state.assignIdx + 1]]} picks next`
              : "Finish"}
          </button>
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  // done
  const total = state.assigned.reduce((s, a) => s + byId[a.id].reach, 0);
  const rec = REACH_TARGET[playerCount];
  const finalFactionIds = new Set(state.assigned.map((a) => a.id));
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const a = state.assigned.find((x) => x.seatIndex === i)!;
    const f = byId[a.id];
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
          {name} — {f.name}
        </>
      ),
      sub: `turn ${i + 1}${i === 0 ? " (first player)" : ""} · reach ${f.reach} · ${f.type} · ${
        a.via === "fav" ? "♥ favorite" : "🎯 picked"
      }`,
    };
  });
  if (state.banned.length) {
    summaryItems.push({
      primary: "Banned",
      sub: state.banned.map((b) => `${byId[b.id].name} (by ${state.seats[b.by]})`).join(", "),
      faded: true,
    });
  }
  const revealItems: RevealSeatItem[] = state.seats.map((name, i) => {
    const a = state.assigned.find((x) => x.seatIndex === i)!;
    return {
      name,
      faction: byId[a.id],
      first: i === 0,
      note: a.via === "fav" ? "locked as favorite" : "picked from the survivors",
    };
  });

  return (
    <section>
      <RevealCeremony storageKey="fav" items={revealItems} />
      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <HirelingSetup storageKey="fav" finalFactionIds={finalFactionIds} />
      <VagabondCharacterSetup storageKey="fav" finalFactionIds={finalFactionIds} />
      <KnaveCaptainSetup storageKey="fav" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
