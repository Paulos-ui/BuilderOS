"use client";

import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useState } from "react";

const SECTIONS = [
  { id: "hero", label: "00 · INIT" },
  { id: "problem", label: "01 · PROBLEM" },
  { id: "constellation", label: "02 · AGENTS" },
  { id: "pipeline", label: "03 · PIPELINE" },
  { id: "reputation", label: "04 · REPUTATION" },
  { id: "docs", label: "05 · DOCS" },
  { id: "cta", label: "06 · JOIN" },
];

export default function ScrollHUD() {
  const { scrollYProgress } = useScroll();
  const [pct, setPct] = useState(0);
  const [active, setActive] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setPct(Math.round(v * 100));
    setActive(Math.min(SECTIONS.length - 1, Math.floor(v * SECTIONS.length)));
  });

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 hidden justify-between px-10 font-mono text-[11px] tracking-widest text-line-bright/80 md:flex md:px-12">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse-slow" />
        <span>BUILDEROS://{SECTIONS[active].label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-px w-24 bg-line/30">
          <motion.div
            className="h-px bg-brass-bright"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span>{String(pct).padStart(2, "0")}%</span>
      </div>
    </div>
  );
}
