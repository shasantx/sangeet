import { NextRequest, NextResponse } from "next/server";
import { adminSession, isAdminEmail } from "@/lib/admin-auth";
import { getAdminStats, getManagedUser, getRecentAdminActions, listManagedUsers, updateManagedUser } from "@/lib/admin-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store, max-age=0" } });
}

function isConfiguredError(error: unknown) {
  return error instanceof Error && error.message.includes("not configured");
}

export async function GET(request: NextRequest) {
  const session = adminSession(request.cookies.get("aura_session")?.value);
  if (!session) return json({ error: "Admin access required." }, 403);
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const page = Math.max(0, Math.min(1000, Number(request.nextUrl.searchParams.get("page")) || 0));
  try {
    const [users, stats, actions] = await Promise.all([
      listManagedUsers(query, page),
      getAdminStats(),
      getRecentAdminActions(),
    ]);
    return json({ ...users, users: users.users.map((user) => ({ ...user, is_admin: isAdminEmail(user.email) })), stats, actions, page });
  } catch (error) {
    if (isConfiguredError(error)) return json({ error: "Admin database is not configured. Add the Supabase server secrets and apply the admin migration." }, 503);
    return json({ error: "Could not load admin data. Confirm the Supabase migration is applied." }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  const session = adminSession(request.cookies.get("aura_session")?.value);
  if (!session) return json({ error: "Admin access required." }, 403);
  if (request.headers.get("origin") !== request.nextUrl.origin) return json({ error: "Origin validation failed." }, 403);

  let body: { id?: unknown; plan?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const id = typeof body.id === "string" ? body.id : "";
  const changes: { plan?: "free" | "premium"; status?: "active" | "suspended" } = {};
  if (body.plan === "free" || body.plan === "premium") changes.plan = body.plan;
  if (body.status === "active" || body.status === "suspended") changes.status = body.status;
  if (!id.startsWith("google:") || id.length > 220 || !Object.keys(changes).length) return json({ error: "Choose a valid user and change." }, 400);

  try {
    const target = await getManagedUser(id);
    if (!target) return json({ error: "User not found." }, 404);
    if (isAdminEmail(target.email)) return json({ error: "Administrator accounts are protected from plan and status changes." }, 403);
    const user = await updateManagedUser(id, changes, session.email);
    return user ? json({ user }) : json({ error: "User not found." }, 404);
  } catch (error) {
    if (isConfiguredError(error)) return json({ error: "Admin database is not configured." }, 503);
    return json({ error: "Could not save the user change. Confirm the admin migration is applied." }, 503);
  }
}
