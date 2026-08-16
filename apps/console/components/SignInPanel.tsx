"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestOtp,
  verifyOtp,
  walletChallenge,
  walletVerify,
  ApiError,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { BuilderOsLogo } from "./BuilderOsLogo";
import OtpInput from "./OtpInput";

const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL ?? "https://builderos1.vercel.app";

/** Where a signed-in builder lands: the feed, not an empty dashboard. */
const POST_SIGNIN = "/console";

type Tab = "email" | "wallet";
type Step = "enter-email" | "enter-code";

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function injectedProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum ?? null;
}

export default function SignInPanel() {
  const { onSignedIn } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("email");
  const [step, setStep] = useState<Step>("enter-email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [delivery, setDelivery] = useState<"sent" | "logged" | "failed" | null>(
    null,
  );

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(isResend = false) {
    if (busy) return;
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setBusy(isResend ? "RESENDING" : "SENDING CODE");
    setError(null);
    try {
      const res = await requestOtp(email.trim());
      setStep("enter-code");
      setCode("");
      setCooldown(res.retryAfter ?? 30);
      setDelivery(res.delivery);
      // A failed send still produced a valid code, so we advance to the
      // input screen — but we say plainly that the email didn't arrive
      // rather than leaving the user waiting on an inbox forever.
      if (res.delivery === "failed" && res.reason) setError(res.reason);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send a code.");
    } finally {
      setBusy(null);
    }
  }

  async function submitCode(fullCode: string) {
    if (busy) return;
    setBusy("VERIFYING");
    setError(null);
    try {
      await verifyOtp(email.trim(), fullCode);
      await onSignedIn();
      router.replace(POST_SIGNIN);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "That code didn't work.",
      );
      setCode("");
    } finally {
      setBusy(null);
    }
  }

  async function connectWallet() {
    if (busy) return;
    const provider = injectedProvider();
    if (!provider) {
      setError(
        "No browser wallet detected. Install MetaMask, or sign in with email.",
      );
      return;
    }
    setError(null);
    try {
      setBusy("REQUESTING ACCOUNT");
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error("The wallet returned no account.");

      setBusy("REQUESTING CHALLENGE");
      const { message } = await walletChallenge(address);

      setBusy("AWAITING SIGNATURE");
      const signature = (await provider.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;

      setBusy("VERIFYING");
      await walletVerify(message, signature);
      await onSignedIn();
      router.replace(POST_SIGNIN);
    } catch (err) {
      // 4001 = user rejected. Declining to sign is a choice, not an error.
      if ((err as { code?: number })?.code === 4001) {
        setBusy(null);
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Wallet sign-in failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full max-w-md">
      <a
        href={LANDING_URL}
        className="mb-6 inline-flex items-center gap-2 rounded-sm font-mono text-[11px] tracking-[0.12em] text-paper-dim/70 transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
      >
        ← BACK TO HOME
      </a>

      <div className="rounded-sm border border-line/25 bg-ink-2/70 p-7 backdrop-blur-sm md:p-9">
        <div className="mb-7 border-b border-line/15 pb-6">
          <BuilderOsLogo />
        </div>

        <p className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
          ACCESS CONTROL
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-paper">
          {step === "enter-code" ? "Enter your code" : "Sign in to BuilderOS"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-paper-dim">
          {step === "enter-code" ? (
            delivery === "logged" ? (
              <>
                Email isn&apos;t configured on this deployment, so the code
                was written to the server log instead.
              </>
            ) : (
              <>
                We sent a 6-digit code to{" "}
                <span className="text-paper">{email}</span>.
              </>
            )
          ) : (
            "Private beta. Use the address you joined with."
          )}
        </p>

        {step === "enter-email" && (
          <div
            role="tablist"
            aria-label="Sign-in method"
            className="mt-7 flex gap-1 border-b border-line/20"
          >
            {(["email", "wallet"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setError(null);
                }}
                className={`relative cursor-pointer px-4 py-2.5 font-mono text-[11px] tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-bright ${
                  tab === t
                    ? "text-paper"
                    : "text-paper-dim/50 hover:text-paper-dim"
                }`}
              >
                {t.toUpperCase()}
                {tab === t && (
                  <motion.span
                    layoutId="signin-tab"
                    className="absolute inset-x-0 -bottom-px h-px bg-brass-bright"
                  />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6">
          {step === "enter-code" ? (
            <div>
              <OtpInput
                value={code}
                onChange={setCode}
                onComplete={submitCode}
                disabled={busy !== null}
                invalid={Boolean(error)}
              />

              <button
                onClick={() => submitCode(code)}
                disabled={busy !== null || code.length !== 6}
                className="mt-5 w-full cursor-pointer rounded-sm bg-brass px-6 py-3 font-mono text-sm tracking-wide text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ?? "Verify and continue"}
              </button>

              <div className="mt-5 flex items-center justify-between font-mono text-[10px] tracking-widest">
                <button
                  onClick={() => {
                    setStep("enter-email");
                    setCode("");
                    setError(null);
                  }}
                  className="cursor-pointer text-paper-dim/60 underline underline-offset-4 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                >
                  ← CHANGE EMAIL
                </button>

                <button
                  onClick={() => sendCode(true)}
                  disabled={cooldown > 0 || busy !== null}
                  className="cursor-pointer text-line-bright underline underline-offset-4 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright disabled:cursor-not-allowed disabled:text-paper-dim/35 disabled:no-underline"
                >
                  {cooldown > 0 ? `RESEND IN ${cooldown}S` : "RESEND CODE"}
                </button>
              </div>
            </div>
          ) : tab === "email" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
              noValidate
            >
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
                className="w-full rounded-sm border border-line/40 bg-ink/70 px-3 py-2.5 font-mono text-sm text-paper placeholder:text-paper-dim/40 focus:border-brass-bright focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy !== null}
                className="mt-5 w-full cursor-pointer rounded-sm bg-brass px-6 py-3 font-mono text-sm tracking-wide text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright disabled:cursor-wait disabled:opacity-60"
              >
                {busy ?? "Send sign-in code"}
              </button>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-paper-dim/55">
                No password. We email a 6-digit code that expires in 10 minutes.
              </p>
            </form>
          ) : (
            <div>
              <p className="text-sm leading-relaxed text-paper-dim">
                Sign a message with your wallet to prove you control the
                address. This is a signature, not a transaction — it costs
                nothing and moves no funds.
              </p>
              <button
                onClick={connectWallet}
                disabled={busy !== null}
                className="mt-5 w-full cursor-pointer rounded-sm bg-brass px-6 py-3 font-mono text-sm tracking-wide text-ink transition-colors hover:bg-brass-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright disabled:cursor-wait disabled:opacity-60"
              >
                {busy ?? "Connect wallet"}
              </button>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-paper-dim/55">
                Browser wallets only for now — MetaMask, Rabby, Brave.
              </p>
            </div>
          )}
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-sm border border-danger/50 bg-danger/10 px-3 py-2 font-mono text-xs leading-relaxed text-danger"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-6 text-center font-mono text-[10px] tracking-widest text-paper-dim/40">
        BUILDEROS · BY GOAT ECOSYSTEM
      </p>
    </div>
  );
}
