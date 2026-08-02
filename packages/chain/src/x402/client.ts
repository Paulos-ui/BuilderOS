/**
 * x402 client for GOAT Network.
 *
 * The single most important thing to understand about this integration:
 * **HTTP 402 is the normal success path, not an error.** A 402 response
 * carries the payment payload the client needs in order to pay. Any generic
 * `if (!res.ok) throw` wrapper placed around this will break the protocol,
 * which is why order creation below handles 402 explicitly before any
 * status check.
 *
 * Credentials are server-side only. GOATX402_API_SECRET must never reach a
 * frontend bundle or a NEXT_PUBLIC_* variable.
 */

export type PaymentMode = 'DIRECT' | 'DELEGATE';

export interface X402Config {
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
  merchantId: string;
}

export interface CreateOrderInput {
  /** Smallest-unit amount, as a string to avoid float precision loss. */
  amount: string;
  currency: string;
  /**
   * DIRECT: the payer pays the merchant address directly, no callback.
   * DELEGATE: settlement runs through delegated infrastructure and may
   * trigger contract logic. Use DIRECT unless you need the callback.
   */
  mode: PaymentMode;
  /** Your own reference, so you can reconcile against your DB. */
  reference: string;
  description?: string;
  metadata?: Record<string, string>;
}

export type OrderStatus =
  | 'PENDING'
  | 'AWAITING_PAYMENT'
  | 'SETTLED'
  | 'EXPIRED'
  | 'FAILED';

export interface X402Order {
  orderId: string;
  status: OrderStatus;
  /** Present when the API returns 402 — this is what the client signs/pays. */
  paymentPayload?: unknown;
  amount: string;
  currency: string;
  reference: string;
}

export interface X402Proof {
  orderId: string;
  txHash?: string;
  settledAt?: string;
  raw: unknown;
}

const TERMINAL_STATUSES: readonly OrderStatus[] = [
  'SETTLED',
  'EXPIRED',
  'FAILED',
];

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export class X402Client {
  constructor(private readonly config: X402Config) {
    if (!config.apiSecret) {
      throw new Error('X402Client requires an apiSecret (server-side only).');
    }
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
      'X-API-Secret': this.config.apiSecret,
      'X-Merchant-Id': this.config.merchantId,
    };
  }

  /**
   * Creates an order. Returns normally on both 200 and 402 — see the note
   * at the top of this file.
   */
  async createOrder(input: CreateOrderInput): Promise<X402Order> {
    const res = await fetch(`${this.config.apiUrl}/v1/orders`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        merchantId: this.config.merchantId,
        ...input,
      }),
    });

    // 402 is the expected "payment required" success path.
    if (res.status === 402 || res.ok) {
      return (await res.json()) as X402Order;
    }

    const body = await res.text();
    throw new Error(`x402 order creation failed (${res.status}): ${body}`);
  }

  async getOrder(orderId: string): Promise<X402Order> {
    const res = await fetch(`${this.config.apiUrl}/v1/orders/${orderId}`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`x402 order lookup failed (${res.status})`);
    }
    return (await res.json()) as X402Order;
  }

  async getProof(orderId: string): Promise<X402Proof> {
    const res = await fetch(
      `${this.config.apiUrl}/v1/orders/${orderId}/proof`,
      { headers: this.headers() },
    );
    if (!res.ok) {
      throw new Error(`x402 proof retrieval failed (${res.status})`);
    }
    const raw = await res.json();
    const r = raw as { txHash?: string; settledAt?: string };
    return { orderId, txHash: r.txHash, settledAt: r.settledAt, raw };
  }

  /**
   * Polls until the order reaches a terminal state.
   *
   * Deliberately bounded and backing off: an unbounded poll against a
   * payment API is how you get rate-limited in production. Callers that
   * need longer windows should persist the orderId and poll from a
   * background job rather than holding a request open.
   */
  async waitForTerminal(
    orderId: string,
    opts: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<X402Order> {
    const timeoutMs = opts.timeoutMs ?? 120_000;
    let intervalMs = opts.intervalMs ?? 2_000;
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const order = await this.getOrder(orderId);
      if (isTerminal(order.status)) return order;

      if (Date.now() + intervalMs >= deadline) {
        throw new Error(
          `x402 order ${orderId} did not reach a terminal state within ${timeoutMs}ms (last status: ${order.status})`,
        );
      }
      await new Promise((r) => setTimeout(r, intervalMs));
      intervalMs = Math.min(intervalMs * 1.5, 10_000);
    }
  }
}

export function x402ConfigFromEnv(): X402Config {
  const required = [
    'GOATX402_API_URL',
    'GOATX402_API_KEY',
    'GOATX402_API_SECRET',
    'GOATX402_MERCHANT_ID',
  ] as const;

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing x402 environment variables: ${missing.join(', ')}`);
  }

  return {
    apiUrl: process.env.GOATX402_API_URL!,
    apiKey: process.env.GOATX402_API_KEY!,
    apiSecret: process.env.GOATX402_API_SECRET!,
    merchantId: process.env.GOATX402_MERCHANT_ID!,
  };
}
