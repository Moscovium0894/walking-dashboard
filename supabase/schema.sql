-- Granny Walking — database schema
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Safe to run more than once.

-- 1. The walks table -------------------------------------------------------
create table if not exists public.walks (
  id                  uuid primary key default gen_random_uuid(),
  garmin_activity_id  text unique,          -- dedupe key; null for historical imports
  walk_date           date not null,
  name                text,                 -- walk name / location
  distance_km         numeric(7,3),         -- distance AFTER car-segment removal
  duration_min        numeric(7,1),         -- moving time, minutes
  ascent_m            numeric(7,1),         -- elevation gain (optional)
  gpx_path            text,                 -- path of the track in the 'gpx' storage bucket
  status              text not null default 'imported'
                        check (status in ('imported','needs_review','confirmed')),
  source              text not null default 'garmin'
                        check (source in ('garmin','historical')),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists walks_date_idx   on public.walks (walk_date);
create index if not exists walks_status_idx on public.walks (status);

-- keep updated_at fresh on every edit
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists walks_set_updated_at on public.walks;
create trigger walks_set_updated_at
  before update on public.walks
  for each row execute function public.set_updated_at();

-- 2. Row-level security ----------------------------------------------------
-- Only signed-in users (Granny + family) can read or change walks.
-- Anonymous visitors who stumble on the site get nothing.
alter table public.walks enable row level security;

drop policy if exists "authenticated full access" on public.walks;
create policy "authenticated full access"
  on public.walks for all
  to authenticated
  using (true) with check (true);

-- 3. Storage bucket for GPX track files ------------------------------------
insert into storage.buckets (id, name, public)
values ('gpx', 'gpx', false)
on conflict (id) do nothing;

drop policy if exists "authenticated read gpx" on storage.objects;
create policy "authenticated read gpx"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'gpx');

drop policy if exists "authenticated write gpx" on storage.objects;
create policy "authenticated write gpx"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'gpx');
