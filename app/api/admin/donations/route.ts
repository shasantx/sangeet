import { NextRequest, NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store, max-age=0" } });
}

function config() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Donation database is not configured");
  return { base, key };
}

export async function GET(request: NextRequest) {
  if (!adminSession(request.cookies.get("aura_session")?.value)) return json({ error: "Admin access required." }, 403);
  try {
    const { base, key } = config();
    const response = await fetch(`${base}/rest/v1/project_support_settings?select=enabled,qr_image_url,instructions&id=eq.1`, { cache: "no-store", headers: { apikey: key, authorization: `Bearer ${key}` } });
    if (!response.ok) return json({ error: "Could not load donation settings. Apply the open access donations migration." }, 503);
    const row = (await response.json() as { enabled: boolean; qr_image_url: string; instructions: string }[])[0];
    return json({ enabled: row?.enabled ?? false, qr_image_url: row?.qr_image_url ?? "", instructions: row?.instructions ?? "" });
  } catch {
    return json({ error: "Donation database is not configured." }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  const session = adminSession(request.cookies.get("aura_session")?.value);
  if (!session) return json({ error: "Admin access required." }, 403);
  if (request.headers.get("origin") !== request.nextUrl.origin) return json({ error: "Origin validation failed." }, 403);
  try {
    const body = await request.json() as Record<string, unknown>;
    const enabled = body.enabled === true;
    const qr = typeof body.qr_image_url === "string" ? body.qr_image_url.trim() : "";
    const instructions = typeof body.instructions === "string" ? body.instructions.trim() : "";
    let parsed: URL | undefined;
    try { if (qr) parsed = new URL(qr); } catch { return json({ error: "Enter a valid HTTPS image URL." }, 400); }
    if (parsed && (parsed.protocol !== "https:" || parsed.username || parsed.password) || qr.length > 1000 || instructions.length > 1000) {
      return json({ error: "Use an HTTPS image URL and keep each field under 1,000 characters." }, 400);
    }
    const { base, key } = config();
    const response = await fetch(`${base}/rest/v1/rpc/admin_update_project_support`, {
      method: "POST", cache: "no-store",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ p_enabled: enabled, p_qr_image_url: qr, p_instructions: instructions, p_actor_email: session.email }),
    });
    if (!response.ok) return json({ error: "Could not save donation settings. Apply the open access donations migration." }, 503);
    return json({ ok: true });
  } catch {
    return json({ error: "Could not save donation settings." }, 503);
  }
}
