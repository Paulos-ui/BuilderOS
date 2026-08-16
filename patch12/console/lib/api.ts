/**
 * API client for the BuilderOS Core Platform.
 *
 * ── Why there is a token in sessionStorage ────────────────────────────────
 *
 * The console (builderos3.vercel.app) and the API (builderos-api.onrender.com)
 * are different registrable domains, so the refresh cookie is a THIRD-PARTY
 * cookie. Firefox's Total Cookie Protection and Safari's ITP block those by
 * default — which is why signing in worked but every page reload bounced
 * back to /signin. The cookie was set and then never sent.
 *
 * The fix here is a deliberate, bounded trade-off:
 *
 *   - The httpOnly cookie remains the PRIMARY mechanism. Where third-party
 *     cookies work (Chrome today), nothing reaches JavaScript at all.
 *   - Where the cookie is blocked, we fall back to a refresh token in
 *     sessionStorage. This is weaker: script on the page can read it. We use
 *     sessionStorage rather than localStorage so it dies with the tab
 *     instead of persisting indefinitely.
 *
 * This is a workaround for a deployment topology, not a design we should
 * keep. The correct fix is a shared parent domain — builderos.dev for the
 * app and api.builderos.dev for the API — at which point the cookie is
 * first-party, `sameSite: 'lax'` works, and this fallback can be deleted.
 * That is tracked as the next infrastructure task.
 */

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://builderos-api.onrender.com"
).replace(/\/+$/, "");

const REFRESH_KEY = "builderos.refresh";

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

function readStoredRefresh(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(REFRESH_KEY);
  } catch {
    return null; // storage can be disabled entirely
  }
}

function writeStoredRefresh(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(REFRESH_KEY, token);
    else window.sessionStorage.removeItem(REFRESH_KEY);
  } catch {
    /* storage unavailable — the cookie path may still work */
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function isApiConfigured() {
  return API_URL.length > 0;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function rawRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "Couldn't reach the server. It may be waking up — try again shortly.",
      0,
    );
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const raw = (body as { message?: string | string[] } | null)?.message;
    const message = Array.isArray(raw) ? raw[0] : raw;
    throw new ApiError(message ?? `Request failed (${res.status})`, res.status);
  }

  return body as T;
}

/** Stores whatever the server gave us back after a successful auth call. */
function adoptSession(data: { accessToken: string; refreshToken?: string }) {
  accessToken = data.accessToken;
  if (data.refreshToken) writeStoredRefresh(data.refreshToken);
}

export async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const stored = readStoredRefresh();
      const data = await rawRequest<{
        accessToken: string;
        refreshToken?: string;
      }>("/v1/auth/refresh", {
        method: "POST",
        // Sent only when we have one; the cookie is tried first server-side.
        ...(stored ? { body: JSON.stringify({ refreshToken: stored }) } : {}),
      });
      adoptSession(data);
      return true;
    } catch {
      accessToken = null;
      writeStoredRefresh(null);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, init);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && accessToken !== null) {
      if (await refreshSession()) return rawRequest<T>(path, init);
    }
    throw err;
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────

export function requestOtp(email: string) {
  return api<{
    sent: boolean;
    delivery: "sent" | "logged" | "failed";
    retryAfter: number;
    reason?: string;
  }>("/v1/auth/email/otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(email: string, code: string) {
  const data = await api<{ accessToken: string; refreshToken?: string }>(
    "/v1/auth/email/verify",
    { method: "POST", body: JSON.stringify({ email, code }) },
  );
  adoptSession(data);
  return data;
}

export function walletChallenge(address: string) {
  return api<{ message: string }>("/v1/auth/wallet/challenge", {
    method: "POST",
    body: JSON.stringify({ address }),
  });
}

export async function walletVerify(message: string, signature: string) {
  const data = await api<{ accessToken: string; refreshToken?: string }>(
    "/v1/auth/wallet/verify",
    { method: "POST", body: JSON.stringify({ message, signature }) },
  );
  adoptSession(data);
  return data;
}

export async function logout() {
  try {
    await api("/v1/auth/logout", { method: "POST" });
  } finally {
    accessToken = null;
    writeStoredRefresh(null);
  }
}

// ── Profile ──────────────────────────────────────────────────────────────

export interface BuilderProfile {
  id: string;
  githubUsername: string | null;
  chains: string[];
  languages: string[];
  bio: string | null;
  createdAt: string;
  user?: {
    email: string | null;
    walletAddress: string | null;
    createdAt: string;
  };
}

export function getMyProfile() {
  return api<BuilderProfile>("/v1/profiles/me");
}
