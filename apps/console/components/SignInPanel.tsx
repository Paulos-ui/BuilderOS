"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  requestMagicLink,
  walletChallenge,
  walletVerify,
  ApiError,
  isApiConfigured,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Mode = "email" | "wallet";

type State =
  | { kind: "idle" }
  | { kind: "working"; note: string }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function getInjectedProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  return eth ?? null;
}

export default function SignInPanel() {
  const { onSignedIn } = useAuth();
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const busy = state.kind === "working";

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!email.trim()) {
      setState({ kind: "error", message: "Enter your email address." });
      return;
    }
    setState({ kind: "working", note: "SENDING LINK" });
    try {
      await requestMagicLink(email.trim());
      setState({ kind: "sent", email: email.trim() });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof ApiError ? err.message : "Couldn't send the link.",
      });
    }
  }

  /**
   * Wallet sign-in over SIWE. Uses the injected provider directly rather
   * than pulling in a connector library — one dependency fewer, no
   * WalletConnect project ID to provision, and full control over the
   * styling. The trade-off is that it only reaches browser-extension
   * wallets; mobile deep-linking would need WalletConnect.
   */
  async function handleWallet() {
    if (busy) return;
    const provider = getInjectedProvider();
    if (!provider) {
      setState({
        kind: "error",
        message:
          "No browser wallet detected. Install MetaMask or use email sign-in.",
      });
      return;
    }

    try {
      setState({ kind: "working", note: "REQUESTING ACCOUNT" });
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error("No account was returned by the wallet.");

      setState({ kind: "working", note: "REQUESTING CHALLENGE" });
      const { message } = await walletChallenge(address);

      setState({ kind: "working", note: "AWAITING SIGNATURE" });
      const signature = (await provider.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;

      setState({ kind: "working", note: "VERIFYING" });
      await walletVerify(message, signature);
      await onSignedIn();
    } catch (err) {
      // 4001 is the EIP-1193 "user rejected" code. Declining to sign is a
      // deliberate choice, not a failure, so it shouldn't read like an error.
      const code = (err as { code?: number })?.code;
      if (code === 4001) {
        setState({ kind: "idle" });
        return;
      }
      setState({
        kind: "error",
        message:
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Wallet sign-in failed.",
      });
    }
  }

  if (!isApiConfigured()) {
    return (
      <Panel>
        <p className="font-mono text-xs leading-relaxed text-danger">
          NEXT_PUBLIC_API_URL isn&apos;t set, so sign-in can&apos;t reach the
          backend. Set it in your environment and redeploy.
        </p>
      </Panel>
    );
  }

  if (state.kind === "sent") {
    return (
      <Panel>
        <StatusDot color="var(--color-signal-bright)" />
        <h2 className="mt-4 font-display text-xl font-semibold text-paper">
          Check your inbox
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-paper-dim">
          A sign-in link is on its way to{" "}
          <span className="text-paper">{state.email}</span>. It expires in 15
          minutes and works once.
        </p>
        <button
          onClick={() => setState({ kind: "idle" })}
          className="mt-6 cursor-pointer font-mono text-[11px] tracking-widest text-line-bright underline underline-offset-4 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
        >
          USE A DIFFERENT ADDRESS
        </button>
      </Panel>
    );
  }

  return (
    <Panel>
      <p className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
        ACCESS CONTROL
      </p>
      <h1 className="mt-3 font-display text-2xl font-semibold text-paper">
        Sign in to BuilderOS
      </h1>
      <p className="mt-2 text-sm text-paper-dim">
        Private beta. Use the address you joined with.
      </p>

      {/* Mode selector */}
      <div
        role="tablist"
        aria-label="Sign-in method"
        className="mt-7 flex gap-1 border-b border-line/20"
      >
        {(["email", "wallet"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setState({ kind: "idle" });
            }}
            className={`relative cursor-pointer px-4 py-2.5 font-mono text-[11px] tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-bright ${
              mode === m ? "text-paper" : "text-paper-dim/50 hover:text-paper-dim"
            }`}
          >
            {m.toUpperCase()}
            {mode === m && (
              <motion.span
                layoutId="signin-tab"
                className="absolute inset-x-0 -bottom-px h-px bg-brass-bright"
              />
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {mode === "email" ? (
          <form onSubmit={handleEmail} noValidate>
            <label
              htmlFor="signin-email"
              className="mb-1.5 block font-mono text-[10px] tracking-widest text-paper-dim/70"
            >
              EMAIL
            </label>
            <input
              id="signin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@builder.dev"
              className="w-full rounded-sm border border-line/40 bg-ink/60 px-3 py-2.5 font-mono text-sm text-paper placeholder:text-paper-dim/40 focus:border-brass-bright focus:outline-none"
            />
            <SubmitButton busy={busy} label="Send sign-in link" state={state} />
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-paper-dim/55">
              No password. We email you a one-time link.
            </p>
          </form>
        ) : (
          <div>
            <p className="text-sm leading-relaxed text-paper-dim">
              Sign a message with your wallet to prove ownership. This is a
              signature, not a transaction — it costs nothing and moves no
              funds.
            </p>
            <button
              onClick={handleWallet}
              disabled={busy}
              className="mt-5 w-full cursor-pointer rounded-sm bg-brass px-6 py-3 font-mono text-sm tracking-wide text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? state.note : "Connect wallet"}
            </button>
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-paper-dim/55">
              Browser wallets only for now — MetaMask, Rabby, Brave.
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {state.kind === "error" && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-sm border border-danger/50 bg-danger/10 px-3 py-2 font-mono text-xs leading-relaxed text-danger"
          >
            {state.message}
          </motion.p>
        )}
      </AnimatePresence>
    </Panel>
  );
}

function SubmitButton({
  busy,
  label,
  state,
}: {
  busy: boolean;
  label: string;
  state: State;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="mt-5 w-full cursor-pointer rounded-sm bg-brass px-6 py-3 font-mono text-sm tracking-wide text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright disabled:cursor-wait disabled:opacity-60"
    >
      {busy && state.kind === "working" ? state.note : label}
    </button>
  );
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="block h-2 w-2 rounded-full"
      style={{ background: color, boxShadow: `0 0 12px 3px ${color}55` }}
    />
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md rounded-sm border border-line/25 bg-ink-2/70 p-7 backdrop-blur-sm md:p-9"
    >
      {children}
    </motion.div>
  );
}
