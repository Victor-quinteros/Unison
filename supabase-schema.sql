-- 01. Profiles and feed data
create extension if not exists pgcrypto;

create table if not exists public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	handle text not null unique,
	display_name text not null default '',
	avatar_url text,
	created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists bio text not null default '';

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	handle_base text;
begin
	handle_base := lower(regexp_replace(
		coalesce(nullif(new.raw_user_meta_data ->> 'handle', ''), split_part(coalesce(new.email, ''), '@', 1), 'member'),
		'[^a-zA-Z0-9_]+', '_', 'g'
	));
	if handle_base = '' then handle_base := 'member'; end if;

	insert into public.profiles (id, handle, display_name, avatar_url)
	values (
		new.id,
		handle_base || '_' || substring(replace(new.id::text, '-', '') from 1 for 6),
		coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), handle_base),
		new.raw_user_meta_data ->> 'avatar_url'
	)
	on conflict (id) do nothing;
	return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
	after insert on auth.users
	for each row execute function public.create_profile_for_auth_user();

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	handle_base text;
begin
	handle_base := lower(regexp_replace(
		coalesce(nullif(new.raw_user_meta_data ->> 'handle', ''), split_part(coalesce(new.email, ''), '@', 1), 'member'),
		'[^a-zA-Z0-9_]+', '_', 'g'
	));
	if handle_base = '' then handle_base := 'member'; end if;

	insert into public.profiles (id, handle, display_name, avatar_url)
	values (
		new.id,
		handle_base || '_' || substring(replace(new.id::text, '-', '') from 1 for 6),
		coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), handle_base),
		new.raw_user_meta_data ->> 'avatar_url'
	)
	on conflict (id) do nothing;
	return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
	after insert on auth.users
	for each row execute function public.create_profile_for_auth_user();

create table if not exists public.posts (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.profiles (id) on delete cascade,
	body text not null check (char_length(body) between 1 and 500),
	scope text not null default 'home' check (scope in ('home', 'townsquare', 'community')),
	visibility text not null default 'public' check (visibility in ('public', 'private')),
	image_path text,
	created_at timestamptz not null default now()
);
alter table public.posts drop constraint if exists posts_scope_check;
alter table public.posts add constraint posts_scope_check check (scope in ('home', 'townsquare', 'community'));
alter table public.posts add column if not exists visibility text not null default 'public';
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check check (visibility in ('public', 'private'));

