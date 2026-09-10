"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Pipeline {
  tracking: number;
  urgent: number;
  overdue: number;
  proofRecords: number;
  agentCalls: number;
  nextDeadline: {
    title: string;
    deadline: string;
    applicationId: string;
  } | null;
}

type Phase = "loading" | "cold" | "active" | "error";

/**
 * What needs you today.
 *
 * ── Why this is the first thing on the page ───────────────────────────────
 *
 * The console used to open with "4 OPERATIONAL / 6" — a fact about us, not
 * about the person reading it, and one that was wrong for weeks besides. The
 * rack answers "what can this do"; this answers "what needs me today", which is
 * the more useful question from the second visit onward. So this sits above the
 * rack and the badge is gone.
 *
 * ── The cold state is the important one ───────────────────────────────────
 *
 * The old version returned null when nothing was tracked yet. That was the
 * right instinct — a row of zeroes reads as broken — but it left the top of the
 * page empty for exactly the person who needs the most direction: someone who
 * signed in for the first time. Every one of the first ten testers sees this
 * state, so it gets a real first step rather than a hidden component.
 */
export default function PipelineStrip() {
  const [data, setData] = useState<Pipeline | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<Pipeline>("/v1/handoff/pipeline");
        if (cancelled) return;
        setData(res);
        setPhase(
          res.tracking === 0 && res.proofRecords === 0 && res.agentCalls === 0
            ? "cold"
            : "active",
        );
      } catch {
        // Supplementary panel. A failure here must not imply the account is
        // empty, so it renders nothing rather than the cold-start prompt.
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "loading" || phase === "error") {
    // Reserve the height so the rack below does not jump when this resolves.
    return <div aria-hidden="true" className="mt-8 h-[132px]" />;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rack-surface mt-8 rounded-sm border border-line/25 p-5"
      aria-label="Your pipeline"
    >
      <p className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
        YOUR PIPELINE
      </p>

      {phase === "cold" ? <ColdStart /> : <Figures data={data!} />}
    </motion.section>
  );
}

/** First run. One sentence of orientation and one obvious next step. */
function ColdStart() {
  return (
    <div className="mt-3">
      <p className="max-w-lg text-[13px] leading-relaxed text-paper-dim">
        Nothing tracked yet. Start with the opportunity feed — track anything
        worth applying to, and the rest of the rack picks it up from there:
        ProofForge reviews the draft, BuilderFlow watches the deadline,
        BuilderRep records it when you win.
      </p>
      <Link
        href="/console/opportunities"
        className="mt-4 inline-block rounded-sm bg-brass px-5 py-2.5 font-display text-[13px] font-semibold text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
      >
        Browse opportunities
      </Link>
    </div>
  );
}

function Figures({ data }: { data: Pipeline }) {
  const days = data.nextDeadline
    ? Math.ceil(
        (new Date(data.nextDeadline.deadline).getTime() - Date.now()) /
          86_400_000,
      )
    : null;

  return (
    <>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Tracking" value={data.tracking} href="/console/track" />
        <Stat
          label={data.overdue > 0 ? "Overdue" : "Closing soon"}
          value={data.overdue > 0 ? data.overdue : data.urgent}
          href="/console/track"
          accent={
            data.overdue > 0
              ? "var(--color-danger)"
              : data.urgent > 0
                ? "var(--color-brass-bright)"
                : undefined
          }
        />
        <Stat
          label="Proof records"
          value={data.proofRecords}
          href="/console/proof"
        />
        <Stat
          label="Agent calls"
          value={data.agentCalls}
          href="/console/settlement"
        />
      </dl>

      {data.nextDeadline && days !== null && (
        <Link
          href="/console/track"
          className="mt-5 flex items-center gap-3 rounded-sm border border-brass/30 bg-brass/5 px-4 py-3 transition-colors hover:bg-brass/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-brass-bright"
          />
          <span className="min-w-0 flex-1 truncate text-[13px] text-paper">
            <span className="text-paper-dim/60">Next up — </span>
            {data.nextDeadline.title}
          </span>
          <span className="shrink-0 font-mono text-[10px] tracking-widest text-brass-bright">
            {days <= 0 ? "DUE TODAY" : `${days}D LEFT`}
          </span>
        </Link>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href?: string;
  accent?: string;
}) {
  const body = (
    <>
      <dt className="text-[11px] tracking-wide text-paper-dim/60">{label}</dt>
      <dd
        className="mt-1 font-display text-xl font-semibold tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </dd>
    </>
  );

  return href ? (
    <Link
      href={href}
      className="rounded-sm transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
    >
      {body}
    </Link>
  ) : (
    <div>{body}</div>
  );
}
