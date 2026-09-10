import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { X402Service } from './x402.service';
import { priceFor } from './pricing.config';

/**
 * BuilderPay (AG-06) — the builder's own settlement view.
 *
 * Authenticated and scoped to the caller's profile throughout. A payment
 * ledger is the most sensitive surface in the product: it links a builder to a
 * wallet address and an amount, so `order()` filters by owner rather than
 * looking up by id alone. Filtering only by id would make order ids a
 * cross-account read primitive.
 */
@UseGuards(JwtAuthGuard)
@Controller('v1/pay')
export class PayController {
  constructor(private readonly x402: X402Service) {}

  /**
   * Every metered operation and its price, plus whether metering is live.
   *
   * Authenticated because it is the console's view. The unauthenticated
   * equivalent for external agents is `GET /v1/x402/orders`.
   */
  @Get('quote')
  quote() {
    return this.x402.quote();
  }

  /** Settlement history for the signed-in builder. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('ledger')
  ledger(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.x402.ledger(user.builderProfileId, limit ?? 50);
  }

  @Get('orders/:id')
  async order(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const found = await this.x402.order(user.builderProfileId, id);
    if (!found) throw new NotFoundException('Order not found.');
    return found;
  }
}

interface CreateOrderBody {
  agentKey?: string;
  operation?: string;
}

/**
 * The x402 service endpoint advertised in our ERC-8004 registrations.
 *
 * ── Why this is unauthenticated ───────────────────────────────────────────
 *
 * Agents #341 and #342 are registered on GOAT testnet3 with an agent card
 * naming this path as their x402 service endpoint. Anyone reading the Identity
 * Registry — including the ecosystem team evaluating a grant — can resolve that
 * URL, and until now it returned 404. A registry entry pointing at a dead
 * endpoint is worse than no entry.
 *
 * The callers are other agents, which by definition have no BuilderOS account,
 * so requiring a JWT here would keep it effectively dead. What it returns is
 * safe to publish: a price and the address to pay, both of which are meant to
 * be public. No builder data passes through it. It is throttled harder than the
 * global default because it is open.
 */
@Controller('v1/x402')
export class X402Controller {
  constructor(private readonly x402: X402Service) {}

  /** Discovery: the price list and current settlement posture. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('orders')
  discover() {
    return {
      service: 'BuilderPay',
      agent: 'AG-06',
      protocol: 'x402',
      x402Version: 1,
      ...this.x402.quote(),
      usage: {
        method: 'POST',
        endpoint: '/v1/x402/orders',
        body: { agentKey: 'forge', operation: 'score' },
        describes:
          'Returns HTTP 200 with payment requirements when the operation is metered, or a free-of-charge notice when it is not. Present the resulting authorization as a base64 X-PAYMENT header on the operation call itself.',
      },
    };
  }

  /**
   * Obtain payment requirements for an operation without invoking it.
   *
   * Returns 200 rather than 402 on purpose. A 402 here would be a lie about
   * the resource being requested — nothing is being withheld, the caller asked
   * a question about price and got an answer. The 402 belongs on the metered
   * operation itself, which is where the interceptor puts it.
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('orders')
  create(@Body() body: CreateOrderBody) {
    const agentKey = (body.agentKey ?? '').trim().toLowerCase();
    const operation = (body.operation ?? '').trim().toLowerCase();

    if (!agentKey || !operation) {
      return {
        error:
          'Provide agentKey and operation. Call GET /v1/x402/orders for the list of metered operations.',
      };
    }

    return this.x402.createOrder(agentKey, operation, resourceFor(agentKey, operation));
  }
}

/**
 * Canonical resource URL per operation.
 *
 * Reads the route from the price table, which is the same table the interceptor
 * prices against — so a client that pre-fetches requirements here signs over
 * exactly the `resource` string the operation call will expect. Deriving it
 * separately in two places is how those two strings drift apart, and a drifted
 * resource fails verification with nothing in the error to explain why.
 */
function resourceFor(agentKey: string, operation: string): string {
  const base = (
    process.env.PUBLIC_API_BASE ??
    process.env.API_BASE_URL ??
    'https://api.builderos.dev'
  ).replace(/\/$/, '');

  const price = priceFor(agentKey, operation);
  return `${base}${price?.route ?? `/v1/${agentKey}/${operation}`}`;
}