create table if not exists public.post_likes (
	post_id uuid not null references public.posts (id) on delete cascade,
	user_id uuid not null references public.profiles (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (post_id, user_id)
);

create table if not exists public.post_comments (
	id uuid primary key default gen_random_uuid(),
	post_id uuid not null references public.posts (id) on delete cascade,
	user_id uuid not null references public.profiles (id) on delete cascade,
	body text not null check (char_length(body) between 1 and 1000),
	created_at timestamptz not null default now()
);

create table if not exists public.saved_posts (
	post_id uuid not null references public.posts (id) on delete cascade,
	user_id uuid not null references public.profiles (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (post_id, user_id)
);

create table if not exists public.follows (
	follower_id uuid not null references public.profiles (id) on delete cascade,
	followed_id uuid not null references public.profiles (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (follower_id, followed_id),
	check (follower_id <> followed_id)
);

create table if not exists public.groups (
	id text primary key,
	name text not null,
	description text not null default ''
);

create table if not exists public.groups_memberships (
	group_id text not null references public.groups (id) on delete cascade,
	user_id uuid not null references public.profiles (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (group_id, user_id)
);

create table if not exists public.stories (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.profiles (id) on delete cascade,
	image_path text not null,
	caption text not null default '',
	expires_at timestamptz not null default now() + interval '24 hours',
	created_at timestamptz not null default now()
);

create table if not exists public.messages (
	id uuid primary key default gen_random_uuid(),
	sender_id uuid not null references public.profiles (id) on delete cascade,
	recipient_id uuid not null references public.profiles (id) on delete cascade,
	body text not null check (char_length(body) between 1 and 5000),
	created_at timestamptz not null default now(),
	check (sender_id <> recipient_id)
);

insert into public.groups (id, name, description) values
	('nature-adventure', 'Nature & Adventure', 'Share trails, parks, and outdoor finds.'),
	('tech-innovation', 'Tech & Innovation', 'Talk about new ideas and technology.'),
	('gaming-community', 'Gaming Community', 'Find people to play and chat with.'),
	('panama-travel-life', 'Panama Travel & Life', 'Explore Panama with local recommendations.'),
	('car-enthusiasts', 'Car Enthusiasts', 'Share cars, events, and advice.')
on conflict (id) do nothing;

create table if not exists public.groups (
	id text primary key,
	name text not null,
	description text not null default ''
);

create table if not exists public.groups_memberships (
	group_id text not null references public.groups (id) on delete cascade,
	user_id uuid not null references public.profiles (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (group_id, user_id)
);

insert into public.groups (id, name, description) values
	('nature-adventure', 'Nature & Adventure', 'Share trails, parks, and outdoor finds.'),
	('tech-innovation', 'Tech & Innovation', 'Talk about new ideas and technology.'),
	('gaming-community', 'Gaming Community', 'Find people to play and chat with.'),
	('panama-travel-life', 'Panama Travel & Life', 'Explore Panama with local recommendations.'),
	('car-enthusiasts', 'Car Enthusiasts', 'Share cars, events, and advice.')
on conflict (id) do nothing;

create index if not exists posts_scope_created_at_idx on public.posts (scope, created_at desc);
create index if not exists post_comments_post_created_at_idx on public.post_comments (post_id, created_at);
create index if not exists messages_sender_created_at_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_recipient_created_at_idx on public.messages (recipient_id, created_at desc);
create index if not exists follows_followed_id_idx on public.follows (followed_id);

-- 02. Row Level Security
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.saved_posts enable row level security;
alter table public.follows enable row level security;
alter table public.groups enable row level security;
alter table public.groups_memberships enable row level security;
alter table public.stories enable row level security;
alter table public.messages enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.groups, public.groups_memberships, public.follows to anon, authenticated;
grant select on public.posts, public.post_likes, public.post_comments, public.stories to authenticated;
revoke select on public.posts, public.post_likes, public.post_comments, public.stories from anon, public;
grant select on public.posts to anon;
grant select, insert, update, delete on public.profiles, public.posts, public.post_likes, public.post_comments, public.saved_posts, public.follows, public.groups_memberships, public.stories to authenticated;
revoke all on public.messages from anon, public;
grant select, insert on public.messages to authenticated;
drop policy if exists "Profiles are readable by everyone" on public.profiles;
create policy "Profiles are readable by everyone"
	on public.profiles for select
	using (true);
drop policy if exists "Users create their own profile" on public.profiles;
create policy "Users create their own profile"
	on public.profiles for insert to authenticated
	with check (id = (select auth.uid()));
drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
	on public.profiles for update to authenticated
	using (id = (select auth.uid()))
	with check (id = (select auth.uid()));

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
drop policy if exists "Users update their own posts" on public.posts;
create policy "Users update their own posts"
	on public.posts for update to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));
drop policy if exists "Users delete their own posts" on public.posts;
create policy "Users delete their own posts"
	on public.posts for delete to authenticated
	using (user_id = (select auth.uid()));

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
drop policy if exists "Users remove their own likes" on public.post_likes;
create policy "Users remove their own likes"
	on public.post_likes for delete to authenticated
	using (user_id = (select auth.uid()));

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
drop policy if exists "Participants read their messages" on public.messages;
create policy "Participants read their messages"
	on public.messages for select to authenticated
	using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);
drop policy if exists "Users send messages as themselves" on public.messages;
create policy "Users send messages as themselves"
	on public.messages for insert to authenticated
	with check ((select auth.uid()) = sender_id and sender_id <> recipient_id);
drop policy if exists "Users delete their own comments" on public.post_comments;
create policy "Users delete their own comments"
	on public.post_comments for delete to authenticated
	using (user_id = (select auth.uid()));

drop policy if exists "Users read their own saved posts" on public.saved_posts;
create policy "Users read their own saved posts"
	on public.saved_posts for select to authenticated
	using (user_id = (select auth.uid()));
drop policy if exists "Users save posts as themselves" on public.saved_posts;
create policy "Users save posts as themselves"
	on public.saved_posts for insert to authenticated
	with check (user_id = (select auth.uid()) and exists (select 1 from public.posts where posts.id = saved_posts.post_id));
drop policy if exists "Users unsave their own posts" on public.saved_posts;
create policy "Users unsave their own posts"
	on public.saved_posts for delete to authenticated
	using (user_id = (select auth.uid()));

drop policy if exists "Follows are readable by everyone" on public.follows;
create policy "Follows are readable by everyone"
	on public.follows for select
	using (true);
drop policy if exists "Users follow as themselves" on public.follows;
create policy "Users follow as themselves"
	on public.follows for insert to authenticated
	with check (follower_id = (select auth.uid()));
drop policy if exists "Users unfollow as themselves" on public.follows;
create policy "Users unfollow as themselves"
	on public.follows for delete to authenticated
	using (follower_id = (select auth.uid()));

drop policy if exists "Groups are readable by everyone" on public.groups;
create policy "Groups are readable by everyone"
	on public.groups for select using (true);
drop policy if exists "Memberships are readable by everyone" on public.groups_memberships;
create policy "Memberships are readable by everyone"
	on public.groups_memberships for select using (true);
drop policy if exists "Users join groups as themselves" on public.groups_memberships;
create policy "Users join groups as themselves"
	on public.groups_memberships for insert to authenticated
	with check (user_id = (select auth.uid()));
drop policy if exists "Users leave groups as themselves" on public.groups_memberships;
create policy "Users leave groups as themselves"
	on public.groups_memberships for delete to authenticated
	using (user_id = (select auth.uid()));

drop policy if exists "Unexpired stories are publicly readable" on public.stories;
drop policy if exists "Unexpired stories are readable by members" on public.stories;
create policy "Unexpired stories are readable by members"
	on public.stories for select to authenticated using (expires_at > now());
drop policy if exists "Users create their own stories" on public.stories;
create policy "Users create their own stories"
	on public.stories for insert to authenticated
	with check (user_id = (select auth.uid()));
drop policy if exists "Users delete their own stories" on public.stories;
create policy "Users delete their own stories"
	on public.stories for delete to authenticated
	using (user_id = (select auth.uid()));

-- 03. Post image storage
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Post images are publicly readable" on storage.objects;
drop policy if exists "Signed-in members can read post images" on storage.objects;
drop policy if exists "Members read images attached to visible posts" on storage.objects;
create policy "Signed-in members can read post images"
	on storage.objects for select to authenticated
	using (bucket_id = 'post-media' and (owner_id = (select auth.uid())::text or exists (select 1 from public.posts where posts.image_path = storage.objects.name)));
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
drop policy if exists "Signed-in users upload their own post images" on storage.objects;
create policy "Signed-in users upload their own post images"
	on storage.objects for insert to authenticated
	with check (bucket_id = 'post-media' and owner_id = (select auth.uid())::text);
drop policy if exists "Users update their own post images" on storage.objects;
create policy "Users update their own post images"
	on storage.objects for update to authenticated
	using (bucket_id = 'post-media' and owner_id = (select auth.uid())::text)
	with check (bucket_id = 'post-media' and owner_id = (select auth.uid())::text);
drop policy if exists "Users delete their own post images" on storage.objects;
create policy "Users delete their own post images"
	on storage.objects for delete to authenticated
	using (bucket_id = 'post-media' and owner_id = (select auth.uid())::text);

drop policy if exists "Profile pictures are publicly readable" on storage.objects;
create policy "Profile pictures are publicly readable"
	on storage.objects for select
	using (bucket_id = 'profile-media');
drop policy if exists "Users upload their own profile pictures" on storage.objects;
create policy "Users upload their own profile pictures"
	on storage.objects for insert to authenticated
	with check (bucket_id = 'profile-media' and owner_id = (select auth.uid())::text);
