alter table public.messages add column from_client boolean generated always as (sender_id = client_id) stored;
create index on public.messages (company_id, from_client) where read_at is null;
