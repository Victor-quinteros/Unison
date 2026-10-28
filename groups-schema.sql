-- Run in the Supabase SQL Editor after supabase-schema.sql and
-- supabase-private-community-migration.sql. This migration makes Groups a
-- first-class feature: public/private privacy, categories, cover and avatar
-- images, owner/admin/member roles, join requests that an admin approves,
-- pinned posts with moderation, and invite links.

-- 01. New group columns
alter table public.groups add column if not exists privacy text not null default 'public';
alter table public.groups add column if not exists category text not null default 'General';
alter table public.groups add column if not exists cover_path text;
alter table public.groups add column if not exists invite_code text;
alter table public.groups drop constraint if exists groups_privacy_check;
alter table public.groups add constraint groups_privacy_check check (privacy in ('public', 'private'));
create unique index if not exists groups_invite_code_key on public.groups (invite_code) where invite_code is not null;

-- 02. Membership roles and join requests
alter table public.groups_memberships add column if not exists role text not null default 'member';
alter table public.groups_memberships add column if not exists status text not null default 'approved';
alter table public.groups_memberships drop constraint if exists groups_memberships_role_check;
alter table public.groups_memberships add constraint groups_memberships_role_check check (role in ('owner', 'admin', 'member'));
alter table public.groups_memberships drop constraint if exists groups_memberships_status_check;
alter table public.groups_memberships add constraint groups_memberships_status_check check (status in ('approved', 'pending'));

-- 03. Pinned posts
alter table public.posts add column if not exists pinned boolean not null default false;
create index if not exists groups_memberships_group_status_idx on public.groups_memberships (group_id, status);
create index if not exists posts_group_pinned_created_at_idx on public.posts (group_id, pinned desc, created_at desc);

