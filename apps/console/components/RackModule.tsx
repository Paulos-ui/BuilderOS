"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { ConsoleAgent } from "@/lib/types";
import { Odometer } from "./Odometer";
import { SignalMeter } from "./SignalMeter";
import { SettlementValue, SettlementTrack } from "./Settlement";

const STATUS_COLOR: Record<ConsoleAgent["status"], string> = {
  live: "var(--color-signal-bright)",
  beta: "var(--color-brass-bright)",
  planned: "var(--color-line)",
};

export function RackModule({
  agent,
  index,
}: {
  agent: ConsoleAgent;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const registered = agent.identity.agentId !== null;
  const bootDelay = 0.15 + index * 0.12;

  return (
    <motion.div
      // Boot sequence: modules power on top to bottom.
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: bootDelay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="rack-surface overflow-hidden rounded-sm border border-line/25"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-line/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-bright md:gap-6 md:px-6"
      >
        {/* Status LED — flickers during boot, then settles */}
        <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
          <motion.span
            className="block h-2.5 w-2.5 rounded-full"
            style={{ background: STATUS_COLOR[agent.status] }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.3, 1, 0.6, 1] }}
            transition={{ delay: bootDelay, duration: 0.9, times: [0, 0.15, 0.3, 0.5, 0.7, 1] }}
          />
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: STATUS_COLOR[agent.status] }}
            animate={{ opacity: [0.35, 0, 0.35], scale: [1, 2.2, 1] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>

        {/* Identity block */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[11px] tracking-widest text-line-bright">
              {agent.code}
            </span>
            <h3 className="truncate font-display text-base font-semibold text-paper">
              {agent.name}
            </h3>
            <span className="hidden font-mono text-[10px] tracking-widest text-paper-dim/60 sm:inline">
              {agent.role.toUpperCase()}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-3 font-mono text-[11px]">
            {registered ? (
              <SettlementValue phase={agent.identity.settlement}>
                AGENT #
                <Odometer value={agent.identity.agentId!} delay={bootDelay + 0.3} />
              </SettlementValue>
            ) : (
              <span className="text-paper-dim/50">UNREGISTERED</span>
            )}
            {agent.x402Support && (
              <span className="rounded-sm border border-brass/40 px-1.5 py-px text-[10px] tracking-widest text-brass-bright">
                x402
              </span>
            )}
          </div>
        </div>

        {/* Reputation meter */}
        <div className="hidden shrink-0 sm:block">
          <SignalMeter
            value={agent.reputation?.average ?? null}
            count={agent.reputation?.count ?? 0}
            delay={bootDelay + 0.45}
          />
        </div>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0 text-line-bright"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M3 5.5L7 9.5L11 5.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-line/20"
          >
            <div className="grid gap-6 px-4 py-5 md:grid-cols-[1.4fr_1fr] md:px-6">
              <div>
                <p className="max-w-lg text-sm leading-relaxed text-paper-dim">
                  {agent.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {agent.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-sm border border-line/25 px-2 py-0.5 font-mono text-[10px] tracking-wide text-paper-dim"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <dl className="space-y-3 font-mono text-[11px]">
                <div className="grid grid-cols-[74px_1fr] gap-3">
                  <dt className="tracking-widest text-paper-dim/50">SETTLED</dt>
                  <dd>
                    <SettlementTrack phase={agent.identity.settlement} />
                  </dd>
                </div>
                <Row label="NETWORK" value={`GOAT ${agent.identity.network}`} />
                <Row
                  label="REGISTRY"
                  value={truncateMiddle(agent.identity.registryId, 30)}
                  title={agent.identity.registryId}
                />
                <Row
                  label="TX"
                  value={
                    agent.identity.txHash
                      ? truncateMiddle(agent.identity.txHash, 18)
                      : "—"
                  }
                  title={agent.identity.txHash ?? undefined}
                />
                <Row
                  label="CLIENTS"
                  value={
                    agent.reputation ? String(agent.reputation.clients) : "—"
                  }
                />
              </dl>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Row({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="grid grid-cols-[74px_1fr] gap-3">
      <dt className="tracking-widest text-paper-dim/50">{label}</dt>
      <dd className="truncate text-paper-dim" title={title}>
        {value}
      </dd>
    </div>
  );
}

function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(-half)}`;
}
