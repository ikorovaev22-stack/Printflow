-- 152-ФЗ: when a client agreed to personal data processing at sign-up.
-- Null for accounts created by staff or scripts (owners, managers, demo data).
alter table public.profiles add column pd_consent_at timestamptz;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  select id into cid from public.companies where slug = new.raw_user_meta_data ->> 'company_slug';
  if cid is null then
    raise exception 'Unknown company';
  end if;
  insert into public.profiles (id, company_id, role, full_name, phone, email, pd_consent_at)
  values (new.id, cid, 'client', coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          new.raw_user_meta_data ->> 'phone', new.email,
          case when new.raw_user_meta_data ->> 'pd_consent' = 'true' then now() end);
  return new;
end $$;
