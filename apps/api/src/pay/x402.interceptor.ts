import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { tap } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { X402Service } from './x402.service';
import { PAID_METADATA_KEY, type PaidMetadata } from './paid.decorator';
import { priceFor } from './pricing.config';
import type { PaymentResponseHeader } from './x402.types';

/**
 * Turns `@Paid()` into an actual HTTP 402 exchange.
 *
 * ── Why an interceptor and not a guard ────────────────────────────────────
 *
 * A guard can reject, which covers the 402 half. It cannot cleanly attach a
 * response header on the way back out, and x402 requires the server to return
 * `X-PAYMENT-RESPONSE` describing what happened to the payment. Splitting that
 * across a guard and an interceptor would put the two halves of one protocol
 * exchange in two files.
 *
 * ── The failure posture ───────────────────────────────────────────────────
 *
 * If anything about this interceptor's own machinery breaks — config missing,
 * an unexpected throw while building a challenge — the request is SERVED, not
 * refused. That asymmetry is deliberate and matches the rule already
 * established in UsageService: billing must not be able to break the product.
 * A metering bug that takes ProofForge offline during a private beta costs far
 * more than the fractions of a cent it fails to collect. Payment failures the
 * PAYER caused (bad signature, replay, expired) are still rejected — those are
 * the cases the protocol exists to catch.
 */
@Injectable()
export class X402Interceptor implements NestInterceptor {
  private readonly logger = new Logger(X402Interceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly x402: X402Service,
    private readonly config: ConfigService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const meta = this.reflector.getAllAndOverride<PaidMetadata | undefined>(
      PAID_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    let requirements;
    try {
      requirements = this.x402.buildRequirements(
        meta.agentKey,
        meta.operation,
        this.resourceUrl(meta),
      );
    } catch (err) {
      this.logger.error(
        `Could not build payment requirements, serving free: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return next.handle();
    }

    // Free: not priced, metering off, or BuilderPay unconfigured.
    if (!requirements) return next.handle();

    const builderProfileId = (
      req as Request & { user?: { builderProfileId?: string } }
    ).user?.builderProfileId;

    const header = firstHeader(req.headers['x-payment']);

    if (!header) {
      throw new HttpException(
        await this.x402.challenge(requirements, {
          agentKey: meta.agentKey,
          operation: meta.operation,
          builderProfileId,
        }),
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    let result;
    try {
      result = await this.x402.verify(header, requirements, {
        agentKey: meta.agentKey,
        operation: meta.operation,
        builderProfileId,
      });
    } catch (err) {
      // Our bug, not theirs. Serve it.
      this.logger.error(
        `Payment verification threw unexpectedly, serving free: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return next.handle();
    }

    if (!result.valid) {
      // Re-issue the requirements alongside the error. A client that signed
      // the wrong thing needs to see what was actually expected, and per spec
      // a rejected payment is another 402 rather than a 400.
      throw new HttpException(
        {
          x402Version: 1,
          accepts: [requirements],
          error: result.reason ?? 'Payment could not be verified.',
          code: result.code,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const responseHeader: PaymentResponseHeader = {
      success: true,
      transaction: result.settlementTx ?? null,
      network: requirements.network,
      payer: result.payer ?? null,
      orderId: result.orderId ?? '',
      settlementMode: result.settlementMode,
    };

    return next.handle().pipe(
      tap(() => {
        try {
          res.setHeader(
            'X-PAYMENT-RESPONSE',
            Buffer.from(JSON.stringify(responseHeader)).toString('base64'),
          );
        } catch {
          // Headers already sent (streamed response). The order row is the
          // durable record; the header is a convenience.
        }
      }),
    );
  }

  /**
   * Absolute URL of the resource being paid for.
   *
   * Taken from the price table rather than from the live request. Two reasons.
   * The Host header is attacker-controlled, so deriving the origin from it would
   * let a caller mint challenges naming any domain they like. And the path must
   * match what `POST /v1/x402/orders` returns for the same operation — a client
   * signs over `resource`, so if the two derivations disagree by even a trailing
   * segment, a correctly signed payment fails to verify with nothing in the
   * error to explain it.
   */
  private resourceUrl(meta: PaidMetadata): string {
    const base = (
      this.config.get<string>('PUBLIC_API_BASE') ??
      this.config.get<string>('API_BASE_URL') ??
      'https://api.builderos.dev'
    ).replace(/\/$/, '');
    const price = priceFor(meta.agentKey, meta.operation);
    return `${base}${price?.route ?? `/v1/${meta.agentKey}/${meta.operation}`}`;
  }
}

function firstHeader(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
