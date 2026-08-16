#!/usr/bin/env python3
"""
BuilderOS patch v12 — four fixes from live testing.

  1. Reload no longer bounces to /signin (third-party cookie blocking)
  2. Agents are launchable, not just readable
  3. The embedder banner is gone from the user-facing feed
  4. Header and content surfaces are visually distinct

Run from your project root:  python3 patch12/apply.py
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

# ── 1. Copy files ────────────────────────────────────────────────────────
for src in (HERE / "console").rglob("*.ts*"):
    target = CONSOLE / src.relative_to(HERE / "console")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, target)
    applied.append(f"console: {src.relative_to(HERE / 'console')}")

# ── 2. Backend: accept a refresh token from the body, not only the cookie ─
edit(
    API / "src/auth/auth.controller.ts",
    """    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token present');
    }
    const tokens = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(res, tokens);
    return { accessToken: tokens.accessToken };""",
    """    // Cookie first. Firefox and Safari block third-party cookies by
    // default, and the console is on a different registrable domain to this
    // API, so the cookie is often simply absent — the body fallback is what
    // keeps sessions alive there. Once app and API share a parent domain
    // this can go back to cookie-only.
    const refreshToken =
      req.cookies?.[REFRESH_COOKIE] ??
      (req.body as { refreshToken?: string } | undefined)?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token present');
    }
    const tokens = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(res, tokens);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };""",
    "api: refresh accepts a body token when the cookie is blocked",
)

# Return the refresh token on the auth entry points too.
for route in ("walletVerify", "verifyOtp"):
    edit(
        API / "src/auth/auth.controller.ts",
        f"""    this.setRefreshCookie(res, tokens);
    return {{ accessToken: tokens.accessToken }};
  }}

  @Post('email/magic-link')""" if route == "verifyOtp" else
        """    this.setRefreshCookie(res, tokens);
    return { accessToken: tokens.accessToken };
  }

  @Post('email/otp')""",
        f"""    this.setRefreshCookie(res, tokens);
    return {{
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    }};
  }}

  @Post('{'email/magic-link' if route == 'verifyOtp' else 'email/otp'}')""",
        f"api: {route} returns refreshToken",
    )

# ── 3. Remove the engineering banner from the user-facing feed ───────────
feed = CONSOLE / "components/OpportunityFeed.tsx"
if feed.exists():
    t = feed.read_text(encoding="utf-8")
    start = t.find('      {data?.embeddingProvider === "local" && (')
    if start != -1:
        end = t.find("      )}", start)
        if end != -1:
            t = t[:start] + t[end + len("      )}\n"):]
            feed.write_text(t, encoding="utf-8")
            applied.append("console: removed embedder banner from the user feed")
        else:
            missing.append("console: couldn't find the end of the embedder banner")
    else:
        skipped.append("console: embedder banner already removed")

# ── 4. Distinct header surface ───────────────────────────────────────────
layout = CONSOLE / "app/console/layout.tsx"
if layout.exists():
    layout.write_text(
        '''import AuthGate from "@/components/AuthGate";
import ConsoleNav from "@/components/ConsoleNav";

/**
 * Console shell.
 *
 * The header sits on its own surface — slightly lifted, with a hairline
 * beneath — so the navigation chrome reads as a distinct layer from the
 * working area below it. Previously both shared the same background and the
 * boundary was carried entirely by a single border, which made the page feel
 * like one undifferentiated sheet.
 */
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-ink">
        <header className="sticky top-0 z-30 border-b border-line/25 bg-ink-2/85 backdrop-blur-md">
          <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
            <ConsoleNav />
          </div>
        </header>

        <main className="bp-grid min-h-[calc(100vh-var(--console-header,120px))]">
          <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </AuthGate>
  );
}
''',
        encoding="utf-8",
    )
    applied.append("console: header on a distinct, sticky surface")

print("\n\033[1mBuilderOS patch v12\033[0m\n")
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
  cd apps/api && npx tsc --noEmit
  cd ../console && npx tsc --noEmit
  git add -A && git commit -m "Fix session persistence; make agents launchable" && git push

  Then test: sign in, reload the page. You should stay signed in.
""")
sys.exit(1 if missing else 0)
