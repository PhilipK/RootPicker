import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import {
  currentGiver,
  leftNeighbor,
  legalSurvivors,
  santaReducer,
  initialSantaState,
  type SantaEvent,
} from "../lib/santa";
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

function eventLine(ev: SantaEvent, seats: string[]): { cls: string; text: string } {
  const giverName = seats[ev.giverSeat];
  const receiverName = seats[ev.seatIndex];
  const factionName = byId[ev.id].name;
  switch (ev.type) {
    case "accepted":
      return { cls: "fav-line", text: `${giverName} gifts the ${factionName} to ${receiverName} — accepted` };
    case "failed":
      return {
        cls: "void-line",
        text: `${giverName}'s gift of the ${factionName} to ${receiverName} bounces — ${ev.reason}`,
      };
    case "repicked":
      return { cls: "ban-line", text: `${giverName} re-picks the ${factionName} for ${receiverName}` };
  }
}

export function SecretSantaMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.santa", santaReducer, initialSantaState);

  const santaPool = availableFactions.filter((f) => f.id !== "vagabond2");

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-santa" summary="How this works">
          The device passes around once: each player secretly gifts one faction to their left-hand neighbor —
          nothing is gated here, gift anything you like, even something someone else already gifted. Once every
          gift is locked in, the reveal resolves them in seat order: a gift is accepted onto the table if it
          isn't a duplicate, doesn't pair the Vagabond with the Knaves (A.8.1), and leaves the table still able
          to reach the target — the same completability guard Simple mode runs per pick. A gift that fails any
          of those bounces back to its giver, who open-repicks a legal replacement right there, in full view of
          the table. Whoever's gift bounces first gets first player as compensation for ending up with an
          arbitrary substitute instead of the gift a friend actually picked for them — nobody bounces, seat 0
          opens as usual. Two players always turns into a straight exchange; you'll just have to hope you didn't
          both gift the same faction. This structure is a house rule, not from the Law, but nothing about
          scoring changes.
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
            Shuffle seats &amp; start gifting
          </button>
        </div>
      </section>
    );
  }

  const n = state.seats.length;

  if (state.phase === "pass" || state.phase === "gift") {
    const giver = currentGiver(state);
    const receiver = leftNeighbor(giver, n);
    const orderItems: OrderItem[] = state.seats.map((name, i) => {
      const sent = i < giver;
      const isCurrent = i === giver;
      return {
        name,
        first: false,
        current: isCurrent,
        done: sent,
        who: sent ? "gift sent" : isCurrent ? "up now" : `turn ${i + 1}`,
      };
    });

    return (
      <PassDeviceGate
        actorName={state.seats[giver]}
        actorKey={`santa-${giver}`}
        onAcknowledge={() => {
          if (state.phase === "pass") dispatch({ type: "SHOW" });
        }}
        detail={<OrderList items={orderItems} />}
        footer={<ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>}
      >
        <section>
          <div className="picker-banner">
            <b>{state.seats[giver]}</b> — secretly gift one faction to <b>{state.seats[receiver]}</b>, your left-hand
            neighbor. Anything goes here; the reveal sorts out conflicts later.
          </div>
          <GridLegend />
          <div className="grid">
            {santaPool.map((f) => (
              <FactionCard key={f.id} faction={f} reachBadge onClick={() => dispatch({ type: "GIFT", id: f.id })} />
            ))}
          </div>
        </section>
      </PassDeviceGate>
    );
  }

  // reveal | repick | done
  const orderItems: OrderItem[] = state.seats.map((name, i) => {
    const settled = state.assign[i] !== null;
    const isCurrent = state.phase !== "done" && i === state.revealPointer;
    return {
      name,
      first: state.phase === "done" ? i === state.firstSeat : false,
      current: isCurrent,
      done: settled,
      who: settled ? byId[state.assign[i]!].name : isCurrent ? "resolving now" : `turn ${i + 1}`,
    };
  });

  const logItems = state.events
    .map((ev, i) => ({ ev, i }))
    .reverse()
    .map(({ ev, i }) => {
      const { cls, text } = eventLine(ev, state.seats);
      return (
        <li key={i} className={cls}>
          {text}
        </li>
      );
    });

  if (state.phase === "reveal" || state.phase === "repick") {
    const lastFailed = state.phase === "repick" ? state.events[state.events.length - 1] : null;

    return (
      <section>
        <h2>The Reveal</h2>
        <OrderList items={orderItems} />

        {state.phase === "repick" && lastFailed ? (
          <>
            <div className="picker-banner">
              <b>{state.seats[lastFailed.giverSeat]}</b>'s gift of the <b>{byId[lastFailed.id].name}</b> to{" "}
              <b>{state.seats[lastFailed.seatIndex]}</b> bounces — {lastFailed.reason}. <b>{state.seats[lastFailed.giverSeat]}</b>
              , pick a legal replacement.
            </div>
            <GridLegend />
            <div className="grid">
              {legalSurvivors(
                new Set(state.assign.filter((x): x is string => x !== null)),
                santaPool,
                n,
                effTarget,
              ).map((id) => (
                <FactionCard
                  key={id}
                  faction={byId[id]}
                  reachBadge
                  onClick={() => dispatch({ type: "REPICK", id, available: santaPool, target: effTarget })}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="btn-row">
            <button className="btn" onClick={() => dispatch({ type: "REVEAL", count: 1, available: santaPool, target: effTarget })}>
              Reveal the next gift
            </button>
            <button
              className="btn secondary"
              onClick={() => dispatch({ type: "REVEAL", count: n, available: santaPool, target: effTarget })}
            >
              Reveal the rest
            </button>
          </div>
        )}

        <ul className="reveal-log">{logItems}</ul>
        <div className="btn-row">
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  // done
  const assign = state.assign as string[];
  const total = assign.reduce((s, id) => s + byId[id].reach, 0);
  const rec = REACH_TARGET[playerCount];
  const finalFactionIds = new Set(assign);
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const f = byId[assign[i]];
    const ev = state.events.find((e) => e.seatIndex === i && (e.type === "accepted" || e.type === "repicked"))!;
    const giverName = state.seats[ev.giverSeat];
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === state.firstSeat ? "★ " : ""}
          {name} — {f.name}
        </>
      ),
      sub:
        ev.type === "accepted"
          ? `gifted by ${giverName} · reach ${f.reach} · ${f.type}`
          : `re-picked by ${giverName} after their gift bounced · reach ${f.reach} · ${f.type}`,
    };
  });
  const revealItems: RevealSeatItem[] = state.seats.map((name, i) => {
    const ev = state.events.find((e) => e.seatIndex === i && (e.type === "accepted" || e.type === "repicked"))!;
    return {
      name,
      faction: byId[assign[i]],
      first: i === state.firstSeat,
      note: ev.type === "accepted" ? `gifted by ${state.seats[ev.giverSeat]}` : "arrived by open re-pick",
    };
  });

  return (
    <section>
      <RevealCeremony storageKey="santa" items={revealItems} />
      <h2>The Gifts, Unwrapped</h2>
      <ul className="reveal-log">{logItems}</ul>
      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <HirelingSetup storageKey="santa" finalFactionIds={finalFactionIds} />
      <VagabondCharacterSetup storageKey="santa" finalFactionIds={finalFactionIds} />
      <KnaveCaptainSetup storageKey="santa" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
