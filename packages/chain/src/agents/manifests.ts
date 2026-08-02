import type { AgentManifest } from '../erc8004/registration-json';

/**
 * ── Why six identities, not one ────────────────────────────────────────────
 *
 * The ERC-8004 Reputation Registry accrues feedback per `agentId`. If all of
 * BuilderOS registered under a single identity, "BuilderScout surfaced a
 * great grant" and "ProofForge mis-scored my application" would land in the
 * same bucket, and neither signal would be actionable — for us or for a
 * caller deciding whether to trust a specific capability.
 *
 * Separate identities also make discovery work the way the registry intends:
 * an external agent looking for grant discovery should find BuilderScout,
 * not a monolith it has to introspect.
 *
 * ── Why we do NOT register all six today ──────────────────────────────────
 *
 * The GOAT docs are explicit that registration is discoverability, not
 * automatic trust, and that `x402Support` should reflect real payment
 * capability rather than being decorative. Registering BuilderMatch or
 * BuilderPay before they can answer a single request would put dead
 * endpoints into a public registry that other agents are meant to rely on.
 * That is registry pollution, and it is the kind of thing that costs
 * credibility with the ecosystem team we are asking to fund us.
 *
 * So: manifests are authored for all six, `registerNow` gates which ones
 * actually hit the chain. Flip the flag when the endpoint is live.
 */

export interface BuilderOsAgentManifest extends AgentManifest {
  /** Gate for the registration script — only true agents get registered. */
  registerNow: boolean;
}

const API_BASE = process.env.BUILDEROS_API_BASE ?? 'https://api.builderos.dev';
const SITE_BASE = process.env.BUILDEROS_SITE_BASE ?? 'https://builderos.dev';

export const AGENT_MANIFESTS: BuilderOsAgentManifest[] = [
  {
    key: 'scout',
    name: 'BuilderScout',
    description:
      'Discovers grants, hackathons, accelerators, bounties, and ecosystem funding programs, and ranks them against a builder profile assembled from repositories, prior funding history, and on-chain activity.',
    image: `${SITE_BASE}/agents/scout.png`,
    services: [
      {
        name: 'A2A',
        endpoint: `${API_BASE}/.well-known/agent-card.json`,
        version: '0.3.0',
        skills: ['opportunity-discovery', 'relevance-ranking', 'deadline-tracking'],
        domains: ['grants', 'hackathons', 'bounties'],
      },
      {
        name: 'x402',
        endpoint: `${API_BASE}/v1/x402/orders`,
        version: '1.0.0',
      },
    ],
    x402Support: true,
    active: true,
    supportedTrust: ['reputation'],
    registerNow: true,
  },
  {
    key: 'forge',
    name: 'ProofForge',
    description:
      'Reviews and strengthens funding applications: scores drafts against reviewer criteria, identifies gaps, and generates supporting documents grounded strictly in evidence the builder supplied.',
    image: `${SITE_BASE}/agents/forge.png`,
    services: [
      {
        name: 'A2A',
        endpoint: `${API_BASE}/.well-known/agent-card.json`,
        version: '0.3.0',
        skills: ['application-scoring', 'document-generation', 'gap-analysis'],
        domains: ['grants', 'accelerators'],
      },
      {
        name: 'x402',
        endpoint: `${API_BASE}/v1/x402/orders`,
        version: '1.0.0',
      },
    ],
    x402Support: true,
    active: true,
    supportedTrust: ['reputation'],
    registerNow: true,
  },
  {
    key: 'flow',
    name: 'BuilderFlow',
    description:
      'Automates the logistics around building: deadline tracking, submission checklists, milestone reminders, and status syncing across concurrent programs.',
    image: `${SITE_BASE}/agents/flow.png`,
    services: [
      {
        name: 'A2A',
        endpoint: `${API_BASE}/.well-known/agent-card.json`,
        version: '0.3.0',
        skills: ['deadline-tracking', 'workflow-automation'],
      },
    ],
    x402Support: false,
    active: false,
    registerNow: false,
  },
  {
    key: 'match',
    name: 'BuilderMatch',
    description:
      'Connects builders with complementary skills, mentors, and collaborators around a specific opportunity, matched on demonstrated track record rather than self-reported profiles.',
    image: `${SITE_BASE}/agents/match.png`,
    services: [
      {
        name: 'A2A',
        endpoint: `${API_BASE}/.well-known/agent-card.json`,
        version: '0.3.0',
        skills: ['collaborator-matching'],
      },
    ],
    x402Support: false,
    active: false,
    registerNow: false,
  },
  {
    key: 'rep',
    name: 'BuilderRep',
    description:
      'Converts completed grants, shipped work, and verified contributions into portable builder credentials, anchored on GOAT Network for independent verification.',
    image: `${SITE_BASE}/agents/rep.png`,
    services: [
      {
        name: 'A2A',
        endpoint: `${API_BASE}/.well-known/agent-card.json`,
        version: '0.3.0',
        skills: ['credential-issuance', 'contribution-verification'],
      },
    ],
    x402Support: false,
    active: false,
    registerNow: false,
  },
  {
    key: 'pay',
    name: 'BuilderPay',
    description:
      'Settles grant disbursements, bounty payouts, and inter-agent service payments over x402 on GOAT Network.',
    image: `${SITE_BASE}/agents/pay.png`,
    services: [
      {
        name: 'x402',
        endpoint: `${API_BASE}/v1/x402/orders`,
        version: '1.0.0',
      },
    ],
    x402Support: true,
    active: false,
    registerNow: false,
  },
];

export function getManifest(key: string): BuilderOsAgentManifest {
  const found = AGENT_MANIFESTS.find((m) => m.key === key);
  if (!found) {
    const known = AGENT_MANIFESTS.map((m) => m.key).join(', ');
    throw new Error(`Unknown agent "${key}". Known agents: ${known}`);
  }
  return found;
}

export function getRegisterableManifests(): BuilderOsAgentManifest[] {
  return AGENT_MANIFESTS.filter((m) => m.registerNow);
}
