-- Run in the Supabase SQL Editor. Existing posts become visible to signed-in
-- members by default; new posts can be public to members or private to owner.

alter table public.posts drop constraint if exists posts_scope_check;
alter table public.posts
	add constraint posts_scope_check check (scope in ('home', 'townsquare', 'community'));
alter table public.posts add column if not exists visibility text not null default 'public';
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts
	add constraint posts_visibility_check check (visibility in ('public', 'private'));

grant select on public.posts, public.post_likes, public.post_comments, public.stories to authenticated;
revoke select on public.posts, public.post_likes, public.post_comments, public.stories from anon, public;

drop policy if exists "Posts are readable by everyone" on public.posts;
drop policy if exists "Posts are readable by signed-in members" on public.posts;
drop policy if exists "Members read public posts and owners read private posts" on public.posts;
create policy "Members read public posts and owners read private posts"
	on public.posts for select to authenticated
	using ((select auth.uid()) is not null and (visibility = 'public' or user_id = (select auth.uid())));

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

insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do update set public = true;
drop policy if exists "Profile pictures are publicly readable" on storage.objects;
create policy "Profile pictures are publicly readable"
	on storage.objects for select
	using (bucket_id = 'profile-media');
