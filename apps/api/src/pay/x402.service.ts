import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getAddress, isAddress, isHex, size, verifyTypedData } from 'viem';
import { PrismaService } from '../prisma/prisma.service';
import { NetworkConfig } from '../config/network.config';
import {
  ASSET_DEFAULTS,
  CHALLENGE_TIMEOUT_SECONDS,
  CLOCK_SKEW_TOLERANCE_SECONDS,
  PRICE_LIST,
  X402_NETWORK_IDS,
  priceFor,
  type AssetProfile,
  type PriceEntry,
} from './pricing.config';
import {
  TRANSFER_WITH_AUTHORIZATION_TYPES,
  X402_VERSION,
  type PaymentPayload,
  type PaymentRequiredResponse,
  type PaymentRequirements,
  type VerifyResult,
  type X402FailureCode,
} from './x402.types';

/**
 * ── BuilderPay (AG-06): non-custodial x402 metering ───────────────────────
 *
 * Blueprint 9.2: application code never handles private keys. That single
 * constraint determines the whole design here, so it is worth being explicit
 * about what this service does and does not do.
 *
 * It DOES:
 *   - issue a real HTTP 402 with a spec-shaped `accepts` array
 *   - verify the payer's EIP-3009 signature cryptographically, against the
 *     asset contract's own EIP-712 domain
 *   - check that the authorization actually pays us, in the right asset, for
 *     enough, and has not expired
 *   - make nonce reuse impossible via a unique index rather than a read-then-
 *     write check that races under concurrency
 *   - record every attempt, including failures, as a ledger
 *
 * It does NOT:
 *   - hold a private key
 *   - hold customer balances
 *   - broadcast the transfer itself
 *
 * That last point is the honest limitation. Broadcasting `transferWithAuthorization`
 * requires a funded relayer, and a relayer needs a key — exactly what 9.2
 * forbids in application code. The protocol's answer is a facilitator: an
 * external service that broadcasts on your behalf. GOAT has no public
 * facilitator yet, so when `X402_FACILITATOR_URL` is unset this service
 * verifies and records but reports `settlementMode: 'deferred'` and
 * `settled: false` everywhere it surfaces.
 *
 * Deferred is not the same as paid, and nothing in this file pretends
 * otherwise. The authorizations are retained and remain valid until
 * `validBefore`, so they are broadcastable later by whoever holds a relayer —
 * but until that happens the ledger says so plainly. Claiming settlement we
 * cannot demonstrate would be the single worst thing to put in front of an
 * ecosystem reviewer who can check the chain.
 */
@Injectable()
export class X402Service {
  private readonly logger = new Logger(X402Service.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly network: NetworkConfig,
  ) {
    if (this.meteringEnabled && !this.configured) {
      // Loud, because the intent and the reality disagree: someone asked for
      // metering and it will not happen.
      this.logger.warn(
        'X402_METERING_ENABLED=true but BuilderPay is not fully configured ' +
          `(${this.missingConfig().join(', ')}). Serving all calls free.`,
      );
    }
  }

  // ── configuration ────────────────────────────────────────────────────────

  get meteringEnabled(): boolean {
    return this.config.get<string>('X402_METERING_ENABLED') === 'true';
  }

  get networkId(): string {
    return X402_NETWORK_IDS[this.network.name];
  }

  get asset(): AssetProfile {
    const defaults = ASSET_DEFAULTS[this.network.name];
    const address = this.config.get<string>('X402_ASSET_ADDRESS') ?? defaults.address;
    return {
      address: address && isAddress(address) ? getAddress(address) : null,
      symbol: this.config.get<string>('X402_ASSET_SYMBOL') ?? defaults.symbol,
      decimals: Number(
        this.config.get<string>('X402_ASSET_DECIMALS') ?? defaults.decimals,
      ),
      eip712Name:
        this.config.get<string>('X402_ASSET_EIP712_NAME') ?? defaults.eip712Name,
      eip712Version:
        this.config.get<string>('X402_ASSET_EIP712_VERSION') ??
        defaults.eip712Version,
    };
  }

