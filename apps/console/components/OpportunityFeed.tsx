"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface FeedItem {
  id: string;
  title: string;
  description: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  chains: string[];
  fundingMin: number | null;
  fundingMax: number | null;
  deadline: string | null;
  daysLeft: number | null;
  lastVerifiedAt: string;
  matchScore: number;
  matchReasons: string[];
  curated: boolean;
}

interface FeedResponse {
  items: FeedItem[];
  total: number;
  embeddingProvider: string;
  coldStart: boolean;
  note: string;
}

const FILTERS = [
  { label: "All", value: "" },
  { label: "Grants", value: "GRANT" },
  { label: "Hackathons", value: "HACKATHON" },
  { label: "Bounties", value: "BOUNTY" },
  { label: "Ecosystem", value: "ECOSYSTEM_FUND" },
];

export default function OpportunityFeed() {
  const [data, setData] = useState<FeedResponse | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const qs = filter ? `?category=${filter}` : "";
        const res = await api<FeedResponse>(`/v1/opportunities/feed${qs}`);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Couldn't load the feed.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filter]);

  return (
    <section className="py-10">
      <header>
        <p className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
          AG-01 · BUILDERSCOUT
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-paper">
          Opportunity feed
        </h1>
        {data && (
          <p className="mt-2 max-w-2xl text-sm text-paper-dim">{data.note}</p>
        )}
      </header>

      {/* Filters — horizontally scrollable on small screens */}
      <div
        role="tablist"
        aria-label="Filter opportunities"
        className="mt-6 flex gap-1 overflow-x-auto border-b border-line/20 pb-px"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`relative shrink-0 cursor-pointer px-4 py-2.5 font-mono text-[11px] tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-bright ${
              filter === f.value
                ? "text-paper"
                : "text-paper-dim/50 hover:text-paper-dim"
            }`}
          >
            {f.label.toUpperCase()}
            {filter === f.value && (
              <motion.span
                layoutId="feed-filter"
                className="absolute inset-x-0 -bottom-px h-px bg-brass-bright"
              />
            )}
          </button>
        ))}
      </div>


      {error && (
        <p
          role="alert"
          className="mt-6 rounded-sm border border-danger/50 bg-danger/10 px-4 py-3 font-mono text-xs text-danger"
        >
          {error}
        </p>
      )}

      {loading && !data && (
        <p className="mt-8 font-mono text-[11px] tracking-widest text-line-bright">
          QUERYING SOURCES…
        </p>
      )}

      {data && data.items.length === 0 && !loading && (
        <div className="mt-8 rounded-sm border border-line/25 bg-ink-2/40 px-5 py-8 text-center">
          <p className="font-mono text-[11px] tracking-widest text-paper-dim/60">
            NO OPEN OPPORTUNITIES IN THIS CATEGORY
          </p>
          <p className="mt-2 text-sm text-paper-dim">
            Run ingestion to populate the feed, or try another filter.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        <AnimatePresence mode="popLayout">
          {data?.items.map((item, i) => (
            <OpportunityRow key={item.id} item={item} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function OpportunityRow({ item, index }: { item: FeedItem; index: number }) {
  const [open, setOpen] = useState(false);
  const urgent = item.daysLeft !== null && item.daysLeft <= 7;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.35 }}
      className="overflow-hidden rounded-sm border border-line/25 bg-ink-2/50"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-line/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-bright md:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm border border-line/30 px-1.5 py-px font-mono text-[9px] tracking-widest text-line-bright">
              {item.category.replace("_", " ")}
            </span>
            <span className="font-mono text-[9px] tracking-widest text-paper-dim/50">
              {item.sourceName.toUpperCase()}
            </span>
            {item.curated && (
              <span
                className="rounded-sm border border-brass/40 px-1.5 py-px font-mono text-[9px] tracking-widest text-brass-bright"
                title="Curated by hand from the source's published page"
              >
                CURATED
              </span>
            )}
          </div>

          <h2 className="mt-2 font-display text-base font-semibold text-paper">
            {item.title}
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] tracking-wide text-paper-dim/70">
            {item.daysLeft !== null && (
              <span className={urgent ? "text-danger" : undefined}>
                {item.daysLeft === 0
                  ? "CLOSES TODAY"
                  : `${item.daysLeft}D LEFT`}
              </span>
            )}
            {item.fundingMax !== null && (
              <span className="text-signal-bright">
                UP TO ${item.fundingMax.toLocaleString()}
              </span>
            )}
            {item.chains.slice(0, 3).map((c) => (
              <span key={c}>{c.toUpperCase()}</span>
            ))}
          </div>
        </div>

        {/* Only render a score when one was actually computed. */}
        {item.matchScore > 0 && (
          <div className="shrink-0 text-right">
            <p className="font-display text-lg font-semibold text-brass-bright tabular-nums">
              {item.matchScore}
            </p>
            <p className="font-mono text-[9px] tracking-widest text-paper-dim/50">
              MATCH
            </p>
          </div>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-line/20"
          >
            <div className="px-4 py-4 md:px-5">
              <p className="max-w-2xl text-sm leading-relaxed text-paper-dim">
                {item.description}
              </p>

              <ul className="mt-4 space-y-1">
                {item.matchReasons.map((r) => (
                  <li
                    key={r}
                    className="flex items-start gap-2 font-mono text-[10px] tracking-wide text-paper-dim/70"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1 h-1 w-1 shrink-0 rounded-full bg-signal"
                    />
                    {r}
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm bg-brass px-4 py-2 font-mono text-xs tracking-wide text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                >
                  View listing ↗
                </a>
                <span className="font-mono text-[9px] tracking-widest text-paper-dim/45">
                  VERIFIED{" "}
                  {new Date(item.lastVerifiedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
