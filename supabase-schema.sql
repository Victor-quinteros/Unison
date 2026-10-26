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
	scope text not null default 'home' check (scope in ('home', 'townsquare')),
	image_path text,
	created_at timestamptz not null default now()
);

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

create table if not exists public.group_memberships (
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

create table if not exists public.group_memberships (
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
create index if not exists follows_followed_id_idx on public.follows (followed_id);

-- 02. Row Level Security
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.saved_posts enable row level security;
alter table public.follows enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.stories enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.posts, public.post_likes, public.post_comments, public.groups, public.group_memberships, public.follows, public.stories to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.posts, public.post_likes, public.post_comments, public.saved_posts, public.follows, public.group_memberships, public.stories to authenticated;
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
create policy "Posts are readable by everyone"
	on public.posts for select
	using (true);
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
create policy "Likes are readable by everyone"
	on public.post_likes for select
	using (true);
drop policy if exists "Users like posts as themselves" on public.post_likes;
create policy "Users like posts as themselves"
	on public.post_likes for insert to authenticated
	with check (user_id = (select auth.uid()));
drop policy if exists "Users remove their own likes" on public.post_likes;
create policy "Users remove their own likes"
	on public.post_likes for delete to authenticated
	using (user_id = (select auth.uid()));

drop policy if exists "Comments are readable by everyone" on public.post_comments;
create policy "Comments are readable by everyone"
	on public.post_comments for select
	using (true);
drop policy if exists "Users create comments as themselves" on public.post_comments;
create policy "Users create comments as themselves"
	on public.post_comments for insert to authenticated
	with check (user_id = (select auth.uid()));
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
	with check (user_id = (select auth.uid()));
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
drop policy if exists "Memberships are readable by everyone" on public.group_memberships;
create policy "Memberships are readable by everyone"
	on public.group_memberships for select using (true);
drop policy if exists "Users join groups as themselves" on public.group_memberships;
create policy "Users join groups as themselves"
	on public.group_memberships for insert to authenticated
	with check (user_id = (select auth.uid()));
drop policy if exists "Users leave groups as themselves" on public.group_memberships;
create policy "Users leave groups as themselves"
	on public.group_memberships for delete to authenticated
	using (user_id = (select auth.uid()));

drop policy if exists "Unexpired stories are publicly readable" on public.stories;
create policy "Unexpired stories are publicly readable"
	on public.stories for select using (expires_at > now());
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
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

drop policy if exists "Post images are publicly readable" on storage.objects;
create policy "Post images are publicly readable"
	on storage.objects for select
	using (bucket_id = 'post-media');
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
