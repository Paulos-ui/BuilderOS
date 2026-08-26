#!/usr/bin/env python3
"""
BuilderOS patch v16 — sidebar navigation, email linking, and a plain-language
pass over the dashboard.

Run from your project root:  python3 patch16/apply.py
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

for base, dest in ((HERE / "api", API), (HERE / "console", CONSOLE)):
    for src in base.rglob("*.ts*"):
        target = dest / src.relative_to(base)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, target)
        applied.append(f"{dest.name}: {src.relative_to(base)}")

# ── Register the email-linking controller ────────────────────────────────
edit(API / "src/profiles/profiles.module.ts",
  "import { IdentityService } from './identity.service';",
  "import { IdentityService } from './identity.service';\n"
  "import { LinkEmailController } from './link-email.controller';\n"
  "import { OtpService } from '../auth/otp.service';\n"
  "import { MailerService } from '../common/mailer.service';",
  "api: import LinkEmailController")
edit(API / "src/profiles/profiles.module.ts",
  "  controllers: [ProfilesController],",
  "  controllers: [ProfilesController, LinkEmailController],",
  "api: register LinkEmailController")
edit(API / "src/profiles/profiles.module.ts",
  "  providers: [ProfilesService, IdentityService],",
  "  providers: [ProfilesService, IdentityService, OtpService, MailerService],",
  "api: provide OtpService for email linking")

# ── Plain language pass ──────────────────────────────────────────────────
# Some technical texture is the brand and stays. What goes is the material a
# builder cannot act on: block heights, registry addresses, engine internals.

rack = CONSOLE / "components/AgentRack.tsx"
edit(rack,
  'description="Six specialised agents, each with a defined responsibility and a place in the workflow. Identity and reputation are read from the ERC-8004 registries on GOAT Network."',
  'description="Each agent handles one part of getting funded — finding opportunities, strengthening your application, tracking deadlines, and recording what you complete."',
  "console: plain-language rack description")

# Block height is telemetry for us, noise for a builder.
chain = CONSOLE / "components/ChainStatus.tsx"
edit(chain,
  '      detail: blockNumber ? `Block ${blockNumber}` : "ERC-8004 registries",',
  '      detail: "Agent identities verified on-chain",',
  "console: chain status reads plainly")

# The feed heading led with an agent code rather than what the page does.
feed = CONSOLE / "components/OpportunityFeed.tsx"
edit(feed,
  '          AG-01 · BUILDERSCOUT\n        </p>\n        <h1 className="mt-3 font-display text-3xl font-semibold text-paper">\n          Opportunity feed\n        </h1>',
  '          DISCOVER\n        </p>\n        <h1 className="mt-3 font-display text-3xl font-semibold text-paper">\n          Opportunities\n        </h1>',
  "console: feed heading")
edit(feed,
  'AG-01 · BUILDERSCOUT',
  'DISCOVER · BUILDERSCOUT',
  "console: feed eyebrow")

for path, old, new, label in [
    (CONSOLE / "components/ProofForgeWorkspace.tsx",
     'eyebrow="AG-02 · PROOFFORGE"', 'eyebrow="REVIEW · PROOFFORGE"',
     "console: review eyebrow"),
    (CONSOLE / "components/FlowBoard.tsx",
     'eyebrow="AG-03 · BUILDERFLOW"', 'eyebrow="TRACK · BUILDERFLOW"',
     "console: track eyebrow"),
    (CONSOLE / "components/ProofLedger.tsx",
     'eyebrow="AG-05 · BUILDERREP"', 'eyebrow="PROOF · BUILDERREP"',
     "console: proof eyebrow"),
]:
    edit(path, old, new, label)

# ── Profile page uses the new panel ──────────────────────────────────────
profile = CONSOLE / "app/console/profile/page.tsx"
if profile.exists():
    profile.write_text('''import IdentityPanel from "@/components/IdentityPanel";
import ProfileHeader from "@/components/ProfileHeader";

export default function ProfilePage() {
  return (
    <section className="py-10">
      <ProfileHeader />
      <div className="mt-8">
        <IdentityPanel />
      </div>
    </section>
  );
}
''', encoding="utf-8")
    applied.append("console: profile page")

print("\\n\\033[1mBuilderOS patch v16\\033[0m\\n")
if applied:
    print(f"\\033[32m✓ applied ({len(applied)})\\033[0m")
    for a in applied: print(f"    {a}")
if skipped:
    print(f"\\n\\033[33m• already applied ({len(skipped)})\\033[0m")
    for s in skipped: print(f"    {s}")
if missing:
    print(f"\\n\\033[31m✗ needs attention ({len(missing)})\\033[0m")
    for m in missing: print(f"    {m}")

print("""
NEXT
  cd apps/api && npx tsc --noEmit && npm run start:dev
  cd ../console && npx tsc --noEmit && npm run dev -- --port 3001

  ConsoleNav.tsx is now unused — the sidebar replaces it. Delete it once
  you have confirmed nothing else imports it:
    grep -rn "ConsoleNav" apps/console/
""")
sys.exit(1 if missing else 0)
