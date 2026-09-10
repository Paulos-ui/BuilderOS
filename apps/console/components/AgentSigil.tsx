/**
 * Six hand-drawn marks, one per agent.
 *
 * ── Why these are drawn and not imported ──────────────────────────────────
 *
 * The obvious move was six PNGs or a Lucide icon each. Both were rejected. A
 * generic icon set makes six different capabilities look like six rows of the
 * same settings menu, and the four ERC-8004 registrations already point at
 * `/agents/<key>.png` files that do not exist — so something had to be authored
 * either way. Drawing them here means they inherit the page's own colour
 * system, scale without artefacts, cost zero kilobytes of network, and can
 * carry live data (see `registered` below), which no static asset can.
 *
 * ── What makes them a family ──────────────────────────────────────────────
 *
 * Every sigil shares the same 48×48 frame, the same four corner registration
 * ticks, the same stroke weights, and the same bottom-centre anchor mark. That
 * shared chassis is what makes the rack read as one instrument rather than six
 * unrelated tiles — which was the actual complaint. The mark inside the frame is
 * the only thing that changes, and each one is a drawing of what its agent
 * physically does: a sweep that searches, a press that compresses a draft, a
 * rail of uneven deadlines, two shapes that interlock, a seal accruing, bars
 * collapsing onto a settlement line.
 *
 * ── The anchor mark carries real state ────────────────────────────────────
 *
 * The mark at the bottom edge is not decoration. Two brass bars means this
 * agent has an ERC-8004 identity on GOAT; one dashed line means it does not.
 * That is the same fact the rack states in words, drawn, and it keeps the sigil
 * honest at a glance instead of making every agent look equally blessed.
 *
 * ── Motion ────────────────────────────────────────────────────────────────
 *
 * Follows the rule in docs/DESIGN.md: provisional things drift, settled things
 * are still. Motion is opt-in via `animate`, every duration is long enough to
 * read as an instrument rather than a spinner, and all of it collapses under
 * `prefers-reduced-motion` via the global rule in globals.css. The keyframes
 * live in globals.css rather than pulling an animation library in for six marks.
 */

export type AgentKey = 'scout' | 'forge' | 'flow' | 'match' | 'rep' | 'pay';

export interface AgentSigilProps {
  agent: AgentKey;
  /** Rendered edge length in px. The drawing is resolution-independent. */
  size?: number;
  /** Draws the on-chain anchor as two brass bars instead of one dashed line. */
  registered?: boolean;
  /**
   * Enable the mark's one moving element. Off by default — a rack of six
   * animating sigils is noise. Turn it on for the selected or hovered card.
   */
  animate?: boolean;
  /**
   * Accessible name. Omit for the normal case, where the sigil sits beside the
   * agent's name in text and repeating it would just make a screen reader say
   * everything twice.
   */
  title?: string;
  className?: string;
}

/** Corner registration ticks — the shared chassis, on all six. */
function Frame() {
  return (
    <g stroke="currentColor" strokeWidth={1} opacity={0.28} fill="none">
      <path d="M4 10V4h6" />
      <path d="M38 4h6v6" />
      <path d="M4 38v6h6" />
      <path d="M44 38v6h-6" />
    </g>
  );
}

/**
 * Bottom-centre anchor. Two brass bars = registered on GOAT; one dashed line =
 * not. Deliberately reads as weaker rather than absent, because "no on-chain
 * identity yet" is a real state and not a missing feature.
 */
function Anchor({ registered }: { registered: boolean }) {
  if (registered) {
    return (
      <g stroke="var(--color-brass)" strokeWidth={1.4} fill="none">
        <path d="M19 42h10" />
        <path d="M21 45h6" />
      </g>
    );
  }
  return (
    <path
      d="M19 43.5h10"
      stroke="currentColor"
      strokeWidth={1}
      strokeDasharray="2 2"
      opacity={0.3}
      fill="none"
    />
  );
}

/**
 * AG-01 BuilderScout — a radial sweep.
 * Three range arcs and a rotating bearing line: the shape of looking for
 * something. The brass square on the middle arc is a contact — a matched
 * opportunity — which is why it is the one warm element.
 */
function ScoutMark({ animate }: { animate: boolean }) {
  return (
    <g fill="none">
      <g stroke="currentColor" strokeWidth={1} opacity={0.35}>
        <path d="M27.9 19.4a6 6 0 0 1 0 9.2" />
        <path d="M31.1 15.6a11 11 0 0 1 0 16.8" />
        <path d="M33.6 12.5a15 15 0 0 1 0 23" />
      </g>
      <g className={animate ? 'sigil-sweep' : undefined}>
        <path d="M24 24h14" stroke="currentColor" strokeWidth={1.4} />
      </g>
      <circle cx={24} cy={24} r={1.6} fill="currentColor" stroke="none" />
      <rect
        x={32.9}
        y={18.3}
        width={2.4}
        height={2.4}
        fill="var(--color-brass)"
        stroke="none"
      />
    </g>
  );
}

/**
 * AG-02 ProofForge — a press over an anvil.
 * A ram bearing down on a stack that widens as it compresses, and the brass bar
 * under the face is the output: a scored, evidenced draft.
 */
function ForgeMark({ animate }: { animate: boolean }) {
  return (
    <g fill="none">
      <g className={animate ? 'sigil-press' : undefined} stroke="currentColor">
        <path d="M17 11h14" strokeWidth={1.5} />
        <path d="M21 11v3.5M27 11v3.5" strokeWidth={1} opacity={0.6} />
      </g>
      <g stroke="currentColor" strokeWidth={1} opacity={0.55}>
        <path d="M19 18h10" />
        <path d="M17 22h14" />
        <path d="M15 26h18" />
      </g>
      <path d="M12 30h24" stroke="currentColor" strokeWidth={1.6} />
      <path d="M20 30v4M28 30v4" stroke="currentColor" strokeWidth={1} opacity={0.35} />
      <path d="M21 36h6" stroke="var(--color-brass)" strokeWidth={1.8} />
    </g>
  );
}

