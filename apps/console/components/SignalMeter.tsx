"use client";

import { motion } from "framer-motion";

const SEGMENTS = 10;

/**
 * A segmented signal meter, modelled on a VU meter rather than a progress
 * bar. Segments light in sequence with a slight overshoot and settle back,
 * so the reading feels *measured* instead of animated.
 *
 * The empty state matters as much as the filled one: an unregistered agent
 * shows dark segments and "NO SIGNAL", never "0.0". A zero would imply we
 * measured this agent and it scored nothing, which is a different and much
 * worse claim than "we have not measured it yet".
 */
export function SignalMeter({
  /** Average rating out of 5, or null when there is no on-chain data. */
  value,
  count,
  delay = 0,
}: {
  value: number | null;
  count: number;
  delay?: number;
}) {
  const lit = value === null ? 0 : Math.round((value / 5) * SEGMENTS);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-[3px]" role="img" aria-label={
        value === null ? "No reputation data" : `${value} out of 5 from ${count} reviews`
      }>
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const isLit = i < lit;
          // Colour ramps across the meter: line -> signal -> brass at the top
          const color =
            i >= 8 ? "var(--color-brass-bright)"
            : i >= 5 ? "var(--color-signal-bright)"
            : "var(--color-line-bright)";

          return (
            <motion.span
              key={i}
              className="block w-[6px] origin-bottom rounded-[1px]"
              style={{
                height: `${8 + i * 1.4}px`,
                background: isLit ? color : "var(--color-ink-3)",
              }}
              initial={{ opacity: 0.25, scaleY: 0.4 }}
              animate={
                isLit
                  ? { opacity: [0.25, 1, 0.85], scaleY: [0.4, 1.18, 1] }
                  : { opacity: 0.3, scaleY: 1 }
              }
              transition={{
                duration: 0.5,
                delay: delay + i * 0.045,
                ease: [0.16, 1, 0.3, 1],
                times: isLit ? [0, 0.6, 1] : undefined,
              }}
            />
          );
        })}
      </div>
      <p className="font-mono text-[10px] tracking-widest text-paper-dim/60">
        {value === null ? (
          "NO SIGNAL · UNREGISTERED"
        ) : (
          <>
            {value.toFixed(1)} AVG · {count} ATTESTED
          </>
        )}
      </p>
    </div>
  );
}
