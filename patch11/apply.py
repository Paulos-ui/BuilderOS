#!/usr/bin/env python3
"""
BuilderOS patch v11 — console premium pass.

  - Agent cards are clickable and open a full specification drawer
  - A workflow rail beside the grid, so the rack reads as an ordered system
  - Derived builder identicons instead of a generic avatar picker
  - Identicon in the console header and on the profile page

Run from your project root:  python3 patch11/apply.py
"""
import pathlib, shutil, sys

ROOT = pathlib.Path(".").resolve()
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

if not CONSOLE.exists():
    print("✗ Run from your builderos project root (the folder with apps/).")
    sys.exit(1)

for src in (HERE / "console").rglob("*.ts*"):
    target = CONSOLE / src.relative_to(HERE / "console")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, target)
    applied.append(f"console: {src.relative_to(HERE / 'console')}")

# Identity mark in the header, beside the session readout.
edit(
    CONSOLE / "components/ConsoleNav.tsx",
    'import { BuilderOsLogo } from "./BuilderOsLogo";',
    'import { BuilderOsLogo } from "./BuilderOsLogo";\nimport BuilderIdenticon from "./BuilderIdenticon";',
    "console: nav imports identicon",
)
edit(
    CONSOLE / "components/ConsoleNav.tsx",
    '''          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-signal"
            />''',
    '''          <div className="flex items-center gap-3 font-mono text-[11px]">
            <BuilderIdenticon
              seed={profile?.user?.walletAddress ?? profile?.id}
              size={26}
            />
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-signal"
            />''',
    "console: identicon in the header",
)

print("\n\033[1mBuilderOS patch v11 — console premium pass\033[0m\n")
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
  cd apps/console && npx tsc --noEmit && npm run dev -- --port 3001
  Click any agent card -> specification drawer. Escape closes it.
""")
sys.exit(1 if missing else 0)
