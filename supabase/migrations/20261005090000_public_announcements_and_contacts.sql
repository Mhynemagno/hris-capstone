-- Public portal content (tester feedback 2026-10-04, Part D).
--   * public.announcements: HR-written news shown on the landing page and at /announcements/<id>.
--   * public.public_contacts: HR-managed entries for the landing page's Contact section.
--   * Visitors (anon and authenticated) read only published announcements and visible contacts;
--     active HR reads everything. Every write goes through an audited security definer RPC gated by
--     private.require_active_hr(). Placeholder contacts are seeded separately (20261005091000).

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null constraint announcements_title_length check (char_length(btrim(title)) between 1 and 150),
  summary text not null constraint announcements_summary_length check (char_length(btrim(summary)) between 1 and 300),
  body text not null constraint announcements_body_length check (char_length(btrim(body)) between 1 and 10000),
  category text not null constraint announcements_category_check check (category in ('news', 'advisory', 'event', 'recruitment')),
  status text not null default 'draft' constraint announcements_status_check check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_published_has_date check (status <> 'published' or published_at is not null)
);

create index announcements_published_idx on public.announcements (published_at desc) where status = 'published';
create index announcements_created_by_idx on public.announcements (created_by);
create index announcements_updated_by_idx on public.announcements (updated_by);

create table public.public_contacts (
  id uuid primary key default gen_random_uuid(),
  label text not null constraint public_contacts_label_length check (char_length(btrim(label)) between 1 and 80),
  kind text not null constraint public_contacts_kind_check check (kind in ('phone', 'email', 'address', 'hours', 'facebook')),
  value text not null constraint public_contacts_value_length check (char_length(btrim(value)) between 1 and 300),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index public_contacts_sort_idx on public.public_contacts (sort_order, created_at);

create trigger announcements_touch_updated_at
  before update on public.announcements
  for each row execute procedure private.touch_updated_at();
create trigger public_contacts_touch_updated_at
  before update on public.public_contacts
  for each row execute procedure private.touch_updated_at();

alter table public.announcements enable row level security;
alter table public.public_contacts enable row level security;

revoke all on table public.announcements, public.public_contacts from anon, authenticated;
grant select on table public.announcements, public.public_contacts to anon, authenticated;

create policy announcements_select_anon_published
  on public.announcements for select to anon
  using (status = 'published');
create policy announcements_select_authenticated
  on public.announcements for select to authenticated
  using (status = 'published' or (select private.current_user_has_role('hr_personnel'::public.app_role)));

create policy public_contacts_select_anon_visible
  on public.public_contacts for select to anon
  using (is_visible);
create policy public_contacts_select_authenticated
  on public.public_contacts for select to authenticated
  using (is_visible or (select private.current_user_has_role('hr_personnel'::public.app_role)));

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create or replace function private.save_announcement(
  target_announcement_id uuid,
  target_title text,
  target_summary text,
  target_body text,
  target_category text
)
returns public.announcements
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  clean_title text := btrim(coalesce(target_title, ''));
  clean_summary text := btrim(coalesce(target_summary, ''));
  clean_body text := btrim(coalesce(target_body, ''));
  saved public.announcements%rowtype;
begin
  if char_length(clean_title) not between 1 and 150 then
    raise exception 'Enter a title of 1 to 150 characters.' using errcode = '22023';
  end if;
  if char_length(clean_summary) not between 1 and 300 then
    raise exception 'Enter a summary of 1 to 300 characters.' using errcode = '22023';
  end if;
  if char_length(clean_body) not between 1 and 10000 then
    raise exception 'Enter the announcement text (up to 10,000 characters).' using errcode = '22023';
  end if;
  if target_category is null or target_category not in ('news', 'advisory', 'event', 'recruitment') then
    raise exception 'Choose a category.' using errcode = '22023';
  end if;

  if target_announcement_id is null then
    insert into public.announcements (title, summary, body, category, created_by, updated_by)
    values (clean_title, clean_summary, clean_body, target_category, caller_id, caller_id)
    returning * into saved;
    insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
    values (caller_id, 'announcements', saved.id::text, 'created', jsonb_build_object('title', saved.title, 'category', saved.category));
  else
    update public.announcements
    set title = clean_title, summary = clean_summary, body = clean_body, category = target_category, updated_by = caller_id
    where id = target_announcement_id
    returning * into saved;
    if not found then raise exception 'Announcement was not found.' using errcode = 'P0001'; end if;
    insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
    values (caller_id, 'announcements', saved.id::text, 'updated', jsonb_build_object('title', saved.title, 'category', saved.category));
  end if;
  return saved;
end;
$$;

create or replace function private.set_announcement_status(target_announcement_id uuid, target_status text)
returns public.announcements
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  previous public.announcements%rowtype;
  saved public.announcements%rowtype;
begin
  if target_status is null or target_status not in ('published', 'archived') then
    raise exception 'Choose publish or archive.' using errcode = '22023';
  end if;
  select * into previous from public.announcements where id = target_announcement_id for update;
  if not found then raise exception 'Announcement was not found.' using errcode = 'P0001'; end if;
  if previous.status = target_status then
    raise exception 'The announcement is already %.', target_status using errcode = '22023';
  end if;
  if target_status = 'archived' and previous.status <> 'published' then
    raise exception 'Only a published announcement can be archived.' using errcode = '22023';
  end if;

  update public.announcements
  set status = target_status,
      -- The first publication date is kept when an archived announcement is published again.
      published_at = case when target_status = 'published' then coalesce(published_at, now()) else published_at end,
      updated_by = caller_id
  where id = target_announcement_id
  returning * into saved;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'announcements', saved.id::text, 'status_changed', jsonb_build_object('title', saved.title, 'from', previous.status, 'to', saved.status));
  return saved;
