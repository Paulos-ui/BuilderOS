#!/usr/bin/env bash
# BuilderOS homepage patch — run from your project root (the folder with apps/).
set -euo pipefail

if [ ! -d "apps/landing" ]; then
  echo "✗ Run this from your builderos project root (the folder containing apps/)."
  exit 1
fi

PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ Backing up files this patch will modify…"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="apps/landing/.patch-backup-$STAMP"
mkdir -p "$BACKUP/components" "$BACKUP/app"
for f in components/Hero.tsx components/AboutDocs.tsx components/ReputationSection.tsx \
         app/globals.css app/page.tsx app/layout.tsx data/agents.ts; do
  [ -f "apps/landing/$f" ] && { mkdir -p "$BACKUP/$(dirname "$f")"; cp "apps/landing/$f" "$BACKUP/$f"; }
done
echo "  saved to $BACKUP"

echo "→ Adding new components…"
cp "$PATCH_DIR/SiteNav.tsx" "$PATCH_DIR/BuilderOsLogo.tsx" "$PATCH_DIR/TechnicalEdges.tsx" \
   apps/landing/components/

echo "→ Applying edits…"
python3 "$PATCH_DIR/apply-homepage-patch.py" apps/landing

echo "→ Verifying…"
cd apps/landing
npx tsc --noEmit && echo "  ✓ typecheck clean"
npx eslint app components data --max-warnings=0 && echo "  ✓ lint clean"

echo
echo "Done. Start the dev server:  cd apps/landing && npm run dev"
