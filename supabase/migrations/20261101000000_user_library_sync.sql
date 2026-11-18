create table if not exists public.user_library_state (
  user_id text primary key references public.user_profiles(id) on delete cascade,
  library jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_library_state enable row level security;
revoke all on table public.user_library_state from anon, authenticated;
grant all on table public.user_library_state to service_role;
