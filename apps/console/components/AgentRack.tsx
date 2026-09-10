"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAgents, type AgentCounts } from "@/lib/use-agents";
import type { AgentStatus, ConsoleAgent } from "@/lib/types";
import AgentSigil, { type AgentKey } from "./AgentSigil";
import ChainStatus from "./ChainStatus";
import PageHeader from "./PageHeader";
import PipelineStrip from "./PipelineStrip";
import { copyFor } from "./agent-rack-data";

const EXPLORER = "https://explorer.testnet3.goat.network";
const REGISTRY = "0x556089008Fc0a60cD09390Eca93477ca254A5522";

/**
 * The agent rack.
 *
 * ── What changed and why ──────────────────────────────────────────────────
 *
 * This was six detached cards above a modal drawer, and it had three problems
 * that all pointed the same way.
 *
 * It was not one thing. Six separately-bordered tiles floating in a grid read
 * as six unrelated features, when the actual claim BuilderOS makes is that they
 * are one system that hands work between its parts. So the rack is now a single
 * surface with hairline-divided rows, and opening one expands it in place
 * instead of throwing a full-screen drawer over the page. You never lose your
 * position in the list, which is the point of a rack.
 *
 * It leaked implementation at the reader. Every card led with a part number
 * (AG-01), raw skill slugs (`opportunity-discovery`), a shouted tier label, and
 * a 42-character contract address sat in the panel. None of that helps someone
 * decide which agent to run. It is not deleted — a reviewer checking our claims
 * needs it — it is demoted to one line inside the expansion, where provenance
 * belongs.
 *
 * It counted itself. The header read "4 OPERATIONAL / 6", derived by filtering a
 * hardcoded array in the frontend, and it kept saying 4 after the fifth and
 * sixth agents shipped. Counts now come from /v1/agents, which derives them from
 * the same definitions that serve the endpoints.
 */
export default function AgentRack() {
  const { agents, counts, state, blockNumber } = useAgents();
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <section className="py-10">
      <PageHeader
        eyebrow="AGENT SYSTEM"
        title="Agent rack"
        description="Six agents, one workflow. Each handles a different part of getting funded — finding the opportunity, strengthening the application, holding the deadline, recording what you shipped, and settling what it cost."
        status={<ChainStatus state={state} blockNumber={blockNumber} />}
      />

      <PipelineStrip />

      <div className="mt-8 overflow-hidden rounded-sm border border-line/25">
        <RackHeader counts={counts} />

        {/*
          Accordion, one row open at a time. Six simultaneously expanded rows is
          the wall of text this rebuild exists to remove.
        */}
        <ul className="divide-y divide-line/15">
          {agents.map((agent, i) => (
            <AgentRow
              key={agent.key}
              agent={agent}
              index={i}
              open={openKey === agent.key}
              onToggle={() =>
                setOpenKey((k) => (k === agent.key ? null : agent.key))
              }
            />
          ))}
        </ul>
      </div>

      <p className="mt-6 max-w-2xl text-[12px] leading-relaxed text-paper-dim/50">
        Status reflects what is shipped, not what is planned. &ldquo;Live&rdquo;
        means the endpoint answers today; &ldquo;on-chain&rdquo; additionally
        means the agent holds an ERC-8004 identity you can verify in the
        explorer. We register an agent only after its endpoint works.
      </p>
    </section>
  );
}

/**
 * The rack's one summary line.
 *
 * Deliberately a sentence rather than a "6/6" readout. A fraction invites the
 * reader to work out what the missing part is; a sentence states the position
 * and moves on. Both numbers come from the API.
 */
function RackHeader({ counts }: { counts: AgentCounts }) {
  const allBuilt = counts.implemented === counts.total;

  return (
    <div className="rack-surface flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line/20 px-5 py-3.5">
      <p className="text-[13px] text-paper">
        {allBuilt
          ? `All ${counts.total} agents are serving requests`
          : `${counts.implemented} of ${counts.total} agents serving requests`}
        <span className="text-paper-dim/60">
          {counts.registered > 0
            ? ` · ${counts.registered} registered on GOAT`
            : " · none registered on GOAT yet"}
        </span>
      </p>
      <p className="font-mono text-[10px] tracking-widest text-paper-dim/45">
        GOAT TESTNET3
      </p>
    </div>
  );
}

const STATUS: Record<
  AgentStatus,
  { label: string; color: string; note: string }
