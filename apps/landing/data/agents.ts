/**
 * The six agents, as drawn on the landing page constellation.
 *
 * ── Why this list is allowed to exist separately ──────────────────────────
 *
 * `/v1/agents` is the source of truth for what is shipped. This file duplicates
 * part of it, which normally would not be acceptable — but the landing page is
 * a static marketing site and its hero must render instantly for someone who
 * has never signed in. Fetching the console API would put a cold Render
 * instance (~30s to wake) in front of the first thing a grant reviewer sees.
 *
 * The `x`/`y` coordinates are genuinely local: they are constellation positions
 * with no meaning to the API.
 *
 * ── The part that must not drift ──────────────────────────────────────────
 *
 * `status` here was wrong for weeks. BuilderMatch and BuilderPay were both
 * built, deployed and answering requests while this file — the public one —
 * described them as "planned". Understating shipped work on the page we point
 * funders at is the most expensive possible direction for this bug to run.
 *
 * When an agent's status changes in `apps/api/src/agents/agents.config.ts`,
 * change it here in the same commit.
 */

export type AgentId =
  | "scout"
  | "forge"
  | "flow"
  | "match"
  | "rep"
  | "pay";

export interface Agent {
  id: AgentId;
  code: string; // schematic reference code, e.g. "AG-01"
  name: string;
  role: string;
  description: string;
  status: "live" | "beta" | "planned";
  // position on the constellation grid, in percentage of the SVG viewBox
  x: number;
  y: number;
}

export const AGENTS: Agent[] = [
  {
    id: "scout",
    code: "AG-01",
    name: "BuilderScout",
    role: "Discovery",
    description:
      "Continuously scans grant programs, hackathons, accelerators, bounty boards, and ecosystem funds, then ranks them against a builder profile assembled from your repositories, past submissions and stated focus — so the right ones surface before the deadline crowd finds them.",
    status: "live",
    x: 18,
    y: 32,
  },
  {
    id: "forge",
    code: "AG-02",
    name: "ProofForge",
    role: "Application",
    description:
      "Turns a discovered opportunity into a stronger application: scores your draft against what reviewers actually reward, recommends fixes, and generates supporting documents — pitch narratives, technical write-ups, budget breakdowns.",
    status: "live",
    x: 46,
    y: 18,
  },
  {
    id: "flow",
    code: "AG-03",
    name: "BuilderFlow",
    role: "Automation",
    description:
      "Automates the repetitive scaffolding around building: deadline tracking, submission checklists, milestone reminders, and status syncing across the programs you're pursuing at once.",
    status: "beta",
    x: 74,
    y: 30,
  },
  {
    id: "match",
    code: "AG-04",
    name: "BuilderMatch",
    role: "Collaboration",
    description:
      "Finds builders whose strengths cover the gaps in yours, ranked on complementary skills, shared ecosystems and recorded results rather than on how similar two profiles look. It says when it has too little to go on instead of returning filler.",
    status: "beta",
    x: 82,
    y: 62,
  },
  {
    id: "rep",
    code: "AG-05",
    name: "BuilderRep",
    role: "Reputation",
    description:
      "Turns completed submissions and verified contributions into a structured, portable record of proof-of-work — designed to be carried across ecosystems rather than locked to one platform. Anchoring this record on GOAT Network is planned, not yet shipped.",
    status: "beta",
    x: 54,
    y: 78,
  },
  {
    id: "pay",
    code: "AG-06",
    name: "BuilderPay",
    role: "Settlement",
    description:
      "Meters paid agent calls and answers them with a real HTTP 402 challenge over x402 on GOAT Network. Your wallet signs; BuilderOS never holds a private key. Authorizations are verified against the asset's own EIP-712 domain and recorded — broadcasting them needs an x402 facilitator for GOAT, which does not exist yet.",
    status: "beta",
    x: 24,
    y: 70,
  },
];

/**
 * The route the landing page walks a visitor through.
 *
 * Keep this the same length as `NODES` in `components/PipelineSection.tsx` —
 * that array supplies one coordinate per step and the two are indexed
 * together.
 */
export const PIPELINE_STEPS = [
  {
    label: "Discover",
    agent: "BuilderScout",
    detail: "Opportunities ranked to your profile, before deadlines crowd them.",
  },
  {
    label: "Apply",
    agent: "ProofForge",
    detail: "AI-scored drafts, generated documents, reviewer-aware feedback.",
  },
  {
    label: "Build",
    agent: "BuilderFlow",
    detail: "Milestones, deadlines, and submission logistics on autopilot.",
  },
  {
    label: "Prove",
    agent: "BuilderRep",
    detail: "Completed work becomes a structured, portable record of proof.",
  },
  {
    label: "Settle",
    agent: "BuilderPay",
    detail: "Paid agent calls metered and settled over x402. Your wallet signs.",
  },
] as const;
