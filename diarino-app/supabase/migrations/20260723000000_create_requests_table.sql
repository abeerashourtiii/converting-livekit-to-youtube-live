-- supabase/migrations/20260723000000_create_requests_table.sql
-- ↔ replaces data/mock-requests.ts + the myRequests half of useMyContent.ts.

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('sale', 'rent')),
  type text not null,
  province text not null,
  location text not null,
  price_max numeric,
  area text,
  rooms text,
  baths text,
  description text not null default '',
  requester_name text not null,
  offers_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists requests_requester_id_idx on public.requests(requester_id);
create index if not exists requests_created_at_idx on public.requests(created_at desc);

alter table public.requests enable row level security;

create policy "requests are readable by authenticated users"
  on public.requests for select
  to authenticated
  using (true);

create policy "users can create their own requests"
  on public.requests for insert
  to authenticated
  with check (requester_id = auth.uid());

create policy "requesters can update their own requests"
  on public.requests for update
  to authenticated
  using (requester_id = auth.uid())
  with check (requester_id = auth.uid());

create policy "requesters can delete their own requests"
  on public.requests for delete
  to authenticated
  using (requester_id = auth.uid());

-- Atomic increment for "تقديم عرض" — anyone signed in can bump the count on
-- someone else's request (that's the whole point: an offer is made by
-- someone who isn't the requester), so this can't be gated by ownership
-- like the policies above. A single UPDATE ... SET x = x + 1 is already
-- atomic in Postgres; the function just gives the client a named,
-- intention-revealing call instead of a raw update anyone could tamper with
-- to set an arbitrary count.
create or replace function public.increment_request_offers(request_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.requests set offers_count = offers_count + 1 where id = request_id;
$$;

grant execute on function public.increment_request_offers(uuid) to authenticated;

-- Now favorites.request_id can point somewhere real (was a bare uuid with
-- no FK in the favorites migration, since this table didn't exist yet).
alter table public.favorites
  add constraint favorites_request_id_fkey
  foreign key (request_id) references public.requests(id) on delete cascade;
