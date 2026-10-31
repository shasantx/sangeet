import { NextRequest, NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-auth";
import { verifySession } from "@/lib/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dbConfig() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase server variables are not configured");
  return { base, key };
}
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "cache-control": "no-store, max-age=0" } }); }
async function rest(path: string, init: RequestInit = {}) {
  const { base, key } = dbConfig();
  return fetch(`${base}/rest/v1/${path}`, { ...init, cache: "no-store", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...init.headers } });
}
async function signProof(path: string) {
  const { base, key } = dbConfig();
  const result = await fetch(`${base}/storage/v1/object/sign/payment-proofs/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 3600 }), cache: "no-store",
  });
  if (!result.ok) return "";
  const body = await result.json() as { signedURL?: string };
  return body.signedURL?.startsWith("/") ? `${base}/storage/v1${body.signedURL}` : body.signedURL ?? "";
}

export async function GET(request: NextRequest) {
  try {
    const settingsResponse = await rest("premium_payment_settings?select=amount_usd,qr_image_url,payment_instructions,donation_enabled,donation_qr_image_url,donation_instructions&id=eq.1");
    if (!settingsResponse.ok) return json({ error: "Apply the manual Premium payments migration first." }, 503);
    const settings = (await settingsResponse.json() as { amount_usd: number; qr_image_url: string; payment_instructions: string }[])[0];
    const session = verifySession(request.cookies.get("aura_session")?.value);
    if (!session) return json({ settings, requests: [] });
    const id = `google:${session.sub}`;
    if (adminSession(request.cookies.get("aura_session")?.value)) {
      const response = await rest("premium_payment_requests?select=*,user_profiles!inner(email,display_name)&order=created_at.desc&limit=100");
      if (!response.ok) return json({ error: "Could not load payment requests." }, 503);
      const rows = await response.json() as Array<Record<string, unknown> & { proof_path: string }>;
      return json({ settings, requests: await Promise.all(rows.map(async (row) => ({ ...row, proof_url: await signProof(row.proof_path) }))) });
    }
    const response = await rest(`premium_payment_requests?select=id,status,review_note,created_at,reviewed_at&user_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=10`);
    if (!response.ok) return json({ error: "Could not load your payment status." }, 503);
    const profileResponse = await rest(`user_profiles?select=plan&id=eq.${encodeURIComponent(id)}&limit=1`);
    const profile = profileResponse.ok ? (await profileResponse.json() as { plan: string }[])[0] : undefined;
    return json({ settings, requests: await response.json(), user_plan: profile?.plan ?? "free" });
  } catch { return json({ error: "Payment services are not configured yet." }, 503); }
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return json({ error: "Origin validation failed." }, 403);
  const session = verifySession(request.cookies.get("aura_session")?.value);
  if (!session) return json({ error: "Sign in to request Premium." }, 401);
  try {
    const form = await request.formData();
    const proof = form.get("proof");
    const reference = String(form.get("reference") ?? "").trim().slice(0, 120);
    if (!(proof instanceof File) || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(proof.type) || proof.size > 5 * 1024 * 1024) return json({ error: "Upload a JPG, PNG, WebP or PDF proof under 5 MB." }, 400);
    const userId = `google:${session.sub}`;
    const pending = await rest(`premium_payment_requests?select=id&user_id=eq.${encodeURIComponent(userId)}&status=eq.pending&limit=1`);
    if (!pending.ok) return json({ error: "Payment database is unavailable." }, 503);
    if ((await pending.json() as unknown[]).length) return json({ error: "You already have a payment awaiting review." }, 409);
    const { base, key } = dbConfig();
    const ext = proof.type === "application/pdf" ? "pdf" : proof.type.split("/")[1];
    const path = `${session.sub}/${crypto.randomUUID()}.${ext}`;
    const upload = await fetch(`${base}/storage/v1/object/payment-proofs/${path.split("/").map(encodeURIComponent).join("/")}`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": proof.type, "x-upsert": "false" }, body: await proof.arrayBuffer(), cache: "no-store" });
    if (!upload.ok) return json({ error: "Could not store your proof. Check the payment storage migration." }, 503);
    const created = await rest("premium_payment_requests", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: userId, proof_path: path, payment_reference: reference }) });
    if (!created.ok) return json({ error: "Could not submit the payment request." }, 503);
    return json({ request: (await created.json() as unknown[])[0] }, 201);
  } catch { return json({ error: "Could not submit payment proof." }, 503); }
}

export async function PATCH(request: NextRequest) {
  const session = adminSession(request.cookies.get("aura_session")?.value);
  if (!session) return json({ error: "Admin access required." }, 403);
  if (request.headers.get("origin") !== request.nextUrl.origin) return json({ error: "Origin validation failed." }, 403);
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "settings") {
      const qr = typeof body.qr_image_url === "string" ? body.qr_image_url.trim() : "";
      const instructions = typeof body.payment_instructions === "string" ? body.payment_instructions.trim() : "";
      const donationQr = typeof body.donation_qr_image_url === "string" ? body.donation_qr_image_url.trim() : "";
      const donationInstructions = typeof body.donation_instructions === "string" ? body.donation_instructions.trim() : "";
      const donationEnabled = body.donation_enabled === true;
      if (qr && (!/^https:\/\//i.test(qr) || qr.length > 1000) || donationQr && (!/^https:\/\//i.test(donationQr) || donationQr.length > 1000) || instructions.length > 1000 || donationInstructions.length > 1000) return json({ error: "Use HTTPS QR image URLs and instructions under 1,000 characters." }, 400);
      const result = await rest("rpc/admin_update_payment_settings", { method: "POST", body: JSON.stringify({ p_qr_image_url: qr, p_payment_instructions: instructions, p_donation_enabled: donationEnabled, p_donation_qr_image_url: donationQr, p_donation_instructions: donationInstructions, p_actor_email: session.email }) });
      return result.ok ? json({ settings: (await result.json()) }) : json({ error: "Could not save payment settings. Apply the payment migration." }, 503);
    }
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[0-9a-f-]{36}$/i.test(id) || !["approved", "rejected"].includes(String(body.status))) return json({ error: "Choose a valid request and decision." }, 400);
    const result = await rest("rpc/admin_review_premium_payment", { method: "POST", body: JSON.stringify({ p_request_id: id, p_status: body.status, p_actor_email: session.email, p_note: typeof body.note === "string" ? body.note.slice(0, 500) : "" }) });
    return result.ok ? json({ request: await result.json() }) : json({ error: "This request may already be reviewed. Refresh and try again." }, 409);
  } catch { return json({ error: "Could not update payment settings." }, 503); }
}
