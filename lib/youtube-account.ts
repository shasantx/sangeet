import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function config() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY ?? "";
  if (!base || !key) throw new Error("Database storage is not configured");
  if (!/^[\da-f]{64}$/i.test(secret)) throw new Error("YOUTUBE_TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters");
  return { base, key, secret: Buffer.from(secret, "hex") };
}

export interface YouTubeTokens { access_token: string; refresh_token: string; expires_at: number; }
interface Encrypted { iv: string; tag: string; data: string; }

export function isYouTubeTokenStorageConfigured() {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && /^[\da-f]{64}$/i.test(process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY ?? ""));
}

function encrypt(tokens: YouTubeTokens): Encrypted {
  const { secret } = config();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(tokens)), cipher.final()]);
  return { iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), data: data.toString("base64url") };
}

function decrypt(value: Encrypted): YouTubeTokens {
  const { secret } = config();
  const decipher = createDecipheriv("aes-256-gcm", secret, Buffer.from(value.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, "base64url")), decipher.final()]).toString("utf8")) as YouTubeTokens;
}

async function db(path: string, init?: RequestInit) {
  const { base, key } = config();
  return fetch(`${base}/rest/v1/${path}`, { ...init, cache: "no-store", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...init?.headers } });
}

export async function saveYouTubeTokens(userId: string, tokens: YouTubeTokens, scopes: string[]) {
  const response = await db("youtube_connections?on_conflict=user_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: userId, encrypted_tokens: encrypt(tokens), scopes, updated_at: new Date().toISOString() }) });
  if (!response.ok) throw new Error("Could not save connection");
}

export async function getYouTubeTokens(userId: string): Promise<YouTubeTokens | null> {
  const params = new URLSearchParams({ user_id: `eq.${userId}`, select: "encrypted_tokens", limit: "1" });
  const response = await db(`youtube_connections?${params}`);
  if (!response.ok) throw new Error("Could not load connection");
  const rows = await response.json() as { encrypted_tokens: Encrypted }[];
  return rows[0] ? decrypt(rows[0].encrypted_tokens) : null;
}

export async function getYouTubeConnectionStatus(userId: string) {
  const params = new URLSearchParams({ user_id: `eq.${userId}`, select: "connected_at,scopes", limit: "1" });
  const response = await db(`youtube_connections?${params}`);
  if (!response.ok) throw new Error("Could not load connection");
  const rows = await response.json() as { connected_at: string; scopes: string[] }[];
  return rows[0] ? { connected: true, connectedAt: rows[0].connected_at, scopes: rows[0].scopes } : { connected: false, connectedAt: null, scopes: [] };
}

export async function deleteYouTubeConnection(userId: string) {
  const response = await db(`youtube_connections?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Could not remove connection");
}

export async function refreshYouTubeAccessToken(userId: string): Promise<string> {
  const tokens = await getYouTubeTokens(userId);
  if (!tokens) throw new Error("YouTube account is not connected");
  if (tokens.expires_at > Date.now() + 60_000) return tokens.access_token;
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", refresh_token: tokens.refresh_token, grant_type: "refresh_token" }), cache: "no-store" });
  if (!response.ok) throw new Error("YouTube authorization expired. Reconnect your account.");
  const value = await response.json() as { access_token: string; expires_in: number; scope?: string };
  const updated = { ...tokens, access_token: value.access_token, expires_at: Date.now() + value.expires_in * 1000 };
  await saveYouTubeTokens(userId, updated, ["https://www.googleapis.com/auth/youtube.readonly"]);
  return updated.access_token;
}
