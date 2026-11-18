create table if not exists public.project_support_settings (
  id smallint primary key check (id = 1),
  enabled boolean not null default false,
  qr_image_url text not null default '',
  instructions text not null default '',
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into public.project_support_settings (id) values (1) on conflict (id) do nothing;
alter table public.project_support_settings enable row level security;
revoke all on public.project_support_settings from anon, authenticated;
grant all on public.project_support_settings to service_role;

create or replace function public.admin_update_project_support(
  p_enabled boolean,
  p_qr_image_url text,
  p_instructions text,
  p_actor_email text
)
returns public.project_support_settings
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare result public.project_support_settings;
begin
  update public.project_support_settings
  set enabled=p_enabled,
      qr_image_url=left(coalesce(p_qr_image_url,''),1000),
      instructions=left(coalesce(p_instructions,''),1000),
      updated_by=lower(p_actor_email),
      updated_at=now()
  where id=1 returning * into result;

  insert into public.admin_audit_log(actor_email,target_user_id,action,details)
  values(lower(p_actor_email),'project-support','donations.settings.updated',jsonb_build_object(
    'enabled',p_enabled,
    'qr_configured',coalesce(p_qr_image_url,'') <> ''
  ));
  return result;
end $$;

revoke execute on function public.admin_update_project_support(boolean,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_update_project_support(boolean,text,text,text) to service_role;
