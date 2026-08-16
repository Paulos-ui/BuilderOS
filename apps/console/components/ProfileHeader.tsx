"use client";

import { useAuth } from "@/lib/auth-context";
import BuilderIdenticon from "./BuilderIdenticon";

/**
 * Profile header with the derived identity mark.
 *
 * The seed is the wallet address when present, otherwise the profile id —
 * both stable, so the mark never changes underneath someone. Using the email
 * would mean the figure changes if they later link a wallet, which would
 * quietly break the one property that makes a derived identity worth having.
 */
export default function ProfileHeader() {
  const { profile } = useAuth();

  const seed = profile?.user?.walletAddress ?? profile?.id ?? null;
  const display =
    profile?.user?.email ??
    (profile?.user?.walletAddress
      ? `${profile.user.walletAddress.slice(0, 10)}…${profile.user.walletAddress.slice(-8)}`
      : "Builder");

  const joined = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <header className="flex flex-wrap items-start gap-5">
      <BuilderIdenticon seed={seed} size={72} />

      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
          BUILDER PROFILE
        </p>
        <h1 className="mt-2 truncate font-display text-2xl font-semibold text-paper md:text-3xl">
          {display}
        </h1>
        <p className="mt-1.5 font-mono text-[10px] tracking-wide text-paper-dim/55">
          {joined ? `JOINED ${joined.toUpperCase()}` : "PRIVATE BETA"}
          {profile?.id && ` · ${profile.id.slice(0, 8)}`}
        </p>
      </div>
    </header>
  );
}
