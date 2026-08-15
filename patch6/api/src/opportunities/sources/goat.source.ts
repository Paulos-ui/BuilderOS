import { Injectable } from '@nestjs/common';
import type { NormalizedOpportunity, SourceAdapter } from './source.types';

/**
 * GOAT Network ecosystem programmes.
 *
 * GOAT does not currently expose a machine-readable programme feed, so these
 * are curated from its published builder programme pages. That is a
 * deliberate, declared choice rather than a hidden one: `sourceUrl` points
 * at the real page, and `lastVerifiedAt` is set at ingest time so the feed
 * shows how fresh the check was.
 *
 * Curated entries carry `curated: true` in eligibility so the UI can label
 * them, and so we can find and retire them the moment a real feed exists.
 * Update CURATED_VERIFIED_AT when you re-check these by hand.
 */
const CURATED_VERIFIED_AT = '2026-08-15';

@Injectable()
export class GoatSource implements SourceAdapter {
  readonly name = 'goat';
  readonly description = 'GOAT Network builder programme (curated)';

  async fetch(): Promise<NormalizedOpportunity[]> {
    return [
      {
        sourceName: this.name,
        sourceUrl: 'https://www.goat.network/builder-program',
        title: 'GOAT Network Builder Program — Base Grant',
        description:
          'Funding for builders moving an agent-native idea to a working product on GOAT Network. Focus areas include agentic payments, transactional applications and productivity tooling built on Bitcoin-secured infrastructure with x402 and ERC-8004.',
        category: 'GRANT',
        chains: ['goat', 'bitcoin'],
        fundingMin: 500,
        fundingMax: 500,
        deadline: null,
        eligibility: {
          curated: true,
          verifiedAt: CURATED_VERIFIED_AT,
          focus: ['agentic payments', 'transactional apps', 'productivity'],
        },
      },
      {
        sourceName: this.name,
        sourceUrl: 'https://www.goat.network/builder-program',
        title: 'GOAT Network Singularity Investment',
        description:
          'Follow-on investment allocated to high-potential applications on GOAT Network that demonstrate real traction: live usage, agent-driven transactions and measurable value moving through the product.',
        category: 'ECOSYSTEM_FUND',
        chains: ['goat', 'bitcoin'],
        fundingMin: null,
        fundingMax: 1_000_000,
        deadline: null,
        eligibility: {
          curated: true,
          verifiedAt: CURATED_VERIFIED_AT,
          requires: 'demonstrated traction',
        },
      },
    ];
  }
}
