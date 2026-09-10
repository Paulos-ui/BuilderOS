import { Body, Controller, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScoringService, type DraftSections } from './scoring.service';
import { UsageService } from '../billing/usage.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { X402Interceptor } from '../pay/x402.interceptor';
import { Paid } from '../pay/paid.decorator';

interface ScoreRequest {
  draft: DraftSections;
  opportunityTitle?: string;
}

@Controller('v1/proofforge')
export class ProofForgeController {
  constructor(
    private readonly scoring: ScoringService,
    private readonly usage: UsageService,
  ) {}

  /**
   * Scores a draft. Rate-limited more tightly than the default because the
   * LLM path costs money per call and the rubric path is cheap enough that
   * nobody legitimately needs more than this.
   *
   * First metered route in the product. `@Paid` is inert until
   * X402_METERING_ENABLED is true AND an asset and payee address are
   * configured, so adding it here changes nothing for current callers — it
   * makes the x402 path real and exercisable without switching on charging as a
   * side effect of a deploy. Interceptor order matters: JwtAuthGuard runs first
   * so the payment record can be attributed to a builder profile.
   */
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(X402Interceptor)
  @Paid({ agentKey: 'forge', operation: 'score' })
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('score')
  async score(
    @CurrentUser() user: JwtPayload,
    @Body() body: ScoreRequest,
  ) {
    // Recorded whether or not metering is switched on, so usage data
    // exists before billing does.
    await this.usage.record(user.builderProfileId, 'forge', 'score');
    return this.scoring.score(body.draft ?? {}, body.opportunityTitle);
  }
}
