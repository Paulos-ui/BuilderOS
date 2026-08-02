import {
  createPublicClient,
  createWalletClient,
  http,
  decodeEventLog,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CHAINS, ERC8004_ADDRESSES, type GoatNetworkName } from '../config/networks';
import { IDENTITY_REGISTRY_ABI } from './abis';

export interface IdentityClientOptions {
  network: GoatNetworkName;
  /** Required only for write operations. */
  privateKey?: Hex;
  /** Override the default public RPC (e.g. a private/rate-limited endpoint). */
  rpcUrl?: string;
}

export interface RegisterResult {
  agentId: bigint;
  txHash: Hex;
  explorerUrl: string;
}

export class IdentityRegistryClient {
  private readonly publicClient: PublicClient;
  private readonly walletClient?: WalletClient;
  private readonly address: Address;
  private readonly network: GoatNetworkName;

  constructor(options: IdentityClientOptions) {
    const chain = CHAINS[options.network];
    const transport = http(options.rpcUrl ?? chain.rpcUrls.default.http[0]);

    this.network = options.network;
    this.address = ERC8004_ADDRESSES[options.network].identityRegistry;
    this.publicClient = createPublicClient({ chain, transport }) as PublicClient;

    if (options.privateKey) {
      this.walletClient = createWalletClient({
        account: privateKeyToAccount(options.privateKey),
        chain,
        transport,
      });
    }
  }

  private requireWallet(): WalletClient {
    if (!this.walletClient) {
      throw new Error(
        'This operation requires a signer. Construct IdentityRegistryClient with a privateKey.',
      );
    }
    return this.walletClient;
  }

  private explorerTx(hash: Hex): string {
    return `${CHAINS[this.network].blockExplorers.default.url}/tx/${hash}`;
  }

  /**
   * Registers an agent and returns the assigned agentId.
   *
   * The id is recovered from the transaction receipt rather than by
   * simulating the call, because a simulated return value can drift from
   * what actually landed if another registration is mined in between.
   * We decode the receipt's logs against the registry ABI and fall back to
   * reading the return value only if no matching event is found.
   */
  async register(agentURI: string): Promise<RegisterResult> {
    const wallet = this.requireWallet();
    const account = wallet.account;
    if (!account) throw new Error('Wallet client has no account attached');

    const { request, result } = await this.publicClient.simulateContract({
      address: this.address,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'register',
      args: [agentURI],
      account,
    });

    const txHash = await wallet.writeContract(request);
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status !== 'success') {
      throw new Error(
        `Registration transaction reverted. See ${this.explorerTx(txHash)}`,
      );
    }

    const agentId = this.extractAgentIdFromLogs(receipt.logs) ?? (result as bigint);

    return {
      agentId,
      txHash,
      explorerUrl: this.explorerTx(txHash),
    };
  }

  /**
   * Best-effort recovery of the minted agentId from receipt logs. The
   * canonical implementation emits an ERC-721-style Transfer on mint
   * (agents are NFTs in the reference contracts), so the tokenId in a
   * mint-from-zero Transfer is the agentId.
   */
  private extractAgentIdFromLogs(
    logs: readonly { address: Address; topics: readonly Hex[]; data: Hex }[],
  ): bigint | undefined {
    const TRANSFER_ABI = [
      {
        type: 'event',
        name: 'Transfer',
        inputs: [
          { name: 'from', type: 'address', indexed: true },
          { name: 'to', type: 'address', indexed: true },
          { name: 'tokenId', type: 'uint256', indexed: true },
        ],
      },
    ] as const;

    for (const log of logs) {
      if (log.address.toLowerCase() !== this.address.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: TRANSFER_ABI,
          topics: log.topics as [Hex, ...Hex[]],
          data: log.data,
        });
        if (
          decoded.eventName === 'Transfer' &&
          decoded.args.from === '0x0000000000000000000000000000000000000000'
        ) {
          return decoded.args.tokenId;
        }
      } catch {
        // Not a Transfer event — keep scanning.
      }
    }
    return undefined;
  }

  /** Point an existing agent at an updated registration document. */
  async setAgentURI(agentId: bigint, newURI: string): Promise<Hex> {
    const wallet = this.requireWallet();
    const account = wallet.account;
    if (!account) throw new Error('Wallet client has no account attached');

    const { request } = await this.publicClient.simulateContract({
      address: this.address,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'setAgentURI',
      args: [agentId, newURI],
      account,
    });
    return wallet.writeContract(request);
  }

  async getAgentWallet(agentId: bigint): Promise<Address> {
    return this.publicClient.readContract({
      address: this.address,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'getAgentWallet',
      args: [agentId],
    });
  }

  async isAuthorizedOrOwner(spender: Address, agentId: bigint): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.address,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'isAuthorizedOrOwner',
      args: [spender, agentId],
    });
  }
}
