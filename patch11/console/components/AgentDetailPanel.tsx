"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { RackEntry, Tier } from "./agent-rack-data";
import { TIER } from "./agent-rack-data";

const EXPLORER = "https://explorer.testnet3.goat.network";
const REGISTRY = "0x556089008Fc0a60cD09390Eca93477ca254A5522";

/**
 * Detail drawer for an agent.
 *
 * Focus handling matters here: opening a panel that traps a keyboard user
 * behind it, or that drops focus back to the top of the document on close,
 * is the difference between "polished" and "looks polished". We move focus
 * in on open, restore it to the triggering card on close, and close on
 * Escape.
 */
export default function AgentDetailPanel({
  entry,
  agentId,
  onClose,
}: {
  entry: RackEntry | null;
  agentId: number | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<Element | null>(null);

  useEffect(() => {
    if (entry) {
      restoreTo.current = document.activeElement;
      panelRef.current?.focus();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      (restoreTo.current as HTMLElement | null)?.focus?.();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [entry]);

  useEffect(() => {
    if (!entry) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [entry, onClose]);

  return (
    <AnimatePresence>
      {entry && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="agent-detail-title"
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-line/25 bg-ink-2 focus:outline-none"
          >
            <Body entry={entry} agentId={agentId} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Body({
  entry,
  agentId,
  onClose,
}: {
  entry: RackEntry;
  agentId: number | null;
  onClose: () => void;
}) {
  const tier = TIER[entry.tier];

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: tier.color }}
            />
            <span className="font-mono text-[10px] tracking-widest text-line-bright">
              {entry.code}
            </span>
            <span className="font-mono text-[9px] tracking-widest text-paper-dim/45">
              {entry.role.toUpperCase()}
            </span>
          </div>
          <h2
            id="agent-detail-title"
            className="mt-2 font-display text-2xl font-semibold text-paper"
          >
            {entry.name}
          </h2>
        </div>

        <button
          onClick={onClose}
          aria-label="Close agent details"
          className="shrink-0 cursor-pointer rounded-sm border border-line/30 p-2 text-paper-dim transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M2 2l8 8M10 2l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <span
        className="mt-4 inline-block rounded-sm border px-2 py-0.5 font-mono text-[9px] tracking-widest"
        style={{ color: tier.color, borderColor: `${tier.color}55` }}
      >
        {tier.label}
      </span>
      <p className="mt-2 font-mono text-[10px] leading-relaxed text-paper-dim/60">
        {tier.description}
      </p>

      <Section title="WHAT IT DOES">
        <p className="text-[13px] leading-relaxed text-paper-dim">
          {entry.summary}
        </p>
      </Section>

      <Section title="RESPONSIBILITIES">
        <ul className="space-y-2">
          {entry.responsibilities.map((r) => (
            <li
              key={r}
              className="flex items-start gap-2.5 text-[13px] leading-relaxed text-paper-dim"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-line-bright"
              />
              {r}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="SKILLS">
        <div className="flex flex-wrap gap-1.5">
          {entry.skills.map((s) => (
            <span
              key={s}
              className="rounded-sm border border-line/25 px-2 py-0.5 font-mono text-[10px] tracking-wide text-paper-dim"
            >
              {s}
            </span>
          ))}
        </div>
      </Section>

      <Section title="ON-CHAIN RECORD">
        {agentId !== null ? (
          <dl className="space-y-2.5 font-mono text-[11px]">
            <Row label="AGENT ID" value={`#${agentId}`} accent />
            <Row label="STANDARD" value="ERC-8004 Identity" />
            <Row label="NETWORK" value="GOAT testnet3 (48816)" />
            <Row label="REGISTRY" value={`${REGISTRY.slice(0, 10)}…${REGISTRY.slice(-6)}`} />
            <a
              href={`${EXPLORER}/address/${REGISTRY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-sm border border-brass/50 px-3 py-1.5 text-[10px] tracking-widest text-brass-bright transition-colors hover:bg-brass/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
            >
              VERIFY IN EXPLORER ↗
            </a>
          </dl>
        ) : (
          <p className="font-mono text-[11px] leading-relaxed text-paper-dim/55">
            Not registered yet. This agent gets an ERC-8004 identity once its
            endpoint can answer a request — registering earlier would publish
            a record pointing at nothing.
          </p>
        )}
      </Section>

      <Section title="STATUS">
        <p className="text-[13px] leading-relaxed text-paper-dim">
          {entry.capability}
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7 border-t border-line/15 pt-5">
      <h3 className="mb-3 font-mono text-[10px] tracking-[0.25em] text-line-bright">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="grid grid-cols-[86px_1fr] gap-3">
      <dt className="tracking-widest text-paper-dim/50">{label}</dt>
      <dd className={accent ? "text-signal-bright" : "text-paper-dim"}>
        {value}
      </dd>
    </div>
  );
}
