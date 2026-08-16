"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TIER, type RackEntry } from "./agent-rack-data";

const EXPLORER = "https://explorer.testnet3.goat.network";
const REGISTRY = "0x556089008Fc0a60cD09390Eca93477ca254A5522";

/**
 * Agent launcher.
 *
 * The earlier version of this panel led with the on-chain record and an
 * "verify in explorer" link — useful for someone auditing our claims, wrong
 * for a builder trying to get work done. An agent people can read about but
 * not run is a brochure.
 *
 * So: the primary action is running the agent. The registry details still
 * exist for anyone who wants them, but they sit at the bottom behind a
 * disclosure, where technical provenance belongs.
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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
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
            className="fixed inset-0 z-40 bg-ink/85 backdrop-blur-sm"
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
  const router = useRouter();
  const tier = TIER[entry.tier];
  const [showRecord, setShowRecord] = useState(false);

  const runnable = entry.tier === "operational" && Boolean(entry.launchPath);

  return (
    <div className="flex min-h-screen flex-col p-6 md:p-8">
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
          aria-label="Close"
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

      <p className="mt-4 text-[13px] leading-relaxed text-paper-dim">
        {entry.summary}
      </p>

      {/* PRIMARY ACTION — the reason this panel exists */}
      <div className="mt-6">
        {runnable ? (
          <>
            <button
              onClick={() => {
                onClose();
                router.push(entry.launchPath!);
              }}
              className="w-full cursor-pointer rounded-sm bg-brass px-6 py-3.5 font-display text-sm font-semibold text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
            >
              {entry.launchLabel}
            </button>
            <p className="mt-2 text-center font-mono text-[9px] tracking-widest text-paper-dim/50">
              {entry.launchHint}
            </p>
          </>
        ) : (
          <div className="rounded-sm border border-line/25 bg-ink/50 px-4 py-3.5 text-center">
            <p className="font-mono text-[10px] tracking-widest" style={{ color: tier.color }}>
              {tier.label}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-paper-dim">
              {entry.unavailableReason}
            </p>
          </div>
        )}
      </div>

      <Section title="WHAT IT DOES FOR YOU">
        <ul className="space-y-2.5">
          {entry.responsibilities.map((r) => (
            <li
              key={r}
              className="flex items-start gap-2.5 text-[13px] leading-relaxed text-paper-dim"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                style={{ background: tier.color }}
              />
              {r}
            </li>
          ))}
        </ul>
      </Section>

      <div className="flex-1" />

      {/* Provenance, demoted to a disclosure at the bottom. */}
      <div className="mt-8 border-t border-line/15 pt-4">
        <button
          onClick={() => setShowRecord((v) => !v)}
          aria-expanded={showRecord}
          className="flex w-full cursor-pointer items-center justify-between font-mono text-[9px] tracking-[0.2em] text-paper-dim/50 transition-colors hover:text-paper-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
        >
          <span>TECHNICAL RECORD</span>
          <span aria-hidden="true">{showRecord ? "−" : "+"}</span>
        </button>

        <AnimatePresence initial={false}>
          {showRecord && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="overflow-hidden"
            >
              <dl className="mt-4 space-y-2 font-mono text-[10px]">
                {agentId !== null ? (
                  <>
                    <Row label="AGENT ID" value={`#${agentId}`} accent />
                    <Row label="STANDARD" value="ERC-8004 Identity" />
                    <Row label="NETWORK" value="GOAT testnet3" />
                    <a
                      href={`${EXPLORER}/address/${REGISTRY}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-[9px] tracking-widest text-line-bright underline underline-offset-4 hover:text-paper"
                    >
                      VIEW REGISTRY ↗
                    </a>
                  </>
                ) : (
                  <p className="leading-relaxed text-paper-dim/50">
                    No on-chain identity yet. This agent gets registered once
                    its endpoint can answer a request.
                  </p>
                )}
              </dl>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
    <div className="grid grid-cols-[80px_1fr] gap-3">
      <dt className="tracking-widest text-paper-dim/45">{label}</dt>
      <dd className={accent ? "text-signal-bright" : "text-paper-dim"}>
        {value}
      </dd>
    </div>
  );
}
