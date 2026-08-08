"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const ROLES = [
  { value: "developer", label: "Developer" },
  { value: "founder", label: "Founder" },
  { value: "researcher", label: "Researcher" },
  { value: "designer", label: "Designer" },
  { value: "creator", label: "Creator" },
  { value: "other", label: "Other" },
];

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; alreadyJoined: boolean }
  | { kind: "error"; message: string };

export default function CTAFooter() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start 0.3"],
  });
  const stampScale = useTransform(scrollYProgress, [0, 1], [1.8, 1]);
  const stampOpacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const stampRotate = useTransform(scrollYProgress, [0, 1], [-12, 0]);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [ecosystem, setEcosystem] = useState("");
  const [goal, setGoal] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "submitting") return;

    if (!email.trim()) {
      setState({ kind: "error", message: "Enter your email address." });
      return;
    }

    // Fail loudly rather than pretending to succeed. A form that shows a
    // green tick while dropping the address on the floor is worse than one
    // that admits it isn't wired up.
    if (!API_URL) {
      setState({
        kind: "error",
        message:
          "Signups aren't connected yet. Reach out on GitHub and we'll add you manually.",
      });
      return;
    }

    setState({ kind: "submitting" });

    try {
      const res = await fetch(`${API_URL}/v1/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          role: role || undefined,
          ecosystem: ecosystem.trim() || undefined,
          goal: goal.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string | string[];
        } | null;
        const detail = Array.isArray(body?.message)
          ? body.message[0]
          : body?.message;
        setState({
          kind: "error",
          message: detail ?? `Something went wrong (${res.status}). Try again.`,
        });
        return;
      }

      const data = (await res.json()) as { status: string };
      setState({
        kind: "success",
        alreadyJoined: data.status === "already_joined",
      });
    } catch {
      setState({
        kind: "error",
        message: "Couldn't reach the server. Check your connection and retry.",
      });
    }
  }

  return (
    <section
      id="cta"
      ref={ref}
      className="relative flex min-h-screen flex-col justify-center px-6 py-24"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <motion.div
          style={{ scale: stampScale, opacity: stampOpacity, rotate: stampRotate }}
          className="mb-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-brass-bright"
          aria-hidden="true"
        >
          <span className="font-mono text-[10px] tracking-widest text-brass-bright">
            SPEC
            <br />
            001
          </span>
        </motion.div>

        <p className="font-mono text-xs tracking-[0.25em] text-line-bright">
          06 · JOIN THE BUILD
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold leading-tight text-paper sm:text-5xl">
          Stop searching. Start building.
        </h2>
        <p className="mt-5 max-w-lg text-balance font-body text-lg text-paper-dim">
          Join the BuilderOS private beta and help shape a coordinated system
          for discovering opportunities, completing meaningful work and
          building reputation.
        </p>

        {state.kind === "success" ? (
          <div
            role="status"
            className="mt-10 w-full max-w-md rounded-sm border border-signal/40 bg-signal/10 px-6 py-5 text-left"
          >
            <p className="font-mono text-sm text-signal-bright">
              {state.alreadyJoined
                ? "You're already on the list."
                : "You're on the list."}
            </p>
            <p className="mt-2 text-sm text-paper-dim">
              We&apos;re inviting builders in small batches. You&apos;ll hear
              from us at {email}.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-10 w-full max-w-md text-left"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="wl-name" optional>
                <input
                  id="wl-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Email" htmlFor="wl-email">
                <input
                  id="wl-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@builder.dev"
                  className={inputClass}
                />
              </Field>

              <Field label="Builder role" htmlFor="wl-role" optional>
                <select
                  id="wl-role"
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select…</option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Primary ecosystem" htmlFor="wl-eco" optional>
                <input
                  id="wl-eco"
                  name="ecosystem"
                  type="text"
                  value={ecosystem}
                  onChange={(e) => setEcosystem(e.target.value)}
                  placeholder="GOAT, Base, Solana…"
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field
                label="What do you want BuilderOS to help you achieve?"
                htmlFor="wl-goal"
                optional
              >
                <textarea
                  id="wl-goal"
                  name="goal"
                  rows={3}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className={`${inputClass} resize-none`}
                />
              </Field>
            </div>

            {state.kind === "error" && (
              <p
                role="alert"
                className="mt-4 rounded-sm border border-danger/50 bg-danger/10 px-3 py-2 font-mono text-xs text-danger"
              >
                {state.message}
              </p>
            )}

            <button
              type="submit"
              disabled={state.kind === "submitting"}
              className="mt-5 w-full cursor-pointer rounded-sm bg-brass px-6 py-3 font-mono text-sm tracking-wide text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright disabled:cursor-wait disabled:opacity-60"
            >
              {state.kind === "submitting"
                ? "Submitting…"
                : "Join the private beta"}
            </button>

            <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-wide text-paper-dim/60">
              We use your email only to contact you about the beta. No
              newsletters, no sharing with third parties.
            </p>
          </form>
        )}

        <p className="mt-6 flex items-center gap-2 font-mono text-[11px] tracking-widest text-paper-dim/50">
          <span className="h-1.5 w-1.5 rounded-full bg-line" aria-hidden="true" />
          WALLET SIGN-IN ARRIVES WITH THE BETA
        </p>
      </div>

      <footer className="mx-auto mt-32 w-full max-w-6xl border-t border-line/20 pt-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-display text-sm font-semibold text-paper">
              BuilderOS
            </p>
            <p className="mt-1 font-mono text-[10px] tracking-widest text-paper-dim/60">
              BY GOAT ECOSYSTEM
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] tracking-widest text-paper-dim/70">
              <li><a href="#pipeline" className="hover:text-paper">SYSTEM</a></li>
              <li><a href="#constellation" className="hover:text-paper">AGENTS</a></li>
              <li><a href="#opportunities" className="hover:text-paper">OPPORTUNITIES</a></li>
              <li><a href="#reputation" className="hover:text-paper">REPUTATION</a></li>
              <li><a href="#docs" className="hover:text-paper">DOCS</a></li>
              <li><a href="#cta" className="hover:text-paper">PRIVATE BETA</a></li>
            </ul>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 font-mono text-[10px] tracking-widest text-paper-dim/45 sm:flex-row sm:justify-between">
          <span className="flex items-center gap-2">
            BUILDER NETWORK / STATUS
            <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
            ACTIVE
          </span>
          <span>© {new Date().getFullYear()} GOAT ECOSYSTEM</span>
        </div>
      </footer>
    </section>
  );
}

const inputClass =
  "w-full rounded-sm border border-line/40 bg-ink-2/60 px-3 py-2.5 font-mono text-sm text-paper placeholder:text-paper-dim/40 focus:border-brass-bright focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright";

function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block font-mono text-[10px] tracking-widest text-paper-dim/70"
      >
        {label.toUpperCase()}
        {optional && <span className="ml-1 text-paper-dim/40">(OPTIONAL)</span>}
      </label>
      {children}
    </div>
  );
}
