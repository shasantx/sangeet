import crypto from "node:crypto";

export const SESSION_COOKIE = "sangeet_session";
export const OAUTH_STATE_COOKIE = "sangeet_oauth_state";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

export interface SessionPayload {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  mode: "google";
  exp: number;
}

export interface OAuthStatePayload {
  nonce: string;
  android: boolean;
  returnTo: string;
  exp: number;
}

// Per-process random fallback if AUTH_SECRET is unset in production (fails closed, never a static public key)
const EPHEMERAL_PROD_SECRET = crypto.randomBytes(32).toString("hex");
let warnedMissingSecret = false;

function getSecret(): string {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    return process.env.AUTH_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn(
        "[auth-session] AUTH_SECRET is not set or too short in production; using ephemeral secret."
      );
    }
    return EPHEMERAL_PROD_SECRET;
  }
  return "sangeet-dev-ephemeral-secret-change-in-production";
}

function hmacSign(data: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(data)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function getSessionCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  };
}

export function getClearedSessionCookieOptions() {
  return getSessionCookieOptions(0);
}

export function getOAuthStateCookieOptions(
  maxAge = OAUTH_STATE_MAX_AGE_SECONDS
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  };
}

/**
 * Strictly validates relative redirect paths to prevent Open Redirect attacks.
 * Only permits same-origin paths starting with "/" (never "//", "/\", backslashes, or control chars).
 */
export function sanitizeReturnTo(
  raw?: string | null,
  fallback = "/home"
): string {
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > 512 ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "https://sangeet.local");
    if (
      parsed.origin !== "https://sangeet.local" ||
      !parsed.pathname.startsWith("/") ||
      parsed.pathname.startsWith("//")
    ) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function signSession(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmacSign(data);
  return `${data}.${sig}`;
}

export function verifySession(token?: string): SessionPayload | null {
  if (!token || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  const expected = hmacSign(data);

  try {
    if (!safeEqual(sig, expected)) {
      return null;
    }
    const parsed = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as SessionPayload;
    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      !parsed.id ||
      typeof parsed.name !== "string" ||
      parsed.mode !== "google" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createOAuthState(options: {
  android: boolean;
  returnTo?: string | null;
}): { state: string; nonce: string } {
  const nonce = crypto.randomBytes(24).toString("base64url");
  const payload: OAuthStatePayload = {
    nonce,
    android: Boolean(options.android),
    returnTo: sanitizeReturnTo(
      options.returnTo,
      options.android ? "/home?google=success" : "/home"
    ),
    exp: Date.now() + OAUTH_STATE_MAX_AGE_SECONDS * 1000
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmacSign(data);
  return { state: `${data}.${sig}`, nonce };
}

export function verifyOAuthState(
  stateToken?: string | null,
  cookieNonce?: string | null
): OAuthStatePayload | null {
  if (
    !stateToken ||
    !cookieNonce ||
    stateToken.length > 2048 ||
    cookieNonce.length > 128
  ) {
    return null;
  }

  const parts = stateToken.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  const expected = hmacSign(data);
  if (!safeEqual(sig, expected)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as OAuthStatePayload;
    if (
      !parsed ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.android !== "boolean" ||
      typeof parsed.returnTo !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    if (!safeEqual(parsed.nonce, cookieNonce)) {
      return null;
    }
    return {
      ...parsed,
      returnTo: sanitizeReturnTo(
        parsed.returnTo,
        parsed.android ? "/home?google=success" : "/home"
      )
    };
  } catch {
    return null;
  }
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}
