"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/console", label: "AGENT RACK" },
  { href: "/console/opportunities", label: "OPPORTUNITIES" },
];

export default function ConsoleNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Console sections" className="flex gap-1 border-b border-line/20">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative px-4 py-2.5 font-mono text-[11px] tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-bright ${
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
  );
}
