create table if not exists public.user_profiles (
  id text primary key,
  email text not null,
  display_name text not null default 'Listener',
  picture text,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_email_lower_idx on public.user_profiles (lower(email));
create index if not exists user_profiles_created_at_idx on public.user_profiles (created_at desc);
alter table public.user_profiles enable row level security;
revoke all on table public.user_profiles from anon, authenticated;
grant all on table public.user_profiles to service_role;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_email text not null,
  target_user_id text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from anon, authenticated;
grant all on table public.admin_audit_log to service_role;
grant usage, select on sequence public.admin_audit_log_id_seq to service_role;

create or replace function public.register_app_user(p_id text, p_email text, p_name text, p_picture text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.user_profiles (id, email, display_name, picture)
  values (p_id, lower(p_email), coalesce(nullif(trim(p_name), ''), split_part(p_email, '@', 1)), p_picture)
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    picture = excluded.picture,
    updated_at = now();
end;
$$;

revoke execute on function public.register_app_user(text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_app_user(text, text, text, text) to service_role;

create or replace function public.admin_update_app_user(p_id text, p_plan text, p_status text, p_actor_email text)
returns public.user_profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare updated_user public.user_profiles;
begin
  update public.user_profiles
  set plan = coalesce(p_plan, plan), status = coalesce(p_status, status), updated_at = now()
  where id = p_id
  returning * into updated_user;

  if not found then
    return null;
  end if;

  insert into public.admin_audit_log (actor_email, target_user_id, action, details)
  values (lower(p_actor_email), p_id, 'user.updated', jsonb_strip_nulls(jsonb_build_object('plan', p_plan, 'status', p_status)));
  return updated_user;
end;
$$;

revoke execute on function public.admin_update_app_user(text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_update_app_user(text, text, text, text) to service_role;
