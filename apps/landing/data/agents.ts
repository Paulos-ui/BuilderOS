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
      "Connects builders with complementary skills, mentors, and co-founders around a specific opportunity or track — matched on proven track record, not a static profile.",
    status: "planned",
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
      "Planned: settlement for grant disbursement and bounty payouts over x402 on GOAT Network, so funding can move at the speed of the work.",
    status: "planned",
    x: 24,
    y: 70,
  },
];

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
] as const;
