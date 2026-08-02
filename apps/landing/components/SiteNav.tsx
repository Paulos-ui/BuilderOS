"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { BuilderOsLogo } from "./BuilderOsLogo";

const NAV_LINKS = [
  { href: "#pipeline", label: "System" },
  { href: "#constellation", label: "Agents" },
  { href: "#opportunities", label: "Opportunities" },
  { href: "#reputation", label: "Reputation" },
  { href: "#docs", label: "Docs" },
] as const;

export default function SiteNav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));

  // Escape closes the menu and returns focus to the trigger, so keyboard
  // users are never stranded inside a closed panel.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll while the mobile panel is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleNavigate(href: string) {
    setOpen(false);
    // Lenis owns scrolling, so hand off to it when present — otherwise the
    // native jump fights the smooth-scroll loop.
    const lenis = (window as unknown as { __lenis?: { scrollTo: (t: string) => void } })
      .__lenis;
    if (lenis) lenis.scrollTo(href);
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-line/20 bg-ink/80 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 md:h-16 md:px-8">
        <a
          href="#hero"
          onClick={() => handleNavigate("#hero")}
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
        >
          <BuilderOsLogo />
        </a>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => handleNavigate(link.href)}
                  className="group relative block rounded-sm px-3 py-2 font-mono text-[11px] tracking-[0.12em] text-paper-dim transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                >
                  {link.label.toUpperCase()}
                  <span className="absolute inset-x-3 bottom-1 h-px origin-left scale-x-0 bg-brass-bright transition-transform duration-300 group-hover:scale-x-100" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#cta"
            onClick={() => handleNavigate("#cta")}
            className="hidden rounded-sm bg-brass px-4 py-2 font-mono text-[11px] tracking-[0.1em] text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright md:inline-block"
          >
            JOIN BETA
          </a>

          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav-panel"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-line/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright md:hidden"
          >
            <span className="flex w-4 flex-col gap-[3px]" aria-hidden="true">
              <motion.span
                className="block h-px w-full bg-paper"
                animate={{ rotate: open ? 45 : 0, y: open ? 4 : 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                className="block h-px w-full bg-paper"
                animate={{ opacity: open ? 0 : 1 }}
                transition={{ duration: 0.15 }}
              />
              <motion.span
                className="block h-px w-full bg-paper"
                animate={{ rotate: open ? -45 : 0, y: open ? -4 : 0 }}
                transition={{ duration: 0.2 }}
              />
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav-panel"
            ref={panelRef}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-line/20 bg-ink/95 backdrop-blur-md md:hidden"
          >
            <nav aria-label="Mobile" className="px-5 py-4">
              <ul className="flex flex-col">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => handleNavigate(link.href)}
                      className="block border-b border-line/10 py-3.5 font-mono text-xs tracking-[0.12em] text-paper-dim focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-bright"
                    >
                      {link.label.toUpperCase()}
                    </a>
                  </li>
                ))}
              </ul>
              <a
                href="#cta"
                onClick={() => handleNavigate("#cta")}
                className="mt-4 block rounded-sm bg-brass px-4 py-3 text-center font-mono text-xs tracking-[0.1em] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
              >
                JOIN BETA
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
