import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { ProfilesService } from '../profiles/profiles.service';

/**
 * ── Why this is not a similarity search ───────────────────────────────────
 *
 * The obvious implementation is cosine distance over profile vectors, return
 * the nearest neighbours. That is the wrong tool for this job, and it fails in
 * a way that looks like it is working.
 *
 * Nearest-neighbour search finds the builders most like you. A Solidity
 * builder gets shown five more Solidity builders. But nobody needs a
 * collaborator who duplicates them — they need someone who covers what they
 * do not. Pure similarity optimises for the least useful possible match while
 * producing a confident, plausible-looking list.
 *
 * So the score has three parts, pulling in different directions:
 *
 *   context overlap   shared chains. You have to be working in the same
 *                     ecosystem for a collaboration to be practical at all.
 *                     Wanted HIGH.
 *
 *   skill complement  languages they have that you do not. This is the actual
 *                     value they add. Wanted HIGH.
 *
 *   proximity band    cosine similarity, scored as a BAND rather than a
 *                     maximum. Too far apart means no common ground; too
 *                     close means you are the same builder twice. Peak value
 *                     sits in the middle.
 *
 * Every component is returned alongside the score. Blueprint 11.2 is explicit
 * that a single opaque number erodes trust fast, and that applies harder here
 * than to application scoring — a builder deciding whether to contact a
 * stranger deserves to see why they were surfaced.
 */

/** Weights sum to 1.0. Tuned by hand; see the band note on proximity. */
const W_CONTEXT = 0.4;
const W_COMPLEMENT = 0.35;
const W_PROXIMITY = 0.25;

/**
 * Where the proximity band peaks.
 *
 * Below FLOOR the two builders have nothing in common and a match would be
 * noise. Above CEILING they are effectively interchangeable. The score ramps
 * up to PEAK and decays after it.
 */
const PROXIMITY_FLOOR = 0.15;
const PROXIMITY_PEAK = 0.6;
const PROXIMITY_CEILING = 0.97;

/** A modest lift for builders with recorded shipped work, capped deliberately. */
const TRACK_RECORD_MAX_BONUS = 0.08;
const TRACK_RECORD_SATURATES_AT = 5;

/** Candidates pulled by vector before re-ranking. Filter wide, rank narrow. */
const CANDIDATE_POOL = 60;

export interface MatchReasons {
  /** Jaccard overlap of chains, 0-1. */
  contextOverlap: number;
  /** Share of their languages that you do not list, 0-1. */
  skillComplement: number;
  /** Raw cosine similarity, 0-1 — reported before banding. */
  proximity: number;
  /** Proximity after the band function, 0-1. */
  proximityScore: number;
  /** Contribution from recorded shipped work, 0-TRACK_RECORD_MAX_BONUS. */
  trackRecord: number;
  /** Chains you both work on. */
  sharedChains: string[];
  /** Languages they bring that you do not list. */
  bringsSkills: string[];
  /** Present only when the query was scoped to an opportunity. */
  opportunityFit: number | null;
}

export interface Collaborator {
  builderProfileId: string;
  githubUsername: string | null;
  chains: string[];
  languages: string[];
  bio: string | null;
  /** Composite 0-100. */
  score: number;
  /** One sentence, generated from whichever component dominated. */
  rationale: string;
  reasons: MatchReasons;
  provenWork: number;
}

export interface MatchResponse {
  collaborators: Collaborator[];
  /** True when we could not compute matches, with `note` saying why. */
  coldStart: boolean;
  /** Profiles that were eligible to be matched against. */
  poolSize: number;
  /** Which embedding provider produced the vectors — 'local' is not semantic. */
  embeddingProvider: string;
  /** Set when the query was scoped to an opportunity we could read. */
  scopedToOpportunity: string | null;
  note: string;
}

