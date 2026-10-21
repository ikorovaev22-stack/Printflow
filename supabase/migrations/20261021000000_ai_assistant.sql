-- AI assistant: three prompts, a knowledge base, Q&A templates for the autoresponder, drafts that staff check before
-- they are published (chat replies, news, FAQ entries) and news for clients. The owner sets it up; the model is called
-- from the server only (OpenAI-compatible API, see AI_BASE_URL in .env.example).

-- 1. Autoresponder mode; no row means it is off
create table public.ai_settings (
  company_id uuid primary key references public.companies on delete cascade,
  mode text not null default 'off' check (mode in ('off', 'draft', 'auto')),
  -- Sent to the client when the assistant passes a question to a manager (auto mode)
  handoff_text text check (handoff_text is null or char_length(handoff_text) between 1 and 500),
  updated_at timestamptz not null default now()
);

-- 2. Three permanent prompts; no row means the built-in default
create table public.ai_prompts (
  company_id uuid not null references public.companies on delete cascade,
  kind text not null check (kind in ('reply', 'knowledge', 'content')),
  body text not null check (char_length(body) between 1 and 8000),
  updated_at timestamptz not null default now(),
  primary key (company_id, kind)
);

-- 3. Knowledge base: entries written by hand or read from a public page of the print shop's site (url)
create table public.ai_knowledge (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 20000),
  url text check (url is null or (char_length(url) <= 2000 and url ~ '^https?://')),
  fetched_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ai_knowledge (company_id, created_at);
create trigger ai_knowledge_updated_at before update on public.ai_knowledge
for each row execute function public.touch_updated_at();

-- 4. Q&A templates: the autoresponder answers matching questions with these words
create table public.ai_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  question text not null check (char_length(question) between 1 and 500),
  answer text not null check (char_length(answer) between 1 and 4000),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.ai_templates (company_id, position);

-- 5. News and promos for clients; published only from a checked draft
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index on public.posts (company_id, created_at desc);

-- 6. Drafts. reply: an answer to a client's chat message (or a handoff to a manager, without text);
-- post: news; faq: an entry for "Вопросы и ответы"
create table public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  kind text not null check (kind in ('reply', 'post', 'faq')),
  status text not null default 'pending' check (status in ('pending', 'published', 'dismissed')),
  client_id uuid,
  message_id uuid references public.messages on delete set null,
  title text check (title is null or char_length(title) <= 300),
  body text check (body is null or char_length(body) <= 5000),
  handoff boolean not null default false,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles on delete set null,
  foreign key (client_id, company_id) references public.profiles (id, company_id) on delete cascade,
  check ((kind = 'reply') = (client_id is not null)),
  check (handoff = (body is null)),
  check (not handoff or kind = 'reply')
);
create index on public.ai_drafts (company_id, status, kind);
create index on public.ai_drafts (client_id, created_at);

-- A decision is final; it is stamped with who made it. Only status and text count: deleting the answered message
-- clears message_id of a decided draft
create function public.ai_drafts_decide() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'pending' then
    raise exception 'draft_decided' using errcode = 'P0001';
  end if;
  if new.status <> old.status then
    new.decided_at := now();
    new.decided_by := auth.uid();
  end if;
  return new;
end $$;
create trigger ai_drafts_decide before update of status, title, body on public.ai_drafts
for each row execute function public.ai_drafts_decide();

-- 7. Messages written by the assistant itself (auto mode): no sender, marked "ai". from_client stays boolean
alter table public.messages add column ai boolean not null default false;
alter table public.messages alter column sender_id drop not null;
alter table public.messages add constraint messages_sender_or_ai check (sender_id is not null or ai);
alter table public.messages drop column from_client;
alter table public.messages add column from_client boolean generated always as (coalesce(sender_id = client_id, false)) stored;
create index on public.messages (company_id, from_client) where read_at is null;
-- Clients mark the assistant's messages as read too (sender is null)
drop policy messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
  using (sender_id is distinct from auth.uid() and (client_id = auth.uid() or public.is_staff_of(company_id)))
  with check (client_id = auth.uid() or public.is_staff_of(company_id));

-- A manager's own message settles the assistant's pending reply and handoff in that chat
create function public.ai_drafts_on_staff_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.from_client and not new.ai then
    update public.ai_drafts set status = 'dismissed'
    where client_id = new.client_id and kind = 'reply' and status = 'pending';
  end if;
  return new;
end $$;
create trigger messages_settle_ai_drafts after insert on public.messages
for each row execute function public.ai_drafts_on_staff_message();

