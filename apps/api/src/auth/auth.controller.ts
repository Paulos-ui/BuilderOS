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
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';
import type { SessionTokens } from './auth.types';

const REFRESH_COOKIE = 'builderos_refresh';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
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
    return {
      accessToken: tokens.accessToken,
      // Returned so the console can fall back to sessionStorage when
      // the browser blocks our third-party refresh cookie.
      refreshToken: tokens.refreshToken,
    };
  }

  /** Issues a 6-digit sign-in code. */
  @Post('email/otp')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.otpService.issue(dto.email);
  }

  /** Verifies a 6-digit code and starts a session. */
  @Post('email/verify')
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = await this.otpService.verify(dto.email, dto.code);
    const tokens = await this.authService.startEmailSession(email);
    this.setRefreshCookie(res, tokens);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @Post('email/magic-link')
  requestMagicLink(@Body() dto: RequestMagicLinkDto) {
    return this.authService.requestMagicLink(dto.email);
  }

  @Post('email/verify-link')
  async verifyMagicLink(
    @Body() dto: VerifyMagicLinkDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.verifyMagicLink(dto.token);
    this.setRefreshCookie(res, tokens);
    return {
      accessToken: tokens.accessToken,
      // Returned so the console can fall back to sessionStorage when
      // the browser blocks our third-party refresh cookie.
      refreshToken: tokens.refreshToken,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Cookie first. Firefox and Safari block third-party cookies by
    // default, and the console is on a different registrable domain to this
    // API, so the cookie is often simply absent — the body fallback is what
    // keeps sessions alive there. Once app and API share a parent domain
    // this can go back to cookie-only.
    const refreshToken =
      req.cookies?.[REFRESH_COOKIE] ??
      (req.body as { refreshToken?: string } | undefined)?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token present');
    }
    const tokens = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(res, tokens);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE);
    return { ok: true };
  }

  private setRefreshCookie(res: Response, tokens: SessionTokens) {
    // The app (Vercel) and the API (Render) are different sites, so a
    // 'lax' cookie would simply never be sent on the refresh call and every
    // session would silently die on reload. 'none' is required for
    // cross-site delivery, and browsers only accept it alongside Secure —
    // which is why this pairs with HTTPS in production. Once both run on
    // one domain (app + api.builderos.dev), move back to 'lax'.
    const isProd = this.config.get('NODE_ENV') === 'production';
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days, matches JWT_REFRESH_TTL default
      path: '/v1/auth',
    });
  }
}
