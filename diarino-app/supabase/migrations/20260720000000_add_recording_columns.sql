-- supabase/migrations/20260720000000_add_recording_columns.sql
-- Extends the `lives` table (created earlier for room ownership) with
-- everything needed to track an Egress recording and manage it afterward
-- as a "saved live" — this replaces the local-only SavedLive store with
-- real, persisted rows.

alter table public.lives
  add column if not exists egress_id text,
  add column if not exists recording_filepath text,
  add column if not exists recording_status text not null default 'none'
    check (recording_status in ('none', 'recording', 'processing', 'ready', 'failed')),
  add column if not exists recording_url text,
  add column if not exists duration_sec integer,
  add column if not exists poster_url text,
  add column if not exists published_public boolean not null default false,
  add column if not exists pinned boolean not null default false,
  add column if not exists pinned_at timestamptz,
  add column if not exists comments_hidden boolean not null default false,
  add column if not exists viewer_peak integer not null default 0;

create index if not exists lives_recording_status_idx on public.lives(recording_status);
