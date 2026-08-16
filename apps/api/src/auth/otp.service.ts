import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService, type MailStatus } from '../common/mailer.service';

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Six-digit email OTP.
 *
 * Security decisions worth stating, because a 6-digit code is a much smaller
 * search space than a UUID magic-link token and needs compensating controls:
 *
 *  - Codes are generated with `randomInt` (CSPRNG), not `Math.random`.
 *  - Only a SHA-256 hash is stored. A database leak does not hand an
 *    attacker live login codes.
 *  - Five wrong attempts burns the code. Without this, 10^6 is trivially
 *    brute-forced; with it, an attacker gets 5 guesses per issued code.
 *  - Comparison is constant-time, so response latency does not leak how
 *    many leading digits were correct.
 *  - Resend is rate-limited so the endpoint cannot be used to flood an
 *    inbox or to mint unlimited valid codes in parallel.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
  ) {}

  private hash(code: string, email: string): string {
    // Salting with the email means an identical code for two users produces
    // different hashes, so a stolen hash cannot be replayed across accounts.
    return createHash('sha256').update(`${email}:${code}`).digest('hex');
  }

  async issue(
    rawEmail: string,
  ): Promise<{ sent: boolean; delivery: MailStatus; retryAfter: number; reason?: string }> {
    const email = rawEmail.trim().toLowerCase();

    const recent = await this.prisma.emailOtp.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (recent) {
      const age = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (age < RESEND_COOLDOWN_SECONDS) {
        throw new HttpException(
          `Wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - age)}s before requesting another code.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      // Supersede any outstanding code so only the newest one works.
      await this.prisma.emailOtp.updateMany({
        where: { email, usedAt: null },
        data: { usedAt: new Date() },
      });
    }

    // randomInt is uniform over the range; padStart keeps leading zeros so
    // "012345" stays a valid six-digit code rather than becoming 12345.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

    await this.prisma.emailOtp.create({
      data: {
        email,
        codeHash: this.hash(code, email),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      },
    });

    const result = await this.mailer.sendSignInCode(
      email,
      code,
      OTP_TTL_MINUTES,
    );

    // The code is valid regardless of whether the email landed — it is in
    // the database and (on failure) in the logs. We report the delivery
    // outcome rather than claiming success we cannot verify.
    return {
      sent: result.status !== 'failed',
      delivery: result.status,
      retryAfter: RESEND_COOLDOWN_SECONDS,
      ...(result.reason ? { reason: result.reason } : {}),
    };
  }

  /** Returns the verified email, or throws. */
  async verify(rawEmail: string, code: string): Promise<string> {
    const email = rawEmail.trim().toLowerCase();

    const record = await this.prisma.emailOtp.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'That code has expired. Request a new one.',
      );
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.prisma.emailOtp.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Too many incorrect attempts. Request a new code.',
      );
    }

    const provided = Buffer.from(this.hash(code.trim(), email));
    const expected = Buffer.from(record.codeHash);

    const matches =
      provided.length === expected.length && timingSafeEqual(provided, expected);

    if (!matches) {
      await this.prisma.emailOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      const left = MAX_ATTEMPTS - (record.attempts + 1);
      throw new UnauthorizedException(
        left > 0
          ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.`
          : 'Incorrect code. Request a new one.',
      );
    }

    await this.prisma.emailOtp.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return email;
  }
}
