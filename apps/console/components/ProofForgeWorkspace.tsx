"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import PageHeader from "./PageHeader";

interface DimensionScore {
  key: string;
  label: string;
  score: number;
  weight: number;
  findings: string[];
  suggestions: string[];
}

interface ScoreResult {
  overall: number;
  engine: "rubric" | "llm";
  dimensions: DimensionScore[];
  criticalGaps: string[];
  strengths: string[];
  wordCount: number;
  scoredAt: string;
  disclaimer: string;
}

const SECTIONS = [
  {
    key: "problem" as const,
    label: "The problem",
    hint: "Who has this problem, how often, and what does it cost them?",
    rows: 4,
  },
  {
    key: "solution" as const,
    label: "Your solution",
    hint: "What can someone do after this ships that they cannot do now?",
    rows: 4,
  },
  {
    key: "technical" as const,
    label: "Technical approach",
    hint: "Architecture, components, and links to code that already exists.",
    rows: 4,
  },
  {
    key: "milestones" as const,
    label: "Milestones",
    hint: "Dates, deliverables, and how each one can be verified.",
    rows: 4,
  },
  {
    key: "budget" as const,
    label: "Budget",
    hint: "Line items tied to milestones, not one total.",
    rows: 3,
  },
  {
    key: "team" as const,
    label: "Team",
    hint: "What you have shipped. Links beat adjectives.",
    rows: 3,
  },
];

type Draft = Partial<Record<(typeof SECTIONS)[number]["key"], string>>;

