# Possible New Modes

Design sketches for picker modes not yet implemented. Sketches graduate out of
this file when they ship (see git history for the implemented ones). Existing
modes for reference: Simple (free pick), Draft (Law A.8), Hand Draft, Fav/Ban,
Cut & Choose, Riverfolk Auction, Bounty Draft, Teaching Tiers, Wishlist,
Potluck Draft, Trading Post, Woodland Raffle.

## Hand Draft — Just-in-Time Dealing (revision)

Revision to the implemented Hand Draft (`src/modes/HandDraftMode.tsx`): make
every card in your hand guaranteed pickable — what you see is what you can
get. Today the last picker usually faces one or two real options plus an
apology note.

### The problem

The current dealer deals all hands upfront, disjoint, by random shuffle
(`handleDeal` tries 800 shuffles), hunting for a deal where every player
keeps at least two legal cards (`strongOk` in `src/lib/handDraft.ts`) and
settling for merely solvable when the hunt fails. Pick-time filtering then
hides any card that would strand the table on reach or militants — and the
last picker inherits every accumulated constraint.

Keeping upfront hands and demanding all three cards always legal is
possible but poisonous: "every card always pickable" means every
one-card-per-hand combination must reach the target with a militant, which
forces (a) one hand of only militants — otherwise an all-insurgent
selection exists — and (b) the sum of each hand's weakest card to reach
the target. At 4 players that's 21 from four minima against a pool of
reaches 10,9,8,8,7,7,5,4,3,3,2, so the low cards must cluster: {Lizard
Cult, Woodland Alliance, Corvids} as a near-fixed hand, deal after deal.
The guarantee would be bought with stratified, repetitive hands.

### The fix

Deal each hand at the player's turn, from the undealt pool, admitting only
cards that pass "if this gets picked, every later player can still be
dealt a full all-legal hand" — a memoized recursion, same shape as
`strongOk`, but building hands adaptively instead of checking fixed ones.
The dealer reacts to actual picks: early high-reach picks buy later hands
room for low-reach spice, and the worst case that forces tiered hands
upfront never gets locked in.

For players nothing visible changes: same pass-the-device flow, same
secret hand, but every card shown is truly on offer and nothing is ever
hidden. Bonuses:

- 5–6 players get 3-card hands back (currently cut to 2 because 6×3
  exceeds the 13-faction pool): unpicked cards recycle into later hands.
- The "N dealt factions are hidden" note and its information leak vanish.
- The upfront random Vagabond-or-Knaves drop becomes unnecessary: the
  guard simply never deals the Knaves once the Vagabond is picked and vice
  versa (before either is picked they can even share a hand — only one can
  be picked from it). Richer effective pool.

### Why legal combinations

The induction moves from pick time to deal time: a hand enters play only
if all its cards keep the future solvable, so any pick from any hand is
legal by construction. Feasibility of the whole draft is checked once at
start by the same recursion — deterministic, replacing the 800-try hunt
and its silent fallback tier. Militant requirement kept, matching the
current mode.

### Implementation notes

Replace `handleDeal`'s shuffle-hunt and the pick-time `legalIds`/`strong`
filtering in `HandDraftMode.tsx` with a `dealHand(picked, undealt,
playersLeft)` search in `src/lib/handDraft.ts`; hands append to state as
they're dealt, so undo and the summary's "passed on" lines work unchanged.
Randomness: shuffle candidate card order and take the first valid
K-subset — the space is tiny (C(12,3)=220 subsets, memoized futures).
Honest tradeoff for the Explainer: hand composition now depends on
earlier picks, a mild information whiff — no worse than the current
hidden-card leak it replaces.

## Dutch Flower Auction — IMPLEMENTED

*Note: this section had no pre-existing sketch in this doc (checked the working
tree, `origin/main`, and every other branch) — it was authored from the build
brief's Rules/mechanics description below, then implemented to match, rather
than the usual "sketch first, implement later" flow the other sections follow.*

