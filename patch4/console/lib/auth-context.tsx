"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getMyProfile,
  logout as apiLogout,
  refreshSession,
  type BuilderProfile,
} from "./api";

type Status = "restoring" | "authenticated" | "anonymous";

interface AuthValue {
  status: Status;
  profile: BuilderProfile | null;
  /** Call after a successful sign-in to load the session's profile. */
  onSignedIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("restoring");
  const [profile, setProfile] = useState<BuilderProfile | null>(null);

  const loadProfile = useCallback(async () => {
    const p = await getMyProfile();
    setProfile(p);
    setStatus("authenticated");
  }, []);

  // On mount the in-memory access token is gone (page load wipes it), but
  // the httpOnly refresh cookie may still be valid — so we try once to
  // restore silently before deciding the visitor is anonymous.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const ok = await refreshSession();
      if (cancelled) return;
      if (!ok) {
        setStatus("anonymous");
        return;
      }
      try {
        await loadProfile();
      } catch {
        if (!cancelled) setStatus("anonymous");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await apiLogout();
    setProfile(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({ status, profile, onSignedIn: loadProfile, signOut }),
    [status, profile, loadProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
