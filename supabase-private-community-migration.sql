-- Run in the Supabase SQL Editor. Existing posts remain public to signed-in
-- members. Only public posts placed in the Community feed are visible to guests.

alter table public.profiles add column if not exists avatar_border text not null default 'none';
alter table public.profiles add column if not exists profile_sticker text not null default 'none';
alter table public.profiles add column if not exists profile_background_url text;
alter table public.profiles drop constraint if exists profiles_avatar_border_check;
alter table public.profiles add constraint profiles_avatar_border_check check (avatar_border in ('none', 'coral', 'gold', 'rainbow'));
alter table public.profiles drop constraint if exists profiles_profile_sticker_check;
alter table public.profiles add constraint profiles_profile_sticker_check check (profile_sticker in ('none', 'star', 'flower', 'sparkle', 'fire'));

create table if not exists public.messages (
	id uuid primary key default gen_random_uuid(),
	sender_id uuid not null references public.profiles (id) on delete cascade,
	recipient_id uuid not null references public.profiles (id) on delete cascade,
	body text not null check (char_length(body) between 1 and 5000),
	created_at timestamptz not null default now(),
	check (sender_id <> recipient_id)
);
alter table public.messages enable row level security;
grant select, insert on public.messages to authenticated;
revoke all on public.messages from anon, public;
drop policy if exists "Participants read their messages" on public.messages;
create policy "Participants read their messages"
	on public.messages for select to authenticated
	using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);
drop policy if exists "Users send messages as themselves" on public.messages;
create policy "Users send messages as themselves"
	on public.messages for insert to authenticated
	with check ((select auth.uid()) = sender_id and sender_id <> recipient_id);
create index if not exists messages_sender_created_at_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_recipient_created_at_idx on public.messages (recipient_id, created_at desc);

alter table public.posts drop constraint if exists posts_scope_check;
alter table public.posts
	add constraint posts_scope_check check (scope in ('home', 'townsquare', 'community'));
alter table public.posts add column if not exists visibility text not null default 'public';
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts
	add constraint posts_visibility_check check (visibility in ('public', 'private'));

grant select on public.posts, public.post_likes, public.post_comments, public.stories to authenticated;
revoke select on public.posts, public.post_likes, public.post_comments, public.stories from anon, public;
grant select on public.posts to anon;
grant insert on public.posts to authenticated;

drop policy if exists "Posts are readable by everyone" on public.posts;
drop policy if exists "Posts are readable by signed-in members" on public.posts;
drop policy if exists "Members read public posts and owners read private posts" on public.posts;
create policy "Members read public posts and owners read private posts"
	on public.posts for select to authenticated
	using ((select auth.uid()) is not null and (visibility = 'public' or user_id = (select auth.uid())));
drop policy if exists "Visitors read public community posts" on public.posts;
create policy "Visitors read public community posts"
	on public.posts for select to anon
	using (scope = 'community' and visibility = 'public');
drop policy if exists "Users create their own posts" on public.posts;
create policy "Users create their own posts"
	on public.posts for insert to authenticated
	with check (user_id = (select auth.uid()));

drop policy if exists "Likes are readable by everyone" on public.post_likes;
drop policy if exists "Likes are readable by signed-in members" on public.post_likes;
drop policy if exists "Members read likes for visible posts" on public.post_likes;
create policy "Members read likes for visible posts"
	on public.post_likes for select to authenticated
	using (exists (select 1 from public.posts where posts.id = post_likes.post_id));
drop policy if exists "Users like posts as themselves" on public.post_likes;
create policy "Users like posts as themselves"
	on public.post_likes for insert to authenticated
	with check (user_id = (select auth.uid()) and exists (select 1 from public.posts where posts.id = post_likes.post_id));

drop policy if exists "Comments are readable by everyone" on public.post_comments;
drop policy if exists "Comments are readable by signed-in members" on public.post_comments;
drop policy if exists "Members read comments for visible posts" on public.post_comments;
create policy "Members read comments for visible posts"
	on public.post_comments for select to authenticated
	using (exists (select 1 from public.posts where posts.id = post_comments.post_id));
drop policy if exists "Users create comments as themselves" on public.post_comments;
create policy "Users create comments as themselves"
	on public.post_comments for insert to authenticated
	with check (user_id = (select auth.uid()) and exists (select 1 from public.posts where posts.id = post_comments.post_id));

drop policy if exists "Unexpired stories are publicly readable" on public.stories;
drop policy if exists "Unexpired stories are readable by members" on public.stories;
create policy "Unexpired stories are readable by members"
	on public.stories for select to authenticated
	using (expires_at > now());

insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', false)
on conflict (id) do update set public = false;
grant insert on storage.objects to authenticated;
drop policy if exists "Signed-in users upload their own post images" on storage.objects;
create policy "Signed-in users upload their own post images"
	on storage.objects for insert to authenticated
	with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Post images are publicly readable" on storage.objects;
drop policy if exists "Signed-in members can read post images" on storage.objects;
create policy "Signed-in members can read post images"
	on storage.objects for select to authenticated
	using (
		bucket_id = 'post-media'
		and (
			owner_id = (select auth.uid())::text
			or exists (select 1 from public.posts where posts.image_path = storage.objects.name)
		)
	);
drop policy if exists "Visitors read public community post images" on storage.objects;
create policy "Visitors read public community post images"
	on storage.objects for select to anon
	using (
		bucket_id = 'post-media'
		and storage.allow_any_operation(array['object.get_authenticated_info', 'object.get_authenticated'])
		and exists (
			select 1 from public.posts
			where posts.image_path = storage.objects.name
				and posts.scope = 'community'
				and posts.visibility = 'public'
		)
	);

insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do update set public = true;
drop policy if exists "Users upload their own profile pictures" on storage.objects;
create policy "Users upload their own profile pictures"
	on storage.objects for insert to authenticated
	with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Profile pictures are publicly readable" on storage.objects;
create policy "Profile pictures are publicly readable"
	on storage.objects for select
	using (bucket_id = 'profile-media');
drop policy if exists "Legacy profile pictures in post media are publicly readable" on storage.objects;
create policy "Legacy profile pictures in post media are publicly readable"
	on storage.objects for select to anon, authenticated
	using (
		bucket_id = 'post-media'
		and exists (
			select 1 from public.profiles
			where profiles.avatar_url = storage.objects.name
				or profiles.avatar_url like ('%/object/public/post-media/' || storage.objects.name)
		)
	);
