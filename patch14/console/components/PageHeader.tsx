"use client";

import { motion } from "framer-motion";

/**
 * Console page header.
 *
 * The ornament on the left is a small schematic figure — a bracket, a
 * vertical rule and three plotted nodes — rather than a decorative shape. It
 * echoes the drafting language of the marketing site without repeating the
 * hero's radial burst, so the console reads as the same product in its
 * working state rather than a second copy of the landing page.
 *
 * Everything is laid out on one grid with the ornament in its own column, so
 * the eyebrow, title and description align on a single left edge regardless
 * of viewport.
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
    <header className="relative border-b border-line/15 pb-7 pt-12">
      <div className="grid grid-cols-[28px_1fr] gap-x-5 md:grid-cols-[44px_1fr] md:gap-x-7">
        <Ornament />

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="font-mono text-[10px] tracking-[0.32em] text-line-bright"
              >
                {eyebrow}
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.06,
                  duration: 0.55,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="mt-3 font-display text-[30px] font-semibold leading-[1.05] tracking-tight text-paper md:text-[42px]"
              >
                {title}
              </motion.h1>

              {description && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.14, duration: 0.5 }}
                  className="mt-4 max-w-xl text-[13px] leading-relaxed text-paper-dim md:text-sm"
                >
                  {description}
                </motion.p>
              )}
            </div>

            {actions && <div className="shrink-0">{actions}</div>}
          </div>

          {status && <div className="mt-6">{status}</div>}
        </div>
      </div>
    </header>
  );
}

/** Schematic side figure: bracket, rule, and three plotted nodes. */
function Ornament() {
  return (
    <div aria-hidden="true" className="relative">
      <svg
        viewBox="0 0 44 150"
        preserveAspectRatio="xMidYMin meet"
        className="h-[150px] w-full"
      >
        {/* Top bracket */}
        <motion.path
          d="M2 2 H14 M2 2 V14"
          stroke="var(--color-brass)"
          strokeWidth="1.25"
          strokeOpacity="0.7"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Vertical rule */}
        <motion.line
          x1="2"
          y1="20"
          x2="2"
          y2="132"
          stroke="var(--color-line)"
          strokeOpacity="0.35"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Plotted nodes with tick marks */}
        {[
          { y: 40, r: 2.6, color: "var(--color-brass-bright)", w: 12 },
          { y: 76, r: 1.8, color: "var(--color-line-bright)", w: 8 },
          { y: 112, r: 1.8, color: "var(--color-line)", w: 6 },
        ].map((node, i) => (
          <motion.g
            key={node.y}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 + i * 0.12, duration: 0.4 }}
          >
            <line
              x1="2"
              y1={node.y}
              x2={2 + node.w}
              y2={node.y}
              stroke={node.color}
              strokeOpacity="0.4"
              strokeWidth="1"
            />
            <circle cx="2" cy={node.y} r={node.r} fill={node.color} />
          </motion.g>
        ))}

        {/* Bottom bracket */}
        <motion.path
          d="M2 138 V148 M2 148 H12"
          stroke="var(--color-line)"
          strokeOpacity="0.4"
          strokeWidth="1.25"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        />
      </svg>
    </div>
  );
}
