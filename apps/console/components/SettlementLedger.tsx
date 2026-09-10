"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Odometer } from "./Odometer";
import PageHeader from "./PageHeader";
import {
  SettlementTrack,
  SettlementValue,
  type SettlementPhase,
} from "./Settlement";

/**
 * BuilderPay (AG-06), the builder-facing view.
 *
 * ── Why the posture notice comes before the numbers ───────────────────────
 *
 * BuilderPay verifies x402 payment authorizations but does not broadcast them:
 * there is no facilitator for GOAT yet, and the blueprint forbids this codebase
 * from holding a private key, so there is nothing here that could sign a
 * settlement transaction. Authorizations are therefore recorded as
 * verified-unsettled.
 *
 * A ledger that opened with "0.00 USDC settled" and no explanation would read
 * as either a broken integration or an idle account, and both readings are
 * wrong. So the API's own `note` — which distinguishes unconfigured, from
 * metering-off, from configured-but-deferred — is the first thing on the page,
 * and the totals sit underneath it. Verified and settled are shown as separate
 * figures and never summed, because money that moved and money that was merely
 * authorized are not the same fact.
 *
 * `missingConfig` is deliberately not rendered. It names environment variables,
 * which is an operator's problem and noise to the builder reading this.
 */

interface Totals {
  challenged: number;
  verified: number;
  settled: number;
  failed: number;
  settledMinor: string;
  settledDisplay: string;
  authorizedUnsettledMinor: string;
  authorizedUnsettledDisplay: string;
}

interface Order {
  id: string;
  agentKey: string;
  operation: string;
  status: string;
  amountMinor: string;
  amountDisplay: string;
  currency: string;
  payerAddress: string | null;
  settlementTx: string | null;
  explorerUrl: string | null;
  failureReason: string | null;
  createdAt: string;
  verifiedAt: string | null;
  settledAt: string | null;
}

interface Status {
  meteringEnabled: boolean;
  configured: boolean;
  active: boolean;
  network: string;
  chainId: number;
  asset: { address: string; symbol: string; decimals: number } | null;
  payTo: string | null;
  settlementMode: string;
  note: string;
}

interface Ledger extends Status {
  totals: Totals;
  orders: Order[];
}

interface Price {
  agentKey: string;
  operation: string;
  amountMinor: string;
  amountDisplay: string;
  route: string;
  description: string;
}

interface Quote extends Status {
  prices: Price[];
}

/**
 * Payment status, expressed in GOAT's two-speed finality.
 *
 * The mapping is not decorative — it is the same distinction the protocol
 * makes. A VERIFIED order holds a valid EIP-3009 authorization that has not
 * been broadcast: real, usable, and still capable of never landing. That is
 * exactly what `sequenced` means, so it drifts. SETTLED is irreversible, so it
 * locks to brass and the drift stops.
 *
 * The labels stay in payment language rather than the primitive's default
 * PENDING/SEQUENCED/BITCOIN FINAL, because "sequenced" describes a block and
 * the reader is looking at an invoice. The physics carry the chain meaning; the
 * words carry the money meaning.
 */
const ORDER_STATUS: Record<
  string,
  { label: string; color: string; phase: SettlementPhase }
> = {
  REQUIRED: {
    label: "Awaiting payment",
    color: "var(--color-paper-dim)",
    phase: "pending",
  },
  VERIFIED: {
    label: "Authorized, not settled",
    color: "var(--color-line-bright)",
    phase: "sequenced",
  },
  SETTLED: {
    label: "Settled",
    color: "var(--color-brass-bright)",
    phase: "final",
  },
  FAILED: {
    label: "Failed",
    color: "var(--color-danger)",
    phase: "pending",
  },
};

