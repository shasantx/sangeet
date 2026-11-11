import { verifySession } from "@/lib/google-auth";
import { safeCompare } from "@/lib/security";

if (typeof window !== "undefined") {
  throw new Error("lib/admin-auth is a server-only module.");
}

// Keep administrator identities in the deployment environment, never in source.
function getAdminAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const list = getAdminAllowlist();
  let matched = false;
  for (const allowed of list) {
    if (safeCompare(normalized, allowed)) {
      matched = true;
    }
  }
  return matched;
}

export function adminSession(cookie: string | undefined) {
  const session = verifySession(cookie);
  return session && isAdminEmail(session.email) ? session : null;
}
