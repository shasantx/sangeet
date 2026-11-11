import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function config() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Donation settings are unavailable");
  return { base, key };
}

export async function GET(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, "donations:get", 60, 60_000);
  if (rateLimited) return rateLimited;

  const headers = { "cache-control": "no-store, max-age=0" };
  try {
    const { base, key } = config();
    const response = await fetch(
      `${base}/rest/v1/project_support_settings?select=enabled,qr_image_url,instructions&id=eq.1`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
        headers: { apikey: key, authorization: `Bearer ${key}` },
      },
    );
    if (!response.ok) return NextResponse.json({ enabled: false }, { status: 503, headers });
    const row = ((await response.json()) as { enabled: boolean; qr_image_url: string; instructions: string }[])[0];
    const safeQr =
      typeof row?.qr_image_url === "string" && row.qr_image_url.startsWith("https://")
        ? row.qr_image_url.slice(0, 1000)
        : "";
    return NextResponse.json(
      {
        enabled: row?.enabled === true,
        qrImageUrl: safeQr,
        instructions: typeof row?.instructions === "string" ? row.instructions.slice(0, 1000) : "",
      },
      { headers },
    );
  } catch {
    return NextResponse.json({ enabled: false }, { status: 503, headers });
  }
}
