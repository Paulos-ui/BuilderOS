import {
  createPublicClient,
  createWalletClient,
  http,
  stringToHex,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CHAINS, ERC8004_ADDRESSES, type GoatNetworkName } from '../config/networks';
import { REPUTATION_REGISTRY_ABI } from './abis';

export interface ReputationClientOptions {
  network: GoatNetworkName;
  privateKey?: Hex;
  rpcUrl?: string;
}

export interface FeedbackInput {
  agentId: bigint;
  /**
   * Score as an integer, paired with `valueDecimals`. A 4.5/5 rating is
   * value=45, valueDecimals=1 — not 4.5, which has no on-chain
   * representation.
   */
  value: bigint;
  valueDecimals: number;
  /** Short categorical labels, e.g. "discovery" / "accuracy". */
  tag1?: string;
  tag2?: string;
  /** Which endpoint the feedback concerns. */
  endpoint: string;
  /** URI to richer off-chain evidence. */
  feedbackURI?: string;
  /** keccak256 of the evidence at feedbackURI, for integrity verification. */
  feedbackHash?: Hex;
}

export interface ReputationSummary {
  count: bigint;
  averageValue: bigint;
}

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

/** bytes32 tags are fixed-width; anything longer than 31 bytes would silently truncate. */
function toTag(value?: string): Hex {
  if (!value) return ZERO_BYTES32;
  const hex = stringToHex(value, { size: 32 });
  if (Buffer.byteLength(value, 'utf8') > 32) {
    throw new Error(`Tag "${value}" exceeds 32 bytes and would be truncated.`);
  }
  return hex;
}

export class ReputationRegistryClient {
  private readonly publicClient: PublicClient;
  private readonly walletClient?: WalletClient;
  private readonly address: Address;

  constructor(options: ReputationClientOptions) {
    const chain = CHAINS[options.network];
    const transport = http(options.rpcUrl ?? chain.rpcUrls.default.http[0]);

    this.address = ERC8004_ADDRESSES[options.network].reputationRegistry;
    this.publicClient = createPublicClient({ chain, transport }) as PublicClient;

    if (options.privateKey) {
      this.walletClient = createWalletClient({
        account: privateKeyToAccount(options.privateKey),
        chain,
        transport,
      });
    }
  }

  /**
   * Publishes a trust signal about an agent.
   *
   * Keep the on-chain record compact: the numeric value and tags live
   * on-chain, while any narrative evidence belongs behind `feedbackURI`
   * with `feedbackHash` set so a reader can verify it was not altered
   * after the fact.
   */
  async giveFeedback(input: FeedbackInput): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error('giveFeedback requires a signer (privateKey).');
    }
    const account = this.walletClient.account;
    if (!account) throw new Error('Wallet client has no account attached');

    if (input.feedbackHash && !input.feedbackURI) {
      throw new Error(
        'feedbackHash was provided without feedbackURI — the hash would reference nothing.',
      );
    }

    const { request } = await this.publicClient.simulateContract({
      address: this.address,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'giveFeedback',
      args: [
        input.agentId,
        input.value,
        input.valueDecimals,
        toTag(input.tag1),
        toTag(input.tag2),
        input.endpoint,
        input.feedbackURI ?? '',
        input.feedbackHash ?? ZERO_BYTES32,
      ],
      account,
    });
    return this.walletClient.writeContract(request);
  }

  async getSummary(
    agentId: bigint,
    opts: { clientAddresses?: Address[]; tag1?: string; tag2?: string } = {},
  ): Promise<ReputationSummary> {
    const [count, averageValue] = await this.publicClient.readContract({
      address: this.address,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getSummary',
      args: [
        agentId,
        opts.clientAddresses ?? [],
        toTag(opts.tag1),
        toTag(opts.tag2),
      ],
    });
    return { count, averageValue };
  }

  async getClients(agentId: bigint): Promise<readonly Address[]> {
    return this.publicClient.readContract({
      address: this.address,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getClients',
      args: [agentId],
    });
  }
}
