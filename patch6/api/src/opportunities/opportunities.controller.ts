import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { FeedService } from './feed.service';
import { IngestionService } from './ingestion.service';

@Controller('v1/opportunities')
export class OpportunitiesController {
  constructor(
    private readonly feedService: FeedService,
    private readonly ingestionService: IngestionService,
    private readonly config: ConfigService,
  ) {}

  /** The ranked feed. Requires a session — ranking is per builder profile. */
  @UseGuards(JwtAuthGuard)
  @Get('feed')
  getFeed(
    @CurrentUser() user: JwtPayload,
    @Query('category') category?: string,
    @Query('chain') chain?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feedService.getFeed({
      builderProfileId: user.builderProfileId,
      category: category || undefined,
      chain: chain || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * Triggers ingestion.
   *
   * Guarded by a shared secret rather than a user session: this is an
   * operational job that hits third-party APIs and writes across the whole
   * table, so it must not be reachable by any signed-in user. If
   * INGEST_SECRET is unset the route refuses outright instead of defaulting
   * to open — an unauthenticated write endpoint is not an acceptable
   * fallback.
   */
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @Post('ingest')
  ingest(@Query('secret') secret?: string) {
    const expected = this.config.get<string>('INGEST_SECRET');
    if (!expected) {
      throw new ForbiddenException(
        'INGEST_SECRET is not configured, so ingestion is disabled.',
      );
    }
    if (secret !== expected) {
      throw new ForbiddenException('Invalid ingest secret.');
    }
    return this.ingestionService.ingestAll();
  }
}
