"use client";

import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * ── The Settlement primitive ───────────────────────────────────────────────
 *
 * GOAT Network has two-speed finality: the sequencer confirms fast and
 * provisionally, then Bitcoin finalises slowly and irreversibly. That is not
 * a footnote about the chain — it is the single most distinctive thing about
 * building here, so it is the thing our motion language encodes.
 *
 * Every value that becomes permanent moves through two phases with
 * genuinely different physics:
 *
 *   sequenced → fast, light spring, and a continuous sub-pixel jitter.
 *               Cyan. The value is real but could still change.
 *
 *   final     → heavy damped spring, long settle, and THE JITTER STOPS.
 *               Locks to brass, with a seal ring expanding once.
 *
 * The stillness is the point. Finality is not signalled by adding a badge;
 * it is signalled by the removal of motion. That reads correctly even to
 * someone who has never heard of BitVM — things that are settled stop
 * moving.
 *
 * Colour carries the same meaning throughout the product:
 *   line/cyan  = provisional, sequencer-confirmed
 *   brass/gold = Bitcoin-final, irreversible
 */

export type SettlementPhase = "pending" | "sequenced" | "final";

const PHASE_COLOR: Record<SettlementPhase, string> = {
  pending: "var(--color-paper-dim)",
  sequenced: "var(--color-line-bright)",
  final: "var(--color-brass-bright)",
};

const PHASE_LABEL: Record<SettlementPhase, string> = {
  pending: "PENDING",
  sequenced: "SEQUENCED",
  final: "BITCOIN FINAL",
};

export function SettlementValue({
  phase,
  children,
  className = "",
}: {
  phase: SettlementPhase;
  children: React.ReactNode;
  className?: string;
}) {
  const controls = useAnimationControls();
  const jitterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Provisional values are visibly unsettled: a slow, tiny, irregular
    // drift. Amplitude is deliberately sub-pixel-ish (0.6px) so it reads as
    // instability rather than as an animation someone chose to add.
    if (phase === "sequenced") {
      jitterRef.current = setInterval(() => {
        controls.start({
          x: (Math.random() - 0.5) * 1.2,
          y: (Math.random() - 0.5) * 1.2,
          transition: { duration: 0.42, ease: "easeInOut" },
        });
      }, 430);
    } else {
      // Finality (or reverting to pending) stops the drift and returns to
      // true zero with weight.
      if (jitterRef.current) clearInterval(jitterRef.current);
      controls.start({
        x: 0,
        y: 0,
        transition:
          phase === "final"
            ? { type: "spring", stiffness: 90, damping: 26, mass: 1.7 }
            : { duration: 0.3 },
      });
    }

    return () => {
      if (jitterRef.current) clearInterval(jitterRef.current);
    };
  }, [phase, controls]);

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <motion.span
        animate={controls}
        style={{ color: PHASE_COLOR[phase] }}
        className="relative inline-flex items-center font-mono tabular-nums transition-colors duration-700"
      >
        {children}
      </motion.span>

      {/* Seal ring — expands exactly once, at the moment of Bitcoin finality. */}
      {phase === "final" && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-2 rounded-sm border"
          style={{ borderColor: "var(--color-brass-bright)" }}
          initial={{ opacity: 0.85, scale: 0.9 }}
          animate={{ opacity: 0, scale: 1.35 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
    </span>
  );
}

/**
 * The phase indicator that accompanies a settling value. Two segments —
 * sequencer, then Bitcoin — filling in order. The second segment takes
 * visibly longer to fill, because it does in reality.
 */
export function SettlementTrack({
  phase,
  showLabel = true,
}: {
  phase: SettlementPhase;
  showLabel?: boolean;
}) {
  const sequenced = phase === "sequenced" || phase === "final";
  const final = phase === "final";

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1" aria-hidden="true">
        <Segment
          filled={sequenced}
          color="var(--color-line-bright)"
          duration={0.45}
        />
        {/* Bitcoin settlement is slow. The fill duration says so. */}
        <Segment
          filled={final}
          color="var(--color-brass-bright)"
          duration={1.6}
        />
      </div>
      {showLabel && (
        <span
          className="font-mono text-[10px] tracking-widest transition-colors duration-700"
          style={{ color: PHASE_COLOR[phase] }}
        >
          {PHASE_LABEL[phase]}
        </span>
      )}
    </div>
  );
}

function Segment({
  filled,
  color,
  duration,
}: {
  filled: boolean;
  color: string;
  duration: number;
}) {
  return (
    <span className="block h-[3px] w-6 overflow-hidden rounded-full bg-ink-3">
      <motion.span
        className="block h-full rounded-full"
        style={{ background: color }}
        initial={{ width: "0%" }}
        animate={{ width: filled ? "100%" : "0%" }}
        transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
      />
    </span>
  );
}

/** Human-readable explanation, used in the console's legend. */
export const SETTLEMENT_LEGEND = [
  {
    phase: "sequenced" as const,
    title: "Sequencer confirmed",
    body: "Fast and usable, but still provisional — the value drifts because it could still change.",
  },
  {
    phase: "final" as const,
    title: "Bitcoin final",
    body: "Anchored through BitVM and irreversible. The drift stops; that stillness is the guarantee.",
  },
];
