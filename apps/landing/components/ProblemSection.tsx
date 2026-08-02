"use client";

import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useRef } from "react";

const FRAGMENTS = [
  { label: "Gitcoin Round 24", x: -34, y: -14, depth: 0.6 },
  { label: "Superteam Bounty", x: 28, y: -22, depth: 0.9 },
  { label: "GOAT Grants Q3", x: -22, y: 20, depth: 1.2 },
  { label: "ETHGlobal Hackathon", x: 32, y: 14, depth: 0.75 },
  { label: "Optimism RetroPGF", x: 6, y: -30, depth: 1.05 },
  { label: "L2 Ecosystem Fund", x: -8, y: 30, depth: 0.85 },
  { label: "Base Builder Grant", x: 40, y: -4, depth: 1.15 },
  { label: "Discord #opportunities", x: -40, y: 4, depth: 0.65 },
];

export default function ProblemSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scatter = useTransform(scrollYProgress, [0, 0.45, 0.85, 1], [0, 1, 0, 0]);
  const headlineOpacity = useTransform(scrollYProgress, [0.15, 0.4, 0.75, 0.95], [0, 1, 1, 0]);
  const headlineY = useTransform(scrollYProgress, [0.15, 0.4], [40, 0]);

  return (
    <section id="problem" ref={ref} className="relative h-[220vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden px-6">
        {/* Scattering opportunity fragments — the noise builders currently deal with */}
        <div className="absolute inset-0 flex items-center justify-center">
          {FRAGMENTS.map((f, i) => (
            <Fragment key={f.label} fragment={f} scatter={scatter} index={i} />
          ))}
        </div>

        <motion.div
          style={{ opacity: headlineOpacity, y: headlineY }}
          className="relative z-10 max-w-2xl text-center"
        >
          <p className="mb-4 font-mono text-xs tracking-[0.25em] text-line-bright">
            01 · THE PROBLEM
          </p>
          <h2 className="font-display text-4xl font-semibold leading-tight text-paper sm:text-5xl">
            Opportunity is everywhere. Signal isn&apos;t.
          </h2>
          <p className="mt-6 text-balance font-body text-lg text-paper-dim">
            The best grants and bounties are scattered across a hundred
            Discords, Notion boards, and quote-tweets. Builders lose weeks to
            search instead of shipping  and miss deadlines they never even
            saw.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function Fragment({
  fragment,
  scatter,
  index,
}: {
  fragment: (typeof FRAGMENTS)[number];
  scatter: MotionValue<number>;
  index: number;
}) {
  const x = useTransform(scatter, (v) => `${fragment.x * v}vw`);
  const y = useTransform(scatter, (v) => `${fragment.y * v}vh`);
  const opacity = useTransform(scatter, [0, 0.15, 1], [0, 1, 0.55]);
  const rotate = useTransform(scatter, (v) => v * (index % 2 === 0 ? 6 : -6));

  return (
    <motion.div
      style={{ x, y, opacity, rotate }}
      className="pointer-events-none absolute rounded-sm border border-line/40 bg-ink-2/80 px-3 py-1.5 font-mono text-[11px] text-paper-dim backdrop-blur-sm"
    >
      {fragment.label}
    </motion.div>
  );
}