  get payTo(): string | null {
    const raw = this.config.get<string>('X402_PAY_TO');
    return raw && isAddress(raw) ? getAddress(raw) : null;
  }

  get facilitatorUrl(): string | null {
    return this.config.get<string>('X402_FACILITATOR_URL') ?? null;
  }

  get settlementMode(): 'facilitator' | 'deferred' {
    return this.facilitatorUrl ? 'facilitator' : 'deferred';
  }

  /** True when a challenge could actually be satisfied by a payer. */
  get configured(): boolean {
    return this.asset.address !== null && this.payTo !== null;
  }

  /** True when a paid endpoint should actually demand payment. */
  get active(): boolean {
    return this.meteringEnabled && this.configured;
  }

  private missingConfig(): string[] {
    const missing: string[] = [];
    if (!this.asset.address) missing.push('X402_ASSET_ADDRESS');
    if (!this.payTo) missing.push('X402_PAY_TO');
    return missing;
  }

  /**
   * Public self-report, surfaced by `GET /v1/pay/quote` and the agents feed.
   *
   * Deliberately verbose about what is not working. An operator debugging why
   * nothing is being charged should not have to read this file.
   */
  status() {
    const asset = this.asset;
    return {
      meteringEnabled: this.meteringEnabled,
      configured: this.configured,
      active: this.active,
      network: this.networkId,
      chainId: this.network.chain.id,
      asset: asset.address
        ? {
            address: asset.address,
            symbol: asset.symbol,
            decimals: asset.decimals,
          }
        : null,
      payTo: this.payTo,
      settlementMode: this.settlementMode,
      missingConfig: this.missingConfig(),
      note: this.explain(),
    };
  }

  private explain(): string {
    if (!this.configured) {
      return `BuilderPay is not configured (${this.missingConfig().join(
        ', ',
      )} unset), so every agent call is free. Prices below are published in advance, not charged.`;
    }
    if (!this.meteringEnabled) {
      return 'BuilderPay is configured but metering is switched off, so every agent call is free. Prices below are what would apply.';
    }
    if (this.settlementMode === 'deferred') {
      return 'Payments are challenged and verified on-chain-signature level, but not broadcast: no x402 facilitator is configured for GOAT yet, so authorizations are recorded as verified-unsettled rather than counted as paid.';
    }
    return 'Agent calls are metered and settled over x402 on GOAT Network.';
  }

  // ── challenge ────────────────────────────────────────────────────────────

  /** The full price list, with live config context. For `GET /v1/pay/quote`. */
  quote() {
    const asset = this.asset;
    return {
      ...this.status(),
      prices: Object.values(PRICE_LIST).map((p) => ({
        ...p,
        amountDisplay: formatMinor(p.amountMinor, asset.decimals, asset.symbol),
      })),
    };
  }

  /**
   * Payment requirements for one operation, or null when it is free.
   *
   * Null covers three distinct cases that all mean "serve it": the operation
   * is not priced, metering is off, or BuilderPay is not configured. Callers
   * treat them identically, and `status()` is where the difference is
   * explained.
   */
  buildRequirements(
    agentKey: string,
    operation: string,
    resource: string,
  ): PaymentRequirements | null {
    if (!this.active) return null;
    const price = priceFor(agentKey, operation);
    if (!price) return null;

    const asset = this.asset;
    // Both non-null by `this.active`, but the compiler does not know that and a
    // non-null assertion here would be the exact place a misconfiguration
    // becomes an unsigned-transfer bug.
    if (!asset.address || !this.payTo) return null;

    return {
      scheme: 'exact',
      network: this.networkId,
      maxAmountRequired: price.amountMinor,
      resource,
      description: price.description,
      mimeType: 'application/json',
      payTo: this.payTo,
      maxTimeoutSeconds: CHALLENGE_TIMEOUT_SECONDS,
      asset: asset.address,
      // The payer needs the asset's own EIP-712 domain to produce a signature
      // this server will accept. Omitting it forces clients to guess, and a
      // wrong guess fails verification with no way to tell why.
      extra: {
        name: asset.eip712Name,
        version: asset.eip712Version,
      },
      outputSchema: {
        amountDisplay: formatMinor(
          price.amountMinor,
          asset.decimals,
          asset.symbol,
        ),
      },
    };
  }

