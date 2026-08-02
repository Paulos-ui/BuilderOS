import type { ConsoleAgent } from "./types";

/**
 * ── Where this data comes from ─────────────────────────────────────────────
 *
 * The shape here matches exactly what `@builderos/chain` returns, so wiring
 * live reads is a swap of this module's export, not a refactor of the UI:
 *
 *   identity   <- IdentityRegistryClient  (agentId, registry, tx)
 *   reputation <- ReputationRegistryClient.getSummary()
 *
 * Until BuilderScout and ProofForge are registered on testnet3, the values
 * below are seeded. They are deliberately *unflattering* — low feedback
 * counts, two unregistered agents — because a console that demos with fake
 * healthy numbers teaches you nothing about how it looks when the system is
 * actually cold, which is the state every real user sees on day one.
 */

const TESTNET_REGISTRY =
  "eip155:48816:0x556089008Fc0a60cD09390Eca93477ca254A5522";

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
      agentId: 1042,
      settlement: "final",
      network: "testnet3",
      registryId: TESTNET_REGISTRY,
      txHash: "0x7a3f9c2e8b1d4a6f5c0e9b8d7a2f4c1e6b3d8a5f9c2e7b4d1a6f3c8e5b2d9a4f",
    },
    reputation: { count: 18, average: 4.4, clients: 12 },
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
      agentId: 1043,
      settlement: "sequenced",
      network: "testnet3",
      registryId: TESTNET_REGISTRY,
      txHash: "0x2c8e5b1d9a4f7c3e6b0d8a5f2c9e4b7d1a6f3c8e5b2d9a4f7c1e6b3d8a5f2c9e",
    },
    reputation: { count: 7, average: 4.1, clients: 5 },
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
    identity: {
      agentId: null,
      settlement: "pending",
      network: "testnet3",
      registryId: TESTNET_REGISTRY,
      txHash: null,
    },
    reputation: null,
  },
  {
    key: "rep",
    code: "AG-05",
    name: "BuilderRep",
    role: "Reputation",
    description:
      "Turns completed grants and verified contributions into portable builder credentials anchored on GOAT Network.",
    status: "beta",
    x402Support: false,
    skills: ["credential-issuance", "contribution-verification"],
    identity: {
      agentId: null,
      settlement: "pending",
      network: "testnet3",
      registryId: TESTNET_REGISTRY,
      txHash: null,
    },
    reputation: null,
  },
];
