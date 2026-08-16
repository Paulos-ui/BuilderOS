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
  ) {}

  private hash(code: string, email: string): string {
    // Salting with the email means an identical code for two users produces
    // different hashes, so a stolen hash cannot be replayed across accounts.
    return createHash('sha256').update(`${email}:${code}`).digest('hex');
  }

  async issue(rawEmail: string): Promise<{ sent: true; retryAfter: number }> {
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

    await this.deliver(email, code);
    return { sent: true, retryAfter: RESEND_COOLDOWN_SECONDS };
  }

  private async deliver(email: string, code: string) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      // Demo path: no email provider configured, so the code goes to the
      // server log. Loud formatting because it has to be findable in a
      // Render log stream while someone is watching.
      this.logger.warn(
        `\n${'='.repeat(46)}\n  SIGN-IN CODE for ${email}\n  >>>  ${code}  <<<\n  expires in ${OTP_TTL_MINUTES} minutes\n${'='.repeat(46)}`,
      );
      return;
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: this.config.get('MAGIC_LINK_FROM_EMAIL') ?? 'hello@builderos.dev',
      to: email,
      subject: `${code} is your BuilderOS sign-in code`,
      html: `<p>Your BuilderOS sign-in code:</p><p style="font-size:28px;letter-spacing:6px;font-family:monospace"><strong>${code}</strong></p><p>It expires in ${OTP_TTL_MINUTES} minutes. If you didn't request it, ignore this email.</p>`,
    });
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
