#!/usr/bin/env python3
"""
BuilderOS patch v13 — ProofForge, and a shared console page header.

ProofForge now runs: a builder writes a draft, gets a weighted score per
section, and sees the specific gaps a reviewer would penalise. Works with no
LLM key (deterministic rubric); adds qualitative review when
ANTHROPIC_API_KEY is set.

Run from your project root:  python3 patch13/apply.py
"""
import pathlib, shutil, sys

ROOT = pathlib.Path(".").resolve()
API = ROOT / "apps/api"
CONSOLE = ROOT / "apps/console"
HERE = pathlib.Path(__file__).parent

applied, skipped, missing = [], [], []

def edit(path, old, new, label):
    if not path.exists():
        missing.append(f"{label} — not found: {path}"); return
    t = path.read_text(encoding="utf-8")
    if new in t: skipped.append(label); return
    if old not in t:
        missing.append(f"{label} — target not found in {path.name}"); return
    path.write_text(t.replace(old, new, 1), encoding="utf-8")
    applied.append(label)

for d in (API, CONSOLE):
    if not d.exists():
        print(f"✗ Missing {d}. Run from your project root."); sys.exit(1)

for base, dest in ((HERE / "api", API), (HERE / "console", CONSOLE)):
    for src in base.rglob("*.ts*"):
        target = dest / src.relative_to(base)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, target)
        applied.append(f"{dest.name}: {src.relative_to(base)}")

# Register the module
edit(API / "src/app.module.ts",
  "import { OpportunitiesModule } from './opportunities/opportunities.module';",
  "import { OpportunitiesModule } from './opportunities/opportunities.module';\nimport { ProofForgeModule } from './proofforge/proofforge.module';",
  "api: import ProofForgeModule")
edit(API / "src/app.module.ts",
  "    OpportunitiesModule,\n  ],",
  "    OpportunitiesModule,\n    ProofForgeModule,\n  ],",
  "api: register ProofForgeModule")

# ProofForge becomes launchable from the rack
edit(CONSOLE / "components/agent-rack-data.ts",
  '''    capability: "On-chain identity live; scoring endpoint in build.",
    tier: "registered",''',
  '''    capability: "Live review. Scores your draft against reviewer criteria.",
    tier: "operational",''',
  "console: ProofForge is operational")
edit(CONSOLE / "components/agent-rack-data.ts",
  '''    unavailableReason:
      "ProofForge is registered on-chain as agent #342, but its scoring endpoint is still being built. It is next in the queue.",''',
  '''    launchPath: "/console/apply",
    launchLabel: "Review an application",
    launchHint: "LIVE · AGENT #342 ON GOAT TESTNET3",''',
  "console: ProofForge launch path")

# Nav entry
edit(CONSOLE / "components/ConsoleNav.tsx",
  '  { href: "/console/opportunities", label: "OPPORTUNITIES" },',
  '  { href: "/console/opportunities", label: "OPPORTUNITIES" },\n  { href: "/console/apply", label: "APPLY" },',
  "console: APPLY nav tab")

# Adopt the shared header on the rack and the feed
edit(CONSOLE / "components/AgentRack.tsx",
  'import ChainStatus from "./ChainStatus";',
  'import ChainStatus from "./ChainStatus";\nimport PageHeader from "./PageHeader";',
  "console: rack imports PageHeader")
edit(CONSOLE / "components/AgentRack.tsx",
  '''      <header>
        <p className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
          AGENT SYSTEM
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-paper">
          Agent rack
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-dim">
          Six specialised agents, each with a defined responsibility and a
          place in the workflow. Identity and reputation are read from the
          ERC-8004 registries on GOAT Network.
        </p>

        <ChainStatus state={state} blockNumber={blockNumber} />

        <dl className="mt-6 grid grid-cols-3 gap-4 border-y border-line/15 py-4">''',
  '''      <PageHeader
        eyebrow="AGENT SYSTEM"
        title="Agent rack"
        description="Six specialised agents, each with a defined responsibility and a place in the workflow. Identity and reputation are read from the ERC-8004 registries on GOAT Network."
        status={<ChainStatus state={state} blockNumber={blockNumber} />}
      />

      <header>
        <dl className="mt-6 grid grid-cols-3 gap-4 border-b border-line/15 pb-4">''',
  "console: rack uses PageHeader")

print("\n\033[1mBuilderOS patch v13 — ProofForge\033[0m\n")
if applied:
    print(f"\033[32m✓ applied ({len(applied)})\033[0m")
    for a in applied: print(f"    {a}")
if skipped:
    print(f"\n\033[33m• already applied ({len(skipped)})\033[0m")
    for s in skipped: print(f"    {s}")
if missing:
    print(f"\n\033[31m✗ needs attention ({len(missing)})\033[0m")
    for m in missing: print(f"    {m}")

print("""
NEXT
  cd apps/api && npx tsc --noEmit && npm run start:dev
  cd apps/console && npx tsc --noEmit && npm run dev -- --port 3001

  Agent rack -> ProofForge -> "Review an application"

  OPTIONAL — qualitative review on top of the rubric:
    add ANTHROPIC_API_KEY to apps/api/.env (and Render)
    without it, scoring is deterministic and structural, which is still useful
""")
sys.exit(1 if missing else 0)
