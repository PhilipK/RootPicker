# Possible New Modes

Design sketches for picker modes not yet implemented. Existing modes for reference:
Simple (free pick), Draft (Law A.8.3), Hand draft, Fav/Ban, Cut & Choose, Teaching
Tiers, Wishlist optimizer.

## Potluck Draft — IMPLEMENTED

Now live as `src/modes/PotluckDraftMode.tsx` (`ModeId: "potluck"`), guard logic in
`src/lib/potluck.ts`. Everyone brings a faction to the table; nobody plays the
one they brought.

### Rules

1. Shuffle seats, as in every other mode. In seat order, each player adds ONE
   faction to a shared pool — open information, the pool builds where
   everyone can see it. Contributions are gated by `reachBlockReason`
   (`src/lib/reach.ts`) exactly like Simple mode picks, so the final pool of
   `playerCount` factions always meets the reach target (or 17+ for
   adventurous groups). Vagabond/Knaves exclusion (A.8.1) and Second Vagabond
   gating come free from the same function. Standard adventurous checkbox in
   setup.
2. Once the pool is full, picking happens in REVERSE seat order — last
   contributor picks first. Each player takes one faction from the pool, with
   a single rule: never the one they themselves contributed.
3. Deadlock guard: with "not your own" as the only per-player constraint, the
   only way to get stuck is a picker being left with only their own
   contribution. The app blocks any pick that would leave *any* later picker
   in that spot, not just the very last one — see "Why legal combinations."
4. Whoever picks last goes first in the actual game, same compensation as
   Advanced Draft and Teaching Tiers. Because pick order is the exact reverse
   of seat order, "picks last" is always seat 0 — which is already the app's
   standing convention for "first player," so no extra bookkeeping is needed.
5. Two players is a forced swap: you play what they brought, they play what
   you brought. Nothing to guard against — it's just the only arrangement two
   people can make — so the Explainer notes it with a wink instead of
   blocking it.

### Why fair

Contributing is preference expression with consequences: you'll never play
what you bring, so the honest move is to bring something you'd enjoy
*facing*, or something you want someone else at the table to try — not your
comfort pick. Picking first compensates for contributing last: seat N (last
to add to the pool, so the one reacting to the fullest picture of it) also
picks first. The real turn-order compensation, though, is the game-order
reversal in rule 4 — the seat that picks last (always seat 0, by
construction) starts the actual game, offsetting whatever edge picking last
in the draft cost them.

### Why legal combinations

Contribute-phase gating is identical to Simple mode: `reachBlockReason` on
every addition, so the final pool always hits the Law 5.2 total by
construction, with Vagabond/Knaves and Second Vagabond handled for free.

