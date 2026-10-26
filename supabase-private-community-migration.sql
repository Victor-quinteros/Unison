-- Run once in the Supabase SQL Editor to make existing projects private-post ready.
-- Authenticated members can read the shared feed; anonymous visitors cannot.

alter table public.posts drop constraint if exists posts_scope_check;
alter table public.posts
	add constraint posts_scope_check check (scope in ('home', 'townsquare', 'community'));

grant select on public.posts, public.post_likes, public.post_comments, public.stories to authenticated;
revoke select on public.posts, public.post_likes, public.post_comments, public.stories from anon, public;

drop policy if exists "Posts are readable by everyone" on public.posts;
drop policy if exists "Posts are readable by signed-in members" on public.posts;
create policy "Posts are readable by signed-in members"
	on public.posts for select to authenticated
	using ((select auth.uid()) is not null);

drop policy if exists "Likes are readable by everyone" on public.post_likes;
drop policy if exists "Likes are readable by signed-in members" on public.post_likes;
create policy "Likes are readable by signed-in members"
	on public.post_likes for select to authenticated
	using ((select auth.uid()) is not null);

drop policy if exists "Comments are readable by everyone" on public.post_comments;
drop policy if exists "Comments are readable by signed-in members" on public.post_comments;
create policy "Comments are readable by signed-in members"
	on public.post_comments for select to authenticated
	using ((select auth.uid()) is not null);

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
	using (bucket_id = 'post-media');

-- Profile photos remain public; post attachments use the private post-media bucket.
insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Profile pictures are publicly readable" on storage.objects;
create policy "Profile pictures are publicly readable"
	on storage.objects for select
	using (bucket_id = 'profile-media');
