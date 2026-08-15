"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { CONSOLE_AGENTS as SEED } from "./agents";
import type { ConsoleAgent } from "./types";

export interface AgentsPayload {
  agents: ConsoleAgent[];
  source: "chain" | "unavailable";
  readAt: string;
  blockNumber: string | null;
  note: string;
}

export type LoadState = "loading" | "chain" | "unavailable" | "offline";

/**
 * Loads agents from the API, which reads them live from the ERC-8004
 * registries on GOAT.
 *
 * Falls back to the seed definitions if the API can't be reached, but
 * reports that distinctly via `state` so the UI can tell the viewer these
 * are local values rather than quietly presenting fixtures as live chain
 * data. Showing stale numbers with a confident label is the failure mode
 * worth avoiding here.
 */
export function useAgents() {
  const [agents, setAgents] = useState<ConsoleAgent[]>(SEED);
  const [state, setState] = useState<LoadState>("loading");
  const [blockNumber, setBlockNumber] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await api<AgentsPayload>("/v1/agents");
        if (cancelled) return;
        setAgents(data.agents);
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

  return { agents, state, blockNumber };
}