/**
 * AG-03 BuilderFlow — a deadline rail.
 * Uneven ticks because real programme deadlines are uneven; the tall brass one
 * is whatever is next. Sage ticks below the rail are submissions already made.
 * The travelling marker is the agent walking the timeline.
 */
function FlowMark({ animate }: { animate: boolean }) {
  return (
    <g fill="none">
      <path d="M10 26h28" stroke="currentColor" strokeWidth={1} opacity={0.4} />
      <g stroke="currentColor" strokeWidth={1.2} opacity={0.6}>
        <path d="M13 26v-4" />
        <path d="M18 26v-7" />
        <path d="M23 26v-3" />
        <path d="M34 26v-5" />
      </g>
      <path d="M29 26v-9" stroke="var(--color-brass)" strokeWidth={1.4} />
      <g stroke="var(--color-signal)" strokeWidth={1.2}>
        <path d="M13 26v3" />
        <path d="M18 26v3" />
      </g>
      <g className={animate ? 'sigil-travel' : undefined}>
        <rect
          x={9}
          y={24.5}
          width={3}
          height={3}
          fill="currentColor"
          stroke="none"
        />
      </g>
    </g>
  );
}

/**
 * AG-04 BuilderMatch — two forms that interlock.
 * A socket and a tooth, not two copies of the same shape. That is the whole
 * argument of the agent drawn: it ranks builders on complementary strengths, so
 * a mark showing two identical halves would state the opposite. The brass node
 * is where they meet.
 */
function MatchMark({ animate }: { animate: boolean }) {
  return (
    <g fill="none">
      <g stroke="currentColor" strokeWidth={1} opacity={0.3}>
        <path d="M12 17v14" />
        <path d="M36 17v14" />
      </g>
      <path
        d="M17 14l7 10-7 10"
        stroke="currentColor"
        strokeWidth={1.5}
        opacity={0.5}
      />
      <g className={animate ? 'sigil-seat' : undefined}>
        <path d="M26 17l5 7-5 7" stroke="currentColor" strokeWidth={1.6} />
      </g>
      <circle
        cx={24.8}
        cy={24}
        r={1.7}
        fill="var(--color-brass)"
        stroke="none"
      />
    </g>
  );
}

/**
 * AG-05 BuilderRep — a seal, still accruing.
 * The outer ring is dashed and turns slowly: reputation in progress, and drift
 * is how this system says provisional. The stack of chevrons inside is evidence
 * accumulating. The brass index notch at twelve o'clock is the seal's origin —
 * where a credential would be struck.
 */
function RepMark({ animate }: { animate: boolean }) {
  return (
    <g fill="none">
      <g className={animate ? 'sigil-ring' : undefined}>
        <circle
          cx={24}
          cy={24}
          r={15}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="3 4"
          opacity={0.4}
        />
      </g>
      <circle cx={24} cy={24} r={10} stroke="currentColor" strokeWidth={1.2} />
      <path d="M24 14v-4" stroke="var(--color-brass)" strokeWidth={1.4} />
      <path d="M18.5 26.5L24 20l5.5 6.5" stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M20.5 30.5L24 26.5l3.5 4"
        stroke="currentColor"
        strokeWidth={1.2}
        opacity={0.45}
      />
    </g>
  );
}

/**
 * AG-06 BuilderPay — bars collapsing onto a settlement line.
 * Three metered calls of different sizes above the line, one consolidated brass
 * bar below it. The gap between the bars and the line is intentional and it is
 * the honest part: BuilderPay verifies authorizations but does not broadcast
 * them, so value is authorized and waiting, not moved.
 */
function PayMark({ animate }: { animate: boolean }) {
  return (
    <g fill="none">
      <g stroke="currentColor" strokeWidth={2}>
        <path
          d="M16 14v14.5"
          className={animate ? 'sigil-settle' : undefined}
          opacity={animate ? undefined : 0.75}
        />
        <path
          d="M24 18v10.5"
          className={animate ? 'sigil-settle sigil-settle-2' : undefined}
          opacity={animate ? undefined : 0.75}
        />
        <path
          d="M32 22v6.5"
          className={animate ? 'sigil-settle sigil-settle-3' : undefined}
          opacity={animate ? undefined : 0.75}
        />
      </g>
      <path d="M10 31h28" stroke="currentColor" strokeWidth={1.6} />
      <path d="M18 35h12" stroke="var(--color-brass)" strokeWidth={2} />
    </g>
  );
}

const MARKS: Record<
  AgentKey,
  (props: { animate: boolean }) => React.JSX.Element
> = {
  scout: ScoutMark,
  forge: ForgeMark,
  flow: FlowMark,
  match: MatchMark,
  rep: RepMark,
  pay: PayMark,
};

export function AgentSigil({
  agent,
  size = 48,
  registered = false,
  animate = false,
  title,
  className,
}: AgentSigilProps) {
  const Mark = MARKS[agent];
  // A missing key should not blank a card silently. The frame alone still reads
  // as "an agent slot", which is a better failure than empty space.
  const labelled = Boolean(title);

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      // strokes are described in a 48-unit space; without this they thin out at
      // small sizes and go fat when a card scales the sigil up.
      vectorEffect="non-scaling-stroke"
      role={labelled ? 'img' : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {labelled ? <title>{title}</title> : null}
      <Frame />
      {Mark ? <Mark animate={animate} /> : null}
      <Anchor registered={registered} />
    </svg>
  );
}

export default AgentSigil;
