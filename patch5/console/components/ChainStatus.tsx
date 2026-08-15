"use client";

import { motion } from "framer-motion";
import type { LoadState } from "@/lib/use-agents";

/**
 * States the provenance of what the rack is showing.
 *
 * This exists because the failure mode worth avoiding is a console that
 * looks identical whether it is reading a live registry or falling back to
 * local fixtures. If the numbers came from a file, the viewer should be able
 * to tell at a glance.
 */
export default function ChainStatus({
  state,
  blockNumber,
}: {
  state: LoadState;
  blockNumber: string | null;
}) {
  const config = {
    loading: {
      color: "var(--color-line-bright)",
      label: "READING REGISTRY…",
      detail: "Querying GOAT testnet3",
    },
    chain: {
      color: "var(--color-signal-bright)",
      label: "LIVE FROM GOAT TESTNET3",
      detail: blockNumber ? `Block ${blockNumber}` : "ERC-8004 registries",
    },
    unavailable: {
      color: "var(--color-brass-bright)",
      label: "RPC UNREACHABLE",
      detail: "On-chain values hidden rather than guessed",
    },
    offline: {
      color: "var(--color-danger)",
      label: "SHOWING LOCAL DEFINITIONS",
      detail: "API unreachable — these are not live chain values",
    },
  }[state];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-widest"
      role="status"
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: config.color,
          boxShadow: `0 0 8px 2px ${config.color}55`,
        }}
      />
      <span style={{ color: config.color }}>{config.label}</span>
      <span className="text-paper-dim/45">{config.detail}</span>
    </motion.div>
  );
}
