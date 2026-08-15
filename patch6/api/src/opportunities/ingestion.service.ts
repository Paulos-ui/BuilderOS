import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { GitcoinSource } from './sources/gitcoin.source';
import { DevpostSource } from './sources/devpost.source';
import { GoatSource } from './sources/goat.source';
import type {
  NormalizedOpportunity,
  SourceAdapter,
} from './sources/source.types';

export interface SourceResult {
  source: string;
  status: 'ok' | 'failed';
  fetched: number;
  created: number;
  updated: number;
  error?: string;
}

export interface IngestReport {
  startedAt: string;
  finishedAt: string;
  embeddingProvider: string;
  results: SourceResult[];
  totalOpen: number;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly sources: SourceAdapter[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
    gitcoin: GitcoinSource,
    devpost: DevpostSource,
    goat: GoatSource,
  ) {
    this.sources = [gitcoin, devpost, goat];
  }

  /**
   * Runs every source.
   *
   * Sources are isolated: one throwing does not abort the run, and its
   * failure is reported rather than swallowed. A feed that silently drops a
   * source looks identical to one where that source had no results, and
   * those are very different situations to debug.
   */
  async ingestAll(): Promise<IngestReport> {
    const startedAt = new Date();
    const results: SourceResult[] = [];

    for (const source of this.sources) {
      try {
        const items = await source.fetch();
        const { created, updated } = await this.persist(items);
        results.push({
          source: source.name,
          status: 'ok',
          fetched: items.length,
          created,
          updated,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Source ${source.name} failed: ${message}`);
        results.push({
          source: source.name,
          status: 'failed',
          fetched: 0,
          created: 0,
          updated: 0,
          error: message,
        });
      }
    }

    await this.markExpired();

    const totalOpen = await this.prisma.opportunity.count({
      where: { status: 'OPEN' },
    });

    return {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      embeddingProvider: this.embeddings.provider,
      results,
      totalOpen,
    };
  }

  private async persist(items: NormalizedOpportunity[]) {
    let created = 0;
    let updated = 0;

    for (const item of items) {
      // sourceUrl is the natural key: the same listing re-fetched tomorrow
      // must update in place rather than duplicate down the feed.
      const existing = await this.prisma.opportunity.findFirst({
        where: { sourceUrl: item.sourceUrl, title: item.title },
        select: { id: true },
      });

      const data = {
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        title: item.title,
        description: item.description,
        category: item.category,
        chains: item.chains,
        fundingMin: item.fundingMin,
        fundingMax: item.fundingMax,
        deadline: item.deadline,
        eligibility: item.eligibility as object,
        lastVerifiedAt: new Date(),
        status: 'OPEN' as const,
      };

      const record = existing
        ? await this.prisma.opportunity.update({
            where: { id: existing.id },
            data,
          })
        : await this.prisma.opportunity.create({ data });

      existing ? updated++ : created++;

      await this.writeEmbedding(
        record.id,
        `${item.title}\n\n${item.description}\n\nChains: ${item.chains.join(', ')}`,
      );
    }

    return { created, updated };
  }

  /**
   * Embeddings go in via raw SQL — Prisma has no typed representation for
   * pgvector columns, so this is the supported path rather than a hack.
   */
  private async writeEmbedding(id: string, text: string) {
    const vector = await this.embeddings.embed(text);
    const literal = EmbeddingsService.toSqlVector(vector);
    await this.prisma.$executeRawUnsafe(
      `UPDATE opportunities SET embedding = $1::vector WHERE id = $2::uuid`,
      literal,
      id,
    );
  }

  /** Anything past its deadline stops being an opportunity. */
  private async markExpired() {
    await this.prisma.opportunity.updateMany({
      where: { deadline: { lt: new Date() }, status: 'OPEN' },
      data: { status: 'CLOSED' },
    });
  }
}
