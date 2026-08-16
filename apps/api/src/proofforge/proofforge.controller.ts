import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScoringService, type DraftSections } from './scoring.service';

interface ScoreRequest {
  draft: DraftSections;
  opportunityTitle?: string;
}

@Controller('v1/proofforge')
export class ProofForgeController {
  constructor(private readonly scoring: ScoringService) {}

  /**
   * Scores a draft. Rate-limited more tightly than the default because the
   * LLM path costs money per call and the rubric path is cheap enough that
   * nobody legitimately needs more than this.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('score')
  score(@Body() body: ScoreRequest) {
    return this.scoring.score(body.draft ?? {}, body.opportunityTitle);
  }
}
