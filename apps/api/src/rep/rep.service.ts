import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NetworkConfig } from '../config/network.config';

export interface ProofItem {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  evidenceUrl: string | null;
  occurredAt: string;
  verified: boolean;
  chainTxHash: string | null;
}

export interface RepSummary {
  items: ProofItem[];
  totals: {
    records: number;
    verified: number;
    applicationsSubmitted: number;
    applicationsWon: number;
  };
  anchoring: { enabled: boolean; network: string; note: string };
}

/**
 * BuilderRep — portable proof of completed work.
 *
 * On anchoring: records live in Postgres and are exportable. They are NOT
 * written to chain, and every response says so explicitly rather than
 * letting the UI imply otherwise. Anchoring a hash on GOAT is a small
 * addition once the record format is stable — claiming it beforehand would
 * be exactly the overclaim this product exists to be the antidote to.
 */
@Injectable()
export class RepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly network: NetworkConfig,
  ) {}

  async summary(builderProfileId: string): Promise<RepSummary> {
    const [rows, submitted, won] = await Promise.all([
      this.prisma.proofRecord.findMany({
        where: { builderProfileId },
        orderBy: { occurredAt: 'desc' },
        take: 50,
      }),
      this.prisma.trackedApplication.count({
        where: {
          builderProfileId,
          stage: { in: ['SUBMITTED', 'WON', 'REJECTED'] },
        },
      }),
      this.prisma.trackedApplication.count({
        where: { builderProfileId, stage: 'WON' },
      }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        description: r.description,
        evidenceUrl: r.evidenceUrl,
        occurredAt: r.occurredAt.toISOString(),
        verified: r.verified,
        chainTxHash: r.chainTxHash,
      })),
      totals: {
        records: rows.length,
        verified: rows.filter((r) => r.verified).length,
        applicationsSubmitted: submitted,
        applicationsWon: won,
      },
      anchoring: {
        enabled: false,
        network: this.network.name,
        note: 'Records are stored and exportable, but not yet anchored on-chain. Anchoring ships once the record format is stable.',
      },
    };
  }

  /**
   * `verified` stays false unless evidence was checked against its source.
   * Self-asserted records are still useful, but must never be presented as
   * verified — that distinction is the whole value of a reputation record.
   */
  async record(
    builderProfileId: string,
    input: {
      kind: string;
      title: string;
      description?: string;
      evidenceUrl?: string;
      occurredAt?: string;
      applicationId?: string;
    },
  ): Promise<ProofItem> {
    const row = await this.prisma.proofRecord.create({
      data: {
        builderProfileId,
        applicationId: input.applicationId,
        kind: input.kind,
        title: input.title.trim(),
        description: input.description,
        evidenceUrl: input.evidenceUrl,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        verified: false,
      },
    });

    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      description: row.description,
      evidenceUrl: row.evidenceUrl,
      occurredAt: row.occurredAt.toISOString(),
      verified: row.verified,
      chainTxHash: row.chainTxHash,
    };
  }

  /** Portable export — the point of "reputation you own". */
  async export(builderProfileId: string) {
    const summary = await this.summary(builderProfileId);
    return {
      format: 'builderos.proof.v1',
      exportedAt: new Date().toISOString(),
      profileId: builderProfileId,
      records: summary.items,
      totals: summary.totals,
      note: 'Self-asserted unless verified is true. Not on-chain anchored.',
    };
  }
}