end;
$$;

create or replace function private.delete_announcement(target_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  previous public.announcements%rowtype;
begin
  select * into previous from public.announcements where id = target_announcement_id for update;
  if not found then raise exception 'Announcement was not found.' using errcode = 'P0001'; end if;
  if previous.status <> 'draft' then
    raise exception 'Only draft announcements can be deleted. Archive a published announcement instead.' using errcode = '22023';
  end if;
  delete from public.announcements where id = target_announcement_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'announcements', previous.id::text, 'deleted', jsonb_build_object('title', previous.title));
end;
$$;

-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------
create or replace function private.save_public_contact(
  target_contact_id uuid,
  target_kind text,
  target_label text,
  target_value text,
  target_is_visible boolean
)
returns public.public_contacts
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  clean_label text := btrim(coalesce(target_label, ''));
  clean_value text := btrim(coalesce(target_value, ''));
  saved public.public_contacts%rowtype;
begin
  if target_kind is null or target_kind not in ('phone', 'email', 'address', 'hours', 'facebook') then
    raise exception 'Choose a contact type.' using errcode = '22023';
  end if;
  if char_length(clean_label) not between 1 and 80 then
    raise exception 'Enter a label of 1 to 80 characters.' using errcode = '22023';
  end if;
  if char_length(clean_value) not between 1 and 300 then
    raise exception 'Enter contact details of 1 to 300 characters.' using errcode = '22023';
  end if;
  if target_kind = 'phone' and (clean_value !~ '^\+?[0-9()\s.-]{7,30}$' or char_length(regexp_replace(clean_value, '[^0-9]', '', 'g')) < 7) then
    raise exception 'Enter a phone number using digits, spaces, +, (, ) and - only.' using errcode = '22023';
  end if;
  if target_kind = 'email' and clean_value !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if target_kind = 'facebook' and clean_value !~* '^https://(www\.|m\.)?facebook\.com/\S+$' then
    raise exception 'Enter the Facebook page link, for example https://www.facebook.com/yourpage.' using errcode = '22023';
  end if;

  if target_contact_id is null then
    insert into public.public_contacts (label, kind, value, is_visible, sort_order)
    values (clean_label, target_kind, clean_value, coalesce(target_is_visible, true),
      coalesce((select max(sort_order) from public.public_contacts), 0) + 1)
    returning * into saved;
    insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
    values (caller_id, 'public_contacts', saved.id::text, 'created', jsonb_build_object('label', saved.label, 'kind', saved.kind, 'is_visible', saved.is_visible));
  else
    update public.public_contacts
    set label = clean_label, kind = target_kind, value = clean_value, is_visible = coalesce(target_is_visible, true)
    where id = target_contact_id
    returning * into saved;
    if not found then raise exception 'Contact was not found.' using errcode = 'P0001'; end if;
    insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
    values (caller_id, 'public_contacts', saved.id::text, 'updated', jsonb_build_object('label', saved.label, 'kind', saved.kind, 'is_visible', saved.is_visible));
  end if;
  return saved;
