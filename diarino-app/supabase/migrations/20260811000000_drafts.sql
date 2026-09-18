-- supabase/migrations/20260811000000_drafts.sql
-- Powers "حفظ كمسودة" on both app/publish/create-listing.tsx and
-- app/publish/create-request.tsx. Drafts store the whole form as JSON
-- rather than partial rows in properties/requests — those tables have
-- NOT NULL constraints on required fields that an incomplete draft
-- wouldn't satisfy, and a JSON blob avoids needing to relax that schema
-- just to support "save for later".

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  draft_type text not null check (draft_type in ('listing', 'request')),
  title text, -- best-effort label for the drafts list (e.g. the short title typed so far)
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists drafts_user_idx on public.drafts(user_id, draft_type, updated_at desc);

alter table public.drafts enable row level security;

create policy "users manage their own drafts"
  on public.drafts for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
