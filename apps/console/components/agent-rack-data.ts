/**
 * Console-only copy for each agent.
 *
 * ── What lives here and what does not ─────────────────────────────────────
 *
 * This file used to duplicate the API: it carried its own `tier`, its own
 * skills list, its own "AGENT #342 ON GOAT TESTNET3" string, and its own idea
 * of which agents existed. All four drifted. The rack said BuilderMatch and
 * BuilderPay were "planned" for weeks after both shipped, and the operational
 * badge read 4 of 6 because it was counting entries in this array.
 *
 * So the split is now strict:
 *
 *   From the API (/v1/agents)   which agents exist, status, skills, agent ids,
 *                               registration, counts — anything checkable
 *   From this file              the second-person sentences describing what an
 *                               agent does for you, and where clicking it goes
 *
 * If a fact can be verified — by curling an endpoint or reading the chain — it
 * does not belong here. The API is the source, and it is the thing a reviewer
 * can independently check.
 *
 * `launchPath` is what makes an agent usable rather than merely described. An
 * agent people can read about but not run is a brochure.
 */

export interface RackCopy {
  /** Stage of the funding workflow. Shown as the row's category. */
  stage: string;
  /** One sentence, second person, no jargon. Shown on the collapsed row. */
  summary: string;
  /** What it actually does for you. Shown when the row is expanded. */
  responsibilities: string[];
  /** Where running this agent takes you. */
  launchPath: string;
  launchLabel: string;
}

export const RACK_COPY: Record<string, RackCopy> = {
  scout: {
    stage: "Discover",
    summary:
      "Finds grants, hackathons and bounties across ecosystem sources and ranks them for you, so you stop hunting through Discords and Notion boards.",
    responsibilities: [
      "Pulls open opportunities from ecosystem sources every time it runs",
      "Ranks them against your profile, so the relevant ones surface first",
      "Filters by chain, category and deadline",
      "Drops listings once their deadline passes, so nothing dead clutters your feed",
    ],
    launchPath: "/console/opportunities",
    launchLabel: "Open opportunity feed",
  },
  forge: {
    stage: "Apply",
    summary:
      "Reviews your draft before you submit it: scores it against what reviewers reward, flags the weak sections, and drafts supporting documents from your own material.",
    responsibilities: [
      "Scores a draft section by section against real reviewer criteria",
      "Names the specific gaps that would cost you the grant",
      "Drafts pitch summaries, technical briefs and budget tables",
      "Grounds every claim in evidence you supplied — it will not invent accomplishments",
    ],
    launchPath: "/console/apply",
    launchLabel: "Review an application",
  },
  flow: {
    stage: "Build",
    summary:
      "Keeps every deadline, checklist and milestone in one place, across all the programmes you have open at once.",
    responsibilities: [
      "One timeline across every application you have open",
      "Per-programme submission checklists",
      "Reminders before something closes, not after",
      "Hands a won application straight to BuilderRep as a proof record",
    ],
    launchPath: "/console/track",
    launchLabel: "Open application tracker",
  },
  match: {
    stage: "Build",
    summary:
      "Finds builders whose strengths cover your gaps — scored on what they have shipped and which ecosystems you share, not on how similar you look.",
    responsibilities: [
      "Ranks on complementary skills, so it surfaces people who fill your gaps",
      "Weights builders working in the same ecosystems as you",
      "Reads from profile text you control, and skips profiles too thin to judge",
      "Says when it has too little to go on instead of returning filler matches",
    ],
    launchPath: "/console/collaborators",
    launchLabel: "Find collaborators",
  },
  rep: {
    stage: "Prove",
    summary:
      "Turns the work you complete into a portable record of proof you can carry into the next programme you apply to.",
    responsibilities: [
      "Records completed grants and shipped work as structured proof",
      "Marks every record as unverified until something independent attests to it",
      "Exports the whole record as JSON, so it survives you leaving the platform",
    ],
    launchPath: "/console/proof",
    launchLabel: "Open proof record",
  },
  pay: {
    stage: "Settle",
    summary:
      "Prices and settles paid agent calls over x402, without ever holding your keys or your balance.",
    responsibilities: [
      "Publishes the price of every metered operation before you run one",
      "Answers a paid call with a real HTTP 402 challenge, per the x402 spec",
      "Verifies the payment signature against the asset's own EIP-712 domain",
      "Rejects a reused authorization, so one signature cannot be spent twice",
      "Never handles a private key — your wallet signs, we only verify",
    ],
    launchPath: "/console/settlement",
    launchLabel: "Open settlement ledger",
  },
};

export function copyFor(key: string): RackCopy | null {
  return RACK_COPY[key] ?? null;
}

export const PIPELINE = ["Discover", "Apply", "Build", "Prove", "Settle"] as const;
