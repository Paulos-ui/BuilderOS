import { defineChain } from 'viem';

/**
 * GOAT Network is Bitcoin-secured infrastructure with EVM-equivalent
 * execution — BTC is the gas asset, and settlement finality is anchored to
 * Bitcoin via BitVM. Practically, that means standard Ethereum tooling
 * (viem, Solidity, ABIs) works unchanged, but "finalized" has a stronger
 * and slower meaning than on a typical L2. Anything user-visible should
 * treat sequencer confirmation as the interactive signal and Bitcoin
 * finality as the settlement guarantee. See docs: /docs/network/sequencing.
 */

export const goatMainnet = defineChain({
  id: 2345,
  name: 'GOAT Network',
  nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.goat.network'] },
  },
  blockExplorers: {
    default: { name: 'GOAT Explorer', url: 'https://explorer.goat.network' },
  },
});

export const goatTestnet3 = defineChain({
  id: 48816,
  name: 'GOAT Network Testnet3',
  nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet3.goat.network'] },
  },
  blockExplorers: {
    default: {
      name: 'GOAT Testnet Explorer',
      url: 'https://explorer.testnet3.goat.network',
    },
  },
  testnet: true,
});

export type GoatNetworkName = 'mainnet' | 'testnet3';

export interface Erc8004Addresses {
  identityRegistry: `0x${string}`;
  reputationRegistry: `0x${string}`;
}

/**
 * ERC-8004 registry deployments. Mainnet uses the canonical deterministic
 * deployment (note the `0x8004…` vanity prefix, shared across chains).
 * Testnet3 addresses come from AgentKit's network-aware resolution and are
 * deliberately different — never assume the mainnet address works on
 * testnet.
 */
export const ERC8004_ADDRESSES: Record<GoatNetworkName, Erc8004Addresses> = {
  mainnet: {
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    reputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  },
  testnet3: {
    identityRegistry: '0x556089008Fc0a60cD09390Eca93477ca254A5522',
    reputationRegistry: '0xd9140951d8aE6E5F625a02F5908535e16e3af964',
  },
};

export const CHAINS = {
  mainnet: goatMainnet,
  testnet3: goatTestnet3,
} as const;

/**
 * Builds the CAIP-10-style registry identifier ERC-8004 registration
 * documents use to declare which registry an agent lives in:
 *   eip155:{chainId}:{identityRegistryAddress}
 */
export function agentRegistryId(network: GoatNetworkName): string {
  return `eip155:${CHAINS[network].id}:${ERC8004_ADDRESSES[network].identityRegistry}`;
}
