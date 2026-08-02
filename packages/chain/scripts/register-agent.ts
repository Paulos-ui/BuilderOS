/**
 * Registers BuilderOS agents in the ERC-8004 Identity Registry on GOAT.
 *
 * Usage:
 *   npx tsx scripts/register-agent.ts --network testnet3 --agent scout --dry-run
 *   npx tsx scripts/register-agent.ts --network testnet3 --agent scout
 *   npx tsx scripts/register-agent.ts --network mainnet --all
 *
 * Env:
 *   AGENT_OWNER_PRIVATE_KEY   signer that will own the agent NFT
 *   BUILDEROS_API_BASE        defaults to https://api.builderos.dev
 *   BUILDEROS_SITE_BASE       defaults to https://builderos.dev
 *
 * ── The two-phase problem ──────────────────────────────────────────────────
 * The registration document is supposed to contain the agentId, but the
 * agentId only exists after registration. There is no way around this; the
 * spec accepts it. We therefore:
 *   phase 1 — publish a document with an empty `registrations` array, register
 *             with that URI, and capture the minted agentId
 *   phase 2 — republish the document including the agentId, then setAgentURI
 *
 * This script drives phase 1 and prints exactly what phase 2 needs. It does
 * not silently upload anything: pinning is left to you, because a script
 * that quietly pins to whatever gateway happens to be configured is how
 * agent metadata ends up on infrastructure nobody owns.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Hex } from 'viem';
import { IdentityRegistryClient } from '../src/erc8004/identity.client';
import { buildRegistrationDocument } from '../src/erc8004/registration-json';
import {
  AGENT_MANIFESTS,
  getManifest,
  getRegisterableManifests,
  type BuilderOsAgentManifest,
} from '../src/agents/manifests';
import { agentRegistryId, type GoatNetworkName } from '../src/config/networks';

interface Args {
  network: GoatNetworkName;
  agent?: string;
  all: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };

  const network = (get('--network') ?? 'testnet3') as GoatNetworkName;
  if (network !== 'mainnet' && network !== 'testnet3') {
    throw new Error(`--network must be "mainnet" or "testnet3", got "${network}"`);
  }

  return {
    network,
    agent: get('--agent'),
    all: argv.includes('--all'),
    dryRun: argv.includes('--dry-run'),
  };
}

const OUT_DIR = join(process.cwd(), 'out', 'registrations');

function writeDocument(
  manifest: BuilderOsAgentManifest,
  network: GoatNetworkName,
  agentId?: number,
): string {
  const doc = buildRegistrationDocument(manifest, { network, agentId });
  mkdirSync(OUT_DIR, { recursive: true });
  const suffix = agentId === undefined ? 'phase1' : 'phase2';
  const path = join(OUT_DIR, `${manifest.key}.${network}.${suffix}.json`);
  writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
  return path;
}

async function registerOne(
  manifest: BuilderOsAgentManifest,
  args: Args,
): Promise<void> {
  console.log(`\n── ${manifest.name} (${manifest.key}) ──`);

  const phase1Path = writeDocument(manifest, args.network);
  console.log(`  phase 1 document: ${phase1Path}`);

  if (args.dryRun) {
    console.log('  --dry-run: document validated, nothing sent on-chain.');
    return;
  }

  const agentURI = process.env[`AGENT_URI_${manifest.key.toUpperCase()}`];
  if (!agentURI) {
    console.log(
      `  ⚠ skipped: pin the document above, then set AGENT_URI_${manifest.key.toUpperCase()}\n` +
        `    (e.g. ipfs://Qm… or https://builderos.dev/agents/${manifest.key}.json) and re-run.`,
    );
    return;
  }

  const privateKey = process.env.AGENT_OWNER_PRIVATE_KEY as Hex | undefined;
  if (!privateKey) {
    throw new Error('AGENT_OWNER_PRIVATE_KEY is required for on-chain registration.');
  }

  const client = new IdentityRegistryClient({ network: args.network, privateKey });
  const result = await client.register(agentURI);

  console.log(`  ✓ registered — agentId ${result.agentId}`);
  console.log(`    tx: ${result.explorerUrl}`);

  const phase2Path = writeDocument(manifest, args.network, Number(result.agentId));
  console.log(`  phase 2 document: ${phase2Path}`);
  console.log(
    `    registry: ${agentRegistryId(args.network)}\n` +
      `    Next: pin the phase 2 document, then call setAgentURI(${result.agentId}, <newURI>).`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log(`BuilderOS agent registration → GOAT ${args.network}`);
  console.log(`Registry: ${agentRegistryId(args.network)}`);

  let targets: BuilderOsAgentManifest[];
  if (args.all) {
    targets = getRegisterableManifests();
    const skipped = AGENT_MANIFESTS.filter((m) => !m.registerNow).map((m) => m.key);
    if (skipped.length > 0) {
      console.log(
        `Skipping agents not yet live: ${skipped.join(', ')} ` +
          `(flip registerNow in src/agents/manifests.ts once their endpoints answer).`,
      );
    }
  } else if (args.agent) {
    targets = [getManifest(args.agent)];
  } else {
    throw new Error('Specify --agent <key> or --all');
  }

  for (const manifest of targets) {
    await registerOne(manifest, args);
  }

  console.log('\nDone.');
}

main().catch((err: unknown) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
