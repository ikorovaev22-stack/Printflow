-- Only real clients can own orders and chat threads
create function public.is_client_of(uid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = uid and company_id = cid and role = 'client')
$$;

drop policy orders_insert on public.orders;
create policy orders_insert on public.orders for insert to authenticated
  with check (public.is_staff_of(company_id) and public.is_client_of(client_id, company_id));
drop policy orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated
  using (public.is_staff_of(company_id))
  with check (public.is_staff_of(company_id) and public.is_client_of(client_id, company_id));

drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and company_id = public.my_company_id()
    and public.is_client_of(client_id, company_id)
    and (client_id = auth.uid() or public.is_staff_of(company_id))
  );

-- Column-level write grants: no forging of number, read_at, created_at, updated_at
revoke insert, update on public.orders from authenticated;
grant insert (company_id, client_id, title, description, status, due_date, delivery_method, delivery_address, comment)
  on public.orders to authenticated;
grant update (client_id, title, description, status, due_date, delivery_method, delivery_address, comment)
  on public.orders to authenticated;
revoke insert on public.messages from authenticated;
grant insert (company_id, client_id, sender_id, body) on public.messages to authenticated;
revoke insert, update on public.faqs from authenticated;
grant insert (company_id, question, answer, position) on public.faqs to authenticated;
grant update (question, answer, position) on public.faqs to authenticated;

-- Logo must live in the company's own folder of the logos bucket
alter table public.companies add constraint companies_logo_url_check
  check (logo_url is null or logo_url ~ ('/storage/v1/object/public/logos/' || id::text || '/[^/]+$'));

-- Storage: owners can list/replace/remove their files; limit size and types
create policy logos_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = public.my_company_id()::text
         and public.my_role() = 'owner');
update storage.buckets
  set file_size_limit = 2097152,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  where id = 'logos';
