"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestOtp,
  verifyOtp,
  walletChallenge,
  walletVerify,
  signInMethods,
  ApiError,
  type SignInMethods,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  discoverWallets,
  type DiscoveredWallet,
  type Eip1193Provider,
} from "@/lib/wallets";
import { BuilderOsLogo } from "./BuilderOsLogo";
import OtpInput from "./OtpInput";

const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL ?? "https://builderos1.vercel.app";

/** Install links for the case where no wallet is detected at all. */
const WALLET_LINKS = [
  { name: "MetaMask", href: "https://metamask.io/download/" },
  { name: "OKX Wallet", href: "https://www.okx.com/web3" },
  { name: "Rabby", href: "https://rabby.io/" },
];

/** Where a signed-in builder lands: the feed, not an empty dashboard. */
const POST_SIGNIN = "/console";

type Tab = "email" | "wallet";
type Step = "enter-email" | "enter-code";

/** Wallet-side error shapes we care about, per EIP-1193. */
const USER_REJECTED = 4001;

export default function SignInPanel() {
  const { onSignedIn } = useAuth();
  const router = useRouter();

  // Wallet is the default tab now: it is the method that works today, so it
  // should not take a click to reach.
  const [tab, setTab] = useState<Tab>("wallet");
  const [step, setStep] = useState<Step>("enter-email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [delivery, setDelivery] = useState<"sent" | "logged" | "failed" | null>(
    null,
  );

  // null while the probe is in flight — lets us avoid flashing the email form
  // and then yanking it away once the answer arrives.
  const [methods, setMethods] = useState<SignInMethods | null>(null);

  // Wallets announce themselves within milliseconds, so this is populated
  // before most people finish reading the heading.
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void signInMethods().then((m) => {
      if (!cancelled) setMethods(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stop = discoverWallets(setWallets);
    // Matches the legacy fallback window in discoverWallets, so "no wallet"
    // is only claimed after every provider has had a chance to answer.
    const t = setTimeout(() => setScanned(true), 350);
    return () => {
      stop();
      clearTimeout(t);
    };
  }, []);

  const emailEnabled = methods?.email ?? false;

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

  async function connectWallet(provider: Eip1193Provider, label: string) {
    if (busy) return;
    setError(null);
    try {
      setBusy("OPENING WALLET");
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error(`${label} returned no account.`);

      setBusy("PREPARING SIGNATURE");
      const { message } = await walletChallenge(address);

      setBusy("WAITING ON YOU");
      const signature = (await provider.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;

      setBusy("SIGNING IN");
      await walletVerify(message, signature);
      await onSignedIn();
      router.replace(POST_SIGNIN);
    } catch (err) {
      // Declining to sign is a choice, not an error — say nothing and let them
      // try again. -32002 means a wallet popup is already open, which is also
      // not a failure worth shouting about.
      const code = (err as { code?: number })?.code;
      if (code === USER_REJECTED) {
        setBusy(null);
        return;
      }
      if (code === -32002) {
        setError(`${label} is already asking — check for an open popup.`);
        setBusy(null);
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : `Couldn't finish signing in with ${label}.`,
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
            "Private beta."
          )}
        </p>

        {/*
          The tab strip only earns its place when there is a real choice to
          make. During the wallet-only beta a single disabled tab would be
          noise, so the email path is presented below as a status row instead.
        */}
        {step === "enter-email" && emailEnabled && (
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
          ) : tab === "email" && emailEnabled ? (
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
              {/*
                One line, stated once. The previous copy explained at length
                that this was "a signature, not a transaction — it costs
                nothing and moves no funds", which is accurate but reads as
                reassurance, and volunteered reassurance invites the doubt it
                means to settle.
              */}
              <p className="text-sm leading-relaxed text-paper-dim">
                Sign a message to prove the address is yours. No transaction,
                no gas.
              </p>

              {wallets.length > 0 ? (
                <div className="mt-5 space-y-2">
                  {wallets.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => void connectWallet(w.provider, w.name)}
                      disabled={busy !== null}
                      className="group flex w-full cursor-pointer items-center gap-3 rounded-sm border border-line/30 bg-ink/50 px-4 py-3 text-left transition-colors hover:border-brass-bright/60 hover:bg-ink-2/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright disabled:cursor-wait disabled:opacity-50"
                    >
                      {w.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={w.icon}
                          alt=""
                          aria-hidden="true"
                          className="size-6 shrink-0 rounded-sm"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="size-6 shrink-0 rounded-sm border border-line/40 bg-ink"
                        />
                      )}
                      <span className="flex-1 font-mono text-sm tracking-wide text-paper">
                        {w.name}
                      </span>
                      <span
                        aria-hidden="true"
                        className="font-mono text-[10px] tracking-[0.2em] text-paper-dim/40 transition-colors group-hover:text-brass-bright"
                      >
                        →
                      </span>
                    </button>
                  ))}

                  {busy && (
                    <p
                      role="status"
                      className="pt-1 font-mono text-[10px] tracking-[0.2em] text-brass-bright/85"
                    >
                      {busy}
                    </p>
                  )}

                  {wallets.length > 1 && (
                    <p className="pt-1 font-mono text-[10px] leading-relaxed text-paper-dim/45">
                      {wallets.length} wallets detected.
                    </p>
                  )}
                </div>
              ) : scanned ? (
                <div className="mt-5 rounded-sm border border-line/25 bg-ink/40 px-4 py-4">
                  <p className="text-sm text-paper-dim">
                    No wallet extension detected in this browser.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                    {WALLET_LINKS.map((w) => (
                      <a
                        key={w.name}
                        href={w.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[11px] tracking-wide text-line-bright underline underline-offset-4 transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                      >
                        {w.name}
                      </a>
                    ))}
                  </div>
                  <p className="mt-3 font-mono text-[10px] leading-relaxed text-paper-dim/50">
                    Install one, then reload this page.
                  </p>
                </div>
              ) : (
                // Sub-350ms in practice; present so the panel doesn't jump.
                <p className="mt-5 font-mono text-[10px] tracking-[0.2em] text-paper-dim/40">
                  DETECTING WALLETS…
                </p>
              )}

              {/*
                Email's status, stated plainly. A waitlisted builder arrives
                expecting to use the address they signed up with, so silence
                here reads as "my signup didn't register". The brass rule and
                mono label match the module headers in the console rack, so
                this reads as instrumentation rather than an error.
              */}
              {/*
                Was three paragraphs. Anyone here has already chosen to use a
                wallet, so email's status is a footnote — one line, in the
                instrumentation voice used across the rack.
              */}
              {methods && !methods.email && (
                <p className="mt-6 border-t border-line/15 pt-4 font-mono text-[10px] leading-relaxed tracking-wide text-paper-dim/45">
                  EMAIL SIGN-IN ·{" "}
                  <span className="text-brass-bright/70">PROVISIONING</span>
                </p>
              )}
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
