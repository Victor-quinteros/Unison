-- 01. Notifications table
create table if not exists public.notifications (
	id uuid primary key default gen_random_uuid(),
	recipient_id uuid not null references public.profiles (id) on delete cascade,
	sender_id uuid references public.profiles (id) on delete set null,
	type text not null check (type in ('like', 'comment', 'follow', 'mention')),
	entity_type text not null check (entity_type in ('post', 'comment', 'profile')),
	entity_id uuid not null,
	read boolean not null default false,
	created_at timestamptz not null default now()
);

-- 02. Indexes for performance
create index if not exists notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_sender_created_idx on public.notifications (sender_id, created_at desc);
create index if not exists notifications_entity_idx on public.notifications (entity_type, entity_id);

-- 03. Enable RLS
alter table public.notifications enable row level security;

-- 04. Policies

-- Users can view their own notifications
drop policy if exists "Users view their own notifications" on public.notifications;
create policy "Users view their own notifications"
	on public.notifications for select to authenticated
	using (recipient_id = (select auth.uid()));

-- Users can send notifications (when creating likes, comments, follows, etc.)
drop policy if exists "Users can create notifications" on public.notifications;
create policy "Users can create notifications"
	on public.notifications for insert to authenticated
	with check (
		sender_id = (select auth.uid())
		or sender_id is null
	);

-- Users can mark their own notifications as read
drop policy if exists "Users mark own notifications read" on public.notifications;
create policy "Users mark own notifications read"
	on public.notifications for update to authenticated
	using (recipient_id = (select auth.uid()))
	with check (recipient_id = (select auth.uid()));

-- Users can delete their own notifications
drop policy if exists "Users delete own notifications" on public.notifications;
create policy "Users delete own notifications"
	on public.notifications for delete to authenticated
	using (recipient_id = (select auth.uid()));

-- 05. Grant permissions
grant select, insert, update, delete on public.notifications to authenticated;
revoke all on public.notifications from anon, public;