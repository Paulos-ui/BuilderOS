import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';

export interface FeedQuery {
  builderProfileId: string;
  category?: string;
  chain?: string;
  limit?: number;
}

export interface FeedItem {
  id: string;
  title: string;
  description: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  chains: string[];
  fundingMin: number | null;
  fundingMax: number | null;
  deadline: string | null;
  daysLeft: number | null;
  lastVerifiedAt: string;
  matchScore: number;
  matchReasons: string[];
  curated: boolean;
}

export interface FeedResponse {
  items: FeedItem[];
  total: number;
  embeddingProvider: string;
  /** True when the builder has no profile signal yet, so ranking is generic. */
  coldStart: boolean;
  note: string;
}

interface FeedRow {
  id: string;
  title: string;
  description: string;
  category: string;
  source_name: string;
  source_url: string;
  chains: string[];
  funding_min: string | null;
  funding_max: string | null;
  deadline: Date | null;
  last_verified_at: Date;
  eligibility: Record<string, unknown> | null;
  similarity: number | null;
}

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async getFeed(query: FeedQuery): Promise<FeedResponse> {
    const limit = Math.min(query.limit ?? 25, 50);

    const profile = await this.prisma.builderProfile.findUnique({
      where: { id: query.builderProfileId },
      select: { chains: true, languages: true, bio: true, githubUsername: true },
    });

    const profileChains = (profile?.chains as string[] | null) ?? [];
    const profileLanguages = (profile?.languages as string[] | null) ?? [];
    const profileText = [
      profile?.bio ?? '',
      profileChains.join(' '),
      profileLanguages.join(' '),
    ]
      .join(' ')
      .trim();

    // With no profile signal, a similarity score would be noise dressed up
    // as personalisation. We say so and fall back to deadline ordering.
    const coldStart = profileText.length < 10;

    const rows = coldStart
      ? await this.queryWithoutSimilarity(query, limit)
      : await this.queryWithSimilarity(query, limit, profileText);

    const items = rows.map((row) =>
      this.toItem(row, profileChains, coldStart),
    );

    return {
      items,
      total: items.length,
      embeddingProvider: this.embeddings.provider,
      coldStart,
      note: coldStart
        ? 'Ranked by deadline. Add chains and a bio to your profile for personalised matching.'
        : 'Ranked by relevance to your builder profile, filtered to open opportunities.',
    };
  }

  /**
   * The hybrid query — the core of BuilderScout's retrieval.
   *
   * Vector similarity and structured predicates run in ONE statement, not as
   * a vector search post-filtered in application code. That ordering matters:
   * filtering after a top-k vector search silently drops eligible results
   * whenever the k nearest happen to be ineligible. Here Postgres applies
   * the WHERE clause first and ranks only what actually qualifies.
   *
   * Pure vector search is also wrong on its own for this domain — a Solana
   * hackathon reads as highly similar to a Base builder's profile because
   * the prose is nearly identical. The chain predicate is what stops that,
   * and it is not optional.
   */
  private async queryWithSimilarity(
    query: FeedQuery,
    limit: number,
    profileText: string,
  ): Promise<FeedRow[]> {
    const vector = await this.embeddings.embed(profileText);
    const literal = EmbeddingsService.toSqlVector(vector);

    return this.prisma.$queryRawUnsafe<FeedRow[]>(
      `
      SELECT
        id, title, description, category,
        source_name, source_url, chains,
        funding_min, funding_max, deadline,
        last_verified_at, eligibility,
        1 - (embedding <=> $1::vector) AS similarity
      FROM opportunities
      WHERE status = 'OPEN'
        AND embedding IS NOT NULL
        AND (deadline IS NULL OR deadline > NOW())
        AND ($2::text IS NULL OR category = $2::"OpportunityCategory")
        AND ($3::text IS NULL OR chains ? $3::text)
      ORDER BY
        -- Deadline proximity breaks ties among similar matches, so a
        -- closing opportunity outranks an equally relevant open-ended one.
        (1 - (embedding <=> $1::vector)) DESC,
        deadline ASC NULLS LAST
      LIMIT $4
      `,
      literal,
      query.category ?? null,
      query.chain ?? null,
      limit,
    );
  }

  private async queryWithoutSimilarity(
    query: FeedQuery,
    limit: number,
  ): Promise<FeedRow[]> {
    return this.prisma.$queryRawUnsafe<FeedRow[]>(
      `
      SELECT
        id, title, description, category,
        source_name, source_url, chains,
        funding_min, funding_max, deadline,
        last_verified_at, eligibility,
        NULL::float AS similarity
      FROM opportunities
      WHERE status = 'OPEN'
        AND (deadline IS NULL OR deadline > NOW())
        AND ($1::text IS NULL OR category = $1::"OpportunityCategory")
        AND ($2::text IS NULL OR chains ? $2::text)
      ORDER BY deadline ASC NULLS LAST, last_verified_at DESC
      LIMIT $3
      `,
      query.category ?? null,
      query.chain ?? null,
      limit,
    );
  }

  private toItem(
    row: FeedRow,
    profileChains: string[],
    coldStart: boolean,
  ): FeedItem {
    const daysLeft = row.deadline
      ? Math.max(
          0,
          Math.ceil(
            (new Date(row.deadline).getTime() - Date.now()) / 86_400_000,
          ),
        )
      : null;

    const chains = Array.isArray(row.chains) ? row.chains : [];
    const overlap = chains.filter((c) => profileChains.includes(c));

    const reasons: string[] = [];
    if (overlap.length) {
      reasons.push(`Matches your ${overlap.join(' and ')} experience`);
    }
    if (daysLeft !== null && daysLeft <= 14) {
      reasons.push(`Closes in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`);
    }
    if (row.funding_max) {
      reasons.push(
        `Up to $${Number(row.funding_max).toLocaleString()} available`,
      );
    }
    if (!reasons.length) {
      reasons.push('Open to new applicants');
    }

    // Similarity is cosine in [0,1]; presenting it as a percentage is fine,
    // but only when it was actually computed. Cold start returns 0 and the
    // UI is told not to render a score rather than invent one.
    const matchScore =
      coldStart || row.similarity === null
        ? 0
        : Math.round(Math.max(0, Math.min(1, row.similarity)) * 100);

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      chains,
      fundingMin: row.funding_min ? Number(row.funding_min) : null,
      fundingMax: row.funding_max ? Number(row.funding_max) : null,
      deadline: row.deadline ? new Date(row.deadline).toISOString() : null,
      daysLeft,
      lastVerifiedAt: new Date(row.last_verified_at).toISOString(),
      matchScore,
      matchReasons: reasons,
      curated: Boolean(
        (row.eligibility as { curated?: boolean } | null)?.curated,
      ),
    };
  }
}
