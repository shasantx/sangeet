import { NextRequest, NextResponse } from "next/server";
import { appUrl, secureCookies, signSession } from "@/lib/google-auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { enforceRateLimit, safeCompare, safeJsonParse, verifySameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LoginBody {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  requireAdmin?: unknown;
}

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json(
      { error: "Cross-origin request blocked." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  const rateLimited = enforceRateLimit(request, "auth:login", 15, 60_000);
  if (rateLimited) return rateLimited;

  const parsed = await safeJsonParse<LoginBody>(request, 4096);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status, headers: { "cache-control": "no-store" } },
    );
  }

  const rawEmail = typeof parsed.data?.email === "string" ? parsed.data.email.trim().toLowerCase() : "";
  const rawPassword = typeof parsed.data?.password === "string" ? parsed.data.password : "";
  const rawName = typeof parsed.data?.name === "string" ? parsed.data.name.trim().slice(0, 80) : "";
  const requireAdmin = parsed.data?.requireAdmin === true;

  if (!rawEmail || rawEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const isAdmin = isAdminEmail(rawEmail);

  if (requireAdmin && !isAdmin) {
    return NextResponse.json(
      { error: "Access denied. Only admin emails can sign in here." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  if (isAdmin) {
    const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
    if (configuredPassword && !safeCompare(rawPassword, configuredPassword)) {
      return NextResponse.json(
        { error: "Invalid admin password." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }
  }

  const displayName = rawName || rawEmail.split("@")[0] || "Listener";
  const userId = `email:${rawEmail}`;

  const response = NextResponse.json(
    {
      session: {
        id: userId,
        email: rawEmail,
        name: displayName,
        isAdmin,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );

  try {
    const base = appUrl(request.url);
    const secure = secureCookies(base);
    const sessionCookie = signSession({
      sub: userId,
      email: rawEmail,
      name: displayName,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    });
    response.cookies.set("aura_session", sessionCookie, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  } catch {
    if (requireAdmin) {
      return NextResponse.json(
        { error: "Admin session secret is not configured on the server." },
        { status: 500, headers: { "cache-control": "no-store" } },
      );
    }
  }

  return response;
}
