import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type MailStatus = 'sent' | 'logged' | 'failed';

export interface MailResult {
  status: MailStatus;
  /** Present when status is 'failed' — safe to surface to the user. */
  reason?: string;
}

/**
 * Email delivery, isolated from the auth flow.
 *
 * The important behaviour here is what happens when sending fails. The
 * previous inline implementation let a Resend error propagate, which meant
 * the request 500'd *after* the OTP row had already been written — so a
 * valid code existed that the user could never see, and the error they got
 * said nothing useful. Now delivery failures are caught, logged with the
 * provider's actual message, and reported back so the UI can tell the user
 * something true ("we couldn't send the email") rather than "unknown error".
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('RESEND_API_KEY'));
  }

  get fromAddress(): string {
    return (
      this.config.get<string>('MAIL_FROM') ??
      this.config.get<string>('MAGIC_LINK_FROM_EMAIL') ??
      'onboarding@resend.dev'
    );
  }

  async sendSignInCode(to: string, code: string, ttlMinutes: number): Promise<MailResult> {
    if (!this.isConfigured) {
      // Demo path: no provider configured. Loud formatting because this has
      // to be findable in a live log stream while someone is watching.
      this.logger.warn(
        `\n${'='.repeat(46)}\n  SIGN-IN CODE for ${to}\n  >>>  ${code}  <<<\n  expires in ${ttlMinutes} minutes\n  (set RESEND_API_KEY to email this instead)\n${'='.repeat(46)}`,
      );
      return { status: 'logged' };
    }

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(this.config.get<string>('RESEND_API_KEY'));

      const { error } = await resend.emails.send({
        from: this.fromAddress,
        to,
        subject: `${code} is your BuilderOS sign-in code`,
        html: this.template(code, ttlMinutes),
        text: `Your BuilderOS sign-in code is ${code}. It expires in ${ttlMinutes} minutes.`,
      });

      if (error) {
        // Resend returns errors in the body rather than throwing, so this
        // branch is the one that actually fires for the common failures:
        // unverified domain, sending to a non-owned address in test mode,
        // invalid key.
        const reason = this.explain(error.message ?? String(error), to);
        this.logger.error(`Email to ${to} rejected: ${error.message}`);
        this.logger.warn(
          `\n  FALLBACK — code for ${to}: >>> ${code} <<<\n  (delivery failed, so the code is logged instead)`,
        );
        return { status: 'failed', reason };
      }

      this.logger.log(`Sign-in code emailed to ${to}`);
      return { status: 'sent' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Email transport failed for ${to}: ${message}`);
      this.logger.warn(`\n  FALLBACK — code for ${to}: >>> ${code} <<<`);
      return { status: 'failed', reason: this.explain(message, to) };
    }
  }

  /**
   * Turns provider errors into something a person can act on. Resend's raw
   * messages are accurate but assume you know its domain model.
   */
  private explain(raw: string, to: string): string {
    const lower = raw.toLowerCase();

    if (lower.includes('domain') && lower.includes('verif')) {
      return `The sending domain isn't verified yet, so we can only email the account owner. Verify a domain in Resend, or sign in with a wallet.`;
    }
    if (lower.includes('testing') || lower.includes('own email')) {
      return `Email is in testing mode and can only reach the account owner's address, not ${to}. Verify a sending domain to email anyone.`;
    }
    if (lower.includes('api key') || lower.includes('unauthorized')) {
      return `The email provider rejected our API key. This is on us — try wallet sign-in for now.`;
    }
    if (lower.includes('rate') || lower.includes('limit')) {
      return `We've hit the email provider's rate limit. Wait a minute and try again.`;
    }
    return `We couldn't send the email just now. Try wallet sign-in, or try again shortly.`;
  }

  private template(code: string, ttlMinutes: number): string {
    // Deliberately plain HTML: no external images, no web fonts, no CSS that
    // Gmail will strip. Inline styles only, because that is all that
    // survives across mail clients.
    return `
<div style="background:#0b1420;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:420px;margin:0 auto;background:#0f1c2c;border:1px solid rgba(62,124,166,0.3);padding:32px">
    <p style="margin:0 0 4px;color:#b8863b;font-size:11px;letter-spacing:2px;font-family:monospace">BUILDEROS</p>
    <p style="margin:0 0 28px;color:rgba(205,198,176,0.6);font-size:9px;letter-spacing:2px;font-family:monospace">BY GOAT ECOSYSTEM</p>

    <h1 style="margin:0 0 12px;color:#eae4d3;font-size:20px;font-weight:600">Your sign-in code</h1>
    <p style="margin:0 0 24px;color:#cdc6b0;font-size:14px;line-height:1.6">
      Enter this code to sign in. It expires in ${ttlMinutes} minutes and works once.
    </p>

    <div style="background:#0b1420;border:1px solid rgba(217,168,86,0.4);padding:20px;text-align:center;margin-bottom:24px">
      <span style="color:#d9a856;font-size:30px;letter-spacing:10px;font-family:monospace;font-weight:600">${code}</span>
    </div>

    <p style="margin:0;color:rgba(205,198,176,0.55);font-size:12px;line-height:1.6">
      If you didn't request this, you can ignore it — nobody can sign in without the code.
    </p>
  </div>
</div>`.trim();
  }
}
