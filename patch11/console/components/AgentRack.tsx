"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useAgents } from "@/lib/use-agents";
import ChainStatus from "./ChainStatus";
import { Odometer } from "./Odometer";
import AgentDetailPanel from "./AgentDetailPanel";
import { RACK, TIER, PIPELINE, type RackEntry } from "./agent-rack-data";

export default function AgentRack() {
  const { agents, state, blockNumber } = useAgents();
  const [selected, setSelected] = useState<RackEntry | null>(null);

  const onChain = new Map(agents.map((a) => [a.key, a]));
  const operational = RACK.filter((r) => r.tier === "operational").length;
  const registered = RACK.filter(
    (r) => r.tier === "operational" || r.tier === "registered",
  ).length;

  return (
    <section className="py-10">
      <header>
        <p className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
          AGENT SYSTEM
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-paper">
          Agent rack
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-dim">
          Six specialised agents, each with a defined responsibility and a
          place in the workflow. Identity and reputation are read from the
          ERC-8004 registries on GOAT Network.
        </p>

        <ChainStatus state={state} blockNumber={blockNumber} />

        <dl className="mt-6 grid grid-cols-3 gap-4 border-y border-line/15 py-4">
          <Stat label="OPERATIONAL" value={operational} suffix={`/ ${RACK.length}`} />
          <Stat label="ON-CHAIN" value={registered} suffix={`/ ${RACK.length}`} />
          <Stat label="NETWORK" text="GOAT testnet3" />
        </dl>
      </header>

      {/* Pipeline rail beside the grid: the rack is a system with an order,
          not an unordered list of features. */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[140px_1fr]">
        <PipelineRail />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {RACK.map((entry, i) => (
            <AgentCard
              key={entry.key}
              entry={entry}
              index={i}
              agentId={onChain.get(entry.key)?.identity.agentId ?? null}
              onSelect={() => setSelected(entry)}
            />
          ))}
        </div>
      </div>

      <p className="mt-8 font-mono text-[10px] leading-relaxed tracking-widest text-paper-dim/40">
        STATUS REFLECTS SHIPPED CAPABILITY, NOT ROADMAP INTENT. SELECT AN
        AGENT FOR ITS FULL SPECIFICATION.
      </p>

      <AgentDetailPanel
        entry={selected}
        agentId={
          selected ? (onChain.get(selected.key)?.identity.agentId ?? null) : null
        }
        onClose={() => setSelected(null)}
      />
    </section>
  );
}

/** Vertical stage rail — collapses to a horizontal strip below lg. */
function PipelineRail() {
  return (
    <aside aria-label="Workflow stages" className="hidden lg:block">
      <p className="mb-4 font-mono text-[9px] tracking-[0.25em] text-paper-dim/45">
        WORKFLOW
      </p>
      <ol className="relative space-y-6 border-l border-line/25 pl-5">
        {PIPELINE.map((stage, i) => {
          const count = RACK.filter((r) => r.stage === stage).length;
          const live = RACK.some(
            (r) => r.stage === stage && r.tier === "operational",
          );
          return (
            <motion.li
              key={stage}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
              className="relative"
            >
              <span
                aria-hidden="true"
                className="absolute -left-[23px] top-1.5 h-1.5 w-1.5 rounded-full"
                style={{
                  background: live
                    ? "var(--color-signal-bright)"
                    : "var(--color-line)",
                  boxShadow: live
                    ? "0 0 8px 2px var(--color-signal-bright)44"
                    : "none",
                }}
              />
              <p
                className={`font-display text-sm font-semibold ${
                  live ? "text-paper" : "text-paper-dim/60"
                }`}
              >
                {stage}
              </p>
              <p className="mt-0.5 font-mono text-[9px] tracking-wide text-paper-dim/40">
                {count} AGENT{count === 1 ? "" : "S"}
              </p>
            </motion.li>
          );
        })}
      </ol>
    </aside>
  );
}

function AgentCard({
  entry,
  index,
  agentId,
  onSelect,
}: {
  entry: RackEntry;
  index: number;
  agentId: number | null;
  onSelect: () => void;
}) {
  const tier = TIER[entry.tier];
  const dimmed = entry.tier === "planned";

  return (
    <motion.button
      onClick={onSelect}
      aria-label={`${entry.name} — ${tier.label}. View specification.`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.06, 0.4),
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -2 }}
      className={`group relative flex h-full cursor-pointer flex-col rounded-sm border bg-ink-2/50 p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright ${
        dimmed
          ? "border-line/15 hover:border-line/30"
          : "border-line/25 hover:border-brass/50"
      }`}
    >
      <span
        aria-hidden="true"
        className="absolute right-3 top-3 h-2 w-2 border-r border-t transition-opacity group-hover:opacity-100"
        style={{ borderColor: tier.color, opacity: dimmed ? 0.3 : 0.6 }}
      />

      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: tier.color,
            boxShadow: dimmed ? "none" : `0 0 8px 2px ${tier.color}44`,
          }}
        />
        <span className="font-mono text-[10px] tracking-widest text-line-bright">
          {entry.code}
        </span>
        <span className="font-mono text-[9px] tracking-widest text-paper-dim/45">
          {entry.role.toUpperCase()}
        </span>
      </div>

      <h2
        className={`mt-3 font-display text-lg font-semibold transition-colors ${
          dimmed ? "text-paper/70" : "text-paper group-hover:text-brass-bright"
        }`}
      >
        {entry.name}
      </h2>

      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-paper-dim">
        {entry.summary}
      </p>

      <div className="mt-4 flex flex-wrap gap-1">
        {entry.skills.slice(0, 3).map((s) => (
          <span
            key={s}
            className="rounded-sm border border-line/20 px-1.5 py-px font-mono text-[9px] tracking-wide text-paper-dim/60"
          >
            {s}
          </span>
        ))}
      </div>

      <footer className="mt-4 border-t border-line/15 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className="rounded-sm border px-2 py-0.5 font-mono text-[9px] tracking-widest"
            style={{ color: tier.color, borderColor: `${tier.color}55` }}
          >
            {tier.label}
          </span>

          {agentId !== null && (
            <span className="font-mono text-[10px] text-signal-bright">
              AGENT #<Odometer value={agentId} delay={0.3 + index * 0.06} />
            </span>
          )}
        </div>

        <p className="mt-2 flex items-center justify-between gap-2 font-mono text-[9px] leading-relaxed tracking-wide text-paper-dim/50">
          <span>{entry.capability}</span>
          <span
            aria-hidden="true"
            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          >
            →
          </span>
        </p>
      </footer>
    </motion.button>
  );
}

function Stat({
  label,
  value,
  text,
  suffix,
}: {
  label: string;
  value?: number;
  text?: string;
  suffix?: string;
}) {
  return (
    <div>
      <dt className="font-mono text-[9px] tracking-widest text-paper-dim/50">
        {label}
      </dt>
      <dd className="mt-1 font-display text-lg font-semibold text-paper">
        {value !== undefined && <Odometer value={value} delay={0.4} />}
        {text && <span className="text-brass-bright">{text}</span>}
        {suffix && (
          <span className="ml-1 font-mono text-xs text-paper-dim/45">
            {suffix}
          </span>
        )}
      </dd>
    </div>
  );
}
