/**
 * Verifies, against the chain itself, whether BuilderOS agents are actually
 * registered. Local JSON files prove nothing — only the registry does.
 *
 * Usage:
 *   npx tsx scripts/verify-registration.ts 0xYourOwnerAddress
 *   npx tsx scripts/verify-registration.ts 0xYourOwnerAddress --agent-id 1042
 */
import { createPublicClient, http, type Address } from 'viem';
import { CHAINS, ERC8004_ADDRESSES } from '../src/config/networks';

const OWNABLE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
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

async function main() {
  const address = process.argv[2] as Address | undefined;
  if (!address?.startsWith('0x')) {
    console.error(
      'Usage: npx tsx scripts/verify-registration.ts 0xYourOwnerAddress [--agent-id N]',
    );
    process.exit(1);
  }

  const idIdx = process.argv.indexOf('--agent-id');
  const agentId = idIdx !== -1 ? BigInt(process.argv[idIdx + 1]) : undefined;

  const chain = CHAINS.testnet3;
  const registry = ERC8004_ADDRESSES.testnet3.identityRegistry;
  const client = createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });

  console.log(`\nGOAT testnet3 — Identity Registry ${registry}`);
  console.log(`Checking owner ${address}\n`);

  // 1. Does the address hold any agent tokens at all?
  let balance: bigint;
  try {
    balance = await client.readContract({
      address: registry,
      abi: OWNABLE_ABI,
      functionName: 'balanceOf',
      args: [address],
    });
  } catch (err) {
    console.error(
      '✗ Could not read balanceOf. Either the RPC is unreachable or the ' +
        'registry does not expose an ERC-721 interface at this address.',
    );
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  if (balance === 0n) {
    console.log('✗ NOT REGISTERED — this address owns 0 agents.');
    console.log('\n  Nothing was written to the registry. Most likely the');
    console.log('  register script hit its "AGENT_URI_… not set" branch and');
    console.log('  exited before sending a transaction.\n');
    console.log('  Check:  grep AGENT_URI .env\n');
    process.exit(1);
  }

  console.log(`✓ REGISTERED — this address owns ${balance} agent(s).\n`);

  // 2. If a specific id was supplied, confirm ownership and its URI.
  if (agentId !== undefined) {
    const [owner, uri] = await Promise.all([
      client.readContract({
        address: registry,
        abi: OWNABLE_ABI,
        functionName: 'ownerOf',
        args: [agentId],
      }),
      client.readContract({
        address: registry,
        abi: OWNABLE_ABI,
        functionName: 'tokenURI',
        args: [agentId],
      }),
    ]);

    const owned = owner.toLowerCase() === address.toLowerCase();
    console.log(`agentId ${agentId}`);
    console.log(`  owner: ${owner} ${owned ? '✓ yours' : '✗ NOT yours'}`);
    console.log(`  URI:   ${uri || '(empty)'}`);

    if (!uri) {
      console.log(
        '\n  ⚠ The agentURI is empty, so nothing can resolve this agent.',
      );
    } else if (uri.includes('phase1') || uri === '') {
      console.log(
        '\n  ⚠ This URI still points at a phase-1 document (no agentId inside).',
      );
      console.log('    Pin the phase-2 document and call setAgentURI.');
    }
  } else {
    console.log('Pass --agent-id N to inspect a specific agent.\n');
  }
}

main().catch((err: unknown) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
