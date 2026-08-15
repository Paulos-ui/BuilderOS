"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyMagicLink, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Catches the magic link. The token is single-use, so this must fire exactly
 * once — React's dev StrictMode double-invokes effects, and a second call
 * would consume an already-burned token and report a false failure. The ref
 * guard below is what prevents that.
 */
function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { onSignedIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const token = params.get("token");
    if (!token) {
      setError("This link is missing its token. Request a new one.");
      return;
    }

    (async () => {
      try {
        await verifyMagicLink(token);
        await onSignedIn();
        router.replace("/console");
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "This link is invalid or has expired.",
        );
      }
    })();
  }, [params, router, onSignedIn]);

  return (
    <main className="bp-grid flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-sm border border-line/25 bg-ink-2/70 p-8 text-center">
        {error ? (
          <>
            <p className="font-mono text-[10px] tracking-[0.25em] text-danger">
              VERIFICATION FAILED
            </p>
            <p className="mt-3 text-sm leading-relaxed text-paper-dim">{error}</p>
            <Link
              href="/signin"
              className="mt-6 inline-block font-mono text-[11px] tracking-widest text-brass-bright underline underline-offset-4"
            >
              REQUEST A NEW LINK
            </Link>
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="mx-auto block h-2 w-2 animate-pulse rounded-full bg-signal-bright"
            />
            <p className="mt-4 font-mono text-[11px] tracking-widest text-line-bright">
              VERIFYING SESSION
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
