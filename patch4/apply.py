#!/usr/bin/env python3
"""
BuilderOS patch v4 — sign-in for the console.

Adds email magic-link and wallet (SIWE) sign-in, a session-restoring auth
context, a protected console route, and the cross-origin cookie fix the
Vercel -> Render split requires.

Run from your project root:  python3 patch4/apply.py
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

if not API.exists() or not CONSOLE.exists():
    print("✗ Run from your builderos project root (the folder with apps/)."); sys.exit(1)

# 1. Copy console files
for src in (HERE / "console").rglob("*.ts*"):
    rel = src.relative_to(HERE / "console")
    dst = CONSOLE / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, dst)
    applied.append(f"console: {rel}")

# 2. Wrap the app in AuthProvider
edit(CONSOLE / "app/layout.tsx",
  'import "./globals.css";',
  'import "./globals.css";\nimport { AuthProvider } from "@/lib/auth-context";',
  "console: import AuthProvider")
edit(CONSOLE / "app/layout.tsx",
  '<body className="bg-ink text-paper antialiased">{children}</body>',
  '<body className="bg-ink text-paper antialiased">\n        <AuthProvider>{children}</AuthProvider>\n      </body>',
  "console: wrap app in AuthProvider")

# 3. Console route protection is handled by app/console/layout.tsx, which was
#    copied in step 1. No surgery on your existing page.tsx is needed.

# 4. Cross-origin cookie fix
edit(API / "src/auth/auth.controller.ts",
  """    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',""",
  """    // The app (Vercel) and the API (Render) are different sites, so a
    // 'lax' cookie would simply never be sent on the refresh call and every
    // session would silently die on reload. 'none' is required for
    // cross-site delivery, and browsers only accept it alongside Secure —
    // which is why this pairs with HTTPS in production. Once both run on
    // one domain (app + api.builderos.dev), move back to 'lax'.
    const isProd = this.config.get('NODE_ENV') === 'production';
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',""",
  "api: cross-site refresh cookie (Vercel -> Render)")

print("\n\033[1mBuilderOS patch v4 — sign-in\033[0m\n")
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
  1. cd apps/console && echo 'NEXT_PUBLIC_API_URL=http://localhost:4000' > .env.local
  2. npm run dev -- --port 3001
  3. Visit http://localhost:3001/console  -> should redirect to /signin
  4. Enter your email, then copy the magic link from the API's terminal
""")
sys.exit(1 if missing else 0)
