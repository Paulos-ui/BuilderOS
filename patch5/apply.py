#!/usr/bin/env python3
"""
BuilderOS patch v5 — live on-chain agent data.

Adds GET /v1/agents to the API, which reads identity and reputation live from
the ERC-8004 registries on GOAT testnet3, and wires the console to consume it
with an honest fallback when the chain or API is unreachable.

Run from your project root:  python3 patch5/apply.py
"""
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(".").resolve()
API = ROOT / "apps/api"
CONSOLE = ROOT / "apps/console"
HERE = pathlib.Path(__file__).parent

applied, skipped, missing = [], [], []


def edit(path, old, new, label):
    if not path.exists():
        missing.append(f"{label} — not found: {path}")
        return
    t = path.read_text(encoding="utf-8")
    if new in t:
        skipped.append(label)
        return
    if old not in t:
        missing.append(f"{label} — target not found in {path.name}")
        return
    path.write_text(t.replace(old, new, 1), encoding="utf-8")
    applied.append(label)


if not API.exists() or not CONSOLE.exists():
    print("✗ Run from your builderos project root (the folder with apps/).")
    sys.exit(1)

# 1. Copy files
for src in (HERE / "api").rglob("*.ts"):
    dst = API / src.relative_to(HERE / "api")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, dst)
    applied.append(f"api: {src.relative_to(HERE / 'api')}")

for src in (HERE / "console").rglob("*.ts*"):
    dst = CONSOLE / src.relative_to(HERE / "console")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, dst)
    applied.append(f"console: {src.relative_to(HERE / 'console')}")

# 2. Register the module
edit(
    API / "src/app.module.ts",
    "import { WaitlistModule } from './waitlist/waitlist.module';",
    "import { WaitlistModule } from './waitlist/waitlist.module';\nimport { AgentsModule } from './agents/agents.module';",
    "api: import AgentsModule",
)
edit(
    API / "src/app.module.ts",
    "    WaitlistModule,\n  ],",
    "    WaitlistModule,\n    AgentsModule,\n  ],",
    "api: register AgentsModule",
)

# 3. Console page reads live data.
#    We bind the hook result to the same identifier the page already uses, so
#    every downstream reference keeps working and the diff stays one line.
page = CONSOLE / "app/console/page.tsx"
if page.exists():
    t = page.read_text(encoding="utf-8")
    if "useAgents" in t:
        skipped.append("console: page already reads live agents")
    elif 'import { CONSOLE_AGENTS } from "@/lib/agents";' in t:
        t = t.replace(
            'import { CONSOLE_AGENTS } from "@/lib/agents";',
            'import { useAgents } from "@/lib/use-agents";\nimport ChainStatus from "@/components/ChainStatus";',
            1,
        )
        t = t.replace(
            "export default function ConsolePage() {",
            "export default function ConsolePage() {\n"
            "  // Live from the ERC-8004 registries on GOAT, via the API.\n"
            "  const { agents: CONSOLE_AGENTS, state, blockNumber } = useAgents();\n",
            1,
        )
        t = t.replace(
            "        <ScanSweep />",
            "        <ScanSweep />",
            1,
        )
        # Surface provenance directly above the rack.
        t = t.replace(
            '        <div className="relative mt-8">',
            '        <ChainStatus state={state} blockNumber={blockNumber} />\n\n'
            '        <div className="relative mt-8">',
            1,
        )
        page.write_text(t, encoding="utf-8")
        applied.append("console: page wired to live on-chain agents")
    else:
        missing.append(
            "console: couldn't find the CONSOLE_AGENTS import in app/console/page.tsx"
        )
else:
    missing.append("console: app/console/page.tsx not found")

# 4. viem in the API
pkg = API / "package.json"
if pkg.exists() and '"viem"' not in pkg.read_text(encoding="utf-8"):
    print("→ Installing viem in apps/api…")
    subprocess.run(["npm", "install", "viem"], cwd=API, check=False)
    applied.append("api: installed viem")
else:
    skipped.append("api: viem already present")

print("\n\033[1mBuilderOS patch v5 — live on-chain agents\033[0m\n")
if applied:
    print(f"\033[32m✓ applied ({len(applied)})\033[0m")
    for a in applied:
        print(f"    {a}")
if skipped:
    print(f"\n\033[33m• already applied ({len(skipped)})\033[0m")
    for s in skipped:
        print(f"    {s}")
if missing:
    print(f"\n\033[31m✗ needs attention ({len(missing)})\033[0m")
    for m in missing:
        print(f"    {m}")

print("""
VERIFY
  cd apps/api && npm run start:dev
  curl http://localhost:4000/v1/agents | head -40
     -> expect "source":"chain" and agentId 341 / 342 with an owner address

  cd apps/console && npm run dev -- --port 3001
     -> sign in, and the rack now shows live registry values
""")
sys.exit(1 if missing else 0)