Now live as `src/modes/DutchAuctionMode.tsx` (`ModeId: "dutch"`), reducer and pure
helpers in `src/lib/dutch.ts` (reuses `nextLegalFaction` from `src/lib/bounty.ts`
for the reveal-deck gating). Settings hooks (`useDutchRange`, `useDutchTickSeconds`)
live in `src/lib/store.ts` alongside the raffle ticket count pattern.

A live, real-time twist on Bounty Draft: instead of a token economy, a price
clock does the pricing for you.

### Rules

1. Shuffle seats, random first player (cosmetic only — nobody picks in turn
   order here). App builds a face-down deck from owned factions (Second
   Vagabond excluded, as in Hand draft), same as Bounty.
2. One faction reveals on the block at a time. It sits frozen for ~2 seconds
   (CLAIM disabled) so the table can see what's up, then a price clock starts
   at −4 VP and ticks toward +4 VP on a fixed interval.
3. The first unassigned player to tap **CLAIM** takes the faction plus the VP
   showing on the clock at that instant, and leaves the auction. If nobody
   claims by the time the clock hits +4, it simply holds there — no
   auto-assignment, no penalty for waiting past the cap, since nothing further
   improves.
4. The next faction reveals for the remaining players, same freeze-then-clock
   cycle. Once only one player is left without a faction, there's no one left
   to race against: they're handed the final reveal automatically at +4 VP,
   no clock, no tap.

Termination is guaranteed exactly like Bounty's token economy, just without
tokens: every reveal either gets claimed (clock keeps running until it does,
capped at +4) or — for the very last seat — is resolved automatically. Legal
combinations are guaranteed by the same reveal-time filter Bounty uses.

### Why fair

Same self-pricing market as Bounty Draft, but continuous instead of turn-based:
the price is only ever exactly what the table collectively decided a faction
was worth by not having claimed it yet. A faction nobody wants keeps climbing
until someone decides +2, then +3 VP is worth it; a faction several players
want gets claimed while the price is still negative, because whoever moves
first locks in the best price available. Unlike Bounty's pass-token economy,
there's no scarce resource to manage (no tokens to run out of) — the only
scarce resource is reaction time, which is exactly the tension a live auction
is supposed to create.

### Why legal combinations

Identical mechanism to Bounty Draft: the reveal deck is filtered through
`nextLegalFaction` (`src/lib/bounty.ts`), which wraps `reachBlockReason`
(`src/lib/reach.ts`) — a faction only ever reaches the block if claimed-set + it
+ best remaining can still hit `effTarget`. The invariant holds after every
claim, so the final table always reaches the Law 5.2 total, and Vagabond/Knaves
exclusion (A.8.1) plus Second Vagabond gating come free from the same function.
The Adventurous 17+ checkbox works unchanged.

Caveat for the Explainer: starting VP from the clock is a house rule, not from
the Law — same precedent as Bounty's bounty VP and Wishlist's +1 VP suggestion.

### Implementation notes

The reducer (`dutchReducer` in `src/lib/dutch.ts`) is deliberately kept 100%
pure: no `setInterval`, no `Date.now()`, no `Math.random()` inside it. The
component owns real time —
one `useEffect` fires a timeout that dispatches `BEGIN_CLOCK` after the ~2s
preview freeze, another re-arms a `setTimeout` after every price change to
dispatch `TICK`, and it stops re-arming once the price reaches the cap (the
clock "holds"). `CLAIM` carries the price the button displayed at tap time as
part of the action payload, rather than trusting the reducer to recompute it —
this is what keeps a recorded action sequence deterministically replayable
regardless of exact timer timing, which `src/lib/dutch.test.ts` exercises
directly (fixed action scripts, no fake timers needed). The deck itself is
shuffled by the component and passed into `START` as data, so even seat/deck
randomization stays outside the reducer.

