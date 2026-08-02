"use client";

import { motion, useScroll, useTransform } from "framer-motion";

/**
 * The persistent "drafting table" backdrop. Fixed behind every section.
 * A faint grid plus four corner tick-marks and a hairline frame — the
 * visual grammar of a technical drawing sheet. Grid opacity breathes
 * subtly with overall scroll progress so the page never feels static,
 * without competing with foreground content.
 */
export default function BlueprintField() {
  const { scrollYProgress } = useScroll();
  const gridOpacity = useTransform(scrollYProgress, [0, 0.05, 1], [0.5, 1, 1]);
  const vignette = useTransform(scrollYProgress, [0, 1], [0.2, 0.55]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <motion.div className="absolute inset-0 bp-grid" style={{ opacity: gridOpacity }} />
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, transparent 40%, var(--color-ink) 100%)",
          opacity: vignette,
        }}
      />
      {/* Frame + corner ticks — reads as a drawing sheet border */}
      <div className="absolute inset-6 border border-line/25 md:inset-10" />
      {[
        "top-4 left-4 md:top-8 md:left-8",
        "top-4 right-4 md:top-8 md:right-8",
        "bottom-4 left-4 md:bottom-8 md:left-8",
        "bottom-4 right-4 md:bottom-8 md:right-8",
      ].map((pos) => (
        <div key={pos} className={`absolute h-3 w-3 border-line/50 ${pos}`}>
          <div className="h-full w-full border-t border-l border-line/60" />
        </div>
      ))}
    </div>
  );
}
