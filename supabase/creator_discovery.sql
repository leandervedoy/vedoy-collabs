-- Creator discovery: additive to existing Collabs schema.
create table if not exists public.collabs_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (blocker_id, blocked_id), check (blocker_id<>blocked_id)
);
create table if not exists public.collabs_saved_creators (
 user_id uuid not null references auth.users(id) on delete cascade,
 creator_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (user_id,creator_id), check(user_id<>creator_id)
);
create table if not exists public.collabs_creator_follows (
 follower_id uuid not null references auth.users(id) on delete cascade,
 creator_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,creator_id), check(follower_id<>creator_id)
);
create table if not exists public.collabs_contact_requests (
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references auth.users(id) on delete cascade,
 target_id uuid not null references auth.users(id) on delete cascade,
 note text not null check (char_length(note) between 10 and 800),
 status text not null default 'pending' check (status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(), responded_at timestamptz,
 unique(requester_id,target_id),check(requester_id<>target_id)
);
create table if not exists public.collabs_creator_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 creator_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(reason in ('spam','harassment','impersonation','fraud','other')),
 details text not null default '' check(char_length(details)<=1200),
 created_at timestamptz not null default now(),
 check(reporter_id<>creator_id)
);
create index if not exists collabs_discover_idx on public.collabs_profiles(updated_at desc) where is_public;
create index if not exists collabs_contact_target_idx on public.collabs_contact_requests(target_id,created_at desc);
create index if not exists collabs_contact_requester_idx on public.collabs_contact_requests(requester_id,created_at desc);
create index if not exists collabs_follow_creator_idx on public.collabs_creator_follows(creator_id);
create index if not exists collabs_blocks_blocked_idx on public.collabs_blocks(blocked_id);
alter table public.collabs_blocks enable row level security;
alter table public.collabs_saved_creators enable row level security;
alter table public.collabs_creator_follows enable row level security;
alter table public.collabs_contact_requests enable row level security;
alter table public.collabs_creator_reports enable row level security;
revoke all on public.collabs_blocks,public.collabs_saved_creators,public.collabs_creator_follows,public.collabs_contact_requests,public.collabs_creator_reports from anon,authenticated;
grant select,insert,delete on public.collabs_blocks,public.collabs_saved_creators,public.collabs_creator_follows to authenticated;
grant select,insert on public.collabs_contact_requests,public.collabs_creator_reports to authenticated;
create policy creator_block_select on public.collabs_blocks for select to authenticated using ((select auth.uid()) in (blocker_id,blocked_id));
create policy creator_block_insert on public.collabs_blocks for insert to authenticated with check ((select auth.uid())=blocker_id);
create policy creator_block_delete on public.collabs_blocks for delete to authenticated using ((select auth.uid())=blocker_id);
create policy creator_saved_select on public.collabs_saved_creators for select to authenticated using ((select auth.uid())=user_id);
create policy creator_saved_insert on public.collabs_saved_creators for insert to authenticated with check ((select auth.uid())=user_id);
create policy creator_saved_delete on public.collabs_saved_creators for delete to authenticated using ((select auth.uid())=user_id);
create policy creator_follow_select on public.collabs_creator_follows for select to authenticated using ((select auth.uid())=follower_id);
create policy creator_follow_insert on public.collabs_creator_follows for insert to authenticated with check ((select auth.uid())=follower_id);
create policy creator_follow_delete on public.collabs_creator_follows for delete to authenticated using ((select auth.uid())=follower_id);
create policy creator_report_select on public.collabs_creator_reports for select to authenticated using ((select auth.uid())=reporter_id);
create policy creator_report_insert on public.collabs_creator_reports for insert to authenticated with check ((select auth.uid())=reporter_id);
create policy creator_contact_select on public.collabs_contact_requests for select to authenticated using ((select auth.uid()) in (requester_id,target_id));

