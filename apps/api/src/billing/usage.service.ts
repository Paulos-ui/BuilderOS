import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface UsageSummary {
  totalCalls: number;
  billableCalls: number;
  settledCalls: number;
  meteringEnabled: boolean;
  note: string;
  recent: {
    agentKey: string;
    operation: string;
    settled: boolean;
    createdAt: string;
  }[];
}

/**
 * BuilderPay — usage metering.
 *
 * Metering records from day one; CHARGING is gated behind
 * X402_METERING_ENABLED. The separation is deliberate — usage data is useful
 * immediately, while switching on real settlement should be an explicit
 * decision rather than a side effect of adding credentials to an
 * environment. Every call is free until that flag flips, and the API reports
 * which mode it is in so nothing can silently start billing.
 */
@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get meteringEnabled(): boolean {
    return this.config.get<string>('X402_METERING_ENABLED') === 'true';
  }

  /** Never throws — billing must not be able to break the product. */
  async record(
    builderProfileId: string,
    agentKey: string,
    operation: string,
  ): Promise<void> {
    try {
      await this.prisma.usageRecord.create({
        data: {
          builderProfileId,
          agentKey,
          operation,
          billable: this.meteringEnabled,
          settled: false,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Usage record failed (non-fatal): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async summary(builderProfileId: string): Promise<UsageSummary> {
    const [total, billable, settled, recent] = await Promise.all([
      this.prisma.usageRecord.count({ where: { builderProfileId } }),
      this.prisma.usageRecord.count({
        where: { builderProfileId, billable: true },
      }),
      this.prisma.usageRecord.count({
        where: { builderProfileId, settled: true },
      }),
      this.prisma.usageRecord.findMany({
        where: { builderProfileId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      totalCalls: total,
      billableCalls: billable,
      settledCalls: settled,
      meteringEnabled: this.meteringEnabled,
      note: this.meteringEnabled
        ? 'Agent calls are metered and settled over x402 on GOAT Network.'
        : 'Usage is being recorded, but all agent calls are currently free. Metering is off.',
      recent: recent.map((r) => ({
        agentKey: r.agentKey,
        operation: r.operation,
        settled: r.settled,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
