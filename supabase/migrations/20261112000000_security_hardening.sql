-- Defense-in-depth RLS enforcement and column length/format constraints
-- Ensures that even if default privileges are altered, anon and authenticated roles cannot read or mutate rows directly.

alter table if exists public.user_profiles force row level security;
alter table if exists public.admin_audit_log force row level security;
alter table if exists public.site_settings force row level security;
alter table if exists public.premium_payment_settings force row level security;
alter table if exists public.premium_payment_requests force row level security;
alter table if exists public.project_support_settings force row level security;
alter table if exists public.user_library_state force row level security;
alter table if exists public.youtube_connections force row level security;
alter table if exists public.sangeet_device_presence force row level security;

drop policy if exists "deny_anon_authenticated_user_profiles" on public.user_profiles;
create policy "deny_anon_authenticated_user_profiles" on public.user_profiles
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists "deny_anon_authenticated_admin_audit_log" on public.admin_audit_log;
create policy "deny_anon_authenticated_admin_audit_log" on public.admin_audit_log
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists "deny_anon_authenticated_site_settings" on public.site_settings;
create policy "deny_anon_authenticated_site_settings" on public.site_settings
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists "deny_anon_authenticated_premium_payment_settings" on public.premium_payment_settings;
create policy "deny_anon_authenticated_premium_payment_settings" on public.premium_payment_settings
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists "deny_anon_authenticated_premium_payment_requests" on public.premium_payment_requests;
create policy "deny_anon_authenticated_premium_payment_requests" on public.premium_payment_requests
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists "deny_anon_authenticated_project_support_settings" on public.project_support_settings;
create policy "deny_anon_authenticated_project_support_settings" on public.project_support_settings
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists "deny_anon_authenticated_user_library_state" on public.user_library_state;
create policy "deny_anon_authenticated_user_library_state" on public.user_library_state
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists "deny_anon_authenticated_youtube_connections" on public.youtube_connections;
create policy "deny_anon_authenticated_youtube_connections" on public.youtube_connections
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists "deny_anon_authenticated_sangeet_device_presence" on public.sangeet_device_presence;
create policy "deny_anon_authenticated_sangeet_device_presence" on public.sangeet_device_presence
  as restrictive for all to anon, authenticated using (false) with check (false);

alter table if exists public.user_profiles
  drop constraint if exists user_profiles_bounds_check,
  add constraint user_profiles_bounds_check check (
    char_length(id) <= 220
    and char_length(email) <= 320
    and char_length(display_name) <= 120
    and (picture is null or (char_length(picture) <= 1000 and picture ~ '^https://'))
  );

alter table if exists public.site_settings
  drop constraint if exists site_settings_bounds_check,
  add constraint site_settings_bounds_check check (
    char_length(announcement_text) <= 240
  );

alter table if exists public.project_support_settings
  drop constraint if exists project_support_settings_bounds_check,
  add constraint project_support_settings_bounds_check check (
    char_length(qr_image_url) <= 1000
    and char_length(instructions) <= 1000
    and (qr_image_url = '' or qr_image_url ~ '^https://')
  );

alter table if exists public.user_library_state
  drop constraint if exists user_library_state_size_check,
  add constraint user_library_state_size_check check (
    octet_length(library::text) <= 262144
  );
