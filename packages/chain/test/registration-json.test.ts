import { describe, it, expect } from 'vitest';
import {
  buildRegistrationDocument,
  validateRegistrationDocument,
  REGISTRATION_TYPE,
  type AgentManifest,
} from '../src/erc8004/registration-json';
import { agentRegistryId, ERC8004_ADDRESSES } from '../src/config/networks';
import { AGENT_MANIFESTS, getRegisterableManifests } from '../src/agents/manifests';

const baseManifest: AgentManifest = {
  key: 'test',
  name: 'TestAgent',
  description: 'An agent used in tests.',
  image: 'https://example.com/a.png',
  services: [
    { name: 'A2A', endpoint: 'https://example.com/card.json', version: '0.3.0' },
  ],
  x402Support: false,
  active: true,
};

describe('agentRegistryId', () => {
  it('builds the eip155 identifier for mainnet', () => {
    expect(agentRegistryId('mainnet')).toBe(
      `eip155:2345:${ERC8004_ADDRESSES.mainnet.identityRegistry}`,
    );
  });

  it('uses the testnet-specific registry address, not the mainnet one', () => {
    expect(agentRegistryId('testnet3')).toContain('eip155:48816:');
    expect(agentRegistryId('testnet3')).not.toContain(
      ERC8004_ADDRESSES.mainnet.identityRegistry,
    );
  });
});

describe('buildRegistrationDocument', () => {
  it('emits an empty registrations array when no agentId is known yet', () => {
    const doc = buildRegistrationDocument(baseManifest, { network: 'testnet3' });
    expect(doc.registrations).toEqual([]);
    expect(doc.type).toBe(REGISTRATION_TYPE);
  });

  it('includes the registry identifier and agentId once registered', () => {
    const doc = buildRegistrationDocument(baseManifest, {
      network: 'mainnet',
      agentId: 42,
    });
    expect(doc.registrations).toEqual([
      { agentRegistry: agentRegistryId('mainnet'), agentId: 42 },
    ]);
  });

  it('rejects x402Support without a matching x402 service entry', () => {
    expect(() =>
      buildRegistrationDocument(
        { ...baseManifest, x402Support: true },
        { network: 'testnet3' },
      ),
    ).toThrow(/no x402 service entry/);
  });

  it('accepts x402Support when the service entry is present', () => {
    const doc = buildRegistrationDocument(
      {
        ...baseManifest,
        x402Support: true,
        services: [
          ...baseManifest.services,
          { name: 'x402', endpoint: 'https://example.com/x402', version: '1.0.0' },
        ],
      },
      { network: 'testnet3' },
    );
    expect(doc.x402Support).toBe(true);
  });

  it('omits supportedTrust entirely rather than emitting an empty array', () => {
    const doc = buildRegistrationDocument(
      { ...baseManifest, supportedTrust: [] },
      { network: 'testnet3' },
    );
    expect('supportedTrust' in doc).toBe(false);
  });

  it('rejects a manifest with no services', () => {
    expect(() =>
      buildRegistrationDocument(
        { ...baseManifest, services: [] },
        { network: 'testnet3' },
      ),
    ).toThrow(/at least one service/);
  });
});

describe('validateRegistrationDocument', () => {
  it('accepts a document we generated', () => {
    const doc = buildRegistrationDocument(baseManifest, {
      network: 'mainnet',
      agentId: 1,
    });
    expect(validateRegistrationDocument(doc)).toEqual([]);
  });

  it('flags a foreign document claiming x402 without an endpoint', () => {
    const errors = validateRegistrationDocument({
      type: REGISTRATION_TYPE,
      name: 'Sketchy',
      description: 'Claims payments it cannot take',
      services: [{ name: 'A2A', endpoint: 'https://x', version: '0.3.0' }],
      x402Support: true,
      active: true,
      registrations: [],
    });
    expect(errors).toContain(
      'x402Support is true but no x402 service endpoint is listed',
    );
  });

  it('rejects non-objects', () => {
    expect(validateRegistrationDocument(null)).toEqual(['Document is not an object']);
  });
});

describe('BuilderOS manifests', () => {
  it('every manifest produces a valid document', () => {
    for (const m of AGENT_MANIFESTS) {
      const doc = buildRegistrationDocument(m, { network: 'testnet3', agentId: 1 });
      expect(validateRegistrationDocument(doc)).toEqual([]);
    }
  });

  it('only registers agents that are actually active', () => {
    for (const m of getRegisterableManifests()) {
      expect(m.active).toBe(true);
    }
  });

  it('registers Scout and Forge for the MVP', () => {
    expect(getRegisterableManifests().map((m) => m.key).sort()).toEqual([
      'forge',
      'scout',
    ]);
  });
});
