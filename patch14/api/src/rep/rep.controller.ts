import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { RepService } from './rep.service';
import { UsageService } from '../billing/usage.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/rep')
export class RepController {
  constructor(
    private readonly rep: RepService,
    private readonly usage: UsageService,
  ) {}

  @Get()
  summary(@CurrentUser() user: JwtPayload) {
    return this.rep.summary(user.builderProfileId);
  }

  @Post('records')
  record(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      kind: string;
      title: string;
      description?: string;
      evidenceUrl?: string;
      occurredAt?: string;
    },
  ) {
    return this.rep.record(user.builderProfileId, body);
  }

  @Get('export')
  export(@CurrentUser() user: JwtPayload) {
    return this.rep.export(user.builderProfileId);
  }

  @Get('usage')
  usageSummary(@CurrentUser() user: JwtPayload) {
    return this.usage.summary(user.builderProfileId);
  }
}
