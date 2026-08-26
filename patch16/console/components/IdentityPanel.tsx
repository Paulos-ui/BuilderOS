"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import OtpInput from "./OtpInput";

interface Identity {
  email: string | null;
  walletAddress: string | null;
  authProvider: string;
  fullyLinked: boolean;
}

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

/**
 * Sign-in methods, and adding the one you're missing.
 *
 * Both directions are supported because people arrive from either side: a
 * wallet user who wants deadline reminders needs an email, and an email user
 * who wants on-chain proof needs a wallet. Without linking they end up with
 * two orphaned accounts and half their history in each.
 */
export default function IdentityPanel() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [emailStep, setEmailStep] = useState<"idle" | "enter" | "code">("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  async function load() {
    try {
      setIdentity(await api<Identity>("/v1/profiles/me/identity"));
    } catch {
      /* panel stays hidden */
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function sendEmailCode() {
    if (!email.trim()) {
      setError("Enter an email address.");
      return;
    }
    setBusy("SENDING");
    setError(null);
    try {
      await api("/v1/profiles/me/link-email/start", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setEmailStep("code");
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send a code.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmEmail(full: string) {
    setBusy("VERIFYING");
    setError(null);
    try {
      const updated = await api<Identity>("/v1/profiles/me/link-email/confirm", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), code: full }),
      });
      setIdentity(updated);
      setEmailStep("idle");
      setNotice("Email added to this account.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code didn't work.");
      setCode("");
    } finally {
      setBusy(null);
    }
  }

  async function linkWallet() {
    const provider = (window as unknown as { ethereum?: EthereumProvider })
      .ethereum;
    if (!provider) {
      setError("No browser wallet detected. Install MetaMask to add one.");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      setBusy("CONNECTING");
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error("The wallet returned no account.");

      setBusy("AWAITING SIGNATURE");
      const { message } = await api<{ message: string }>(
        "/v1/auth/wallet/challenge",
        { method: "POST", body: JSON.stringify({ address }) },
      );
      const signature = (await provider.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;

      setBusy("LINKING");
      const updated = await api<Identity>("/v1/profiles/me/link-wallet", {
        method: "POST",
        body: JSON.stringify({ message, signature }),
      });
      setIdentity(updated);
      setNotice("Wallet added to this account.");
    } catch (err) {
      if ((err as { code?: number })?.code === 4001) {
        setBusy(null);
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't add that wallet.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!identity) return null;

  return (
    <section className="rounded-sm border border-line/25 bg-ink-2/50 p-6">
      <h2 className="font-display text-lg font-semibold text-paper">
        How you sign in
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-paper-dim">
        Add both and you can sign in either way — same account, same history.
      </p>

      <div className="mt-6 space-y-3">
        {/* Email */}
        <Method
          title="Email"
          value={identity.email}
          description="For sign-in codes and deadline reminders."
        >
          {!identity.email && emailStep === "idle" && (
            <button
              onClick={() => setEmailStep("enter")}
              className="cursor-pointer rounded-sm border border-brass/50 px-3 py-1.5 font-mono text-[10px] tracking-widest text-brass-bright transition-colors hover:bg-brass/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
            >
              ADD EMAIL
            </button>
          )}
        </Method>

        <AnimatePresence>
          {emailStep !== "idle" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-sm border border-line/25 bg-ink/50 p-4">
                {emailStep === "enter" ? (
                  <>
                    <label
                      htmlFor="link-email"
                      className="mb-1.5 block font-mono text-[10px] tracking-widest text-paper-dim/70"
                    >
                      EMAIL ADDRESS
                    </label>
                    <input
                      id="link-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@builder.dev"
                      className="w-full rounded-sm border border-line/40 bg-ink/60 px-3 py-2.5 font-mono text-sm text-paper placeholder:text-paper-dim/35 focus:border-brass-bright focus:outline-none"
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={sendEmailCode}
                        disabled={busy !== null}
                        className="flex-1 cursor-pointer rounded-sm bg-brass px-4 py-2 font-mono text-xs tracking-wide text-ink transition-colors hover:bg-brass-bright disabled:opacity-60"
                      >
                        {busy ?? "Send code"}
                      </button>
                      <button
                        onClick={() => {
                          setEmailStep("idle");
                          setError(null);
                        }}
                        className="cursor-pointer rounded-sm border border-line/30 px-4 py-2 font-mono text-xs text-paper-dim hover:text-paper"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mb-3 text-[13px] text-paper-dim">
                      Enter the 6-digit code sent to{" "}
                      <span className="text-paper">{email}</span>.
                    </p>
                    <OtpInput
                      value={code}
                      onChange={setCode}
                      onComplete={confirmEmail}
                      disabled={busy !== null}
                      invalid={Boolean(error)}
                    />
                    <button
                      onClick={() => {
                        setEmailStep("enter");
                        setError(null);
                      }}
                      className="mt-3 cursor-pointer font-mono text-[10px] tracking-widest text-paper-dim/60 underline underline-offset-4 hover:text-paper"
                    >
                      ← CHANGE ADDRESS
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wallet */}
        <Method
          title="Wallet"
          value={
            identity.walletAddress
              ? `${identity.walletAddress.slice(0, 10)}…${identity.walletAddress.slice(-8)}`
              : null
          }
          description="For on-chain proof of your completed work."
        >
          {!identity.walletAddress && (
            <button
              onClick={linkWallet}
              disabled={busy !== null}
              className="cursor-pointer rounded-sm border border-brass/50 px-3 py-1.5 font-mono text-[10px] tracking-widest text-brass-bright transition-colors hover:bg-brass/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright disabled:opacity-60"
            >
              {busy && busy !== "SENDING" && busy !== "VERIFYING"
                ? busy
                : "ADD WALLET"}
            </button>
          )}
        </Method>
      </div>

      {identity.fullyLinked && (
        <p className="mt-5 flex items-center gap-2 font-mono text-[10px] tracking-widest text-signal-bright">
          <span aria-hidden="true">✓</span> BOTH METHODS ADDED
        </p>
      )}

      {notice && (
        <p role="status" className="mt-4 font-mono text-[11px] text-signal-bright">
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-sm border border-danger/50 bg-danger/10 px-3 py-2 font-mono text-[11px] leading-relaxed text-danger"
        >
          {error}
        </p>
      )}
    </section>
  );
}

function Method({
  title,
  value,
  description,
  children,
}: {
  title: string;
  value: string | null;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-sm border border-line/20 bg-ink/40 px-4 py-3.5">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          background: value
            ? "var(--color-signal-bright)"
            : "var(--color-line)",
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[13px] font-medium text-paper">{title}</p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-paper-dim/60">
          {value ?? description}
        </p>
      </div>
      {children}
    </div>
  );
}
