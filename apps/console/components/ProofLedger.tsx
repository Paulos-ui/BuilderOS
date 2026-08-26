"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import PageHeader from "./PageHeader";

interface ProofItem {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  evidenceUrl: string | null;
  occurredAt: string;
  verified: boolean;
  chainTxHash: string | null;
}

interface RepSummary {
  items: ProofItem[];
  totals: {
    records: number;
    verified: number;
    applicationsSubmitted: number;
    applicationsWon: number;
  };
  anchoring: { enabled: boolean; network: string; note: string };
}

const KINDS = [
  { value: "grant_completed", label: "Grant completed" },
  { value: "hackathon_entered", label: "Hackathon entered" },
  { value: "contribution", label: "Open-source contribution" },
  { value: "shipped", label: "Project shipped" },
];

export default function ProofLedger() {
  const [data, setData] = useState<RepSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    kind: KINDS[0].value,
    title: "",
    evidenceUrl: "",
  });

  async function load() {
    try {
      setData(await api<RepSummary>("/v1/rep"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your record.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/v1/rep/records", {
        method: "POST",
        body: JSON.stringify({
          kind: form.kind,
          title: form.title.trim(),
          evidenceUrl: form.evidenceUrl.trim() || undefined,
        }),
      });
      setForm({ kind: KINDS[0].value, title: "", evidenceUrl: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't record that.");
    } finally {
      setBusy(false);
    }
  }

  async function exportRecord() {
    try {
      const payload = await api<unknown>("/v1/rep/export");
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "builderos-proof.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed.");
    }
  }

  return (
    <section className="pb-16">
      <PageHeader
        eyebrow="PROOF · BUILDERREP"
        title="Proof of work"
        description="A portable record of what you have completed. Yours to export and carry between ecosystems."
        actions={
          <button
            onClick={exportRecord}
            className="cursor-pointer rounded-sm border border-brass/50 px-4 py-2 font-mono text-[10px] tracking-widest text-brass-bright transition-colors hover:bg-brass/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
          >
            EXPORT JSON ↓
          </button>
        }
      />

      {data && (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-4 border-b border-line/15 pb-5 sm:grid-cols-4">
            <Stat label="RECORDS" value={data.totals.records} />
            <Stat label="VERIFIED" value={data.totals.verified} />
            <Stat label="SUBMITTED" value={data.totals.applicationsSubmitted} />
            <Stat label="WON" value={data.totals.applicationsWon} accent />
          </dl>

          {/* States the anchoring position plainly rather than implying it. */}
          <p className="mt-4 font-mono text-[9px] leading-relaxed tracking-wide text-paper-dim/50">
            {data.anchoring.note.toUpperCase()}
          </p>
        </>
      )}

      <form onSubmit={add} className="mt-8 flex flex-wrap gap-3">
        <select
          value={form.kind}
          onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
          aria-label="Record type"
          className="cursor-pointer rounded-sm border border-line/35 bg-ink/60 px-3 py-2.5 font-mono text-xs text-paper focus:border-brass-bright focus:outline-none"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="What did you complete?"
          aria-label="Title"
          className="min-w-[180px] flex-1 rounded-sm border border-line/35 bg-ink/60 px-3 py-2.5 text-sm text-paper placeholder:text-paper-dim/35 focus:border-brass-bright focus:outline-none"
        />
        <input
          value={form.evidenceUrl}
          onChange={(e) => setForm((f) => ({ ...f, evidenceUrl: e.target.value }))}
          placeholder="Evidence URL"
          aria-label="Evidence URL"
          className="min-w-[160px] rounded-sm border border-line/35 bg-ink/60 px-3 py-2.5 font-mono text-xs text-paper placeholder:text-paper-dim/35 focus:border-brass-bright focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer rounded-sm bg-brass px-5 py-2.5 font-mono text-xs tracking-wide text-ink transition-colors hover:bg-brass-bright disabled:opacity-60"
        >
          {busy ? "SAVING…" : "RECORD"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-sm border border-danger/50 bg-danger/10 px-3 py-2 font-mono text-xs text-danger">
          {error}
        </p>
      )}

      {data && data.items.length === 0 ? (
        <div className="mt-8 rounded-sm border border-line/25 bg-ink-2/40 px-5 py-10 text-center">
          <p className="font-mono text-[11px] tracking-widest text-paper-dim/60">
            NO RECORDS YET
          </p>
          <p className="mt-2 text-sm text-paper-dim">
            Record something you have shipped, or win an application you are
            tracking in BuilderFlow.
          </p>
        </div>
      ) : (
        <ol className="mt-8 space-y-2.5">
          {data?.items.map((item, i) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.35 }}
              className="rounded-sm border border-line/25 bg-ink-2/50 px-4 py-4 md:px-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-sm border border-line/30 px-1.5 py-px font-mono text-[9px] tracking-widest text-line-bright">
                  {item.kind.replace(/_/g, " ").toUpperCase()}
                </span>
                <span
                  className="rounded-sm border px-1.5 py-px font-mono text-[9px] tracking-widest"
                  style={{
                    color: item.verified
                      ? "var(--color-signal-bright)"
                      : "var(--color-paper-dim)",
                    borderColor: item.verified
                      ? "var(--color-signal-bright)55"
                      : "var(--color-line)44",
                  }}
                >
                  {item.verified ? "VERIFIED" : "SELF-ASSERTED"}
                </span>
                <span className="ml-auto font-mono text-[9px] tracking-wide text-paper-dim/45">
                  {new Date(item.occurredAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              <h2 className="mt-2 font-display text-base font-semibold text-paper">
                {item.title}
              </h2>

              {item.evidenceUrl && (
                <a
                  href={item.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-block font-mono text-[10px] tracking-wide text-line-bright underline underline-offset-4 hover:text-paper"
                >
                  EVIDENCE ↗
                </a>
              )}
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[9px] tracking-widest text-paper-dim/50">
        {label}
      </dt>
      <dd
        className="mt-1 font-display text-2xl font-semibold tabular-nums"
        style={{ color: accent ? "var(--color-brass-bright)" : undefined }}
      >
        {value}
      </dd>
    </div>
  );
}
