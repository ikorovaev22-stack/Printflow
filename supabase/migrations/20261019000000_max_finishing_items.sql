-- MAX messenger in the company card, the "Постпечать" stage as an option, room in the price list for own items

-- 1. MAX: a profile link (max.ru/u/<id>; channels and bots: max.ru/<name>) and the number the account is on.
-- The app normalizes the link to https://max.ru/...
alter table public.companies
  add column max_url text check (max_url is null or (char_length(max_url) <= 300 and max_url ~ '^https://max\.ru/[A-Za-z0-9_@./?=&%-]+$')),
  add column max_phone text check (max_phone is null or char_length(max_phone) <= 40);
grant update (max_url, max_phone) on public.companies to authenticated;

-- 2. "Постпечать" (cutting, lamination, binding between printing and ready) can be switched off per company.
-- Switching it off moves the orders that are in it back to "Печать"; while it is off, no order can enter it.
alter table public.companies add column finishing_stage boolean not null default true;
grant update (finishing_stage) on public.companies to authenticated;

create function public.check_finishing_stage() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'finishing'
     and not (select finishing_stage from public.companies where id = new.company_id) then
    raise exception 'finishing_disabled' using errcode = 'P0001', hint = 'Этап «Постпечать» выключен в настройках';
  end if;
  return new;
end $$;
create trigger orders_finishing_stage before insert or update of status on public.orders
for each row execute function public.check_finishing_stage();

create function public.drop_finishing_stage() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set status = 'printing' where company_id = new.id and status = 'finishing';
  return new;
end $$;
create trigger companies_finishing_stage after update of finishing_stage on public.companies
for each row when (old.finishing_stage and not new.finishing_stage)
execute function public.drop_finishing_stage();

-- 3. Own items in the calculator (src/lib/pricing.ts): a few dozen of them do not fit into 16 KB
alter table public.price_lists drop constraint price_lists_config_check;
alter table public.price_lists
  add constraint price_lists_config_check check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 262144);
