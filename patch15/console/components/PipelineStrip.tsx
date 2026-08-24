"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Pipeline {
  tracking: number;
  urgent: number;
  proofRecords: number;
  agentCalls: number;
  nextDeadline: {
    title: string;
    deadline: string;
    applicationId: string;
  } | null;
}

/**
 * Cross-agent status strip.
 *
 * Sits above the agent rack so the first thing a returning builder sees is
 * their own state — what is tracked, what is closing, what they have proved
 * — rather than a catalogue of agents. The rack answers "what can this do";
 * this answers "what needs me today", which is the more useful question on
 * the second visit onward.
 */
export default function PipelineStrip() {
  const [data, setData] = useState<Pipeline | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<Pipeline>("/v1/handoff/pipeline");
        if (!cancelled) setData(res);
      } catch {
        /* the strip is supplementary — stay silent if it fails */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  // Nothing tracked yet means nothing useful to say. A row of zeroes is
  // worse than no row.
  if (data.tracking === 0 && data.proofRecords === 0) return null;

  const days = data.nextDeadline
    ? Math.ceil(
        (new Date(data.nextDeadline.deadline).getTime() - Date.now()) /
          86_400_000,
      )
    : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="mt-8 rounded-sm border border-line/25 bg-ink-2/50 p-5"
      aria-label="Your pipeline"
    >
      <p className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
        YOUR PIPELINE
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="TRACKING" value={data.tracking} href="/console/track" />
        <Stat
          label="CLOSING SOON"
          value={data.urgent}
          href="/console/track"
          accent={data.urgent > 0 ? "var(--color-danger)" : undefined}
        />
        <Stat label="PROOF RECORDS" value={data.proofRecords} href="/console/proof" />
        <Stat label="AGENT CALLS" value={data.agentCalls} />
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
            {data.nextDeadline.title}
          </span>
          <span className="shrink-0 font-mono text-[10px] tracking-widest text-brass-bright">
            {days <= 0 ? "DUE NOW" : `${days}D LEFT`}
          </span>
        </Link>
      )}
    </motion.section>
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
      <dt className="font-mono text-[9px] tracking-widest text-paper-dim/50">
        {label}
      </dt>
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
