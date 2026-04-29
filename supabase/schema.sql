-- Silks Pose — Supabase schema
-- Run once in the Supabase SQL editor (or via `supabase db push`).
-- Idempotent: safe to re-run.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.videos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    filename text not null,
    storage_path text,
    thumbnail_path text,
    split text not null default 'unassigned'
        check (split in ('unassigned', 'labeled', 'train', 'test')),
    tags text[] not null default '{}',
    poses text[] not null default '{}',
    labels jsonb not null default '[]'::jsonb,
    custom_name text,
    favorite boolean not null default false,
    collection_id uuid,
    created_at timestamptz not null default now()
);

create index if not exists videos_user_id_idx on public.videos (user_id);
create index if not exists videos_tags_idx on public.videos using gin (tags);
create index if not exists videos_poses_idx on public.videos using gin (poses);
create index if not exists videos_collection_id_idx on public.videos (collection_id);

create table if not exists public.tag_vocabulary (
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    primary key (user_id, name)
);

-- ============================================================
-- Role grants (newer Supabase projects don't auto-grant on raw-SQL tables)
-- ============================================================

grant all on public.videos to service_role;
grant all on public.tag_vocabulary to service_role;
grant select, insert, update, delete on public.videos to authenticated;
grant select, insert, delete on public.tag_vocabulary to authenticated;

-- ============================================================
-- Row-level security
-- ============================================================

alter table public.videos enable row level security;
alter table public.tag_vocabulary enable row level security;

drop policy if exists videos_select_own on public.videos;
drop policy if exists videos_insert_own on public.videos;
drop policy if exists videos_update_own on public.videos;
drop policy if exists videos_delete_own on public.videos;

create policy videos_select_own on public.videos
    for select using (auth.uid() = user_id);
create policy videos_insert_own on public.videos
    for insert with check (auth.uid() = user_id);
create policy videos_update_own on public.videos
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy videos_delete_own on public.videos
    for delete using (auth.uid() = user_id);

drop policy if exists tags_select_own on public.tag_vocabulary;
drop policy if exists tags_insert_own on public.tag_vocabulary;
drop policy if exists tags_delete_own on public.tag_vocabulary;

create policy tags_select_own on public.tag_vocabulary
    for select using (auth.uid() = user_id);
create policy tags_insert_own on public.tag_vocabulary
    for insert with check (auth.uid() = user_id);
create policy tags_delete_own on public.tag_vocabulary
    for delete using (auth.uid() = user_id);

-- ============================================================
-- Storage: private 'videos' bucket, paths shaped {user_id}/{video_id}.{ext}
-- ============================================================

insert into storage.buckets (id, name, public)
    values ('videos', 'videos', false)
    on conflict (id) do nothing;

drop policy if exists videos_storage_select_own on storage.objects;
drop policy if exists videos_storage_insert_own on storage.objects;
drop policy if exists videos_storage_update_own on storage.objects;
drop policy if exists videos_storage_delete_own on storage.objects;

create policy videos_storage_select_own on storage.objects
    for select using (
        bucket_id = 'videos'
        and auth.uid()::text = (storage.foldername(name))[1]
    );
create policy videos_storage_insert_own on storage.objects
    for insert with check (
        bucket_id = 'videos'
        and auth.uid()::text = (storage.foldername(name))[1]
    );
create policy videos_storage_update_own on storage.objects
    for update using (
        bucket_id = 'videos'
        and auth.uid()::text = (storage.foldername(name))[1]
    );
create policy videos_storage_delete_own on storage.objects
    for delete using (
        bucket_id = 'videos'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

-- Thumbnails bucket: public read, authenticated write
drop policy if exists thumbnails_storage_select_public on storage.objects;
drop policy if exists thumbnails_storage_insert_auth on storage.objects;
drop policy if exists thumbnails_storage_update_auth on storage.objects;

create policy thumbnails_storage_select_public on storage.objects
    for select using (bucket_id = 'thumbnails');

create policy thumbnails_storage_insert_auth on storage.objects
    for insert with check (
        bucket_id = 'thumbnails' and auth.role() = 'authenticated'
    );

create policy thumbnails_storage_update_auth on storage.objects
    for update using (
        bucket_id = 'thumbnails' and auth.role() = 'authenticated'
    );
