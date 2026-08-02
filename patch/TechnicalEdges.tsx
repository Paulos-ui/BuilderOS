"use client";

import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useState } from "react";

/**
 * Instrument labels framing the hero.
 *
 * Entirely decorative: the whole layer is aria-hidden and pointer-events
 * none, so it adds atmosphere without adding anything a screen reader has
 * to wade through before reaching the headline.
 *
 * Density is deliberately uneven — the two top corners carry detail, the
 * bottom stays sparse. Labelling all four corners equally reads as
 * decoration; labelling two reads as an instrument.
 */
export default function TechnicalEdges() {
  const { scrollYProgress } = useScroll();
  const [pct, setPct] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) =>
    setPct(Math.round(v * 100)),
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 font-mono text-[9px] leading-relaxed tracking-[0.14em] text-line/45"
    >
      {/* Top-left — system status (detailed corner) */}
      <div className="absolute left-5 top-20 hidden md:block md:left-8 md:top-24">
        <p>SYSTEM: ONLINE</p>
        <p>NETWORK: GOAT</p>
        <p>VERSION: 0.1 BETA</p>
      </div>

      {/* Top-right — network status (detailed corner) */}
      <div className="absolute right-5 top-20 hidden text-right md:block md:right-8 md:top-24">
        <p>MULTI-AGENT NETWORK</p>
        <p>CYCLE 001</p>
        <p className="flex items-center justify-end gap-1.5">
          STATUS
          <motion.span
            className="inline-block h-1 w-1 rounded-full bg-signal"
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          />
          ACTIVE
        </p>
      </div>

      {/* Left vertical edge */}
      <p className="absolute left-3 top-1/2 hidden origin-center -translate-y-1/2 -rotate-90 whitespace-nowrap lg:block">
        GOAT ECOSYSTEM // BUILDER NETWORK
      </p>

      {/* Right vertical edge */}
      <p className="absolute right-3 top-1/2 hidden origin-center -translate-y-1/2 rotate-90 whitespace-nowrap lg:block">
        DISCOVER // BUILD // OWN
      </p>

      {/* Bottom-left — sparse */}
      <p className="absolute bottom-6 left-5 hidden md:block md:left-8">
        01 / 05 — INTRODUCTION
      </p>

      {/* Bottom-right — live coordinate readout */}
      <p className="absolute bottom-6 right-5 hidden text-right tabular-nums md:block md:right-8">
        X:001 / Y:004
        <br />
        <span className="text-brass/60">{String(pct).padStart(3, "0")}%</span>
      </p>
    </div>
  );
}
