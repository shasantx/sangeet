create table if not exists public.sangeet_device_presence (
  user_id text not null references public.user_profiles(id) on delete cascade,
  device_id text not null,
  device_name text not null,
  device_type text not null default 'browser',
  is_playing boolean not null default false,
  current_time double precision not null default 0,
  current_track jsonb,
  command_id text,
  command jsonb,
  last_seen timestamptz not null default now(),
  primary key (user_id, device_id),
  constraint sangeet_device_id_format check (device_id ~ '^[A-Za-z0-9_-]{16,80}$'),
  constraint sangeet_device_time_valid check (current_time >= 0 and current_time <= 86400)
);

create index if not exists sangeet_device_presence_last_seen_idx
  on public.sangeet_device_presence (user_id, last_seen desc);

alter table public.sangeet_device_presence enable row level security;
revoke all on table public.sangeet_device_presence from anon, authenticated;
grant all on table public.sangeet_device_presence to service_role;