interface CandidateRow {
  id: string;
  github_username: string | null;
  chains: unknown;
  languages: unknown;
  bio: string | null;
  proximity: number;
  opportunity_fit: number | null;
}

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
    private readonly profiles: ProfilesService,
  ) {}

  async collaborators(
    builderProfileId: string,
    opts: { limit?: number; opportunityId?: string } = {},
  ): Promise<MatchResponse> {
    const limit = Math.min(Math.max(opts.limit ?? 8, 1), 25);
    const provider = this.embeddings.provider;

    const me = await this.prisma.builderProfile.findUnique({
      where: { id: builderProfileId },
      select: {
        chains: true,
        languages: true,
        bio: true,
        githubUsername: true,
      },
    });

    if (!me) {
      return this.empty(
        provider,
        'No builder profile found for this account.',
        0,
      );
    }

    const myChains = toStringList(me.chains);
    const myLanguages = toStringList(me.languages);
    const myText = ProfilesService.profileText(me);

    // A blank profile cannot be matched, and guessing would be worse than
    // saying so. This is the same cold-start honesty the opportunity feed
    // applies rather than ranking against an empty vector.
    if (myText.length < 10) {
      return this.empty(
        provider,
        'Add your chains, languages and a short bio — BuilderMatch needs something to match on before it can find collaborators.',
        0,
      );
    }

    // Reuse the stored vector where possible so the match is computed against
    // exactly what is in the column. Recomputing here would silently diverge
    // the moment profileText() changes.
    const myVector = await this.storedVector(builderProfileId, myText);
    const opportunityVector = opts.opportunityId
      ? await this.opportunityVector(opts.opportunityId)
      : null;

    let rows: CandidateRow[] = [];
    try {
      rows = await this.prisma.$queryRawUnsafe<CandidateRow[]>(
        `SELECT p.id,
                p.github_username,
                p.chains,
                p.languages,
                p.bio,
                1 - (p.embedding <=> $1::vector) AS proximity,
                CASE WHEN $4::text IS NULL THEN NULL
                     ELSE 1 - (p.embedding <=> $4::vector)
                END AS opportunity_fit
           FROM builder_profiles p
          WHERE p.id <> $2
            AND p.embedding IS NOT NULL
          ORDER BY p.embedding <=> $1::vector
          LIMIT $3`,
        myVector,
        builderProfileId,
        CANDIDATE_POOL,
        opportunityVector,
      );
    } catch (err) {
      this.logger.error(
        `Collaborator query failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return this.empty(
        provider,
        'Collaborator matching is temporarily unavailable.',
        0,
      );
    }

    if (rows.length === 0) {
      return this.empty(
        provider,
        'No other builders have completed a profile yet. BuilderMatch gets useful as the beta group grows.',
        0,
        opts.opportunityId && opportunityVector ? opts.opportunityId : null,
      );
    }

    const proven = await this.provenWorkCounts(rows.map((r) => r.id));

    const scored = rows
      .map((row) => this.score(row, myChains, myLanguages, proven))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      collaborators: scored,
      coldStart: false,
      poolSize: rows.length,
      embeddingProvider: provider,
      scopedToOpportunity:
        opts.opportunityId && opportunityVector ? opts.opportunityId : null,
      note:
        provider === 'local'
          ? 'Ranked on chain overlap and complementary skills. Semantic similarity is using the local fallback, which matches on wording rather than meaning — set VOYAGE_API_KEY for real semantic matching.'
          : 'Ranked on shared ecosystem, complementary skills and recorded work.',
    };
  }

  // ── scoring ──────────────────────────────────────────────────────────────

  private score(
    row: CandidateRow,
    myChains: string[],
    myLanguages: string[],
    proven: Map<string, number>,
  ): Collaborator {
    const theirChains = toStringList(row.chains);
    const theirLanguages = toStringList(row.languages);

    const sharedChains = theirChains.filter((c) => myChains.includes(c));
    const bringsSkills = theirLanguages.filter((l) => !myLanguages.includes(l));

    const contextOverlap = jaccard(myChains, theirChains);
    const skillComplement =
      theirLanguages.length === 0
        ? 0
        : bringsSkills.length / theirLanguages.length;

    const proximity = clamp01(Number(row.proximity) || 0);
    const proximityScore = band(proximity);

    const provenWork = proven.get(row.id) ?? 0;
    const trackRecord =
      (Math.min(provenWork, TRACK_RECORD_SATURATES_AT) /
        TRACK_RECORD_SATURATES_AT) *
      TRACK_RECORD_MAX_BONUS;

    const opportunityFit =
      row.opportunity_fit === null || row.opportunity_fit === undefined
        ? null
        : clamp01(Number(row.opportunity_fit));

    let composite =
      W_CONTEXT * contextOverlap +
      W_COMPLEMENT * skillComplement +
      W_PROXIMITY * proximityScore +
      trackRecord;

    // Scoping to an opportunity shifts the question from "who complements me"
    // to "who complements me on this". Blended rather than replacing the base
    // score, so a strong general match is not buried by a mediocre one that
    // happens to skew towards the posting's wording.
    if (opportunityFit !== null) {
      composite = composite * 0.75 + opportunityFit * 0.25;
    }

    return {
      builderProfileId: row.id,
      githubUsername: row.github_username,
      chains: theirChains,
      languages: theirLanguages,
      bio: row.bio,
      score: Math.round(clamp01(composite) * 100),
      rationale: rationale({
        sharedChains,
        bringsSkills,
        provenWork,
        contextOverlap,
        skillComplement,
      }),
      reasons: {
        contextOverlap: round3(contextOverlap),
        skillComplement: round3(skillComplement),
        proximity: round3(proximity),
        proximityScore: round3(proximityScore),
        trackRecord: round3(trackRecord),
        sharedChains,
        bringsSkills,
        opportunityFit: opportunityFit === null ? null : round3(opportunityFit),
      },
      provenWork,
    };
  }

  // ── data access ──────────────────────────────────────────────────────────

  /**
   * The caller's stored vector, as a pgvector literal.
   *
   * Falls back to embedding on the fly if the column is empty — which happens
   * for profiles saved before embeddings were written at all. Also repairs the
   * row in that case, so the gap closes itself rather than recurring on every
   * request.
   */
  private async storedVector(
    builderProfileId: string,
    text: string,
  ): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<
      { embedding: string | null }[]
    >(
      `SELECT embedding::text AS embedding FROM builder_profiles WHERE id = $1`,
      builderProfileId,
    );

    const stored = rows[0]?.embedding;
    if (stored) return stored;

    void this.profiles.refreshEmbedding(builderProfileId);
    return EmbeddingsService.toSqlVector(await this.embeddings.embed(text));
  }

  /** Null when the opportunity is unknown or has no embedding yet. */
  private async opportunityVector(
    opportunityId: string,
  ): Promise<string | null> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        { embedding: string | null }[]
      >(
        `SELECT embedding::text AS embedding FROM opportunities WHERE id = $1`,
        opportunityId,
      );
      return rows[0]?.embedding ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Recorded shipped work per candidate.
   *
   * Counts ProofRecord rows. These are self-asserted — ProofRecord.verified is
   * hardcoded false until on-chain anchoring lands — so this is weighted
   * lightly and the field is named `provenWork` rather than anything implying
   * the claim was checked. Overweighting it would reward whoever typed the
   * most.
   */
  private async provenWorkCounts(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    try {
      const grouped = await this.prisma.proofRecord.groupBy({
        by: ['builderProfileId'],
        where: { builderProfileId: { in: ids } },
        _count: { _all: true },
      });
      return new Map(
        grouped.map((g) => [g.builderProfileId, g._count._all] as const),
      );
    } catch (err) {
      this.logger.warn(
        `Proof record counts unavailable, scoring without them: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return new Map();
    }
  }

  private empty(
    embeddingProvider: string,
    note: string,
    poolSize: number,
    scopedToOpportunity: string | null = null,
  ): MatchResponse {
    return {
      collaborators: [],
      coldStart: true,
      poolSize,
      embeddingProvider,
      scopedToOpportunity,
      note,
    };
  }
}

