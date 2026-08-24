#!/usr/bin/env python3
"""
BuilderOS patch v14 — BuilderFlow, BuilderRep, BuilderPay metering,
mainnet capability, and the console header redesign.

Run from your project root:  python3 patch14/apply.py
"""
import pathlib, shutil, sys, re

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

# ── 1. Copy files ────────────────────────────────────────────────────────
for base, dest in ((HERE / "api", API), (HERE / "console", CONSOLE)):
    for src in base.rglob("*"):
        if src.is_file() and src.suffix in (".ts", ".tsx", ".sql", ".prisma"):
            target = dest / src.relative_to(base)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(src, target)
            applied.append(f"{dest.name}: {src.relative_to(base)}")

# ── 2. Prisma models ─────────────────────────────────────────────────────
schema = API / "prisma/schema.prisma"
if schema.exists():
    t = schema.read_text(encoding="utf-8")
    if "model TrackedApplication" in t:
        skipped.append("api: agent models")
    else:
        addition = (HERE / "api/prisma/SCHEMA_ADDITIONS.prisma").read_text(encoding="utf-8")
        body = addition.split("// Appended automatically by patch14/apply.py. Reference copy.")[-1]
        schema.write_text(t.rstrip() + "\n" + body, encoding="utf-8")
        applied.append("api: TrackedApplication / ProofRecord / UsageRecord models")

# ── 3. Register modules ──────────────────────────────────────────────────
edit(API / "src/app.module.ts",
  "import { ProofForgeModule } from './proofforge/proofforge.module';",
  "import { ProofForgeModule } from './proofforge/proofforge.module';\n"
  "import { FlowModule } from './flow/flow.module';\n"
  "import { RepModule } from './rep/rep.module';",
  "api: import FlowModule + RepModule")
edit(API / "src/app.module.ts",
  "    ProofForgeModule,\n  ],",
  "    ProofForgeModule,\n    FlowModule,\n    RepModule,\n  ],",
  "api: register FlowModule + RepModule")

# ── 4. Meter ProofForge calls ────────────────────────────────────────────
edit(API / "src/proofforge/proofforge.controller.ts",
  "import { ScoringService, type DraftSections } from './scoring.service';",
  "import { ScoringService, type DraftSections } from './scoring.service';\n"
  "import { UsageService } from '../billing/usage.service';\n"
  "import { CurrentUser } from '../common/decorators/current-user.decorator';\n"
  "import type { JwtPayload } from '../auth/auth.types';",
  "api: proofforge imports usage metering")
edit(API / "src/proofforge/proofforge.controller.ts",
  "  constructor(private readonly scoring: ScoringService) {}",
  "  constructor(\n    private readonly scoring: ScoringService,\n    private readonly usage: UsageService,\n  ) {}",
  "api: inject UsageService")
edit(API / "src/proofforge/proofforge.controller.ts",
  "  score(@Body() body: ScoreRequest) {\n    return this.scoring.score(body.draft ?? {}, body.opportunityTitle);\n  }",
  "  async score(\n    @CurrentUser() user: JwtPayload,\n    @Body() body: ScoreRequest,\n  ) {\n"
  "    // Recorded whether or not metering is switched on, so usage data\n"
  "    // exists before billing does.\n"
  "    await this.usage.record(user.builderProfileId, 'forge', 'score');\n"
  "    return this.scoring.score(body.draft ?? {}, body.opportunityTitle);\n  }",
  "api: meter ProofForge scoring")
edit(API / "src/proofforge/proofforge.module.ts",
  "import { ScoringService } from './scoring.service';",
  "import { ScoringService } from './scoring.service';\nimport { UsageService } from '../billing/usage.service';",
  "api: proofforge module imports UsageService")
edit(API / "src/proofforge/proofforge.module.ts",
  "  providers: [ScoringService],",
  "  providers: [ScoringService, UsageService],",
  "api: provide UsageService to ProofForge")

# ── 5. Agents become launchable ──────────────────────────────────────────
data = CONSOLE / "components/agent-rack-data.ts"
for key, tier_old, launch in [
    ("flow", '"development"', ('"/console/track"', '"Open application tracker"', '"LIVE · TRACKS YOUR DEADLINES"')),
    ("rep", '"development"', ('"/console/proof"', '"Open proof record"', '"LIVE · EXPORTABLE RECORD"')),
]:
    if data.exists():
        t = data.read_text(encoding="utf-8")
        # Narrow to this agent's object literal before editing.
        start = t.find(f'key: "{key}"')
        if start == -1:
            missing.append(f"console: agent '{key}' not found"); continue
        end = t.find("  {\n    key:", start + 10)
        block = t[start:end if end != -1 else len(t)]
        if "launchPath" in block:
            skipped.append(f"console: {key} launch path"); continue
        new_block = block.replace(f"tier: {tier_old},", 'tier: "operational",', 1)
        new_block = re.sub(
            r"    unavailableReason:\n?\s*\"[^\"]*\",\n",
            f"    launchPath: {launch[0]},\n    launchLabel: {launch[1]},\n    launchHint: {launch[2]},\n",
            new_block,
            count=1,
        )
        t = t[:start] + new_block + (t[end:] if end != -1 else "")
        data.write_text(t, encoding="utf-8")
        applied.append(f"console: {key} is operational and launchable")

# ── 6. Nav tabs + scrollbar fix ──────────────────────────────────────────
edit(CONSOLE / "components/ConsoleNav.tsx",
  '  { href: "/console/apply", label: "APPLY" },',
  '  { href: "/console/apply", label: "APPLY" },\n'
  '  { href: "/console/track", label: "TRACK" },\n'
  '  { href: "/console/proof", label: "PROOF" },',
  "console: TRACK + PROOF nav tabs")

# The visible scrollbar in the header came from overflow-x-auto on the nav.
# scrollbar-none keeps horizontal scrolling on small screens without the
# rendered bar sitting inside the chrome.
edit(CONSOLE / "components/ConsoleNav.tsx",
  '<nav aria-label="Console sections" className="flex gap-1 overflow-x-auto">',
  '<nav\n        aria-label="Console sections"\n        className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"\n      >',
  "console: hide the nav scrollbar artifact")

print("\n\033[1mBuilderOS patch v14\033[0m\n")
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
  cd apps/api
  npx prisma migrate dev --name agents
  npx tsc --noEmit && npm run start:dev

  cd ../console && npx tsc --noEmit && npm run dev -- --port 3001

MAINNET — read patch14/MAINNET.md before switching. Short version:
  GOAT_NETWORK=mainnet   switches reads only; safe and free
  Registering agents on mainnet is separate, permanent, and costs real BTC
""")
sys.exit(1 if missing else 0)
