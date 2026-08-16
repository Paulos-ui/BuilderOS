#!/usr/bin/env python3
"""
BuilderOS patch v9 — console dashboard: branded header, Agent Rack grid,
identity linking, and a diagnostics endpoint for the empty feed.

Run from your project root:  python3 patch9/apply.py
"""
import pathlib
import shutil
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


for d in (API, CONSOLE):
    if not d.exists():
        print(f"✗ Missing {d}. Run from your builderos project root.")
        sys.exit(1)

# ── 1. Copy files ────────────────────────────────────────────────────────
for base, dest in ((HERE / "api", API), (HERE / "console", CONSOLE)):
    for src in base.rglob("*.ts*"):
        target = dest / src.relative_to(base)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, target)
        applied.append(f"{dest.name}: {src.relative_to(base)}")

# ── 2. Expose signature verification for linking ─────────────────────────
# linkWallet must prove address control exactly as strongly as sign-in does,
# so it reuses the same verification rather than a weaker check.
edit(
    API / "src/auth/auth.service.ts",
    "  async walletVerify(",
    """  /**
   * Verifies a SIWE signature and returns the address. Shared by sign-in and
   * by wallet linking so both paths enforce identical proof of control.
   */
  async verifyWalletSignature(
    message: string,
    signature: string,
  ): Promise<string> {
    const parsed = parseSiweMessage(message);

    const nonceRecord = await this.prisma.authNonce.findUnique({
      where: { nonce: parsed.nonce },
    });
    if (
      !nonceRecord ||
      nonceRecord.usedAt ||
      nonceRecord.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Nonce is invalid, used, or expired');
    }
    if (nonceRecord.address !== parsed.address.toLowerCase()) {
      throw new UnauthorizedException('Address does not match challenge');
    }

    const isValid = await verifyMessage({
      address: parsed.address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    if (!isValid) throw new UnauthorizedException('Invalid signature');

    await this.prisma.authNonce.update({
      where: { nonce: parsed.nonce },
      data: { usedAt: new Date() },
    });

    return parsed.address;
  }

  async walletVerify(""",
    "api: shared verifyWalletSignature",
)

# ── 3. Profiles controller: identity + linking ───────────────────────────
edit(
    API / "src/profiles/profiles.controller.ts",
    "import { ProfilesService } from './profiles.service';",
    "import { ProfilesService } from './profiles.service';\nimport { IdentityService } from './identity.service';",
    "api: profiles imports IdentityService",
)
edit(
    API / "src/profiles/profiles.controller.ts",
    "  constructor(private readonly profilesService: ProfilesService) {}",
    "  constructor(\n    private readonly profilesService: ProfilesService,\n    private readonly identityService: IdentityService,\n  ) {}",
    "api: inject IdentityService",
)
edit(
    API / "src/profiles/profiles.controller.ts",
    "  // Public — powers the shareable reputation profile (no auth guard).",
    """  @UseGuards(JwtAuthGuard)
  @Get('me/identity')
  getIdentity(@CurrentUser() user: JwtPayload) {
    return this.identityService.summary(user.builderProfileId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/link-wallet')
  linkWallet(
    @CurrentUser() user: JwtPayload,
    @Body() body: { message: string; signature: string },
  ) {
    return this.identityService.linkWallet(
      user.builderProfileId,
      body.message,
      body.signature,
    );
  }

  // Public — powers the shareable reputation profile (no auth guard).""",
    "api: identity + link-wallet routes",
)
edit(
    API / "src/profiles/profiles.controller.ts",
    "import {\n  Body,\n  Controller,\n  Get,\n  Param,\n  Patch,\n  UseGuards,\n} from '@nestjs/common';",
    "import {\n  Body,\n  Controller,\n  Get,\n  Param,\n  Patch,\n  Post,\n  UseGuards,\n} from '@nestjs/common';",
    "api: import Post decorator",
)
edit(
    API / "src/profiles/profiles.module.ts",
    "import { ProfilesService } from './profiles.service';",
    "import { ProfilesService } from './profiles.service';\nimport { IdentityService } from './identity.service';\nimport { AuthModule } from '../auth/auth.module';",
    "api: profiles module imports",
)
edit(
    API / "src/profiles/profiles.module.ts",
    "  controllers: [ProfilesController],\n  providers: [ProfilesService],",
    "  imports: [AuthModule],\n  controllers: [ProfilesController],\n  providers: [ProfilesService, IdentityService],",
    "api: register IdentityService",
)

# ── 4. Diagnostics controller ────────────────────────────────────────────
edit(
    API / "src/opportunities/opportunities.module.ts",
    "import { OpportunitiesController } from './opportunities.controller';",
    "import { OpportunitiesController } from './opportunities.controller';\nimport { DiagnosticsController } from './diagnostics.controller';",
    "api: import DiagnosticsController",
)
edit(
    API / "src/opportunities/opportunities.module.ts",
    "  controllers: [OpportunitiesController],",
    "  controllers: [OpportunitiesController, DiagnosticsController],",
    "api: register DiagnosticsController",
)

# ── 5. Sign-in lands on the Agent Rack ───────────────────────────────────
edit(
    CONSOLE / "components/SignInPanel.tsx",
    'const POST_SIGNIN = "/console/opportunities";',
    'const POST_SIGNIN = "/console";',
    "console: sign-in lands on the Agent Rack",
)
edit(
    CONSOLE / "app/signin/page.tsx",
    'router.replace("/console/opportunities");',
    'router.replace("/console");',
    "console: signed-in redirect target",
)

# ── 6. SessionBar is now part of ConsoleNav ──────────────────────────────
layout = CONSOLE / "app/console/layout.tsx"
if layout.exists():
    layout.write_text(
        '''import AuthGate from "@/components/AuthGate";
import ConsoleNav from "@/components/ConsoleNav";

/**
 * One shell for every console page. The header and page content share a
 * single max-width container and one set of gutters, so nothing sits on a
 * different left edge to anything else.
 */
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="bp-grid min-h-screen">
        <header className="border-b border-line/15">
          <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
            <ConsoleNav />
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8">{children}</div>
      </div>
    </AuthGate>
  );
}
''',
        encoding="utf-8",
    )
    applied.append("console: layout uses ConsoleNav, wider container")

print("\n\033[1mBuilderOS patch v9 — console dashboard\033[0m\n")
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
FIRST — diagnose the empty production feed:

  curl "https://builderos-api.onrender.com/v1/opportunities/diagnostics?secret=YOUR_INGEST_SECRET"

  It reports which database the API is reading, how many rows exist, how many
  are open, and a plain-language verdict on why the feed is empty.

  Then re-run ingestion against PRODUCTION (not localhost):

  curl -X POST "https://builderos-api.onrender.com/v1/opportunities/ingest?secret=YOUR_INGEST_SECRET"

THEN:
  cd apps/api && npx tsc --noEmit && npm run start:dev
  cd apps/console && npx tsc --noEmit && npm run dev -- --port 3001
""")
sys.exit(1 if missing else 0)
