import type { NetworkName } from '../config/network.config';

/**
 * What each metered operation costs.
 *
 * ── Why prices live in one table ──────────────────────────────────────────
 *
 * A price that appears inside a controller decorator is a price nobody can
 * audit. Here the whole surface is readable in one screen, which matters for
 * two reasons: the 402 challenge and the ledger must quote the same number (a
 * mismatch means a client authorizes an amount the server then rejects), and
 * `GET /v1/pay/quote` publishes this table verbatim so a builder can see the
 * cost of every operation before running any of them.
 *
 * ── On the amounts ────────────────────────────────────────────────────────
 *
 * These are deliberately small — fractions of a cent. The purpose during the
 * private beta is to prove the protocol path end to end, not to raise revenue
 * from ten testers. Metering is also OFF by default (`X402_METERING_ENABLED`),
 * so these are the prices that would apply, published in advance, rather than
 * charges anyone is currently incurring.
 */

export interface PriceEntry {
  agentKey: string;
  operation: string;
  /** Minor units of the configured asset, as a decimal string. */
  amountMinor: string;
  /**
   * The route this price applies to, absolute path.
   *
   * Recorded here so `POST /v1/x402/orders` and the interceptor derive the same
   * `resource` string. They must agree exactly: a client that pre-fetches
   * requirements signs over `resource`, and a mismatch means the signature it
   * produces is for a resource the operation call does not recognise.
   */
  route: string;
  description: string;
}

/**
 * Keyed `agentKey:operation`. Anything absent from this table is free, which
 * is the safe default: a new endpoint cannot accidentally start charging
 * because someone forgot to price it.
 *
 * Two rules, both enforced by agents.config.spec.ts:
 *
 *   - Only agents that advertise `x402Support` may appear here. Charging for an
 *     agent whose published capabilities say it takes no payment would issue a
 *     402 no client was told to expect.
 *   - Only routes that exist may appear here. An entry for an unbuilt endpoint
 *     publishes a price for something that returns 404 — which is exactly the
 *     kind of small dishonesty that costs credibility when someone checks.
 *
 * BuilderMatch is deliberately absent: its manifest declares x402Support false,
 * so collaborator matching is free. ProofForge document generation is absent
 * because that route is not built yet. BuilderScout is absent because its only
 * write route is admin-token protected ingestion, and its read route is the
 * opportunity feed — paywalling the core feed during a private beta would be a
 * product decision, not a metering one.
 *
 * So there is exactly one metered operation. That is the honest state: enough
 * to prove the protocol end to end, and no prices published for anything a
 * builder cannot actually buy.
 */
export const PRICE_LIST: Record<string, PriceEntry> = {
  'forge:score': {
    agentKey: 'forge',
    operation: 'score',
    // 6-decimal asset, so 2500 = $0.0025.
    amountMinor: '2500',
    route: '/v1/proofforge/score',
    description: 'ProofForge — score an application draft against reviewer criteria',
  },
};

export function priceFor(
  agentKey: string,
  operation: string,
): PriceEntry | null {
  return PRICE_LIST[`${agentKey}:${operation}`] ?? null;
}

/**
 * Asset defaults per network.
 *
 * Left as null where we do not have a confirmed stablecoin contract address.
 * That is not an oversight to be filled in with a plausible-looking address:
 * a wrong `asset` in a payment challenge asks the payer to sign an
 * authorization against a contract that is not what we think it is. When the
 * address is unknown, BuilderPay reports itself unconfigured and serves calls
 * free rather than issuing a challenge nobody can safely satisfy.
 */
export interface AssetProfile {
  address: string | null;
  symbol: string;
  decimals: number;
  /** EIP-712 domain `name` of the asset contract. */
  eip712Name: string;
  /** EIP-712 domain `version` of the asset contract. */
  eip712Version: string;
}

export const ASSET_DEFAULTS: Record<NetworkName, AssetProfile> = {
  mainnet: {
    address: null,
    symbol: 'USDC',
    decimals: 6,
    eip712Name: 'USD Coin',
    eip712Version: '2',
  },
  testnet3: {
    address: null,
    symbol: 'USDC',
    decimals: 6,
    eip712Name: 'USD Coin',
    eip712Version: '2',
  },
};

/** x402 network identifiers. Distinct from viem chain names. */
export const X402_NETWORK_IDS: Record<NetworkName, string> = {
  mainnet: 'goat',
  testnet3: 'goat-testnet3',
};

/** How long a challenge stays open. Long enough for a wallet prompt. */
export const CHALLENGE_TIMEOUT_SECONDS = 300;

/**
 * Slack allowed on `validBefore` when checking expiry.
 *
 * Clock skew between a browser and this server is routinely a few seconds. With
 * zero tolerance, a wallet that signs a 300-second authorization can have it
 * rejected as expired on arrival, which looks like a broken payment for no
 * discoverable reason.
 */
export const CLOCK_SKEW_TOLERANCE_SECONDS = 60;
