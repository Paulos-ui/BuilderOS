import { Injectable, Logger } from '@nestjs/common';
import {
  cleanText,
  fetchJson,
  inferChains,
  type NormalizedOpportunity,
  type SourceAdapter,
} from './source.types';

interface GitcoinRound {
  id: string;
  chainId: number;
  roundMetadata?: {
    name?: string;
    eligibility?: { description?: string; requirements?: { requirement?: string }[] };
  };
  donationsStartTime?: string;
  donationsEndTime?: string;
  matchAmountInUsd?: number;
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  137: 'polygon',
  42161: 'arbitrum',
  8453: 'base',
  534352: 'scroll',
};

/**
 * Gitcoin Grants rounds via the public Grants Stack indexer (GraphQL).
 *
 * Only rounds whose donation window has not closed are ingested — a listing
 * you can no longer apply to is noise in a discovery feed, not signal.
 */
@Injectable()
export class GitcoinSource implements SourceAdapter {
  readonly name = 'gitcoin';
  readonly description = 'Gitcoin Grants rounds via the Grants Stack indexer';
  private readonly logger = new Logger(GitcoinSource.name);

  private readonly endpoint =
    process.env.GITCOIN_INDEXER_URL ??
    'https://grants-stack-indexer-v2.gitcoin.co/graphql';

  async fetch(): Promise<NormalizedOpportunity[]> {
    const nowSeconds = Math.floor(Date.now() / 1000);

    const query = `
      query OpenRounds {
        rounds(
          first: 40
          orderBy: DONATIONS_END_TIME_ASC
          filter: { donationsEndTime: { greaterThan: "${new Date(nowSeconds * 1000).toISOString()}" } }
        ) {
          id
          chainId
          roundMetadata
          donationsStartTime
          donationsEndTime
          matchAmountInUsd
        }
      }
    `;

    const body = await fetchJson<{ data?: { rounds?: GitcoinRound[] } }>(
      this.endpoint,
      { method: 'POST', body: JSON.stringify({ query }), headers: { 'Content-Type': 'application/json' } },
    );

    const rounds = body.data?.rounds ?? [];
    this.logger.log(`Gitcoin: ${rounds.length} open rounds`);

    return rounds.flatMap((round): NormalizedOpportunity[] => {
      const name = round.roundMetadata?.name;
      if (!name) return [];

      const eligibilityText = cleanText(
        round.roundMetadata?.eligibility?.description,
      );
      const chainName = CHAIN_NAMES[round.chainId] ?? `chain-${round.chainId}`;
      const description =
        eligibilityText ||
        `${name} is an open Gitcoin Grants round on ${chainName}. Projects apply for quadratic-funding matching from the round's matching pool.`;

      return [
        {
          sourceName: this.name,
          sourceUrl: `https://explorer.gitcoin.co/#/round/${round.chainId}/${round.id}`,
          title: name,
          description,
          category: 'GRANT',
          chains: [
            ...new Set([chainName, ...inferChains(`${name} ${description}`)]),
          ],
          fundingMin: null,
          fundingMax: round.matchAmountInUsd ?? null,
          deadline: round.donationsEndTime
            ? new Date(round.donationsEndTime)
            : null,
          eligibility: {
            requirements:
              round.roundMetadata?.eligibility?.requirements
                ?.map((r) => r.requirement)
                .filter(Boolean) ?? [],
          },
        },
      ];
    });
  }
}
