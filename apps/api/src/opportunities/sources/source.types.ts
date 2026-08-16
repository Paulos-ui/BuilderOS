/**
 * Source adapters for BuilderScout ingestion.
 *
 * Each adapter is responsible for exactly one thing: turning a remote source
 * into `NormalizedOpportunity[]`. They never touch the database, never
 * embed, and never rank — that keeps them individually testable and means a
 * broken source can be swapped without touching the pipeline.
 *
 * A note on honesty in sourcing: every record carries `sourceUrl` pointing
 * at the real listing, and `lastVerifiedAt` set to when we actually fetched
 * it. We never synthesise an opportunity that does not exist upstream, and
 * we never present a stale record as freshly verified. If a source is
 * unreachable, ingestion for that source fails visibly rather than emitting
 * plausible-looking filler.
 */

export type OpportunityCategory =
  | 'GRANT'
  | 'HACKATHON'
  | 'BOUNTY'
  | 'ACCELERATOR'
  | 'ECOSYSTEM_FUND';

export interface NormalizedOpportunity {
  sourceName: string;
  sourceUrl: string;
  title: string;
  description: string;
  category: OpportunityCategory;
  chains: string[];
  fundingMin: number | null;
  fundingMax: number | null;
  deadline: Date | null;
  eligibility: Record<string, unknown>;
}

export interface SourceAdapter {
  readonly name: string;
  /** Human-readable description of what this source covers. */
  readonly description: string;
  fetch(): Promise<NormalizedOpportunity[]>;
}

/** Shared fetch with a timeout — a hung source must not hang the whole run. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BuilderOS-Scout/0.1 (+https://builderos1.vercel.app)',
        ...init.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`${url} responded ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
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
}

/** Strips HTML and collapses whitespace from source-provided descriptions. */
export function cleanText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Best-effort chain extraction from free text, for the structured filter. */
const CHAIN_PATTERNS: Array<[string, RegExp]> = [
  ['goat', /\bgoat\s*network\b|\bgoat\b/i],
  ['bitcoin', /\bbitcoin\b|\bbtc\b/i],
  ['ethereum', /\bethereum\b|\beth\b|\bevm\b/i],
  ['base', /\bbase\s*(chain|network|ecosystem)?\b/i],
  ['optimism', /\boptimism\b|\bop\s*stack\b/i],
  ['arbitrum', /\barbitrum\b/i],
  ['solana', /\bsolana\b|\bsvm\b/i],
  ['polygon', /\bpolygon\b|\bmatic\b/i],
];

export function inferChains(text: string): string[] {
  const found = new Set<string>();
  for (const [chain, pattern] of CHAIN_PATTERNS) {
    if (pattern.test(text)) found.add(chain);
  }
  return [...found];
}
