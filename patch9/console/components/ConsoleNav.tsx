"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BuilderOsLogo } from "./BuilderOsLogo";
import { useAuth } from "@/lib/auth-context";

const TABS = [
  { href: "/console", label: "AGENT RACK" },
  { href: "/console/opportunities", label: "OPPORTUNITIES" },
  { href: "/console/profile", label: "PROFILE" },
];

/**
 * Console header: branding left, identity right, tabs beneath.
 *
 * Logo and session sit on one row so the eye reads "product, then who you
 * are" before dropping to navigation — the same hierarchy as the sign-in
 * page, which is what makes the two screens feel like one application.
 */
export default function ConsoleNav() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const identity =
    profile?.user?.email ??
    (profile?.user?.walletAddress
      ? `${profile.user.walletAddress.slice(0, 6)}…${profile.user.walletAddress.slice(-4)}`
      : null);

  const method = profile?.user?.email ? "EMAIL" : "WALLET";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 py-5">
        <Link
          href="/console"
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
        >
          <BuilderOsLogo />
        </Link>

        {identity && (
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-signal"
            />
            <span className="max-w-[180px] truncate text-paper sm:max-w-none">
              {identity}
            </span>
            <span className="hidden rounded-sm border border-line/30 px-1.5 py-px text-[9px] tracking-widest text-line-bright sm:inline">
              {method}
            </span>
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
              className="cursor-pointer text-[10px] tracking-widest text-paper-dim/60 underline underline-offset-4 transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright disabled:opacity-50"
            >
              {busy ? "SIGNING OUT…" : "SIGN OUT"}
            </button>
          </div>
        )}
      </div>

      <nav aria-label="Console sections" className="flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const active =
            tab.href === "/console"
              ? pathname === "/console"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`relative shrink-0 px-4 py-2.5 font-mono text-[11px] tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-bright ${
                active ? "text-paper" : "text-paper-dim/50 hover:text-paper-dim"
              }`}
            >
              {tab.label}
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-px bg-brass-bright" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
