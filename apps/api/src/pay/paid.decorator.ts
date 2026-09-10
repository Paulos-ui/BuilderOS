import { SetMetadata } from '@nestjs/common';

export const PAID_METADATA_KEY = 'builderos:paid';

export interface PaidMetadata {
  agentKey: string;
  operation: string;
}

/**
 * Marks a route as metered.
 *
 * The price is NOT here — it lives in `pricing.config.ts`, keyed by the same
 * `agentKey:operation` pair. Two reasons. A price inline in a decorator is
 * invisible to `GET /v1/pay/quote`, so the published price list and the price
 * actually charged could drift apart silently, which is the one bug in a
 * payment system that nobody notices until a customer does. And an operation
 * absent from the price table is free by default, so decorating a route can
 * never accidentally start charging for it.
 *
 * @example
 *   @Paid({ agentKey: 'forge', operation: 'score' })
 *   @Post('score')
 *   score(...) {}
 */
export const Paid = (meta: PaidMetadata) =>
  SetMetadata(PAID_METADATA_KEY, meta);