  /** Body for the 402 response, and a REQUIRED order row for the ledger. */
  async challenge(
    requirements: PaymentRequirements,
    context: { agentKey: string; operation: string; builderProfileId?: string },
  ): Promise<PaymentRequiredResponse> {
    // Recorded so the ledger shows demand that was never satisfied — a builder
    // who hit a paywall and walked away is a fact worth keeping.
    await this.safeCreateOrder({
      builderProfileId: context.builderProfileId ?? null,
      agentKey: context.agentKey,
      operation: context.operation,
      resource: requirements.resource,
      network: requirements.network,
      asset: requirements.asset,
      payTo: requirements.payTo,
      amountMinor: requirements.maxAmountRequired,
      currency: this.asset.symbol,
      status: 'REQUIRED',
    });

    return {
      x402Version: X402_VERSION,
      accepts: [requirements],
      error: 'X-PAYMENT header is required to access this resource.',
    };
  }

  // ── verification ─────────────────────────────────────────────────────────

  /**
   * Decode the `X-PAYMENT` header.
   *
   * Base64-encoded JSON per spec. Returns null on anything malformed rather
   * than throwing, because a bad header is a client error to be reported as a
   * 402, not a 500.
   */
  decode(header: string): PaymentPayload | null {
    try {
      const json = Buffer.from(header, 'base64').toString('utf8');
      const parsed: unknown = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') return null;

      const p = parsed as Record<string, unknown>;
      const inner = p.payload as Record<string, unknown> | undefined;
      const auth = inner?.authorization as Record<string, unknown> | undefined;
      if (!inner || !auth) return null;
      if (typeof inner.signature !== 'string') return null;

      const required = [
        'from',
        'to',
        'value',
        'validAfter',
        'validBefore',
        'nonce',
      ] as const;
      for (const field of required) {
        if (typeof auth[field] !== 'string') return null;
      }

      return {
        x402Version: Number(p.x402Version ?? X402_VERSION),
        scheme: p.scheme as 'exact',
        network: String(p.network ?? ''),
        payload: {
          signature: inner.signature,
          authorization: {
            from: String(auth.from),
            to: String(auth.to),
            value: String(auth.value),
            validAfter: String(auth.validAfter),
            validBefore: String(auth.validBefore),
            nonce: String(auth.nonce),
          },
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Check a presented payment against what we asked for.
   *
   * The order of checks is chosen so that cheap, non-cryptographic rejections
   * happen first, and the nonce is only claimed AFTER the signature verifies.
   * Claiming first would let an unauthenticated caller burn arbitrary nonces
   * and permanently poison payments they do not own.
   */
  async verify(
    header: string,
    requirements: PaymentRequirements,
    context: { agentKey: string; operation: string; builderProfileId?: string },
  ): Promise<VerifyResult> {
    const payload = this.decode(header);
    if (!payload) {
      return this.fail(
        'malformed_header',
        'X-PAYMENT header is not valid base64-encoded x402 JSON.',
      );
    }

    if (payload.scheme !== 'exact') {
      return this.fail(
        'unsupported_scheme',
        `Payment scheme "${payload.scheme}" is not supported. Use "exact".`,
      );
    }

    if (payload.network !== requirements.network) {
      return this.fail(
        'network_mismatch',
        `Payment is for network "${payload.network}" but this resource requires "${requirements.network}".`,
      );
    }

    const auth = payload.payload.authorization;

    if (!isAddress(auth.from) || !isAddress(auth.to)) {
      return this.fail(
        'malformed_header',
        'Authorization contains an address that is not a valid EVM address.',
      );
    }

    if (getAddress(auth.to) !== getAddress(requirements.payTo)) {
      return this.fail(
        'wrong_recipient',
        'Authorization pays a different address than this resource requires.',
      );
    }

    // Nonce must be 32 bytes. A short nonce would still hash and could collide
    // with a value the payer did not intend to authorize.
    if (!isHex(auth.nonce) || size(auth.nonce) !== 32) {
      return this.fail(
        'malformed_header',
        'Authorization nonce must be 32 bytes of hex.',
      );
    }

    let value: bigint;
    let validAfter: bigint;
    let validBefore: bigint;
    try {
      value = BigInt(auth.value);
      validAfter = BigInt(auth.validAfter);
      validBefore = BigInt(auth.validBefore);
    } catch {
      return this.fail(
        'malformed_header',
        'Authorization amounts and timestamps must be integer strings.',
      );
    }

    const required = BigInt(requirements.maxAmountRequired);
    if (value < required) {
      return this.fail(
        'insufficient_amount',
        `Authorization is for ${value.toString()} but this resource costs ${required.toString()}.`,
      );
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    const skew = BigInt(CLOCK_SKEW_TOLERANCE_SECONDS);
    if (validBefore + skew <= now) {
      return this.fail(
        'expired',
        'Authorization has expired. Request a new payment challenge.',
      );
    }
    if (validAfter > now + skew) {
      return this.fail(
        'not_yet_valid',
        'Authorization is not valid yet — validAfter is in the future.',
      );
    }

    // Cryptographic check. The domain must match the asset contract exactly:
    // same name, version, chainId and verifyingContract the token uses, or a
    // perfectly honest signature will not recover to the payer.
    let signatureValid = false;
    try {
      signatureValid = await verifyTypedData({
        address: getAddress(auth.from),
        domain: {
          name: this.asset.eip712Name,
          version: this.asset.eip712Version,
          chainId: this.network.chain.id,
          verifyingContract: getAddress(requirements.asset),
        },
        types: TRANSFER_WITH_AUTHORIZATION_TYPES,
        primaryType: 'TransferWithAuthorization',
        message: {
          from: getAddress(auth.from),
          to: getAddress(auth.to),
          value,
          validAfter,
          validBefore,
          nonce: auth.nonce,
        },
        signature: payload.payload.signature as `0x${string}`,
      });
    } catch (err) {
      this.logger.warn(
        `Signature verification threw: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return this.fail(
        'invalid_signature',
        'Payment signature could not be verified.',
      );
    }

    if (!signatureValid) {
      return this.fail(
        'invalid_signature',
        'Payment signature does not match the authorization or the payer address.',
      );
    }

    // Claim the nonce. The unique index does the work — this is the only
    // check in the file that is safe under concurrent requests, which is
    // exactly why replay protection is enforced here and not by a prior read.
    let orderId: string;
    try {
      const order = await this.prisma.x402Order.create({
        data: {
          builderProfileId: context.builderProfileId ?? null,
          agentKey: context.agentKey,
          operation: context.operation,
          resource: requirements.resource,
          scheme: 'exact',
          network: requirements.network,
          asset: getAddress(requirements.asset),
          payTo: getAddress(requirements.payTo),
          amountMinor: value.toString(),
          currency: this.asset.symbol,
          payerAddress: getAddress(auth.from),
          nonce: auth.nonce.toLowerCase(),
          status: 'VERIFIED',
          validBefore: new Date(Number(validBefore) * 1000),
          verifiedAt: new Date(),
        },
        select: { id: true },
      });
      orderId = order.id;
    } catch (err) {
      if (isUniqueViolation(err)) {
        return this.fail(
          'replayed_nonce',
          'This payment authorization has already been used. Sign a new one.',
        );
      }
      this.logger.error(
        `Order persistence failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // Refusing to serve is the right call: without a persisted nonce we
      // cannot prevent this same authorization being replayed, and serving
      // free is preferable to serving unbounded.
      return this.fail(
        'settlement_failed',
        'Payment could not be recorded. Nothing was charged; please retry.',
      );
    }

    const settlement = await this.settle(orderId, payload);

    return {
      valid: true,
      orderId,
      payer: getAddress(auth.from),
      amountMinor: value.toString(),
      settled: settlement.settled,
      settlementTx: settlement.tx ?? undefined,
      settlementMode: this.settlementMode,
    };
  }

  /**
   * Hand the authorization to a facilitator, if one is configured.
   *
   * No facilitator means no broadcast, and the order stays VERIFIED rather
   * than becoming SETTLED. A settlement failure does not fail the request: the
   * signature was valid and the payer did their part, so refusing service
   * would punish them for our infrastructure. It is recorded as FAILED and
   * shows up in the ledger for follow-up.
   */
  private async settle(
    orderId: string,
    payload: PaymentPayload,
  ): Promise<{ settled: boolean; tx: string | null }> {
    const url = this.facilitatorUrl;
    if (!url) return { settled: false, tx: null };

    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/settle`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          x402Version: X402_VERSION,
          paymentPayload: payload,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        await this.markFailed(orderId, `facilitator returned ${res.status}`);
        return { settled: false, tx: null };
      }

      const body = (await res.json()) as {
        success?: boolean;
        transaction?: string;
        errorReason?: string;
      };

      if (!body.success || !body.transaction) {
        await this.markFailed(
          orderId,
          body.errorReason ?? 'facilitator declined without a reason',
        );
        return { settled: false, tx: null };
      }

      await this.prisma.x402Order.update({
        where: { id: orderId },
        data: {
          status: 'SETTLED',
          settlementTx: body.transaction,
          settledAt: new Date(),
        },
      });
      return { settled: true, tx: body.transaction };
    } catch (err) {
      await this.markFailed(
        orderId,
        err instanceof Error ? err.message : String(err),
      );
      return { settled: false, tx: null };
    }
  }

  private async markFailed(orderId: string, reason: string): Promise<void> {
    this.logger.warn(`x402 settlement failed for ${orderId}: ${reason}`);
    try {
      await this.prisma.x402Order.update({
        where: { id: orderId },
        data: { status: 'FAILED', failureReason: reason.slice(0, 500) },
      });
    } catch {
      // Already logged above; a failed status write must not mask the original.
    }
  }

  // ── ledger ───────────────────────────────────────────────────────────────

  async ledger(builderProfileId: string, limit = 50) {
    const asset = this.asset;
    const [orders, counts] = await Promise.all([
      this.prisma.x402Order.findMany({
        where: { builderProfileId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 200),
      }),
      this.prisma.x402Order.groupBy({
        by: ['status'],
        where: { builderProfileId },
        _count: { _all: true },
      }),
    ]);

    const byStatus = Object.fromEntries(
      counts.map((c) => [c.status, c._count._all]),
    ) as Record<string, number>;

    // Only SETTLED counts towards money that moved. VERIFIED is an authorized
    // but unbroadcast transfer and is reported separately, never folded in.
    const settledMinor = orders
      .filter((o) => o.status === 'SETTLED')
      .reduce((sum, o) => sum + BigInt(o.amountMinor), 0n);
    const authorizedMinor = orders
      .filter((o) => o.status === 'VERIFIED')
      .reduce((sum, o) => sum + BigInt(o.amountMinor), 0n);

    return {
      ...this.status(),
      totals: {
        challenged: byStatus.REQUIRED ?? 0,
        verified: byStatus.VERIFIED ?? 0,
        settled: byStatus.SETTLED ?? 0,
        failed: byStatus.FAILED ?? 0,
        settledMinor: settledMinor.toString(),
        settledDisplay: formatMinor(
          settledMinor.toString(),
          asset.decimals,
          asset.symbol,
        ),
        authorizedUnsettledMinor: authorizedMinor.toString(),
        authorizedUnsettledDisplay: formatMinor(
          authorizedMinor.toString(),
          asset.decimals,
          asset.symbol,
        ),
      },
      orders: orders.map((o) => ({
        id: o.id,
        agentKey: o.agentKey,
        operation: o.operation,
        status: o.status,
        amountMinor: o.amountMinor,
        amountDisplay: formatMinor(o.amountMinor, asset.decimals, o.currency),
        currency: o.currency,
        payerAddress: o.payerAddress,
        settlementTx: o.settlementTx,
        explorerUrl: o.settlementTx
          ? `${this.network.explorerUrl}/tx/${o.settlementTx}`
          : null,
        failureReason: o.failureReason,
        createdAt: o.createdAt.toISOString(),
        verifiedAt: o.verifiedAt?.toISOString() ?? null,
        settledAt: o.settledAt?.toISOString() ?? null,
      })),
    };
  }

  /** A single order, scoped to its owner so ids are not enumerable across accounts. */
  async order(builderProfileId: string, orderId: string) {
    const asset = this.asset;
    const found = await this.prisma.x402Order.findFirst({
      where: { id: orderId, builderProfileId },
    });
    if (!found) return null;
    return {
      id: found.id,
      agentKey: found.agentKey,
      operation: found.operation,
      resource: found.resource,
      status: found.status,
      network: found.network,
      asset: found.asset,
      payTo: found.payTo,
      amountMinor: found.amountMinor,
      amountDisplay: formatMinor(
        found.amountMinor,
        asset.decimals,
        found.currency,
      ),
      currency: found.currency,
      payerAddress: found.payerAddress,
      settlementTx: found.settlementTx,
      explorerUrl: found.settlementTx
        ? `${this.network.explorerUrl}/tx/${found.settlementTx}`
        : null,
      failureReason: found.failureReason,
      settlementMode: this.settlementMode,
      createdAt: found.createdAt.toISOString(),
      verifiedAt: found.verifiedAt?.toISOString() ?? null,
      settledAt: found.settledAt?.toISOString() ?? null,
    };
  }

  /**
   * Create a challenge for an operation without invoking it.
   *
   * This is what `POST /v1/x402/orders` serves — the endpoint the two
   * registered on-chain agents already advertise. A client can obtain payment
   * requirements up front rather than discovering them by triggering a 402.
   */
  async createOrder(
    agentKey: string,
    operation: string,
    resource: string,
    builderProfileId?: string,
  ): Promise<
    | { free: true; reason: string; price: PriceEntry | null }
    | { free: false; challenge: PaymentRequiredResponse }
  > {
    const price = priceFor(agentKey, operation);
    const requirements = this.buildRequirements(agentKey, operation, resource);

    if (!requirements) {
      return {
        free: true,
        reason: price ? this.explain() : 'This operation is not metered.',
        price,
      };
    }

    return {
      free: false,
      challenge: await this.challenge(requirements, {
        agentKey,
        operation,
        builderProfileId,
      }),
    };
  }

  private async safeCreateOrder(data: {
    builderProfileId: string | null;
    agentKey: string;
    operation: string;
    resource: string;
    network: string;
    asset: string;
    payTo: string;
    amountMinor: string;
    currency: string;
    status: 'REQUIRED';
  }): Promise<void> {
    try {
      await this.prisma.x402Order.create({ data });
    } catch (err) {
      // A ledger write must never be the reason a challenge cannot be issued.
      this.logger.warn(
        `Challenge record failed (non-fatal): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private fail(code: X402FailureCode, reason: string): VerifyResult {
    return {
      valid: false,
      code,
      reason,
      settled: false,
      settlementMode: this.settlementMode,
    };
  }
}

// ── pure helpers, exported for tests ───────────────────────────────────────

/**
 * Minor units to a human string, without floating point.
 *
 * `Number(minor) / 10 ** decimals` is the obvious version and it is wrong for
 * large uint256 values: the division happens in a double and loses precision
 * silently. Since these strings are shown next to money, the arithmetic is
 * done on the digits instead.
 */
export function formatMinor(
  minor: string,
  decimals: number,
  symbol: string,
): string {
  let negative = false;
  let digits = minor;
  if (digits.startsWith('-')) {
    negative = true;
    digits = digits.slice(1);
  }
  if (!/^\d+$/.test(digits)) return `${minor} ${symbol}`;

  const padded = digits.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals) || '0';
  const fraction = decimals > 0 ? padded.slice(padded.length - decimals) : '';
  const trimmed = fraction.replace(/0+$/, '');
  const body = trimmed ? `${whole}.${trimmed}` : whole;
  return `${negative ? '-' : ''}${body} ${symbol}`;
}

/** Prisma's unique-constraint error, without importing the error class. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'P2002'
  );
}
