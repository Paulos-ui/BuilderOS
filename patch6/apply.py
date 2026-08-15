#!/usr/bin/env python3
"""
BuilderOS patch v6 — BuilderScout ingestion, hybrid retrieval, feed UI,
and the SIGN IN link on the landing page.

Run from your project root:  python3 patch6/apply.py
"""
import pathlib
import shutil
import sys

ROOT = pathlib.Path(".").resolve()
API = ROOT / "apps/api"
CONSOLE = ROOT / "apps/console"
LANDING = ROOT / "apps/landing"
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


for d in (API, CONSOLE, LANDING):
    if not d.exists():
        print(f"✗ Missing {d}. Run from your builderos project root.")
        sys.exit(1)

# ── 1. Copy source files ─────────────────────────────────────────────────
for base, dest in ((HERE / "api", API), (HERE / "console", CONSOLE)):
    for src in base.rglob("*.ts*"):
        target = dest / src.relative_to(base)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, target)
        applied.append(f"{dest.name}: {src.relative_to(base)}")

# ── 2. Register the module ───────────────────────────────────────────────
edit(
    API / "src/app.module.ts",
    "import { AgentsModule } from './agents/agents.module';",
    "import { AgentsModule } from './agents/agents.module';\nimport { OpportunitiesModule } from './opportunities/opportunities.module';",
    "api: import OpportunitiesModule",
)
edit(
    API / "src/app.module.ts",
    "    AgentsModule,\n  ],",
    "    AgentsModule,\n    OpportunitiesModule,\n  ],",
    "api: register OpportunitiesModule",
)

# ── 3. pgvector index migration ──────────────────────────────────────────
# Without an index, similarity search does a sequential scan over every row.
# Fine at 50 opportunities, not fine at 50,000 — and adding it later means a
# migration against a live table.
mig_dir = API / "prisma/migrations/20260815000000_opportunity_vector_index"
mig_dir.mkdir(parents=True, exist_ok=True)
(mig_dir / "migration.sql").write_text(
    """-- Ensure pgvector is available (no-op if the extension already exists).
CREATE EXTENSION IF NOT EXISTS vector;

-- IVFFlat index for cosine distance on opportunity embeddings.
-- `lists` trades index build time against query recall; 100 is a reasonable
-- default for corpora in the low tens of thousands. Revisit if the table
-- grows past that.
CREATE INDEX IF NOT EXISTS opportunities_embedding_idx
  ON opportunities USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Supports the structured half of the hybrid query.
CREATE INDEX IF NOT EXISTS opportunities_status_deadline_idx
  ON opportunities (status, deadline);

-- GIN index so the `chains ? 'goat'` containment predicate is indexed
-- rather than scanned.
CREATE INDEX IF NOT EXISTS opportunities_chains_idx
  ON opportunities USING gin (chains jsonb_path_ops);
""",
    encoding="utf-8",
)
applied.append("api: pgvector + filter index migration")

# ── 4. Console nav in the layout ─────────────────────────────────────────
edit(
    CONSOLE / "app/console/layout.tsx",
    'import SessionBar from "@/components/SessionBar";',
    'import SessionBar from "@/components/SessionBar";\nimport ConsoleNav from "@/components/ConsoleNav";',
    "console: import ConsoleNav",
)
edit(
    CONSOLE / "app/console/layout.tsx",
    "        <SessionBar />\n      </div>",
    "        <SessionBar />\n        <ConsoleNav />\n      </div>",
    "console: render ConsoleNav",
)

# ── 5. Landing: SIGN IN link ─────────────────────────────────────────────
nav = LANDING / "components/SiteNav.tsx"
edit(
    nav,
    "const NAV_LINKS = [",
    'const CONSOLE_URL =\n  process.env.NEXT_PUBLIC_CONSOLE_URL ?? "http://localhost:3001";\n\nconst NAV_LINKS = [',
    "landing: CONSOLE_URL constant",
)
edit(
    nav,
    '          <a\n            href="#cta"\n            onClick={() => handleNavigate("#cta")}\n            className="hidden rounded-sm bg-brass px-4 py-2',
    '          <a\n            href={`${CONSOLE_URL}/signin`}\n            className="hidden rounded-sm px-3 py-2 font-mono text-[11px] tracking-[0.12em] text-paper-dim transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright md:inline-block"\n          >\n            SIGN IN\n          </a>\n\n          <a\n            href="#cta"\n            onClick={() => handleNavigate("#cta")}\n            className="hidden rounded-sm bg-brass px-4 py-2',
    "landing: desktop SIGN IN link",
)
edit(
    nav,
    '              <a\n                href="#cta"\n                onClick={() => handleNavigate("#cta")}\n                className="mt-4 block rounded-sm bg-brass',
    '              <a\n                href={`${CONSOLE_URL}/signin`}\n                className="mt-4 block rounded-sm border border-line/40 px-4 py-3 text-center font-mono text-xs tracking-[0.1em] text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"\n              >\n                SIGN IN\n              </a>\n              <a\n                href="#cta"\n                onClick={() => handleNavigate("#cta")}\n                className="mt-3 block rounded-sm bg-brass',
    "landing: mobile SIGN IN link",
)

print("\n\033[1mBuilderOS patch v6 — BuilderScout\033[0m\n")
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
    print("\n  See patch6/landing/SIGNIN_SNIPPET.md to apply nav changes by hand.")

print("""
NEXT
  1. cd apps/api
     echo 'INGEST_SECRET=<pick a long random string>' >> .env
     npx prisma migrate dev            # applies the vector index
     npm run start:dev

  2. Populate the feed:
     curl -X POST "http://localhost:4000/v1/opportunities/ingest?secret=YOUR_SECRET"

  3. cd apps/console && npm run dev -- --port 3001
     sign in, then open /console/opportunities

  OPTIONAL, for real semantic ranking:
     add VOYAGE_API_KEY to apps/api/.env  (voyageai.com)
     without it the feed uses a lexical fallback and says so in the UI
""")
sys.exit(1 if missing else 0)
