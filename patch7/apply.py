#!/usr/bin/env python3
"""
BuilderOS patch v7 — 6-digit OTP sign-in, branded sign-in page, and console
layout alignment.

Run from your project root:  python3 patch7/apply.py
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
for src in (HERE / "api").rglob("*"):
    if src.is_file() and src.suffix in (".ts", ".sql", ".prisma"):
        target = API / src.relative_to(HERE / "api")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, target)
        applied.append(f"api: {src.relative_to(HERE / 'api')}")

for src in (HERE / "console").rglob("*.tsx"):
    target = CONSOLE / src.relative_to(HERE / "console")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, target)
    applied.append(f"console: {src.relative_to(HERE / 'console')}")

# ── 2. Prisma model ──────────────────────────────────────────────────────
schema = API / "prisma/schema.prisma"
if schema.exists():
    t = schema.read_text(encoding="utf-8")
    if "model EmailOtp" in t:
        skipped.append("api: EmailOtp model")
    else:
        schema.write_text(
            t.rstrip()
            + """

/// Six-digit email sign-in codes. Stores a salted hash, never the code.
model EmailOtp {
  id        String    @id @default(uuid())
  email     String
  codeHash  String    @map("code_hash")
  attempts  Int       @default(0)
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([email, createdAt])
  @@map("email_otps")
}
""",
            encoding="utf-8",
        )
        applied.append("api: EmailOtp model added to schema.prisma")

# ── 3. Auth module + controller ──────────────────────────────────────────
edit(
    API / "src/auth/auth.module.ts",
    "import { JwtStrategy } from './strategies/jwt.strategy';",
    "import { JwtStrategy } from './strategies/jwt.strategy';\nimport { OtpService } from './otp.service';",
    "api: import OtpService",
)
edit(
    API / "src/auth/auth.module.ts",
    "providers: [AuthService, JwtStrategy],",
    "providers: [AuthService, JwtStrategy, OtpService],",
    "api: register OtpService",
)

ctrl = API / "src/auth/auth.controller.ts"
edit(
    ctrl,
    "import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';",
    "import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';\nimport { RequestOtpDto } from './dto/request-otp.dto';\nimport { VerifyOtpDto } from './dto/verify-otp.dto';\nimport { OtpService } from './otp.service';",
    "api: controller imports OTP",
)
edit(
    ctrl,
    "    private readonly authService: AuthService,",
    "    private readonly authService: AuthService,\n    private readonly otpService: OtpService,",
    "api: inject OtpService",
)
edit(
    ctrl,
    "  @Post('email/magic-link')",
    """  /** Issues a 6-digit sign-in code. */
  @Post('email/otp')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.otpService.issue(dto.email);
  }

  /** Verifies a 6-digit code and starts a session. */
  @Post('email/verify')
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = await this.otpService.verify(dto.email, dto.code);
    const tokens = await this.authService.startEmailSession(email);
    this.setRefreshCookie(res, tokens);
    return { accessToken: tokens.accessToken };
  }

  @Post('email/magic-link')""",
    "api: OTP endpoints",
)

# The old magic-link verify route now collides with email/verify. Rename it
# so existing links keep working during the transition rather than 404ing.
edit(
    ctrl,
    "  @Post('email/verify')\n  async verifyMagicLink(",
    "  @Post('email/verify-link')\n  async verifyMagicLink(",
    "api: move legacy magic-link verify to email/verify-link",
)

# Expose session creation for the OTP path.
edit(
    API / "src/auth/auth.service.ts",
    "  private async issueSession(userId: string): Promise<SessionTokens> {",
    """  /** Starts a session for a verified email address (used by the OTP flow). */
  async startEmailSession(email: string): Promise<SessionTokens> {
    const user = await this.findOrCreateUserByEmail(email.toLowerCase());
    return this.issueSession(user.id);
  }

  private async issueSession(userId: string): Promise<SessionTokens> {""",
    "api: startEmailSession for OTP",
)

# ── 4. Console API client ────────────────────────────────────────────────
api_ts = CONSOLE / "lib/api.ts"
if api_ts.exists():
    t = api_ts.read_text(encoding="utf-8")

    # Hard fallback so a missing env var can't break the deployed console.
    t = t.replace(
        'const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";',
        'const API_URL = (\n  process.env.NEXT_PUBLIC_API_URL ?? "https://builderos-api.onrender.com"\n).replace(/\\/+$/, "");',
        1,
    )

    if "requestOtp" not in t:
        t = t.replace(
            "export function requestMagicLink(email: string) {",
            """export function requestOtp(email: string) {
  return api<{ sent: true; retryAfter: number }>("/v1/auth/email/otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(email: string, code: string) {
  const data = await api<{ accessToken: string }>("/v1/auth/email/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
  accessToken = data.accessToken;
  return data;
}

export function requestMagicLink(email: string) {""",
            1,
        )
    api_ts.write_text(t, encoding="utf-8")
    applied.append("console: api.ts — OTP helpers + hardened API_URL fallback")
else:
    missing.append("console: lib/api.ts not found")

# ── 5. Console layout: one container, consistent gutters ─────────────────
layout = CONSOLE / "app/console/layout.tsx"
if layout.exists():
    layout.write_text(
        '''import AuthGate from "@/components/AuthGate";
import SessionBar from "@/components/SessionBar";
import ConsoleNav from "@/components/ConsoleNav";

/**
 * Single layout shell for every console page.
 *
 * The header (session bar + nav) and the page content share ONE max-width
 * container and one set of gutters. Previously each page set its own, which
 * meant the nav and the content below it sat on slightly different left
 * edges — the kind of misalignment that reads as sloppy even when nobody
 * can name what is wrong.
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
          <div className="mx-auto w-full max-w-5xl px-5 pt-6 md:px-8">
            <SessionBar />
            <ConsoleNav />
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl px-5 md:px-8">{children}</div>
      </div>
    </AuthGate>
  );
}
''',
        encoding="utf-8",
    )
    applied.append("console: unified layout container and gutters")
else:
    missing.append("console: app/console/layout.tsx not found")

# Pages no longer set their own container — the layout owns it.
feed = CONSOLE / "components/OpportunityFeed.tsx"
if feed.exists():
    t = feed.read_text(encoding="utf-8")
    if 'className="mx-auto max-w-5xl px-5 py-10 md:px-8"' in t:
        t = t.replace(
            '<section className="mx-auto max-w-5xl px-5 py-10 md:px-8">',
            '<section className="py-10">',
            1,
        )
        feed.write_text(t, encoding="utf-8")
        applied.append("console: feed inherits the layout container")
    else:
        skipped.append("console: feed container")

opp_page = CONSOLE / "app/console/opportunities/page.tsx"
if opp_page.exists():
    opp_page.write_text(
        '''import OpportunityFeed from "@/components/OpportunityFeed";

export default function OpportunitiesPage() {
  return <OpportunityFeed />;
}
''',
        encoding="utf-8",
    )
    applied.append("console: opportunities page uses the shared shell")

print("\n\033[1mBuilderOS patch v7 — OTP sign-in + UI alignment\033[0m\n")
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
NEXT
  1. cd apps/api && npx prisma migrate dev --name otp_codes
  2. npm run start:dev
  3. Test:
       curl -X POST http://localhost:4000/v1/auth/email/otp \\
         -H "Content-Type: application/json" -d '{"email":"you@x.com"}'
     -> the 6-digit code prints in the API terminal, boxed
       curl -X POST http://localhost:4000/v1/auth/email/verify \\
         -H "Content-Type: application/json" \\
         -d '{"email":"you@x.com","code":"123456"}'
  4. cd apps/console && npm run dev -- --port 3001

  Console Vercel env vars:
     NEXT_PUBLIC_API_URL      https://builderos-api.onrender.com
     NEXT_PUBLIC_LANDING_URL  https://builderos1.vercel.app
""")
sys.exit(1 if missing else 0)
