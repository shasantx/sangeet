create table if not exists public.youtube_connections (
  user_id text primary key references public.user_profiles(id) on delete cascade,
  encrypted_tokens jsonb not null,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.youtube_connections enable row level security;
revoke all on table public.youtube_connections from anon, authenticated;
grant all on table public.youtube_connections to service_role;
