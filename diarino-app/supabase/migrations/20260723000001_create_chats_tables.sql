-- supabase/migrations/20260723000001_create_chats_tables.sql
-- ↔ replaces data/mock-chats.ts + lib/hooks/useChats.ts's local store.

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  request_id uuid references public.requests(id) on delete set null,
  initiator_id uuid not null references auth.users(id) on delete cascade, -- ↔ "me" in openOrCreateChat()/the offer sender
  partner_id uuid not null references auth.users(id) on delete cascade,  -- ↔ the seller, or the request's requester
  created_at timestamptz not null default now(),
  constraint chats_at_most_one_target check (not (property_id is not null and request_id is not null))
);

-- One chat per (initiator, property) and per (initiator, request) — same
-- "find existing or create" behavior as openOrCreateChat()/getOrCreateRequestChat().
create unique index if not exists chats_initiator_property_uidx on public.chats(initiator_id, property_id) where property_id is not null;
create unique index if not exists chats_initiator_request_uidx on public.chats(initiator_id, request_id) where request_id is not null;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  text text not null default '',
  images text[] not null default '{}',
  whatsapp text, -- ↔ the "📱 واتساب: ..." tag on offer messages
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_chat_id_idx on public.chat_messages(chat_id, created_at);

alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;

-- Only the two participants can see/create a chat.
create policy "participants can read their chats"
  on public.chats for select
  to authenticated
  using (initiator_id = auth.uid() or partner_id = auth.uid());

create policy "users can create chats they participate in"
  on public.chats for insert
  to authenticated
  with check (initiator_id = auth.uid() or partner_id = auth.uid());

-- Only participants of the parent chat can read/send messages.
create policy "participants can read messages in their chats"
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chats c
      where c.id = chat_messages.chat_id
        and (c.initiator_id = auth.uid() or c.partner_id = auth.uid())
    )
  );

create policy "participants can send messages in their chats"
  on public.chat_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chats c
      where c.id = chat_messages.chat_id
        and (c.initiator_id = auth.uid() or c.partner_id = auth.uid())
    )
  );

create policy "participants can mark messages read"
  on public.chat_messages for update
  to authenticated
  using (
    exists (
      select 1 from public.chats c
      where c.id = chat_messages.chat_id
        and (c.initiator_id = auth.uid() or c.partner_id = auth.uid())
    )
  )
  with check (true);

-- Needed so the chat screen gets new messages pushed live instead of
-- requiring a manual refetch — enables Supabase Realtime's postgres_changes
-- for this table specifically.
alter publication supabase_realtime add table public.chat_messages;

-- Second FKs (same pattern as properties_seller_profile_fkey) so a single
-- query can embed each participant's profile (name/avatar) via PostgREST:
--   supabase.from('chats').select('*, initiator:profiles!chats_initiator_profile_fkey(*), partner:profiles!chats_partner_profile_fkey(*)')
alter table public.chats
  add constraint chats_initiator_profile_fkey foreign key (initiator_id) references public.profiles(id) on delete cascade,
  add constraint chats_partner_profile_fkey foreign key (partner_id) references public.profiles(id) on delete cascade;
