import { verifySession } from "@/lib/google-auth";

const allowlist = new Set([
  "private.shasant@gmail.com",
  ...(process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean),
]);

export function isAdminEmail(email: string) {
  return allowlist.has(email.trim().toLowerCase());
}

export function adminSession(cookie: string | undefined) {
  const session = verifySession(cookie);
  return session && isAdminEmail(session.email) ? session : null;
}
