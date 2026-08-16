"use client";

import { motion } from "framer-motion";
import { useAgents } from "@/lib/use-agents";
import ChainStatus from "./ChainStatus";
import { Odometer } from "./Odometer";

/**
 * Status tiers, deliberately four rather than two.
 *
 * "Active" and "Coming soon" alone would force a lie somewhere: ProofForge
 * is registered on-chain with a verifiable agentId but has no scoring
 * endpoint yet, which is neither. Collapsing that into "Active" would claim
 * a capability that doesn't exist; calling it "Coming soon" would understate
 * work that is genuinely on-chain and checkable.
 */
type Tier = "operational" | "registered" | "development" | "planned";

const TIER: Record<
  Tier,
  { label: string; color: string; description: string }
> = {
  operational: {
    label: "OPERATIONAL",
    color: "var(--color-signal-bright)",
    description: "Registered on-chain and serving requests",
  },
  registered: {
    label: "REGISTERED",
    color: "var(--color-brass-bright)",
    description: "On-chain identity live, endpoint in build",
  },
  development: {
    label: "IN DEVELOPMENT",
    color: "var(--color-line-bright)",
    description: "Being built, not yet registered",
  },
  planned: {
    label: "PLANNED",
    color: "var(--color-paper-dim)",
    description: "Specified, not yet started",
  },
};

interface RackEntry {
  key: string;
  code: string;
  name: string;
  role: string;
  summary: string;
  capability: string;
  tier: Tier;
  skills: string[];
}

const RACK: RackEntry[] = [
  {
    key: "scout",
    code: "AG-01",
    name: "BuilderScout",
    role: "Discovery",
    summary:
      "Continuously pulls grants, hackathons and bounties from ecosystem sources, then ranks them against your builder profile.",
    capability: "Live feed from Gitcoin, Devpost and GOAT programmes",
    tier: "operational",
    skills: ["opportunity-discovery", "relevance-ranking", "deadline-tracking"],
  },
  {
    key: "forge",
    code: "AG-02",
    name: "ProofForge",
    role: "Application",
    summary:
      "Scores application drafts against reviewer criteria, identifies gaps and generates supporting documents grounded in your own evidence.",
    capability: "On-chain identity live; scoring endpoint in build",
    tier: "registered",
    skills: ["application-scoring", "document-generation", "gap-analysis"],
  },
  {
    key: "flow",
    code: "AG-03",
    name: "BuilderFlow",
    role: "Automation",
    summary:
      "Tracks deadlines, submission checklists and milestones across every programme you are pursuing at once.",
    capability: "Deadline and milestone automation",
    tier: "development",
    skills: ["deadline-tracking", "workflow-automation"],
  },
  {
    key: "match",
    code: "AG-04",
    name: "BuilderMatch",
    role: "Collaboration",
    summary:
      "Connects you with complementary builders and mentors around a specific opportunity, matched on demonstrated track record.",
    capability: "Needs profile density before it is useful",
    tier: "planned",
    skills: ["collaborator-matching", "team-assembly"],
  },
  {
    key: "rep",
    code: "AG-05",
    name: "BuilderRep",
    role: "Reputation",
    summary:
      "Turns completed grants and verified contributions into a portable record of proof you carry between ecosystems.",
    capability: "Proof-of-work records; on-chain anchoring planned",
    tier: "development",
    skills: ["credential-issuance", "contribution-verification"],
  },
  {
    key: "pay",
    code: "AG-06",
    name: "BuilderPay",
    role: "Settlement",
    summary:
      "Settles grant disbursements and bounty payouts over x402 on GOAT Network, so funding moves at the speed of the work.",
    capability: "Merchant credentials held; wiring follows ProofForge",
    tier: "planned",
    skills: ["x402-settlement", "payout-routing"],
  },
];

export default function AgentRack() {
  const { agents, state, blockNumber } = useAgents();

  // On-chain values arrive keyed by agent, so we merge rather than duplicate.
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

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {RACK.map((entry, i) => (
          <AgentCard
            key={entry.key}
            entry={entry}
            index={i}
            agentId={onChain.get(entry.key)?.identity.agentId ?? null}
          />
        ))}
      </div>

      <p className="mt-8 font-mono text-[10px] leading-relaxed tracking-widest text-paper-dim/40">
        STATUS REFLECTS SHIPPED CAPABILITY, NOT ROADMAP INTENT.
      </p>
    </section>
  );
}

function AgentCard({
  entry,
  index,
  agentId,
}: {
  entry: RackEntry;
  index: number;
  agentId: number | null;
}) {
  const tier = TIER[entry.tier];
  const dimmed = entry.tier === "planned";

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.06, 0.4),
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`group relative flex h-full flex-col rounded-sm border bg-ink-2/50 p-5 transition-colors ${
        dimmed
          ? "border-line/15 hover:border-line/25"
          : "border-line/25 hover:border-line/45"
      }`}
    >
      {/* Corner tick — drafting-sheet detail carried through from the site */}
      <span
        aria-hidden="true"
        className="absolute right-3 top-3 h-2 w-2 border-r border-t"
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
        className={`mt-3 font-display text-lg font-semibold ${
          dimmed ? "text-paper/70" : "text-paper"
        }`}
      >
        {entry.name}
      </h2>

      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-paper-dim">
        {entry.summary}
      </p>

      <div className="mt-4 flex flex-wrap gap-1">
        {entry.skills.map((s) => (
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
        <p className="mt-2 font-mono text-[9px] leading-relaxed tracking-wide text-paper-dim/50">
          {entry.capability}
        </p>
      </footer>
    </motion.article>
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
