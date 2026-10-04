begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(41);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000d001', 'authenticated', 'authenticated', 'public-site-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-00000000d002', 'authenticated', 'authenticated', 'public-site-employee@example.test', now(), now());
update public.user_roles set role = case user_id
  when '00000000-0000-4000-8000-00000000d001'::uuid then 'hr_personnel'::public.app_role
  else 'employee'::public.app_role
end
where user_id in ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d002');

insert into public.announcements (id, title, summary, body, category, status, published_at)
values
  ('00000000-0000-4000-8000-00000000d101', 'Published notice', 'Visible summary', 'Visible body', 'news', 'published', now()),
  ('00000000-0000-4000-8000-00000000d102', 'Draft notice', 'Draft summary', 'Draft body', 'advisory', 'draft', null),
  ('00000000-0000-4000-8000-00000000d103', 'Archived notice', 'Old summary', 'Old body', 'event', 'archived', '2026-01-01 00:00:00+00');

-- Task 1b seeds placeholder contacts; these assertions count only their own fixtures.
delete from public.public_contacts;

insert into public.public_contacts (id, label, kind, value, sort_order, is_visible)
values
  ('00000000-0000-4000-8000-00000000d201', 'HR Office', 'phone', '(02) 8123-4567', 1, true),
  ('00000000-0000-4000-8000-00000000d202', 'Hidden line', 'phone', '0917 000 0000', 2, false);

