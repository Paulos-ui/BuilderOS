/**
 * Which agents BuilderOS runs, what they can do, and which of them are
 * registered on GOAT.
 *
 * ── The three things this file keeps apart ─────────────────────────────────
 *
 * These used to be conflated, and the console showed the consequences.
 *
 *   1. CAPABILITY — does the API actually implement this agent? Ours to state,
 *      and checkable by calling `endpoints`.
 *   2. REGISTRATION — is there an ERC-8004 identity on GOAT? Read live from the
 *      chain, independently verifiable by anyone.
 *   3. DESCRIPTION — names, roles, prose. Authored by us. The chain vouches for
 *      none of it, and the API response labels it accordingly.
 *
 * Deriving status from `agentId !== null` alone — which is what it used to do —
 * reported BuilderFlow and BuilderRep as 'beta' even though both serve live
 * traffic, purely because we have not paid gas to register them yet. Two
 * unrelated facts, one field, and the field was wrong.
 *
 * ── Keep in sync with packages/chain/src/agents/manifests.ts ───────────────
 *
 * `skills` and `domains` here are published at /.well-known/agent-card.json;
 * the manifests are what gets written to the ERC-8004 registry. If the two
 * diverge, an agent discovers us through the registry, fetches the card, and
 * finds different capabilities than the registry advertised.
 *
 * This is a MANUAL invariant. `apps/api` does not depend on `packages/chain`
 * (the API deploys to Render without the chain toolchain, and adding the
 * dependency would drag viem's wallet surface into the API build), so no test
 * can compare them directly. `agents.config.spec.ts` pins everything that is
 * checkable from inside this app — unique codes, endpoints present wherever
 * `implemented` is true, x402 agents actually priced — and the cross-package
 * check is a step in the registration runbook instead.
 */
export interface AgentDefinition {
  key: string;
  /** Stable part number, AG-01..AG-06. Matches the console rack ordering. */
  code: string;
  name: string;
  role: string;
  description: string;
  /** A2A skill identifiers. Published on the agent card. */
  skills: string[];
  /** A2A subject domains. Published on the agent card. */
  domains: string[];
  x402Support: boolean;
  /**
   * Routes this agent serves today. The evidence behind `implemented` — a
   * reviewer can curl every one of these.
   */
  endpoints: string[];
  /**
   * True when the API implements the capability now.
   *
   * This is the field that makes the console's operational count honest. It is
   * set by hand rather than inferred, and it should only ever be flipped to
   * true in the same commit that adds the endpoints above.
   */
  implemented: boolean;
  /** null until registered on-chain. Registration is gas, and deliberate. */
  agentId: number | null;
  /** Registration transaction, used to derive confirmation depth. */
  registrationTx: string | null;
}

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    key: 'scout',
    code: 'AG-01',
    name: 'BuilderScout',
    role: 'Discovery',
    description:
      'Scans grant programs, hackathons, and bounty boards, then ranks what it finds against your builder profile.',
    skills: ['opportunity-discovery', 'relevance-ranking', 'deadline-tracking'],
    domains: ['grants', 'hackathons', 'bounties'],
    x402Support: true,
    endpoints: ['/v1/opportunities/feed', '/v1/opportunities/ingest'],
    implemented: true,
    agentId: 341,
    registrationTx:
      '0x2890ca1832721f27ea5ee469a69f28ca4aae915f7b4732702759fd0c79c28ad2',
  },
  {
    key: 'forge',
    code: 'AG-02',
    name: 'ProofForge',
    role: 'Application',
    description:
      'Scores application drafts against reviewer criteria, flags gaps, and generates supporting documents grounded in your own evidence.',
    skills: ['application-scoring', 'document-generation', 'gap-analysis'],
    domains: ['grants', 'accelerators'],
    x402Support: true,
    endpoints: ['/v1/proofforge/score'],
    implemented: true,
    agentId: 342,
    registrationTx:
      '0xf430016977c46476399eb20fd540579d37658941fa98d5657fc4c60619206702',
  },
  {
    key: 'flow',
    code: 'AG-03',
    name: 'BuilderFlow',
    role: 'Automation',
    description:
      'Tracks deadlines, submission checklists, and milestones across every program you are pursuing at once.',
    skills: ['deadline-tracking', 'workflow-automation'],
    domains: ['grants', 'hackathons'],
    x402Support: false,
    endpoints: ['/v1/flow/applications', '/v1/handoff/pipeline'],
    implemented: true,
    agentId: null,
    registrationTx: null,
  },
  {
    key: 'match',
    code: 'AG-04',
    name: 'BuilderMatch',
    role: 'Collaboration',
    description:
      'Finds builders whose skills cover the gaps in yours, scored on shared ecosystem and complementary strengths rather than similarity.',
    skills: ['collaborator-matching'],
    domains: ['grants', 'hackathons'],
    x402Support: false,
    endpoints: ['/v1/match/collaborators'],
    implemented: true,
    agentId: null,
    registrationTx: null,
  },
  {
    key: 'rep',
    code: 'AG-05',
    name: 'BuilderRep',
    role: 'Reputation',
    description:
      'Turns completed grants and recorded contributions into portable builder credentials.',
    skills: ['credential-issuance', 'contribution-verification'],
    domains: ['grants'],
    x402Support: false,
    endpoints: ['/v1/rep', '/v1/rep/records', '/v1/rep/export'],
    implemented: true,
    agentId: null,
    registrationTx: null,
  },
  {
    key: 'pay',
    code: 'AG-06',
    name: 'BuilderPay',
    role: 'Settlement',
    description:
      'Meters agent usage and settles payment over x402 on GOAT Network, without ever holding your keys or your balance.',
    skills: ['usage-metering', 'x402-settlement'],
    domains: ['payments'],
    x402Support: true,
    endpoints: ['/v1/x402/orders', '/v1/pay/quote', '/v1/pay/ledger'],
    implemented: true,
    agentId: null,
    registrationTx: null,
  },
];

export type AgentStatus = 'live' | 'beta' | 'planned';

/**
 * Status from capability and registration together.
 *
 *   planned  no implementation yet
 *   beta     serving requests, no on-chain identity
 *   live     serving requests and registered on GOAT
 *
 * `beta` is the interesting one: it means the agent works and you can call it,
 * but nothing on-chain attests to it existing. That is a real and useful
 * distinction to show a builder, and it is not the same as unfinished.
 */
export function statusFor(d: AgentDefinition): AgentStatus {
  if (!d.implemented) return 'planned';
  return d.agentId !== null ? 'live' : 'beta';
}

export function getAgentDefinition(key: string): AgentDefinition | null {
  return AGENT_DEFINITIONS.find((d) => d.key === key) ?? null;
}

/**
 * Confirmation depth at which we stop calling a registration provisional.
 *
 * This is a PROXY, not a proof. True Bitcoin finality on GOAT comes from
 * BitVM settlement, which we cannot cheaply verify from an RPC call. Depth
 * is a reasonable stand-in for a console readout, and the API labels the
 * field `settlementProxy` so no caller mistakes it for a finality guarantee.
 */
export const FINALITY_CONFIRMATIONS = 64n;
