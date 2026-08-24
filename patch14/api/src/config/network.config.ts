import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { defineChain, type Address } from 'viem';

/**
 * GOAT network selection.
 *
 * ── On moving to mainnet ──────────────────────────────────────────────────
 *
 * `GOAT_NETWORK=mainnet` switches reads, x402 settlement and any future
 * registration to Bitcoin-secured mainnet. Three things change materially:
 *
 *   1. Gas is real BTC. Every write costs money.
 *   2. ERC-8004 registration is permanent. An agent registered on mainnet
 *      pointing at a dead endpoint is a public record you cannot retract.
 *   3. x402 settlement moves real value. A bug that double-charges is no
 *      longer a testnet curiosity.
 *
 * Because of (2), registration is gated per agent rather than globally.
 * Reading mainnet costs nothing and is safe to switch on immediately;
 * registering an agent there is a separate, deliberate decision made once
 * that agent can actually answer a request.
 */

export const goatMainnet = defineChain({
  id: 2345,
  name: 'GOAT Network',
  nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.goat.network'] } },
  blockExplorers: {
    default: { name: 'GOAT Explorer', url: 'https://explorer.goat.network' },
  },
});

export const goatTestnet3 = defineChain({
  id: 48816,
  name: 'GOAT Network Testnet3',
  nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet3.goat.network'] } },
  blockExplorers: {
    default: {
      name: 'GOAT Testnet Explorer',
      url: 'https://explorer.testnet3.goat.network',
    },
  },
  testnet: true,
});

export type NetworkName = 'mainnet' | 'testnet3';

interface NetworkProfile {
  chain: typeof goatMainnet;
  identityRegistry: Address;
  reputationRegistry: Address;
  /** agentId per agent key, or null where that agent is not registered here. */
  agentIds: Record<string, number | null>;
}

const PROFILES: Record<NetworkName, NetworkProfile> = {
  mainnet: {
    chain: goatMainnet,
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    reputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
    // Populate as each agent is registered on mainnet. Deliberately empty
    // until then — a wrong id here would display a stranger's agent as ours.
    agentIds: {
      scout: null,
      forge: null,
      flow: null,
      match: null,
      rep: null,
      pay: null,
    },
  },
  testnet3: {
    chain: goatTestnet3,
    identityRegistry: '0x556089008Fc0a60cD09390Eca93477ca254A5522',
    reputationRegistry: '0xd9140951d8aE6E5F625a02F5908535e16e3af964',
    agentIds: {
      scout: 341,
      forge: 342,
      flow: null,
      match: null,
      rep: null,
      pay: null,
    },
  },
};

@Injectable()
export class NetworkConfig {
  private readonly logger = new Logger(NetworkConfig.name);

  constructor(private readonly config: ConfigService) {
    this.logger.log(
      `GOAT network: ${this.name}${this.isMainnet ? ' — writes cost real BTC' : ''}`,
    );
  }

  get name(): NetworkName {
    return this.config.get<string>('GOAT_NETWORK') === 'mainnet'
      ? 'mainnet'
      : 'testnet3';
  }

  get isMainnet(): boolean {
    return this.name === 'mainnet';
  }

  get profile(): NetworkProfile {
    return PROFILES[this.name];
  }

  get chain() {
    return this.profile.chain;
  }

  get rpcUrl(): string {
    return (
      this.config.get<string>('GOAT_RPC_URL') ??
      this.profile.chain.rpcUrls.default.http[0]
    );
  }

  get explorerUrl(): string {
    return this.profile.chain.blockExplorers.default.url;
  }

  agentId(key: string): number | null {
    // An env override lets you register on mainnet and point at the new id
    // without a redeploy of this file.
    const override = this.config.get<string>(
      `AGENT_ID_${key.toUpperCase()}_${this.name.toUpperCase()}`,
    );
    if (override) return Number(override);
    return this.profile.agentIds[key] ?? null;
  }

  get registryId(): string {
    return `eip155:${this.chain.id}:${this.profile.identityRegistry}`;
  }
}
