"use client";

import { motion } from "framer-motion";
import { CONSOLE_AGENTS } from "@/lib/agents";
import { RackModule } from "@/components/RackModule";
import { Odometer } from "@/components/Odometer";
import { SettlementTrack, SETTLEMENT_LEGEND } from "@/components/Settlement";

export default function ConsolePage() {
  const registered = CONSOLE_AGENTS.filter((a) => a.identity.agentId !== null);
  const totalAttestations = CONSOLE_AGENTS.reduce(
    (sum, a) => sum + (a.reputation?.count ?? 0),
    0,
  );

  return (
    <div className="relative min-h-screen bp-grid">
      <div className="relative mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-16">
        <Header
          registeredCount={registered.length}
          totalCount={CONSOLE_AGENTS.length}
          attestations={totalAttestations}
        />

        {/* The rack */}
        <div className="relative mt-8">
          <ScanSweep />
          <div className="relative space-y-2.5">
            {CONSOLE_AGENTS.map((agent, i) => (
              <div key={agent.key} className="relative">
                <RackModule agent={agent} index={i} />
                {agent.handoffTo && <PatchPulse delay={1.4 + i * 0.12} />}
              </div>
            ))}
          </div>
        </div>

        <SettlementLegend />

        <p className="mt-8 font-mono text-[10px] leading-relaxed tracking-widest text-paper-dim/45">
          READINGS SOURCED FROM ERC-8004 IDENTITY + REPUTATION REGISTRIES ON
          GOAT NETWORK.
          <br />
          SELECT A MODULE TO INSPECT ITS REGISTRY RECORD.
        </p>
      </div>
    </div>
  );
}

function Header({
  registeredCount,
  totalCount,
  attestations,
}: {
  registeredCount: number;
  totalCount: number;
  attestations: number;
}) {
  return (
    <header>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-line-bright"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-signal" />
        BUILDEROS://AGENT-CONSOLE
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="mt-3 font-display text-3xl font-semibold tracking-tight text-paper md:text-4xl"
      >
        Agent rack
      </motion.h1>

      <div className="mt-6 grid grid-cols-3 gap-3 border-y border-line/20 py-4">
        <Stat label="REGISTERED" value={registeredCount} suffix={`/ ${totalCount}`} delay={0.5} />
        <Stat label="ATTESTATIONS" value={attestations} delay={0.62} />
        <Stat label="CHAIN" text="GOAT testnet3" delay={0.74} />
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  text,
  suffix,
  delay = 0,
}: {
  label: string;
  value?: number;
  text?: string;
  suffix?: string;
  delay?: number;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-widest text-paper-dim/50">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold text-paper">
        {value !== undefined ? <Odometer value={value} delay={delay} /> : null}
        {text ? <span className="text-brass-bright">{text}</span> : null}
        {suffix ? (
          <span className="ml-1 font-mono text-sm text-paper-dim/50">{suffix}</span>
        ) : null}
      </p>
    </div>
  );
}

/**
 * A periodic horizontal refresh line travelling down the rack — the visual
 * language of an instrument re-reading its inputs. Slow and low-contrast on
 * purpose: it should register peripherally, never compete with the data.
 */
function ScanSweep() {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-10 h-px"
      style={{
        background:
          "linear-gradient(to right, transparent, var(--color-line-bright), transparent)",
      }}
      initial={{ top: "0%", opacity: 0 }}
      animate={{ top: ["0%", "100%"], opacity: [0, 0.5, 0.5, 0] }}
      transition={{
        duration: 3.2,
        repeat: Infinity,
        repeatDelay: 5,
        ease: "linear",
        times: [0, 0.1, 0.9, 1],
      }}
    />
  );
}

/**
 * Patch cable between two modules that hand off to each other (Scout ->
 * Forge). A pulse physically travels the connector, so the data dependency
 * is legible rather than implied.
 */
function PatchPulse({ delay }: { delay: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-7 top-full z-10 h-2.5 w-px bg-line/40 md:left-9"
    >
      <motion.span
        className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-signal-bright"
        initial={{ top: "-20%", opacity: 0 }}
        animate={{ top: ["-20%", "120%"], opacity: [0, 1, 0] }}
        transition={{
          duration: 1.1,
          delay,
          repeat: Infinity,
          repeatDelay: 3.5,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

/**
 * Explains the two-phase settlement language in-product, so a first-time
 * viewer understands why some values drift and others are still — without
 * needing to have read the GOAT docs first.
 */
function SettlementLegend() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.1, duration: 0.5 }}
      className="mt-10 rounded-sm border border-line/20 bg-ink-2/40 p-5 md:p-6"
      aria-labelledby="settlement-legend-heading"
    >
      <h2
        id="settlement-legend-heading"
        className="font-mono text-[10px] tracking-widest text-paper-dim/60"
      >
        READING THE RACK — GOAT TWO-SPEED FINALITY
      </h2>
      <dl className="mt-4 grid gap-5 sm:grid-cols-2">
        {SETTLEMENT_LEGEND.map((item) => (
          <div key={item.phase}>
            <div className="flex items-center gap-3">
              <SettlementTrack phase={item.phase} showLabel={false} />
              <dt className="font-display text-sm font-semibold text-paper">
                {item.title}
              </dt>
            </div>
            <dd className="mt-1.5 text-[13px] leading-relaxed text-paper-dim">
              {item.body}
            </dd>
          </div>
        ))}
      </dl>
    </motion.section>
  );
}
