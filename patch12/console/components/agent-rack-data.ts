/**
 * Agent definitions, shared by the rack grid and the launcher panel.
 *
 * `launchPath` is what makes an agent usable rather than merely described.
 * An agent with no launch path is one you can read about but not run, which
 * is why `unavailableReason` has to say something true and specific rather
 * than "coming soon".
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
    description: "ERC-8004 identity is live; the endpoint is still in build.",
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
  stage: string;
  summary: string;
  capability: string;
  tier: Tier;
  skills: string[];
  responsibilities: string[];
  /** Where running this agent takes you. Absent means it cannot be run yet. */
  launchPath?: string;
  launchLabel?: string;
  launchHint?: string;
  unavailableReason?: string;
}

export const RACK: RackEntry[] = [
  {
    key: "scout",
    code: "AG-01",
    name: "BuilderScout",
    role: "Discovery",
    stage: "Discover",
    summary:
      "Finds grants, hackathons and bounties across ecosystem sources and ranks them for you, so you stop hunting through Discords and Notion boards.",
    capability: "Live feed from Gitcoin, Devpost and GOAT programmes.",
    tier: "operational",
    skills: ["opportunity-discovery", "relevance-ranking", "deadline-tracking"],
    responsibilities: [
      "Pulls open opportunities from ecosystem sources every time it runs",
      "Ranks them against your profile, so the relevant ones surface first",
      "Filters by chain, category and deadline",
      "Drops listings once their deadline passes, so nothing dead clutters your feed",
    ],
    launchPath: "/console/opportunities",
    launchLabel: "Open opportunity feed",
    launchHint: "LIVE · UPDATED EACH INGESTION RUN",
  },
  {
    key: "forge",
    code: "AG-02",
    name: "ProofForge",
    role: "Application",
    stage: "Apply",
    summary:
      "Reviews your application draft before you submit it: scores it against what reviewers reward, flags weak sections, and drafts supporting documents from your own material.",
    capability: "On-chain identity live; scoring endpoint in build.",
    tier: "registered",
    skills: ["application-scoring", "document-generation", "gap-analysis"],
    responsibilities: [
      "Scores a draft section by section against real reviewer criteria",
      "Names the specific gaps that would cost you the grant",
      "Drafts pitch summaries, technical briefs and budget tables",
      "Grounds every claim in evidence you supplied — it will not invent accomplishments",
    ],
    unavailableReason:
      "ProofForge is registered on-chain as agent #342, but its scoring endpoint is still being built. It is next in the queue.",
  },
  {
    key: "flow",
    code: "AG-03",
    name: "BuilderFlow",
    role: "Automation",
    stage: "Build",
    summary:
      "Keeps track of every deadline, checklist and milestone across all the programmes you are pursuing at once.",
    capability: "Deadline and milestone automation.",
    tier: "development",
    skills: ["deadline-tracking", "workflow-automation"],
    responsibilities: [
      "One timeline across every application you have open",
      "Per-programme submission checklists",
      "Reminders before something closes, not after",
    ],
    unavailableReason:
      "In development. It becomes useful once you have several applications running at once, which needs ProofForge first.",
  },
  {
    key: "match",
    code: "AG-04",
    name: "BuilderMatch",
    role: "Collaboration",
    stage: "Build",
    summary:
      "Finds collaborators and mentors for a specific opportunity, matched on what they have actually shipped.",
    capability: "Needs profile density before it produces useful matches.",
    tier: "planned",
    skills: ["collaborator-matching", "team-assembly"],
    responsibilities: [
      "Matches on demonstrated work, not self-reported skills",
      "Assembles teams around a specific opportunity's requirements",
      "Surfaces mentors with relevant programme experience",
    ],
    unavailableReason:
      "Planned. Matching needs a critical mass of builder profiles before it returns anything worth acting on — building it now would produce empty results.",
  },
  {
    key: "rep",
    code: "AG-05",
    name: "BuilderRep",
    role: "Reputation",
    stage: "Prove",
    summary:
      "Turns the work you complete into a portable record of proof you can carry into the next programme you apply to.",
    capability: "Proof-of-work records; on-chain anchoring planned.",
    tier: "development",
    skills: ["credential-issuance", "contribution-verification"],
    responsibilities: [
      "Records completed grants and shipped work as structured proof",
      "Verifies contributions against their source before recording them",
      "Keeps the record portable, so it survives you leaving the platform",
    ],
    unavailableReason:
      "In development. There is nothing to record until applications are being completed through the platform.",
  },
  {
    key: "pay",
    code: "AG-06",
    name: "BuilderPay",
    role: "Settlement",
    stage: "Settle",
    summary:
      "Settles bounty payouts and grant disbursements over x402 on GOAT Network, so funding moves as fast as the work does.",
    capability: "Merchant credentials held; wiring follows ProofForge.",
    tier: "planned",
    skills: ["x402-settlement", "payout-routing"],
    responsibilities: [
      "Settles bounty payouts and micro-grants over x402",
      "Meters paid agent calls so usage is priced per request",
      "Reconciles settlement against the work that earned it",
    ],
    unavailableReason:
      "Planned. Merchant credentials are held, but metering needs a paid service to meter — that arrives with ProofForge.",
  },
];

export const PIPELINE = ["Discover", "Apply", "Build", "Prove", "Settle"] as const;
