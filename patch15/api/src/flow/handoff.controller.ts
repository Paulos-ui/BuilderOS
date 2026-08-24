import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { HandoffService } from './handoff.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/handoff')
export class HandoffController {
  constructor(private readonly handoff: HandoffService) {}

  /** Scout -> Flow */
  @Post('track/:opportunityId')
  track(
    @CurrentUser() user: JwtPayload,
    @Param('opportunityId') opportunityId: string,
  ) {
    return this.handoff.trackOpportunity(user.builderProfileId, opportunityId);
  }

  /** Flow -> Forge */
  @Get('review/:applicationId')
  review(
    @CurrentUser() user: JwtPayload,
    @Param('applicationId') applicationId: string,
  ) {
    return this.handoff.reviewContext(user.builderProfileId, applicationId);
  }

  /** Forge -> Flow */
  @Post('score/:applicationId')
  async score(
    @CurrentUser() user: JwtPayload,
    @Param('applicationId') applicationId: string,
    @Body() body: { score: number },
  ) {
    await this.handoff.recordScore(
      user.builderProfileId,
      applicationId,
      body.score,
    );
    return { ok: true };
  }

  /** Flow -> Rep */
  @Post('promote/:applicationId')
  promote(
    @CurrentUser() user: JwtPayload,
    @Param('applicationId') applicationId: string,
  ) {
    return this.handoff.promoteToProof(user.builderProfileId, applicationId);
  }

  /** Cross-agent overview */
  @Get('pipeline')
  pipeline(@CurrentUser() user: JwtPayload) {
    return this.handoff.pipeline(user.builderProfileId);
  }
}
