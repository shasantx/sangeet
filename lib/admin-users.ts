export type UserPlan = "free" | "premium";
export type UserStatus = "active" | "suspended";

export interface ManagedUser {
  id: string;
  email: string;
  display_name: string;
  picture: string | null;
  plan: UserPlan;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface AdminAuditEntry {
  id: number;
  actor_email: string;
  target_user_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

function config() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Admin database is not configured");
  return { base, key };
}

async function db(path: string, init: RequestInit = {}) {
  const { base, key } = config();
  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

export async function registerGoogleUser(user: { id: string; email: string; name: string; picture?: string }) {
  const response = await db("rpc/register_app_user", {
    method: "POST",
    body: JSON.stringify({ p_id: `google:${user.id}`, p_email: user.email.toLowerCase(), p_name: user.name, p_picture: user.picture ?? null }),
  });
  if (!response.ok) throw new Error(`User profile sync failed (${response.status})`);
}

export async function getManagedUser(id: string): Promise<ManagedUser | null> {
  const params = new URLSearchParams({ id: `eq.${id}`, select: "id,email,display_name,picture,plan,status,created_at,updated_at", limit: "1" });
  const response = await db(`user_profiles?${params}`);
  if (!response.ok) throw new Error(`Profile lookup failed (${response.status})`);
  return ((await response.json()) as ManagedUser[])[0] ?? null;
}

export async function listManagedUsers(query: string, page: number) {
  const params = new URLSearchParams({
    select: "id,email,display_name,picture,plan,status,created_at,updated_at",
    order: "created_at.desc",
    limit: "25",
    offset: String(page * 25),
  });
  const term = query.trim().replace(/[^\w@.+ '-]/g, " ").slice(0, 80);
  if (term) params.set("or", `(email.ilike.*${term}*,display_name.ilike.*${term}*)`);
  const response = await db(`user_profiles?${params}`, { headers: { prefer: "count=exact" } });
  if (!response.ok) throw new Error(`User list failed (${response.status})`);
  const range = response.headers.get("content-range")?.split("/")[1];
  return { users: (await response.json()) as ManagedUser[], total: Number(range) || 0 };
}

async function countWhere(filter: string): Promise<number> {
  const response = await db(`user_profiles?select=id&${filter}`, { method: "HEAD", headers: { prefer: "count=exact" } });
  if (!response.ok) throw new Error(`User count failed (${response.status})`);
  return Number(response.headers.get("content-range")?.split("/")[1]) || 0;
}

export async function getAdminStats() {
  const [total, premium, suspended] = await Promise.all([
    countWhere("id=not.is.null"),
    countWhere("plan=eq.premium"),
    countWhere("status=eq.suspended"),
  ]);
  return { total, premium, suspended };
}

export async function getRecentAdminActions(): Promise<AdminAuditEntry[]> {
  const response = await db("admin_audit_log?select=id,actor_email,target_user_id,action,details,created_at&order=created_at.desc&limit=8");
  if (!response.ok) throw new Error(`Audit history failed (${response.status})`);
  return (await response.json()) as AdminAuditEntry[];
}

export async function updateManagedUser(id: string, changes: { plan?: UserPlan; status?: UserStatus }, actorEmail: string) {
  const response = await db("rpc/admin_update_app_user", {
    method: "POST",
    body: JSON.stringify({ p_id: id, p_plan: changes.plan ?? null, p_status: changes.status ?? null, p_actor_email: actorEmail }),
  });
  if (!response.ok) throw new Error(`User update failed (${response.status})`);
  const value = await response.json() as ManagedUser | null | ManagedUser[];
  const user = Array.isArray(value) ? value[0] : value ?? undefined;
  if (!user) return null;
  return user;
}
