export type AgentStatus = "live" | "beta" | "planned";

export type SettlementPhase = "pending" | "sequenced" | "final";

export interface OnChainIdentity {
  /** ERC-8004 agentId, null when not yet registered. */
  agentId: number | null;
  /**
   * Where this registration sits in GOAT's two-speed finality: sequencer
   * confirmation is fast and provisional, Bitcoin finality is slow and
   * irreversible. Drives the Settlement motion primitive.
   */
  settlement: SettlementPhase;
  network: "mainnet" | "testnet3";
  registryId: string;
  txHash: string | null;
}

export interface AgentReputation {
  /** Number of feedback entries in the ERC-8004 Reputation Registry. */
  count: number;
  /** Average value, already normalised out of valueDecimals. */
  average: number;
  clients: number;
}

export interface ConsoleAgent {
  key: string;
  code: string;
  name: string;
  role: string;
  description: string;
  status: AgentStatus;
  x402Support: boolean;
  skills: string[];
  identity: OnChainIdentity;
  reputation: AgentReputation | null;
  /** Agent key this one hands off to, for the patch-cable pulse. */
  handoffTo?: string;
}