-- Only explicitly public fields; users control visibility with collabs_profiles.is_public.
create function public.collabs_find_creators(
 p_query text default null,p_role text default null,p_skill text default null,
 p_location text default null,p_availability text default null,p_user_id uuid default null,
 p_limit integer default 24,p_offset integer default 0
) returns table(
 user_id uuid,display_name text,headline text,bio text,location text,
 roles text[],skills text[],interests text[],availability text,experience_level text,
 avatar_url text,banner_url text,portfolio jsonb,social_links jsonb,
 verified boolean,follower_count bigint
) language sql stable security definer set search_path='' as $$
 select p.user_id,p.display_name,p.headline,p.bio,p.location,p.roles,p.skills,p.interests,
 p.availability,case when p.show_experience_level then p.experience_level else null end,
 p.avatar_url,p.banner_url,p.portfolio,p.social_links,
 exists(select 1 from public.collabs_verifications v where v.user_id=p.user_id),
 (select count(*) from public.collabs_creator_follows f where f.creator_id=p.user_id)
 from public.collabs_profiles p
 where (select auth.uid()) is not null and p.is_public
 and (p_user_id is null or p.user_id=p_user_id)
 and (p_query is null or p_query='' or p.display_name ilike '%'||left(p_query,120)||'%'
 or p.headline ilike '%'||left(p_query,120)||'%' or p.bio ilike '%'||left(p_query,120)||'%'
 or array_to_string(p.roles,' ') ilike '%'||left(p_query,120)||'%'
 or array_to_string(p.skills,' ') ilike '%'||left(p_query,120)||'%')
 and (p_role is null or p_role='' or exists(select 1 from unnest(p.roles) r where r ilike '%'||left(p_role,60)||'%'))
 and (p_skill is null or p_skill='' or exists(select 1 from unnest(p.skills) s where s ilike '%'||left(p_skill,60)||'%'))
 and (p_location is null or p_location='' or p.location ilike '%'||left(p_location,80)||'%')
 and (p_availability is null or p_availability='' or p.availability=p_availability)
 and not exists(select 1 from public.collabs_blocks b
 where (b.blocker_id=(select auth.uid()) and b.blocked_id=p.user_id)
 or (b.blocker_id=p.user_id and b.blocked_id=(select auth.uid())))
 order by p.updated_at desc,p.user_id
 limit least(greatest(coalesce(p_limit,24),1),48)
 offset least(greatest(coalesce(p_offset,0),0),2000);
$$;
revoke all on function public.collabs_find_creators(text,text,text,text,text,uuid,integer,integer) from public,anon;
grant execute on function public.collabs_find_creators(text,text,text,text,text,uuid,integer,integer) to authenticated;

create function public.collabs_contact_quota_ok()
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and
 (select count(*) from public.collabs_contact_requests r
 where r.requester_id=(select auth.uid()) and r.created_at>=now()-interval '24 hours')<20;
$$;
revoke all on function public.collabs_contact_quota_ok() from public,anon;
grant execute on function public.collabs_contact_quota_ok() to authenticated;

create policy creator_contact_insert on public.collabs_contact_requests for insert to authenticated
 with check(requester_id=(select auth.uid()) and status='pending' and responded_at is null
 and public.collabs_contact_quota_ok()
 and exists(select 1 from public.collabs_find_creators(p_user_id=>target_id,p_limit=>1)));

-- Only requested recipient can accept/decline, and acceptance creates a match.
create function public.collabs_respond_to_contact(p_request_id uuid,p_accept boolean)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare req public.collabs_contact_requests%rowtype; match_identifier uuid; a uuid; b uuid;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select * into req from public.collabs_contact_requests where id=p_request_id for update;
 if not found or req.target_id<>(select auth.uid()) or req.status<>'pending' then
   raise exception 'Request cannot be handled by this user';
 end if;
 if exists(select 1 from public.collabs_blocks x where
 (x.blocker_id=req.target_id and x.blocked_id=req.requester_id)
 or (x.blocker_id=req.requester_id and x.blocked_id=req.target_id)) then
   raise exception 'Contact not permitted';
 end if;
 update public.collabs_contact_requests set status=case when p_accept then 'accepted' else 'declined' end,
 responded_at=now() where id=p_request_id;
 if p_accept then
   a:=least(req.requester_id,req.target_id);b:=greatest(req.requester_id,req.target_id);
   insert into public.collabs_matches(user_a,user_b) values(a,b) on conflict(user_a,user_b) do nothing;
   select id into match_identifier from public.collabs_matches where user_a=a and user_b=b;
 end if;
 return match_identifier;
end;$$;
revoke all on function public.collabs_respond_to_contact(uuid,boolean) from public,anon;
grant execute on function public.collabs_respond_to_contact(uuid,boolean) to authenticated;

-- Restrictive policy also requires the original insert policy to permit the operation.
create policy creator_messages_not_blocked on public.collabs_messages
 as restrictive for insert to authenticated with check(not exists(
 select 1 from public.collabs_matches m join public.collabs_blocks b
 on ((b.blocker_id=m.user_a and b.blocked_id=m.user_b)
 or (b.blocker_id=m.user_b and b.blocked_id=m.user_a)) where m.id=match_id
));
