import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { MatchService } from './match.service';
import { UsageService } from '../billing/usage.service';

/**
 * BuilderMatch (AG-04).
 *
 * Authenticated only, and never returns email or wallet address — a
 * collaborator list is the one feature here that exposes one builder's data to
 * another, so the projection in MatchService is the privacy boundary and it is
 * deliberately narrow: profile id, GitHub handle, chains, languages, bio.
 * Contact happens through GitHub, which the builder chose to publish.
 */
@UseGuards(JwtAuthGuard)
@Controller('v1/match')
export class MatchController {
  constructor(
    private readonly match: MatchService,
    private readonly usage: UsageService,
  ) {}

  /**
   * Ranked collaborators, optionally scoped to an opportunity.
   *
   * Tighter throttle than the global 100/min: each call runs a vector scan
   * plus a group-by, and no legitimate UI needs to ask more than a few times a
   * minute.
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('collaborators')
  async collaborators(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('opportunityId') opportunityId?: string,
  ) {
    await this.usage.record(user.builderProfileId, 'match', 'collaborators');
    return this.match.collaborators(user.builderProfileId, {
      limit,
      opportunityId,
    });
  }
}
