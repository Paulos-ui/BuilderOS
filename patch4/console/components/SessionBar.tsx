"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

/** Shows who is actually signed in — real data from /v1/profiles/me. */
export default function SessionBar() {
  const { profile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  const identity =
    profile.user?.email ??
    (profile.user?.walletAddress
      ? `${profile.user.walletAddress.slice(0, 6)}…${profile.user.walletAddress.slice(-4)}`
      : "signed in");

  const method = profile.user?.email ? "EMAIL" : "WALLET";

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line/25 bg-ink-2/50 px-4 py-3">
      <div className="flex items-center gap-3 font-mono text-[11px]">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-signal"
        />
        <span className="tracking-widest text-paper-dim/60">SESSION</span>
        <span className="text-paper">{identity}</span>
        <span className="rounded-sm border border-line/30 px-1.5 py-px text-[9px] tracking-widest text-line-bright">
          {method}
        </span>
      </div>

      <button
        onClick={async () => {
          setBusy(true);
          try {
            await signOut();
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="cursor-pointer font-mono text-[10px] tracking-widest text-paper-dim/60 underline underline-offset-4 transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright disabled:opacity-50"
      >
        {busy ? "SIGNING OUT…" : "SIGN OUT"}
      </button>
    </div>
  );
}
