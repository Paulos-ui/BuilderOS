import { createPublicClient, defineChain, http, type Address } from 'viem';

/**
 * Minimal GOAT testnet3 registry access for the console's live readout.
 *
 * This deliberately duplicates a small slice of packages/chain rather than
 * importing it: the repo has no workspace linking configured, and wiring
 * that up is a bigger change than this feature warrants. When we do set up
 * workspaces, delete this file and import from @builderos/chain instead —
 * the addresses and ABI fragments below are the only overlap.
 */

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

export const IDENTITY_REGISTRY =
  '0x556089008Fc0a60cD09390Eca93477ca254A5522' as Address;
export const REPUTATION_REGISTRY =
  '0xd9140951d8aE6E5F625a02F5908535e16e3af964' as Address;

export const IDENTITY_ABI = [
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

export const REPUTATION_ABI = [
  {
    type: 'function',
    name: 'getSummary',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'bytes32' },
      { name: 'tag2', type: 'bytes32' },
    ],
    outputs: [
      { name: 'count', type: 'uint256' },
      { name: 'averageValue', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getClients',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
] as const;

export const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

export const goatClient = createPublicClient({
  chain: goatTestnet3,
  transport: http(
    process.env.GOAT_RPC_URL ?? goatTestnet3.rpcUrls.default.http[0],
  ),
});

export const REGISTRY_ID = `eip155:48816:${IDENTITY_REGISTRY}`;
