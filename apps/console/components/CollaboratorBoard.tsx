"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import BuilderIdenticon from "./BuilderIdenticon";
import PageHeader from "./PageHeader";

/**
 * BuilderMatch (AG-04), the builder-facing view.
 *
 * ── Why this page exists ──────────────────────────────────────────────────
 *
 * `GET /v1/match/collaborators` has been shipped and reachable for a while, and
 * the console had no way to call it. The rack listed BuilderMatch as an agent,
 * the sidebar had no entry for it, and clicking the card opened a panel that
 * described the feature and then offered nothing to press. An agent you can
 * read about but not run is a brochure, so the rack's launch button now lands
 * here.
 *
 * ── Why the scores are shown, and shown broken down ───────────────────────
 *
 * A ranked list of strangers is only persuasive if you can see what ranked
 * them. The API already returns `reasons` — shared chains, the languages a
 * candidate brings that you do not list, proximity, and a track-record bonus —
 * so the card names the two that a person can act on (what you share, what they
 * add) rather than showing a single opaque percentage.
 *
 * The endpoint also accepts `opportunityId` to score candidates against a
 * specific programme. Nothing links here with one yet; when the tracker does,
 * pass it through to `load()` and surface `scopedToOpportunity` in the header.
 */

interface MatchReasons {
  contextOverlap: number;
  skillComplement: number;
  proximity: number;
  proximityScore: number;
  trackRecord: number;
  sharedChains: string[];
  bringsSkills: string[];
  opportunityFit: number | null;
}

interface Collaborator {
  builderProfileId: string;
  githubUsername: string | null;
  chains: string[];
  languages: string[];
  bio: string | null;
  score: number;
  rationale: string;
  reasons: MatchReasons;
  provenWork: number;
}

interface MatchResponse {
  collaborators: Collaborator[];
  coldStart: boolean;
  poolSize: number;
  embeddingProvider: string;
  scopedToOpportunity: string | null;
  note: string;
}

export default function CollaboratorBoard() {
  const [data, setData] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<MatchResponse>("/v1/match/collaborators?limit=12");
        if (!cancelled) setData(res);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Couldn't reach BuilderMatch just now.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="pb-16">
      <PageHeader
        eyebrow="COLLABORATE · BUILDERMATCH"
        title="Find collaborators"
        description="Builders whose strengths cover your gaps — ranked on what they have shipped and which ecosystems you share, not on how similar your profiles look."
      />

      {error && (
        <p
          role="alert"
          className="mt-8 rounded-sm border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {/*
        The API's own explanation of what it could and could not do. It is
        written to be read by a person — an empty pool, a thin profile and a
        non-semantic embedding provider are three very different reasons for a
        short list, and collapsing them into "no results" would hide the one the
        builder can actually fix.
      */}
      {data && (data.coldStart || data.collaborators.length === 0) && (
        <div className="mt-8 rounded-sm border border-line/25 bg-ink-2/40 px-5 py-8">
          <p className="max-w-xl text-[13px] leading-relaxed text-paper-dim">
            {data.note}
          </p>
          <a
            href="/console/profile"
            className="mt-5 inline-block rounded-sm bg-brass px-5 py-2.5 font-display text-[13px] font-semibold text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
          >
            Complete your profile
          </a>
        </div>
      )}

      {data && data.collaborators.length > 0 && (
        <>
          <p className="mt-8 text-[12px] text-paper-dim/60">
            {data.collaborators.length} of {data.poolSize}{" "}
            {data.poolSize === 1 ? "builder" : "builders"} with a complete
            profile
            {data.embeddingProvider === "local" && (
              <span>
                {" "}
                · ranked on a local keyword vector rather than a semantic model,
                so treat the ordering as a rough signal
              </span>
            )}
          </p>

          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {data.collaborators.map((c, i) => (
              <CollaboratorCard key={c.builderProfileId} c={c} index={i} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function CollaboratorCard({ c, index }: { c: Collaborator; index: number }) {
  const name = c.githubUsername ?? `Builder ${c.builderProfileId.slice(0, 6)}`;

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.35 }}
      className="rounded-sm border border-line/25 bg-ink-2/50 p-5"
    >
      <div className="flex items-start gap-3.5">
        <BuilderIdenticon seed={c.builderProfileId} size={40} />

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-[15px] font-semibold text-paper">
            {name}
          </h2>
          <p className="mt-0.5 text-[12px] text-paper-dim/60">
            {c.provenWork > 0
              ? `${c.provenWork} recorded ${c.provenWork === 1 ? "result" : "results"}`
              : "No recorded results yet"}
          </p>
        </div>

        <Score value={c.score} />
      </div>

      <p className="mt-3.5 text-[13px] leading-relaxed text-paper-dim">
        {c.rationale}
      </p>

      {c.bio && (
        <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-paper-dim/55">
          {c.bio}
        </p>
      )}

      <div className="mt-4 space-y-2">
        <ChipRow label="You both work on" items={c.reasons.sharedChains} />
        <ChipRow label="They bring" items={c.reasons.bringsSkills} tone="brass" />
      </div>

      {c.githubUsername && (
        <a
          href={`https://github.com/${c.githubUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-sm border border-line/30 px-4 py-2 text-[12px] text-paper-dim transition-colors hover:border-brass/50 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
        >
          Reach out on GitHub ↗
        </a>
      )}
    </motion.li>
  );
}

/**
 * The composite, as a number and a bar.
 *
 * No ring, no gradient. The bar is there so a column of cards can be scanned
 * without reading six two-digit numbers, and the number is there because a bar
 * alone cannot be quoted.
 */
function Score({ value }: { value: number }) {
  return (
    <div className="shrink-0 text-right">
      <p className="font-display text-lg font-semibold tabular-nums text-paper">
        {Math.round(value)}
      </p>
      <div
        className="mt-1 h-[3px] w-14 overflow-hidden rounded-full bg-line/20"
        role="img"
        aria-label={`Match score ${Math.round(value)} out of 100`}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="h-full bg-brass-bright"
        />
      </div>
    </div>
  );
}

/**
 * Tone is a Tailwind class pair rather than an inline style on purpose.
 * `borderColor: \`${cssVar}44\`` — concatenating an alpha suffix onto a
 * `var(...)` — produces a string the CSS parser rejects outright, so the
 * declaration is dropped and the element silently keeps its inherited border.
 * It looks like it works because there is usually a border there already.
 */
function ChipRow({
  label,
  items,
  tone = "line",
}: {
  label: string;
  items: string[];
  tone?: "line" | "brass";
}) {
  if (items.length === 0) return null;

  const chip =
    tone === "brass"
      ? "border-brass-bright/35 text-brass-bright"
      : "border-line/35 text-line-bright";

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
      <span className="text-[11px] text-paper-dim/45">{label}</span>
      {items.slice(0, 5).map((item) => (
        <span
          key={item}
          className={`rounded-sm border px-1.5 py-px text-[11px] ${chip}`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
