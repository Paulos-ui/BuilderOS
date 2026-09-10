"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { CONSOLE_AGENTS as SEED } from "./agents";
import type { ConsoleAgent } from "./types";

export interface AgentCounts {
  total: number;
  /** Agents the API implements — the honest operational count. */
  implemented: number;
  /** Agents holding an ERC-8004 identity on this network. */
  registered: number;
  /** Agents that can be paid for over x402. */
  metered: number;
}

export interface AgentsPayload {
  agents: ConsoleAgent[];
  source: "chain" | "unavailable";
  readAt: string;
  blockNumber: string | null;
  note: string;
  counts: AgentCounts;
}

export type LoadState = "loading" | "chain" | "unavailable" | "offline";

/**
 * Counts derived locally, used only when the API never answered.
 *
 * `registered` deliberately counts agent ids rather than the `live` status, so
 * an offline console can never report more registrations than it can name.
 */
function deriveCounts(agents: ConsoleAgent[]): AgentCounts {
  return {
    total: agents.length,
    implemented: agents.filter((a) => a.status !== "planned").length,
    registered: agents.filter((a) => a.identity.agentId !== null).length,
    metered: agents.filter((a) => a.x402Support).length,
  };
}

/**
 * Loads agents from the API, which reads them live from the ERC-8004
 * registries on GOAT.
 *
 * Falls back to the seed definitions if the API can't be reached, but reports
 * that distinctly via `state` so the UI can tell the viewer these are local
 * values rather than quietly presenting fixtures as live chain data. Showing
 * stale numbers with a confident label is the failure mode worth avoiding here.
 *
 * `counts` comes from the API rather than being filtered out of the array by
 * each component that wants it. The rack used to compute "4 of 6 operational"
 * from a hardcoded frontend list, which is how it kept saying 4 after the
 * fifth and sixth agents shipped.
 */
export function useAgents() {
  const [agents, setAgents] = useState<ConsoleAgent[]>(SEED);
  const [counts, setCounts] = useState<AgentCounts>(() => deriveCounts(SEED));
  const [state, setState] = useState<LoadState>("loading");
  const [blockNumber, setBlockNumber] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await api<AgentsPayload>("/v1/agents");
        if (cancelled) return;
        setAgents(data.agents);
        // An older API build predates `counts`. Deriving from the response is
        // still better than falling back to the seed, which would describe a
        // different list than the one on screen.
        setCounts(data.counts ?? deriveCounts(data.agents));
        setBlockNumber(data.blockNumber);
        setState(data.source === "chain" ? "chain" : "unavailable");
      } catch {
        if (!cancelled) setState("offline");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { agents, counts, state, blockNumber };
}
