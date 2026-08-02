"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";

export default function CTAFooter() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start 0.3"],
  });
  const stampScale = useTransform(scrollYProgress, [0, 1], [1.8, 1]);
  const stampOpacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const stampRotate = useTransform(scrollYProgress, [0, 1], [-12, 0]);

  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="cta" ref={ref} className="relative flex min-h-screen flex-col justify-center px-6 py-24">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <motion.div
          style={{ scale: stampScale, opacity: stampOpacity, rotate: stampRotate }}
          className="mb-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-brass-bright"
        >
          <span className="font-mono text-[10px] tracking-widest text-brass-bright">
            SPEC
            <br />
            001
          </span>
        </motion.div>

        <p className="font-mono text-xs tracking-[0.25em] text-line-bright">
          06 · JOIN THE BUILD
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold leading-tight text-paper sm:text-5xl">
          Your next opportunity is already being ranked.
        </h2>
        <p className="mt-5 max-w-lg text-balance font-body text-lg text-paper-dim">
          Private beta is limited to a few hundred builders at launch.
          Connect a wallet or drop your email — BuilderScout starts working
          the moment you do.
        </p>

        {submitted ? (
          <div className="mt-8 rounded-sm border border-signal/40 bg-signal/10 px-6 py-4 font-mono text-sm text-signal-bright">
            You&apos;re on the list. Watch for an invite.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) setSubmitted(true);
            }}
            className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@builder.dev"
              className="flex-1 rounded-sm border border-line/40 bg-ink-2/60 px-4 py-3 font-mono text-sm text-paper placeholder:text-paper-dim/50 focus:border-brass-bright focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-sm bg-brass px-6 py-3 font-mono text-sm tracking-wide text-ink transition-colors hover:bg-brass-bright"
            >
              Request access
            </button>
          </form>
        )}

        <div className="mt-6 flex items-center gap-2 font-mono text-[11px] tracking-widest text-paper-dim/50">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          OR CONNECT WALLET — SUPPORTS GOAT NETWORK
        </div>
      </div>

      <footer className="mx-auto mt-32 flex w-full max-w-6xl flex-col items-center gap-4 border-t border-line/20 pt-8 font-mono text-[11px] tracking-widest text-paper-dim/50 sm:flex-row sm:justify-between">
        <span>BUILDEROS © {new Date().getFullYear()}</span>
        <div className="flex gap-6">
          <a href="#" className="hover:text-paper">GITHUB</a>
          <a href="#" className="hover:text-paper">DOCS</a>
          <a href="#" className="hover:text-paper">X</a>
        </div>
      </footer>
    </section>
  );
}