export default function SettlementLedger() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Independent reads, so they go together rather than in sequence.
        const [l, q] = await Promise.all([
          api<Ledger>("/v1/pay/ledger?limit=50"),
          api<Quote>("/v1/pay/quote"),
        ]);
        if (cancelled) return;
        setLedger(l);
        setQuote(q);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Couldn't load your settlement record.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="pb-16">
      <PageHeader
        eyebrow="SETTLE · BUILDERPAY"
        title="Settlement"
        description="What each agent operation costs, and every payment challenge raised against your account. Your wallet signs; BuilderOS never holds your keys or your balance."
      />

      {error && (
        <p
          role="alert"
          className="mt-8 rounded-sm border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {ledger && (
        <>
          <div
            className={`mt-8 rounded-sm border px-5 py-4 ${
              ledger.active
                ? "border-brass/40 bg-brass/5"
                : "border-line/25 bg-ink-2/40"
            }`}
          >
            <p className="text-[11px] tracking-wide text-paper-dim/50">
              {ledger.active
                ? "Metering is live"
                : "Agent calls are free right now"}
            </p>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-paper-dim">
              {ledger.note}
            </p>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-4 border-b border-line/15 pb-5 sm:grid-cols-4">
            <Stat label="Challenges raised" value={ledger.totals.challenged} />
            <Stat
              label="Authorized"
              value={ledger.totals.verified}
              caption={ledger.totals.authorizedUnsettledDisplay}
              accent="var(--color-line-bright)"
            />
            <Stat
              label="Settled"
              value={ledger.totals.settled}
              caption={ledger.totals.settledDisplay}
              accent="var(--color-brass-bright)"
            />
            <Stat
              label="Failed"
              value={ledger.totals.failed}
              accent={
                ledger.totals.failed > 0 ? "var(--color-danger)" : undefined
              }
            />
          </dl>
        </>
      )}

      {quote && quote.prices.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-[15px] font-semibold text-paper">
            What things cost
          </h2>
          <p className="mt-1 text-[12px] text-paper-dim/55">
            Published before you run anything. Every operation not listed here is
            free.
          </p>

          <ul className="mt-4 divide-y divide-line/15 overflow-hidden rounded-sm border border-line/25">
            {quote.prices.map((p) => (
              <li
                key={`${p.agentKey}:${p.operation}`}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3.5"
              >
                <span className="min-w-0 flex-1 text-[13px] text-paper-dim">
                  {p.description}
                </span>
                <span className="font-display text-[13px] font-semibold tabular-nums text-brass-bright">
                  {p.amountDisplay}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ledger && (
        <div className="mt-10">
          <h2 className="font-display text-[15px] font-semibold text-paper">
            Payment record
          </h2>

          {ledger.orders.length === 0 ? (
            <div className="mt-4 rounded-sm border border-line/25 bg-ink-2/40 px-5 py-10 text-center">
              <p className="text-[13px] text-paper-dim">
                No payment challenges yet.
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-paper-dim/55">
                One appears here the first time you run a metered operation —
                today that is ProofForge scoring a draft.
              </p>
            </div>
          ) : (
            <ol className="mt-4 space-y-2.5">
              {ledger.orders.map((o, i) => (
                <OrderRow key={o.id} order={o} index={i} />
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

function OrderRow({ order, index }: { order: Order; index: number }) {
  const status = ORDER_STATUS[order.status] ?? {
    label: order.status,
    color: "var(--color-paper-dim)",
    phase: "pending" as SettlementPhase,
  };
  const failed = order.status === "FAILED";

  return (
    <motion.li
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.35 }}
      className="rounded-sm border border-line/25 bg-ink-2/50 px-4 py-4 md:px-5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/*
          Label suppressed — the track supplies the physics, the span next to it
          supplies the payment vocabulary. A failed order gets no track: there is
          no finality story to tell about a signature that was rejected.
        */}
        {!failed && <SettlementTrack phase={status.phase} showLabel={false} />}

        <span className="text-[13px] text-paper">
          {order.agentKey} · {order.operation}
        </span>
        <span className="text-[11px]" style={{ color: status.color }}>
          {status.label}
        </span>

        <span className="ml-auto font-display text-[13px] font-semibold">
          <SettlementValue phase={status.phase}>
            {order.amountDisplay}
          </SettlementValue>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-paper-dim/45">
        <span>
          {new Date(order.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {order.payerAddress && (
          <span>
            {order.payerAddress.slice(0, 6)}…{order.payerAddress.slice(-4)}
          </span>
        )}
        {order.explorerUrl && (
          <a
            href={order.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-line-bright underline underline-offset-4 transition-colors hover:text-paper"
          >
            Transaction ↗
          </a>
        )}
      </div>

      {order.failureReason && (
        <p className="mt-2 text-[12px] text-danger/85">{order.failureReason}</p>
      )}
    </motion.li>
  );
}

function Stat({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: number;
  caption?: string;
  accent?: string;
}) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-paper-dim/60">{label}</dt>
      <dd
        className="mt-1 font-display text-2xl font-semibold tabular-nums"
        style={{ color: accent }}
      >
        {/* Rolls rather than fades: these were counted, not composed. */}
        <Odometer value={value} delay={0.15} />
      </dd>
      {caption && (
        <p className="mt-0.5 font-mono text-[10px] text-paper-dim/45">
          {caption}
        </p>
      )}
    </div>
  );
}
