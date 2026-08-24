"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import PageHeader from "./PageHeader";

interface ChecklistItem { label: string; done: boolean }
type Stage = "DRAFTING" | "REVIEWING" | "SUBMITTED" | "WON" | "REJECTED" | "ABANDONED";

interface FlowItem {
  id: string;
  title: string;
  sourceUrl: string | null;
  stage: Stage;
  deadline: string | null;
  daysLeft: number | null;
  urgency: "overdue" | "critical" | "soon" | "comfortable" | "none";
  checklist: ChecklistItem[];
  progress: number;
  lastScore: number | null;
  updatedAt: string;
}

const STAGES: { value: Stage; label: string }[] = [
  { value: "DRAFTING", label: "Drafting" },
  { value: "REVIEWING", label: "Reviewing" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "WON", label: "Won" },
  { value: "REJECTED", label: "Rejected" },
];

const URGENCY_COLOR: Record<FlowItem["urgency"], string> = {
  overdue: "var(--color-danger)",
  critical: "var(--color-danger)",
  soon: "var(--color-brass-bright)",
  comfortable: "var(--color-signal-bright)",
  none: "var(--color-paper-dim)",
};

export default function FlowBoard() {
  const [items, setItems] = useState<FlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const res = await api<{ items: FlowItem[] }>("/v1/flow/applications");
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      await api("/v1/flow/applications", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          deadline: deadline || undefined,
        }),
      });
      setTitle("");
      setDeadline("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that.");
    } finally {
      setAdding(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...body } as FlowItem : i)));
    try {
      await api(`/v1/flow/applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await load();
    } catch {
      await load(); // reconcile against the server on failure
    }
  }

  const active = items.filter((i) => !["WON", "REJECTED", "ABANDONED"].includes(i.stage));
  const closed = items.filter((i) => ["WON", "REJECTED", "ABANDONED"].includes(i.stage));

  return (
    <section className="pb-16">
      <PageHeader
        eyebrow="AG-03 · BUILDERFLOW"
        title="Application tracker"
        description="Every deadline, checklist and milestone across the programmes you are pursuing, in one timeline."
      />

      <form onSubmit={add} className="mt-8 flex flex-wrap gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What are you applying to?"
          aria-label="Application title"
          className="min-w-[200px] flex-1 rounded-sm border border-line/35 bg-ink/60 px-3 py-2.5 text-sm text-paper placeholder:text-paper-dim/35 focus:border-brass-bright focus:outline-none"
        />
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          aria-label="Deadline"
          className="rounded-sm border border-line/35 bg-ink/60 px-3 py-2.5 font-mono text-xs text-paper focus:border-brass-bright focus:outline-none"
        />
        <button
          type="submit"
          disabled={adding}
          className="cursor-pointer rounded-sm bg-brass px-5 py-2.5 font-mono text-xs tracking-wide text-ink transition-colors hover:bg-brass-bright disabled:opacity-60"
        >
          {adding ? "ADDING…" : "TRACK"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-sm border border-danger/50 bg-danger/10 px-3 py-2 font-mono text-xs text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 font-mono text-[11px] tracking-widest text-line-bright">LOADING…</p>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-sm border border-line/25 bg-ink-2/40 px-5 py-10 text-center">
          <p className="font-mono text-[11px] tracking-widest text-paper-dim/60">NOTHING TRACKED YET</p>
          <p className="mt-2 text-sm text-paper-dim">
            Add an application above, or track one straight from the opportunity feed.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-2.5">
          <AnimatePresence mode="popLayout">
            {active.map((item) => (
              <FlowRow key={item.id} item={item} onPatch={patch} />
            ))}
          </AnimatePresence>

          {closed.length > 0 && (
            <>
              <p className="pt-6 font-mono text-[10px] tracking-[0.25em] text-paper-dim/45">CLOSED</p>
              {closed.map((item) => (
                <FlowRow key={item.id} item={item} onPatch={patch} muted />
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function FlowRow({
  item,
  onPatch,
  muted,
}: {
  item: FlowItem;
  onPatch: (id: string, body: Record<string, unknown>) => void;
  muted?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function toggleCheck(index: number) {
    const next = item.checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c));
    onPatch(item.id, { checklist: next });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: muted ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="overflow-hidden rounded-sm border border-line/25 bg-ink-2/50"
    >
      <div className="flex flex-wrap items-center gap-4 px-4 py-4 md:px-5">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
        >
          <h2 className="truncate font-display text-base font-semibold text-paper">{item.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] tracking-wide">
            {item.daysLeft !== null && (
              <span style={{ color: URGENCY_COLOR[item.urgency] }}>
                {item.daysLeft < 0
                  ? `${Math.abs(item.daysLeft)}D OVERDUE`
                  : item.daysLeft === 0
                    ? "DUE TODAY"
                    : `${item.daysLeft}D LEFT`}
              </span>
            )}
            <span className="text-paper-dim/55">{item.progress}% CHECKLIST</span>
          </div>
        </button>

        <select
          value={item.stage}
          onChange={(e) => onPatch(item.id, { stage: e.target.value })}
          aria-label={`Stage for ${item.title}`}
          className="cursor-pointer rounded-sm border border-line/35 bg-ink/60 px-2 py-1.5 font-mono text-[10px] tracking-widest text-paper focus:border-brass-bright focus:outline-none"
        >
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-line/15"
          >
            <ul className="space-y-2 px-4 py-4 md:px-5">
              {item.checklist.map((c, i) => (
                <li key={c.label}>
                  <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-paper-dim">
                    <input
                      type="checkbox"
                      checked={c.done}
                      onChange={() => toggleCheck(i)}
                      className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-[var(--color-brass-bright)]"
                    />
                    <span className={c.done ? "text-paper-dim/45 line-through" : ""}>{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
