/* eslint-disable */
import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { WalletChallengeDto } from './dto/wallet-challenge.dto';
import { WalletVerifyDto } from './dto/wallet-verify.dto';
import { RequestMagicLinkDto } from './dto/request-magic-link.dto';
import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';
import type { SessionTokens } from './auth.types';

const REFRESH_COOKIE = 'builderos_refresh';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('wallet/challenge')
  walletChallenge(@Body() dto: WalletChallengeDto) {
    return this.authService.walletChallenge(dto.address);
  }

  @Post('wallet/verify')
  async walletVerify(
    @Body() dto: WalletVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.walletVerify(
      dto.message,
      dto.signature,
    );
    this.setRefreshCookie(res, tokens);
    return { accessToken: tokens.accessToken };
  }

  @Post('email/magic-link')
  requestMagicLink(@Body() dto: RequestMagicLinkDto) {
    return this.authService.requestMagicLink(dto.email);
  }

  @Post('email/verify')
  async verifyMagicLink(
    @Body() dto: VerifyMagicLinkDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.verifyMagicLink(dto.token);
    this.setRefreshCookie(res, tokens);
    return { accessToken: tokens.accessToken };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token present');
    }
    const tokens = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(res, tokens);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE);
    return { ok: true };
  }

  private setRefreshCookie(res: Response, tokens: SessionTokens) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days, matches JWT_REFRESH_TTL default
      path: '/v1/auth',
    });
  }
}
