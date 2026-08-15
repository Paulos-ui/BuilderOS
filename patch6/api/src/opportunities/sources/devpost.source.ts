import { Injectable, Logger } from '@nestjs/common';
import {
  cleanText,
  fetchJson,
  inferChains,
  type NormalizedOpportunity,
  type SourceAdapter,
} from './source.types';

interface DevpostHackathon {
  title?: string;
  url?: string;
  submission_period_dates?: string;
  prize_amount?: string;
  themes?: { name: string }[];
  open_state?: string;
  organization_name?: string;
}

/**
 * Blockchain hackathons from Devpost's public search API.
 *
 * Prize amounts arrive as HTML-wrapped strings ("&#36;25,000"), so they are
 * parsed defensively — an unparseable amount becomes null rather than a
 * guessed number, because a wrong funding figure in a discovery feed is
 * worse than a missing one.
 */
@Injectable()
export class DevpostSource implements SourceAdapter {
  readonly name = 'devpost';
  readonly description = 'Blockchain and web3 hackathons listed on Devpost';
  private readonly logger = new Logger(DevpostSource.name);

  async fetch(): Promise<NormalizedOpportunity[]> {
    const url =
      'https://devpost.com/api/hackathons?search=blockchain&status[]=open&order_by=deadline';

    const body = await fetchJson<{ hackathons?: DevpostHackathon[] }>(url);
    const list = body.hackathons ?? [];
    this.logger.log(`Devpost: ${list.length} open hackathons`);

    return list.flatMap((h): NormalizedOpportunity[] => {
      if (!h.title || !h.url) return [];

      const themes = h.themes?.map((t) => t.name).join(', ') ?? '';
      const description = cleanText(
        `${h.title}${h.organization_name ? ` hosted by ${h.organization_name}` : ''}. ${
          themes ? `Themes: ${themes}.` : ''
        } Submission window: ${h.submission_period_dates ?? 'see listing'}.`,
      );

      return [
        {
          sourceName: this.name,
          sourceUrl: h.url.startsWith('http') ? h.url : `https://${h.url}`,
          title: h.title,
          description,
          category: 'HACKATHON',
          chains: inferChains(`${h.title} ${themes} ${description}`),
          fundingMin: null,
          fundingMax: this.parsePrize(h.prize_amount),
          deadline: this.parseDeadline(h.submission_period_dates),
          eligibility: { themes: h.themes?.map((t) => t.name) ?? [] },
        },
      ];
    });
  }

  private parsePrize(raw?: string): number | null {
    if (!raw) return null;
    const digits = cleanText(raw).replace(/[^0-9]/g, '');
    if (!digits) return null;
    const value = Number(digits);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  /** Devpost gives ranges like "Mar 01 - Apr 15, 2026"; we want the end. */
  private parseDeadline(raw?: string): Date | null {
    if (!raw) return null;
    const text = cleanText(raw);
    const end = text.split(/\s+-\s+/).pop();
    if (!end) return null;
    const parsed = new Date(end);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
