-- ============================================
-- PORTFOLIO — SUPABASE SCHEMA SETUP
-- Run this entire script ONCE in: Supabase Dashboard → SQL Editor
-- ============================================

-- 1. SETTINGS (key/value JSONB) — hero, about, contact
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. GALLERY
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text,
  caption text default '',
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2b. GALLERY — additive columns for Portfolio V2 ("Project Boulevard")
-- V1 never reads these columns and keeps working exactly as before;
-- V2 uses them to render each gallery row as a full "project" (title,
-- tech stack, live demo, source repo) instead of just an image+caption.
alter table public.gallery add column if not exists title text;
alter table public.gallery add column if not exists tech_tags text[] not null default '{}';
alter table public.gallery add column if not exists demo_url text;
alter table public.gallery add column if not exists repo_url text;

-- 3. ACHIEVEMENTS
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  image_url text,
  storage_path text,
  date text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
-- (safe to re-run on an existing DB: adds the column if it's missing)
alter table public.achievements add column if not exists published boolean not null default true;

-- 4. EDUCATIONAL
create table if not exists public.educational (
  id uuid primary key default gen_random_uuid(),
  cat text not null,
  title text not null,
  description text default '',
  year text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.educational add column if not exists published boolean not null default true;

-- 5. ANALYTICS (single-row visitor counter)
create table if not exists public.analytics (
  id text primary key,
  total_visits bigint not null default 0,
  last_visit timestamptz not null default now()
);
insert into public.analytics (id, total_visits) values ('visitors', 0)
on conflict (id) do nothing;

-- ============================================
-- GRANTS (Data API access)
-- ============================================
grant select on public.settings, public.gallery, public.achievements,
  public.educational, public.analytics to anon, authenticated;
grant insert, update, delete on public.settings, public.gallery,
  public.achievements, public.educational to authenticated;
grant all on public.settings, public.gallery, public.achievements,
  public.educational, public.analytics to service_role;

-- ============================================
-- RLS POLICIES
-- ============================================
alter table public.settings       enable row level security;
alter table public.gallery        enable row level security;
alter table public.achievements   enable row level security;
alter table public.educational    enable row level security;
alter table public.analytics      enable row level security;

-- Public read
create policy "public read settings"     on public.settings     for select to anon, authenticated using (true);
create policy "public read gallery"      on public.gallery      for select to anon, authenticated using (true);
create policy "public read achievements" on public.achievements for select to anon, authenticated using (true);
create policy "public read educational"  on public.educational  for select to anon, authenticated using (true);
create policy "public read analytics"    on public.analytics    for select to anon, authenticated using (true);

-- Authenticated (admin) write
create policy "auth write settings"     on public.settings     for all to authenticated using (true) with check (true);
create policy "auth write gallery"      on public.gallery      for all to authenticated using (true) with check (true);
create policy "auth write achievements" on public.achievements for all to authenticated using (true) with check (true);
create policy "auth write educational"  on public.educational  for all to authenticated using (true) with check (true);

-- ============================================
-- VISITOR COUNTER (SECURITY DEFINER RPC so anon can increment safely)
-- ============================================
create or replace function public.increment_visitor_count()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics (id, total_visits, last_visit)
  values ('visitors', 1, now())
  on conflict (id) do update
    set total_visits = public.analytics.total_visits + 1,
        last_visit = now();
end;
$$;
grant execute on function public.increment_visitor_count() to anon, authenticated;

-- ============================================
-- STORAGE BUCKET (public images)
-- ============================================
insert into storage.buckets (id, name, public)
values ('portfolio-images', 'portfolio-images', true)
on conflict (id) do nothing;

-- SECURITY HARDENING (safe to re-run): the client's file picker
-- (accept="image/*") and the client-side checks in shared/supabase.js's
-- uploadImage() are both trivially bypassable — this is the real,
-- server-enforced gate. Matches shared/supabase.js's ALLOWED_IMAGE_TYPES /
-- MAX_IMAGE_BYTES; update both together if these ever change.
update storage.buckets
set file_size_limit = 5242880, -- 5MB, in bytes
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'portfolio-images';

-- Storage policies: public read, authenticated write
drop policy if exists "public read portfolio images" on storage.objects;
create policy "public read portfolio images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'portfolio-images');

drop policy if exists "auth upload portfolio images" on storage.objects;
create policy "auth upload portfolio images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'portfolio-images');

drop policy if exists "auth update portfolio images" on storage.objects;
create policy "auth update portfolio images" on storage.objects
  for update to authenticated
  using (bucket_id = 'portfolio-images');

drop policy if exists "auth delete portfolio images" on storage.objects;
create policy "auth delete portfolio images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'portfolio-images');

-- ============================================
-- REALTIME (so admin & site update live)
-- ============================================
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.gallery;
alter publication supabase_realtime add table public.achievements;
alter publication supabase_realtime add table public.educational;

-- ============================================
-- DONE. Next steps:
-- 1. Authentication → Users → Add User (email + password) — this is your admin login
-- 2. (Optional) Authentication → Providers → disable Email "Confirm email" for instant login
-- 3. Open /admin/index.html on your site, log in, and start managing content
-- ============================================

-- ============================================
-- DUAL-APP VERSION SWITCHING (no schema change needed)
-- The active app version (Portfolio V1/V2 + Admin V1/V2, switched
-- together as one unit) is stored as a single row in the existing
-- `settings` table under key = 'active_version', shaped as:
--   { "version": "v1", "previous": "v1", "updated_at": "<ISO date>" }
-- It defaults to v1 if the row has never been written. All reads/
-- writes go through shared/api.js (getActiveVersion/publishVersion/
-- rollbackVersion) — nothing queries this key directly.
-- ============================================
