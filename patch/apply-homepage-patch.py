#!/usr/bin/env python3
"""
Applies the homepage adjustments to an existing BuilderOS landing page.

Safe to re-run: every edit checks whether it has already been applied, and
reports what it did. If a target string is missing (because you edited that
file yourself), it says so loudly rather than silently doing nothing.
"""
import pathlib
import sys

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "apps/landing")

applied, skipped, missing = [], [], []


def edit(relpath: str, old: str, new: str, label: str) -> None:
    path = ROOT / relpath
    if not path.exists():
        missing.append(f"{label} — file not found: {path}")
        return
    text = path.read_text(encoding="utf-8")
    if new in text:
        skipped.append(f"{label} (already applied)")
        return
    if old not in text:
        missing.append(f"{label} — target text not found in {relpath}")
        return
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    applied.append(label)


# ─────────────────────────────────────────────────────────────────────────
# 1. Hero — accessibility, copy, navbar clearance, micro-label
# ─────────────────────────────────────────────────────────────────────────

edit(
    "components/Hero.tsx",
    '''    <span className={`inline-block ${className}`} aria-label={text}>
      {text.split("").map((ch, i) => (''',
    '''    <span className={`inline-block ${className}`}>
      {/* One clean text node for assistive tech; the animated per-letter
          spans below are decorative and would otherwise be read out one
          letter at a time. */}
      <span className="sr-only">{text}</span>
      {text.split("").map((ch, i) => (''',
    "Hero: stop screen readers spelling the headline letter-by-letter",
)

edit(
    "components/Hero.tsx",
    '''            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {ch === " " ? "\\u00A0" : ch}''',
    '''            ease: [0.16, 1, 0.3, 1],
          }}
          aria-hidden="true"
        >
          {ch === " " ? "\\u00A0" : ch}''',
    "Hero: hide decorative letter spans from assistive tech",
)

edit(
    "components/Hero.tsx",
    '<div className="sticky top-0 flex h-screen w-full flex-col items-center justify-center px-6">',
    '<div className="sticky top-0 flex h-screen w-full flex-col items-center justify-center px-6 pt-14 md:pt-16">',
    "Hero: clear the fixed navbar",
)

edit(
    "components/Hero.tsx",
    'className="group relative overflow-hidden rounded-sm bg-brass px-7 py-3 font-mono text-sm tracking-wide text-ink transition-colors hover:bg-brass-bright"',
    'className="group relative overflow-hidden rounded-sm bg-brass px-7 py-3 font-mono text-sm tracking-wide text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"',
    "Hero: focus ring on primary CTA",
)

edit(
    "components/Hero.tsx",
    '''            <a
              href="#constellation"
              className="font-mono text-sm tracking-wide text-line-bright underline decoration-line/50 underline-offset-4 hover:text-paper"
            >
              See the agent system ↓
            </a>
          </motion.div>''',
    '''            <a
              href="#constellation"
              className="rounded-sm font-mono text-sm tracking-wide text-line-bright underline decoration-line/50 underline-offset-4 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
            >
              See the agent system ↓
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.95, duration: 0.6 }}
            className="mt-5 font-mono text-[10px] tracking-[0.2em] text-paper-dim/60"
          >
            PRIVATE BETA / EARLY ACCESS
          </motion.p>''',
    "Hero: PRIVATE BETA micro-label + secondary link focus ring",
)

edit(
    "components/Hero.tsx",
    """            BuilderOS is a coordinated system of AI agents that discovers your
            next grant, hackathon, or bounty — then helps you win it, and
            turns the work into reputation you actually own.""",
    """            BuilderOS is a coordinated system of agents that discovers your
            next grant, hackathon or bounty, helps you build a competitive
            submission, and turns completed work into reputation you own.""",
    "Hero: supporting copy",
)

# ─────────────────────────────────────────────────────────────────────────
# 2. Outlined headline contrast
# ─────────────────────────────────────────────────────────────────────────

edit(
    "app/globals.css",
    """.text-stroke-line {
  -webkit-text-stroke: 1px var(--color-line);
  color: transparent;
}""",
    """/* Wireframe headline treatment. The stroke uses the *bright* line token and
   carries a faint fill — a pure transparent fill on a near-black background
   left the word illegible at small sizes and on low-brightness displays. */
.text-stroke-line {
  -webkit-text-stroke: 1.25px var(--color-line-bright);
  color: color-mix(in srgb, var(--color-line-bright) 12%, transparent);
}

@media (max-width: 640px) {
  /* Sub-pixel strokes break down at small type sizes, so mobile gets a
     solid fill instead of an unreadable outline. */
  .text-stroke-line {
    -webkit-text-stroke: 0;
    color: var(--color-line-bright);
  }
}""",
    "CSS: make the outlined headline readable",
)

# ─────────────────────────────────────────────────────────────────────────
# 3. Wire new components into the page + skip link
# ─────────────────────────────────────────────────────────────────────────

edit(
    "app/page.tsx",
    'import BlueprintField from "@/components/BlueprintField";',
    'import BlueprintField from "@/components/BlueprintField";\nimport SiteNav from "@/components/SiteNav";\nimport TechnicalEdges from "@/components/TechnicalEdges";',
    "page.tsx: import SiteNav + TechnicalEdges",
)

edit(
    "app/page.tsx",
    "      <BlueprintField />\n      <ScrollHUD />",
    "      <BlueprintField />\n      <TechnicalEdges />\n      <SiteNav />\n      <ScrollHUD />",
    "page.tsx: render nav and technical edges",
)

edit(
    "app/layout.tsx",
    "<SmoothScrollProvider>{children}</SmoothScrollProvider>",
    '''<a
          href="#hero"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-sm focus:bg-brass focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:text-ink"
        >
          Skip to content
        </a>
        <SmoothScrollProvider>{children}</SmoothScrollProvider>''',
    "layout.tsx: skip-to-content link",
)

