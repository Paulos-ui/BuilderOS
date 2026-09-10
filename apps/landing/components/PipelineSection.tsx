"use client";

import { motion, useScroll, useTransform, useMotionValueEvent, type MotionValue } from "framer-motion";
import { useRef, useState } from "react";
import { PIPELINE_STEPS } from "@/data/agents";

/**
 * Schematic zig-zag route, one node per pipeline step.
 *
 * `PATH_D` is derived from `NODES` rather than written out by hand. It used to
 * be a literal string naming NODES[0] through NODES[3], which meant adding a
 * fifth step drew a line to four nodes and positioned a label against
 * `NODES[4].x` — undefined, and a crash rather than a visual glitch. Keep this
 * array the same length as `PIPELINE_STEPS`.
 */
const NODES = [
  { x: 6, y: 50 },
  { x: 28, y: 16 },
  { x: 50, y: 84 },
  { x: 72, y: 22 },
  { x: 94, y: 52 },
];

const PATH_D = NODES.map(
  (n, i) => `${i === 0 ? "M" : "L"} ${n.x} ${n.y}`,
).join(" ");

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
    <section id="pipeline" ref={ref} className="relative h-[520vh]">
      <div className="sticky top-0 flex h-screen flex-col justify-center px-6 py-16">
        <div className="mx-auto mb-10 w-full max-w-6xl">
          <p className="font-mono text-xs tracking-[0.25em] text-line-bright">
            03 · HOW IT WORKS
          </p>
          <h2 className="mt-3 max-w-lg font-display text-3xl font-semibold leading-tight text-paper sm:text-4xl">
            One route from discovery to settlement.
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

          {PIPELINE_STEPS.map((s, i) => {
            // Degrade to the last node rather than throwing if the two arrays
            // ever fall out of step again.
            const n = NODES[i] ?? NODES[NODES.length - 1];
            return (
              <div
                key={s.label}
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
                className={`absolute w-40 -translate-x-1/2 text-center transition-opacity duration-300 ${
                  i === 0 || i === NODES.length - 1
                    ? "translate-y-6"
                    : "-translate-y-16"
                } ${i <= step ? "opacity-100" : "opacity-35"}`}
              >
                <p className="font-display text-lg font-semibold text-paper">{s.label}</p>
                <p className="font-mono text-[10px] tracking-wide text-brass-bright">{s.agent}</p>
                <p className="mt-1 text-xs text-paper-dim">{s.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * Walks the cursor along the polyline.
 *
 * The segment count is derived from `NODES` rather than hardcoded to 3. With
 * the literal, a fifth node added a fourth segment the cursor never entered:
 * it would reach the fourth node at full scroll and stop, leaving the last leg
 * of the path with nothing travelling it and no error to explain why.
 */
function PathCursor({ progress }: { progress: MotionValue<number> }) {
  const segments = NODES.length - 1;

  const at = (v: number, axis: "x" | "y") => {
    const seg = Math.min(segments - 1, Math.max(0, Math.floor(v * segments)));
    const localT = v * segments - seg;
    const a = NODES[seg];
    const b = NODES[seg + 1];
    return `${a[axis] + (b[axis] - a[axis]) * localT}%`;
  };

  const left = useTransform(progress, (v) => at(v, "x"));
  const top = useTransform(progress, (v) => at(v, "y"));

  return (
    <motion.div
      style={{ left, top }}
      className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal-bright shadow-[0_0_16px_4px_rgba(143,203,171,0.5)]"
    />
  );
}
