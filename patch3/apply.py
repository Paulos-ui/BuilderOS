#!/usr/bin/env python3
"""
BuilderOS patch v3 — connect the beta form to a real backend, and remove the
last of the claims the product does not yet support.

Run from your project root:  python3 patch3/apply.py
"""
import pathlib
import shutil
import sys

ROOT = pathlib.Path(".").resolve()
API = ROOT / "apps/api"
LANDING = ROOT / "apps/landing"
HERE = pathlib.Path(__file__).parent

applied, skipped, missing = [], [], []


def edit(path: pathlib.Path, old: str, new: str, label: str) -> None:
    if not path.exists():
        missing.append(f"{label} — not found: {path}")
        return
    t = path.read_text(encoding="utf-8")
    if new in t:
        skipped.append(label)
        return
    if old not in t:
        missing.append(f"{label} — target text not found in {path.name}")
        return
    path.write_text(t.replace(old, new, 1), encoding="utf-8")
    applied.append(label)


if not API.exists() or not LANDING.exists():
    print("✗ Run this from your builderos project root (the folder with apps/).")
    sys.exit(1)

# ── 1. Waitlist module files ─────────────────────────────────────────────
dest = API / "src/waitlist"
dest.mkdir(parents=True, exist_ok=True)
(dest / "dto").mkdir(exist_ok=True)
for src in (HERE / "api/src/waitlist").rglob("*.ts"):
    rel = src.relative_to(HERE / "api/src/waitlist")
    target = dest / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, target)
applied.append("api: waitlist module files (controller, service, dto)")

# ── 2. Register the module ───────────────────────────────────────────────
edit(
    API / "src/app.module.ts",
    "import { ProfilesModule } from './profiles/profiles.module';",
    "import { ProfilesModule } from './profiles/profiles.module';\nimport { WaitlistModule } from './waitlist/waitlist.module';",
    "api: import WaitlistModule",
)
edit(
    API / "src/app.module.ts",
    "    ProfilesModule,\n  ],",
    "    ProfilesModule,\n    WaitlistModule,\n  ],",
    "api: register WaitlistModule",
)

# ── 3. Prisma model ──────────────────────────────────────────────────────
schema = API / "prisma/schema.prisma"
model = '''
/// Private-beta signups from the marketing site.
model WaitlistSignup {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  role      String?
  ecosystem String?
  goal      String?
  createdAt DateTime @default(now()) @map("created_at")

  @@map("waitlist_signups")
}
'''
if schema.exists():
    t = schema.read_text(encoding="utf-8")
    if "model WaitlistSignup" in t:
        skipped.append("api: WaitlistSignup model")
    else:
        schema.write_text(t.rstrip() + "\n" + model, encoding="utf-8")
        applied.append("api: WaitlistSignup model added to schema.prisma")
else:
    missing.append("api: prisma/schema.prisma not found")

# ── 4. Frontend form ─────────────────────────────────────────────────────
shutil.copy(HERE / "landing/CTAFooter.tsx", LANDING / "components/CTAFooter.tsx")
applied.append("landing: CTAFooter wired to the API with honest error states")

# ── 5. Remaining false claims on the live site ───────────────────────────
edit(
    LANDING / "app/layout.tsx",
    "turns your shipped work into verifiable on-chain reputation — through a coordinated system of specialized AI agents.",
    "turns your completed work into a portable record of proof — through a coordinated system of specialized AI agents.",
    "landing: meta description no longer claims on-chain reputation",
)
edit(
    LANDING / "app/layout.tsx",
    '"Discover. Apply. Prove. Build reputation. A coordinated system of AI agents for Web3 builders."',
    '"Discover. Apply. Prove. Build reputation. A coordinated system of AI agents for Web3 builders."',
    "landing: og description (already accurate)",
)
edit(
    LANDING / "components/AboutDocs.tsx",
    "and once you ship, BuilderRep mints the attestation automatically.",
    "and once you ship, BuilderRep records it as structured proof on your builder profile.",
    "landing: user guide no longer claims attestation minting",
)

# ── report ───────────────────────────────────────────────────────────────
print("\n\033[1mBuilderOS patch v3\033[0m\n")
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
NEXT STEPS
  1. cd apps/api && npx prisma migrate dev --name add_waitlist
  2. cd apps/api && npm run start:dev
  3. Test:
     curl -X POST http://localhost:4000/v1/waitlist \\
       -H "Content-Type: application/json" \\
       -d '{"email":"test@builderos.dev","role":"developer"}'
  4. cd apps/landing && echo 'NEXT_PUBLIC_API_URL=http://localhost:4000' > .env.local
  5. npm run dev  — submit the form, then check Prisma Studio
""")
sys.exit(1 if missing else 0)
