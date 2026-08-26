"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useState } from "react";
import { BuilderOsLogo } from "./BuilderOsLogo";
import BuilderIdenticon from "./BuilderIdenticon";
import { useAuth } from "@/lib/auth-context";

/**
 * Console navigation.
 *
 * A flat row of six tabs is a list, not a navigation system — it gives no
 * sense of what belongs together or where you are in a workflow. Grouping
 * into WORK (the things you do, in pipeline order) and ACCOUNT (everything
 * else) means the sidebar teaches the product's shape just by being read
 * top to bottom.
 *
 * On mobile it collapses to a drawer rather than compressing the same rail,
 * because a 200px sidebar on a 375px screen leaves no room for the work.
 */

const GROUPS = [
  {
    label: "WORK",
    items: [
      { href: "/console", label: "Agents", hint: "Your agent system" },
      { href: "/console/opportunities", label: "Discover", hint: "Find funding" },
      { href: "/console/apply", label: "Review", hint: "Strengthen a draft" },
      { href: "/console/track", label: "Track", hint: "Deadlines and progress" },
      { href: "/console/proof", label: "Proof", hint: "What you've completed" },
    ],
  },
  {
    label: "ACCOUNT",
    items: [{ href: "/console/profile", label: "Profile", hint: "Sign-in and settings" }],
  },
];

export default function ConsoleSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line/25 bg-ink-2/90 px-5 py-3 backdrop-blur-md lg:hidden">
        <Link href="/console">
          <BuilderOsLogo />
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-line/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
        >
          <span className="flex w-4 flex-col gap-[3px]" aria-hidden="true">
            <motion.span className="block h-px w-full bg-paper" animate={{ rotate: open ? 45 : 0, y: open ? 4 : 0 }} />
            <motion.span className="block h-px w-full bg-paper" animate={{ opacity: open ? 0 : 1 }} />
            <motion.span className="block h-px w-full bg-paper" animate={{ rotate: open ? -45 : 0, y: open ? -4 : 0 }} />
          </span>
        </button>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="overflow-hidden border-b border-line/20 bg-ink-2/95 lg:hidden"
        >
          <Rail onNavigate={() => setOpen(false)} compact />
        </motion.div>
      )}

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-line/20 bg-ink-2/40 lg:flex">
        <div className="border-b border-line/15 px-5 py-5">
          <Link
            href="/console"
            className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
          >
            <BuilderOsLogo />
          </Link>
        </div>
        <Rail />
        <AccountFooter />
      </aside>
    </>
  );
}

function Rail({
  onNavigate,
  compact,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Console"
      className={`flex-1 overflow-y-auto px-3 ${compact ? "py-4" : "py-5"}`}
    >
      {GROUPS.map((group) => (
        <div key={group.label} className="mb-6">
          <p className="px-2 pb-2 font-mono text-[9px] tracking-[0.28em] text-paper-dim/40">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                item.href === "/console"
                  ? pathname === "/console"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex flex-col rounded-sm px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-bright ${
                      active
                        ? "bg-brass/10 text-paper"
                        : "text-paper-dim hover:bg-line/5 hover:text-paper"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="rail-active"
                        className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-brass-bright"
                      />
                    )}
                    <span className="font-display text-[13px] font-medium">
                      {item.label}
                    </span>
                    <span className="mt-0.5 font-mono text-[9px] tracking-wide text-paper-dim/45">
                      {item.hint}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function AccountFooter() {
  const { profile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  const identity =
    profile.user?.email ??
    (profile.user?.walletAddress
      ? `${profile.user.walletAddress.slice(0, 6)}…${profile.user.walletAddress.slice(-4)}`
      : "Builder");

  return (
    <div className="border-t border-line/15 px-4 py-4">
      <div className="flex items-center gap-2.5">
        <BuilderIdenticon
          seed={profile.user?.walletAddress ?? profile.id}
          size={28}
        />
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-paper-dim">
          {identity}
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
        className="mt-3 w-full cursor-pointer rounded-sm border border-line/25 py-1.5 font-mono text-[9px] tracking-widest text-paper-dim/60 transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright disabled:opacity-50"
      >
        {busy ? "SIGNING OUT…" : "SIGN OUT"}
      </button>
    </div>
  );
}