UI: `Explainer`, `SetupHero`, `NameInputs` for setup; `OrderList` shows table
status (claimed vs. still racing); a single `FactionCard` for the faction on
the block; a `.dutch-clock` price stamp + progress bar; a full-width
`.dutch-claim-btn` per still-unclaimed player (Section spec: "big full-width
CLAIM target") rather than a single shared button, since there's no reducer
concept of "whose turn" to gate a shared button on. Done screen reuses
`SummaryList`, `SetupChecklist`, `ReachStampLine`, `HirelingSetup`,
`VagabondCharacterSetup`, `KnaveCaptainSetup` exactly like Bounty. New
`ModeId: "dutch"`, `houseRule: true` in `ModeSelect`.

Tuning, both exposed in Settings (`src/modes/SettingsMode.tsx`) and persisted
per-device: price range ±2–±8 VP (default ±4, per the spec) via
`useDutchRange`; clock pace 0.5–5s per tick (default 1.5s) via
`useDutchTickSeconds`. The VP step size per tick (fixed at 1 VP) is not
exposed as a setting — two configurable dials felt like enough surface area,
and a variable step interacts awkwardly with "price at tap time" bookkeeping.

Deviation from a literal reading of the prompt: "first unassigned player to
tap CLAIM" is realized as one full-width button per remaining player (tap your
own name) rather than a single anonymous CLAIM button followed by a
who-was-that prompt — it's simpler, still satisfies "big full-width CLAIM
target," and avoids a two-step interaction that would otherwise need its own
undo semantics.

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

## Woodland Roulette

The app proposes; the table disposes. Full random lineups spun on the shared
screen, with a veto escape hatch so nobody is stuck with a faction the table
can't live with. Zero drafting, near-zero time — the lazy-table mode.

### Rules

1. Shuffle seats. The app spins a complete lineup: a random legal
   `playerCount`-subset of the owned pool (reach ≥ target, Vagabond/Knaves
   exclusion per A.8.1, Second Vagabond excluded), assigned to seats at
   random, shown all at once in the open.
2. The table looks at it. Any player may spend a veto to name ONE faction in
   the proposal — their own or anyone else's. The vetoed faction is exiled
   for the rest of the session, and the app spins a fresh lineup from the
   survivors (fresh subset, fresh seat assignment).
3. Veto budget is 1 token per player, tracked at the table on the honor
   system — the app deliberately does not track who spent what. Keeps the
   mode simple and keeps the "are you really burning your veto on that?"
   conversation where it belongs, between the players.
4. A veto is blocked (greyed, with a reason) if exiling that faction would
   leave no legal lineup for the player count — the mirror of Exile Draft's
   ban validation.
5. Nobody vetoes → the lineup locks. Seat 0 is first player, the standing
   convention. Vagabond in the lineup gets a random character card dealt at
   lock (A.8.2.III), Knaves get their Captain deal, same as other modes.

### Why fair