// ── pure helpers, exported for the unit tests ──────────────────────────────

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const v of setA) if (setB.has(v)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Triangular band over cosine similarity.
 *
 * Rises from FLOOR to PEAK, then decays to CEILING. The decay is the whole
 * point: a builder who is a near-perfect vector match to you is a duplicate,
 * not a collaborator, and ranking them first is the failure mode a plain
 * nearest-neighbour search cannot avoid.
 */
export function band(similarity: number): number {
  if (similarity <= PROXIMITY_FLOOR) return 0;
  if (similarity >= PROXIMITY_CEILING) return 0;
  if (similarity <= PROXIMITY_PEAK) {
    return (similarity - PROXIMITY_FLOOR) / (PROXIMITY_PEAK - PROXIMITY_FLOOR);
  }
  return (PROXIMITY_CEILING - similarity) / (PROXIMITY_CEILING - PROXIMITY_PEAK);
}

function rationale(input: {
  sharedChains: string[];
  bringsSkills: string[];
  provenWork: number;
  contextOverlap: number;
  skillComplement: number;
}): string {
  const { sharedChains, bringsSkills, provenWork } = input;
  const parts: string[] = [];

  if (sharedChains.length > 0) {
    parts.push(`also builds on ${humanList(sharedChains)}`);
  }
  if (bringsSkills.length > 0) {
    parts.push(`brings ${humanList(bringsSkills.slice(0, 3))}`);
  }
  if (provenWork > 0) {
    parts.push(
      `${provenWork} piece${provenWork === 1 ? '' : 's'} of recorded work`,
    );
  }

  if (parts.length === 0) {
    // Reached when the only surviving signal was the proximity band. Saying
    // "similar profile" would overclaim, so this stays vague on purpose.
    return 'Adjacent profile — worth a look, but no shared chain or new skill to point at.';
  }

  return capitalise(parts.join(', ')) + '.';
}

function humanList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toStringList(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string')
    : [];
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(Math.max(v, 0), 1);
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