Pick-phase legality is a different problem: reach is no longer at stake (the
pool is already a fixed legal set of `playerCount` factions), the only rule
is "not your own." The one way to break that is a bad earlier pick stranding
a later picker with nothing but their own contribution — and this isn't only
possible at the very last seat. `src/lib/potluck.ts` exports
`hasCompleteMatching`, a small bipartite-matching check (Kuhn's algorithm):
before allowing a candidate pick, simulate removing it and ask whether the
*remaining* pickers can still be matched to the *remaining* pool with nobody
stuck with their own faction. The pool is capped at 6 factions, so this is
trivially cheap, and it subsumes the hard-coded "last picker" case rather
than special-casing it — it also catches a stranding two turns out (a
3-remaining choice that dooms the picker after next), which a check that
only looked at the final seat would miss. `src/lib/potluck.test.ts` builds
exactly such a 2-remaining scenario.

### Implementation notes

`usePersistedReducer` state machine (`setup → contribute → pick → done`).
UI: `NameInputs` for setup, `OrderList` for both the contribute and pick
turn orders (unified "up now" / "turn N" wording), a `FactionCard` grid for
both phases — contribute-phase cards show `takenBy` once claimed by the
pool, pick-phase cards are `dimmed`/`disabled` with a `title` reason from
`pickBlockReason` when blocked — then `SummaryList` + `SetupChecklist` +
`ReachStampLine` at the end, each summary line noting what that seat
brought alongside what they ended up playing. No new CSS; reuses `.grid`,
`.picker-banner`, `.order-list`, `.btn` etc. No house-rule tag: unlike
Bounty/Auction, nothing here adjusts scoring — it only changes who ends up
with which (already-legal) faction, the same basis Hand Draft/Fav-Ban/Cut &
Choose/Teaching Tiers are judged on.

## Bounty Draft — IMPLEMENTED

Now live as `src/modes/BountyDraftMode.tsx` (`ModeId: "bounty"`), turn logic in
`src/lib/bounty.ts`. Sketch kept for the rationale. Two deltas from the sketch
below: token count is `playerCount` (not a flat 3), and unspent tokens bank as
VP for every claim, not just the last — so final totals are normalized to a
0 floor (lowest total becomes 0) since only the gap between players matters.

"No Thanks!"-style auction. The table prices faction strength and preference live,
instead of anyone arguing about balance.

### Rules

1. Shuffle seats, random first player. App builds a face-down deck from owned
   factions (Second Vagabond excluded, as in Hand draft).
2. App reveals one faction. Starting with the last player in turn order, each
   remaining player either:
   - **Claim** — take the faction plus all bounty VP on it (start the game with
     that many VP), and leave the draft.
   - **Pass** — spend 1 of 3 personal bounty tokens, adding +1 VP bounty to the
     faction. Out of tokens = must claim.
3. A faction circulates until claimed; it is never discarded. Then the next
   faction is revealed for the remaining players. The last player claims the
   final reveal and keeps unspent tokens as VP.

Termination is guaranteed by the token economy: each pass costs a token, tokens
are finite, and a player with 0 tokens must claim on their turn. Worst case all
remaining players pass until broke and the next in rotation is forced to take
it — with a large bounty attached, which is the compensation working as intended.

### Why fair

Self-pricing market. A strong faction gets claimed at 0 bounty instantly; a weak
or disliked one circulates and accumulates VP until someone finds the price worth
it. It prices *preference* too: the player who loves the Lizard Cult claims it
early and cheap, while a player forced onto it gets compensated. Unlike Cut &
Choose, no single player carries the lineup-balance burden.

### Why legal combinations

The reveal filter reuses `reachBlockReason` (`src/lib/reach.ts`): a faction only
enters the reveal pool if claimed-set + it + best remaining can still hit
`effTarget`. The invariant holds after every claim, so the final table always
reaches the Law 5.2 total. Vagabond/Knaves exclusion (A.8.1) and Second Vagabond
gating come free from the same function. The Adventurous 17+ checkbox works
unchanged.

Caveat for the Explainer: the starting-VP bounty is a house rule, not from the
Law — same precedent as Wishlist mode's +1 VP suggestion.

### Implementation notes

Fits existing patterns exactly. `usePersistedReducer` state machine
(`setup → auction → done`), phases mirror `CutChooseMode`. UI: `PlayerStepper`,
`NameInputs`, `OrderList` for turn order, a big `FactionCard` for the current
reveal with a bounty stamp, `SummaryList` + `SetupChecklist` + `ReachStampLine`
at the end. New `ModeId: "bounty"`.

Tuning: 3 tokens per player default. 2 = faster with more forced claims;
4 = more circulation, better at 5–6 players.

## Riverfolk Auction — IMPLEMENTED

Now live as `src/modes/RiverfolkAuctionMode.tsx` (`ModeId: "auction"`). Sketch
kept for the rationale and the open tuning questions below.

Every draft's real scarce resource is pick order. Don't randomize it — sell it.
Players sealed-bid VP for the right to pick first.

### Rules

1. Device passes around once: each player secretly enters a bid, 0–5 VP.
2. Reveal all bids. Pick order = bid order, highest first, ties broken randomly.
   Each player starts the game at −(their bid) VP.
3. Players pick in that order from the full owned pool, with the same
   `reachBlockReason` filtering as Simple mode, so every partial selection stays
   completable and the final table is legal.

All-zero bids degrade gracefully: random order, free pick — Simple mode with a
fair turn order.

### Why fair

Self-handicapping. The player who desperately wants the Eyrie pays for the
privilege in VP; the player with no preference bids 0 and gets compensated with
a stronger relative position. Nobody can be exploited: your bid only ever costs
you what you declared the priority was worth. Thematically on the nose — you're
paying the Riverfolk Company for services.

### Why legal combinations

Identical to Simple mode: `reachBlockReason` gates every pick, so reach target,
Vagabond/Knaves exclusion, and Second Vagabond gating all hold by construction.
The last picker only sees options that complete a legal table. Negative starting
VP is a house rule (same precedent as Wishlist's +1 VP).

### Implementation notes

Lightest of the three sketches. `usePersistedReducer` machine
(`setup → bid → pick → done`). Bid phase reuses the pass-the-device pattern from
Hand draft (show "hand device to X", secret input, confirm). Pick phase is
Simple mode's grid with a `picker-banner`. Summary shows each player's faction
plus "starts at −k VP". New `ModeId: "auction"`.

Tuning / open questions:
- Bid cap 5 VP is a guess; 3 keeps it tame, uncapped is funnier but a 10 VP bid
  probably ruins that player's game.
- Vickrey option: winner pays the second-highest bid instead of their own.
  Reduces overbidding regret, classic auction-theory fix — worth a settings
  toggle if the mode lands.
- Could charge every player their bid, or only the players who beat someone.
  Charging everyone is simpler and keeps bluff-bidding honest.

## Exile Draft — IMPLEMENTED

Now live as `src/modes/ExileDraftMode.tsx` (`ModeId: "exile"`), pure logic in
`src/lib/exile.ts`. Inverse of drafting: nobody picks a faction — everyone
removes them. Ban down the pool, then the app deals a random legal lineup
from the survivors.

Deviations from the sketch below:
- "Pool is ≤14 factions" counted the Second Vagabond; the actual working pool
  excludes it (`f.id !== "vagabond2"`), same convention every other mode uses
  since it isn't separately bannable — so the real cap is ≤13.
- "The final random deal reuses the legality-aware roll that Fav/Ban mode
  already has" turned out to mean `favFeasible` (`src/lib/fav.ts`) specifically,
  not a literal random-roll function: it's an existence check ("can `slots`
  players still be served"), degenerate exactly to a single-subset legality
  check when `slots` equals the subset's own size. `exile.ts` reuses it for
  both the ban guard (`banBlockReason`, `slots = playerCount` over the whole
  remaining pool) and the final enumeration (`legalLineups`, `slots =
  subset.length` to validate each candidate lineup from `combinations`,
  imported from `src/lib/wish.ts` — also reused rather than re-derived). The
  actual `Math.random()` calls live in the component (`ExileDraftMode.tsx`),
  which passes the chosen index and a `shuffleArr`-shuffled seat order into
  the `DEAL` action, keeping `exileReducer` itself pure.
- Added an explicit `revealReady` phase between the last ban and the deal
  (rather than dealing automatically) so there's a deliberate "Reveal the
  Woodland" button and a `RevealCeremony`, matching the reveal moment every
  other randomness-driven mode (Raffle, Fav/Ban, Trading Post) already gives
  players.
- When the owned pool is already at the 2-slack floor (`totalBans` clamps to
  0), the mode skips the ban phase entirely and starts straight in
  `revealReady` — same clamp the doc's formula already implied, just made
  explicit as a phase transition.

### Rules

1. Random ban order. Total bans = owned pool − playerCount − 2, dealt
   round-robin (snake order) so the survivor pool keeps 2 factions of slack for
   the random deal.
2. On your turn, exile one faction from the pool. A ban is blocked (greyed out)
   if removing that faction would leave no legal lineup for the player count.
3. After the last ban, the app rolls a random legal lineup from the survivors —
   reach ≥ target, at least one militant, Vagabond/Knaves exclusion — and
   assigns factions to seats at random. Reveal all at once.

### Why fair

Nobody controls their own faction, so bans are pure preference expression, and
everyone gets (nearly) the same number of them. The core tension: ban what you
hate *playing*, or ban what you fear *facing* — you can't do both. Kingmaking is
impossible because assignment is random; the only lever anyone has is shaping
the shared pool.

When bans don't divide evenly (e.g. 6 players, 13-faction pool → 5 bans), the
players who banned fewer times get priority for the first-player seat as
compensation.

### Why legal combinations

Ban validation is the mirror of `reachBlockReason`: instead of "can this
selection still succeed", check "does a legal playerCount-subset of the
remaining pool still exist". Pool is ≤14 factions, so a greedy best-case check
(top reaches, minus Vagabond/Knaves conflicts) is enough — no search needed.
The final random deal reuses the legality-aware roll that Fav/Ban mode already
has.

### Implementation notes

`usePersistedReducer` machine (`setup → ban → done`). UI: faction grid where
tapping exiles (card gets a stamp/dimmed state), `OrderList` showing whose ban
is next, then `SummaryList` + `SetupChecklist` reveal. New `ModeId: "exile"`.

Tuning / open questions:
- Slack of 2 survivors is a guess; 3 gives a swingier deal, 1 makes bans nearly
  deterministic.
- Optional twist for later: each player secretly protects one faction before
  banning starts; a ban on a protected faction bounces (ban wasted). Adds
  bluffing, costs UI complexity — skip for v1.

## Trading Post — IMPLEMENTED

Now live as `src/modes/TradingPostMode.tsx` (`ModeId: "trade"`), algorithm in
`src/lib/trade.ts`. Top Trading Cycles — the mechanism kidney exchanges and
dorm-room assignment actually run on (Shapley–Scarf; extended to vacant goods
by Abdulkadiroğlu & Sönmez).

### Rules

1. Shuffle seats. App deals a random legal lineup (reach ≥ target, A.8.1
   respected, Second Vagabond excluded) — one secret faction per player. Every
   other owned faction sits in a market stall.
2. Device passes around once: each player sees their dealt faction and secretly
   ranks any factions they'd rather play, best first. Ranking nothing means
   keeping the deal.
3. App runs Top Trading Cycles: everyone points at the current holder of their
   top remaining want; stalls point at players by a shuffled priority order;
   every cycle found trades and exits. A player-to-stall trade swaps your
   faction into the market and the stall's out of it.
4. Reveal replays the cycles ("Anna ⇄ Bob", "Carl takes the Lizard Cult from
   the stalls; his Vagabond returns to the market"), then the usual summary.
   Seat 0 is first player, the standing convention.

### Why fair

Individually rational: nobody ever ends worse than their deal, by their own
ranking. Pure TTC is strategyproof (honest ranking is provably optimal) and
core-stable (no clique could break off and trade better among themselves).
The stall extension dents strategyproofness only at the margin where the
legality gate blocks a trade — the Explainer says so honestly.

### Why legal combinations

The deal starts legal by construction (random choice among legal
`playerCount`-subsets, enumerated via `combinations` — at most C(13,6)=1716).
Player-to-player cycles permute the multiset: still legal, zero checks needed.
Only stall cycles change the multiset (one faction in, one out), and each is
gated: an illegal resulting multiset blocks that want and the pointer moves
down the ranking, so the invariant "player multiset legal after every executed
cycle" holds start to finish. Militant presence isn't enforced, matching
Wishlist's subset legality (reach + A.8.1 only).

### Implementation notes

`usePersistedReducer` machine (`setup → rank → done`). Rank phase is
Wishlist's pass-the-device ranking with an unlimited pick count and the dealt
faction shown privately behind the `PassDeviceGate`. Randomness (seat shuffle,
deal, stall priority) is injected at START/SUBMIT from the component, keeping
the reducer pure; `runTrade` itself is deterministic and unit-tested in
`src/lib/trade.test.ts`. Reveal reuses `.reveal-log`. No house-rule tag:
nothing touches scoring.

The stalls are a setup toggle (`rootpicker.tradeStallsOpen`, default on). At
4 players 9 of 12 rankable factions sit in stalls, so ~75% of wishes point at
one — stall trades dominate and the mode drifts toward "pick a favorite from
the whole pool, contested by random priority". Stalls closed is pure
Shapley–Scarf TTC on the dealt lineup: scarcer trades, the deal matters, and
only the dealt factions are offered for ranking (the lineup — not who holds
what — becomes open info, like any dealt draft pool).

## Woodland Raffle — IMPLEMENTED

Now live as `src/modes/RaffleMode.tsx` (`ModeId: "raffle"`), draw logic in
`src/lib/raffle.ts`. Charity-raffle allocation: equal ticket budgets, influence
proportional to declared want, lottery thrill on the draw.

### Rules

1. Shuffle seats. Device passes around: each player secretly spreads their
   ticket budget across any factions (Second Vagabond excluded). All-in is
   greed, spreading is a hedge. Budget defaults to the player count and is
   adjustable in Settings (1–20).
2. All tickets go into one urn, shuffled. Tickets are drawn one at a time on
   the shared screen — a big reveal button, with a fast-forward.
3. A drawn ticket assigns its faction to its player UNLESS the faction is
   already claimed, the player is already settled, or the assignment would
   strand the table below reach — any of those burns the ticket. Burned
   tickets cost exactly their own urn weight, nothing else. Every win also
   eagerly burns all tickets that can no longer win (the winner's leftovers,
   rival tickets on the claimed faction, reach-dead tickets) — sound because
   claims only ever tighten the reach math, so dead is dead forever. The urn
   therefore only ever holds live tickets and every later draw is a win.
4. Urn empty (or everyone settled): unsettled players get a random legal fill.
   The first player to be random-filled becomes first player — compensation
   for getting the least preference expression. Everyone ticket-won: seat 0.

### Why fair

Equal budgets, proportional influence: an all-in vs. a split bet is settled
by the exact ratio of tickets on the line. Not strategyproof — concentration gambling is the point, and the
Explainer says tickets are lottery entries, not orders. A table that
collectively all-ins on insurgents spends the slack early and the rest
random-fill militants; honest behavior, flagged up front.

### Why legal combinations

Every assignment (draw or fill) is gated by `reachBlockReason` against the
already-claimed set, so the partial table stays completable after every event
and the final table is legal by induction — the same guard Simple mode runs
per pick. Vagabond/Knaves exclusion comes free from the same function.

### Implementation notes

`usePersistedReducer` machine (`setup → tickets → draw → done`). Ticket phase
follows Wishlist's pass-the-device pattern with tap-to-add-a-ticket cards
(count shown as the rank badge) and a remove-last control. Urn shuffle, fill
faction order, and fill seat order are all pre-shuffled in the component when
the last player submits, so the reducer stays pure and every draw is
deterministic and unit-testable (`src/lib/raffle.test.ts`). Draw phase renders
`.reveal-log` lines (won / burned + reason). No house-rule tag: nothing
touches scoring.

Tuning / open questions:
- Ticket budget defaults to player count (`rootpicker.raffleTicketCount`
  override, `null` = auto) and is a Settings stepper, clamped 1–20 — fewer is
  coarser preference and more random fill, more is finer-grained but slower
  to draw.
- Burned tickets are shown live as they're drawn — the drama is the point. If
  that drags at 6 players, a "draw all" exists.