-- 8. Publishing a checked draft: a chat message (any staff), news or a FAQ entry (owner). Returns the new row's id
create function public.publish_ai_draft(p_draft_id uuid, p_title text, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  d public.ai_drafts;
  new_id uuid;
  v_body text := nullif(btrim(p_body), '');
  v_title text := nullif(btrim(p_title), '');
begin
  select * into d from public.ai_drafts where id = p_draft_id for update;
  if d.id is null or not public.is_staff_of(d.company_id) or (d.kind <> 'reply' and public.my_role() <> 'owner') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if d.status <> 'pending' or d.handoff then
    raise exception 'draft_decided' using errcode = 'P0001';
  end if;
  if v_body is null or (d.kind <> 'reply' and v_title is null) then
    raise exception 'draft_empty' using errcode = 'P0001';
  end if;
  update public.ai_drafts set status = 'published', title = v_title, body = v_body where id = d.id;
  if d.kind = 'reply' then
    insert into public.messages (company_id, client_id, sender_id, body)
    values (d.company_id, d.client_id, auth.uid(), v_body) returning id into new_id;
  elsif d.kind = 'post' then
    insert into public.posts (company_id, title, body) values (d.company_id, v_title, v_body) returning id into new_id;
  else
    insert into public.faqs (company_id, question, answer, position)
    values (d.company_id, v_title, v_body, (select count(*) from public.faqs where company_id = d.company_id))
    returning id into new_id;
  end if;
  return new_id;
end $$;
revoke execute on function public.publish_ai_draft(uuid, text, text) from public, anon;
grant execute on function public.publish_ai_draft(uuid, text, text) to authenticated;

-- 9. Size limits
create function public.limit_ai_rows() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  execute format('select count(*) from public.%I where company_id = $1', tg_table_name) into n using new.company_id;
  if n >= tg_argv[0]::int then
    raise exception 'ai_limit' using errcode = 'P0001', hint = tg_argv[0];
  end if;
  return new;
end $$;
create trigger ai_knowledge_limit before insert on public.ai_knowledge
for each row execute function public.limit_ai_rows('50');
create trigger ai_templates_limit before insert on public.ai_templates
for each row execute function public.limit_ai_rows('100');

-- 10. RLS: staff read, the owner writes; drafts are created by the server (replies) or the owner (news, FAQ)
alter table public.ai_settings enable row level security;
alter table public.ai_prompts enable row level security;
alter table public.ai_knowledge enable row level security;
alter table public.ai_templates enable row level security;
alter table public.ai_drafts enable row level security;
alter table public.posts enable row level security;

create policy ai_settings_select on public.ai_settings for select to authenticated using (public.is_staff_of(company_id));
create policy ai_settings_insert on public.ai_settings for insert to authenticated
  with check (company_id = public.my_company_id() and public.my_role() = 'owner');
create policy ai_settings_update on public.ai_settings for update to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'owner') with check (company_id = public.my_company_id());

create policy ai_prompts_select on public.ai_prompts for select to authenticated using (public.is_staff_of(company_id));
create policy ai_prompts_insert on public.ai_prompts for insert to authenticated
  with check (company_id = public.my_company_id() and public.my_role() = 'owner');
create policy ai_prompts_update on public.ai_prompts for update to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'owner') with check (company_id = public.my_company_id());
create policy ai_prompts_delete on public.ai_prompts for delete to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'owner');

create policy ai_knowledge_select on public.ai_knowledge for select to authenticated using (public.is_staff_of(company_id));
create policy ai_knowledge_insert on public.ai_knowledge for insert to authenticated
  with check (company_id = public.my_company_id() and public.my_role() = 'owner');
create policy ai_knowledge_update on public.ai_knowledge for update to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'owner') with check (company_id = public.my_company_id());
create policy ai_knowledge_delete on public.ai_knowledge for delete to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'owner');

create policy ai_templates_select on public.ai_templates for select to authenticated using (public.is_staff_of(company_id));
create policy ai_templates_insert on public.ai_templates for insert to authenticated
  with check (company_id = public.my_company_id() and public.my_role() = 'owner');
create policy ai_templates_update on public.ai_templates for update to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'owner') with check (company_id = public.my_company_id());
create policy ai_templates_delete on public.ai_templates for delete to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'owner');

create policy ai_drafts_select on public.ai_drafts for select to authenticated using (public.is_staff_of(company_id));
create policy ai_drafts_insert on public.ai_drafts for insert to authenticated
  with check (company_id = public.my_company_id() and public.my_role() = 'owner' and kind in ('post', 'faq'));
create policy ai_drafts_update on public.ai_drafts for update to authenticated
  using (public.is_staff_of(company_id) and (kind = 'reply' or public.my_role() = 'owner'))
  with check (public.is_staff_of(company_id));

-- Public like FAQ and banners: news open before signing in
create policy posts_select on public.posts for select using (true);
create policy posts_update on public.posts for update to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'owner') with check (company_id = public.my_company_id());
create policy posts_delete on public.posts for delete to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'owner');

revoke all on public.ai_settings, public.ai_prompts, public.ai_knowledge, public.ai_templates, public.ai_drafts, public.posts
  from anon, authenticated;
grant select on public.ai_settings, public.ai_prompts, public.ai_knowledge, public.ai_templates, public.ai_drafts
  to authenticated;
-- Upserts rewrite the key columns too; the policies' with check keeps them within the owner's company
grant insert (company_id, mode, handoff_text, updated_at), update (company_id, mode, handoff_text, updated_at) on public.ai_settings
  to authenticated;
grant insert (company_id, kind, body, updated_at), update (company_id, kind, body, updated_at), delete on public.ai_prompts to authenticated;
grant insert (company_id, title, body, url, fetched_at, enabled), update (title, body, url, fetched_at, enabled), delete
  on public.ai_knowledge to authenticated;
grant insert (company_id, question, answer, position), update (question, answer, position), delete
  on public.ai_templates to authenticated;
grant insert (company_id, kind, title, body), update (status, title, body) on public.ai_drafts to authenticated;
grant select on public.posts to anon, authenticated;
grant update (title, body), delete on public.posts to authenticated;

-- The staff chat shows a new draft as soon as the assistant writes it
alter publication supabase_realtime add table public.ai_drafts;
