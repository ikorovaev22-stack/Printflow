-- Chat folders: staff complete a conversation, and any new message brings it back to the active ones.
-- A client whose earlier conversation was completed is a repeat one (a star in the chat list).

-- No row means the chat is active and was never completed
create table public.chats (
  client_id uuid primary key,
  company_id uuid not null references public.companies on delete cascade,
  closed_at timestamptz,
  closed_count int not null default 0 check (closed_count >= 0),
  foreign key (client_id, company_id) references public.profiles (id, company_id) on delete cascade
);
create index on public.chats (company_id);

alter table public.chats enable row level security;
create policy chats_select on public.chats for select to authenticated
  using (public.is_staff_of(company_id));
-- Writes only through close_chat / reopen_chat and the message trigger
revoke all on public.chats from anon, authenticated;
grant select on public.chats to authenticated;

create function public.close_chat(p_client_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  select company_id into cid from public.profiles where id = p_client_id and role = 'client';
  if cid is null or not public.is_staff_of(cid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.chats (client_id, company_id, closed_at, closed_count)
  values (p_client_id, cid, now(), 1)
  on conflict (client_id) do update set closed_at = now(), closed_count = public.chats.closed_count + 1
  where public.chats.closed_at is null;
end $$;

-- Undoes a completion made by mistake, so it does not count
create function public.reopen_chat(p_client_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.chats set closed_at = null, closed_count = closed_count - 1
  where client_id = p_client_id and closed_at is not null and public.is_staff_of(company_id);
end $$;

revoke execute on function public.close_chat(uuid), public.reopen_chat(uuid) from public, anon;
grant execute on function public.close_chat(uuid), public.reopen_chat(uuid) to authenticated;

create function public.reopen_chat_on_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.chats set closed_at = null where client_id = new.client_id and closed_at is not null;
  return new;
end $$;
create trigger messages_reopen_chat after insert on public.messages
for each row execute function public.reopen_chat_on_message();
