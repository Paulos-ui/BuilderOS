#!/usr/bin/env python3
"""
BuilderOS patch v13b — remove the dead magic-link code path.

The DTO files were deleted, but auth.controller.ts still imports them and
still exposes two magic-link routes. This finishes the removal.

Goes:
  - RequestMagicLinkDto / VerifyMagicLinkDto imports
  - POST /v1/auth/email/magic-link
  - POST /v1/auth/email/verify-link
  - AuthService.requestMagicLink / verifyMagicLink

Stays:
  - findOrCreateUserByEmail — startEmailSession (the OTP path) needs it
  - the MagicLinkToken Prisma model. Dropping a table is a migration with
    real consequences; an unused table costs nothing.

Members are removed by whole lines at a fixed indent, terminating at the
first line that is exactly '  }'. An earlier draft scanned for matching
braces from an offset found by searching for the method name — which located
the name inside the body and silently ate the wrong region. Line-based
boundaries cannot do that.

Run from your project root:  python3 patch13b/apply.py
"""
import pathlib, re, sys

ROOT = pathlib.Path(".").resolve()
CTRL = ROOT / "apps/api/src/auth/auth.controller.ts"
SVC = ROOT / "apps/api/src/auth/auth.service.ts"

if not CTRL.exists():
    print(f"✗ Not found: {CTRL}\n  Run from your builderos project root.")
    sys.exit(1)

removed = []


def remove_member(source: str, anchor_re: str):
    lines = source.split("\n")
    pattern = re.compile(anchor_re)

    start = None
    for i, line in enumerate(lines):
        if pattern.search(line):
            start = i
            break
    if start is None:
        return source, False

    # Absorb decorators and comments directly above the member.
    while start > 0:
        prev = lines[start - 1].strip()
        if prev.startswith(("@", "//", "*", "/**")):
            start -= 1
        else:
            break

    end = None
    for j in range(start, len(lines)):
        if lines[j] == "  }":
            end = j
            break
    if end is None:
        return source, False

    if end + 1 < len(lines) and lines[end + 1].strip() == "":
        end += 1

    return "\n".join(lines[:start] + lines[end + 1:]), True


text = CTRL.read_text(encoding="utf-8")

for name in ["RequestMagicLinkDto", "VerifyMagicLinkDto"]:
    pattern = re.compile(rf"^import \{{ {name} \}}.*\n", re.MULTILINE)
    if pattern.search(text):
        text = pattern.sub("", text, count=1)
        removed.append(f"controller import: {name}")

for label, anchor in [
    ("POST email/magic-link", r"^\s*requestMagicLink\("),
    ("POST email/verify-link", r"^\s*async verifyMagicLink\("),
]:
    text, ok = remove_member(text, anchor)
    if ok:
        removed.append(f"route: {label}")

text = re.sub(r"\n{3,}", "\n\n", text)
CTRL.write_text(text, encoding="utf-8")

if SVC.exists():
    svc = SVC.read_text(encoding="utf-8")
    for name in ["requestMagicLink", "verifyMagicLink"]:
        svc, ok = remove_member(svc, rf"^\s*async {name}\(")
        if ok:
            removed.append(f"service method: {name}")
    svc = re.sub(r"\n{3,}", "\n\n", svc)
    SVC.write_text(svc, encoding="utf-8")

print("\n\033[1mBuilderOS patch v13b — magic-link cleanup\033[0m\n")
if removed:
    print(f"\033[32m✓ removed ({len(removed)})\033[0m")
    for r in removed:
        print(f"    {r}")
else:
    print("\033[33m• nothing to remove — already clean\033[0m")

print("""
NEXT
  cd apps/api && npx tsc --noEmit

  tsc may now flag `randomUUID` as unused in auth.service.ts — it was only
  used by requestMagicLink. Trim the crypto import:

      import { randomBytes, randomUUID } from 'crypto';
   -> import { randomBytes } from 'crypto';

  Then:
  cd ../console && npx tsc --noEmit
  git add -A && git commit -m "Remove magic-link path; ProofForge live" && git push
""")
