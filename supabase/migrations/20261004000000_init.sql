-- Types
create type public.user_role as enum ('client', 'staff', 'owner');
create type public.order_status as enum ('accepted', 'design', 'printing', 'finishing', 'ready', 'delivered');
create type public.delivery_method as enum ('pickup', 'delivery');

-- Tables
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  logo_url text,
  brand_color text not null default '#2563eb' check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  phone text,
  email text,
  address text,
  work_hours text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  role public.user_role not null default 'client',
  full_name text not null default '',
  phone text,
  email text,
  created_at timestamptz not null default now(),
  unique (id, company_id)
);
create index on public.profiles (company_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  client_id uuid not null,
  number int not null,
  title text not null,
  description text,
  status public.order_status not null default 'accepted',
  due_date date,
  delivery_method public.delivery_method not null default 'pickup',
  delivery_address text,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number),
  foreign key (client_id, company_id) references public.profiles (id, company_id) on delete cascade
);
create index on public.orders (client_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  client_id uuid not null,
  sender_id uuid not null references public.profiles on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (client_id, company_id) references public.profiles (id, company_id) on delete cascade
);
create index on public.messages (company_id, client_id, created_at);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  question text not null,
  answer text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.faqs (company_id, position);

-- Helpers (security definer: avoid RLS recursion on profiles)
create function public.my_company_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create function public.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_staff_of(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and company_id = cid and role in ('staff', 'owner')
  )
$$;

-- Triggers
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  select id into cid from public.companies where slug = new.raw_user_meta_data ->> 'company_slug';
  if cid is null then
    raise exception 'Unknown company';
  end if;
  insert into public.profiles (id, company_id, role, full_name, phone, email)
  values (new.id, cid, 'client', coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          new.raw_user_meta_data ->> 'phone', new.email);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create function public.set_order_number() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.company_id::text));
  select coalesce(max(number), 0) + 1 into new.number from public.orders where company_id = new.company_id;
  return new;
end $$;

create trigger orders_number before insert on public.orders
for each row execute function public.set_order_number();

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger orders_updated_at before update on public.orders
for each row execute function public.touch_updated_at();

-- RLS
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.messages enable row level security;
alter table public.faqs enable row level security;

create policy companies_select on public.companies for select using (true);
create policy companies_update on public.companies for update to authenticated
  using (id = public.my_company_id() and public.my_role() = 'owner')
  with check (id = public.my_company_id());

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff_of(company_id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy orders_select on public.orders for select to authenticated
  using (client_id = auth.uid() or public.is_staff_of(company_id));
create policy orders_insert on public.orders for insert to authenticated
  with check (public.is_staff_of(company_id));
create policy orders_update on public.orders for update to authenticated
  using (public.is_staff_of(company_id)) with check (public.is_staff_of(company_id));
create policy orders_delete on public.orders for delete to authenticated
  using (public.is_staff_of(company_id));

create policy messages_select on public.messages for select to authenticated
  using (client_id = auth.uid() or public.is_staff_of(company_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and company_id = public.my_company_id()
    and (client_id = auth.uid() or public.is_staff_of(company_id))
  );
create policy messages_update on public.messages for update to authenticated
  using (sender_id <> auth.uid() and (client_id = auth.uid() or public.is_staff_of(company_id)))
  with check (client_id = auth.uid() or public.is_staff_of(company_id));

create policy faqs_select on public.faqs for select using (true);
create policy faqs_write on public.faqs for all to authenticated
  using (public.is_staff_of(company_id)) with check (public.is_staff_of(company_id));

-- Column-level restrictions
revoke insert, update, delete on public.companies from anon, authenticated;
grant update (name, logo_url, brand_color, phone, email, address, work_hours) on public.companies to authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
revoke update on public.messages from anon, authenticated;
grant update (read_at) on public.messages to authenticated;
revoke all on public.orders, public.messages from anon;

-- Realtime
alter publication supabase_realtime add table public.messages, public.orders;

-- Storage: public logos, files under "<company_id>/..."
insert into storage.buckets (id, name, public) values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy logos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = public.my_company_id()::text
              and public.my_role() = 'owner');
create policy logos_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = public.my_company_id()::text
         and public.my_role() = 'owner');
create policy logos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = public.my_company_id()::text
         and public.my_role() = 'owner');