Symmetric randomness plus equal escape hatches. Nobody controls what they
get, only what nobody gets — a veto is a public, costly signal ("this
faction does not hit our table"), and since it kills the faction rather
than the seat, vetoing your own bad deal and vetoing a neighbor's nightmare
matchup are the same move. Versus Exile Draft (the other ban-then-roll
sketch): Exile bans *proactively* before any roll, with a fixed ban budget
and math about slack; Roulette vetoes *reactively* against concrete
proposals, needs no ban-count bookkeeping, and ends the moment the table is
content — often on spin one. Termination is guaranteed: every veto
permanently shrinks the pool, and rule 4 stops the shrinking at the last
legal lineup.

### Why legal combinations

Every spin is drawn from the enumerated legal subsets of the surviving pool
(same `combinations` enumeration the Trading Post deal uses — at most
C(13,6)=1716), so every proposal is legal by construction. The veto guard
checks that a legal subset still exists among survivors before allowing the
exile, so the invariant "at least one legal lineup remains" holds start to
finish. Militant presence isn't enforced, matching Wishlist/Trading Post
subset legality (reach + A.8.1 only). Fully Law-legal assignment under
5.1.1 ("assign one faction to each player in any way") with no scoring
changes — no house-rule tag.

### Implementation notes

Lightest mode in the whole app. `usePersistedReducer` machine
(`setup → spin → done`). Spin phase: one `FactionCard` per seat with the
player's name, a veto affordance per card (tap → confirm → respin), and a
running list of exiled factions. Reuses the legal-subset enumeration from
`src/lib/trade.ts` and `reachBlockReason` for the veto guard. `SummaryList`
+ `SetupChecklist` + `ReachStampLine` at the end. New `ModeId: "roulette"`.

Tuning / open questions:
- Veto budget "1 per player" is a suggestion printed in the Explainer, not
  enforced — tables that want a stricter or looser economy just agree on
  one.
- Optional toggle: guarantee ≥1 militant faction per spin (A.8.2 deals one
  militant to the pool by design; the lock-last-insurgent rule shows Law
  intent). Default off to match the other modes' legality basis.
- Respin animation: a brief card-shuffle flourish sells the roulette
  feeling; skippable.

## Secret Santa

You never choose your own faction — your neighbor chooses it for you, in
secret, kindly or cruelly. Potluck's "never your own" taken personal: the
gift is aimed at a specific player, so knowing their tastes (or their
dread) is the whole mechanic.

### Rules

1. Shuffle seats. Device passes around in seat order: each player secretly
   picks one gift faction for their LEFT neighbor (seat i gifts seat i+1,
   wrapping) from the full owned pool (Second Vagabond excluded). No
   gating during the gift phase — full secrecy means collisions are
   possible, and the reveal drama is the point.
2. Reveal all gifts at once. Then resolve in seat order: a gift is accepted
   if it's compatible with the gifts accepted so far — not a duplicate, no
   Vagabond/Knaves conflict, and the table can still reach the target
   (`reachBlockReason` against the accepted set). An incompatible gift
   fails, and its GIVER re-picks openly for their neighbor from the legal
   survivors.
3. All gifts resolved → summary, each line noting who gave what to whom.
   Seat 0 is first player, the standing convention.
4. Two players is a mutual exchange: you play what they chose for you, they
   play what you chose for them. Only possible conflict is both gifting the
   same faction (seat 0's gift stands, seat 1 re-gifts) — the Explainer
   notes it with a wink, like Potluck's forced swap.

### Why fair

Pure other-directed choice. Potluck already established "you'll never play
what you bring" as honest preference expression; Santa sharpens it from
"someone gets this" to "YOU get this", so the choice carries social weight
in both directions — a kind gift is a favor, a cruel one is a declaration,
and either way the giver sits next to the consequences all game. Nothing
here is a house rule: Law 5.1.1 allows any assignment, and seat-priority
conflict resolution follows the Law's own tiebreak spirit (1.1.3, the
active player decides unclear resolutions). Resolution order slightly
favors early seats' *receivers* (their gifts resolve first, so never fail),
but the advantage circulates — your good position benefits your neighbor,
not you — so it roughly washes out around the circle.

### Why legal combinations

Legality is enforced entirely at resolution, by induction: each accepted
gift is checked completable against the accepted set via `reachBlockReason`
(reach, A.8.1, Second Vagabond all come free), and each failed gift is
re-picked from options gated the same way, so after every resolution step
the partial table is still completable and the final table is legal. The
gift phase itself needs no gating — any single faction is part of some
legal lineup.

### Implementation notes

`usePersistedReducer` machine (`setup → gift → resolve → done`). Gift phase
is the pass-the-device pattern from Hand Draft/Wishlist (`PassDeviceGate` +
faction grid, banner naming the recipient: "Pick a faction for Anna").
Resolve phase replays gifts as `.reveal-log` lines (accepted / failed +
reason), pausing on a failure for the giver's open re-pick on a
Simple-mode-style gated grid. `SummaryList` + `SetupChecklist` +
`ReachStampLine` at the end. New `ModeId: "santa"`. No house-rule tag:
nothing touches scoring.

Tuning / open questions:
- Gift direction: left neighbor is v1 (simple, predictable resolution). A
  true Secret-Santa variant — random secret derangement of who gifts whom —
  adds a second layer of secrecy ("who saddled me with the Cult?") for one
  extra shuffle; worth a toggle later.
- Thank-you swap: let each receiver, once, publicly swap their gift for an
  unclaimed legal faction — softens cruelty at the cost of the premise.
  Skip for v1; revisit if cruel gifting sours real tables.

## Typecast

Casting-director assignment: your faction is decided by how the *table*
sees you, not how you see yourself. The 360-review of faction pickers —
Wishlist's optimizer with every preference arrow pointing outward.

### Rules

1. Shuffle seats. Device passes around in seat order: each player secretly
   nominates one faction **for every other player** ("cast Anna as…"), one
   grid page per castmate. You never nominate for yourself.
2. When all ballots are in, the app solves the assignment that maximizes
   total votes received, searching only legal lineups (reach ≥ target,
   Vagabond/Knaves exclusion, Second Vagabond excluded) — the same
   machinery as Wishlist, with the score being "how many castmates saw you
   this way" instead of "how high you ranked it yourself".
3. Reveal shows each player's faction with its vote count ("3 of 4 players
   cast you as the Marquise de Cat") — counts only, never who voted what.
   Ballots stay anonymous; the reveal-log replays any interesting
   runner-ups. Ties between equally-good assignments break randomly.
4. Seat 0 is first player, the standing convention.

### Why fair

Perfectly symmetric: everyone gets the same number of votes to cast (one
per castmate) and zero say in their own fate. It measures something no
other mode touches — reputation. Wishlist finds the assignment the players
want for themselves; Typecast finds the one the table believes in, which at
a group that knows each other is often funnier and more accurate. Anonymity
matters: public ballots would turn nominations into negotiation; secret
ones keep them honest. No scoring changes, no house rule — Law 5.1.1
assignment, nothing else.

### Why legal combinations

Identical legality basis to Wishlist: the solver only considers legal
`playerCount`-subsets and assignments (reach + A.8.1 + Second Vagabond),
so the winning cast is legal by construction. A faction nobody voted for
can still be assigned when legality demands it (vote total 0 for that
player — the reveal owns this: "the table couldn't agree, the Woodland
decided"). Militant presence isn't enforced, matching the Wishlist basis.

### Implementation notes

`usePersistedReducer` machine (`setup → ballot → done`). Ballot phase is
the pass-the-device pattern with one gated faction grid per castmate
(banner: "Cast Anna as…"), a small progress dots row for the N−1 pages.
Solver reuses Wishlist's legal-assignment search with a swapped score
function; ties randomized at submit in the component so the reducer stays
pure. Reveal reuses `.reveal-log`; `SummaryList` + `SetupChecklist` +
`ReachStampLine` at the end. New `ModeId: "typecast"`. No house-rule tag.

Tuning / open questions:
- One nomination per castmate is v1. Two per castmate (weighted 2/1) gives
  the solver more signal at bigger tables — worth it if 5–6 player casts
  feel too constrained by legality overrides.
- Reveal spice: show each player's full received-vote spread (all factions
  anyone cast them as), not just the winner. Costs a little layout, pays
  in table laughter.

## Dutch Flower Auction

Aalsmeer's descending clock: the price starts bad and gets better every
tick, and the first player to slam the button takes the faction at the
current number. Hesitation is the bid. The only mode with a real clock.

### Rules

1. Shuffle seats, random first player for the game itself. App builds the
   reveal deck from the owned pool with the same legality filter as Bounty
   (a faction is only revealed if claimed-set + it + best remaining can
   still hit the target).
2. One faction on screen at a time, with a price ticker: starts at −4 VP,
   ticks one step toward +4 VP every few seconds. Any unassigned player
   may tap CLAIM at any moment — first tap takes the faction at the price
   showing, and that player leaves the auction. Next faction revealed,
   clock resets.
3. The clock never assigns by itself: at +4 the ticker stops and holds
   until someone claims. (With multiple players left, +4 is free money —
   someone cracks immediately.)
4. Last remaining player auto-claims the final reveal at +4. That's not a
   gift, it's the honest equilibrium: a lone bidder with no competition
   waits out any clock, so the app skips the theater.
5. Final VP totals are normalized to a 0 floor (lowest becomes 0), Bounty
   precedent — only the gaps between players matter.

### Why fair

Self-pricing under time pressure. Bounty prices factions by circulating
passes; Dutch prices them in seconds — a strong faction gets snapped up
deep in the penalty range, a weak one rides the clock into bonus
territory. Your nerve is the only currency: claim early and pay for
certainty, or wait for value and risk the snipe. Everyone faces the same
clock with the same button. The physical scramble on one shared device is
a feature, not a bug — Halli Galli nerves, absent from every other mode.

### Why legal combinations

Reveal filter is Bounty's, verbatim: `reachBlockReason` gates entry to the
reveal deck so the invariant holds after every claim and the final table
reaches the Law 5.2 total, with Vagabond/Knaves and Second Vagabond
handled by the same function. The VP prices are a house rule (Bounty/
Auction precedent) — houseRule tag on.

### Implementation notes

`usePersistedReducer` machine (`setup → clock → done`). The reducer stays
pure: the component runs the interval timer and dispatches TICK events;
CLAIM carries the price at tap time, so a test can replay any sequence
deterministically. UI: one big `FactionCard` with an oversized price dial
and a full-width CLAIM button (this is a shared-screen slap target, size
accordingly). Reveal-log lines per claim ("Anna took the Eyrie at −2").
`SummaryList` + `SetupChecklist` + `ReachStampLine` at the end. New
`ModeId: "dutch"`. House-rule tag on.

Tuning / open questions:
- Price range −4…+4 and ~3s per tick are guesses; the full range should
  feel like ~25 tense seconds, not a minute of waiting. Both belong in
  Settings.
- A short frozen preview (2s, button disabled) before the clock starts
  prevents claim-by-accident on the reveal.
- Reflex fairness: a table with big reaction-time gaps can switch to
  tick-pause mode — the clock pauses each step for a beat, and claims
  during the pause tie-break randomly instead of by tap speed. Costs
  drama, buys accessibility; Settings toggle, default off.

## Mulligan

Draw poker's opening decision: keep your deal or ship it back — but the
replacement is blind and binding. One gamble per player, no rankings, no
trades. Probably the smallest implementable mode in this document.

### Rules

1. Shuffle seats. App deals a random legal lineup (reach ≥ target,
   Vagabond/Knaves exclusion, Second Vagabond excluded — the Trading Post
   deal, verbatim), one secret faction per player. Everything undealt sits
   in a face-down market.
2. Device passes around once in seat order: look at your faction, then
   **keep** it or **mulligan** — discard it and draw a blind replacement
   from the market, which you must keep sight unseen.
3. The replacement is drawn at random from the market cards that keep the
   table legal; your discarded faction goes back to the market, barred for
   you but available to a later mulliganer (yes, you can draw someone
   else's regret — the reveal loves this).
4. Mulligan is blocked (with a reason) in the rare state where no legal
   replacement exists; you keep your deal.
5. Reveal replays every decision ("Anna kept", "Bob shipped the Lizard
   Cult back… and drew the Corvids"). Seat 0 is first player, the standing
   convention.

### Why fair

One identical gamble each, and purely self-regarding: your mulligan never
touches anyone else's faction, so there is nothing to exploit and no
kingmaking surface at all. The honesty is in the blindness — Trading Post
lets you steer where you land, Mulligan only lets you reject where you
are, which is exactly the poker-table feeling: sometimes the second card
is worse, and the table gets to enjoy that. No scoring changes, no house
rule.

### Why legal combinations

The deal starts legal by construction (random legal subset). Each mulligan
is a single-slot swap gated so the resulting multiset is still legal —
induction per swap, same basis as everywhere else (reach + A.8.1 + Second
Vagabond via the standard guard). Rule 4 closes the no-legal-replacement
edge. Militant presence isn't enforced, matching the Trading Post basis.

### Implementation notes

`usePersistedReducer` machine (`setup → decide → done`). Decide phase is
one `PassDeviceGate` screen per player: their `FactionCard`, a KEEP and a
MULLIGAN button, replacement revealed immediately to them (they must know
what they'll play — it just can't be changed). Deal and replacement
randomness injected at START/decision time from the component, reducer
pure and testable. Reveal reuses `.reveal-log`; `SummaryList` +
`SetupChecklist` + `ReachStampLine` at the end. New `ModeId: "mulligan"`.
No house-rule tag.

Tuning / open questions:
- One mulligan is v1. A "double down" variant (second mulligan allowed,
  but you must keep the third card no matter what) steepens the gamble —
  Settings toggle later if the single decision feels thin.
- Whether a mulligan is announced to the table live ("Bob shipped one
  back!") or only in the reveal. Live is funnier; secret is cleaner
  poker. Default live.

## Omakase

Chef's choice: you don't order a faction, you tell the kitchen your mood
and trust the chef. The only mode that works for players who don't know
the factions at all — you can't rank what you've never played, but you
can always say what you're hungry for.

### Rules

1. Shuffle seats. Device passes around: each player secretly sets two or
   three appetite sliders for tonight — **aggression** (pick fights vs
   avoid them), **footprint** (build and spread vs lurk and poke), and
   **complexity** (easy evening vs give me homework).
2. The app scores every faction against every player's order using
   per-faction archetype ratings, and deals the best-fitting legal lineup
   (reach ≥ target, Vagabond/Knaves exclusion, Second Vagabond excluded) —
   Wishlist's solver with the score computed from sliders instead of
   hand-ranked lists.
3. Reveal serves each plate with a one-line justification ("you asked for
   aggressive and simple: Lord of the Hundreds"). When legality forced a
   compromise, the line owns it ("the kitchen was out of sneaky —
   tonight you build"). Seat 0 is first player, the standing convention.

### Why fair

Symmetric and expertise-free. Wishlist, Typecast, and every draft reward
knowing the roster; Omakase asks only self-knowledge, which every player
has on day one — it's Teaching Tiers' audience with preference instead of
prescription. Nobody competes for a specific faction, so there's nothing
to game except lying about your own mood, which only ruins your own
dinner. No scoring changes, no house rule.

### Why legal combinations

Identical basis to Wishlist/Typecast: the solver searches only legal
lineups, so the served table is legal by construction, and slider fit is
sacrificed before legality ever is. Militant presence isn't enforced,
matching that basis.

### Implementation notes

`usePersistedReducer` machine (`setup → order → done`). Order phase is the
pass-the-device pattern with two or three big sliders and plain-language
end labels — no faction names anywhere in the phase, that's the point.
Solver reuses Wishlist's legal-assignment search with a
slider-distance score. **Data cost, the only one in this document:** each
faction needs aggression and footprint ratings added to
`src/data/factions.ts` (complexity already exists as `difficulty`, used
by Teaching Tiers). One-time authoring, a judgment call worth a source
comment per rating. Reveal reuses `.reveal-log` for the justification
lines; `SummaryList` + `SetupChecklist` + `ReachStampLine` at the end.
New `ModeId: "omakase"`. No house-rule tag.

Tuning / open questions:
- Two sliders or three: aggression + complexity may be enough signal;
  footprint earns its place only if the ratings genuinely spread the
  roster. Decide when authoring the data.
- Justification lines want hand-written fragments per rating band, not
  generated prose — small static table, big flavor payoff.
- "Chef's surprise" toggle: one volunteer skips the sliders entirely and
  takes whatever balances the meal. Pure flavor, nearly free.
