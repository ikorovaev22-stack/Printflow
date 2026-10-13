-- Company Telegram and promo banners: the owner uploads images in settings, clients see them on the home screen
-- and in "О компании"

-- 1. Telegram username without "@" (the app normalizes t.me links and "@name")
alter table public.companies
  add column telegram text check (telegram is null or telegram ~ '^[A-Za-z0-9_]{5,32}$');
grant update (telegram) on public.companies to authenticated;

-- 2. Banners: image in the public "banners" bucket under "<company_id>/", an optional caption that doubles as alt text
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  path text not null unique,
  title text check (title is null or char_length(title) between 1 and 120),
  position int not null default 0,
  created_at timestamptz not null default now(),
  check (path ~ ('^' || company_id::text || '/[^/]+$'))
);
create index on public.banners (company_id, position);
alter table public.banners enable row level security;

-- Public like the company card: "О компании" opens before signing in
create policy banners_select on public.banners for select using (true);
create policy banners_insert on public.banners for insert to authenticated
  with check (company_id = public.my_company_id() and public.my_role() = 'owner');
create policy banners_update on public.banners for update to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'owner')
  with check (company_id = public.my_company_id());
create policy banners_delete on public.banners for delete to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'owner');
revoke all on public.banners from anon, authenticated;
grant select on public.banners to anon, authenticated;
grant insert (company_id, path, title, position) on public.banners to authenticated;
grant update (title, position) on public.banners to authenticated;
grant delete on public.banners to authenticated;

-- At most 10 banners per company
create function public.limit_banners() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.banners where company_id = new.company_id) >= 10 then
    raise exception 'banner_limit' using errcode = 'P0001', hint = 'Не больше 10 баннеров';
  end if;
  return new;
end $$;
create trigger banners_limit before insert on public.banners
for each row execute function public.limit_banners();

-- 3. Storage: public raster images up to 3 MB, the owner writes only into the company folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banners', 'banners', true, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy banners_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = public.my_company_id()::text
         and public.my_role() = 'owner');
create policy banners_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = public.my_company_id()::text
              and public.my_role() = 'owner');
create policy banners_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = public.my_company_id()::text
         and public.my_role() = 'owner');
