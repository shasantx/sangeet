import { createHmac, createPublicKey, createVerify, timingSafeEqual } from "crypto";

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

interface GoogleDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

interface GoogleJwk {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  [key: string]: string | undefined;
}

interface GoogleClaims extends GoogleIdentity {
  iss: string;
  aud: string | string[];
  exp: number;
  nonce: string;
  email_verified: boolean;
}

let discoveryCache: { value: GoogleDiscovery; expiresAt: number } | undefined;
let keysCache: { value: GoogleJwk[]; expiresAt: number } | undefined;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function googleClientId(): string {
  return requiredEnv("GOOGLE_CLIENT_ID");
}

export function googleClientSecret(): string {
  return requiredEnv("GOOGLE_CLIENT_SECRET");
}

export function appUrl(requestUrl: string): URL {
  const raw = process.env.APP_URL?.trim() || new URL(requestUrl).origin;
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("APP_URL must use HTTPS outside localhost");
  }
  return url;
}

export function safeReturnTo(value: string | null, base: URL): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  try {
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) return "/";
    parsed.searchParams.delete("google");
    parsed.searchParams.delete("reason");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function oauthRedirectUri(base: URL): string {
  return new URL("/api/auth/google/callback", base).toString();
}

export function secureCookies(base: URL): boolean {
  return base.protocol === "https:";
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function signSession(payload: GoogleIdentity & { exp: number }): string {
  const secret = requiredEnv("AUTH_SECRET");
  if (secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySession(value: string | undefined): (GoogleIdentity & { exp: number }) | null {
  if (!value) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(encoded).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as GoogleIdentity & { exp: number };
    if (!payload.sub || !payload.email || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function googleAuthorizationEndpoint(): Promise<string> {
  const metadata = await getDiscovery();
  return metadata.authorization_endpoint;
}

export async function exchangeGoogleCode(code: string, redirectUri: string, verifier: string, nonce: string): Promise<GoogleIdentity> {
  const metadata = await getDiscovery();
  const body = new URLSearchParams({
    code,
    client_id: googleClientId(),
    client_secret: googleClientSecret(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  const response = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google token exchange failed");
  const tokenPayload = (await response.json()) as { id_token?: string };
  if (!tokenPayload.id_token) throw new Error("Google did not return an ID token");
  return verifyGoogleIdToken(tokenPayload.id_token, nonce);
}

async function verifyGoogleIdToken(token: string, expectedNonce: string): Promise<GoogleIdentity> {
  const metadata = await getDiscovery();
  const [encodedHeader, encodedClaims, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedClaims || !encodedSignature) throw new Error("Malformed Google ID token");
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as { alg?: string; kid?: string };
  const claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")) as GoogleClaims;
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported Google ID token signature");

  const keys = await getGoogleKeys(metadata.jwks_uri);
  const jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA" && (!key.alg || key.alg === "RS256"));
  if (!jwk) throw new Error("Google signing key not found");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedClaims}`);
  verifier.end();
  const publicKey = createPublicKey({ key: jwk as import("crypto").JsonWebKey, format: "jwk" });
  if (!verifier.verify(publicKey, Buffer.from(encodedSignature, "base64url"))) throw new Error("Invalid Google ID token signature");

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(googleClientId())) throw new Error("Google ID token audience mismatch");
  if (!["https://accounts.google.com", "accounts.google.com"].includes(claims.iss)) throw new Error("Invalid Google ID token issuer");
  if (!Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) throw new Error("Google ID token expired");
  if (claims.nonce !== expectedNonce) throw new Error("Google ID token nonce mismatch");
  if (!claims.sub || !claims.email || claims.email_verified !== true) throw new Error("Google account email is not verified");
  return { sub: claims.sub, email: claims.email, name: claims.name || claims.email.split("@")[0], picture: claims.picture };
}

async function getDiscovery(): Promise<GoogleDiscovery> {
  if (discoveryCache && discoveryCache.expiresAt > Date.now()) return discoveryCache.value;
  const response = await fetch("https://accounts.google.com/.well-known/openid-configuration", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load Google OpenID configuration");
  const value = (await response.json()) as GoogleDiscovery;
  if (!value.authorization_endpoint || !value.token_endpoint || !value.jwks_uri) throw new Error("Invalid Google OpenID configuration");
  discoveryCache = { value, expiresAt: Date.now() + 60 * 60 * 1000 };
  return value;
}

async function getGoogleKeys(uri: string): Promise<GoogleJwk[]> {
  if (keysCache && keysCache.expiresAt > Date.now()) return keysCache.value;
  const response = await fetch(uri, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load Google signing keys");
  const payload = (await response.json()) as { keys?: GoogleJwk[] };
  if (!Array.isArray(payload.keys)) throw new Error("Invalid Google signing key response");
  keysCache = { value: payload.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return payload.keys;
}