-- 04. Helper functions (security definer avoids RLS recursion on memberships)
create or replace function public.is_group_member(target_group text, target_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
	select exists (
		select 1 from public.groups_memberships
		where group_id = target_group and user_id = target_user and status = 'approved'
	);
$$;

create or replace function public.can_moderate_group(target_group text, target_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
	select coalesce((
		select role in ('owner', 'admin') from public.groups_memberships
		where group_id = target_group and user_id = target_user and status = 'approved'
		limit 1
	), false);
$$;

grant execute on function public.is_group_member(text, uuid) to anon, authenticated;
grant execute on function public.can_moderate_group(text, uuid) to anon, authenticated;

-- 05. Groups: admins can edit, not just the original owner
drop policy if exists "Group admins update their group" on public.groups;
create policy "Group admins update their group"
	on public.groups for update to authenticated
	using (public.can_moderate_group(id, (select auth.uid())))
	with check (public.can_moderate_group(id, (select auth.uid())));

-- 06. Memberships: private groups are only readable by their members
drop policy if exists "Memberships are readable by everyone" on public.groups_memberships;
drop policy if exists "Memberships visible for public groups or to members" on public.groups_memberships;
create policy "Memberships visible for public groups or to members"
	on public.groups_memberships for select
	using (
		user_id = (select auth.uid())
		or exists (select 1 from public.groups g where g.id = group_id and g.privacy = 'public')
		or public.is_group_member(group_id, (select auth.uid()))
	);

drop policy if exists "Users join groups as themselves" on public.groups_memberships;
drop policy if exists "Users join groups as themselves or request to join" on public.groups_memberships;
create policy "Users join groups as themselves or request to join"
	on public.groups_memberships for insert to authenticated
	with check (
		user_id = (select auth.uid())
		and (
			-- Owner recording themselves when they create the group.
			(
				role = 'owner' and status = 'approved'
				and exists (select 1 from public.groups g where g.id = group_id and g.owner_id = (select auth.uid()))
			)
			-- Public groups: immediate membership.
			or (
				role = 'member' and status = 'approved'
				and exists (select 1 from public.groups g where g.id = group_id and g.privacy = 'public')
			)
			-- Private groups: pending join request.
			or (
				role = 'member' and status = 'pending'
				and exists (select 1 from public.groups g where g.id = group_id and g.privacy = 'private')
			)
		)
	);

drop policy if exists "Group admins moderate memberships" on public.groups_memberships;
create policy "Group admins moderate memberships"
	on public.groups_memberships for update to authenticated
	using (public.can_moderate_group(group_id, (select auth.uid())))
	with check (public.can_moderate_group(group_id, (select auth.uid())));

drop policy if exists "Users leave groups as themselves" on public.groups_memberships;
drop policy if exists "Members leave or are removed by admins" on public.groups_memberships;
create policy "Members leave or are removed by admins"
	on public.groups_memberships for delete to authenticated
	using (user_id = (select auth.uid()) or public.can_moderate_group(group_id, (select auth.uid())));

-- 07. Group posts: public groups are readable, private groups only to members
drop policy if exists "Group posts readable by members" on public.posts;
drop policy if exists "Group posts readable by members of public groups" on public.posts;
create policy "Group posts readable by members of public groups"
	on public.posts for select to authenticated
	using (
		scope <> 'group'
		or exists (select 1 from public.groups g where g.id = group_id and g.privacy = 'public')
		or public.is_group_member(group_id, (select auth.uid()))
	);

drop policy if exists "Users create posts in groups" on public.posts;
drop policy if exists "Approved members create posts in groups" on public.posts;
create policy "Approved members create posts in groups"
	on public.posts for insert to authenticated
	with check (
		scope <> 'group'
		or public.is_group_member(group_id, (select auth.uid()))
	);

-- 08. Moderation: admins can pin and delete posts inside their group
grant update on public.posts to authenticated;
drop policy if exists "Group moderators update group posts" on public.posts;
create policy "Group moderators update group posts"
	on public.posts for update to authenticated
	using (scope = 'group' and public.can_moderate_group(group_id, (select auth.uid())))
	with check (scope = 'group' and public.can_moderate_group(group_id, (select auth.uid())));

drop policy if exists "Group moderators delete group posts" on public.posts;
create policy "Group moderators delete group posts"
	on public.posts for delete to authenticated
	using (scope = 'group' and public.can_moderate_group(group_id, (select auth.uid())));

-- 09. Invite links: redeem a code to join a group without an approval step
create or replace function public.join_group_with_invite(invite text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
	target_group text;
begin
	if auth.uid() is null then
		raise exception 'Sign in to use an invite link';
	end if;
	select id into target_group from public.groups where invite_code = invite;
	if target_group is null then
		raise exception 'This invite link is not valid';
	end if;
	insert into public.groups_memberships (group_id, user_id, role, status)
	values (target_group, auth.uid(), 'member', 'approved')
	on conflict (group_id, user_id) do update set status = 'approved';
	return target_group;
end;
$$;

grant execute on function public.join_group_with_invite(text) to authenticated;

-- 10. Group media storage (covers and avatars)
insert into storage.buckets (id, name, public)
values ('group-media', 'group-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Group media is publicly readable" on storage.objects;
create policy "Group media is publicly readable"
	on storage.objects for select
	using (bucket_id = 'group-media');

drop policy if exists "Signed-in members upload group media" on storage.objects;
create policy "Signed-in members upload group media"
	on storage.objects for insert to authenticated
	with check (bucket_id = 'group-media' and owner_id = (select auth.uid())::text);

drop policy if exists "Users update their own group media" on storage.objects;
create policy "Users update their own group media"
	on storage.objects for update to authenticated
	using (bucket_id = 'group-media' and owner_id = (select auth.uid())::text)
	with check (bucket_id = 'group-media' and owner_id = (select auth.uid())::text);

drop policy if exists "Users delete their own group media" on storage.objects;
create policy "Users delete their own group media"
	on storage.objects for delete to authenticated
	using (bucket_id = 'group-media' and owner_id = (select auth.uid())::text);

-- 11. Existing seeded groups become public and categorised
update public.groups set privacy = 'public' where privacy is null;
update public.groups set category = 'Nature' where id = 'nature-adventure';
update public.groups set category = 'Technology' where id = 'tech-innovation';
update public.groups set category = 'Gaming' where id = 'gaming-community';
update public.groups set category = 'Travel' where id = 'panama-travel-life';
update public.groups set category = 'Automotive' where id = 'car-enthusiasts';
