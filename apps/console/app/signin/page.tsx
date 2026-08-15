"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SignInPanel from "@/components/SignInPanel";
import { useAuth } from "@/lib/auth-context";

export default function SignInPage() {
  const { status } = useAuth();
  const router = useRouter();

  // Already signed in? Don't make them do it twice.
  useEffect(() => {
    if (status === "authenticated") router.replace("/console");
  }, [status, router]);

  return (
    <main className="bp-grid flex min-h-screen items-center justify-center px-5 py-16">
      <SignInPanel />
    </main>
  );
}
