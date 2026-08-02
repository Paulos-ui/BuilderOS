"use client";

import { motion, useScroll, useTransform, useMotionValueEvent, type MotionValue } from "framer-motion";
import { useRef, useState } from "react";
import { PIPELINE_STEPS } from "@/data/agents";

// Path coordinates for a schematic zig-zag route through the 4 steps
const NODES = [
  { x: 8, y: 50 },
  { x: 36, y: 15 },
  { x: 64, y: 85 },
  { x: 92, y: 50 },
];

const PATH_D = `M ${NODES[0].x} ${NODES[0].y} L ${NODES[1].x} ${NODES[1].y} L ${NODES[2].x} ${NODES[2].y} L ${NODES[3].x} ${NODES[3].y}`;

export default function PipelineSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const [step, setStep] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setStep(Math.min(PIPELINE_STEPS.length - 1, Math.floor(v * PIPELINE_STEPS.length)));
  });

  const pathLength = useTransform(scrollYProgress, [0, 0.95], [0, 1]);
  const cursorOffset = useTransform(scrollYProgress, [0, 0.95], [0, 1]);

  return (
    <section id="pipeline" ref={ref} className="relative h-[420vh]">
      <div className="sticky top-0 flex h-screen flex-col justify-center px-6 py-16">
        <div className="mx-auto mb-10 w-full max-w-6xl">
          <p className="font-mono text-xs tracking-[0.25em] text-line-bright">
            03 · HOW IT WORKS
          </p>
          <h2 className="mt-3 max-w-lg font-display text-3xl font-semibold leading-tight text-paper sm:text-4xl">
            One route from discovery to reputation.
          </h2>
        </div>

        <div className="relative mx-auto h-[45vh] w-full max-w-6xl">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <path
              d={PATH_D}
              fill="none"
              stroke="var(--color-line)"
              strokeOpacity={0.25}
              strokeWidth={0.4}
            />
            <motion.path
              d={PATH_D}
              fill="none"
              stroke="var(--color-brass-bright)"
              strokeWidth={0.5}
              style={{ pathLength }}
            />
            {NODES.map((n, i) => (
              <circle
                key={i}
                cx={n.x}
                cy={n.y}
                r={1.4}
                fill={i <= step ? "var(--color-brass-bright)" : "var(--color-line)"}
              />
            ))}
          </svg>

          {/* Moving cursor along the path, driven by scroll */}
          <PathCursor progress={cursorOffset} />

          {PIPELINE_STEPS.map((s, i) => (
            <div
              key={s.label}
              style={{
                left: `${NODES[i].x}%`,
                top: `${NODES[i].y}%`,
              }}
              className={`absolute w-40 -translate-x-1/2 text-center transition-opacity duration-300 ${
                i === 0 ? "translate-y-6" : i === NODES.length - 1 ? "translate-y-6" : "-translate-y-16"
              } ${i <= step ? "opacity-100" : "opacity-35"}`}
            >
              <p className="font-display text-lg font-semibold text-paper">{s.label}</p>
              <p className="font-mono text-[10px] tracking-wide text-brass-bright">{s.agent}</p>
              <p className="mt-1 text-xs text-paper-dim">{s.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PathCursor({ progress }: { progress: MotionValue<number> }) {
  // Approximate position along the polyline by segment based on progress (0-1 across 3 segments)
  const left = useTransform(progress, (v) => {
    const seg = Math.min(2, Math.floor(v * 3));
    const localT = v * 3 - seg;
    const a = NODES[seg];
    const b = NODES[seg + 1];
    return `${a.x + (b.x - a.x) * localT}%`;
  });
  const top = useTransform(progress, (v) => {
    const seg = Math.min(2, Math.floor(v * 3));
    const localT = v * 3 - seg;
    const a = NODES[seg];
    const b = NODES[seg + 1];
    return `${a.y + (b.y - a.y) * localT}%`;
  });

  return (
    <motion.div
      style={{ left, top }}
      className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal-bright shadow-[0_0_16px_4px_rgba(143,203,171,0.5)]"
    />
  );
}
