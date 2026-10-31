import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function config() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Donation settings are unavailable");
  return { base, key };
}

export async function GET() {
  const headers = { "cache-control": "no-store, max-age=0" };
  try {
    const { base, key } = config();
    const response = await fetch(`${base}/rest/v1/project_support_settings?select=enabled,qr_image_url,instructions&id=eq.1`, {
      cache: "no-store",
      headers: { apikey: key, authorization: `Bearer ${key}` },
    });
    if (!response.ok) return NextResponse.json({ enabled: false }, { status: 503, headers });
    const row = (await response.json() as { enabled: boolean; qr_image_url: string; instructions: string }[])[0];
    return NextResponse.json({ enabled: row?.enabled ?? false, qrImageUrl: row?.qr_image_url ?? "", instructions: row?.instructions ?? "" }, { headers });
  } catch {
    return NextResponse.json({ enabled: false }, { status: 503, headers });
  }
}
