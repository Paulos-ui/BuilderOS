"use client";

import { useScroll, useTransform, motion } from "framer-motion";
import { useRef } from "react";
import dynamic from "next/dynamic";

const ReputationSeal = dynamic(() => import("@/components/ReputationSeal"), {
  ssr: false,
});

const FACTS = [
  {
    k: "Chain",
    v: "GOAT Network",
    d: "Bitcoin-secured execution with EVM-equivalent tooling. BuilderOS agents are registered against its ERC-8004 identity registry.",
  },
  {
    k: "Settlement",
    v: "x402 payments",
    d: "Planned: HTTP-native micropayments so agents and builders can settle bounties without invoicing overhead.",
  },
  {
    k: "Record",
    v: "Portable proof-of-work",
    d: "Every completed grant, shipped repo and passed review becomes a structured record you can carry between ecosystems.",
  },
];

export default function ReputationSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const sealProgress = useTransform(scrollYProgress, [0.1, 0.9], [0, 1]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);

  return (
    <section id="reputation" ref={ref} className="relative h-[380vh]">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden px-6 py-16">
        <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-8 md:grid-cols-2">
          <motion.div style={{ opacity: textOpacity }}>
            <p className="font-mono text-xs tracking-[0.25em] text-line-bright">
              04 · REPUTATION &amp; OWNERSHIP
            </p>
            <h2 className="mt-3 max-w-md font-display text-3xl font-semibold leading-tight text-paper sm:text-4xl">
              Your work should build your reputation.
            </h2>
            <p className="mt-5 max-w-md text-balance font-body text-[15px] leading-relaxed text-paper-dim">
              Completed grants, reviewed contributions and shipped work
              don&apos;t just close a ticket — BuilderOS records them as
              structured proof you can carry into the next program you apply
              to. Anchoring that record on GOAT Network is on the roadmap.
            </p>

            <dl className="mt-8 space-y-5 border-t border-line/20 pt-6">
              {FACTS.map((f) => (
                <div key={f.k} className="grid grid-cols-[100px_1fr] gap-4">
                  <dt className="font-mono text-[11px] tracking-widest text-paper-dim/60">
                    {f.k.toUpperCase()}
                  </dt>
                  <dd>
                    <span className="font-display text-base font-semibold text-brass-bright">
                      {f.v}
                    </span>
                    <p className="mt-1 text-sm text-paper-dim">{f.d}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>

          <div className="relative h-[50vh] md:h-[60vh]">
            <ReputationSeal progress={sealProgress} />
          </div>
        </div>
      </div>
    </section>
  );
}
