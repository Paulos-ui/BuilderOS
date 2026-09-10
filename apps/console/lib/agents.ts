import type { ConsoleAgent } from "./types";

/**
 * Offline fallback for the agent rack.
 *
 * ── What this is for ──────────────────────────────────────────────────────
 *
 * `useAgents()` reads the live registry through the API. When the API cannot be
 * reached — a cold Render instance takes ~30s to wake — the rack renders this
 * instead, and `ChainStatus` says so in the header.
 *
 * ── Why every on-chain field here is empty ────────────────────────────────
 *
 * The previous version of this file seeded agent #1042 and #1043 with invented
 * transaction hashes and a reputation of "18 ratings, 4.4 average". None of it
 * was real. The banner said "showing local definitions", but nothing about a
 * plausible agent id next to a 64-character hash reads as a placeholder, and
 * the single most likely person to hit a cold API is someone we sent a link to.
 *
 * So the rule for this file: it may state what we BUILT, because that is a fact
 * about this repository and true whether or not the network answers. It may not
 * state what the CHAIN says, because that requires reading the chain.
 *
 *   description, role, skills, x402Support   authored by us — safe to seed
 *   agentId, txHash                          real values, or null
 *   settlement, reputation                   never seeded; the UI shows NO SIGNAL
 *
 * The two real agent ids below are hardcoded facts we can evidence, not
 * decoration: #341 and #342 are on GOAT testnet3 and the transaction hashes
 * resolve in the explorer. Keep in sync with
 * apps/api/src/agents/agents.config.ts.
 */

const TESTNET_REGISTRY =
  "eip155:48816:0x556089008Fc0a60cD09390Eca93477ca254A5522";

/** No chain read happened, so every derived on-chain value is unknown. */
const UNREAD = {
  settlement: "pending",
  network: "testnet3",
  registryId: TESTNET_REGISTRY,
} as const;

export const CONSOLE_AGENTS: ConsoleAgent[] = [
  {
    key: "scout",
    code: "AG-01",
    name: "BuilderScout",
    role: "Discovery",
    description:
      "Scans grant programs, hackathons, and bounty boards, then ranks what it finds against your builder profile.",
    status: "live",
    x402Support: true,
    skills: ["opportunity-discovery", "relevance-ranking", "deadline-tracking"],
    identity: {
      ...UNREAD,
      agentId: 341,
      txHash:
        "0x2890ca1832721f27ea5ee469a69f28ca4aae915f7b4732702759fd0c79c28ad2",
    },
    reputation: null,
    handoffTo: "forge",
  },
  {
    key: "forge",
    code: "AG-02",
    name: "ProofForge",
    role: "Application",
    description:
      "Scores application drafts against reviewer criteria, flags gaps, and generates supporting documents grounded in your own evidence.",
    status: "live",
    x402Support: true,
    skills: ["application-scoring", "document-generation", "gap-analysis"],
    identity: {
      ...UNREAD,
      agentId: 342,
      txHash:
        "0xf430016977c46476399eb20fd540579d37658941fa98d5657fc4c60619206702",
    },
    reputation: null,
    handoffTo: "flow",
  },
  {
    key: "flow",
    code: "AG-03",
    name: "BuilderFlow",
    role: "Automation",
    description:
      "Tracks deadlines, submission checklists, and milestones across every program you are pursuing at once.",
    status: "beta",
    x402Support: false,
    skills: ["deadline-tracking", "workflow-automation"],
    identity: { ...UNREAD, agentId: null, txHash: null },
    reputation: null,
    handoffTo: "match",
  },
  {
    key: "match",
    code: "AG-04",
    name: "BuilderMatch",
    role: "Collaboration",
    description:
      "Finds builders whose skills cover the gaps in yours, scored on shared ecosystem and complementary strengths rather than similarity.",
    status: "beta",
    x402Support: false,
    skills: ["collaborator-matching"],
    identity: { ...UNREAD, agentId: null, txHash: null },
    reputation: null,
    handoffTo: "rep",
  },
  {
    key: "rep",
    code: "AG-05",
    name: "BuilderRep",
    role: "Reputation",
    description:
      "Turns completed grants and recorded contributions into portable builder credentials.",
    status: "beta",
    x402Support: false,
    skills: ["credential-issuance", "contribution-verification"],
    identity: { ...UNREAD, agentId: null, txHash: null },
    reputation: null,
    handoffTo: "pay",
  },
  {
    key: "pay",
    code: "AG-06",
    name: "BuilderPay",
    role: "Settlement",
    description:
      "Meters agent usage and settles payment over x402 on GOAT Network, without ever holding your keys or your balance.",
    status: "beta",
    x402Support: true,
    skills: ["usage-metering", "x402-settlement"],
    identity: { ...UNREAD, agentId: null, txHash: null },
    reputation: null,
  },
];
