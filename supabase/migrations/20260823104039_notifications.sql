create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  type text not null
    check (type = btrim(type) and type ~ '^[a-z][a-z0-9_]{0,63}$'),
  title text not null
    check (title = btrim(title) and char_length(title) between 1 and 160),
  body text not null
    check (body = btrim(body) and char_length(body) between 1 and 2000),
  link text
    check (
      link is null
      or (
        link = btrim(link)
        and left(link, 1) = '/'
        and left(link, 2) <> '//'
        and position(chr(92) in link) = 0
        and link !~ '[[:space:]]'
      )
    ),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_user_id)
  where read_at is null;

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

create policy notifications_select_own
  on public.notifications for select to authenticated
  using (recipient_user_id = (select auth.uid()));

create or replace function public.mark_notification_read(
  target_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authenticated user required.' using errcode = '42501';
  end if;

  update public.notifications notification
  set read_at = now()
  where notification.id = target_notification_id
    and notification.recipient_user_id = current_user_id
    and notification.read_at is null;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authenticated user required.' using errcode = '42501';
  end if;

  update public.notifications notification
  set read_at = now()
  where notification.recipient_user_id = current_user_id
    and notification.read_at is null;
end;
$$;

revoke all on function public.mark_notification_read(uuid)
  from public, anon, authenticated;
revoke all on function public.mark_all_notifications_read()
  from public, anon, authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
