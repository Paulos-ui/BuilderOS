"use client";

import { useMemo } from "react";

/**
 * A deterministic visual identity, derived rather than chosen.
 *
 * Why not an avatar picker or an upload: both are generic, and an upload
 * brings storage, cropping UI and moderation for very little return. Here the
 * mark is a pure function of the builder's address — the same address always
 * produces the same figure, nobody chooses anything, and the identity is
 * *derived from* the thing that already identifies them. For a product about
 * portable reputation, that is the honest relationship.
 *
 * Construction: a 32-bit FNV-1a hash of the seed drives a hexagonal node
 * ring (echoing the BuilderOS mark), the number of lit vertices, an inner
 * rotation, and an accent drawn from the existing palette. Deliberately
 * geometric — it has to sit beside technical readouts without looking like
 * a cartoon.
 */

const ACCENTS = [
  "var(--color-brass-bright)",
  "var(--color-signal-bright)",
  "var(--color-line-bright)",
];

function hash32(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export default function BuilderIdenticon({
  seed,
  size = 64,
  className = "",
}: {
  seed: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const figure = useMemo(() => {
    const source = (seed ?? "builderos").toLowerCase();
    const h = hash32(source);

    // Distinct bit ranges so the traits vary independently.
    const accent = ACCENTS[h % ACCENTS.length];
    const litCount = 2 + ((h >> 4) % 4); // 2–5 lit vertices
    const rotation = (h >> 8) % 60;
    const innerRings = 1 + ((h >> 12) % 3);
    const litMask = (h >> 16) % 64;

    const vertices = Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      return {
        x: 32 + Math.cos(angle) * 20,
        y: 32 + Math.sin(angle) * 20,
        lit: ((litMask >> i) & 1) === 1 && i < litCount + 2,
      };
    });

    return { accent, vertices, rotation, innerRings };
  }, [seed]);

  const points = figure.vertices
    .map((v) => `${v.x.toFixed(2)},${v.y.toFixed(2)}`)
    .join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Builder identity mark"
      className={`shrink-0 ${className}`}
    >
      <rect
        width="64"
        height="64"
        rx="2"
        fill="var(--color-ink)"
        stroke="var(--color-line)"
        strokeOpacity="0.3"
      />

      <g transform={`rotate(${figure.rotation} 32 32)`}>
        {/* Concentric construction rings */}
        {Array.from({ length: figure.innerRings }).map((_, i) => (
          <circle
            key={i}
            cx="32"
            cy="32"
            r={6 + i * 5}
            stroke="var(--color-line)"
            strokeOpacity="0.25"
            strokeWidth="0.75"
          />
        ))}

        <polygon
          points={points}
          stroke="var(--color-line-bright)"
          strokeOpacity="0.55"
          strokeWidth="1"
          fill="none"
        />

        {figure.vertices.map((v, i) => (
          <g key={i}>
            {v.lit && (
              <line
                x1="32"
                y1="32"
                x2={v.x}
                y2={v.y}
                stroke={figure.accent}
                strokeOpacity="0.4"
                strokeWidth="0.75"
              />
            )}
            <circle
              cx={v.x}
              cy={v.y}
              r={v.lit ? 2.6 : 1.4}
              fill={v.lit ? figure.accent : "var(--color-line)"}
              fillOpacity={v.lit ? 1 : 0.45}
            />
          </g>
        ))}

        <circle cx="32" cy="32" r="2" fill={figure.accent} />
      </g>
    </svg>
  );
}
