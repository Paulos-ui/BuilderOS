/**
 * BuilderOS logo.
 *
 * The mark is an original construction, not a borrowed one: a hexagonal
 * node ring (the coordinated agent system) with two horns rising from the
 * top vertices (a goat silhouette reduced to two strokes, reading as an
 * antenna at small sizes) around a negative-space "B" bar. It is drawn on
 * the same 24-unit grid as the rest of the blueprint system, so its stroke
 * weight matches the technical lines elsewhere on the page.
 *
 * Wordmark is styled "BUILDER OS" for lockup only. Written copy always
 * uses "BuilderOS".
 */
export function BuilderOsLogo({
  className = "",
  showAttribution = true,
}: {
  className?: string;
  showAttribution?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[15px] font-bold tracking-[0.06em]">
          <span className="text-paper">BUILDER</span>
          <span className="ml-[3px] text-brass-bright">OS</span>
        </span>
        {showAttribution && (
          <span className="mt-[3px] font-mono text-[8px] tracking-[0.16em] text-paper-dim/55">
            BY GOAT ECOSYSTEM
          </span>
        )}
      </span>
    </span>
  );
}

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="BuilderOS"
      className="shrink-0"
    >
      {/* Node ring — the coordinated system */}
      <path
        d="M12 3.2 19.1 7.3V15.5L12 19.6 4.9 15.5V7.3Z"
        stroke="var(--color-line-bright)"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {/* Horns — goat reduced to two strokes */}
      <path
        d="M8.4 5.4 6.6 2.4M15.6 5.4 17.4 2.4"
        stroke="var(--color-line)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* B monogram bar */}
      <path
        d="M9.6 8.4h3.1a1.9 1.9 0 0 1 0 3.8H9.6m0 0h3.4a1.9 1.9 0 0 1 0 3.8H9.6V8.4Z"
        stroke="var(--color-paper)"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {/* Connection nodes at the vertices */}
      <circle cx="12" cy="3.2" r="1.3" fill="var(--color-brass-bright)" />
      <circle cx="19.1" cy="15.5" r="0.9" fill="var(--color-line-bright)" />
      <circle cx="4.9" cy="15.5" r="0.9" fill="var(--color-line-bright)" />
    </svg>
  );
}
