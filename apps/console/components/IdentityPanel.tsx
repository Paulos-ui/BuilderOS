"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

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
 * Shows which sign-in methods are attached, and lets the builder add the
 * missing one.
 *
 * Linking matters more than it looks: a builder who signed up with email and
 * later wants on-chain reputation needs a wallet on the same profile, not a
 * second orphaned account. Doing it here keeps one identity per person.
 */
export default function IdentityPanel() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<Identity>("/v1/profiles/me/identity");
        if (!cancelled) setIdentity(data);
      } catch {
        /* the panel simply stays hidden if this fails */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function linkWallet() {
    const provider = (window as unknown as { ethereum?: EthereumProvider })
      .ethereum;
    if (!provider) {
      setError("No browser wallet detected. Install MetaMask to link one.");
      return;
    }

    setError(null);
    setNotice(null);
    try {
      setBusy("REQUESTING ACCOUNT");
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error("The wallet returned no account.");

      setBusy("REQUESTING CHALLENGE");
      const { message } = await api<{ message: string }>(
        "/v1/auth/wallet/challenge",
        { method: "POST", body: JSON.stringify({ address }) },
      );

      setBusy("AWAITING SIGNATURE");
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
      setNotice("Wallet linked to this account.");
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
            : "Couldn't link that wallet.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!identity) return null;

  return (
    <section className="rounded-sm border border-line/25 bg-ink-2/50 p-5">
      <h2 className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
        SIGN-IN METHODS
      </h2>

      <dl className="mt-4 space-y-3">
        <Row
          label="EMAIL"
          value={identity.email}
          empty="Not linked"
        />
        <Row
          label="WALLET"
          value={
            identity.walletAddress
              ? `${identity.walletAddress.slice(0, 10)}…${identity.walletAddress.slice(-8)}`
              : null
          }
          empty="Not linked"
        />
      </dl>

      {!identity.walletAddress && (
        <>
          <button
            onClick={linkWallet}
            disabled={busy !== null}
            className="mt-5 w-full cursor-pointer rounded-sm border border-brass/50 px-4 py-2.5 font-mono text-xs tracking-wide text-brass-bright transition-colors hover:bg-brass/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright disabled:cursor-wait disabled:opacity-60"
          >
            {busy ?? "Link a wallet"}
          </button>
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-paper-dim/50">
            Linking a wallet lets BuilderRep attach on-chain proof to this
            profile later. It is a signature, not a transaction.
          </p>
        </>
      )}

      {identity.fullyLinked && (
        <p className="mt-4 font-mono text-[10px] tracking-widest text-signal-bright">
          ✓ BOTH METHODS LINKED
        </p>
      )}

      {notice && (
        <p role="status" className="mt-3 font-mono text-[10px] text-signal-bright">
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-sm border border-danger/50 bg-danger/10 px-3 py-2 font-mono text-[10px] leading-relaxed text-danger"
        >
          {error}
        </p>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  empty,
}: {
  label: string;
  value: string | null;
  empty: string;
}) {
  return (
    <div className="grid grid-cols-[70px_1fr] items-baseline gap-3 font-mono text-[11px]">
      <dt className="tracking-widest text-paper-dim/50">{label}</dt>
      <dd className={value ? "truncate text-paper" : "text-paper-dim/40"}>
        {value ?? empty}
      </dd>
    </div>
  );
}