end;
$$;

create or replace function private.delete_public_contact(target_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  removed public.public_contacts%rowtype;
begin
  delete from public.public_contacts where id = target_contact_id returning * into removed;
  if not found then raise exception 'Contact was not found.' using errcode = 'P0001'; end if;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'public_contacts', removed.id::text, 'deleted', jsonb_build_object('label', removed.label, 'kind', removed.kind));
end;
$$;

-- The client sends every contact id in the new order; a list that no longer matches the table
-- (another HR user added or deleted an entry) is refused instead of being half-applied.
create or replace function private.reorder_public_contacts(ordered_contact_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  contact_count integer;
begin
  perform 1 from public.public_contacts for update;
  select count(*) into contact_count from public.public_contacts;
  if ordered_contact_ids is null
    or cardinality(ordered_contact_ids) <> contact_count
    or (select count(distinct listed.contact_id) from unnest(ordered_contact_ids) as listed(contact_id)) <> contact_count
    or exists (select 1 from public.public_contacts contact where contact.id <> all (ordered_contact_ids)) then
    raise exception 'The contact list changed. Reload the page and try again.' using errcode = '22023';
  end if;
  update public.public_contacts contact
  set sort_order = listed.listed_order::integer
  from unnest(ordered_contact_ids) with ordinality as listed(contact_id, listed_order)
  where contact.id = listed.contact_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'public_contacts', 'all', 'updated', jsonb_build_object('reordered', true, 'count', contact_count));
end;
$$;

-- ---------------------------------------------------------------------------
-- Public wrappers and grants
-- ---------------------------------------------------------------------------
create or replace function public.save_announcement(target_announcement_id uuid, target_title text, target_summary text, target_body text, target_category text)
returns public.announcements language plpgsql security definer set search_path = '' as $$
begin
  return private.save_announcement(target_announcement_id, target_title, target_summary, target_body, target_category);
end;
$$;
create or replace function public.set_announcement_status(target_announcement_id uuid, target_status text)
returns public.announcements language plpgsql security definer set search_path = '' as $$
begin
  return private.set_announcement_status(target_announcement_id, target_status);
end;
$$;
create or replace function public.delete_announcement(target_announcement_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.delete_announcement(target_announcement_id);
end;
$$;
create or replace function public.save_public_contact(target_contact_id uuid, target_kind text, target_label text, target_value text, target_is_visible boolean)
returns public.public_contacts language plpgsql security definer set search_path = '' as $$
begin
  return private.save_public_contact(target_contact_id, target_kind, target_label, target_value, target_is_visible);
end;
$$;
create or replace function public.delete_public_contact(target_contact_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.delete_public_contact(target_contact_id);
end;
$$;
create or replace function public.reorder_public_contacts(ordered_contact_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.reorder_public_contacts(ordered_contact_ids);
end;
$$;

revoke all on function
  private.save_announcement(uuid, text, text, text, text),
  private.set_announcement_status(uuid, text),
  private.delete_announcement(uuid),
  private.save_public_contact(uuid, text, text, text, boolean),
  private.delete_public_contact(uuid),
  private.reorder_public_contacts(uuid[])
from public, anon, authenticated;

revoke all on function
  public.save_announcement(uuid, text, text, text, text),
  public.set_announcement_status(uuid, text),
  public.delete_announcement(uuid),
  public.save_public_contact(uuid, text, text, text, boolean),
  public.delete_public_contact(uuid),
  public.reorder_public_contacts(uuid[])
from public, anon;

grant execute on function
  public.save_announcement(uuid, text, text, text, text),
  public.set_announcement_status(uuid, text),
  public.delete_announcement(uuid),
  public.save_public_contact(uuid, text, text, text, boolean),
  public.delete_public_contact(uuid),
  public.reorder_public_contacts(uuid[])
to authenticated;
