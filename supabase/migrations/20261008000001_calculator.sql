-- Price calculator: a price list per company and calculator requests stored on orders.
-- The structure of the price list is validated by the app (src/lib/pricing.ts) on every save and read.

create table public.price_lists (
  company_id uuid primary key references public.companies on delete cascade,
  config jsonb not null check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 16384),
  updated_at timestamptz not null default now()
);
alter table public.price_lists enable row level security;

-- Prices are public like the company card: the calculator works before signing in
create policy price_lists_select on public.price_lists for select using (true);
create policy price_lists_insert on public.price_lists for insert to authenticated
  with check (company_id = public.my_company_id() and public.my_role() = 'owner');
create policy price_lists_update on public.price_lists for update to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'owner')
  with check (company_id = public.my_company_id());
revoke all on public.price_lists from anon, authenticated;
grant select on public.price_lists to anon, authenticated;
grant insert (company_id, config) on public.price_lists to authenticated;
grant update (config) on public.price_lists to authenticated;

create trigger price_lists_updated_at before update on public.price_lists
for each row execute function public.touch_updated_at();

-- Orders: where the order came from, the client's calculation (options, lines, total) and the price in rubles.
-- source and calc are written only by the server after it recalculates the quote from the price list; staff may
-- set and correct the price.
alter table public.orders
  add column source text not null default 'staff' check (source in ('staff', 'calculator')),
  add column calc jsonb check (calc is null or (jsonb_typeof(calc) = 'object' and pg_column_size(calc) <= 16384)),
  add column price integer check (price is null or price between 0 and 100000000);
grant insert (price) on public.orders to authenticated;
grant update (price) on public.orders to authenticated;
