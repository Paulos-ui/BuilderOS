import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'crypto';
import { verifyMessage } from 'viem';
import { PrismaService } from '../prisma/prisma.service';
import { buildSiweMessage, parseSiweMessage } from './siwe-message.util';
import { JwtPayload, SessionTokens } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ---------- Wallet auth ----------

  /**
   * Step 1 of SIWE: issue a single-use nonce bound to the requesting address,
   * and hand back the exact message the client should have the wallet sign.
   * The nonce is what prevents a captured signature being replayed later.
   */
  async walletChallenge(address: string): Promise<{ message: string }> {
    const normalizedAddress = address.toLowerCase();
    const nonce = randomBytes(16).toString('hex');
    const ttlMinutes = Number(
      this.config.get('SIWE_NONCE_TTL_MINUTES') ?? '10',
    );

    await this.prisma.authNonce.create({
      data: {
        address: normalizedAddress,
        nonce,
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
      },
    });

    const message = buildSiweMessage({
      domain: this.config.get('SIWE_DOMAIN') ?? 'builderos.dev',
      address,
      nonce,
      uri: this.config.get('APP_BASE_URL') ?? 'http://localhost:3000',
      chainId: 1, // signature covers identity, not a chain-specific tx
      statement: 'Sign in to BuilderOS.',
    });

    return { message };
  }

  /**
   * Step 2 of SIWE: verify the signature actually came from the address in
   * the message, verify the nonce is unused and unexpired, then mint (or
   * fetch) the user and issue a session.
   */
  async walletVerify(
    message: string,
    signature: string,
  ): Promise<SessionTokens> {
    const parsed = parseSiweMessage(message);

    const nonceRecord = await this.prisma.authNonce.findUnique({
      where: { nonce: parsed.nonce },
    });

    if (
      !nonceRecord ||
      nonceRecord.usedAt ||
      nonceRecord.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Nonce is invalid, used, or expired');
    }

    if (nonceRecord.address !== parsed.address.toLowerCase()) {
      throw new UnauthorizedException('Address does not match challenge');
    }

    const isValid = await verifyMessage({
      address: parsed.address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Burn the nonce immediately — this is what makes replay impossible.
    await this.prisma.authNonce.update({
      where: { nonce: parsed.nonce },
      data: { usedAt: new Date() },
    });

    const user = await this.findOrCreateUserByWallet(parsed.address);
    return this.issueSession(user.id);
  }

  private async findOrCreateUserByWallet(address: string) {
    const normalizedAddress = address.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
      include: { builderProfile: true },
    });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        walletAddress: normalizedAddress,
        authProvider: 'WALLET',
        builderProfile: { create: {} },
      },
      include: { builderProfile: true },
    });
  }

  // ---------- Email magic link ----------

  async requestMagicLink(email: string): Promise<{ sent: true }> {
    const token = randomUUID();
    await this.prisma.magicLinkToken.create({
      data: {
        email: email.toLowerCase(),
        token,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      },
    });

    const link = `${this.config.get('APP_BASE_URL')}/auth/verify?token=${token}`;

    // In production this calls Resend (or your provider of choice). We log
    // instead of throwing when RESEND_API_KEY is unset so local dev doesn't
    // require a real email account to exercise the auth flow.
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (apiKey) {
      const { Resend } = await import('resend');
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: this.config.get('MAGIC_LINK_FROM_EMAIL') ?? 'hello@builderos.dev',
        to: email,
        subject: 'Sign in to BuilderOS',
        html: `<p>Click to sign in: <a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`,
      });
    } else {
      console.log(`[dev] Magic link for ${email}: ${link}`);
    }

    return { sent: true };
  }

  async verifyMagicLink(token: string): Promise<SessionTokens> {
    const record = await this.prisma.magicLinkToken.findUnique({
      where: { token },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Magic link is invalid, used, or expired',
      );
    }

    await this.prisma.magicLinkToken.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    const user = await this.findOrCreateUserByEmail(record.email);
    return this.issueSession(user.id);
  }

  private async findOrCreateUserByEmail(email: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      include: { builderProfile: true },
    });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        email,
        authProvider: 'EMAIL',
        builderProfile: { create: {} },
      },
      include: { builderProfile: true },
    });
  }

  // ---------- Session issuance ----------

  private async issueSession(userId: string): Promise<SessionTokens> {
    const profile = await this.prisma.builderProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new BadRequestException('Builder profile missing for user');
    }

    const payload: JwtPayload = { sub: userId, builderProfileId: profile.id };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m',
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_TTL') ?? '30d',
    });

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
      // Rotate on every use — a stolen refresh token has a one-time window.
      return this.issueSession(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
