import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { OtpService } from '../auth/otp.service';
import { IdentityService } from './identity.service';

/**
 * Adding an email to an existing account.
 *
 * This reuses the sign-in OTP rather than trusting the address as typed. A
 * signed-in user asserting "my email is X" proves nothing about X — without
 * verification you could attach someone else's address to your profile, and
 * later flows (notifications, recovery, grant correspondence) would send
 * their mail to you.
 */
@UseGuards(JwtAuthGuard)
@Controller('v1/profiles/me')
export class LinkEmailController {
  constructor(
    private readonly otp: OtpService,
    private readonly identity: IdentityService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('link-email/start')
  start(@Body() body: { email: string }) {
    return this.otp.issue(body.email);
  }

  @Post('link-email/confirm')
  async confirm(
    @CurrentUser() user: JwtPayload,
    @Body() body: { email: string; code: string },
  ) {
    const verified = await this.otp.verify(body.email, body.code);
    return this.identity.linkVerifiedEmail(user.builderProfileId, verified);
  }
}