export default function ProofForgeWorkspace() {
  const [draft, setDraft] = useState<Draft>({});
  const [title, setTitle] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = Object.values(draft).filter((v) => v?.trim()).length;

  async function runScore() {
    if (busy) return;
    if (filled === 0) {
      setError("Write at least one section before scoring.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<ScoreResult>("/v1/proofforge/score", {
        method: "POST",
        body: JSON.stringify({
          draft,
          opportunityTitle: title.trim() || undefined,
        }),
      });
      setResult(res);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't score that draft.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pb-16">
      <PageHeader
        eyebrow="AG-02 · PROOFFORGE"
        title="Application review"
        description="Paste or write your draft. ProofForge reviews what you wrote against the elements reviewers look for, and names the specific gaps that would cost you the grant."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Editor */}
        <div>
          <label
            htmlFor="pf-title"
            className="mb-1.5 block font-mono text-[10px] tracking-widest text-paper-dim/70"
          >
            APPLYING TO <span className="text-paper-dim/40">(OPTIONAL)</span>
          </label>
          <input
            id="pf-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. GOAT Network Builder Program"
            className="mb-6 w-full rounded-sm border border-line/40 bg-ink/60 px-3 py-2.5 font-mono text-sm text-paper placeholder:text-paper-dim/35 focus:border-brass-bright focus:outline-none"
          />

          <div className="space-y-5">
            {SECTIONS.map((section) => {
              const dim = result?.dimensions.find((d) => d.key === section.key);
              return (
                <div key={section.key}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <label
                      htmlFor={`pf-${section.key}`}
                      className="font-mono text-[10px] tracking-widest text-paper-dim/70"
                    >
                      {section.label.toUpperCase()}
                    </label>
                    {dim && <ScorePip score={dim.score} />}
                  </div>

                  <textarea
                    id={`pf-${section.key}`}
                    rows={section.rows}
                    value={draft[section.key] ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [section.key]: e.target.value }))
                    }
                    placeholder={section.hint}
                    className="w-full resize-y rounded-sm border border-line/30 bg-ink/60 px-3 py-2.5 text-[13px] leading-relaxed text-paper placeholder:text-paper-dim/35 focus:border-brass-bright focus:outline-none"
                  />

                  {dim && dim.suggestions.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {dim.suggestions.map((s) => (
                        <li
                          key={s}
                          className="flex items-start gap-2 font-mono text-[10px] leading-relaxed text-brass-bright/80"
                        >
                          <span aria-hidden="true">→</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={runScore}
            disabled={busy}
            className="mt-7 w-full cursor-pointer rounded-sm bg-brass px-6 py-3.5 font-display text-sm font-semibold text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "REVIEWING…" : result ? "Re-score draft" : "Score my draft"}
          </button>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-sm border border-danger/50 bg-danger/10 px-3 py-2 font-mono text-xs text-danger"
            >
              {error}
            </p>
          )}
        </div>

        {/* Results rail */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <AnimatePresence mode="wait">
            {result ? (
              <ResultPanel key="result" result={result} />
            ) : (
              <EmptyPanel key="empty" filled={filled} total={SECTIONS.length} />
            )}
          </AnimatePresence>
        </aside>
      </div>
    </section>
  );
}

function ScorePip({ score }: { score: number }) {
  const color =
    score >= 70
      ? "var(--color-signal-bright)"
      : score >= 40
        ? "var(--color-brass-bright)"
        : "var(--color-danger)";
  return (
    <span className="font-mono text-[10px] tabular-nums" style={{ color }}>
      {score}
    </span>
  );
}

function EmptyPanel({ filled, total }: { filled: number; total: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="rounded-sm border border-line/25 bg-ink-2/50 p-5"
    >
      <p className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
        NOT YET SCORED
      </p>
      <p className="mt-4 text-[13px] leading-relaxed text-paper-dim">
        Fill in the sections you have. You do not need all six — ProofForge
        scores what exists and tells you what is missing.
      </p>
      <p className="mt-4 font-mono text-[10px] tracking-widest text-paper-dim/50">
        {filled} / {total} SECTIONS WRITTEN
      </p>
    </motion.div>
  );
}

function ResultPanel({ result }: { result: ScoreResult }) {
  const band =
    result.overall >= 70
      ? { label: "COMPETITIVE", color: "var(--color-signal-bright)" }
      : result.overall >= 45
        ? { label: "NEEDS WORK", color: "var(--color-brass-bright)" }
        : { label: "NOT READY", color: "var(--color-danger)" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div className="rounded-sm border border-line/25 bg-ink-2/60 p-5">
        <p className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
          DRAFT SCORE
        </p>

        <div className="mt-3 flex items-baseline gap-3">
          <span
            className="font-display text-5xl font-semibold tabular-nums"
            style={{ color: band.color }}
          >
            {result.overall}
          </span>
          <span className="font-mono text-[10px] tracking-widest text-paper-dim/50">
            / 100
          </span>
        </div>

        <span
          className="mt-2 inline-block rounded-sm border px-2 py-0.5 font-mono text-[9px] tracking-widest"
          style={{ color: band.color, borderColor: `${band.color}55` }}
        >
          {band.label}
        </span>

        <div className="mt-5 space-y-2.5">
          {result.dimensions.map((d) => (
            <div key={d.key}>
              <div className="flex items-baseline justify-between gap-2 font-mono text-[10px]">
                <span className="text-paper-dim/70">{d.label}</span>
                <ScorePip score={d.score} />
              </div>
              <div className="mt-1 h-[3px] rounded-full bg-ink-3">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background:
                      d.score >= 70
                        ? "var(--color-signal-bright)"
                        : d.score >= 40
                          ? "var(--color-brass-bright)"
                          : "var(--color-danger)",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${d.score}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {result.criticalGaps.length > 0 && (
        <div className="rounded-sm border border-danger/30 bg-danger/5 p-5">
          <p className="font-mono text-[10px] tracking-[0.25em] text-danger">
            CRITICAL GAPS
          </p>
          <ul className="mt-3 space-y-2">
            {result.criticalGaps.map((g) => (
              <li
                key={g}
                className="flex items-start gap-2 text-[12px] leading-relaxed text-paper-dim"
              >
                <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-danger" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.strengths.length > 0 && (
        <div className="rounded-sm border border-signal/30 bg-signal/5 p-5">
          <p className="font-mono text-[10px] tracking-[0.25em] text-signal-bright">
            WORKING WELL
          </p>
          <ul className="mt-3 space-y-1.5">
            {result.strengths.map((s) => (
              <li key={s} className="text-[12px] leading-relaxed text-paper-dim">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="px-1 font-mono text-[9px] leading-relaxed text-paper-dim/45">
        {result.disclaimer}
      </p>
    </motion.div>
  );
}
