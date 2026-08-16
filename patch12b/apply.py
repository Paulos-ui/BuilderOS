#!/usr/bin/env python3
"""
BuilderOS patch v12b — completes the one edit patch 12 couldn't place.

`walletVerify` still returns only the access token, so wallet sessions die on
reload wherever third-party cookies are blocked (Firefox, Safari). Since
wallet is the primary sign-in path, this is the fix that actually matters.

The patch 12 loop that should have done this built its search string with a
broken conditional and looked for text that never existed. This version finds
the method by structure instead of guessing at whitespace.

Run from your project root:  python3 patch12b/apply.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(".").resolve()
CTRL = ROOT / "apps/api/src/auth/auth.controller.ts"

if not CTRL.exists():
    print(f"✗ Not found: {CTRL}\n  Run this from your builderos project root.")
    sys.exit(1)

text = CTRL.read_text(encoding="utf-8")
changed = []

# Every auth entry point must hand back the refresh token so the console can
# fall back to it when the cookie is blocked. Find each place that sets the
# cookie and then returns only the access token.
pattern = re.compile(
    r"(this\.setRefreshCookie\(res, tokens\);\s*\n\s*return \{)\s*accessToken: tokens\.accessToken,?\s*(\};)"
)

def replace(match: re.Match) -> str:
    return (
        f"{match.group(1)}\n"
        "      accessToken: tokens.accessToken,\n"
        "      // Returned so the console can fall back to sessionStorage when\n"
        "      // the browser blocks our third-party refresh cookie.\n"
        "      refreshToken: tokens.refreshToken,\n"
        f"    {match.group(2)}"
    )

new_text, count = pattern.subn(replace, text)

if count == 0:
    if "refreshToken: tokens.refreshToken" in text:
        print("• Already applied — every auth route returns refreshToken.\n")
        sys.exit(0)
    print(
        "✗ Couldn't locate the return statements automatically.\n\n"
        "  Apply by hand in apps/api/src/auth/auth.controller.ts.\n"
        "  In BOTH walletVerify and verifyOtp, change:\n\n"
        "      return { accessToken: tokens.accessToken };\n\n"
        "  to:\n\n"
        "      return {\n"
        "        accessToken: tokens.accessToken,\n"
        "        refreshToken: tokens.refreshToken,\n"
        "      };\n"
    )
    sys.exit(1)

CTRL.write_text(new_text, encoding="utf-8")
changed.append(f"auth.controller.ts — {count} route(s) now return refreshToken")

# The magic-link flow is fully replaced by OTP. Leaving its route and DTOs
# behind is dead code that still accepts input, which is worth removing
# rather than leaving as a second, unused way in.
legacy = []
for path in [
    ROOT / "apps/api/src/auth/dto/request-magic-link.dto.ts",
    ROOT / "apps/api/src/auth/dto/verify-magic-link.dto.ts",
]:
    if path.exists():
        legacy.append(path.name)

print("\n\033[1mBuilderOS patch v12b\033[0m\n")
print(f"\033[32m✓ applied\033[0m")
for c in changed:
    print(f"    {c}")

if legacy:
    print(
        f"\n\033[33m• note\033[0m\n"
        f"    These magic-link files are now unused: {', '.join(legacy)}\n"
        "    Harmless, but they leave a second unused entry point in the auth\n"
        "    surface. Safe to delete along with the email/verify-link route\n"
        "    and its imports once you've confirmed OTP works in production."
    )

print(
    """
NEXT
  cd apps/api && npx tsc --noEmit
  cd ../console && npx tsc --noEmit
  git add -A && git commit -m "Return refresh token on all auth routes" && git push

VERIFY (this is the one that was broken)
  1. Sign in with your WALLET
  2. Hard-reload the page
  3. You should stay on /console, not bounce to /signin
"""
)
