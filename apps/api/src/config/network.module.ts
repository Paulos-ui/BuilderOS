import { Module } from '@nestjs/common';
import { NetworkConfig } from './network.config';

/**
 * NetworkConfig was a local provider inside RepModule. That was fine while
 * BuilderRep was the only thing reading the chain, but BuilderPay needs the
 * same chain id and explorer URL, and the agents feed needs the same agentIds.
 *
 * Three local providers would mean three instances, each logging "GOAT network:
 * ..." on boot and each independently deciding whether it is on mainnet. The
 * duplicate log lines are cosmetic; the split decision is not — one module
 * resolving to mainnet while another resolves to testnet3 would produce a
 * ledger whose explorer links point at a different chain than the payments
 * were verified against, and nothing in the output would reveal it.
 */
@Module({
  providers: [NetworkConfig],
  exports: [NetworkConfig],
})
export class NetworkModule {}
