#!/usr/bin/env python3
"""
BuilderOS patch v8 — real email delivery for sign-in codes.

Extracts delivery into a MailerService, makes provider failures visible and
actionable instead of a bare 500, and reports delivery status to the client
so the UI can tell the user what actually happened.

Run from your project root:  python3 patch8/apply.py
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


if not API.exists():
    print("✗ Run from your builderos project root (the folder with apps/).")
    sys.exit(1)

# ── 1. Copy the mailer ───────────────────────────────────────────────────
for src in (HERE / "api").rglob("*.ts"):
    target = API / src.relative_to(HERE / "api")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, target)
    applied.append(f"api: {src.relative_to(HERE / 'api')}")

# ── 2. OTP service delegates delivery to the mailer ──────────────────────
otp = API / "src/auth/otp.service.ts"
edit(
    otp,
    "import { PrismaService } from '../prisma/prisma.service';",
    "import { PrismaService } from '../prisma/prisma.service';\nimport { MailerService, type MailStatus } from '../common/mailer.service';",
    "api: otp imports MailerService",
)
edit(
    otp,
    """  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}""",
    """  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
  ) {}""",
    "api: inject MailerService",
)

# Replace the inline deliver() with a call into the mailer, and pass the
# delivery outcome back up so the API response can be honest about it.
edit(
    otp,
    "  async issue(rawEmail: string): Promise<{ sent: true; retryAfter: number }> {",
    "  async issue(\n    rawEmail: string,\n  ): Promise<{ sent: boolean; delivery: MailStatus; retryAfter: number; reason?: string }> {",
    "api: issue() returns delivery status",
)
edit(
    otp,
    """    await this.deliver(email, code);
    return { sent: true, retryAfter: RESEND_COOLDOWN_SECONDS };""",
    """    const result = await this.mailer.sendSignInCode(
      email,
      code,
      OTP_TTL_MINUTES,
    );

    // The code is valid regardless of whether the email landed — it is in
    // the database and (on failure) in the logs. We report the delivery
    // outcome rather than claiming success we cannot verify.
    return {
      sent: result.status !== 'failed',
      delivery: result.status,
      retryAfter: RESEND_COOLDOWN_SECONDS,
      ...(result.reason ? { reason: result.reason } : {}),
    };""",
    "api: issue() delegates to mailer",
)

# Remove the now-dead inline deliver method.
t = otp.read_text(encoding="utf-8") if otp.exists() else ""
start = t.find("  private async deliver(email: string, code: string) {")
if start != -1:
    end = t.find("\n  /** Returns the verified email, or throws. */", start)
    if end != -1:
        otp.write_text(t[:start].rstrip() + "\n" + t[end:], encoding="utf-8")
        applied.append("api: removed inline deliver()")
    else:
        missing.append("api: couldn't locate the end of deliver() to remove it")
else:
    skipped.append("api: inline deliver() already removed")

# ── 3. Register the mailer ───────────────────────────────────────────────
edit(
    API / "src/auth/auth.module.ts",
    "import { OtpService } from './otp.service';",
    "import { OtpService } from './otp.service';\nimport { MailerService } from '../common/mailer.service';",
    "api: auth module imports MailerService",
)
edit(
    API / "src/auth/auth.module.ts",
    "providers: [AuthService, JwtStrategy, OtpService],",
    "providers: [AuthService, JwtStrategy, OtpService, MailerService],",
    "api: register MailerService",
)

# ── 4. Startup visibility ────────────────────────────────────────────────
edit(
    API / "src/main.ts",
    "  console.log(`BuilderOS Core Platform API listening on :${port}`);",
    """  console.log(`BuilderOS Core Platform API listening on :${port}`);
  console.log(
    process.env.RESEND_API_KEY
      ? `Email delivery: ENABLED (from ${process.env.MAIL_FROM ?? 'onboarding@resend.dev'})`
      : 'Email delivery: DISABLED — sign-in codes will print to this log',
  );""",
    "api: report email configuration at startup",
)

# ── 5. Console surfaces delivery status ──────────────────────────────────
api_ts = CONSOLE / "lib/api.ts"
edit(
    api_ts,
    'return api<{ sent: true; retryAfter: number }>("/v1/auth/email/otp", {',
    'return api<{\n    sent: boolean;\n    delivery: "sent" | "logged" | "failed";\n    retryAfter: number;\n    reason?: string;\n  }>("/v1/auth/email/otp", {',
    "console: typed delivery status",
)

panel = CONSOLE / "components/SignInPanel.tsx"
edit(
    panel,
    """      const res = await requestOtp(email.trim());
      setStep("enter-code");
      setCode("");
      setCooldown(res.retryAfter ?? 30);""",
    """      const res = await requestOtp(email.trim());
      setStep("enter-code");
      setCode("");
      setCooldown(res.retryAfter ?? 30);
      setDelivery(res.delivery);
      // A failed send still produced a valid code, so we advance to the
      // input screen — but we say plainly that the email didn't arrive
      // rather than leaving the user waiting on an inbox forever.
      if (res.delivery === "failed" && res.reason) setError(res.reason);""",
    "console: capture delivery status",
)
edit(
    panel,
    '  const [cooldown, setCooldown] = useState(0);',
    '  const [cooldown, setCooldown] = useState(0);\n  const [delivery, setDelivery] = useState<"sent" | "logged" | "failed" | null>(\n    null,\n  );',
    "console: delivery state",
)
edit(
    panel,
    """          {step === "enter-code" ? (
            <>
              We sent a 6-digit code to{" "}
              <span className="text-paper">{email}</span>.
            </>""",
    """          {step === "enter-code" ? (
            delivery === "logged" ? (
              <>
                Email isn&apos;t configured on this deployment, so the code
                was written to the server log instead.
              </>
            ) : (
              <>
                We sent a 6-digit code to{" "}
                <span className="text-paper">{email}</span>.
              </>
            )""",
    "console: honest copy when email is not configured",
)

print("\n\033[1mBuilderOS patch v8 — email delivery\033[0m\n")
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
NEXT — set up Resend (see patch8/EMAIL_SETUP.md for the full walkthrough)

  1. Create a free account at resend.com, then create an API key.
  2. Add to apps/api/.env AND to Render's environment variables:
       RESEND_API_KEY=re_xxxxxxxx
       MAIL_FROM=onboarding@resend.dev
  3. Restart the API. Startup now prints whether email is ENABLED.

  IMPORTANT: until you verify your own sending domain, providers typically
  restrict you to emailing the account owner's address. Test with the email
  you signed up to Resend with — anything else will be rejected, and the API
  will now tell you exactly that instead of failing silently.
""")
sys.exit(1 if missing else 0)