-- ---------------------------------------------------------------------------
-- Visitors (anon)
-- ---------------------------------------------------------------------------
set local role anon;
select extensions.is(
  (select count(*) from public.announcements where id in ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-00000000d103')),
  1::bigint, 'Visitors see only published announcements');
select extensions.is(
  (select count(*) from public.public_contacts where id in ('00000000-0000-4000-8000-00000000d201', '00000000-0000-4000-8000-00000000d202')),
  1::bigint, 'Visitors see only visible contacts');
select extensions.throws_ok($$select public.save_announcement(null, 'T', 'S', 'B', 'news')$$, '42501', null, 'Visitors cannot write announcements');
select extensions.throws_ok($$select public.save_public_contact(null, 'phone', 'Desk', '(02) 8123-4567', true)$$, '42501', null, 'Visitors cannot write contacts');

-- ---------------------------------------------------------------------------
-- Signed-in non-HR (employee)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000d002';
select extensions.is(
  (select count(*) from public.announcements where id in ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-00000000d103')),
  1::bigint, 'An employee sees only published announcements');
select extensions.is(
  (select count(*) from public.public_contacts where id in ('00000000-0000-4000-8000-00000000d201', '00000000-0000-4000-8000-00000000d202')),
  1::bigint, 'An employee sees only visible contacts');
select extensions.throws_ok($$select public.save_announcement(null, 'T', 'S', 'B', 'news')$$, '42501', 'HR access is required.', 'An employee cannot save an announcement');
select extensions.throws_ok($$select public.set_announcement_status('00000000-0000-4000-8000-00000000d101', 'archived')$$, '42501', 'HR access is required.', 'An employee cannot change an announcement status');
select extensions.throws_ok($$select public.delete_announcement('00000000-0000-4000-8000-00000000d102')$$, '42501', 'HR access is required.', 'An employee cannot delete an announcement');
select extensions.throws_ok($$select public.save_public_contact(null, 'phone', 'Desk', '(02) 8123-4567', true)$$, '42501', 'HR access is required.', 'An employee cannot save a contact');
select extensions.throws_ok($$select public.delete_public_contact('00000000-0000-4000-8000-00000000d201')$$, '42501', 'HR access is required.', 'An employee cannot delete a contact');
select extensions.throws_ok($$select public.reorder_public_contacts(array['00000000-0000-4000-8000-00000000d201'::uuid])$$, '42501', 'HR access is required.', 'An employee cannot reorder contacts');

-- ---------------------------------------------------------------------------
-- HR
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000d001';
select extensions.is(
  (select count(*) from public.announcements where id in ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-00000000d103')),
  3::bigint, 'HR sees drafts and archived announcements too');
select extensions.is(
  (select count(*) from public.public_contacts where id in ('00000000-0000-4000-8000-00000000d201', '00000000-0000-4000-8000-00000000d202')),
  2::bigint, 'HR sees hidden contacts too');

select extensions.is(
  (public.save_announcement(null, '  Road closure advisory  ', 'Road works this weekend.', 'Line one' || chr(10) || chr(10) || 'Line two', 'advisory')).status,
  'draft', 'A new announcement starts as a draft');
select extensions.is((select count(*) from public.announcements where title = 'Road closure advisory'), 1::bigint, 'The saved title is trimmed');
select extensions.throws_ok($$select public.save_announcement(null, '   ', 'S', 'B', 'news')$$, '22023', 'Enter a title of 1 to 150 characters.', 'A blank title is rejected');
select extensions.throws_ok($$select public.save_announcement(null, 'T', 'S', 'B', 'gossip')$$, '22023', 'Choose a category.', 'An unknown category is rejected');
select extensions.is(
  (public.save_announcement('00000000-0000-4000-8000-00000000d101', 'Published notice (edited)', 'Visible summary', 'Visible body', 'news')).status,
  'published', 'Editing a published announcement keeps it published');
select extensions.ok(
  (public.set_announcement_status((select id from public.announcements where title = 'Road closure advisory'), 'published')).published_at is not null,
  'Publishing sets published_at');
select extensions.is(
  (public.set_announcement_status('00000000-0000-4000-8000-00000000d103', 'published')).published_at,
  '2026-01-01 00:00:00+00'::timestamptz, 'Re-publishing an archived announcement keeps its first publication date');
select extensions.throws_ok($$select public.set_announcement_status('00000000-0000-4000-8000-00000000d102', 'archived')$$, '22023', 'Only a published announcement can be archived.', 'A draft cannot be archived');
select extensions.throws_ok($$select public.set_announcement_status('00000000-0000-4000-8000-00000000d101', 'published')$$, '22023', 'The announcement is already published.', 'Publishing twice is refused');
select extensions.throws_ok($$select public.delete_announcement('00000000-0000-4000-8000-00000000d101')$$, '22023', 'Only draft announcements can be deleted. Archive a published announcement instead.', 'A published announcement cannot be deleted');
select extensions.lives_ok($$select public.delete_announcement('00000000-0000-4000-8000-00000000d102')$$, 'A draft announcement can be deleted');

select extensions.is(
  (public.save_public_contact(null, 'email', 'HR email', 'hr@example.test', true)).sort_order,
  3, 'A new contact goes to the end of the list');
select extensions.throws_ok($$select public.save_public_contact(null, 'email', 'Bad email', 'not-an-email', true)$$, '22023', 'Enter a valid email address.', 'An invalid email is rejected');
select extensions.throws_ok($$select public.save_public_contact(null, 'facebook', 'Page', 'facebook.com/station', true)$$, '22023', 'Enter the Facebook page link, for example https://www.facebook.com/yourpage.', 'A Facebook value must be a full page link');
select extensions.throws_ok($$select public.save_public_contact(null, 'phone', 'Desk', 'call us', true)$$, '22023', 'Enter a phone number using digits, spaces, +, (, ) and - only.', 'A phone value must be a number');
select extensions.throws_ok($$select public.reorder_public_contacts(array['00000000-0000-4000-8000-00000000d201'::uuid])$$, '22023', 'The contact list changed. Reload the page and try again.', 'A reorder that leaves out a contact is refused');
select extensions.lives_ok($$select public.reorder_public_contacts(array(select id from public.public_contacts order by sort_order desc))$$, 'HR can reorder every contact');
select extensions.is((select sort_order from public.public_contacts where id = '00000000-0000-4000-8000-00000000d201'), 3, 'The first contact moved to the end');
select extensions.lives_ok($$select public.delete_public_contact('00000000-0000-4000-8000-00000000d202')$$, 'HR can delete a contact');

set local role anon;
select extensions.is((select count(*) from public.announcements where title = 'Road closure advisory'), 1::bigint, 'Visitors see an announcement once HR publishes it');

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
set local role postgres;
select extensions.ok(exists (select 1 from public.audit_logs where entity_type = 'announcements' and action = 'created' and metadata ->> 'title' = 'Road closure advisory' and actor_user_id = '00000000-0000-4000-8000-00000000d001'), 'Creating an announcement is audited');
select extensions.ok(exists (select 1 from public.audit_logs where entity_type = 'announcements' and action = 'updated' and entity_id = '00000000-0000-4000-8000-00000000d101'), 'Editing an announcement is audited');
select extensions.ok(exists (select 1 from public.audit_logs where entity_type = 'announcements' and action = 'status_changed' and entity_id = '00000000-0000-4000-8000-00000000d103' and metadata ->> 'to' = 'published'), 'Publishing is audited');
select extensions.ok(exists (select 1 from public.audit_logs where entity_type = 'announcements' and action = 'deleted' and entity_id = '00000000-0000-4000-8000-00000000d102'), 'Deleting a draft is audited');
select extensions.ok(exists (select 1 from public.audit_logs where entity_type = 'public_contacts' and action = 'created' and metadata ->> 'label' = 'HR email'), 'Adding a contact is audited');
select extensions.ok(exists (select 1 from public.audit_logs where entity_type = 'public_contacts' and action = 'updated' and (metadata ->> 'reordered')::boolean), 'Reordering contacts is audited');
select extensions.ok(exists (select 1 from public.audit_logs where entity_type = 'public_contacts' and action = 'deleted' and entity_id = '00000000-0000-4000-8000-00000000d202'), 'Deleting a contact is audited');

select * from extensions.finish();
rollback;
