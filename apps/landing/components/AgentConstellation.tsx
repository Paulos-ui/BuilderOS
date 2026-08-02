"use client";

import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useRef, useState } from "react";
import { AGENTS, type Agent } from "@/data/agents";

const STATUS_COLOR: Record<Agent["status"], string> = {
  live: "var(--color-signal-bright)",
  beta: "var(--color-brass-bright)",
  planned: "var(--color-line)",
};

const STATUS_LABEL: Record<Agent["status"], string> = {
  live: "LIVE",
  beta: "BETA",
  planned: "PLANNED",
};

export default function AgentConstellation() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const [scrollActive, setScrollActive] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(AGENTS.length - 1, Math.floor(v * AGENTS.length));
    setScrollActive(idx);
  });

  const activeIndex = hovered ?? scrollActive;
  const activeAgent = AGENTS[activeIndex];

  return (
    <section id="constellation" ref={ref} className="relative h-[600vh]">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden px-6 py-16 md:py-24">
        <div className="mx-auto mb-6 w-full max-w-6xl md:mb-10">
          <p className="font-mono text-xs tracking-[0.25em] text-line-bright">
            02 · THE AGENT SYSTEM
          </p>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold leading-tight text-paper sm:text-4xl">
            Six specialized agents. One coordinated system.
          </h2>
        </div>

        <div className="relative mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-8 md:grid-cols-[1.3fr_1fr]">
          {/* The diagram */}
          <div className="relative min-h-[360px] rounded-sm border border-line/25 bg-ink-2/40">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
              {AGENTS.slice(0, -1).map((a, i) => {
                const b = AGENTS[i + 1];
                const revealed = scrollActive > i;
                return (
                  <motion.line
                    key={`${a.id}-${b.id}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="var(--color-line)"
                    strokeWidth={0.35}
                    strokeDasharray="2 1.4"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{
                      pathLength: revealed ? 1 : 0,
                      opacity: revealed ? 0.7 : 0,
                    }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                );
              })}
            </svg>

            {AGENTS.map((agent, i) => {
              const isActive = i <= scrollActive;
              const isFocused = activeIndex === i;
              return (
                <button
                  key={agent.id}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                  style={{ left: `${agent.x}%`, top: `${agent.y}%` }}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                  aria-label={`${agent.name} — ${agent.role}`}
                >
                  <motion.span
                    animate={{
                      scale: isActive ? (isFocused ? 1.6 : 1) : 0.4,
                      opacity: isActive ? 1 : 0.25,
                    }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="block h-3.5 w-3.5 rounded-full border-2 border-ink-2"
                    style={{
                      background: STATUS_COLOR[agent.status],
                      boxShadow: isFocused
                        ? `0 0 0 6px ${STATUS_COLOR[agent.status]}22, 0 0 24px 6px ${STATUS_COLOR[agent.status]}55`
                        : `0 0 0 3px ${STATUS_COLOR[agent.status]}18`,
                    }}
                  />
                  <span
                    className={`absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tracking-wide transition-opacity ${
                      isActive ? "opacity-90" : "opacity-30"
                    } text-paper-dim`}
                  >
                    {agent.code}
                  </span>
                </button>
              );
            })}
          </div>

          {/* The readout panel */}
          <div className="flex flex-col justify-center rounded-sm border border-line/25 bg-ink-2/60 p-6 md:p-8">
            <motion.div
              key={activeAgent.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-3 flex items-center gap-3 font-mono text-[11px] tracking-widest">
                <span className="text-line-bright">{activeAgent.code}</span>
                <span
                  className="rounded-full px-2 py-0.5"
                  style={{
                    color: STATUS_COLOR[activeAgent.status],
                    border: `1px solid ${STATUS_COLOR[activeAgent.status]}55`,
                  }}
                >
                  {STATUS_LABEL[activeAgent.status]}
                </span>
              </div>
              <h3 className="font-display text-2xl font-semibold text-paper">
                {activeAgent.name}
              </h3>
              <p className="mt-1 font-mono text-xs tracking-wide text-brass-bright">
                {activeAgent.role}
              </p>
              <p className="mt-4 text-balance font-body text-[15px] leading-relaxed text-paper-dim">
                {activeAgent.description}
              </p>
            </motion.div>

            <div className="mt-8 flex gap-1.5">
              {AGENTS.map((a, i) => (
                <div
                  key={a.id}
                  className="h-1 flex-1 rounded-full bg-line/20"
                >
                  <motion.div
                    className="h-1 rounded-full bg-brass-bright"
                    animate={{ width: i <= scrollActive ? "100%" : "0%" }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-[10px] tracking-widest text-paper-dim/60">
              KEEP SCROLLING TO STEP THROUGH THE SYSTEM — OR HOVER A NODE
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
