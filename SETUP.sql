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

-- 3. ACHIEVEMENTS
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  image_url text,
  storage_path text,
  date text,
  created_at timestamptz not null default now()
);

-- 4. EDUCATIONAL
create table if not exists public.educational (
  id uuid primary key default gen_random_uuid(),
  cat text not null,
  title text not null,
  description text default '',
  year text,
  created_at timestamptz not null default now()
);

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
-- 3. Open admin.html in your site, log in, and start managing content
-- ============================================
