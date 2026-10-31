create table if not exists public.premium_payment_settings (
  id smallint primary key default 1 check (id = 1),
  amount_usd numeric(6,2) not null default 3.00 check (amount_usd = 3.00),
  qr_image_url text not null default '',
  payment_instructions text not null default '',
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.premium_payment_settings (id) values (1) on conflict (id) do nothing;
alter table public.premium_payment_settings enable row level security;
revoke all on public.premium_payment_settings from anon, authenticated;
grant all on public.premium_payment_settings to service_role;

create table if not exists public.premium_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.user_profiles(id) on delete cascade,
  amount_usd numeric(6,2) not null default 3.00 check (amount_usd = 3.00),
  proof_path text not null,
  payment_reference text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text not null default '',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists premium_payment_requests_status_idx on public.premium_payment_requests(status, created_at desc);
create index if not exists premium_payment_requests_user_idx on public.premium_payment_requests(user_id, created_at desc);
create unique index if not exists premium_payment_requests_one_pending_idx on public.premium_payment_requests(user_id) where status = 'pending';
alter table public.premium_payment_requests enable row level security;
revoke all on public.premium_payment_requests from anon, authenticated;
grant all on public.premium_payment_requests to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

create or replace function public.admin_review_premium_payment(p_request_id uuid, p_status text, p_actor_email text, p_note text default '')
returns public.premium_payment_requests
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare payment public.premium_payment_requests; user_id_value text;
begin
  if p_status not in ('approved','rejected') then raise exception 'Invalid review status'; end if;
  update public.premium_payment_requests
  set status = p_status, review_note = left(coalesce(p_note,''), 500), reviewed_by = lower(p_actor_email), reviewed_at = now()
  where id = p_request_id and status = 'pending' returning * into payment;
  if not found then raise exception 'Payment request is missing or already reviewed'; end if;
  if p_status = 'approved' then
    update public.user_profiles set plan = 'premium', updated_at = now() where id = payment.user_id;
  end if;
  insert into public.admin_audit_log(actor_email,target_user_id,action,details)
  values(lower(p_actor_email),payment.user_id,'payment.'||p_status,jsonb_build_object('request_id',p_request_id,'amount_usd',3,'note',left(coalesce(p_note,''),500)));
  return payment;
end $$;
revoke execute on function public.admin_review_premium_payment(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_review_premium_payment(uuid,text,text,text) to service_role;

create or replace function public.admin_update_payment_settings(p_qr_image_url text, p_payment_instructions text, p_actor_email text)
returns public.premium_payment_settings
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare result public.premium_payment_settings;
begin
  update public.premium_payment_settings set qr_image_url=left(p_qr_image_url,1000), payment_instructions=left(p_payment_instructions,1000), updated_by=lower(p_actor_email), updated_at=now()
  where id=1 returning * into result;
  insert into public.admin_audit_log(actor_email,target_user_id,action,details)
  values(lower(p_actor_email),'payments','payment.settings.updated',jsonb_build_object('qr_configured',p_qr_image_url <> ''));
  return result;
end $$;
revoke execute on function public.admin_update_payment_settings(text,text,text) from public, anon, authenticated;
grant execute on function public.admin_update_payment_settings(text,text,text) to service_role;
