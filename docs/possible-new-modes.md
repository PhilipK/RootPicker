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

## Exile Draft

Inverse of drafting: nobody picks a faction — everyone removes them. Ban down
the pool, then the app deals a random legal lineup from the survivors.

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
