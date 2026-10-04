-- Template release: abuse limits, company time zone, status history, order files, push subscriptions

-- 1. Field length limits
alter table public.companies
  add constraint companies_name_len check (char_length(name) between 1 and 120),
  add constraint companies_phone_len check (phone is null or char_length(phone) <= 40),
  add constraint companies_email_len check (email is null or char_length(email) <= 254),
  add constraint companies_address_len check (address is null or char_length(address) <= 300),
  add constraint companies_work_hours_len check (work_hours is null or char_length(work_hours) <= 200);
alter table public.profiles
  add constraint profiles_full_name_len check (char_length(full_name) <= 120),
  add constraint profiles_phone_len check (phone is null or char_length(phone) <= 40);
alter table public.orders
  add constraint orders_title_len check (char_length(title) between 1 and 200),
  add constraint orders_description_len check (description is null or char_length(description) <= 4000),
  add constraint orders_address_len check (delivery_address is null or char_length(delivery_address) <= 300),
  add constraint orders_comment_len check (comment is null or char_length(comment) <= 2000);
alter table public.faqs
  add constraint faqs_question_len check (char_length(question) between 1 and 300),
  add constraint faqs_answer_len check (char_length(answer) between 1 and 4000);

-- 2. Chat flood protection: at most 20 messages per sender per minute
create index on public.messages (sender_id, created_at);
create function public.limit_message_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'Слишком много сообщений, подождите минуту';
  end if;
  return new;
end $$;
create trigger messages_rate_limit before insert on public.messages
for each row execute function public.limit_message_rate();

-- 3. Logos: raster images only (SVG can carry scripts)
update storage.buckets
  set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
  where id = 'logos';

-- 4. Company time zone (validated by the app against the IANA list)
alter table public.companies
  add column timezone text not null default 'Europe/Moscow' check (char_length(timezone) between 1 and 64);
grant update (timezone) on public.companies to authenticated;

-- Order visibility shared by history, files and storage policies (text form: storage folder names)
create function public.can_access_order(oid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.orders o
    where o.id = oid
      and (o.client_id = auth.uid() or public.is_staff_of(o.company_id))
  )
$$;
create function public.can_access_order_key(oid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.orders o
    where o.id::text = oid
      and (o.client_id = auth.uid() or public.is_staff_of(o.company_id))
  )
$$;

-- 5. Status history: one row per status an order enters
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  status public.order_status not null,
  created_at timestamptz not null default now()
);
create index on public.order_events (order_id, created_at);
alter table public.order_events enable row level security;
create policy order_events_select on public.order_events for select to authenticated
  using (public.can_access_order(order_id));
revoke all on public.order_events from anon, authenticated;
grant select on public.order_events to authenticated;

create function public.log_order_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_events (order_id, company_id, status) values (new.id, new.company_id, new.status);
  end if;
  return new;
end $$;
create trigger orders_status_log after insert or update of status on public.orders
for each row execute function public.log_order_status();

-- Existing orders: the time each entered its current status is unknown, so record creation as "accepted"
-- and the last update as the current status
insert into public.order_events (order_id, company_id, status, created_at)
select id, company_id, 'accepted', created_at from public.orders;
insert into public.order_events (order_id, company_id, status, created_at)
select id, company_id, status, updated_at from public.orders where status <> 'accepted';

-- 6. Order files: layouts from clients, proofs from the print shop
-- Storage path: <company_id>/<order_id>/<random>.<ext>; the original file name lives in the table
create table public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  uploaded_by uuid not null references public.profiles on delete cascade,
  from_client boolean not null default false,
  name text not null check (char_length(name) between 1 and 200),
  path text not null unique check (char_length(path) <= 300),
  size bigint not null check (size between 1 and 52428800),
  mime text check (mime is null or char_length(mime) <= 120),
  created_at timestamptz not null default now()
);
create index on public.order_files (order_id, created_at);
alter table public.order_files enable row level security;

create policy order_files_select on public.order_files for select to authenticated
  using (public.can_access_order(order_id));
create policy order_files_insert on public.order_files for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.can_access_order(order_id)
    and company_id = (select o.company_id from public.orders o where o.id = order_id)
    and path like company_id::text || '/' || order_id::text || '/%'
  );
create policy order_files_delete on public.order_files for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_staff_of(company_id));
revoke all on public.order_files from anon, authenticated;
grant select, delete on public.order_files to authenticated;
grant insert (order_id, company_id, uploaded_by, name, path, size, mime) on public.order_files to authenticated;

-- from_client is derived, never trusted from the request
create function public.set_file_origin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.from_client := exists (select 1 from public.orders o where o.id = new.order_id and o.client_id = new.uploaded_by);
  return new;
end $$;
create trigger order_files_origin before insert on public.order_files
for each row execute function public.set_file_origin();

alter publication supabase_realtime add table public.order_files;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-files', 'order-files', false, 52428800,
  array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/tiff', 'image/heic',
    'image/vnd.adobe.photoshop', 'application/postscript', 'application/illustrator',
    'application/zip', 'application/x-zip-compressed', 'application/vnd.rar', 'application/x-rar-compressed',
    'application/x-7z-compressed', 'application/x-cdr', 'application/cdr', 'application/octet-stream'
  ]
)
on conflict (id) do nothing;

create policy order_files_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'order-files' and public.can_access_order_key((storage.foldername(name))[2]));
create policy order_files_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'order-files'
    and (storage.foldername(name))[1] = public.my_company_id()::text
    and public.can_access_order_key((storage.foldername(name))[2])
  );
create policy order_files_storage_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'order-files'
    and public.can_access_order_key((storage.foldername(name))[2])
    and (owner_id = auth.uid()::text or public.my_role() in ('staff', 'owner'))
  );

-- 7. Web Push subscriptions: each user sees only their own; the server sends with the service role
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- A browser endpoint belongs to whoever subscribed last on that device
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, company_id, endpoint, p256dh, auth)
  values (auth.uid(), public.my_company_id(), p_endpoint, p_p256dh, p_auth);
end $$;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
