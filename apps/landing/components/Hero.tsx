"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const titleY = useTransform(scrollYProgress, [0, 1], ["0%", "-18%"]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);
  const subOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const gridScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const coreScale = useTransform(scrollYProgress, [0, 1], [1, 2.4]);
  const coreOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      id="hero"
      ref={ref}
      className="relative flex h-[130vh] flex-col items-center overflow-hidden"
    >
      <div className="sticky top-0 flex h-screen w-full flex-col items-center justify-center px-6 pt-14 md:pt-16">
        {/* Radiating construction lines behind the core node */}
        <motion.svg
          viewBox="0 0 800 800"
          className="pointer-events-none absolute h-[140vmin] w-[140vmin] opacity-40"
          style={{ scale: gridScale }}
        >
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * Math.PI * 2;
            const x2 = 400 + Math.cos(angle) * 380;
            const y2 = 400 + Math.sin(angle) * 380;
            return (
              <motion.line
                key={i}
                x1={400}
                y1={400}
                x2={x2}
                y2={y2}
                stroke="var(--color-line)"
                strokeWidth={1}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.4, delay: 0.3 + i * 0.02, ease: [0.16, 1, 0.3, 1] }}
              />
            );
          })}
          <circle cx={400} cy={400} r={2} fill="var(--color-brass)" />
        </motion.svg>

        {/* Core node — the "BuilderOS" origin point of the whole diagram */}
        <motion.div
          style={{ scale: coreScale, opacity: coreOpacity }}
          className="absolute h-3 w-3 rounded-full bg-brass-bright shadow-[0_0_40px_10px_rgba(217,168,86,0.35)]"
        />

        <motion.div
          style={{ y: titleY, opacity: titleOpacity }}
          className="relative z-10 flex flex-col items-center text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="mb-6 flex items-center gap-2 rounded-full border border-line/40 px-4 py-1.5 font-mono text-[11px] tracking-[0.2em] text-line-bright"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            SPEC 001 · MULTI-AGENT BUILDER OS
          </motion.div>

          <h1 className="font-display text-[13vw] font-bold leading-[0.92] tracking-tight text-paper sm:text-[9vw] lg:text-[7.2vw]">
            <PlotLine text="Build in" delay={0.5} />
            <span className="block">
              <PlotLine text="the open." delay={0.9} className="text-stroke-line" />
            </span>
          </h1>

          <motion.p
            style={{ opacity: subOpacity }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.7 }}
            className="mt-8 max-w-xl text-balance font-body text-lg text-paper-dim sm:text-xl"
          >
            BuilderOS is a coordinated system of agents that discovers your
            next grant, hackathon or bounty, helps you build a competitive
            submission, and turns completed work into reputation you own.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.75, duration: 0.7 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
          >
            <a
              href="#cta"
              className="group relative overflow-hidden rounded-sm bg-brass px-7 py-3 font-mono text-sm tracking-wide text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
            >
              Join the private beta
            </a>
            <a
              href="#constellation"
              className="rounded-sm font-mono text-sm tracking-wide text-line-bright underline decoration-line/50 underline-offset-4 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
            >
              See the agent system ↓
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.95, duration: 0.6 }}
            className="mt-5 font-mono text-[10px] tracking-[0.2em] text-paper-dim/60"
          >
            PRIVATE BETA / EARLY ACCESS
          </motion.p>
        </motion.div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.3em] text-line-bright/60">
          SCROLL TO DRAFT
        </div>
      </div>
    </section>
  );
}

/** Renders text with a per-letter draft-in stagger — a headline that plots itself. */
function PlotLine({
  text,
  delay = 0,
  className = "",
}: {
  text: string;
  delay?: number;
  className?: string;
}) {
  return (
    <span className={`inline-block ${className}`}>
      {/* One clean text node for assistive tech; the animated per-letter
          spans below are decorative and would otherwise be read out one
          letter at a time. */}
      <span className="sr-only">{text}</span>
      {text.split("").map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, y: "0.6em", rotateX: -40 }}
          animate={{ opacity: 1, y: "0em", rotateX: 0 }}
          transition={{
            delay: delay + i * 0.028,
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1],
          }}
          aria-hidden="true"
        >
          {ch === " " ? "\u00A0" : ch}
        </motion.span>
      ))}
    </span>
  );
}
