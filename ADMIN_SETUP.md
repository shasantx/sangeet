# Sangeet admin setup

The admin console uses the existing verified Google session and the server-only `ADMIN_EMAILS` allowlist. User management requires Supabase because the app previously did not save account records.

1. In Supabase Dashboard → SQL Editor, run `supabase/migrations/20261031000000_admin_user_management.sql`.
2. In Vercel → Project Settings → Environment Variables, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for Production (and Preview if needed). Copy the project URL and service role key from Supabase API settings. Do not prefix either variable with `NEXT_PUBLIC_`, commit its value, or expose it to the browser.
3. Redeploy the latest commit and sign in to Sangeet again. Sessions create or refresh their profile row. Accounts become visible after their next session check; there was no existing server user table to backfill.
4. Open `/admin` with an account listed in `ADMIN_EMAILS`. `private.shasant@gmail.com` is already in the allowlist.

The panel supports account search, pages of 25 users, manually granting or removing Premium, suspending or restoring accounts, aggregate counts, and an audit trail. Administrator accounts are protected from status or plan changes. Suspended accounts are rejected and signed out on their next `/api/auth/session` check.

Premium is currently a manual entitlement flag. This project has no billing provider or subscription reconciliation, and changing this flag does not charge a customer. Existing app preferences and listening history remain browser-local.

The `user_profiles` and `admin_audit_log` tables have RLS enabled and grants revoked for `anon` and `authenticated`; only the server's service role accesses them. The privileged RPC functions are executable by `service_role` only.
