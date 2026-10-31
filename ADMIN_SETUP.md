# Sangeet admin setup

The admin console uses the existing verified Google session and the server-only `ADMIN_EMAILS` allowlist. User management requires Supabase because the app previously did not save account records.

1. In Supabase Dashboard → SQL Editor, run the contents of `supabase/migrations/20261031000000_admin_user_management.sql` if you have not already.
2. Run the contents of `supabase/migrations/20261031120000_site_controls.sql` to enable the site controls dashboard.
3. Run `supabase/migrations/20261031150000_open_access_project_donations.sql` to enable optional support QR settings.
4. In Vercel → Project Settings → Environment Variables, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for Production (and Preview if needed). Copy the project URL and service role key from the same Supabase project. Do not prefix either variable with `NEXT_PUBLIC_`, commit its value, or expose it to the browser.
5. Redeploy the latest commit and sign in to Sangeet again. Sessions create or refresh their profile row. Accounts become visible after their next session check; there was no existing server user table to backfill.
6. Open `/admin` with an account listed in `ADMIN_EMAILS`. `private.shasant@gmail.com` is already in the allowlist. Open **Donations** to configure the optional QR and instructions shown on the public landing page. Music features are free; donations do not unlock paid features.

The panel supports member search, pages of 25 users, suspending or restoring accounts, aggregate counts, donation display settings, site controls, and an audit trail. Configure a valid HTTPS QR image URL and short instructions. Site controls manage announcements, new registrations, live music search, and the home page's featured album and playlists. Administrator accounts are protected from status changes. Suspended accounts are rejected and signed out on their next `/api/auth/session` check.

Sangeet has no paid plans or checkout. Donations are optional support only and do not unlock features. Existing app preferences and listening history remain browser-local.

The `user_profiles`, `admin_audit_log`, and donation settings tables have RLS enabled and grants revoked for `anon` and `authenticated`; private records are accessed only by the server's service role. The privileged RPC functions are executable by `service_role` only. Local audio imports are saved in browser IndexedDB and remain on that device; clearing browser storage removes them.
