/**
 * x402 wire types — the `exact` scheme over EVM.
 *
 * These mirror the protocol as specified, not as we would have designed it.
 * Two conventions are load-bearing and easy to get wrong:
 *
 *   1. All integer amounts are DECIMAL STRINGS, never numbers. Token values are
 *      uint256. `Number` silently loses precision above 2^53, and the amount is
 *      part of the signed payload — a value that round-trips through a float
 *      may no longer verify against the signature.
 *
 *   2. Field names are fixed by the spec (`maxAmountRequired`, `payTo`,
 *      `validBefore`). Renaming them to something tidier breaks every
 *      standard client, which is the entire reason for using x402 instead of
 *      inventing a payment header.
 */

/** Scheme identifier. Only `exact` is implemented. */
export type X402Scheme = 'exact';

/**
 * What the server demands, sent inside the 402 body's `accepts` array.
 *
 * Multiple entries mean "any one of these is acceptable". We currently send
 * exactly one, but the array shape is part of the spec and clients iterate it.
 */
export interface PaymentRequirements {
  scheme: X402Scheme;
  /** Network identifier, e.g. `goat-testnet3`. */
  network: string;
  /** Upper bound the client may authorize, decimal string in minor units. */
  maxAmountRequired: string;
  /** Canonical absolute URL of the protected resource. */
  resource: string;
  description: string;
  mimeType: string;
  /** Address the transfer must be made out to. */
  payTo: string;
  /** How long the server will hold the challenge open. */
  maxTimeoutSeconds: number;
  /** ERC-20 contract address of the payment asset. */
  asset: string;
  /**
   * Scheme-specific extras. For `exact` on EVM this carries the EIP-712 domain
   * fields of the asset (`name`, `version`) that the client needs in order to
   * produce a signature this server will accept.
   */
  extra?: Record<string, unknown>;
  /** Non-standard, additive: lets a client show the price without guessing. */
  outputSchema?: Record<string, unknown>;
}

/** Body of the HTTP 402 response. */
export interface PaymentRequiredResponse {
  x402Version: number;
  accepts: PaymentRequirements[];
  error: string;
}

/**
 * EIP-3009 `transferWithAuthorization` parameters.
 *
 * The payer signs these; the asset contract executes them. Note that the payer
 * signs a transfer to `to` — no allowance, no intermediate custody. This is the
 * property that lets BuilderOS meter usage without ever holding a private key
 * or a customer balance.
 */
export interface TransferAuthorization {
  from: string;
  to: string;
  /** Decimal string, minor units. */
  value: string;
  /** Unix seconds, decimal string. */
  validAfter: string;
  /** Unix seconds, decimal string. */
  validBefore: string;
  /** 32-byte hex. Unique per authorization — this is the replay guard. */
  nonce: string;
}

/** Inner payload of the `X-PAYMENT` header for the `exact` scheme. */
export interface ExactEvmPayload {
  /** 65-byte hex signature over the EIP-712 typed data. */
  signature: string;
  authorization: TransferAuthorization;
}

/** Decoded `X-PAYMENT` header. */
export interface PaymentPayload {
  x402Version: number;
  scheme: X402Scheme;
  network: string;
  payload: ExactEvmPayload;
}

/**
 * Result of checking a presented payment.
 *
 * `settled` is tracked separately from `valid` on purpose. A signature can be
 * cryptographically valid and economically sound while the transfer has not
 * been broadcast — that is the normal state when no facilitator is configured.
 * Collapsing the two would let the API claim money moved when it has not.
 */
export interface VerifyResult {
  valid: boolean;
  /** Set when `valid` is false. Safe to return to the client. */
  reason?: string;
  /** Machine-readable failure code for clients that branch on it. */
  code?: X402FailureCode;
  orderId?: string;
  payer?: string;
  amountMinor?: string;
  /** True only when the authorization was broadcast and confirmed. */
  settled: boolean;
  settlementTx?: string;
  /**
   * How settlement was handled. `deferred` means verified and recorded but not
   * broadcast — reported honestly rather than presented as payment.
   */
  settlementMode: 'facilitator' | 'deferred';
}

export type X402FailureCode =
  | 'malformed_header'
  | 'unsupported_scheme'
  | 'network_mismatch'
  | 'wrong_asset'
  | 'wrong_recipient'
  | 'insufficient_amount'
  | 'expired'
  | 'not_yet_valid'
  | 'invalid_signature'
  | 'replayed_nonce'
  | 'settlement_failed'
  | 'misconfigured';

/** Contents of the `X-PAYMENT-RESPONSE` header on a successful paid call. */
export interface PaymentResponseHeader {
  success: boolean;
  transaction: string | null;
  network: string;
  payer: string | null;
  orderId: string;
  settlementMode: 'facilitator' | 'deferred';
}

/** EIP-712 type definition for EIP-3009. Field order is significant. */
export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export const X402_VERSION = 1;
