import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Why the feed is empty — answered precisely rather than by guessing.
 *
 * "No opportunities" has several distinct causes that look identical in the
 * UI: nothing was ever ingested, everything was ingested but has since
 * closed, rows exist but have no embedding, or ingestion wrote to a
 * different database than the one the API reads. This reports which.
 */
@Controller('v1/opportunities')
export class DiagnosticsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('diagnostics')
  async diagnostics(@Query('secret') secret?: string) {
    const expected = this.config.get<string>('INGEST_SECRET');
    if (!expected || secret !== expected) {
      throw new ForbiddenException('Invalid or missing ingest secret.');
    }

    const [total, open, closed, withEmbedding, futureDeadline, noDeadline] =
      await Promise.all([
        this.prisma.opportunity.count(),
        this.prisma.opportunity.count({ where: { status: 'OPEN' } }),
        this.prisma.opportunity.count({ where: { status: 'CLOSED' } }),
        this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT COUNT(*)::bigint AS count FROM opportunities WHERE embedding IS NOT NULL`,
        ),
        this.prisma.opportunity.count({
          where: { status: 'OPEN', deadline: { gt: new Date() } },
        }),
        this.prisma.opportunity.count({
          where: { status: 'OPEN', deadline: null },
        }),
      ]);

    const bySource = await this.prisma.opportunity.groupBy({
      by: ['sourceName', 'status'],
      _count: true,
    });

    const embedded = Number(withEmbedding[0]?.count ?? 0);
    // This is what the feed query actually selects on.
    const visibleInFeed = futureDeadline + noDeadline;

    let verdict: string;
    if (total === 0) {
      verdict =
        'The table is empty. Ingestion has never run against THIS database — check that you ran it against the Render API, not localhost.';
    } else if (open === 0) {
      verdict =
        'Rows exist but all are CLOSED. Their deadlines have passed; re-run ingestion to pull current listings.';
    } else if (visibleInFeed === 0) {
      verdict =
        'Open rows exist but every one has a past deadline, so the feed filters them all out. Re-run ingestion.';
    } else if (embedded === 0) {
      verdict =
        'Rows are visible but none have embeddings, so personalised ranking will fall back to deadline order.';
    } else {
      verdict = `${visibleInFeed} opportunities should be visible in the feed.`;
    }

    return {
      database: this.maskedDatabaseHost(),
      counts: {
        total,
        open,
        closed,
        withEmbedding: embedded,
        visibleInFeed,
      },
      bySource: bySource.map((row) => ({
        source: row.sourceName,
        status: row.status,
        count: row._count,
      })),
      verdict,
      checkedAt: new Date().toISOString(),
    };
  }

  /** Host only — never echo credentials back over HTTP. */
  private maskedDatabaseHost(): string {
    const url = this.config.get<string>('DATABASE_URL') ?? '';
    const match = url.match(/@([^/:]+)/);
    return match ? match[1] : 'unknown';
  }
}
