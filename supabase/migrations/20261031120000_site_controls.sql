create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  announcement_enabled boolean not null default false,
  announcement_text text not null default '',
  signup_enabled boolean not null default true,
  live_search_enabled boolean not null default true,
  featured_album_id text,
  featured_playlist_ids jsonb not null default '["violet-hours", "quiet-luxury", "nocturne-drive"]'::jsonb
    check (jsonb_typeof(featured_playlist_ids) = 'array'),
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;
revoke all on table public.site_settings from anon, authenticated;
grant all on table public.site_settings to service_role;

create or replace function public.admin_update_site_settings(
  p_announcement_enabled boolean,
  p_announcement_text text,
  p_signup_enabled boolean,
  p_live_search_enabled boolean,
  p_featured_album_id text,
  p_featured_playlist_ids jsonb,
  p_actor_email text
)
returns public.site_settings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare updated_settings public.site_settings;
begin
  update public.site_settings
  set announcement_enabled = p_announcement_enabled,
      announcement_text = p_announcement_text,
      signup_enabled = p_signup_enabled,
      live_search_enabled = p_live_search_enabled,
      featured_album_id = p_featured_album_id,
      featured_playlist_ids = p_featured_playlist_ids,
      updated_by = lower(p_actor_email),
      updated_at = now()
  where id = 1
  returning * into updated_settings;

  if not found then
    raise exception 'Site settings row is missing';
  end if;

  insert into public.admin_audit_log (actor_email, target_user_id, action, details)
  values (
    lower(p_actor_email),
    'site',
    'site.settings.updated',
    jsonb_build_object(
      'announcement_enabled', p_announcement_enabled,
      'signup_enabled', p_signup_enabled,
      'live_search_enabled', p_live_search_enabled,
      'featured_album_id', p_featured_album_id,
      'featured_playlist_ids', p_featured_playlist_ids
    )
  );
  return updated_settings;
end;
$$;

revoke execute on function public.admin_update_site_settings(boolean, text, boolean, boolean, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_update_site_settings(boolean, text, boolean, boolean, text, jsonb, text) to service_role;
