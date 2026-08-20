import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Engine = 'rubric' | 'llm';

export interface DraftSections {
  problem?: string;
  solution?: string;
  technical?: string;
  milestones?: string;
  budget?: string;
  team?: string;
}

export interface DimensionScore {
  key: string;
  label: string;
  score: number;
  weight: number;
  findings: string[];
  suggestions: string[];
}

export interface ScoreResult {
  overall: number;
  engine: Engine;
  dimensions: DimensionScore[];
  criticalGaps: string[];
  strengths: string[];
  wordCount: number;
  scoredAt: string;
  disclaimer: string;
}

interface Rubric {
  key: string;
  label: string;
  weight: number;
  section: keyof DraftSections;
  minWords: number;
  signals: { pattern: RegExp; label: string; weight: number }[];
  vagueness: RegExp[];
  guidance: string[];
}

const NUMBER = /\b\d[\d,.]*\s*(k|m|%|usd|\$|eth|btc|weeks?|months?|days?|users?)?\b/i;
const URL = /https?:\/\/[^\s]+|github\.com\/[^\s]+/i;

const RUBRICS: Rubric[] = [
  {
    key: 'problem',
    label: 'Problem clarity',
    weight: 20,
    section: 'problem',
    minWords: 40,
    signals: [
      { pattern: NUMBER, label: 'Quantifies the problem', weight: 25 },
      { pattern: /\b(currently|today|right now|at present)\b/i, label: 'Anchors the problem in the present', weight: 10 },
      { pattern: /\b(because|due to|caused by|results? from)\b/i, label: 'Explains causation, not just symptoms', weight: 15 },
    ],
    vagueness: [
      /\b(revolutionar|disrupt|game.?chang|paradigm|synerg)/i,
      /\b(many|some|lots of|a lot of)\s+(people|users|developers|builders)\b/i,
    ],
    guidance: [
      'Name who has this problem and how often it costs them something.',
      'Replace "many builders struggle" with a number or a specific example.',
    ],
  },
  {
    key: 'solution',
    label: 'Solution specificity',
    weight: 20,
    section: 'solution',
    minWords: 50,
    signals: [
      { pattern: /\b(we (will|have) (built|build|ship|implement)|the system|our approach)\b/i, label: 'States concretely what gets built', weight: 20 },
      { pattern: /\b(unlike|instead of|rather than|compared (to|with))\b/i, label: 'Differentiates from existing options', weight: 20 },
      { pattern: NUMBER, label: 'Includes concrete figures', weight: 10 },
    ],
    vagueness: [
      /\b(seamless|cutting.?edge|state.of.the.art|next.?gen|world.?class)\b/i,
      /\b(leverage|utiliz)/i,
    ],
    guidance: [
      'Describe what a user can do after this ships that they cannot do now.',
      'Say what you are NOT building — scope discipline reads as credibility.',
    ],
  },
  {
    key: 'technical',
    label: 'Technical credibility',
    weight: 18,
    section: 'technical',
    minWords: 40,
    signals: [
      { pattern: URL, label: 'Links to real code or prior work', weight: 30 },
      { pattern: /\b(architecture|schema|endpoint|contract|protocol|api|database|index)\b/i, label: 'Names specific technical components', weight: 20 },
      { pattern: /\b(risk|trade.?off|limitation|constraint|failure mode)\b/i, label: 'Acknowledges trade-offs', weight: 15 },
    ],
    vagueness: [/\b(scalable|robust|enterprise.?grade|military.?grade)\b/i],
    guidance: [
      'Link the repository. Reviewers check whether code exists.',
      'Naming one real constraint you hit builds more trust than claiming none.',
    ],
  },
  {
    key: 'milestones',
    label: 'Milestones and feasibility',
    weight: 22,
    section: 'milestones',
    minWords: 40,
    signals: [
      { pattern: /\b(week|month|q[1-4]|phase|milestone|sprint)\s*\d|\b\d+\s*(weeks?|months?)\b/i, label: 'Has a real timeline', weight: 30 },
      { pattern: /\b(deliver|ship|launch|complete|release)\b/i, label: 'States concrete deliverables', weight: 20 },
      { pattern: /\b(measur|metric|target|kpi|success criteria)\b/i, label: 'Defines what success looks like', weight: 20 },
    ],
    vagueness: [/\b(ongoing|continuous|as needed|tbd|to be determined)\b/i],
    guidance: [
      'Give each milestone a date and something a reviewer could verify.',
      'Milestones without verifiable outputs read as intentions, not plans.',
    ],
  },
  {
    key: 'budget',
    label: 'Budget justification',
    weight: 12,
    section: 'budget',
    minWords: 25,
    signals: [
      { pattern: /[$€£]|\busd\b|\beth\b|\bbtc\b/i, label: 'States amounts', weight: 30 },
      { pattern: /\b(breakdown|allocat|split|per|hours?|rate)\b/i, label: 'Breaks the total down', weight: 25 },
    ],
    vagueness: [/\b(approximately|roughly|around)\s*\$?\d/i],
    guidance: [
      'Break the total into line items. A single number invites scepticism.',
      'Tie each line to a milestone so the money maps to the plan.',
    ],
  },
  {
    key: 'team',
    label: 'Team and track record',
    weight: 8,
    section: 'team',
    minWords: 20,
    signals: [
      { pattern: URL, label: 'Links to profiles or prior work', weight: 30 },
      { pattern: /\b(shipped|built|launched|maintained|contributed)\b/i, label: 'Cites concrete prior work', weight: 25 },
    ],
    vagueness: [/\b(passionate|experienced team|industry veteran|expert)\b/i],
    guidance: [
      'Link to what you have already shipped rather than describing yourself.',
      '"Passionate about X" carries no information; a repository does.',
    ],
  },
];

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(private readonly config: ConfigService) {}

  get engine(): Engine {
    return this.config.get<string>('ANTHROPIC_API_KEY') ? 'llm' : 'rubric';
  }

  async score(
    draft: DraftSections,
    opportunityTitle?: string,
  ): Promise<ScoreResult> {
    const base = this.scoreRubric(draft);

    if (this.engine === 'llm') {
      try {
        return await this.enrichWithLlm(base, draft, opportunityTitle);
      } catch (err) {
        this.logger.warn(
          `LLM review failed, returning rubric score only: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return base;
  }

  private scoreRubric(draft: DraftSections): ScoreResult {
    const dimensions: DimensionScore[] = RUBRICS.map((rubric) => {
      const text = (draft[rubric.section] ?? '').trim();
      const words = text ? text.split(/\s+/).length : 0;

      const findings: string[] = [];
      const suggestions: string[] = [];

      if (words === 0) {
        return {
          key: rubric.key,
          label: rubric.label,
          score: 0,
          weight: rubric.weight,
          findings: ['This section is empty.'],
          suggestions: rubric.guidance,
        };
      }

      const lengthRatio = Math.min(1, words / rubric.minWords);
      let score = 25 * lengthRatio;

      if (lengthRatio < 1) {
        findings.push(`Only ${words} words — reviewers expect roughly ${rubric.minWords}+ here.`);
        suggestions.push(`Expand this section to at least ${rubric.minWords} words.`);
      }

      for (const signal of rubric.signals) {
        if (signal.pattern.test(text)) {
          score += signal.weight;
          findings.push(signal.label);
        } else {
          suggestions.push(...rubric.guidance.slice(0, 1));
        }
      }

      let vagueHits = 0;
      for (const pattern of rubric.vagueness) {
        const match = text.match(pattern);
        if (match) {
          vagueHits++;
          findings.push(`Vague phrasing: "${match[0]}"`);
          suggestions.push(`Replace "${match[0]}" with something a reviewer could check.`);
        }
      }
      score -= vagueHits * 8;

      return {
        key: rubric.key,
        label: rubric.label,
        score: Math.max(0, Math.min(100, Math.round(score))),
        weight: rubric.weight,
        findings,
        suggestions: [...new Set(suggestions)].slice(0, 3),
      };
    });

    const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
    const overall = Math.round(
      dimensions.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight,
    );

    const criticalGaps = dimensions
      .filter((d) => d.score < 40)
      .map((d) => `${d.label}: ${d.score === 0 ? 'missing entirely' : 'too thin to be convincing'}`);

    const strengths = dimensions
      .filter((d) => d.score >= 70)
      .map((d) => d.label);

    const wordCount = Object.values(draft)
      .filter(Boolean)
      .join(' ')
      .split(/\s+/)
      .filter(Boolean).length;

    return {
      overall,
      engine: 'rubric',
      dimensions,
      criticalGaps,
      strengths,
      wordCount,
      scoredAt: new Date().toISOString(),
      disclaimer:
        'Structural review of what you wrote. It checks for the elements reviewers look for — it does not judge whether your idea is good, and it is not a prediction of the outcome.',
    };
  }

  private async enrichWithLlm(
    base: ScoreResult,
    draft: DraftSections,
    opportunityTitle?: string,
  ): Promise<ScoreResult> {
    const sections = Object.entries(draft)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `## ${k}\n${v}`)
      .join('\n\n');

    if (!sections) return base;

    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    // Defaulting directly to the official Anthropic URL
    const baseUrl = (
      this.config.get<string>('ANTHROPIC_BASE_URL') ||
      'https://api.anthropic.com'
    ).trim().replace(/\/+$/, '');

    const endpoint = `${baseUrl}/v1/messages`;

    // Defaulting to the latest Sonnet model
    const modelName =
      this.config.get<string>('ANTHROPIC_MODEL') ||
      'claude-3-5-sonnet-20241022';

    this.logger.log(`Calling official Anthropic: ${endpoint}`);
    this.logger.log(`Using model: ${modelName}`);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 1200,
        system:
          'You review draft funding applications. You assess ONLY the text provided. ' +
          'Never introduce facts, achievements, metrics or claims the author did not write. ' +
          'Be specific and direct; name what is weak and why a reviewer would mark it down. ' +
          'Respond ONLY with valid JSON. No markdown fences. No preamble.',
        messages: [
          {
            role: 'user',
            content:
              `${opportunityTitle ? `Applying to: ${opportunityTitle}\n\n` : ''}` +
              `Draft:\n\n${sections}\n\n` +
              'Return ONLY this JSON structure:' +
              '\n' +
              '{"criticalGaps":["string"],"strengths":["string"],"reviewerPerspective":"string"}',
          },
        ],
      }),
    });

    const responseText = await res.text();

    if (!res.ok) {
      throw new Error(
        `Anthropic responded ${res.status}: ${responseText.slice(0, 500)}`,
      );
    }

    let body: {
      content?: { type: string; text?: string }[];
    };

    try {
      body = JSON.parse(responseText);
    } catch {
      throw new Error(
        `Anthropic returned non-JSON response: ${responseText.slice(0, 500)}`,
      );
    }

    const text =
      body.content?.find((c) => c.type === 'text')?.text?.trim() ?? '';

    if (!text) {
      throw new Error('Anthropic returned no text content');
    }

    let parsed: {
      criticalGaps?: string[];
      strengths?: string[];
      reviewerPerspective?: string;
    };

    try {
      parsed = JSON.parse(
        text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim(),
      );
    } catch {
      throw new Error(
        `LLM returned invalid JSON: ${text.slice(0, 500)}`,
      );
    }

    return {
      ...base,
      engine: 'llm',
      criticalGaps: [
        ...base.criticalGaps,
        ...(parsed.criticalGaps ?? []),
      ],
      strengths: [
        ...new Set([
          ...base.strengths,
          ...(parsed.strengths ?? []),
        ]),
      ],
      disclaimer: parsed.reviewerPerspective
        ? `${parsed.reviewerPerspective} — This is a review of what you wrote, not a prediction of the outcome.`
        : base.disclaimer,
    };
  }
}