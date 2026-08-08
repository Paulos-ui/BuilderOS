"use client";

import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useRef, useState } from "react";

const DOC_SECTIONS = [
  {
    tab: "VISION",
    title: "Why BuilderOS exists",
    body: [
      "Web3's best opportunities are distributed across hundreds of Discords, Notion boards, and ecosystem blogs  and the strongest builders don't always win, the fastest searchers do.",
      "BuilderOS closes that gap with a coordinated system of specialized agents instead of one generalist assistant, because discovery, application quality, collaboration, and reputation are genuinely different problems that need different tools working from the same builder profile.",
    ],
  },
  {
    tab: "HOW IT WORKS",
    title: "Agents, not a single assistant",
    body: [
      "Your builder profile  repos, past grants, skills, chain activity — is the shared context every agent reads from and writes back to.",
      "BuilderScout ranks opportunities against that profile. ProofForge scores and drafts your submission. BuilderFlow tracks the logistics. BuilderRep records the outcome as structured proof. Each agent hands off structured state to the next — no copy-pasting between five tabs.",
    ],
  },
  {
    tab: "USER GUIDE",
    title: "Getting started",
    body: [
      "1. Connect a wallet or email, then link your GitHub this becomes the seed of your builder profile.",
      "2. BuilderScout surfaces a ranked feed of grants, hackathons, and bounties within minutes.",
      "3. Open any opportunity into ProofForge to get an application score, gap analysis, and a generated first draft.",
      "4. Track deadlines in BuilderFlow, and once you ship, BuilderRep records it as structured proof on your builder profile.",
    ],
  },
  {
    tab: "FEATURES",
    title: "What ships in the MVP",
    body: [
      "Ranked opportunity feed with saved searches and deadline alerts.",
      "AI application scoring against real reviewer criteria, with inline rewrite suggestions.",
      "One-click document generation: pitch summary, technical brief, budget table.",
      "Wallet + email auth, with a public builder profile you control.",
      "A proof-of-work record for completed grants, built to stay portable across ecosystems.",
    ],
  },
];

export default function AboutDocs() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(DOC_SECTIONS.length - 1, Math.floor(v * DOC_SECTIONS.length)));
  });

  return (
    <section id="docs" ref={ref} className="relative h-[440vh]">
      <div className="sticky top-0 flex h-screen flex-col justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-6xl">
          <p className="font-mono text-xs tracking-[0.25em] text-line-bright">
            05 · SPEC SHEET
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-paper sm:text-4xl">
            About the project
          </h2>
        </div>

        <div className="mx-auto mt-8 grid w-full max-w-6xl flex-1 grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
          {/* Index rail — like a spec sheet's table of contents */}
          <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {DOC_SECTIONS.map((d, i) => (
              <div
                key={d.tab}
                className={`relative shrink-0 border-l-2 py-2 pl-4 font-mono text-[11px] tracking-widest transition-colors md:shrink ${
                  active === i
                    ? "border-brass-bright text-paper"
                    : "border-line/20 text-paper-dim/50"
                }`}
              >
                <span className="mr-2 text-paper-dim/40">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {d.tab}
              </div>
            ))}
          </nav>

          {/* Content panel */}
          <div className="relative min-h-[45vh] rounded-sm border border-line/25 bg-ink-2/50 p-8 md:p-12">
            {DOC_SECTIONS.map((d, i) => (
              <motion.div
                key={d.tab}
                className="absolute inset-0 flex flex-col justify-center p-8 md:p-12"
                initial={false}
                animate={{
                  opacity: active === i ? 1 : 0,
                  y: active === i ? 0 : 12,
                  pointerEvents: active === i ? "auto" : "none",
                }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <h3 className="font-display text-2xl font-semibold text-paper">
                  {d.title}
                </h3>
                <div className="mt-5 space-y-3">
                  {d.body.map((line, li) => (
                    <p
                      key={li}
                      className="max-w-xl text-balance font-body text-[15px] leading-relaxed text-paper-dim"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="mx-auto mt-6 w-full max-w-6xl font-mono text-[10px] tracking-widest text-paper-dim/50">
          KEEP SCROLLING TO STEP THROUGH THE SPEC — 0{active + 1} / 0{DOC_SECTIONS.length}
        </p>
      </div>
    </section>
  );
}
