import { AGENT_DEFINITIONS, statusFor, getAgentDefinition } from './agents.config';
import { PRICE_LIST } from '../pay/pricing.config';

/**
 * The agent list is published in three places — the console rack, the A2A agent
 * card, and (via the chain manifests) the ERC-8004 registry. Every claim in it
 * is public and checkable by someone deciding whether to fund us, so the
 * invariants below are the ones where being wrong is worse than being late.
 */
describe('AGENT_DEFINITIONS', () => {
  it('has all six agents', () => {
    expect(AGENT_DEFINITIONS).toHaveLength(6);
  });

  it('numbers them AG-01 through AG-06 with no gaps', () => {
    // AG-04 and AG-06 were missing entirely, and rep was labelled AG-05 with
    // nothing in between — the console's part numbers skipped a beat.
    expect(AGENT_DEFINITIONS.map((d) => d.code)).toEqual([
      'AG-01',
      'AG-02',
      'AG-03',
      'AG-04',
      'AG-05',
      'AG-06',
    ]);
  });

  it('uses unique keys and names', () => {
    const keys = AGENT_DEFINITIONS.map((d) => d.key);
    const names = AGENT_DEFINITIONS.map((d) => d.name);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every implemented agent at least one endpoint', () => {
    // `implemented: true` with no endpoints is an unfalsifiable claim. The
    // endpoint list is the evidence, and a reviewer can curl it.
    for (const d of AGENT_DEFINITIONS.filter((a) => a.implemented)) {
      expect(d.endpoints.length).toBeGreaterThan(0);
    }
  });

  it('gives every agent at least one skill and domain for the agent card', () => {
    for (const d of AGENT_DEFINITIONS) {
      expect(d.skills.length).toBeGreaterThan(0);
      expect(d.domains.length).toBeGreaterThan(0);
    }
  });

  it('states endpoints as absolute paths', () => {
    // The agent card prefixes these with the API base. A relative path would
    // produce a malformed URL in a document other agents parse.
    for (const d of AGENT_DEFINITIONS) {
      for (const e of d.endpoints) {
        expect(e.startsWith('/')).toBe(true);
      }
    }
  });

  it('pairs every agentId with the transaction that created it', () => {
    // An agentId without a tx cannot have its confirmation depth derived, and
    // the console would show a registration it cannot evidence.
    for (const d of AGENT_DEFINITIONS) {
      if (d.agentId !== null) {
        expect(d.registrationTx).toMatch(/^0x[0-9a-f]{64}$/i);
      } else {
        expect(d.registrationTx).toBeNull();
      }
    }
  });

  it('never registers an agent it has not implemented', () => {
    // This is the registry-pollution rule from the chain manifests, enforced.
    // Registering a dead endpoint is a permanent public claim we cannot retract.
    for (const d of AGENT_DEFINITIONS) {
      if (d.agentId !== null) expect(d.implemented).toBe(true);
    }
  });
});

describe('statusFor', () => {
  it('reports an implemented, registered agent as live', () => {
    expect(statusFor(getAgentDefinition('scout')!)).toBe('live');
  });

  it('reports an implemented but unregistered agent as beta, not planned', () => {
    // The bug this replaces: BuilderFlow and BuilderRep serve live traffic and
    // were reported as unfinished purely because we had not paid gas yet.
    expect(statusFor(getAgentDefinition('flow')!)).toBe('beta');
    expect(statusFor(getAgentDefinition('rep')!)).toBe('beta');
  });

  it('reports an unimplemented agent as planned regardless of registration', () => {
    expect(
      statusFor({
        ...getAgentDefinition('match')!,
        implemented: false,
        agentId: null,
      }),
    ).toBe('planned');
  });

  it('has no planned agents left', () => {
    // The whole point of building AG-04 and AG-06: the console's operational
    // count is 6/6 because six are built, not because the badge was edited.
    const planned = AGENT_DEFINITIONS.filter((d) => statusFor(d) === 'planned');
    expect(planned).toEqual([]);
  });
});

describe('agent definitions against the price list', () => {
  it('prices only agents that claim x402 support', () => {
    // A price on an agent that does not advertise payment support would issue a
    // 402 that no client was told to expect.
    for (const entry of Object.values(PRICE_LIST)) {
      const agent = getAgentDefinition(entry.agentKey);
      expect(agent).not.toBeNull();
      expect(agent!.x402Support).toBe(true);
    }
  });

  it('prices only operations on implemented agents', () => {
    for (const entry of Object.values(PRICE_LIST)) {
      expect(getAgentDefinition(entry.agentKey)!.implemented).toBe(true);
    }
  });

  it('prices only routes the agent actually serves', () => {
    // The check that stops us publishing a price for a 404. If a priced route
    // is not in the agent's endpoint list, either the route does not exist or
    // the endpoint list is lying — both are worth failing a build over.
    for (const entry of Object.values(PRICE_LIST)) {
      const agent = getAgentDefinition(entry.agentKey)!;
      expect(agent.endpoints).toContain(entry.route);
    }
  });
});
