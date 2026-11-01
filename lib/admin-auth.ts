import { verifySession } from "@/lib/google-auth";

// Keep administrator identities in the deployment environment, never in source.
const allowlist = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdminEmail(email: string) {
  return allowlist.has(email.trim().toLowerCase());
}

export function adminSession(cookie: string | undefined) {
  const session = verifySession(cookie);
  return session && isAdminEmail(session.email) ? session : null;
}
