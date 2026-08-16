#!/usr/bin/env python3
"""
BuilderOS patch v10 — ingestion fixes.

Three problems the production run surfaced:

  1. `operator does not exist: text = uuid`
     The embedding UPDATE cast `id` to ::uuid, but Prisma's
     `String @id @default(uuid())` creates a TEXT column. The cast was always
     wrong; it just needed a real database to prove it.

  2. One bad embedding killed an entire source.
     The write threw inside the persist loop, so a single failure discarded
     every remaining opportunity from that source. Embeddings are an
     enhancement to ranking, not a precondition for a row being useful, so
     they must not be able to abort ingestion.

  3. "fetch failed" told us nothing.
     Network errors now report the URL and the underlying cause, so a dead
     endpoint is distinguishable from a blocked one.

Run from your project root:  python3 patch10/apply.py
"""
import pathlib
import sys

ROOT = pathlib.Path(".").resolve()
API = ROOT / "apps/api"

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

ingestion = API / "src/opportunities/ingestion.service.ts"

# ── 1. THE BUG: drop the ::uuid cast ─────────────────────────────────────
edit(
    ingestion,
    """  private async writeEmbedding(id: string, text: string) {
    const vector = await this.embeddings.embed(text);
    const literal = EmbeddingsService.toSqlVector(vector);
    await this.prisma.$executeRawUnsafe(
      `UPDATE opportunities SET embedding = $1::vector WHERE id = $2::uuid`,
      literal,
      id,
    );
  }""",
    """  private async writeEmbedding(id: string, text: string): Promise<boolean> {
    try {
      const vector = await this.embeddings.embed(text);
      const literal = EmbeddingsService.toSqlVector(vector);
      // NOTE: `id` is TEXT, not Postgres's native uuid type — Prisma's
      // `String @id @default(uuid())` generates the value in the client and
      // stores it as text. Casting to ::uuid here produced
      // `operator does not exist: text = uuid` against a real database.
      await this.prisma.$executeRawUnsafe(
        `UPDATE opportunities SET embedding = $1::vector WHERE id = $2`,
        literal,
        id,
      );
      return true;
    } catch (err) {
      // An opportunity without an embedding still belongs in the feed — it
      // just falls back to deadline ordering. Losing the row entirely would
      // be a far worse outcome than losing its vector.
      this.logger.warn(
        `Embedding write failed for ${id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }""",
    "api: fix uuid cast + make embedding writes non-fatal",
)

# ── 2. Persist loop survives individual item failures ────────────────────
edit(
    ingestion,
    """  private async persist(items: NormalizedOpportunity[]) {
    let created = 0;
    let updated = 0;

    for (const item of items) {""",
    """  private async persist(items: NormalizedOpportunity[]) {
    let created = 0;
    let updated = 0;
    let embedded = 0;
    let itemErrors = 0;

    for (const item of items) {
      try {""",
    "api: open per-item try",
)

edit(
    ingestion,
    """      existing ? updated++ : created++;

      await this.writeEmbedding(
        record.id,
        `${item.title}\\n\\n${item.description}\\n\\nChains: ${item.chains.join(', ')}`,
      );
    }

    return { created, updated };
  }""",
    """        existing ? updated++ : created++;

        const ok = await this.writeEmbedding(
          record.id,
          `${item.title}\\n\\n${item.description}\\n\\nChains: ${item.chains.join(', ')}`,
        );
        if (ok) embedded++;
      } catch (err) {
        // One malformed listing must not discard the rest of the batch.
        itemErrors++;
        this.logger.warn(
          `Skipped "${item.title}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return { created, updated, embedded, itemErrors };
  }""",
    "api: per-item isolation in persist loop",
)

# Indent the body of the loop to sit inside the new try block.
t = ingestion.read_text(encoding="utf-8") if ingestion.exists() else ""
marker = "      // sourceUrl is the natural key"
if marker in t and "        // sourceUrl is the natural key" not in t:
    start = t.find(marker)
    end = t.find("        existing ? updated++ : created++;", start)
    if end != -1:
        block = t[start:end]
        indented = "\n".join(
            ("  " + line if line.strip() else line) for line in block.split("\n")
        )
        t = t[:start] + indented + t[end:]
        ingestion.write_text(t, encoding="utf-8")
        applied.append("api: reindented persist body into try block")
    else:
        missing.append("api: could not locate persist loop body to reindent")
else:
    skipped.append("api: persist body indentation")

# ── 3. Report embedding coverage in the ingest response ──────────────────
edit(
    ingestion,
    """export interface SourceResult {
  source: string;
  status: 'ok' | 'failed';
  fetched: number;
  created: number;
  updated: number;
  error?: string;
}""",
    """export interface SourceResult {
  source: string;
  status: 'ok' | 'partial' | 'failed';
  fetched: number;
  created: number;
  updated: number;
  /** How many rows got a vector — the rest fall back to deadline ordering. */
  embedded?: number;
  /** Individual listings skipped without aborting the source. */
  skipped?: number;
  error?: string;
}""",
    "api: richer SourceResult",
)

edit(
    ingestion,
    """        const items = await source.fetch();
        const { created, updated } = await this.persist(items);
        results.push({
          source: source.name,
          status: 'ok',
          fetched: items.length,
          created,
          updated,
        });""",
    """        const items = await source.fetch();
        const { created, updated, embedded, itemErrors } =
          await this.persist(items);
        results.push({
          source: source.name,
          status: itemErrors > 0 ? 'partial' : 'ok',
          fetched: items.length,
          created,
          updated,
          embedded,
          skipped: itemErrors,
        });""",
    "api: report partial success",
)

# ── 4. Useful network errors ─────────────────────────────────────────────
edit(
    API / "src/opportunities/sources/source.types.ts",
    """  } finally {
    clearTimeout(timer);
  }
}""",
    """  } catch (err) {
    // Node's bare "fetch failed" hides whether this was DNS, a timeout, TLS,
    // or a refused connection — all of which need different fixes.
    const cause =
      (err as { cause?: { code?: string; message?: string } })?.cause;
    const detail = cause?.code ?? cause?.message;
    if ((err as Error)?.name === 'AbortError') {
      throw new Error(`${url} timed out after ${timeoutMs}ms`);
    }
    throw new Error(
      `${url} unreachable${detail ? ` (${detail})` : ''}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  } finally {
    clearTimeout(timer);
  }
}""",
    "api: actionable fetch errors",
)

print("\n\033[1mBuilderOS patch v10 — ingestion fixes\033[0m\n")
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
  cd apps/api && npx tsc --noEmit
  git add -A && git commit -m "Fix ingestion uuid cast and error isolation" && git push

  Wait for Render to redeploy, then:
    curl -X POST "https://builderos-api.onrender.com/v1/opportunities/ingest?secret=YOUR_SECRET"

  Expect devpost and goat to succeed now. Gitcoin will report a specific
  network error instead of bare "fetch failed" — send me what it says.
""")
sys.exit(1 if missing else 0)