> = {
  live: {
    label: "Live · on-chain",
    color: "var(--color-signal-bright)",
    note: "Serving requests, with a verifiable ERC-8004 identity on GOAT.",
  },
  beta: {
    label: "Live",
    color: "var(--color-line-bright)",
    note: "Serving requests. No on-chain identity yet — registration costs gas and we do it once an endpoint is proven.",
  },
  planned: {
    label: "Planned",
    color: "var(--color-paper-dim)",
    note: "Specified in the architecture, not built yet.",
  },
};

function AgentRow({
  agent,
  index,
  open,
  onToggle,
}: {
  agent: ConsoleAgent;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const copy = copyFor(agent.key);
  const status = STATUS[agent.status] ?? STATUS.planned;
  const panelId = `agent-panel-${agent.key}`;
  const runnable = agent.status !== "planned" && Boolean(copy);

  return (
    <motion.li
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.4 }}
      className={open ? "bg-ink-2/60" : undefined}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="group flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-ink-2/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass-bright"
      >
        {/*
          The sigil only moves for the row you opened. Six animating marks in a
          list is noise; one is an instrument responding to you. Tone comes from
          the status colour and reaches the mark through `currentColor`.
        */}
        <span className="shrink-0" style={{ color: status.color }}>
          <AgentSigil
            agent={agent.key as AgentKey}
            size={40}
            registered={agent.identity.agentId !== null}
            animate={open}
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-display text-[15px] font-semibold text-paper">
              {agent.name}
            </span>
            {copy && (
              <span className="text-[11px] tracking-wide text-paper-dim/50">
                {copy.stage}
              </span>
            )}
          </span>
          <span className="mt-1 block max-w-xl text-[13px] leading-relaxed text-paper-dim">
            {copy?.summary ?? agent.description}
          </span>
        </span>

        <span className="hidden shrink-0 items-center gap-2 sm:flex">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: status.color,
              // color-mix, not `${status.color}44`: appending an alpha suffix to
              // a var() yields an invalid colour and the whole declaration is
              // discarded, taking the glow with it and giving no error.
              boxShadow:
                agent.status === "planned"
                  ? "none"
                  : `0 0 8px 2px color-mix(in srgb, ${status.color} 28%, transparent)`,
            }}
          />
          <span
            className="text-[11px] tracking-wide"
            style={{ color: status.color }}
          >
            {status.label}
          </span>
        </span>

        <span
          aria-hidden="true"
          className={`shrink-0 text-paper-dim/40 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M2 4.5L6 8.5L10 4.5"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
          </svg>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-6 px-5 pb-6 pl-[76px] md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <ul className="space-y-2">
                  {(copy?.responsibilities ?? []).map((r) => (
                    <li
                      key={r}
                      className="flex items-start gap-2.5 text-[13px] leading-relaxed text-paper-dim"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                        style={{ background: status.color }}
                      />
                      {r}
                    </li>
                  ))}
                </ul>

                <p className="mt-4 max-w-lg text-[12px] leading-relaxed text-paper-dim/55">
                  {status.note}
                </p>

                <TechnicalRecord agent={agent} />
              </div>

              {runnable && copy && (
                <div className="md:pt-1">
                  <button
                    onClick={() => router.push(copy.launchPath)}
                    className="w-full cursor-pointer whitespace-nowrap rounded-sm bg-brass px-5 py-2.5 font-display text-[13px] font-semibold text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright md:w-auto"
                  >
                    {copy.launchLabel}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/**
 * Provenance, on one line.
 *
 * Everything a reviewer needs to check our claims, and nothing a builder has to
 * read to use the product. The skill ids are printed raw on purpose here — they
 * are the exact strings published on the A2A agent card, so a prettified version
 * would be useless to the one audience that wants them.
 */
function TechnicalRecord({ agent }: { agent: ConsoleAgent }) {
  const { agentId, txHash } = agent.identity;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line/15 pt-3 font-mono text-[10px] text-paper-dim/45">
      <span>{agent.code}</span>
      <Sep />
      <span>{agent.skills.join(" · ")}</span>
      {agent.x402Support && (
        <>
          <Sep />
          <span>x402</span>
        </>
      )}
      <Sep />
      {agentId !== null ? (
        <a
          href={
            txHash
              ? `${EXPLORER}/tx/${txHash}`
              : `${EXPLORER}/address/${REGISTRY}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="text-line-bright underline underline-offset-4 transition-colors hover:text-paper"
        >
          Agent #{agentId} ↗
        </a>
      ) : (
        <span>Not registered</span>
      )}
    </div>
  );
}

function Sep() {
  return (
    <span aria-hidden="true" className="text-line/40">
      /
    </span>
  );
}
