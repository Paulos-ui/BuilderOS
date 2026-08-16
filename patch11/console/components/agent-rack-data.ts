/**
 * Agent definitions, split out so the rack grid and the detail drawer read
 * from one source rather than drifting apart.
 */

export type Tier = "operational" | "registered" | "development" | "planned";

export const TIER: Record<
  Tier,
  { label: string; color: string; description: string }
> = {
  operational: {
    label: "OPERATIONAL",
    color: "var(--color-signal-bright)",
    description: "Registered on-chain and serving live requests.",
  },
  registered: {
    label: "REGISTERED",
    color: "var(--color-brass-bright)",
    description:
      "ERC-8004 identity is live and verifiable; the endpoint is still in build.",
  },
  development: {
    label: "IN DEVELOPMENT",
    color: "var(--color-line-bright)",
    description: "Being built. Not registered on-chain yet.",
  },
  planned: {
    label: "PLANNED",
    color: "var(--color-paper-dim)",
    description: "Specified in the architecture, not yet started.",
  },
};

export interface RackEntry {
  key: string;
  code: string;
  name: string;
  role: string;
  /** Position in the Discover -> Apply -> Build -> Prove -> Settle pipeline. */
  stage: string;
  summary: string;
  capability: string;
  tier: Tier;
  skills: string[];
  responsibilities: string[];
}

export const RACK: RackEntry[] = [
  {
    key: "scout",
    code: "AG-01",
    name: "BuilderScout",
    role: "Discovery",
    stage: "Discover",
    summary:
      "Continuously pulls grants, hackathons and bounties from ecosystem sources, then ranks them against your builder profile.",
    capability: "Live feed from Gitcoin, Devpost and GOAT programmes.",
    tier: "operational",
    skills: ["opportunity-discovery", "relevance-ranking", "deadline-tracking"],
    responsibilities: [
      "Crawl and normalise listings from ecosystem sources into one schema",
      "Embed each opportunity and rank it against your profile with hybrid retrieval",
      "Filter by chain, category and deadline so irrelevant matches never surface",
      "Mark listings closed once their deadline passes",
    ],
  },
  {
    key: "forge",
    code: "AG-02",
    name: "ProofForge",
    role: "Application",
    stage: "Apply",
    summary:
      "Scores application drafts against reviewer criteria, identifies gaps and generates supporting documents grounded in your own evidence.",
    capability: "On-chain identity live; scoring endpoint in build.",
    tier: "registered",
    skills: ["application-scoring", "document-generation", "gap-analysis"],
    responsibilities: [
      "Score a draft against what reviewers actually reward, section by section",
      "Surface gaps and weak claims before submission rather than after rejection",
      "Generate pitch summaries, technical briefs and budget tables",
      "Ground every generated claim in evidence you supplied — never invent accomplishments",
    ],
  },
  {
    key: "flow",
    code: "AG-03",
    name: "BuilderFlow",
    role: "Automation",
    stage: "Build",
    summary:
      "Tracks deadlines, submission checklists and milestones across every programme you are pursuing at once.",
    capability: "Deadline and milestone automation.",
    tier: "development",
    skills: ["deadline-tracking", "workflow-automation"],
    responsibilities: [
      "Track every deadline across concurrent applications in one timeline",
      "Maintain per-programme submission checklists",
      "Send reminders before something closes, not after",
    ],
  },
  {
    key: "match",
    code: "AG-04",
    name: "BuilderMatch",
    role: "Collaboration",
    stage: "Build",
    summary:
      "Connects you with complementary builders and mentors around a specific opportunity, matched on demonstrated track record.",
    capability: "Needs profile density before it produces useful matches.",
    tier: "planned",
    skills: ["collaborator-matching", "team-assembly"],
    responsibilities: [
      "Match on demonstrated work rather than self-reported skills",
      "Assemble teams around a specific opportunity's requirements",
      "Surface mentors with relevant programme experience",
    ],
  },
  {
    key: "rep",
    code: "AG-05",
    name: "BuilderRep",
    role: "Reputation",
    stage: "Prove",
    summary:
      "Turns completed grants and verified contributions into a portable record of proof you carry between ecosystems.",
    capability: "Proof-of-work records; on-chain anchoring planned.",
    tier: "development",
    skills: ["credential-issuance", "contribution-verification"],
    responsibilities: [
      "Record completed grants and shipped work as structured proof",
      "Verify contributions against their source before recording them",
      "Keep the record portable so it survives leaving the platform",
    ],
  },
  {
    key: "pay",
    code: "AG-06",
    name: "BuilderPay",
    role: "Settlement",
    stage: "Settle",
    summary:
      "Settles grant disbursements and bounty payouts over x402 on GOAT Network, so funding moves at the speed of the work.",
    capability: "Merchant credentials held; wiring follows ProofForge.",
    tier: "planned",
    skills: ["x402-settlement", "payout-routing"],
    responsibilities: [
      "Settle bounty payouts and micro-grants over x402",
      "Meter paid agent calls so usage is priced per request",
      "Reconcile settlement against the work that earned it",
    ],
  },
];

export const PIPELINE = [
  "Discover",
  "Apply",
  "Build",
  "Prove",
  "Settle",
] as const;
