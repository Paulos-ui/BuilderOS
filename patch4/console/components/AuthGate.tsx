"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Client-side gate for the console.
 *
 * Worth being clear about what this is and isn't: it protects the *view*,
 * not the data. Every real protection lives on the API, which validates the
 * JWT on each request. A determined visitor can render this component's
 * children by editing local state — and would then see empty panels, because
 * the API refuses them. That's the correct division of responsibility.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/signin");
  }, [status, router]);

  if (status === "restoring") {
    return (
      <main className="bp-grid flex min-h-screen items-center justify-center">
        <div className="text-center">
          <span
            aria-hidden="true"
            className="mx-auto block h-2 w-2 animate-pulse rounded-full bg-line-bright"
          />
          <p className="mt-4 font-mono text-[11px] tracking-widest text-line-bright">
            RESTORING SESSION
          </p>
        </div>
      </main>
    );
  }

  if (status === "anonymous") return null;

  return <>{children}</>;
}
