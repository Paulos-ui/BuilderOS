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
| `SignalMeter` | segmented VU fill with overshoot | reputation is a reading, not a progress bar |
| `RackModule` | boot sequence, LED flicker then settle | the rack powers on |
| `ScanSweep` | slow low-contrast refresh line | instrument re-reading inputs; peripheral by design |
| `PatchPulse` | pulse travels Scout → Forge connector | makes the handoff dependency legible |
| `Settlement` | two-phase, drift then stillness | encodes GOAT's finality model |

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

- `prefers-reduced-motion` collapses all durations globally (`app/globals.css`)
- Interactive modules are real `<button>`s with `aria-expanded` and labels
- The signal meter carries a text alternative describing the reading
- Unregistered agents show `NO SIGNAL`, never `0.0` — a zero would claim we
  measured and found nothing, which is false and worse
- Decorative motion (`ScanSweep`, `PatchPulse`, seal ring) is `aria-hidden`
