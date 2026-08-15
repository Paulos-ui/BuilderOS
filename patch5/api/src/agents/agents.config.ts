/**
 * Which on-chain agents belong to BuilderOS, and the descriptive metadata
 * that is ours rather than the chain's.
 *
 * The split matters: agentId, owner, tokenURI and reputation are read live
 * from GOAT and are independently verifiable by anyone. Names, roles and
 * descriptions are authored by us and live here. The API response labels
 * which is which so the console never implies the chain vouches for our
 * copy.
 */
export interface AgentDefinition {
  key: string;
  code: string;
  name: string;
  role: string;
  description: string;
  skills: string[];
  x402Support: boolean;
  /** null until the agent is registered on-chain. */
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
    x402Support: true,
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
    x402Support: true,
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
    x402Support: false,
    agentId: null,
    registrationTx: null,
  },
  {
    key: 'rep',
    code: 'AG-05',
    name: 'BuilderRep',
    role: 'Reputation',
    description:
      'Turns completed grants and verified contributions into portable builder credentials.',
    skills: ['credential-issuance', 'contribution-verification'],
    x402Support: false,
    agentId: null,
    registrationTx: null,
  },
];

/**
 * Confirmation depth at which we stop calling a registration provisional.
 *
 * This is a PROXY, not a proof. True Bitcoin finality on GOAT comes from
 * BitVM settlement, which we cannot cheaply verify from an RPC call. Depth
 * is a reasonable stand-in for a console readout, and the API labels the
 * field `settlementProxy` so no caller mistakes it for a finality guarantee.
 */
export const FINALITY_CONFIRMATIONS = 64n;
