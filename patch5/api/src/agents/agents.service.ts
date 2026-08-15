import { Injectable, Logger } from '@nestjs/common';
import {
  AGENT_DEFINITIONS,
  FINALITY_CONFIRMATIONS,
  type AgentDefinition,
} from './agents.config';
import {
  goatClient,
  IDENTITY_ABI,
  IDENTITY_REGISTRY,
  REPUTATION_ABI,
  REPUTATION_REGISTRY,
  REGISTRY_ID,
  ZERO_BYTES32,
  goatTestnet3,
} from './goat-registry';

export type SettlementPhase = 'pending' | 'sequenced' | 'final';

export interface OnChainIdentity {
  agentId: number | null;
  network: 'testnet3';
  registryId: string;
  txHash: string | null;
  owner: string | null;
  tokenURI: string | null;
  explorerUrl: string | null;
  confirmations: number | null;
  /**
   * Derived from confirmation depth, NOT from a BitVM settlement proof.
   * A console hint, not a finality guarantee.
   */
  settlementProxy: SettlementPhase;
}

export interface AgentReputation {
  count: number;
  average: number;
  clients: number;
}

export interface ConsoleAgent extends Omit<AgentDefinition, 'registrationTx'> {
  status: 'live' | 'beta' | 'planned';
  identity: OnChainIdentity;
  reputation: AgentReputation | null;
}

export interface AgentsResponse {
  agents: ConsoleAgent[];
  /** 'chain' when the values below were read live; 'unavailable' on RPC failure. */
  source: 'chain' | 'unavailable';
  readAt: string;
  blockNumber: string | null;
  note: string;
}

const CACHE_TTL_MS = 60_000;

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private cache: { at: number; data: AgentsResponse } | null = null;

  async getAgents(): Promise<AgentsResponse> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.data;
    }

    let head: bigint | null = null;
    try {
      head = await goatClient.getBlockNumber();
    } catch (err) {
      // The public RPC being down is not our data being wrong. Say so
      // plainly rather than serving stale numbers as if they were live.
      this.logger.warn(
        `GOAT RPC unreachable: ${err instanceof Error ? err.message : String(err)}`,
      );
      const fallback: AgentsResponse = {
        agents: AGENT_DEFINITIONS.map((d) => this.shell(d)),
        source: 'unavailable',
        readAt: new Date().toISOString(),
        blockNumber: null,
        note: "Couldn't reach the GOAT RPC. On-chain values are hidden rather than guessed.",
      };
      return fallback;
    }

    const agents = await Promise.all(
      AGENT_DEFINITIONS.map((d) => this.hydrate(d, head!)),
    );

    const data: AgentsResponse = {
      agents,
      source: 'chain',
      readAt: new Date().toISOString(),
      blockNumber: head.toString(),
      note: 'Identity and reputation read live from the ERC-8004 registries on GOAT testnet3.',
    };

    this.cache = { at: Date.now(), data };
    return data;
  }

  /** Shape for an agent we cannot currently read from chain. */
  private shell(d: AgentDefinition): ConsoleAgent {
    const { registrationTx: _tx, ...rest } = d;
    return {
      ...rest,
      status: d.agentId ? 'live' : 'beta',
      identity: {
        agentId: d.agentId,
        network: 'testnet3',
        registryId: REGISTRY_ID,
        txHash: d.registrationTx,
        owner: null,
        tokenURI: null,
        explorerUrl: d.registrationTx
          ? `${goatTestnet3.blockExplorers.default.url}/tx/${d.registrationTx}`
          : null,
        confirmations: null,
        settlementProxy: d.agentId ? 'sequenced' : 'pending',
      },
      reputation: null,
    };
  }

  private async hydrate(
    d: AgentDefinition,
    head: bigint,
  ): Promise<ConsoleAgent> {
    const base = this.shell(d);
    if (d.agentId === null) return base;

    const id = BigInt(d.agentId);

    const [owner, tokenURI, summary, clients, confirmations] =
      await Promise.all([
        this.safe(() =>
          goatClient.readContract({
            address: IDENTITY_REGISTRY,
            abi: IDENTITY_ABI,
            functionName: 'ownerOf',
            args: [id],
          }),
        ),
        this.safe(() =>
          goatClient.readContract({
            address: IDENTITY_REGISTRY,
            abi: IDENTITY_ABI,
            functionName: 'tokenURI',
            args: [id],
          }),
        ),
        this.safe(() =>
          goatClient.readContract({
            address: REPUTATION_REGISTRY,
            abi: REPUTATION_ABI,
            functionName: 'getSummary',
            args: [id, [], ZERO_BYTES32, ZERO_BYTES32],
          }),
        ),
        this.safe(() =>
          goatClient.readContract({
            address: REPUTATION_REGISTRY,
            abi: REPUTATION_ABI,
            functionName: 'getClients',
            args: [id],
          }),
        ),
        this.confirmationsFor(d.registrationTx, head),
      ]);

    const count = summary ? Number(summary[0]) : 0;

    return {
      ...base,
      status: 'live',
      identity: {
        ...base.identity,
        owner: owner ?? null,
        tokenURI: tokenURI ?? null,
        confirmations: confirmations ?? null,
        settlementProxy:
          confirmations !== null && BigInt(confirmations) >= FINALITY_CONFIRMATIONS
            ? 'final'
            : 'sequenced',
      },
      // No feedback yet is genuinely different from a score of zero, so we
      // return null rather than a zeroed object and let the UI say so.
      reputation:
        count > 0 && summary
          ? {
              count,
              average: Number(summary[1]) / 100,
              clients: clients ? clients.length : 0,
            }
          : null,
    };
  }

  private async confirmationsFor(
    txHash: string | null,
    head: bigint,
  ): Promise<number | null> {
    if (!txHash) return null;
    const receipt = await this.safe(() =>
      goatClient.getTransactionReceipt({ hash: txHash as `0x${string}` }),
    );
    if (!receipt) return null;
    const depth = head - receipt.blockNumber;
    return depth < 0n ? 0 : Number(depth);
  }

  /** A single failed read shouldn't blank the whole response. */
  private async safe<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch {
      return null;
    }
  }
}
