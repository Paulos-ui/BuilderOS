# BuilderOS — Design & Motion System

## Position: resonate with GOAT, don't imitate it

Matching GOAT Network's palette would be a mistake. If every ecosystem
project apes the L2's brand we read as a subsidiary rather than a company,
and we're stranded the moment GOAT rebrands.

The deeper match is available: **match the physics of the chain, not its
colours.**

## The Settlement primitive

GOAT's defining technical property is **two-speed finality** — the sequencer
confirms fast and provisionally; Bitcoin finalises slowly and irreversibly.
That is already a motion system, so we made it one.

Every value that becomes permanent moves through two phases with genuinely
different physics:

| Phase | Physics | Colour | Reads as |
|---|---|---|---|
| `sequenced` | fast light spring + continuous sub-pixel drift | cyan `--color-line-bright` | real, usable, *could still change* |
| `final` | heavy damped spring (mass 1.7), long settle, **drift stops** | brass `--color-brass-bright` | anchored, irreversible |

**The stillness is the point.** Finality isn't signalled by adding a badge —
it's signalled by the *removal* of motion. That reads correctly even to
someone who has never heard of BitVM: things that are settled stop moving.

The seal ring expands exactly once, at the moment of finality, then never
again.

### Colour now carries meaning

Before, brass was just an accent. Now:

- **cyan** = provisional, sequencer-confirmed L2 state
- **brass** = Bitcoin-final, irreversible
- **sage** = verified / attested

Brass was already Bitcoin-adjacent gold, so the semantics fit the palette
rather than fighting it.

No Ethereum L2 project can borrow this language, because they have no
distinct Bitcoin-finality phase to encode. That is the deepest ecosystem
match available to us.

Implementation: `components/Settlement.tsx`.

## The wider motion family

The landing page is **design-time** (a blueprint being drafted). The console
is **run-time** (an instrument rack reading live state). Same tokens, same
type, different behaviour.

| Component | Motion | Why it earns its place |
|---|---|---|
| `Odometer` | digits roll vertically, leftmost settling first | values read off a chain should *count*, not fade |
| `AgentSigil` | each mark animates only while its rack row is open | the artwork is an instrument responding to you, not decoration |
| `Settlement` | two-phase, drift then stillness | encodes GOAT's finality model |

`Settlement` is used on the settlement ledger, where an x402 order maps onto
the two phases exactly: a `VERIFIED` order holds a valid EIP-3009
authorization that has not been broadcast — real, usable, and still capable of
never landing — which is what `sequenced` means. `SETTLED` is irreversible, so
the drift stops.

### Removed from this table

`ScanSweep` and `PatchPulse` were described here for months and never existed
in the codebase. `RackModule` and `SignalMeter` did exist, but the rack rebuild
left them with no callers — `SignalMeter` in particular has nothing honest to
render now that fabricated reputation figures are gone and the ERC-8004
Reputation Registry read is not wired up. All four are deleted rather than
documented.

A design document that lists components which do not exist is worse than one
that lists fewer, because the next person budgets against it.

## On the `ui-ux-pro-max` skill

We ran the generator (`uipro init`, then its design-system command) against
this project. Findings:

**Adopted** — the pre-delivery checklist, and its "Real-Time / Operations
Landing" pattern, which independently validated the console direction.

**Rejected** — its typography recommendation (Orbitron/Exo 2) and palette
(`#1E293B` + `#22C55E`, "code dark + run green"). Orbitron is the stereotype
crypto font and slate-800 + green-500 is the most default dev-tool palette
that exists. For the `web3/crypto` category the tool steers directly into
the generic aesthetic we're explicitly avoiding. Useful as a validator, not
as a source.

### Checklist fixes it caught

Running its checklist against our code found three real bugs:

1. **`cursor-pointer` missing on rack modules.** Tailwind v4's preflight sets
   `cursor: default` on `<button>`, so clickable modules showed no pointer.
   Genuinely broken, not cosmetic.
2. **No visible focus ring.** We had focus *handlers* but nothing rendered,
   so keyboard nav was invisible. Added `focus-visible:outline`.
3. **Text glyph used as an icon.** The `▾` chevron is now a real SVG.

## Accessibility

- `prefers-reduced-motion` collapses all durations globally (`app/globals.css`),
  including the sigil keyframes
- Interactive modules are real `<button>`s with `aria-expanded` and labels
- Rack rows own their expanded region via `aria-controls`, so the disclosure is
  announced rather than merely animated
- Unregistered agents show `NO SIGNAL`, never `0.0` — a zero would claim we
  measured and found nothing, which is false and worse
- Sigils are `aria-hidden` unless given a `title`; the row's own text already
  names the agent, so an unlabelled mark would be read out twice
- Decorative motion (drift, seal ring, score bars) is `aria-hidden`, and the
  match score carries a text alternative giving the reading
