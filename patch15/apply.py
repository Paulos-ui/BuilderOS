#!/usr/bin/env python3
"""
BuilderOS patch v15 — the coordination layer.

Until now each agent worked but none handed off, which made the product four
tools sharing a login. This adds the three transitions that make it one
workflow:

  Scout -> Flow    "Track this" on the opportunity feed
  Flow  -> Forge   "Review" opens ProofForge with the application's context
  Flow  -> Rep     marking an application WON creates a proof record

Plus a pipeline strip on the console home showing your own state rather than
a catalogue of agents.

Run from your project root:  python3 patch15/apply.py
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

# ── Register the handoff controller ──────────────────────────────────────
edit(API / "src/flow/flow.module.ts",
  "import { FlowService } from './flow.service';",
  "import { FlowService } from './flow.service';\n"
  "import { HandoffController } from './handoff.controller';\n"
  "import { HandoffService } from './handoff.service';",
  "api: import handoff")
edit(API / "src/flow/flow.module.ts",
  "  controllers: [FlowController],\n  providers: [FlowService],\n  exports: [FlowService],",
  "  controllers: [FlowController, HandoffController],\n"
  "  providers: [FlowService, HandoffService],\n"
  "  exports: [FlowService, HandoffService],",
  "api: register HandoffController")

# ── Scout -> Flow: "Track this" on the feed ──────────────────────────────
feed = CONSOLE / "components/OpportunityFeed.tsx"
edit(feed,
  'import { api, ApiError } from "@/lib/api";',
  'import { api, ApiError } from "@/lib/api";\nimport TrackButton from "./TrackButton";',
  "console: feed imports TrackButton")
edit(feed,
  '''                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm bg-brass px-4 py-2 font-mono text-xs tracking-wide text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                >
                  View listing ↗
                </a>''',
  '''                <TrackButton opportunityId={item.id} />
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm border border-line/40 px-4 py-2 font-mono text-xs tracking-wide text-paper-dim transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                >
                  View listing ↗
                </a>''',
  "console: Track this on the feed")

# ── Pipeline strip on the console home ───────────────────────────────────
rack = CONSOLE / "components/AgentRack.tsx"
edit(rack,
  'import PageHeader from "./PageHeader";',
  'import PageHeader from "./PageHeader";\nimport PipelineStrip from "./PipelineStrip";',
  "console: rack imports PipelineStrip")
edit(rack,
  '      <header>\n        <dl className="mt-6 grid grid-cols-3 gap-4 border-b border-line/15 pb-4">',
  '      <PipelineStrip />\n\n      <header>\n        <dl className="mt-6 grid grid-cols-3 gap-4 border-b border-line/15 pb-4">',
  "console: pipeline strip above the rack")

print("\n\033[1mBuilderOS patch v15 — coordination layer\033[0m\n")
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
  cd ../console && npx tsc --noEmit && npm run dev -- --port 3001

TRY THE LOOP
  1. Opportunities -> "Track this" on any listing
  2. Track -> it is there, with the deadline and checklist already filled in
  3. Mark it WON -> a proof record appears under Proof
  4. Console home -> the pipeline strip shows your state
""")
sys.exit(1 if missing else 0)
