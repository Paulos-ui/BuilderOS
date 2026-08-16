/**
 * API client for the BuilderOS Core Platform.
 *
 * Session design:
 *   - The ACCESS token lives in memory only. Not localStorage, not a
 *     readable cookie — an XSS payload's first move is to read storage, and
 *     a token that only exists in a module closure isn't sitting there
 *     waiting to be scraped. The cost is that a hard refresh loses it, which
 *     is exactly what the refresh call below is for.
 *   - The REFRESH token is an httpOnly cookie the browser holds and JS never
 *     touches. Every request sends `credentials: "include"` so it travels.
 *   - On a 401 we refresh once and retry. If that fails the session is
 *     genuinely over, and we surface it rather than looping.
 */

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://builderos-api.onrender.com"
).replace(/\/+$/, "");

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

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
  if (!API_URL) {
    throw new ApiError(
      "The API isn't connected yet. Set NEXT_PUBLIC_API_URL and redeploy.",
      0,
    );
  }

  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: "include", // carries the httpOnly refresh cookie
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

/**
 * Concurrent callers share one in-flight refresh, so five parallel 401s
 * produce one refresh request rather than five racing ones.
 */
export async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const data = await rawRequest<{ accessToken: string }>(
        "/v1/auth/refresh",
        { method: "POST" },
      );
      accessToken = data.accessToken;
      return true;
    } catch {
      accessToken = null;
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
      const refreshed = await refreshSession();
      if (refreshed) return rawRequest<T>(path, init);
    }
    throw err;
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────

export function requestOtp(email: string) {
  return api<{ sent: true; retryAfter: number }>("/v1/auth/email/otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(email: string, code: string) {
  const data = await api<{ accessToken: string }>("/v1/auth/email/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
  accessToken = data.accessToken;
  return data;
}

export function requestMagicLink(email: string) {
  return api<{ sent: true }>("/v1/auth/email/magic-link", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyMagicLink(token: string) {
  const data = await api<{ accessToken: string }>("/v1/auth/email/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  accessToken = data.accessToken;
  return data;
}

export function walletChallenge(address: string) {
  return api<{ message: string }>("/v1/auth/wallet/challenge", {
    method: "POST",
    body: JSON.stringify({ address }),
  });
}

export async function walletVerify(message: string, signature: string) {
  const data = await api<{ accessToken: string }>("/v1/auth/wallet/verify", {
    method: "POST",
    body: JSON.stringify({ message, signature }),
  });
  accessToken = data.accessToken;
  return data;
}

export async function logout() {
  try {
    await api("/v1/auth/logout", { method: "POST" });
  } finally {
    accessToken = null;
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
