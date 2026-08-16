"use client";

import { motion } from "framer-motion";

/**
 * Shared console page header.
 *
 * Every console page previously built its own heading block with slightly
 * different spacing, so the pages felt related rather than identical. One
 * component means the eyebrow, title, description and status strip land in
 * exactly the same place on every screen — which is most of what makes an
 * interface feel considered.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  status,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  status?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="relative border-b border-line/15 pb-6 pt-10">
      {/* Corner tick — carries the drafting-sheet language into the console */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-6 h-2.5 w-2.5 border-l border-t border-brass/40"
      />

      <div className="flex flex-wrap items-start justify-between gap-4 pl-5">
        <div className="min-w-0 flex-1">
          <motion.p
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="font-mono text-[10px] tracking-[0.3em] text-line-bright"
          >
            {eyebrow}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mt-2.5 font-display text-[28px] font-semibold leading-tight tracking-tight text-paper md:text-4xl"
          >
            {title}
          </motion.h1>

          {description && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.5 }}
              className="mt-3 max-w-2xl text-sm leading-relaxed text-paper-dim"
            >
              {description}
            </motion.p>
          )}
        </div>

        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      {status && <div className="mt-5 pl-5">{status}</div>}
    </header>
  );
}
