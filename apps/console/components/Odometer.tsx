"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * A mechanical digit reel. Each digit column translates vertically to land
 * on its target value, staggered left-to-right so the number settles the way
 * a physical counter does — high digits first, ones digit last.
 *
 * Used deliberately for values read off-chain (agentId, feedback counts).
 * A fade would say "here is some text"; a roll says "this was counted".
 */
export function Odometer({
  value,
  delay = 0,
  className = "",
}: {
  value: number;
  delay?: number;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setArmed(true), delay * 1000);
    return () => clearTimeout(t);
  }, [delay]);

  const digits = String(value).split("");

  return (
    <span className={`inline-flex overflow-hidden ${className}`} aria-label={String(value)}>
      {digits.map((d, i) => (
        <DigitReel
          key={`${i}-${digits.length}`}
          digit={Number(d)}
          armed={armed}
          index={i}
          total={digits.length}
        />
      ))}
    </span>
  );
}

function DigitReel({
  digit,
  armed,
  index,
  total,
}: {
  digit: number;
  armed: boolean;
  index: number;
  total: number;
}) {
  // Leftmost digit settles first — matches how a mechanical counter carries.
  const stagger = (total - index - 1) * 0.07;

  return (
    <span
      className="relative inline-block h-[1em] w-[0.62em] overflow-hidden tabular-nums"
      aria-hidden="true"
    >
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col items-center"
        initial={{ y: "0em" }}
        animate={{ y: armed ? `${-digit}em` : "0em" }}
        transition={{
          duration: 0.9 + stagger,
          delay: stagger,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {Array.from({ length: 10 }).map((_, n) => (
          <span key={n} className="block h-[1em] leading-[1em]">
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}
