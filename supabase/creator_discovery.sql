-- Extension for the existing Collabs creator discovery schema.
-- Supabase Vedoy already has profiles, contact requests, saved creators, blocks,
-- reports, RPCs and conversation tables. Do NOT recreate them.
create table if not exists public.collabs_creator_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id,creator_id),
  constraint collabs_creator_follows_not_self check (follower_id<>creator_id)
);
create index if not exists collabs_creator_follows_creator_idx on public.collabs_creator_follows(creator_id);
alter table public.collabs_creator_follows enable row level security;
revoke all on public.collabs_creator_follows from anon,authenticated;
grant select,insert,delete on public.collabs_creator_follows to authenticated;
create policy collabs_follow_own_read on public.collabs_creator_follows
  for select to authenticated using (follower_id=(select auth.uid()));
create policy collabs_follow_own_insert on public.collabs_creator_follows
  for insert to authenticated with check (
   follower_id=(select auth.uid()) and
   exists(select 1 from public.collabs_find_creators(p_user_id=>creator_id,p_limit=>1))
  );
create policy collabs_follow_own_delete on public.collabs_creator_follows
  for delete to authenticated using (follower_id=(select auth.uid()));
