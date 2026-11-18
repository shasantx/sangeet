alter table public.premium_payment_settings
  add column if not exists donation_enabled boolean not null default false,
  add column if not exists donation_qr_image_url text not null default '',
  add column if not exists donation_instructions text not null default '';

drop function if exists public.admin_update_payment_settings(text, text, text);
create or replace function public.admin_update_payment_settings(
  p_qr_image_url text,
  p_payment_instructions text,
  p_donation_enabled boolean,
  p_donation_qr_image_url text,
  p_donation_instructions text,
  p_actor_email text
)
returns public.premium_payment_settings
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare result public.premium_payment_settings;
begin
  update public.premium_payment_settings
  set qr_image_url=left(p_qr_image_url,1000),
      payment_instructions=left(p_payment_instructions,1000),
      donation_enabled=p_donation_enabled,
      donation_qr_image_url=left(p_donation_qr_image_url,1000),
      donation_instructions=left(p_donation_instructions,1000),
      updated_by=lower(p_actor_email),
      updated_at=now()
  where id=1 returning * into result;
  insert into public.admin_audit_log(actor_email,target_user_id,action,details)
  values(lower(p_actor_email),'payments','payment.settings.updated',jsonb_build_object(
    'premium_qr_configured',p_qr_image_url <> '',
    'donations_enabled',p_donation_enabled,
    'donation_qr_configured',p_donation_qr_image_url <> ''
  ));
  return result;
end $$;
revoke execute on function public.admin_update_payment_settings(text,text,boolean,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_update_payment_settings(text,text,boolean,text,text,text) to service_role;
