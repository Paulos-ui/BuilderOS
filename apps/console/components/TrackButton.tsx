"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

/**
 * Scout -> Flow handoff.
 *
 * Reports the already-tracked case distinctly from a fresh track, because
 * "you already have this" and "added" are different facts and silently
 * showing success for both teaches people the button does nothing.
 */
export default function TrackButton({
  opportunityId,
}: {
  opportunityId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<
    "idle" | "working" | "tracked" | "existing" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function track() {
    if (state === "working") return;
    setState("working");
    try {
      const res = await api<{ created: boolean }>(
        `/v1/handoff/track/${opportunityId}`,
        { method: "POST" },
      );
      setState(res.created ? "tracked" : "existing");
      router.refresh();
    } catch (err) {
      setState("error");
      setMessage(
        err instanceof ApiError ? err.message : "Couldn't track that.",
      );
    }
  }

  if (state === "tracked" || state === "existing") {
    return (
      <span className="flex items-center gap-2 font-mono text-xs tracking-wide text-signal-bright">
        <span aria-hidden="true">✓</span>
        {state === "tracked" ? "TRACKING" : "ALREADY TRACKED"}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-3">
      <button
        onClick={track}
        disabled={state === "working"}
        className="cursor-pointer rounded-sm bg-brass px-4 py-2 font-mono text-xs tracking-wide text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright disabled:opacity-60"
      >
        {state === "working" ? "TRACKING…" : "Track this"}
      </button>
      {message && (
        <span role="alert" className="font-mono text-[10px] text-danger">
          {message}
        </span>
      )}
    </span>
  );
}