# ─────────────────────────────────────────────────────────────────────────
# 4. Honesty pass — remove claims the product does not yet support
# ─────────────────────────────────────────────────────────────────────────

edit(
    "data/agents.ts",
    "ranks opportunities against your on-chain and off-chain builder profile — so the right ones surface before the deadline crowd finds them.",
    "ranks them against a builder profile assembled from your repositories, past submissions and stated focus — so the right ones surface before the deadline crowd finds them.",
    "copy: BuilderScout — drop unsupported on-chain profile claim",
)

edit(
    "data/agents.ts",
    '"Converts shipped work, completed grants, and verified contributions into a portable, on-chain reputation record — attestations you own, not a platform score that disappears if you leave.",',
    '"Turns completed submissions and verified contributions into a structured, portable record of proof-of-work — designed to be carried across ecosystems rather than locked to one platform. Anchoring this record on GOAT Network is planned, not yet shipped.",',
    "copy: BuilderRep — mark on-chain anchoring as planned",
)

edit(
    "data/agents.ts",
    '"Handles grant disbursement, bounty payouts, and micro-payments between builders using x402-native settlement on GOAT Network — so funding moves as fast as the work does.",',
    '"Planned: settlement for grant disbursement and bounty payouts over x402 on GOAT Network, so funding can move at the speed of the work.",',
    "copy: BuilderPay — mark as planned",
)

edit(
    "data/agents.ts",
    'detail: "Shipped work becomes a portable, verifiable on-chain record.",',
    'detail: "Completed work becomes a structured, portable record of proof.",',
    "copy: pipeline step — drop on-chain claim",
)

edit(
    "components/AboutDocs.tsx",
    '"BuilderScout ranks opportunities against that profile. ProofForge scores and drafts your application. BuilderFlow tracks the logistics. BuilderRep and BuilderPay settle the outcome on-chain via GOAT Network. Each agent hands off structured state to the next — no copy-pasting between five tabs.",',
    '"BuilderScout ranks opportunities against that profile. ProofForge scores and drafts your submission. BuilderFlow tracks the logistics. BuilderRep records the outcome as structured proof. Each agent hands off structured state to the next — no copy-pasting between five tabs.",',
    "copy: docs — how it works",
)

edit(
    "components/AboutDocs.tsx",
    '"On-chain attestations for completed grants, settled via x402 on GOAT Network.",',
    '"A proof-of-work record for completed grants, built to stay portable across ecosystems.",',
    "copy: docs — MVP feature list no longer claims shipped on-chain attestations",
)

edit(
    "components/ReputationSection.tsx",
    '''    k: "Chain",
    v: "GOAT Network",
    d: "L2 execution environment purpose-built for agentic, machine-speed transactions.",''',
    '''    k: "Chain",
    v: "GOAT Network",
    d: "Bitcoin-secured execution with EVM-equivalent tooling. BuilderOS agents are registered against its ERC-8004 identity registry.",''',
    "copy: reputation — accurate GOAT description",
)

edit(
    "components/ReputationSection.tsx",
    '''    k: "Settlement",
    v: "x402 payments",
    d: "HTTP-native micropayments — agents and builders settle bounties and grants without invoicing overhead.",''',
    '''    k: "Settlement",
    v: "x402 payments",
    d: "Planned: HTTP-native micropayments so agents and builders can settle bounties without invoicing overhead.",''',
    "copy: reputation — mark x402 settlement as planned",
)

edit(
    "components/ReputationSection.tsx",
    '''    k: "Record",
    v: "Verifiable credentials",
    d: "Every completed grant, shipped repo, and passed review becomes a signed, portable attestation.",''',
    '''    k: "Record",
    v: "Portable proof-of-work",
    d: "Every completed grant, shipped repo and passed review becomes a structured record you can carry between ecosystems.",''',
    "copy: reputation — portable proof-of-work",
)

edit(
    "components/ReputationSection.tsx",
    """              BuilderRep and BuilderPay settle on GOAT Network. Completed
              grants, reviewed contributions, and paid bounties don&apos;t
              just close a ticket — they become part of a reputation ledger
              that follows you across every program you apply to next.""",
    """              Completed grants, reviewed contributions and shipped work
              don&apos;t just close a ticket — BuilderOS records them as
              structured proof you can carry into the next program you apply
              to. Anchoring that record on GOAT Network is on the roadmap.""",
    "copy: reputation — body paragraph",
)

edit(
    "components/ReputationSection.tsx",
    "              04 · ON-CHAIN REPUTATION",
    "              04 · REPUTATION &amp; OWNERSHIP",
    "copy: reputation — section label",
)

edit(
    "components/ReputationSection.tsx",
    "              Your work, minted into proof you own.",
    "              Your work should build your reputation.",
    "copy: reputation — heading",
)

# ─────────────────────────────────────────────────────────────────────────

print("\n\033[1mBuilderOS homepage patch\033[0m")
print(f"target: {ROOT.resolve()}\n")

if applied:
    print(f"\033[32m✓ applied ({len(applied)})\033[0m")
    for a in applied:
        print(f"    {a}")
if skipped:
    print(f"\n\033[33m• already applied ({len(skipped)})\033[0m")
    for s in skipped:
        print(f"    {s}")
if missing:
    print(f"\n\033[31m✗ needs manual attention ({len(missing)})\033[0m")
    for m in missing:
        print(f"    {m}")
    print("\n  These files differ from the version this patch expects —")
    print("  most likely because you edited them. Nothing was changed in them.")

print()
sys.exit(1 if missing else 0)
