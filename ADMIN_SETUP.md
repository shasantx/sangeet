# Sangeet admin setup

The admin console uses the existing verified Google session and the server-only `ADMIN_EMAILS` allowlist. User management requires Supabase because the app previously did not save account records.

1. In Supabase Dashboard → SQL Editor, run the contents of `supabase/migrations/20261031000000_admin_user_management.sql` if you have not already.
2. Run the contents of `supabase/migrations/20261031120000_site_controls.sql` to enable the site controls dashboard.
3. Run `supabase/migrations/20261031130000_manual_premium_payments.sql` to enable the $3 manual Premium payment queue and private receipt storage.
4. Run `supabase/migrations/20261031140000_project_donations.sql` to enable open-source support options on the public landing page.
5. In Vercel → Project Settings → Environment Variables, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for Production (and Preview if needed). Copy the project URL and service role key from the same Supabase project. Do not prefix either variable with `NEXT_PUBLIC_`, commit its value, or expose it to the browser.
6. Redeploy the latest commit and sign in to Sangeet again. Sessions create or refresh their profile row. Accounts become visible after their next session check; there was no existing server user table to backfill.
7. Open `/admin` with an account listed in `ADMIN_EMAILS`. `private.shasant@gmail.com` is already in the allowlist. Open **Payments** and save the Premium QR and instructions. In the same panel, enable **Open source donations** and add your separate donation QR and payment instructions. Donation settings appear on the public landing page; Premium payments remain a distinct $3 manual entitlement request.

The panel supports account search, pages of 25 users, manually granting or removing Premium, suspending or restoring accounts, aggregate counts, payment receipt review, donation display settings, site controls, and an audit trail. Approving a submitted payment request enables Premium; rejecting it does not change the user's plan. Configure an HTTPS QR image URL and recipient-specific instructions; this project does not connect to a payment processor and cannot verify a transfer automatically. Receipt images and PDFs are stored in a private Supabase Storage bucket and are only exposed to administrators via short-lived signed links. Site controls manage announcements, new registrations, live music search, and the home page's featured album and playlists. Administrator accounts are protected from status or plan changes. Suspended accounts are rejected and signed out on their next `/api/auth/session` check.

Premium is currently a manual entitlement flag. This project has no billing provider or subscription reconciliation, and changing this flag does not charge a customer. Existing app preferences and listening history remain browser-local.

The `user_profiles`, `admin_audit_log`, and payment tables have RLS enabled and grants revoked for `anon` and `authenticated`; only the server's service role accesses them. The privileged RPC functions are executable by `service_role` only. Local audio imports are saved in browser IndexedDB and remain on that device; clearing browser storage removes them.
