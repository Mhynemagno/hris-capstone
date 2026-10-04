# Public Landing Page, Announcements and Contacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/` into a public portal in the style of the supplied mock, with HR-published announcements (`/announcements/[id]`) and HR-managed contact entries edited at `/hr/public-site`.

**Architecture:** Two new tables (`public.announcements`, `public.public_contacts`) are readable through RLS: visitors see only published or visible rows, and active HR sees everything. All writes go through audited `security definer` RPCs gated by `private.require_active_hr()`. The landing page stays a client component fed by React Query hooks. The single announcement page is a server component that reads through the cookie-aware server Supabase client, wrapped in React `cache` so `generateMetadata` and the page share one query. Both public pages move into a `(public)` route group whose layout loads Montserrat and Inter for those pages only.

**Tech Stack:** Next.js 16.3.6 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres, RLS, supabase-js, @supabase/ssr), @tanstack/react-query 5, react-hook-form + zod 4, lucide-react, Vitest + Testing Library, pgTAP (`npx supabase test db`), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-04-tester-feedback-applicant-flow-and-public-landing-design.md`. This plan covers **Part D only**.

## Global Constraints

- Branch: `feat/public-landing-announcements`, created from `main` **after** `fix/tester-feedback-oct` (Parts A–C) has merged. Do not start before that merge. Task 5 reads branch 1's document rules.
- Next.js 16 rules, checked against `node_modules/next/dist/docs/`:
  - `params` is a `Promise` in pages and in `generateMetadata`; always `await params` (`01-app/03-api-reference/03-file-conventions/dynamic-routes.md` lines 22–26 and 148; `04-functions/generate-metadata.md` lines 54–63).
  - `notFound()` works by throwing and is typed `never`. Call it in the render path. Never call it inside `try/catch` (`04-functions/not-found.md`).
  - Supabase calls are not `fetch`-memoized, so share data between `generateMetadata` and the page with React `cache` (`generate-metadata.md` line 195).
  - Route groups must not produce two routes for the same URL, and the home route may live inside a group (`03-file-conventions/route-groups.md` lines 31–32).
  - Fonts loaded with `next/font/google` and a `variable` apply only where their class is used (`02-components/font.md` lines 222–232 and 555–620).
- Data values, copied verbatim from the spec:
  - Announcement `category` ∈ `news`, `advisory`, `event`, `recruitment`.
  - Announcement `status` ∈ `draft`, `published`, `archived`, default `draft`.
  - Contact `kind` ∈ `phone`, `email`, `address`, `hours`, `facebook`.
  - `title` 1–150 characters, `summary` 1–300, `body` 1–10,000, contact `value` 1–300.
- `published_at` is set when an announcement is first published and is never moved after that.
- Writes happen only through the RPCs `save_announcement`, `set_announcement_status`, `delete_announcement` (drafts only), `save_public_contact`, `delete_public_contact` and `reorder_public_contacts`. Each is gated by `private.require_active_hr()` and inserts a `public.audit_logs` row.
- No contact entries are seeded. The landing page hides its Contact section, and the matching header link, until at least one visible contact exists.
- Announcement bodies are plain text. Blank lines separate paragraphs and single newlines become line breaks. Never use `dangerouslySetInnerHTML`.
- Landing sections, in this order:
  1. Top bar ("Republic of the Philippines • Philippine National Police" and a live PST clock)
  2. Header (logos, "San Juan City Police Station HRIS", anchor nav, Login dropdown)
  3. Hero
  4. Two portal cards
  5. Latest job openings (`<PublicJobList featured pageSize={3} />`)
  6. Announcements (latest 6)
  7. About
  8. Why join
  9. FAQs (native `<details>`/`<summary>`)
  10. Contact
  11. Footer
- Leave out everything from the mock that the spec excludes: `#recruitmentProcess`, the login, status and apply modals, the invented statistics, pay figures, hotline and email, "ORPAS", and Font Awesome. Use lucide-react icons and the real logos `public/san-juan-police-logo.png` and `public/bagong-pilipinas-logo.png`.
- Accessibility:
  - Text is at least 14px. In this app `text-xs` is 14px, so never use an arbitrary `text-[Npx]` below 14.
  - Touch targets are at least 44px: use `min-h-11`, `size-11` or the default `Button` size, never `size="sm"`, `"xs"` or `"icon-xs"`.
  - Contrast is at least 4.5:1.
  - The card hover lift runs only under `motion-safe:`.
  - Every public page has exactly one `h1`.
- HR navigation entry: `{ href: "/hr/public-site", label: "Public Announcements", icon: "ScrollText", group: "Public Portal" }`.
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **HTML in an announcement body.** If HR types `<script>` or `<b>`, visitors must see those characters as literal text, never markup. Pinned in Task 6 (`AnnouncementBody` test).
2. **Bad, draft or archived ids at `/announcements/[id]`.** A visitor following an old or mistyped link should get a 404, not a 500. A non-UUID id must not reach PostgREST, which would raise `22P02` and crash the page. Pinned in Task 6 (`getPublishedAnnouncement` and page tests).
3. **Contacts that are all hidden, or that fail to load.** The landing page should show no Contact section and no Contact anchor, rather than an empty heading or an error block. Pinned in Task 5 (landing test, error case).
4. **Stale reorder.** If another HR user added or deleted a contact since the page loaded, the reorder is refused with "The contact list changed. Reload the page and try again." Nothing is half-reordered, and the message reaches the screen. Pinned in Task 1 (pgTAP) and Task 8 (panel test).
5. **Visitor outside the Philippines.** The PST clock must show Manila time, not the browser's local time, and must show midnight as `00`, never `24`. Pinned in Task 4 (`PstClock` test).

---

## File map

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20261005090000_public_announcements_and_contacts.sql` | Tables, RLS, the audited write RPCs and their grants |
| `supabase/tests/public_site.test.sql` | pgTAP: visibility, HR gate, rules, audit |
| `src/lib/types/database.ts` | `Announcement`, `PublicContact` and related types (hand-written, like every other type in this file) |
| `src/schemas/public-site.ts` | zod schemas, option lists, label helpers, shared patterns |
| `src/lib/public-site/contacts.ts` | `contactHref`, `moveId` |
| `src/lib/public-site/announcement-text.ts` | `announcementParagraphs` |
| `src/lib/administration/audit-presentation.ts` | Readable audit labels for the new entities |
| `src/queries/public-site.ts` | Browser Supabase reads and RPC calls |
| `src/hooks/use-public-site.ts` | React Query hooks |
| `src/lib/query-keys.ts` | `queryKeys.publicSite` |
| `src/lib/public-site/published-announcement.ts` | Server-side `getPublishedAnnouncement`, wrapped in React `cache` |
| `src/app/(public)/layout.tsx` | Montserrat and Inter for the public portal |
| `src/app/(public)/page.tsx` | `/`, moved from `src/app/page.tsx` |
| `src/app/(public)/announcements/[id]/page.tsx` | Public announcement page |
| `src/components/public-site/*` | Portal chrome, landing sections, announcement body, HR management UI |
| `src/components/recruitment/public-careers-landing.tsx` | Landing composition (rewritten) |
| `src/components/recruitment/public-site-header.tsx` | Light header for `/jobs` and announcements, now using `PublicAccountAction` |
| `src/app/(app)/hr/public-site/page.tsx` | HR page |
| `src/lib/app/role-config.ts` | HR navigation entry |
| `src/app/globals.css` | `portal-type`, `portal-grid` and `glass-panel` utilities |
| `e2e/business-journeys.spec.ts`, `e2e/iso25010-quality.spec.ts`, `e2e/responsive-layout.spec.ts` | Playwright coverage |

---

### Task 1: Database: tables, RLS, audited RPCs

**Files:**
- Create: `supabase/migrations/20261005090000_public_announcements_and_contacts.sql`
- Test: `supabase/tests/public_site.test.sql`

**Interfaces:**
- Consumes: `private.require_active_hr()` (returns the caller's uuid or raises `42501 'HR access is required.'`), `private.current_user_has_role(public.app_role)`, `private.touch_updated_at()`, `public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)`, `public.profiles(id)`.
- Produces (callable by `authenticated` through PostgREST):
  - `public.save_announcement(target_announcement_id uuid, target_title text, target_summary text, target_body text, target_category text) returns public.announcements`
  - `public.set_announcement_status(target_announcement_id uuid, target_status text) returns public.announcements`. `target_status` ∈ `published`, `archived`.
  - `public.delete_announcement(target_announcement_id uuid) returns void`
  - `public.save_public_contact(target_contact_id uuid, target_kind text, target_label text, target_value text, target_is_visible boolean) returns public.public_contacts`
  - `public.delete_public_contact(target_contact_id uuid) returns void`
  - `public.reorder_public_contacts(ordered_contact_ids uuid[]) returns void`
  - Audit rows:
    - `entity_type` is `announcements` or `public_contacts`.
    - `action` is one of `created`, `updated`, `status_changed`, `deleted`.
    - `metadata` holds `title` for announcements and `label` for contacts. A reorder uses `entity_id = 'all'` and `metadata = { reordered: true, count }`.

- [ ] **Step 1: Confirm the migration name sorts last**

Run: `ls supabase/migrations | tail -3`
Expected: every listed name sorts before `20261005090000_…`. Branch 1 adds `2026100…` migrations, so if one is `>= 20261005090000`, use a timestamp one hour after the newest one and use that name everywhere below.

- [ ] **Step 2: Write the failing pgTAP test**

Create `supabase/tests/public_site.test.sql`:

```sql
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx supabase db reset && npx supabase test db`
Expected: `public_site.test.sql` FAILS with `relation "public.announcements" does not exist`. The other test files pass.

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/20261005090000_public_announcements_and_contacts.sql`:

```sql
-- Public portal content (tester feedback 2026-10-04, Part D).
--   * public.announcements: HR-written news shown on the landing page and at /announcements/<id>.
--   * public.public_contacts: HR-managed entries for the landing page's Contact section.
--   * Visitors (anon and authenticated) read only published announcements and visible contacts;
--     active HR reads everything. Every write goes through an audited security definer RPC gated by
--     private.require_active_hr(). No contact entries are seeded.

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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx supabase db reset && npx supabase test db`
Expected: every file passes, including `public_site.test.sql .. ok` with 41 assertions. If the security advisor runs in CI, `npx supabase db lint` reports no new errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261005090000_public_announcements_and_contacts.sql supabase/tests/public_site.test.sql
git commit -m "$(cat <<'EOF'
feat: add public announcements and contacts tables with audited HR RPCs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Domain types, schemas, text and contact helpers, audit labels

**Files:**
- Modify: `src/lib/types/database.ts` (append at the end)
- Create: `src/schemas/public-site.ts`, `src/schemas/public-site.test.ts`
- Create: `src/lib/public-site/contacts.ts`, `src/lib/public-site/contacts.test.ts`
- Create: `src/lib/public-site/announcement-text.ts`, `src/lib/public-site/announcement-text.test.ts`
- Modify: `src/lib/administration/audit-presentation.ts` (the `entityLabels` map near line 52 and the `resourceLabel` switch)
- Modify: `src/lib/administration/audit-presentation.test.ts`
- Modify: `src/components/administration/administration-workspaces.tsx` (`AUDIT_ENTITY_SUGGESTIONS`, near line 759)

**Interfaces:**
- Consumes: the column names from Task 1.
- Produces:
  - Types: `AnnouncementCategory`, `AnnouncementStatus`, `Announcement`, `PublishedAnnouncementCard`, `PublicContactKind`, `PublicContact`, `VisibleContact`.
  - From `@/schemas/public-site`:
    - Option lists: `ANNOUNCEMENT_CATEGORIES`, `ANNOUNCEMENT_STATUS_LABELS`, `PUBLIC_CONTACT_KINDS`.
    - Label helpers: `announcementCategoryLabel(value)`, `contactKindLabel(value)`.
    - Schemas: `announcementSchema`, `AnnouncementInput`, `announcementStatusChangeSchema`, `AnnouncementStatusChange`, `publicContactSchema`, `PublicContactInput`.
    - Patterns: `PHONE_PATTERN`, `EMAIL_PATTERN`, `FACEBOOK_PAGE_PATTERN`.
  - `contactHref(kind, value): string | null` and `moveId(ids, id, direction): string[]` from `@/lib/public-site/contacts`.
  - `announcementParagraphs(body): string[][]` from `@/lib/public-site/announcement-text`.

- [ ] **Step 1: Write the failing tests**

`src/schemas/public-site.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { announcementCategoryLabel, announcementSchema, contactKindLabel, publicContactSchema } from "./public-site";

const validAnnouncement = { title: "  Road safety advisory  ", category: "advisory", summary: "Road works this weekend.", body: "First.\n\nSecond." };

describe("announcementSchema", () => {
  it("trims and accepts a valid announcement", () => {
    expect(announcementSchema.parse(validAnnouncement)).toEqual({ ...validAnnouncement, title: "Road safety advisory" });
  });

  it("enforces the spec's length limits", () => {
    expect(announcementSchema.safeParse({ ...validAnnouncement, title: "x".repeat(151) }).error?.issues[0]?.message).toBe("Use 150 characters or fewer.");
    expect(announcementSchema.safeParse({ ...validAnnouncement, summary: "x".repeat(301) }).error?.issues[0]?.message).toBe("Use 300 characters or fewer.");
    expect(announcementSchema.safeParse({ ...validAnnouncement, body: "x".repeat(10_001) }).error?.issues[0]?.message).toBe("Use 10,000 characters or fewer.");
    expect(announcementSchema.safeParse({ ...validAnnouncement, title: "   " }).error?.issues[0]?.message).toBe("Enter a title.");
  });

  it("accepts only the four categories", () => {
    expect(announcementSchema.safeParse({ ...validAnnouncement, category: "gossip" }).success).toBe(false);
    expect(announcementCategoryLabel("event")).toBe("Event");
  });
});

describe("publicContactSchema", () => {
  const contact = (kind: string, value: string) => publicContactSchema.safeParse({ kind, label: "HR Office", value, isVisible: true });

  it("accepts phone numbers and rejects words", () => {
    expect(contact("phone", "(02) 8123-4567").success).toBe(true);
    expect(contact("phone", "+63 917 123 4567").success).toBe(true);
    expect(contact("phone", "call us").error?.issues[0]?.message).toBe("Enter a phone number using digits, spaces, +, (, ) and - only.");
  });

  it("requires a real email address and a full Facebook page link", () => {
    expect(contact("email", "not-an-email").error?.issues[0]?.message).toBe("Enter a valid email address.");
    expect(contact("email", "hr@example.test").success).toBe(true);
    expect(contact("facebook", "facebook.com/station").error?.issues[0]?.message).toBe("Enter the Facebook page link, for example https://www.facebook.com/yourpage.");
    expect(contact("facebook", "https://www.facebook.com/SanJuanPolice").success).toBe(true);
  });

  it("allows free text for an address and office hours", () => {
    expect(contact("address", "Pinaglabanan St.,\nSan Juan City").success).toBe(true);
    expect(contact("hours", "Monday to Friday, 8:00 AM to 5:00 PM").success).toBe(true);
    expect(contactKindLabel("hours")).toBe("Office hours");
  });
});
```

`src/lib/public-site/contacts.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { contactHref, moveId } from "./contacts";

describe("contactHref", () => {
  it("dials phone numbers and mails email addresses", () => {
    expect(contactHref("phone", "(02) 8123-4567")).toBe("tel:0281234567");
    expect(contactHref("phone", "+63 917 123 4567")).toBe("tel:+639171234567");
    expect(contactHref("email", " hr@example.test ")).toBe("mailto:hr@example.test");
  });

  it("links only full Facebook page URLs and leaves addresses and hours as text", () => {
    expect(contactHref("facebook", "https://www.facebook.com/SanJuanPolice")).toBe("https://www.facebook.com/SanJuanPolice");
    expect(contactHref("facebook", "javascript:alert(1)")).toBeNull();
    expect(contactHref("address", "San Juan City")).toBeNull();
    expect(contactHref("hours", "8:00 AM to 5:00 PM")).toBeNull();
  });
});

describe("moveId", () => {
  it("swaps an entry with its neighbour and ignores moves past either end", () => {
    expect(moveId(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moveId(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
});
```

`src/lib/public-site/announcement-text.test.ts`:

```ts
import { expect, it } from "vitest";

import { announcementParagraphs } from "./announcement-text";

it("splits on blank lines into paragraphs and keeps single newlines as lines", () => {
  expect(announcementParagraphs("First line\nsecond line\n\n\nNext paragraph")).toEqual([["First line", "second line"], ["Next paragraph"]]);
  expect(announcementParagraphs("Windows\r\n\r\nline endings")).toEqual([["Windows"], ["line endings"]]);
  expect(announcementParagraphs("\n\n  \n")).toEqual([]);
});
```

Append to `src/lib/administration/audit-presentation.test.ts`, inside `describe("presentAuditLog", …)`:

```ts
  it("names announcements and public contacts from their audit metadata", () => {
    expect(presentAuditLog(auditLog({ entity_type: "announcements", entity_id: targetId, action: "status_changed", metadata: { title: "Road closure", from: "draft", to: "published" } }), lookups).recordLabel).toBe("Announcement “Road closure”");
    expect(presentAuditLog(auditLog({ entity_type: "public_contacts", entity_id: targetId, action: "created", metadata: { label: "HR Office" } }), lookups).summary).toBe("Public contact “HR Office” created");
    expect(presentAuditLog(auditLog({ entity_type: "public_contacts", entity_id: "all", action: "updated", metadata: { reordered: true, count: 3 } }), lookups).recordLabel).toBe("Public contact order");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/schemas/public-site.test.ts src/lib/public-site src/lib/administration/audit-presentation.test.ts`
Expected: FAIL. The new modules are missing (`Failed to resolve import "./public-site"`, `"./contacts"`, `"./announcement-text"`), and the audit test gets `Announcements #c038df5c` instead of `Announcement “Road closure”`.

- [ ] **Step 3: Implement**

Append to `src/lib/types/database.ts`:

```ts
export type AnnouncementCategory = "news" | "advisory" | "event" | "recruitment";
export type AnnouncementStatus = "draft" | "published" | "archived";

export type Announcement = {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: AnnouncementCategory;
  status: AnnouncementStatus;
  published_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** The columns the landing page's announcement cards read. */
export type PublishedAnnouncementCard = Pick<Announcement, "id" | "title" | "summary" | "category" | "published_at">;

export type PublicContactKind = "phone" | "email" | "address" | "hours" | "facebook";

export type PublicContact = {
  id: string;
  label: string;
  kind: PublicContactKind;
  value: string;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
};

/** The columns the landing page's Contact section reads. */
export type VisibleContact = Pick<PublicContact, "id" | "label" | "kind" | "value" | "sort_order">;
```

Create `src/schemas/public-site.ts`:

```ts
import { z } from "zod";

// Importing common installs the plain-language validation messages.
import "./common";

import type { AnnouncementCategory, PublicContactKind } from "@/lib/types/database";

export const ANNOUNCEMENT_CATEGORIES = [
  { value: "news", label: "News" },
  { value: "advisory", label: "Advisory" },
  { value: "event", label: "Event" },
  { value: "recruitment", label: "Recruitment" },
] as const satisfies readonly { value: AnnouncementCategory; label: string }[];

export const ANNOUNCEMENT_STATUS_LABELS = { draft: "Draft", published: "Published", archived: "Archived" } as const;

export const PUBLIC_CONTACT_KINDS = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "address", label: "Address" },
  { value: "hours", label: "Office hours" },
  { value: "facebook", label: "Facebook page" },
] as const satisfies readonly { value: PublicContactKind; label: string }[];

export function announcementCategoryLabel(value: AnnouncementCategory) {
  return ANNOUNCEMENT_CATEGORIES.find((category) => category.value === value)?.label ?? value;
}

export function contactKindLabel(value: PublicContactKind) {
  return PUBLIC_CONTACT_KINDS.find((kind) => kind.value === value)?.label ?? value;
}

/** Same rules as private.save_public_contact; keep the two in step. */
export const PHONE_PATTERN = /^\+?[0-9()\s.-]{7,30}$/;
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const FACEBOOK_PAGE_PATTERN = /^https:\/\/(www\.|m\.)?facebook\.com\/\S+$/i;

export const announcementCategorySchema = z.enum(["news", "advisory", "event", "recruitment"]);
export const announcementStatusChangeSchema = z.enum(["published", "archived"]);
export type AnnouncementStatusChange = z.infer<typeof announcementStatusChangeSchema>;

export const announcementSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(150, "Use 150 characters or fewer."),
  category: announcementCategorySchema,
  summary: z.string().trim().min(1, "Enter a short summary.").max(300, "Use 300 characters or fewer."),
  body: z.string().trim().min(1, "Enter the announcement text.").max(10_000, "Use 10,000 characters or fewer."),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;

export const publicContactKindSchema = z.enum(["phone", "email", "address", "hours", "facebook"]);

export const publicContactSchema = z
  .object({
    kind: publicContactKindSchema,
    label: z.string().trim().min(1, "Enter a label, for example HR Office.").max(80, "Use 80 characters or fewer."),
    value: z.string().trim().min(1, "Enter the contact details.").max(300, "Use 300 characters or fewer."),
    isVisible: z.boolean(),
  })
  .superRefine((contact, context) => {
    if (!contact.value) return;
    if (contact.kind === "phone" && (!PHONE_PATTERN.test(contact.value) || contact.value.replace(/\D/g, "").length < 7)) {
      context.addIssue({ code: "custom", path: ["value"], message: "Enter a phone number using digits, spaces, +, (, ) and - only." });
    }
    if (contact.kind === "email" && !EMAIL_PATTERN.test(contact.value)) {
      context.addIssue({ code: "custom", path: ["value"], message: "Enter a valid email address." });
    }
    if (contact.kind === "facebook" && !FACEBOOK_PAGE_PATTERN.test(contact.value)) {
      context.addIssue({ code: "custom", path: ["value"], message: "Enter the Facebook page link, for example https://www.facebook.com/yourpage." });
    }
  });
export type PublicContactInput = z.infer<typeof publicContactSchema>;
```

Create `src/lib/public-site/contacts.ts`:

```ts
import type { PublicContactKind } from "@/lib/types/database";
import { EMAIL_PATTERN, FACEBOOK_PAGE_PATTERN } from "@/schemas/public-site";

/** The link a visitor can follow for a contact entry, or null when the value is plain text. */
export function contactHref(kind: PublicContactKind, value: string): string | null {
  const trimmed = value.trim();
  if (kind === "phone") {
    const dialable = trimmed.replace(/[^\d+]/g, "");
    return /^\+?\d{7,}$/.test(dialable) ? `tel:${dialable}` : null;
  }
  if (kind === "email") return EMAIL_PATTERN.test(trimmed) ? `mailto:${trimmed}` : null;
  if (kind === "facebook") return FACEBOOK_PAGE_PATTERN.test(trimmed) ? trimmed : null;
  return null;
}

/** The ids in their new order after moving one entry up (-1) or down (+1); unchanged at either end. */
export function moveId(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}
```

Create `src/lib/public-site/announcement-text.ts`:

```ts
/**
 * A plain-text announcement body as paragraphs of lines: a blank line starts a new paragraph and a
 * single newline is a line break. The result is rendered as text, never as HTML.
 */
export function announcementParagraphs(body: string): string[][] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.split("\n").map((line) => line.trimEnd()))
    .filter((lines) => lines.some((line) => line.trim()));
}
```

In `src/lib/administration/audit-presentation.ts`:
- Add `announcements: "Announcement",` as the first key of `entityLabels`.
- Add `public_contacts: "Public contact",` after `promotion_evaluations`.
- Add these cases to `resourceLabel`, before `case "organization_settings":`:

```ts
    case "announcements": {
      const title = textValue(metadata.title);
      return title ? quoted("Announcement", title) : `Announcement ${shortId(log.entity_id)}`;
    }
    case "public_contacts": {
      if (metadata.reordered === true) return "Public contact order";
      const contactLabel = textValue(metadata.label);
      return contactLabel ? quoted("Public contact", contactLabel) : `Public contact ${shortId(log.entity_id)}`;
    }
```

In `src/components/administration/administration-workspaces.tsx`, change `AUDIT_ENTITY_SUGGESTIONS` so it starts with `"announcements", "applications", …` and has `"public_contacts"` right after `"promotion_evaluations"`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/schemas/public-site.test.ts src/lib/public-site src/lib/administration/audit-presentation.test.ts && npm run typecheck`
Expected: PASS, and `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/database.ts src/schemas/public-site.ts src/schemas/public-site.test.ts src/lib/public-site src/lib/administration/audit-presentation.ts src/lib/administration/audit-presentation.test.ts src/components/administration/administration-workspaces.tsx
git commit -m "$(cat <<'EOF'
feat: add public-site types, schemas, contact helpers and audit labels

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Queries, query keys and React Query hooks

**Files:**
- Create: `src/queries/public-site.ts`, `src/queries/public-site.test.ts`
- Create: `src/hooks/use-public-site.ts`, `src/hooks/use-public-site.test.tsx`
- Modify: `src/lib/query-keys.ts` (add a `publicSite` block after `recruitment`)

**Interfaces:**
- Consumes: the Task 1 RPC names and arguments, and the Task 2 types and schemas.
- Produces:
  - Queries:
    - `listPublishedAnnouncements(limit = 6): Promise<PublishedAnnouncementCard[]>`
    - `listVisibleContacts(): Promise<VisibleContact[]>`
    - `listHrAnnouncements(): Promise<Announcement[]>`
    - `listHrContacts(): Promise<PublicContact[]>`
    - `saveAnnouncement(input: AnnouncementInput, announcementId?: string): Promise<Announcement>`
    - `setAnnouncementStatus(announcementId: string, status: AnnouncementStatusChange): Promise<Announcement>`
    - `deleteAnnouncement(announcementId: string): Promise<void>`
    - `savePublicContact(input: PublicContactInput, contactId?: string): Promise<PublicContact>`
    - `deletePublicContact(contactId: string): Promise<void>`
    - `reorderPublicContacts(orderedIds: string[]): Promise<void>`
  - Hooks:
    - Reads: `usePublishedAnnouncements(limit = 6)`, `useVisibleContacts()`, `useHrAnnouncements()`, `useHrContacts()`.
    - `useSaveAnnouncement()` takes `{ input, announcementId? }`.
    - `useSetAnnouncementStatus()` takes `{ announcementId, status }`.
    - `useDeleteAnnouncement()` takes `announcementId`.
    - `useSavePublicContact()` takes `{ input, contactId? }`.
    - `useDeletePublicContact()` takes `contactId`.
    - `useReorderPublicContacts()` takes `orderedIds`.
    - Every mutation invalidates `["public-site"]`.
  - `queryKeys.publicSite.{ publishedAnnouncements(limit), visibleContacts(), hrAnnouncements(), hrContacts() }`, all rooted at `"public-site"`.

- [ ] **Step 1: Write the failing tests**

`src/queries/public-site.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));

import {
  deleteAnnouncement,
  listPublishedAnnouncements,
  listVisibleContacts,
  reorderPublicContacts,
  saveAnnouncement,
  savePublicContact,
  setAnnouncementStatus,
} from "./public-site";

const announcementId = "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f";
const contactIds = ["4f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f", "5f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f"];

/** A chainable PostgREST query double that resolves to `result` when awaited. */
function mockQuery(result: { data: unknown; error: { message: string } | null }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  return query;
}

describe("public reads", () => {
  beforeEach(() => vi.resetAllMocks());

  it("lists only published announcements, newest first, limited to six", async () => {
    const query = mockQuery({ data: [{ id: announcementId }], error: null });
    await expect(listPublishedAnnouncements()).resolves.toEqual([{ id: announcementId }]);
    expect(mocks.from).toHaveBeenCalledWith("announcements");
    expect(query.select).toHaveBeenCalledWith("id, title, summary, category, published_at");
    expect(query.eq).toHaveBeenCalledWith("status", "published");
    expect(query.order).toHaveBeenCalledWith("published_at", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(6);
  });

  it("lists only visible contacts in their saved order", async () => {
    const query = mockQuery({ data: [], error: null });
    await expect(listVisibleContacts()).resolves.toEqual([]);
    expect(mocks.from).toHaveBeenCalledWith("public_contacts");
    expect(query.eq).toHaveBeenCalledWith("is_visible", true);
    expect(query.order).toHaveBeenNthCalledWith(1, "sort_order", { ascending: true });
  });

  it("surfaces a read error", async () => {
    mockQuery({ data: null, error: { message: "permission denied" } });
    await expect(listVisibleContacts()).rejects.toThrow("permission denied");
  });
});

describe("HR writes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("saves a new announcement with trimmed values", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: announcementId }, error: null });
    await saveAnnouncement({ title: "  Road safety  ", category: "advisory", summary: " Summary ", body: " Body " });
    expect(mocks.rpc).toHaveBeenCalledWith("save_announcement", {
      target_announcement_id: null,
      target_title: "Road safety",
      target_summary: "Summary",
      target_body: "Body",
      target_category: "advisory",
    });
  });

  it("validates before calling the database", async () => {
    await expect(saveAnnouncement({ title: "", category: "news", summary: "S", body: "B" })).rejects.toThrow();
    await expect(setAnnouncementStatus(announcementId, "draft" as never)).rejects.toThrow();
    await expect(reorderPublicContacts(["not-a-uuid"])).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("changes status, deletes, and reports the server's message", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { id: announcementId, status: "published" }, error: null });
    await setAnnouncementStatus(announcementId, "published");
    expect(mocks.rpc).toHaveBeenCalledWith("set_announcement_status", { target_announcement_id: announcementId, target_status: "published" });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Only draft announcements can be deleted. Archive a published announcement instead." } });
    await expect(deleteAnnouncement(announcementId)).rejects.toThrow("Only draft announcements can be deleted.");
  });

  it("saves and reorders contacts", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: contactIds[0] }, error: null });
    await savePublicContact({ kind: "phone", label: " HR Office ", value: "(02) 8123-4567", isVisible: true }, contactIds[0]);
    expect(mocks.rpc).toHaveBeenCalledWith("save_public_contact", {
      target_contact_id: contactIds[0],
      target_kind: "phone",
      target_label: "HR Office",
      target_value: "(02) 8123-4567",
      target_is_visible: true,
    });
    await reorderPublicContacts(contactIds);
    expect(mocks.rpc).toHaveBeenCalledWith("reorder_public_contacts", { ordered_contact_ids: contactIds });
  });
});
```

`src/hooks/use-public-site.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveAnnouncement: vi.fn(), reorderPublicContacts: vi.fn() }));

vi.mock("@/queries/public-site", () => ({
  deleteAnnouncement: vi.fn(),
  deletePublicContact: vi.fn(),
  listHrAnnouncements: vi.fn(),
  listHrContacts: vi.fn(),
  listPublishedAnnouncements: vi.fn(),
  listVisibleContacts: vi.fn(),
  reorderPublicContacts: mocks.reorderPublicContacts,
  saveAnnouncement: mocks.saveAnnouncement,
  savePublicContact: vi.fn(),
  setAnnouncementStatus: vi.fn(),
}));

import { useReorderPublicContacts, useSaveAnnouncement } from "./use-public-site";

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { invalidateQueries, wrapper };
}

describe("public-site hooks", () => {
  it("refreshes every public-site query after saving an announcement", async () => {
    const { invalidateQueries, wrapper } = setup();
    mocks.saveAnnouncement.mockResolvedValue({ id: "a" });
    const { result } = renderHook(() => useSaveAnnouncement(), { wrapper });
    const input = { title: "T", category: "news" as const, summary: "S", body: "B" };
    await result.current.mutateAsync({ input });
    expect(mocks.saveAnnouncement).toHaveBeenCalledWith(input, undefined);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["public-site"] });
  });

  it("passes the full new order when reordering contacts", async () => {
    const { invalidateQueries, wrapper } = setup();
    mocks.reorderPublicContacts.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReorderPublicContacts(), { wrapper });
    await result.current.mutateAsync(["b", "a"]);
    expect(mocks.reorderPublicContacts).toHaveBeenCalledWith(["b", "a"]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["public-site"] });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/queries/public-site.test.ts src/hooks/use-public-site.test.tsx`
Expected: FAIL with `Failed to resolve import "./public-site"` and `"./use-public-site"`.

- [ ] **Step 3: Implement**

Add to `src/lib/query-keys.ts`, inside `queryKeys` after the `recruitment` block:

```ts
  publicSite: {
    publishedAnnouncements: (limit: number) => ["public-site", "published-announcements", limit] as const,
    visibleContacts: () => ["public-site", "visible-contacts"] as const,
    hrAnnouncements: () => ["public-site", "hr-announcements"] as const,
    hrContacts: () => ["public-site", "hr-contacts"] as const,
  },
```

Create `src/queries/public-site.ts`:

```ts
import { z } from "zod";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Announcement, PublicContact, PublishedAnnouncementCard, VisibleContact } from "@/lib/types/database";
import { uuidSchema } from "@/schemas/common";
import {
  announcementSchema,
  announcementStatusChangeSchema,
  publicContactSchema,
  type AnnouncementInput,
  type AnnouncementStatusChange,
  type PublicContactInput,
} from "@/schemas/public-site";

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listPublishedAnnouncements(limit = 6) {
  const { data, error } = await createBrowserSupabaseClient()
    .from("announcements")
    .select("id, title, summary, category, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return (data ?? []) as PublishedAnnouncementCard[];
}

export async function listVisibleContacts() {
  const { data, error } = await createBrowserSupabaseClient()
    .from("public_contacts")
    .select("id, label, kind, value, sort_order")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  throwIfError(error);
  return (data ?? []) as VisibleContact[];
}

export async function listHrAnnouncements() {
  const { data, error } = await createBrowserSupabaseClient().from("announcements").select("*").order("updated_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as Announcement[];
}

export async function listHrContacts() {
  const { data, error } = await createBrowserSupabaseClient()
    .from("public_contacts")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  throwIfError(error);
  return (data ?? []) as PublicContact[];
}

export async function saveAnnouncement(input: AnnouncementInput, announcementId?: string) {
  const values = announcementSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("save_announcement", {
    target_announcement_id: announcementId ? uuidSchema.parse(announcementId) : null,
    target_title: values.title,
    target_summary: values.summary,
    target_body: values.body,
    target_category: values.category,
  });
  throwIfError(error);
  return data as Announcement;
}

export async function setAnnouncementStatus(announcementId: string, status: AnnouncementStatusChange) {
  const id = uuidSchema.parse(announcementId);
  const target = announcementStatusChangeSchema.parse(status);
  const { data, error } = await createBrowserSupabaseClient().rpc("set_announcement_status", { target_announcement_id: id, target_status: target });
  throwIfError(error);
  return data as Announcement;
}

export async function deleteAnnouncement(announcementId: string) {
  const id = uuidSchema.parse(announcementId);
  const { error } = await createBrowserSupabaseClient().rpc("delete_announcement", { target_announcement_id: id });
  throwIfError(error);
}

export async function savePublicContact(input: PublicContactInput, contactId?: string) {
  const values = publicContactSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("save_public_contact", {
    target_contact_id: contactId ? uuidSchema.parse(contactId) : null,
    target_kind: values.kind,
    target_label: values.label,
    target_value: values.value,
    target_is_visible: values.isVisible,
  });
  throwIfError(error);
  return data as PublicContact;
}

export async function deletePublicContact(contactId: string) {
  const id = uuidSchema.parse(contactId);
  const { error } = await createBrowserSupabaseClient().rpc("delete_public_contact", { target_contact_id: id });
  throwIfError(error);
}

export async function reorderPublicContacts(orderedIds: string[]) {
  const ids = z.array(uuidSchema).parse(orderedIds);
  const { error } = await createBrowserSupabaseClient().rpc("reorder_public_contacts", { ordered_contact_ids: ids });
  throwIfError(error);
}
```

Create `src/hooks/use-public-site.ts`:

```ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  deleteAnnouncement,
  deletePublicContact,
  listHrAnnouncements,
  listHrContacts,
  listPublishedAnnouncements,
  listVisibleContacts,
  reorderPublicContacts,
  saveAnnouncement,
  savePublicContact,
  setAnnouncementStatus,
} from "@/queries/public-site";
import type { AnnouncementInput, AnnouncementStatusChange, PublicContactInput } from "@/schemas/public-site";

export function usePublishedAnnouncements(limit = 6) {
  return useQuery({ queryKey: queryKeys.publicSite.publishedAnnouncements(limit), queryFn: () => listPublishedAnnouncements(limit) });
}

export function useVisibleContacts() {
  return useQuery({ queryKey: queryKeys.publicSite.visibleContacts(), queryFn: listVisibleContacts });
}

export function useHrAnnouncements() {
  return useQuery({ queryKey: queryKeys.publicSite.hrAnnouncements(), queryFn: listHrAnnouncements });
}

export function useHrContacts() {
  return useQuery({ queryKey: queryKeys.publicSite.hrContacts(), queryFn: listHrContacts });
}

/** Every public-site write can change both the HR lists and what visitors see. */
function useRefreshPublicSite() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["public-site"] });
}

export function useSaveAnnouncement() {
  const refresh = useRefreshPublicSite();
  return useMutation({
    mutationFn: ({ input, announcementId }: { input: AnnouncementInput; announcementId?: string }) => saveAnnouncement(input, announcementId),
    onSuccess: refresh,
  });
}

export function useSetAnnouncementStatus() {
  const refresh = useRefreshPublicSite();
  return useMutation({
    mutationFn: ({ announcementId, status }: { announcementId: string; status: AnnouncementStatusChange }) => setAnnouncementStatus(announcementId, status),
    onSuccess: refresh,
  });
}

export function useDeleteAnnouncement() {
  const refresh = useRefreshPublicSite();
  return useMutation({ mutationFn: (announcementId: string) => deleteAnnouncement(announcementId), onSuccess: refresh });
}

export function useSavePublicContact() {
  const refresh = useRefreshPublicSite();
  return useMutation({
    mutationFn: ({ input, contactId }: { input: PublicContactInput; contactId?: string }) => savePublicContact(input, contactId),
    onSuccess: refresh,
  });
}

export function useDeletePublicContact() {
  const refresh = useRefreshPublicSite();
  return useMutation({ mutationFn: (contactId: string) => deletePublicContact(contactId), onSuccess: refresh });
}

export function useReorderPublicContacts() {
  const refresh = useRefreshPublicSite();
  return useMutation({ mutationFn: (orderedIds: string[]) => reorderPublicContacts(orderedIds), onSuccess: refresh });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/queries/public-site.test.ts src/hooks/use-public-site.test.tsx src/lib/query-keys.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/queries/public-site.ts src/queries/public-site.test.ts src/hooks/use-public-site.ts src/hooks/use-public-site.test.tsx src/lib/query-keys.ts
git commit -m "$(cat <<'EOF'
feat: add public-site queries and React Query hooks

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Public route group, portal fonts and tokens, portal header chrome

**Files:**
- Move: `src/app/page.tsx` → `src/app/(public)/page.tsx`, and `src/app/page.test.tsx` → `src/app/(public)/page.test.tsx`
- Create: `src/app/(public)/layout.tsx`, `src/app/(public)/layout.test.tsx`
- Modify: `src/app/globals.css` (append utilities at the end)
- Create: `src/components/public-site/brand-logos.tsx`
- Create: `src/components/public-site/public-account-action.tsx`
- Modify: `src/components/recruitment/public-site-header.tsx` (use `PublicAccountAction`)
- Modify: `src/components/recruitment/public-careers-landing.tsx` (import `BrandLogos` from its new home, delete the local copy)
- Create: `src/components/public-site/pst-clock.tsx`, `src/components/public-site/pst-clock.test.tsx`
- Create: `src/components/public-site/portal-header.tsx`, `src/components/public-site/portal-header.test.tsx`

**Interfaces:**
- Consumes: the existing `PublicSiteHeader` auth logic and the `BrandLogos` markup from `public-careers-landing.tsx`.
- Produces:
  - `BrandLogos({ priority?, size? })`.
  - `PublicAccountAction()`: the Login dropdown, or the "Application Status" link when signed in.
  - `PstClock()` and `formatPst(date: Date): string` (`"HH:MM:SS"`, Asia/Manila, h23).
  - `PortalHeader({ showContact }: { showContact: boolean })`, which renders `nav[aria-label="Page sections"]` with anchors `#portals #announcements #about #why-join #faqs #contact`.
  - CSS utilities `portal-type` (Inter body, Montserrat headings), `portal-grid` and `glass-panel`.
  - Route group `(public)`, whose layout wraps `/` and `/announcements/*`.

- [ ] **Step 1: Move the home route into the group and confirm nothing broke**

```bash
mkdir -p "src/app/(public)"
git mv src/app/page.tsx "src/app/(public)/page.tsx"
git mv src/app/page.test.tsx "src/app/(public)/page.test.tsx"
npx vitest run "src/app/(public)/page.test.tsx"
```

Expected: PASS (2 tests). Both files import `./page`, which still resolves. Next.js docs `route-groups.md` line 32 allow `/` to live inside a group, and `(app)` has no root `page.tsx`, so no two routes resolve to `/`.

- [ ] **Step 2: Write the failing tests**

`src/app/(public)/layout.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

// next/font/google is a build-time transform; it has no runtime exports under Vitest.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "inter-variable" }),
  Montserrat: () => ({ variable: "montserrat-variable" }),
}));

import PublicLayout from "./layout";

it("gives every public portal page the Inter body and Montserrat heading fonts", () => {
  render(<PublicLayout><p>Landing</p></PublicLayout>);
  expect(screen.getByText("Landing").parentElement).toHaveClass("inter-variable", "montserrat-variable", "portal-type");
});
```

`src/components/public-site/pst-clock.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { formatPst, PstClock } from "./pst-clock";

afterEach(() => vi.useRealTimers());

it("shows Philippine Standard Time whatever the visitor's time zone, and ticks every second", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-04T06:05:09Z"));
  render(<PstClock />);
  expect(screen.getByText("14:05:09")).toBeInTheDocument();
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(screen.getByText("14:05:10")).toBeInTheDocument();
});

it("writes midnight as 00, never 24", () => {
  expect(formatPst(new Date("2026-10-04T16:00:00Z"))).toBe("00:00:00");
});
```

`src/components/public-site/portal-header.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./pst-clock", () => ({ PstClock: () => <span>PST 14:05:09</span> }));

import { PortalHeader } from "./portal-header";

describe("PortalHeader", () => {
  it("shows the government top bar, both logos, the station name, section links and the login menu", () => {
    render(<PortalHeader showContact />);
    expect(screen.getByText("Republic of the Philippines • Philippine National Police")).toBeVisible();
    expect(screen.getByText("PST 14:05:09")).toBeVisible();
    expect(screen.getByAltText("San Juan City Police Station logo")).toBeInTheDocument();
    expect(screen.getByAltText("Bagong Pilipinas logo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /San Juan City Police Station HRIS/ })).toHaveAttribute("href", "/");
    const sections = screen.getByRole("navigation", { name: "Page sections" });
    expect(within(sections).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["#portals", "#announcements", "#about", "#why-join", "#faqs", "#contact"]);
    expect(screen.getByRole("button", { name: /^login$/i })).toBeVisible();
  });

  it("leaves out the Contact link while there is no contact to show", () => {
    render(<PortalHeader showContact={false} />);
    expect(within(screen.getByRole("navigation", { name: "Page sections" })).queryByRole("link", { name: "Contact" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run "src/app/(public)/layout.test.tsx" src/components/public-site`
Expected: FAIL with `Failed to resolve import "./layout"`, `"./pst-clock"` and `"./portal-header"`.

- [ ] **Step 4: Implement**

`src/app/(public)/layout.tsx`:

```tsx
import { Inter, Montserrat } from "next/font/google";
import type { ReactNode } from "react";

// Loaded here, not in the root layout, so only the public portal downloads these two fonts.
const portalBody = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const portalHeading = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div className={`${portalBody.variable} ${portalHeading.variable} portal-type flex flex-1 flex-col`}>{children}</div>;
}
```

Append to `src/app/globals.css`:

```css
/* Public portal (landing page and announcements): Inter body, Montserrat headings. */
@utility portal-type {
  font-family: var(--font-inter), var(--font-source-sans), ui-sans-serif, system-ui, sans-serif;

  & :where(h1, h2, h3, h4) {
    font-family: var(--font-montserrat), var(--font-source-sans), ui-sans-serif, system-ui, sans-serif;
  }
}

/* The portal design's faint gold grid. */
@utility portal-grid {
  background-image:
    linear-gradient(color-mix(in oklch, var(--cta) 6%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in oklch, var(--cta) 6%, transparent) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* Frosted navy card. Borders are set per element so border-t-* accents still apply. */
@utility glass-panel {
  background-color: color-mix(in oklch, var(--card) 85%, transparent);
  backdrop-filter: blur(16px);
}
```

`src/components/public-site/brand-logos.tsx`: move the existing `BrandLogos` function out of `public-careers-landing.tsx`, unchanged except for the export and the client directive:

```tsx
import Image from "next/image";

export function BrandLogos({ priority = false, size = 80 }: { priority?: boolean; size?: number }) {
  return (
    <div className="flex items-center gap-4">
      <Image alt="San Juan City Police Station logo" className="object-contain drop-shadow-md" height={size} priority={priority} src="/san-juan-police-logo.png" style={{ height: size, width: size }} width={size} />
      <span aria-hidden="true" className="h-12 w-px bg-white/20" />
      {/* The wordmark is dark blue, so it sits on a light chip to stay legible on navy. */}
      <span className="rounded-xl bg-white p-2 shadow-md">
        <Image alt="Bagong Pilipinas logo" className="w-auto object-contain" height={size - 16} priority={priority} src="/bagong-pilipinas-logo.png" style={{ height: size - 16 }} width={Math.round(((size - 16) * 330) / 308)} />
      </span>
    </div>
  );
}
```

In `src/components/recruitment/public-careers-landing.tsx`, delete the local `BrandLogos` function and the now-unused `Image` import, and add `import { BrandLogos } from "@/components/public-site/brand-logos";`.

`src/components/public-site/public-account-action.tsx`: move the auth state and dropdown out of `PublicSiteHeader`, unchanged:

```tsx
"use client";

import { BriefcaseBusiness, ChevronDown, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const loginChoices = [
  { href: "/login?as=employee", icon: UserRound, label: "Login as Employee" },
  { href: "/login?as=applicant", icon: BriefcaseBusiness, label: "Login as Applicant" },
] as const;

/** The Login menu for visitors, or a shortcut to Application Status once signed in. */
export function PublicAccountAction() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return;
    const client = createBrowserSupabaseClient();
    void client.auth.getUser().then(({ data }) => setIsSignedIn(Boolean(data.user)));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setIsSignedIn(Boolean(session?.user)));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (isSignedIn) {
    return (
      <Link className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href="/applicant/applications">
        Application Status
      </Link>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        Login
        <ChevronDown aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5">
        {loginChoices.map(({ href, icon: Icon, label }) => (
          <DropdownMenuItem className="min-h-11 gap-2.5 px-3 text-sm font-medium" key={href} render={<Link href={href} />}>
            <Icon aria-hidden="true" className="size-4 text-primary" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

Replace `src/components/recruitment/public-site-header.tsx` with:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";

import { PublicAccountAction } from "@/components/public-site/public-account-action";

export function PublicSiteHeader() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur">
      <nav aria-label="Public navigation" className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link className="inline-flex min-h-11 items-center gap-2.5 rounded-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href="/">
          <Image alt="" className="size-9 object-contain" height={36} src="/san-juan-police-logo.png" width={36} />
          <span>San Juan City Police</span>
        </Link>
        <PublicAccountAction />
      </nav>
    </header>
  );
}
```

`src/components/public-site/pst-clock.tsx`:

```tsx
"use client";

import { Clock } from "lucide-react";
import { useSyncExternalStore } from "react";

const pstFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** "14:05:09" in Philippine Standard Time, whatever the visitor's own time zone. */
export function formatPst(date: Date) {
  return pstFormatter.format(date);
}

function subscribeToSeconds(onTick: () => void) {
  const timer = window.setInterval(onTick, 1000);
  return () => window.clearInterval(timer);
}

/** A live PST clock. The server renders a placeholder, so the server and client HTML always match. */
export function PstClock() {
  const time = useSyncExternalStore(subscribeToSeconds, () => formatPst(new Date()), () => null);
  return (
    <p className="inline-flex items-center gap-1.5 text-sm text-cta">
      <Clock aria-hidden="true" className="size-4" />
      <span>PST</span>
      <time className="tabular-nums">{time ?? "--:--:--"}</time>
    </p>
  );
}
```

`src/components/public-site/portal-header.tsx`:

```tsx
"use client";

import Link from "next/link";

import { BrandLogos } from "./brand-logos";
import { PstClock } from "./pst-clock";
import { PublicAccountAction } from "./public-account-action";

export const PORTAL_SECTIONS = [
  { id: "portals", label: "Portals" },
  { id: "announcements", label: "Announcements" },
  { id: "about", label: "About" },
  { id: "why-join", label: "Why Join" },
  { id: "faqs", label: "FAQs" },
  { id: "contact", label: "Contact" },
] as const;

export function PortalHeader({ showContact }: { showContact: boolean }) {
  const sections = PORTAL_SECTIONS.filter((section) => showContact || section.id !== "contact");
  return (
    <>
      <div className="border-b border-cta/20 bg-sidebar text-sm text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 px-4 py-2 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <p>Republic of the Philippines • Philippine National Police</p>
          <PstClock />
        </div>
      </div>
      <header className="border-b border-border/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 lg:flex-nowrap lg:px-8">
          <Link className="inline-flex min-h-11 min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href="/">
            <BrandLogos priority size={48} />
            <span className="text-lg font-bold tracking-tight text-white sm:text-xl">
              San Juan City Police Station <span className="text-cta">HRIS</span>
            </span>
          </Link>
          <nav aria-label="Page sections" className="order-last -mx-4 w-full overflow-x-auto px-4 lg:order-none lg:mx-0 lg:w-auto lg:px-0">
            <ul className="flex gap-1">
              {sections.map(({ id, label }) => (
                <li key={id}>
                  <a className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-slate-300 transition-colors hover:text-cta focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href={`#${id}`}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <PublicAccountAction />
        </div>
      </header>
    </>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run "src/app/(public)" src/components/public-site src/components/recruitment src/app/jobs && npm run typecheck`
Expected: PASS. The existing `public-careers-landing.test.tsx` and `jobs/layout.test.tsx` still pass because their behaviour has not changed yet.

- [ ] **Step 6: Commit**

```bash
git add -A "src/app/(public)" src/app/globals.css src/components/public-site src/components/recruitment/public-site-header.tsx src/components/recruitment/public-careers-landing.tsx
git commit -m "$(cat <<'EOF'
feat: add public route group with portal fonts, PST clock and portal header

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Landing page redesign

**Files:**
- Create: `src/components/public-site/section-intro.tsx`
- Create: `src/components/public-site/landing-announcements.tsx`
- Create: `src/components/public-site/landing-faqs.tsx`
- Create: `src/components/public-site/landing-contacts.tsx`
- Modify (rewrite): `src/components/recruitment/public-careers-landing.tsx`
- Modify (rewrite): `src/components/recruitment/public-careers-landing.test.tsx`

**Interfaces:**
- Consumes:
  - `usePublishedAnnouncements(6)` and `useVisibleContacts()` (Task 3).
  - `PortalHeader` and `BrandLogos` (Task 4).
  - `contactHref` and `announcementCategoryLabel` (Task 2).
  - `APPLICANT_PROFILE_DOCUMENT_KINDS` from `@/schemas/applicant-portal`, whose items are `{ kind, label, accept, formats }`.
  - `PublicJobList`.
- Produces:
  - `PublicCareersLanding()`, whose `main > section[id]` order is `portals, job-openings, announcements, about, why-join, faqs, contact`.
  - `SectionIntro({ eyebrow, title, id, description?, align? })`.
  - `LandingAnnouncements()`, `LandingFaqs()` and `LandingContacts({ contacts })`.

- [ ] **Step 1: Confirm branch 1's document list shape**

Run: `grep -n "APPLICANT_PROFILE_DOCUMENT_KINDS = " -A7 src/schemas/applicant-portal.ts`
Expected: five entries (`resume`, `psa`, `photo`, `eligibility`, `diploma`), each with `label` and `formats`. After branch 1, `formats` reads PDF-only for the four non-photo kinds. If branch 1 renamed `formats`, use the new field name in `landing-faqs.tsx` and its test below.

- [ ] **Step 2: Write the failing test**

Replace `src/components/recruitment/public-careers-landing.test.tsx` with:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

const mocks = vi.hoisted(() => ({ announcements: vi.fn(), contacts: vi.fn() }));

vi.mock("@/hooks/use-recruitment", () => ({
  usePublishedJobs: vi.fn(() => ({
    data: { rows: [{ closes_on: "2026-10-31", description: "Serve the community through visible patrol work.", id: 7, location: "San Juan City", title: "Patrol Officer" }] },
    error: null,
    isLoading: false,
  })),
}));
vi.mock("@/hooks/use-public-site", () => ({
  usePublishedAnnouncements: mocks.announcements,
  useVisibleContacts: mocks.contacts,
}));

import { PublicCareersLanding } from "./public-careers-landing";

const announcementId = "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f";
const loaded = <T,>(data: T) => ({ data, error: null, isLoading: false });

describe("PublicCareersLanding", () => {
  beforeEach(() => {
    mocks.announcements.mockReturnValue(loaded([
      { id: announcementId, title: "Road safety advisory", summary: "Expect road works near the station.", category: "advisory", published_at: "2026-10-03T02:00:00Z" },
    ]));
    mocks.contacts.mockReturnValue(loaded([
      { id: "c1", label: "HR Office", kind: "phone", value: "(02) 8123-4567", sort_order: 1 },
    ]));
  });

  it("lays the sections out in the spec's order under one page heading", () => {
    const { container } = render(<PublicCareersLanding />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: /serve san juan/i })).toBeVisible();
    expect([...container.querySelectorAll("main > section[id]")].map((section) => section.id)).toEqual(["portals", "job-openings", "announcements", "about", "why-join", "faqs", "contact"]);
    const sections = screen.getByRole("navigation", { name: "Page sections" });
    expect(within(sections).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["#portals", "#announcements", "#about", "#why-join", "#faqs", "#contact"]);
  });

  it("sends personnel and applicants to the real sign-in and job pages", () => {
    render(<PublicCareersLanding />);
    expect(screen.getByRole("heading", { name: "Personnel Portal" })).toBeVisible();
    expect(screen.getByRole("link", { name: /sign in as personnel/i })).toHaveAttribute("href", "/login?as=employee");
    expect(screen.getByRole("heading", { name: "Applicant & Career Portal" })).toBeVisible();
    expect(screen.getByRole("link", { name: /view job openings/i })).toHaveAttribute("href", "/jobs");
    expect(screen.getByRole("link", { name: /check application status/i })).toHaveAttribute("href", "/login?as=applicant&next=/applicant/applications");
  });

  it("keeps the latest job openings with a link to all of them", () => {
    render(<PublicCareersLanding />);
    expect(screen.getByRole("link", { name: "View details for Patrol Officer" })).toHaveAttribute("href", "/jobs/7");
    expect(screen.getByRole("link", { name: /view all openings/i })).toHaveAttribute("href", "/jobs");
    expect(screen.getByRole("link", { name: /create an applicant account/i })).toHaveAttribute("href", "/applicant/register");
  });

  it("lists published announcements with date, category and a Read more link", () => {
    render(<PublicCareersLanding />);
    const section = screen.getByRole("region", { name: "Announcements" });
    expect(within(section).getByRole("heading", { name: "Road safety advisory" })).toBeVisible();
    expect(within(section).getByText("Advisory")).toBeVisible();
    expect(within(section).getByText("October 3, 2026")).toBeVisible();
    expect(within(section).getByRole("link", { name: "Read more about Road safety advisory" })).toHaveAttribute("href", `/announcements/${announcementId}`);
  });

  it("says so when there are no announcements", () => {
    mocks.announcements.mockReturnValue(loaded([]));
    render(<PublicCareersLanding />);
    expect(within(screen.getByRole("region", { name: "Announcements" })).getByText("No announcements right now.")).toBeVisible();
  });

  it("shows the station's vision, mission and motto, and three benefit cards", () => {
    render(<PublicCareersLanding />);
    expect(screen.getByRole("heading", { name: "Vision" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Mission" })).toBeVisible();
    expect(screen.getByText("Serbisyo, Karangalan, Katarungan")).toBeVisible();
    expect(within(screen.getByRole("region", { name: /why join/i })).getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });

  it("answers FAQs in native details elements, naming every required document", () => {
    render(<PublicCareersLanding />);
    const faqs = screen.getByRole("region", { name: "Frequently asked questions" });
    expect(faqs.querySelectorAll("details > summary")).toHaveLength(3);
    expect(within(faqs).getByText("Who can apply?")).toBeInTheDocument();
    expect(within(faqs).getByText("Which documents do I need?")).toBeInTheDocument();
    expect(within(faqs).getByText("How do I check my application status?")).toBeInTheDocument();
    for (const { label, formats } of APPLICANT_PROFILE_DOCUMENT_KINDS) {
      expect(within(faqs).getByText(`${label} (${formats})`)).toBeInTheDocument();
    }
    // Native disclosure only: no scripted accordion buttons inside the FAQ section.
    expect(faqs.querySelector("button")).toBeNull();
  });

  it("shows HR's contacts with dialable links", () => {
    render(<PublicCareersLanding />);
    const contact = screen.getByRole("region", { name: "Contact us" });
    expect(within(contact).getByText("HR Office")).toBeVisible();
    expect(within(contact).getByRole("link", { name: "(02) 8123-4567" })).toHaveAttribute("href", "tel:0281234567");
  });

  it("hides the Contact section and its link while there are no visible contacts", () => {
    mocks.contacts.mockReturnValue(loaded([]));
    render(<PublicCareersLanding />);
    expect(screen.queryByRole("region", { name: "Contact us" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Page sections" })).queryByRole("link", { name: "Contact" })).not.toBeInTheDocument();
  });

  it("hides the Contact section when contacts cannot be loaded", () => {
    mocks.contacts.mockReturnValue({ data: undefined, error: new Error("network down"), isLoading: false });
    render(<PublicCareersLanding />);
    expect(screen.queryByRole("region", { name: "Contact us" })).not.toBeInTheDocument();
    expect(screen.queryByText("network down")).not.toBeInTheDocument();
  });

  it("leaves out the mock's recruitment process, invented figures and small text", () => {
    const { container } = render(<PublicCareersLanding />);
    expect(screen.queryByText(/recruitment process/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ORPAS/)).not.toBeInTheDocument();
    expect(screen.queryByText(/₱/)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/text-\[(?:\d|1[0-3])px\]/);
    expect(screen.getAllByAltText("Bagong Pilipinas logo").length).toBeGreaterThan(0);
    expect(screen.getByText(/Data Privacy Act of 2012/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/recruitment/public-careers-landing.test.tsx`
Expected: FAIL. For example, `Unable to find role="navigation" and name "Page sections"` and `Unable to find role="region" and name "Announcements"`.

- [ ] **Step 4: Implement the section components**

`src/components/public-site/section-intro.tsx`:

```tsx
type SectionIntroProps = {
  eyebrow: string;
  title: string;
  /** id of the h2, used by the section's aria-labelledby. */
  id: string;
  description?: string;
  align?: "start" | "center";
};

export function SectionIntro({ align = "start", description, eyebrow, id, title }: SectionIntroProps) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-sm font-bold tracking-[0.18em] text-cta uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white" id={id}>{title}</h2>
      {description ? <p className="mt-3 text-base leading-7 text-slate-300">{description}</p> : null}
    </div>
  );
}
```

`src/components/public-site/landing-announcements.tsx`:

```tsx
"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { usePublishedAnnouncements } from "@/hooks/use-public-site";
import { formatDate } from "@/lib/format-date";
import { announcementCategoryLabel } from "@/schemas/public-site";

import { SectionIntro } from "./section-intro";

export function LandingAnnouncements() {
  const announcements = usePublishedAnnouncements(6);
  const rows = announcements.data ?? [];
  return (
    <section aria-labelledby="announcements-heading" className="scroll-mt-24 border-t border-border/80" id="announcements">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro description="News and advisories from the San Juan City Police Station." eyebrow="Station news" id="announcements-heading" title="Announcements" />
        <div className="mt-8">
          {announcements.isLoading ? (
            <LoadingState label="Loading announcements…" />
          ) : announcements.error ? (
            <ErrorState message="Announcements could not be loaded. Please try again later." />
          ) : rows.length === 0 ? (
            <p className="glass-panel rounded-2xl border border-border p-6 text-base text-slate-300" role="status">No announcements right now.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rows.map((announcement) => (
                <li key={announcement.id}>
                  <article aria-labelledby={`announcement-${announcement.id}-title`} className="glass-panel flex h-full flex-col rounded-2xl border border-border p-6 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                      <span className="rounded-full border border-cta/30 bg-cta/10 px-2.5 py-0.5 font-semibold text-cta">{announcementCategoryLabel(announcement.category)}</span>
                      {announcement.published_at ? <time dateTime={announcement.published_at}>{formatDate(announcement.published_at)}</time> : null}
                    </p>
                    <h3 className="mt-3 text-lg font-bold text-white [overflow-wrap:anywhere]" id={`announcement-${announcement.id}-title`}>{announcement.title}</h3>
                    <p className="mt-2 flex-1 text-base leading-7 text-slate-300 [overflow-wrap:anywhere]">{announcement.summary}</p>
                    <Link
                      aria-label={`Read more about ${announcement.title}`}
                      className="mt-4 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg font-semibold text-cta underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      href={`/announcements/${announcement.id}`}
                    >
                      Read more
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
```

`src/components/public-site/landing-faqs.tsx`:

```tsx
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

import { SectionIntro } from "./section-intro";

const linkClass = "font-semibold text-cta underline underline-offset-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

const faqs: { question: string; answer: ReactNode }[] = [
  {
    question: "Who can apply?",
    answer: (
      <p>
        Anyone who meets the qualifications listed on a job opening can apply. Open a posting on the{" "}
        <Link className={linkClass} href="/jobs">job openings page</Link> to see its requirements, then create an applicant account to apply online.
      </p>
    ),
  },
  {
    question: "Which documents do I need?",
    answer: (
      <>
        <p>Every application needs these five documents, saved on your applicant Documents page:</p>
        <ul className="list-disc space-y-1 pl-5">
          {APPLICANT_PROFILE_DOCUMENT_KINDS.map(({ kind, label, formats }) => (
            <li key={kind}>{`${label} (${formats})`}</li>
          ))}
        </ul>
      </>
    ),
  },
  {
    question: "How do I check my application status?",
    answer: (
      <p>
        Sign in with your applicant account and open Application Status to see where each application stands.{" "}
        <Link className={linkClass} href="/login?as=applicant&next=/applicant/applications">Sign in to see your status</Link>
      </p>
    ),
  },
];

export function LandingFaqs() {
  return (
    <section aria-labelledby="faqs-heading" className="scroll-mt-24 border-t border-border/80" id="faqs">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <SectionIntro align="center" eyebrow="Help" id="faqs-heading" title="Frequently asked questions" />
        <div className="mt-8 space-y-3">
          {faqs.map(({ answer, question }) => (
            <details className="group glass-panel rounded-xl border border-border" key={question}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-3 text-base font-semibold text-white hover:text-cta focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                {question}
                <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-slate-300 group-open:rotate-180 motion-safe:transition-transform" />
              </summary>
              <div className="space-y-3 border-t border-border px-5 py-4 text-base leading-7 text-slate-300">{answer}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
```

`src/components/public-site/landing-contacts.tsx`:

```tsx
import { Clock, Globe, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";

import { contactHref } from "@/lib/public-site/contacts";
import type { PublicContactKind, VisibleContact } from "@/lib/types/database";

import { SectionIntro } from "./section-intro";

const kindIcons: Record<PublicContactKind, LucideIcon> = { phone: Phone, email: Mail, address: MapPin, hours: Clock, facebook: Globe };

/** HR-managed contact entries. Renders nothing until HR has made at least one visible. */
export function LandingContacts({ contacts }: { contacts: readonly VisibleContact[] }) {
  if (!contacts.length) return null;
  return (
    <section aria-labelledby="contact-heading" className="scroll-mt-24 border-t border-border/80" id="contact">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro eyebrow="Get in touch" id="contact-heading" title="Contact us" />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact) => {
            const Icon = kindIcons[contact.kind];
            const href = contactHref(contact.kind, contact.value);
            const external = contact.kind === "facebook";
            return (
              <li className="glass-panel flex gap-4 rounded-2xl border border-border p-5" key={contact.id}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cta/10 text-cta">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-white">{contact.label}</p>
                  {href ? (
                    <a
                      className="inline-flex min-h-11 items-center text-base text-cta underline-offset-4 [overflow-wrap:anywhere] hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      href={href}
                      {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
                    >
                      {contact.value}
                      {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
                    </a>
                  ) : (
                    <p className="text-base whitespace-pre-line text-slate-300 [overflow-wrap:anywhere]">{contact.value}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Rewrite the landing composition**

Replace `src/components/recruitment/public-careers-landing.tsx` with:

```tsx
"use client";

import { ArrowRight, BriefcaseBusiness, CircleCheck, Eye, Flag, GraduationCap, HandHeart, LockKeyhole, Search, ShieldCheck, Sparkles, Target, UserRoundCheck } from "lucide-react";
import Link from "next/link";

import { BrandLogos } from "@/components/public-site/brand-logos";
import { LandingAnnouncements } from "@/components/public-site/landing-announcements";
import { LandingContacts } from "@/components/public-site/landing-contacts";
import { LandingFaqs } from "@/components/public-site/landing-faqs";
import { PortalHeader } from "@/components/public-site/portal-header";
import { SectionIntro } from "@/components/public-site/section-intro";
import { PublicJobList } from "@/components/recruitment/public-job-list";
import { useVisibleContacts } from "@/hooks/use-public-site";

const liftOnHover = "motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1";
const focusRing = "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

const pnpPrinciples = [
  {
    icon: Eye,
    title: "Vision",
    body: "Imploring the aid of the Almighty, by 2030, we shall be a highly capable, effective and credible police service working in partnership with a responsive community towards the attainment of a safer place to live, work and do business.",
  },
  {
    icon: Target,
    title: "Mission",
    body: "Enforce the law, prevent and control crimes, maintain peace and order, and ensure public safety and internal security with the active support of the community.",
  },
  { icon: Flag, title: "Motto", body: "Serbisyo, Karangalan, Katarungan", note: "Service, Honor, Justice" },
];

const personnelFeatures = ["Personnel records and service history", "Leave requests", "Attendance", "Deployments", "Promotion eligibility"];
const applicantFeatures = ["Browse open positions and their requirements", "Apply online with your saved documents", "Track the status of your application"];

const benefits = [
  { icon: HandHeart, title: "Serve your community", body: "Protect and serve the people of San Juan alongside a station that works closely with its community." },
  { icon: GraduationCap, title: "Training and growth", body: "Build your skills through police training and grow your career through the PNP's promotion system." },
  { icon: ShieldCheck, title: "A stable public-service career", body: "Join a uniformed public service with the benefits the law provides to PNP personnel." },
];

function FeatureList({ items, tone }: { items: readonly string[]; tone: "gold" | "teal" }) {
  return (
    <ul className="mt-6 space-y-2.5 text-base text-slate-300">
      {items.map((item) => (
        <li className="flex items-start gap-2.5" key={item}>
          <CircleCheck aria-hidden="true" className={`mt-1 size-4 shrink-0 ${tone === "gold" ? "text-cta" : "text-primary"}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function PublicCareersLanding() {
  const contacts = useVisibleContacts();
  // A failed or empty contact list hides the section and its header link instead of showing an error.
  const visibleContacts = contacts.data ?? [];
  const showContact = visibleContacts.length > 0;

  return (
    <div className="dark portal-grid min-h-dvh bg-background text-foreground">
      <PortalHeader showContact={showContact} />
      <main>
        <section aria-labelledby="hero-heading" className="mx-auto max-w-4xl px-4 pt-14 pb-10 text-center sm:px-6 sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-cta/30 bg-cta/10 px-4 py-1.5 text-sm font-semibold tracking-wide text-cta uppercase">
            <Sparkles aria-hidden="true" className="size-4" />
            Official portal of the San Juan City Police Station
          </p>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl" id="hero-heading">Serve San Juan with purpose.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            One portal for station personnel, job applicants, and everyone who wants to know what is happening at the station.
          </p>
        </section>

        <section aria-labelledby="portals-heading" className="scroll-mt-24 px-4 pb-16 sm:px-6 lg:px-8" id="portals">
          <h2 className="sr-only" id="portals-heading">Portals</h2>
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
            <article aria-labelledby="personnel-portal-heading" className={`glass-panel flex flex-col justify-between rounded-2xl border border-cta/15 border-t-4 border-t-cta p-6 sm:p-8 ${liftOnHover}`}>
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="flex size-14 items-center justify-center rounded-2xl border border-cta/40 bg-background text-cta"><UserRoundCheck aria-hidden="true" className="size-7" /></span>
                  <span className="rounded-full border border-cta/30 bg-cta/10 px-3 py-1 text-sm font-bold tracking-wide text-cta uppercase">Station personnel</span>
                </div>
                <h3 className="mt-6 text-2xl font-extrabold tracking-tight text-white sm:text-3xl" id="personnel-portal-heading">Personnel Portal</h3>
                <p className="mt-2 text-base leading-7 text-slate-300">Self-service for San Juan City Police Station personnel.</p>
                <FeatureList items={personnelFeatures} tone="gold" />
              </div>
              <div className="mt-8 border-t border-border pt-5">
                <Link className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cta px-6 text-base font-bold text-cta-foreground transition-colors hover:bg-cta/90 ${focusRing}`} href="/login?as=employee">
                  <LockKeyhole aria-hidden="true" className="size-4" />
                  Sign in as personnel
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </article>

            <article aria-labelledby="applicant-portal-heading" className={`glass-panel flex flex-col justify-between rounded-2xl border border-primary/15 border-t-4 border-t-primary p-6 sm:p-8 ${liftOnHover}`}>
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="flex size-14 items-center justify-center rounded-2xl border border-primary/40 bg-background text-primary"><BriefcaseBusiness aria-hidden="true" className="size-7" /></span>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-bold tracking-wide text-primary uppercase">Careers</span>
                </div>
                <h3 className="mt-6 text-2xl font-extrabold tracking-tight text-white sm:text-3xl" id="applicant-portal-heading">Applicant &amp; Career Portal</h3>
                <p className="mt-2 text-base leading-7 text-slate-300">Find an opening at the station and apply online.</p>
                <FeatureList items={applicantFeatures} tone="teal" />
              </div>
              <div className="mt-8 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
                <Link className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground transition-colors hover:bg-primary/85 ${focusRing}`} href="/jobs">
                  <Search aria-hidden="true" className="size-4" />
                  View job openings
                </Link>
                <Link className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-base font-bold text-white transition-colors hover:bg-muted ${focusRing}`} href="/login?as=applicant&next=/applicant/applications">
                  Check application status
                </Link>
              </div>
            </article>
          </div>
        </section>

        <section aria-labelledby="job-openings-heading" className="scroll-mt-24 border-t border-border/80" id="job-openings">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionIntro description="Open a posting to see its requirements, then sign up and apply online." eyebrow="Now hiring" id="job-openings-heading" title="Latest job openings" />
              <Link className={`inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-cta underline-offset-4 hover:underline ${focusRing}`} href="/jobs">
                View all openings
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
            <div className="mt-8">
              <PublicJobList featured pageSize={3} />
            </div>
            <p className="mt-6 text-sm text-slate-300">
              New applicant?{" "}
              <Link className="font-semibold text-cta underline-offset-4 hover:underline" href="/applicant/register">Create an applicant account</Link>
            </p>
          </div>
        </section>

        <LandingAnnouncements />

        <section aria-labelledby="about-heading" className="scroll-mt-24 border-t border-border/80" id="about">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">
            <div className="lg:col-span-5">
              <SectionIntro
                description="The San Juan City Police Station keeps the peace in San Juan City as part of the Philippine National Police. This portal brings its personnel services, recruitment, and public information together."
                eyebrow="Philippine National Police"
                id="about-heading"
                title="About the station"
              />
            </div>
            <div className="glass-panel rounded-2xl border border-border p-6 lg:col-span-7">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                <ShieldCheck aria-hidden="true" className="size-5 text-cta" />
                Our vision, mission and motto
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {pnpPrinciples.map(({ body, icon: Icon, note, title }) => (
                  <article className={`rounded-xl border border-border bg-background/80 p-4 ${title === "Vision" ? "sm:col-span-2" : ""}`} key={title}>
                    <h4 className="flex items-center gap-2 text-base font-bold text-cta">
                      <Icon aria-hidden="true" className="size-4" />
                      {title}
                    </h4>
                    {note ? (
                      <>
                        <p className="mt-1 text-lg font-semibold text-white">{body}</p>
                        <p className="text-sm text-slate-300">{note}</p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm leading-6 text-slate-300">{body}</p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="why-join-heading" className="scroll-mt-24 border-t border-border/80" id="why-join">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <SectionIntro align="center" eyebrow="A calling to serve" id="why-join-heading" title="Why join the station?" />
            <div className="mx-auto mt-10 grid max-w-6xl gap-6 md:grid-cols-3">
              {benefits.map(({ body, icon: Icon, title }) => (
                <article className={`glass-panel rounded-2xl border border-border p-6 ${liftOnHover}`} key={title}>
                  <span className="flex size-12 items-center justify-center rounded-xl bg-cta/10 text-cta"><Icon aria-hidden="true" className="size-6" /></span>
                  <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
                  <p className="mt-2 text-base leading-7 text-slate-300">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <LandingFaqs />

        {showContact ? <LandingContacts contacts={visibleContacts} /> : null}
      </main>

      <footer className="border-t border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 text-sm sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <BrandLogos size={48} />
              <p className="text-slate-300">San Juan City Police Station</p>
            </div>
            <nav aria-label="Sign in">
              <ul className="flex flex-wrap gap-x-5 gap-y-1">
                <li><Link className="inline-flex min-h-11 items-center font-medium hover:text-cta" href="/login?as=employee">Login as Employee</Link></li>
                <li><Link className="inline-flex min-h-11 items-center font-medium hover:text-cta" href="/login?as=applicant">Login as Applicant</Link></li>
              </ul>
            </nav>
          </div>
          <p className="text-slate-300">Personal information submitted through this portal is protected under the Data Privacy Act of 2012 (Republic Act No. 10173).</p>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/recruitment src/components/public-site "src/app/(public)" && npm run typecheck && npm run lint`
Expected: PASS. `(public)/page.test.tsx` still finds exactly one "View all openings" link, the "Login" button, and the employee and applicant login links.

- [ ] **Step 7: Check it in the browser**

Run `npm run dev` and open `http://localhost:3000/`. Check:
- At 390px wide nothing scrolls sideways and the section nav scrolls inside its own row.
- With the OS set to reduce motion, the cards do not lift on hover.
- Tab order runs: top bar, logo link, section links, Login, portal buttons.

- [ ] **Step 8: Commit**

```bash
git add src/components/public-site src/components/recruitment/public-careers-landing.tsx src/components/recruitment/public-careers-landing.test.tsx
git commit -m "$(cat <<'EOF'
feat: redesign the public landing page with portals, announcements, FAQs and contacts

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Public announcement page `/announcements/[id]`

**Files:**
- Create: `src/lib/public-site/published-announcement.ts`, `src/lib/public-site/published-announcement.test.ts`
- Create: `src/components/public-site/announcement-body.tsx`, `src/components/public-site/announcement-body.test.tsx`
- Create: `src/app/(public)/announcements/[id]/page.tsx`, `src/app/(public)/announcements/[id]/page.test.tsx`

**Interfaces:**
- Consumes:
  - `createServerSupabaseClient()` from `@/lib/supabase/server`.
  - `uuidSchema` from `@/schemas/common`.
  - `announcementParagraphs` and `announcementCategoryLabel` (Task 2).
  - `PublicSiteHeader` (Task 4).
  - `formatDate`.
- Produces:
  - `getPublishedAnnouncement(id: string): Promise<PublishedAnnouncement | null>`, cached per request.
  - `type PublishedAnnouncement = Pick<Announcement, "id" | "title" | "summary" | "body" | "category" | "published_at">`.
  - `AnnouncementBody({ body, className? })`.
  - The route `/announcements/[id]`, with `generateMetadata`.

- [ ] **Step 1: Write the failing tests**

`src/lib/public-site/published-announcement.test.ts`:

```ts
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({ from: mocks.from }) }));

import { getPublishedAnnouncement } from "./published-announcement";

beforeEach(() => vi.resetAllMocks());

it("reads one announcement only while it is published", async () => {
  const id = "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f";
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id }, error: null }) };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.from.mockReturnValue(query);

  await expect(getPublishedAnnouncement(id)).resolves.toEqual({ id });
  expect(mocks.from).toHaveBeenCalledWith("announcements");
  expect(query.eq).toHaveBeenCalledWith("id", id);
  expect(query.eq).toHaveBeenCalledWith("status", "published");
});

it("treats an id that is not a UUID as missing, without querying", async () => {
  await expect(getPublishedAnnouncement("not-a-uuid")).resolves.toBeNull();
  expect(mocks.from).not.toHaveBeenCalled();
});
```

`src/components/public-site/announcement-body.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { AnnouncementBody } from "./announcement-body";

it("renders paragraphs and line breaks from plain text", () => {
  const { container } = render(<AnnouncementBody body={"First line\nsecond line\n\nNext paragraph"} />);
  expect(container.querySelectorAll("p")).toHaveLength(2);
  expect(container.querySelectorAll("br")).toHaveLength(1);
  expect(screen.getByText("Next paragraph")).toBeInTheDocument();
});

it("shows HTML typed by HR as literal text, never as markup", () => {
  const { container } = render(<AnnouncementBody body={"<script>alert('x')</script>\n\n<b>Bold</b>"} />);
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("b")).toBeNull();
  expect(screen.getByText("<b>Bold</b>")).toBeInTheDocument();
});
```

`src/app/(public)/announcements/[id]/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedAnnouncement: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/public-site/published-announcement", () => ({ getPublishedAnnouncement: mocks.getPublishedAnnouncement }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/recruitment/public-site-header", () => ({ PublicSiteHeader: () => <header data-testid="public-header" /> }));

import AnnouncementPage, { generateMetadata } from "./page";

const id = "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f";
const announcement = {
  id,
  title: "Road safety advisory",
  summary: "Expect road works near the station.",
  body: "First paragraph.\n\nSecond paragraph.",
  category: "advisory",
  published_at: "2026-10-03T02:00:00Z",
};
const props = (value: string) => ({ params: Promise.resolve({ id: value }) });

describe("AnnouncementPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a published announcement under the public header", async () => {
    mocks.getPublishedAnnouncement.mockResolvedValue(announcement);
    render(await AnnouncementPage(props(id)));
    expect(screen.getByTestId("public-header")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Road safety advisory" })).toBeVisible();
    expect(screen.getByText("Advisory")).toBeVisible();
    expect(screen.getByText("October 3, 2026")).toBeVisible();
    expect(screen.getByText("Second paragraph.")).toBeVisible();
    expect(mocks.getPublishedAnnouncement).toHaveBeenCalledWith(id);
  });

  it("returns notFound for a missing, draft or archived announcement", async () => {
    mocks.getPublishedAnnouncement.mockResolvedValue(null);
    await expect(AnnouncementPage(props(id))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it("uses the title and summary as page metadata", async () => {
    mocks.getPublishedAnnouncement.mockResolvedValue(announcement);
    await expect(generateMetadata(props(id))).resolves.toEqual({ title: "Road safety advisory | San Juan City Police HRIS", description: "Expect road works near the station." });
  });

  it("gives a missing announcement a not-found title", async () => {
    mocks.getPublishedAnnouncement.mockResolvedValue(null);
    await expect(generateMetadata(props("nope"))).resolves.toEqual({ title: "Announcement not found | San Juan City Police HRIS" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/public-site/published-announcement.test.ts src/components/public-site/announcement-body.test.tsx "src/app/(public)/announcements"`
Expected: FAIL. The imports for `./published-announcement`, `./announcement-body` and `./page` do not resolve.

- [ ] **Step 3: Implement**

`src/lib/public-site/published-announcement.ts`:

```ts
import { cache } from "react";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Announcement } from "@/lib/types/database";
import { uuidSchema } from "@/schemas/common";

export type PublishedAnnouncement = Pick<Announcement, "id" | "title" | "summary" | "body" | "category" | "published_at">;

/**
 * One published announcement, or null when the id is not a UUID, does not exist, or is a draft or
 * archived. The explicit status filter matters: RLS would also let a signed-in HR user read drafts.
 * React `cache` lets generateMetadata and the page share one query per request (Next.js
 * generate-metadata docs: non-fetch data is not memoized automatically).
 */
export const getPublishedAnnouncement = cache(async (id: string): Promise<PublishedAnnouncement | null> => {
  if (!uuidSchema.safeParse(id).success) return null;
  const client = await createServerSupabaseClient();
  const { data, error } = await client
    .from("announcements")
    .select("id, title, summary, body, category, published_at")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as PublishedAnnouncement | null;
});
```

`src/components/public-site/announcement-body.tsx`:

```tsx
import { Fragment } from "react";

import { announcementParagraphs } from "@/lib/public-site/announcement-text";
import { cn } from "@/lib/utils";

/** A plain-text announcement body. Blank lines start paragraphs and newlines become line breaks. Never renders HTML. */
export function AnnouncementBody({ body, className }: { body: string; className?: string }) {
  return (
    <div className={cn("space-y-4 text-base leading-8 [overflow-wrap:anywhere]", className)}>
      {announcementParagraphs(body).map((lines, paragraphIndex) => (
        <p key={paragraphIndex}>
          {lines.map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {lineIndex > 0 ? <br /> : null}
              {line}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
```

`src/app/(public)/announcements/[id]/page.tsx`. Per the Next.js 16 docs, `params` is a `Promise` that must be awaited, and `notFound()` throws and is never wrapped in `try/catch`.

```tsx
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnnouncementBody } from "@/components/public-site/announcement-body";
import { PublicSiteHeader } from "@/components/recruitment/public-site-header";
import { formatDate } from "@/lib/format-date";
import { getPublishedAnnouncement } from "@/lib/public-site/published-announcement";
import { announcementCategoryLabel } from "@/schemas/public-site";

type AnnouncementPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: AnnouncementPageProps): Promise<Metadata> {
  const { id } = await params;
  const announcement = await getPublishedAnnouncement(id);
  if (!announcement) return { title: "Announcement not found | San Juan City Police HRIS" };
  return { title: `${announcement.title} | San Juan City Police HRIS`, description: announcement.summary };
}

export default async function AnnouncementPage({ params }: AnnouncementPageProps) {
  const { id } = await params;
  const announcement = await getPublishedAnnouncement(id);
  if (!announcement) notFound();

  return (
    <div className="min-h-dvh bg-background">
      <PublicSiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href="/#announcements">
          <ArrowLeft aria-hidden="true" className="size-4" />
          All announcements
        </Link>
        <article className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">{announcementCategoryLabel(announcement.category)}</span>
            {announcement.published_at ? <time dateTime={announcement.published_at}>{formatDate(announcement.published_at)}</time> : null}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{announcement.title}</h1>
          <p className="mt-3 text-lg leading-8 text-muted-foreground">{announcement.summary}</p>
          <AnnouncementBody body={announcement.body} className="mt-8" />
        </article>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/public-site src/components/public-site "src/app/(public)" && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/public-site/published-announcement.ts src/lib/public-site/published-announcement.test.ts src/components/public-site/announcement-body.tsx src/components/public-site/announcement-body.test.tsx "src/app/(public)/announcements"
git commit -m "$(cat <<'EOF'
feat: add the public announcement page with metadata and not-found handling

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: HR announcements management

**Files:**
- Create: `src/components/public-site/hr-announcement-form.tsx`, `src/components/public-site/hr-announcement-form.test.tsx`
- Create: `src/components/public-site/hr-announcements-panel.tsx`, `src/components/public-site/hr-announcements-panel.test.tsx`

**Interfaces:**
- Consumes:
  - From Task 3: `useHrAnnouncements`, `useSaveAnnouncement` (`{ input, announcementId? }`), `useSetAnnouncementStatus` (`{ announcementId, status }`) and `useDeleteAnnouncement` (`announcementId`).
  - From Task 2: `announcementSchema`, `ANNOUNCEMENT_CATEGORIES`, `ANNOUNCEMENT_STATUS_LABELS` and `announcementCategoryLabel`.
  - The UI primitives `Button`, `Badge`, `FormField`, `Input`, `NativeSelect`, `Textarea`, `ErrorState`, `LoadingState` and `StatusPanel`.
- Produces:
  - `HrAnnouncementForm({ announcement?, onCancel, onSaved(message) })`, which renders `form[aria-label="New announcement" | "Edit <title>"]`.
  - `HrAnnouncementsPanel()`.

- [ ] **Step 1: Write the failing tests**

`src/components/public-site/hr-announcement-form.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("@/hooks/use-public-site", () => ({ useSaveAnnouncement: () => ({ isPending: false, mutateAsync: mocks.save }) }));

import { HrAnnouncementForm } from "./hr-announcement-form";

const existing = {
  id: "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f",
  title: "Road safety advisory",
  summary: "Road works this weekend.",
  body: "Details.",
  category: "advisory" as const,
  status: "published" as const,
  published_at: "2026-10-03T02:00:00Z",
  created_by: null,
  updated_by: null,
  created_at: "2026-10-03T01:00:00Z",
  updated_at: "2026-10-03T02:00:00Z",
};

describe("HrAnnouncementForm", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows field errors and does not save an empty announcement", async () => {
    const user = userEvent.setup();
    render(<HrAnnouncementForm onCancel={vi.fn()} onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Enter a title.")).toBeInTheDocument();
    expect(screen.getByText("Enter a short summary.")).toBeInTheDocument();
    expect(screen.getByText("Enter the announcement text.")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("saves a new announcement as a draft with trimmed values", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mocks.save.mockResolvedValue({ ...existing, status: "draft" });
    render(<HrAnnouncementForm onCancel={vi.fn()} onSaved={onSaved} />);
    await user.type(screen.getByLabelText(/^Title/), "  Road safety advisory  ");
    await user.selectOptions(screen.getByLabelText(/^Category/), "advisory");
    await user.type(screen.getByLabelText(/^Summary/), "Road works this weekend.");
    await user.type(screen.getByLabelText(/^Announcement text/), "First.{Enter}{Enter}Second.");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({
      input: { title: "Road safety advisory", category: "advisory", summary: "Road works this weekend.", body: "First.\n\nSecond." },
      announcementId: undefined,
    }));
    expect(onSaved).toHaveBeenCalledWith("Road safety advisory was saved as a draft.");
  });

  it("edits an existing announcement and shows the server's error", async () => {
    const user = userEvent.setup();
    mocks.save.mockRejectedValue(new Error("HR access is required."));
    render(<HrAnnouncementForm announcement={existing} onCancel={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole("form", { name: "Edit Road safety advisory" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Title/)).toHaveValue("Road safety advisory");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("HR access is required.");
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ announcementId: existing.id }));
  });
});
```

`src/components/public-site/hr-announcements-panel.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const base = { summary: "Summary", body: "Body", category: "news", created_by: null, updated_by: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-02T00:00:00Z" };
  return {
    rows: [
      { ...base, id: "11111111-1111-4111-8111-111111111111", title: "Draft notice", status: "draft", published_at: null },
      { ...base, id: "22222222-2222-4222-8222-222222222222", title: "Published notice", status: "published", published_at: "2026-10-02T00:00:00Z" },
      { ...base, id: "33333333-3333-4333-8333-333333333333", title: "Archived notice", status: "archived", published_at: "2026-09-01T00:00:00Z" },
    ],
    setStatus: vi.fn(),
    remove: vi.fn(),
    save: vi.fn(),
  };
});

vi.mock("@/hooks/use-public-site", () => ({
  useHrAnnouncements: () => ({ data: mocks.rows, error: null, isLoading: false }),
  useSetAnnouncementStatus: () => ({ isPending: false, mutateAsync: mocks.setStatus }),
  useDeleteAnnouncement: () => ({ isPending: false, mutateAsync: mocks.remove }),
  useSaveAnnouncement: () => ({ isPending: false, mutateAsync: mocks.save }),
}));

import { HrAnnouncementsPanel } from "./hr-announcements-panel";

describe("HrAnnouncementsPanel", () => {
  beforeEach(() => {
    mocks.setStatus.mockReset().mockResolvedValue({});
    mocks.remove.mockReset().mockResolvedValue(undefined);
  });

  it("shows each status and only the actions that status allows", () => {
    render(<HrAnnouncementsPanel />);
    expect(screen.getByText("Draft")).toBeVisible();
    expect(screen.getByText("Published")).toBeVisible();
    expect(screen.getByText("Archived")).toBeVisible();
    expect(screen.getByRole("button", { name: "Publish Draft notice" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete Draft notice" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Archive Published notice" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete Published notice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish Published notice" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish Archived notice" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete Archived notice" })).not.toBeInTheDocument();
  });

  it("publishes a draft and reports it", async () => {
    const user = userEvent.setup();
    render(<HrAnnouncementsPanel />);
    await user.click(screen.getByRole("button", { name: "Publish Draft notice" }));
    expect(mocks.setStatus).toHaveBeenCalledWith({ announcementId: "11111111-1111-4111-8111-111111111111", status: "published" });
    expect(await screen.findByText("Draft notice is now published on the landing page.")).toBeVisible();
  });

  it("asks before deleting a draft", async () => {
    const user = userEvent.setup();
    render(<HrAnnouncementsPanel />);
    await user.click(screen.getByRole("button", { name: "Delete Draft notice" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(mocks.remove).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(await screen.findByText("Draft notice was deleted.")).toBeVisible();
  });

  it("shows the server's refusal", async () => {
    const user = userEvent.setup();
    mocks.setStatus.mockRejectedValue(new Error("Only a published announcement can be archived."));
    render(<HrAnnouncementsPanel />);
    await user.click(screen.getByRole("button", { name: "Archive Published notice" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only a published announcement can be archived.");
  });

  it("opens the form for a new announcement", async () => {
    const user = userEvent.setup();
    render(<HrAnnouncementsPanel />);
    await user.click(screen.getByRole("button", { name: "New announcement" }));
    expect(screen.getByRole("form", { name: "New announcement" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/public-site/hr-announcement`
Expected: FAIL. `./hr-announcement-form` and `./hr-announcements-panel` do not resolve.

- [ ] **Step 3: Implement**

`src/components/public-site/hr-announcement-form.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useSaveAnnouncement } from "@/hooks/use-public-site";
import type { Announcement } from "@/lib/types/database";
import { ANNOUNCEMENT_CATEGORIES, announcementSchema, type AnnouncementInput } from "@/schemas/public-site";

type AnnouncementFormValues = z.input<typeof announcementSchema>;

type HrAnnouncementFormProps = {
  announcement?: Announcement;
  onCancel: () => void;
  onSaved: (message: string) => void;
};

export function HrAnnouncementForm({ announcement, onCancel, onSaved }: HrAnnouncementFormProps) {
  const save = useSaveAnnouncement();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AnnouncementFormValues, unknown, AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: announcement?.title ?? "",
      category: announcement?.category ?? "news",
      summary: announcement?.summary ?? "",
      body: announcement?.body ?? "",
    },
  });
  const errors = form.formState.errors;
  const idPrefix = announcement ? `announcement-${announcement.id}` : "announcement-new";

  async function submit(values: AnnouncementInput) {
    setError(null);
    try {
      const saved = await save.mutateAsync({ input: values, announcementId: announcement?.id });
      onSaved(announcement ? `${saved.title} was updated.` : `${saved.title} was saved as a draft.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The announcement could not be saved.");
    }
  }

  return (
    <form
      aria-label={announcement ? `Edit ${announcement.title}` : "New announcement"}
      className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm"
      noValidate
      onSubmit={form.handleSubmit(submit)}
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <FormField error={errors.title?.message} htmlFor={`${idPrefix}-title`} label="Title" required>
          <Input id={`${idPrefix}-title`} maxLength={150} required {...form.register("title")} />
        </FormField>
        <FormField error={errors.category?.message} htmlFor={`${idPrefix}-category`} label="Category" required>
          <NativeSelect id={`${idPrefix}-category`} {...form.register("category")}>
            {ANNOUNCEMENT_CATEGORIES.map(({ label, value }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <FormField description="One or two sentences shown on the landing page card." error={errors.summary?.message} htmlFor={`${idPrefix}-summary`} label="Summary" required>
        <Textarea id={`${idPrefix}-summary`} maxLength={300} required rows={2} {...form.register("summary")} />
      </FormField>
      <FormField description="Plain text. Leave a blank line between paragraphs." error={errors.body?.message} htmlFor={`${idPrefix}-body`} label="Announcement text" required>
        <Textarea id={`${idPrefix}-body`} maxLength={10_000} required rows={10} {...form.register("body")} />
      </FormField>
      {error ? <ErrorState message={error} /> : null}
      <div className="flex flex-wrap gap-3">
        <Button disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : announcement ? "Save changes" : "Save draft"}</Button>
        <Button onClick={onCancel} type="button" variant="outline">Cancel</Button>
      </div>
    </form>
  );
}
```

`src/components/public-site/hr-announcements-panel.tsx`:

```tsx
"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusPanel } from "@/components/ui/status-panel";
import { useDeleteAnnouncement, useHrAnnouncements, useSetAnnouncementStatus } from "@/hooks/use-public-site";
import { formatDate } from "@/lib/format-date";
import { ANNOUNCEMENT_STATUS_LABELS, announcementCategoryLabel } from "@/schemas/public-site";

import { HrAnnouncementForm } from "./hr-announcement-form";

export function HrAnnouncementsPanel() {
  const announcements = useHrAnnouncements();
  const setStatus = useSetAnnouncementStatus();
  const remove = useDeleteAnnouncement();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = setStatus.isPending || remove.isPending;

  async function run(action: () => Promise<unknown>, success: string) {
    setNotice(null);
    setActionError(null);
    try {
      await action();
      setNotice(success);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The change could not be saved.");
    }
  }

  function finishEditing(message: string) {
    setEditing(null);
    setActionError(null);
    setNotice(message);
  }

  if (announcements.isLoading) return <LoadingState label="Loading announcements…" />;
  if (announcements.error) return <ErrorState message={announcements.error.message} />;
  const rows = announcements.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-base text-muted-foreground">Published announcements appear on the public landing page, newest first. The page shows the six newest.</p>
        {editing !== "new" ? (
          <Button onClick={() => { setEditing("new"); setNotice(null); }} type="button">
            <Plus aria-hidden="true" />
            New announcement
          </Button>
        ) : null}
      </div>
      <p aria-live="polite" className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{notice ?? ""}</p>
      {actionError ? <ErrorState message={actionError} /> : null}
      {editing === "new" ? <HrAnnouncementForm onCancel={() => setEditing(null)} onSaved={finishEditing} /> : null}
      {!rows.length && editing !== "new" ? (
        <StatusPanel description="Create an announcement, then publish it to show it on the public landing page." kind="empty" title="No announcements yet" />
      ) : null}
      <ul className="space-y-3">
        {rows.map((announcement) => (
          <li key={announcement.id}>
            {editing === announcement.id ? (
              <HrAnnouncementForm announcement={announcement} onCancel={() => setEditing(null)} onSaved={finishEditing} />
            ) : (
              <article aria-labelledby={`hr-announcement-${announcement.id}`} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={announcement.status === "published" ? "default" : "outline"}>{ANNOUNCEMENT_STATUS_LABELS[announcement.status]}</Badge>
                    <span className="text-sm text-muted-foreground">{announcementCategoryLabel(announcement.category)}</span>
                  </div>
                  <h3 className="text-lg font-semibold [overflow-wrap:anywhere]" id={`hr-announcement-${announcement.id}`}>{announcement.title}</h3>
                  <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{announcement.summary}</p>
                  <p className="text-sm text-muted-foreground">
                    {announcement.published_at ? `First published ${formatDate(announcement.published_at)}` : `Last updated ${formatDate(announcement.updated_at)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button aria-label={`Edit ${announcement.title}`} disabled={busy} onClick={() => { setEditing(announcement.id); setNotice(null); }} type="button" variant="outline">Edit</Button>
                  {announcement.status !== "published" ? (
                    <Button
                      aria-label={`Publish ${announcement.title}`}
                      disabled={busy}
                      onClick={() => void run(() => setStatus.mutateAsync({ announcementId: announcement.id, status: "published" }), `${announcement.title} is now published on the landing page.`)}
                      type="button"
                    >
                      Publish
                    </Button>
                  ) : (
                    <Button
                      aria-label={`Archive ${announcement.title}`}
                      disabled={busy}
                      onClick={() => void run(() => setStatus.mutateAsync({ announcementId: announcement.id, status: "archived" }), `${announcement.title} was archived and no longer appears on the landing page.`)}
                      type="button"
                      variant="outline"
                    >
                      Archive
                    </Button>
                  )}
                  {announcement.status === "draft" && confirmingDeleteId !== announcement.id ? (
                    <Button aria-label={`Delete ${announcement.title}`} disabled={busy} onClick={() => setConfirmingDeleteId(announcement.id)} type="button" variant="destructive">Delete</Button>
                  ) : null}
                </div>
                {confirmingDeleteId === announcement.id ? (
                  <div aria-label={`Confirm deleting ${announcement.title}`} className="flex basis-full flex-wrap items-center gap-2" role="group">
                    <p className="text-sm">Delete this draft? This cannot be undone.</p>
                    <Button
                      onClick={() => {
                        setConfirmingDeleteId(null);
                        void run(() => remove.mutateAsync(announcement.id), `${announcement.title} was deleted.`);
                      }}
                      type="button"
                      variant="destructive"
                    >
                      Confirm delete
                    </Button>
                    <Button onClick={() => setConfirmingDeleteId(null)} type="button" variant="outline">Keep draft</Button>
                  </div>
                ) : null}
              </article>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/public-site/hr-announcement && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/public-site/hr-announcement-form.tsx src/components/public-site/hr-announcement-form.test.tsx src/components/public-site/hr-announcements-panel.tsx src/components/public-site/hr-announcements-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat: let HR create, publish, archive and delete announcements

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: HR contacts management

**Files:**
- Create: `src/components/public-site/hr-contact-form.tsx`, `src/components/public-site/hr-contact-form.test.tsx`
- Create: `src/components/public-site/hr-contacts-panel.tsx`, `src/components/public-site/hr-contacts-panel.test.tsx`

**Interfaces:**
- Consumes:
  - From Task 3: `useHrContacts`, `useSavePublicContact` (`{ input, contactId? }`), `useDeletePublicContact` (`contactId`) and `useReorderPublicContacts` (`orderedIds`).
  - From Task 2: `publicContactSchema`, `PUBLIC_CONTACT_KINDS`, `contactKindLabel` and `moveId`.
- Produces:
  - `HrContactForm({ contact?, onCancel, onSaved(message) })`, which renders `form[aria-label="New contact" | "Edit <label>"]`.
  - `HrContactsPanel()`.

- [ ] **Step 1: Write the failing tests**

`src/components/public-site/hr-contact-form.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("@/hooks/use-public-site", () => ({ useSavePublicContact: () => ({ isPending: false, mutateAsync: mocks.save }) }));

import { HrContactForm } from "./hr-contact-form";

describe("HrContactForm", () => {
  beforeEach(() => vi.resetAllMocks());

  it("checks the value against the chosen type before saving", async () => {
    const user = userEvent.setup();
    render(<HrContactForm onCancel={vi.fn()} onSaved={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText(/^Type/), "email");
    await user.type(screen.getByLabelText(/^Label/), "HR email");
    await user.type(screen.getByLabelText(/^Contact details/), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Save contact" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("adds a visible phone contact", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mocks.save.mockResolvedValue({ id: "c1", label: "HR Office" });
    render(<HrContactForm onCancel={vi.fn()} onSaved={onSaved} />);
    expect(screen.getByLabelText("Show on the public landing page")).toBeChecked();
    await user.type(screen.getByLabelText(/^Label/), "HR Office");
    await user.type(screen.getByLabelText(/^Contact details/), "(02) 8123-4567");
    await user.click(screen.getByRole("button", { name: "Save contact" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ input: { kind: "phone", label: "HR Office", value: "(02) 8123-4567", isVisible: true }, contactId: undefined }));
    expect(onSaved).toHaveBeenCalledWith("HR Office was added.");
  });
});
```

`src/components/public-site/hr-contacts-panel.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const base = { created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" };
  return {
    rows: [
      { ...base, id: "11111111-1111-4111-8111-111111111111", label: "HR Office", kind: "phone", value: "(02) 8123-4567", sort_order: 1, is_visible: true },
      { ...base, id: "22222222-2222-4222-8222-222222222222", label: "Email desk", kind: "email", value: "hr@example.test", sort_order: 2, is_visible: false },
      { ...base, id: "33333333-3333-4333-8333-333333333333", label: "Front desk", kind: "hours", value: "Mon to Fri, 8 AM to 5 PM", sort_order: 3, is_visible: true },
    ],
    save: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
  };
});

vi.mock("@/hooks/use-public-site", () => ({
  useHrContacts: () => ({ data: mocks.rows, error: null, isLoading: false }),
  useSavePublicContact: () => ({ isPending: false, mutateAsync: mocks.save }),
  useDeletePublicContact: () => ({ isPending: false, mutateAsync: mocks.remove }),
  useReorderPublicContacts: () => ({ isPending: false, mutateAsync: mocks.reorder }),
}));

import { HrContactsPanel } from "./hr-contacts-panel";

const [first, second, third] = mocks.rows.map((row) => row.id);

describe("HrContactsPanel", () => {
  beforeEach(() => {
    mocks.save.mockReset().mockResolvedValue({});
    mocks.remove.mockReset().mockResolvedValue(undefined);
    mocks.reorder.mockReset().mockResolvedValue(undefined);
  });

  it("moves a contact with up and down buttons that stop at either end", async () => {
    const user = userEvent.setup();
    render(<HrContactsPanel />);
    expect(screen.getByRole("button", { name: "Move HR Office up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Front desk down" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move HR Office down" }));
    expect(mocks.reorder).toHaveBeenCalledWith([second, first, third]);
  });

  it("hides a visible contact without changing anything else", async () => {
    const user = userEvent.setup();
    render(<HrContactsPanel />);
    expect(screen.getByText("Hidden")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Hide HR Office" }));
    expect(mocks.save).toHaveBeenCalledWith({ contactId: first, input: { kind: "phone", label: "HR Office", value: "(02) 8123-4567", isVisible: false } });
    expect(await screen.findByText("HR Office is now hidden from the landing page.")).toBeVisible();
  });

  it("explains a reorder refused because the list changed elsewhere", async () => {
    const user = userEvent.setup();
    mocks.reorder.mockRejectedValue(new Error("The contact list changed. Reload the page and try again."));
    render(<HrContactsPanel />);
    await user.click(screen.getByRole("button", { name: "Move Front desk up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The contact list changed. Reload the page and try again.");
  });

  it("asks before deleting a contact", async () => {
    const user = userEvent.setup();
    render(<HrContactsPanel />);
    await user.click(screen.getByRole("button", { name: "Delete Email desk" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(mocks.remove).toHaveBeenCalledWith(second);
    expect(await screen.findByText("Email desk was deleted.")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/public-site/hr-contact`
Expected: FAIL. `./hr-contact-form` and `./hr-contacts-panel` do not resolve.

- [ ] **Step 3: Implement**

`src/components/public-site/hr-contact-form.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useSavePublicContact } from "@/hooks/use-public-site";
import type { PublicContact, PublicContactKind } from "@/lib/types/database";
import { PUBLIC_CONTACT_KINDS, publicContactSchema, type PublicContactInput } from "@/schemas/public-site";

type ContactFormValues = z.input<typeof publicContactSchema>;

const valueHints: Record<PublicContactKind, string> = {
  phone: "Digits, spaces, +, ( ) and - only, for example (02) 8123 4567. One number per entry.",
  email: "For example name@example.com.",
  address: "Street, barangay and city. Line breaks are kept.",
  hours: "For example Monday to Friday, 8:00 AM to 5:00 PM.",
  facebook: "The full page link, starting with https://www.facebook.com/.",
};

type HrContactFormProps = {
  contact?: PublicContact;
  onCancel: () => void;
  onSaved: (message: string) => void;
};

export function HrContactForm({ contact, onCancel, onSaved }: HrContactFormProps) {
  const save = useSavePublicContact();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ContactFormValues, unknown, PublicContactInput>({
    resolver: zodResolver(publicContactSchema),
    defaultValues: { kind: contact?.kind ?? "phone", label: contact?.label ?? "", value: contact?.value ?? "", isVisible: contact?.is_visible ?? true },
  });
  const kind = useWatch({ control: form.control, name: "kind" }) ?? "phone";
  const errors = form.formState.errors;
  const idPrefix = contact ? `contact-${contact.id}` : "contact-new";

  async function submit(values: PublicContactInput) {
    setError(null);
    try {
      const saved = await save.mutateAsync({ input: values, contactId: contact?.id });
      onSaved(contact ? `${saved.label} was updated.` : `${saved.label} was added.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The contact could not be saved.");
    }
  }

  return (
    <form aria-label={contact ? `Edit ${contact.label}` : "New contact"} className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm" noValidate onSubmit={form.handleSubmit(submit)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField error={errors.kind?.message} htmlFor={`${idPrefix}-kind`} label="Type" required>
          <NativeSelect id={`${idPrefix}-kind`} {...form.register("kind")}>
            {PUBLIC_CONTACT_KINDS.map(({ label, value }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField description="Shown above the value, for example HR Office." error={errors.label?.message} htmlFor={`${idPrefix}-label`} label="Label" required>
          <Input id={`${idPrefix}-label`} maxLength={80} required {...form.register("label")} />
        </FormField>
      </div>
      <FormField description={valueHints[kind]} error={errors.value?.message} htmlFor={`${idPrefix}-value`} label="Contact details" required>
        <Input id={`${idPrefix}-value`} maxLength={300} required {...form.register("value")} />
      </FormField>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold" htmlFor={`${idPrefix}-visible`}>
        <input className="size-5 accent-primary" id={`${idPrefix}-visible`} type="checkbox" {...form.register("isVisible")} />
        Show on the public landing page
      </label>
      {error ? <ErrorState message={error} /> : null}
      <div className="flex flex-wrap gap-3">
        <Button disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : "Save contact"}</Button>
        <Button onClick={onCancel} type="button" variant="outline">Cancel</Button>
      </div>
    </form>
  );
}
```

`src/components/public-site/hr-contacts-panel.tsx`:

```tsx
"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusPanel } from "@/components/ui/status-panel";
import { useDeletePublicContact, useHrContacts, useReorderPublicContacts, useSavePublicContact } from "@/hooks/use-public-site";
import { moveId } from "@/lib/public-site/contacts";
import { contactKindLabel } from "@/schemas/public-site";

import { HrContactForm } from "./hr-contact-form";

export function HrContactsPanel() {
  const contacts = useHrContacts();
  const save = useSavePublicContact();
  const remove = useDeletePublicContact();
  const reorder = useReorderPublicContacts();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = save.isPending || remove.isPending || reorder.isPending;

  async function run(action: () => Promise<unknown>, success: string) {
    setNotice(null);
    setActionError(null);
    try {
      await action();
      setNotice(success);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The change could not be saved.");
    }
  }

  function finishEditing(message: string) {
    setEditing(null);
    setActionError(null);
    setNotice(message);
  }

  if (contacts.isLoading) return <LoadingState label="Loading contacts…" />;
  if (contacts.error) return <ErrorState message={contacts.error.message} />;
  const rows = contacts.data ?? [];
  const ids = rows.map((contact) => contact.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-base text-muted-foreground">The landing page shows a Contact section only while at least one contact is visible. Entries appear in the order below.</p>
        {editing !== "new" ? (
          <Button onClick={() => { setEditing("new"); setNotice(null); }} type="button">
            <Plus aria-hidden="true" />
            Add contact
          </Button>
        ) : null}
      </div>
      <p aria-live="polite" className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{notice ?? ""}</p>
      {actionError ? <ErrorState message={actionError} /> : null}
      {editing === "new" ? <HrContactForm onCancel={() => setEditing(null)} onSaved={finishEditing} /> : null}
      {!rows.length && editing !== "new" ? (
        <StatusPanel
          description="Add the station's phone numbers, email, address, office hours, or Facebook page. The landing page shows a Contact section once one entry is visible."
          kind="empty"
          title="No contact details yet"
        />
      ) : null}
      <ul className="space-y-3">
        {rows.map((contact, index) => (
          <li key={contact.id}>
            {editing === contact.id ? (
              <HrContactForm contact={contact} onCancel={() => setEditing(null)} onSaved={finishEditing} />
            ) : (
              <article aria-labelledby={`hr-contact-${contact.id}`} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={contact.is_visible ? "default" : "outline"}>{contact.is_visible ? "Visible" : "Hidden"}</Badge>
                    <span className="text-sm text-muted-foreground">{contactKindLabel(contact.kind)}</span>
                  </div>
                  <h3 className="text-lg font-semibold" id={`hr-contact-${contact.id}`}>{contact.label}</h3>
                  <p className="text-base whitespace-pre-line text-muted-foreground [overflow-wrap:anywhere]">{contact.value}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button aria-label={`Move ${contact.label} up`} disabled={busy || index === 0} onClick={() => void run(() => reorder.mutateAsync(moveId(ids, contact.id, -1)), `${contact.label} moved up.`)} size="icon" type="button" variant="outline">
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button aria-label={`Move ${contact.label} down`} disabled={busy || index === rows.length - 1} onClick={() => void run(() => reorder.mutateAsync(moveId(ids, contact.id, 1)), `${contact.label} moved down.`)} size="icon" type="button" variant="outline">
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button aria-label={`Edit ${contact.label}`} disabled={busy} onClick={() => { setEditing(contact.id); setNotice(null); }} type="button" variant="outline">
                    <Pencil aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    aria-label={`${contact.is_visible ? "Hide" : "Show"} ${contact.label}`}
                    disabled={busy}
                    onClick={() => void run(
                      () => save.mutateAsync({ contactId: contact.id, input: { kind: contact.kind, label: contact.label, value: contact.value, isVisible: !contact.is_visible } }),
                      contact.is_visible ? `${contact.label} is now hidden from the landing page.` : `${contact.label} is now shown on the landing page.`,
                    )}
                    type="button"
                    variant="outline"
                  >
                    {contact.is_visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    {contact.is_visible ? "Hide" : "Show"}
                  </Button>
                  {confirmingDeleteId !== contact.id ? (
                    <Button aria-label={`Delete ${contact.label}`} disabled={busy} onClick={() => setConfirmingDeleteId(contact.id)} type="button" variant="destructive">
                      <Trash2 aria-hidden="true" />
                      Delete
                    </Button>
                  ) : null}
                </div>
                {confirmingDeleteId === contact.id ? (
                  <div aria-label={`Confirm deleting ${contact.label}`} className="flex basis-full flex-wrap items-center gap-2" role="group">
                    <p className="text-sm">Delete this contact? It disappears from the landing page.</p>
                    <Button
                      onClick={() => {
                        setConfirmingDeleteId(null);
                        void run(() => remove.mutateAsync(contact.id), `${contact.label} was deleted.`);
                      }}
                      type="button"
                      variant="destructive"
                    >
                      Confirm delete
                    </Button>
                    <Button onClick={() => setConfirmingDeleteId(null)} type="button" variant="outline">Keep contact</Button>
                  </div>
                ) : null}
              </article>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/public-site/hr-contact && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/public-site/hr-contact-form.tsx src/components/public-site/hr-contact-form.test.tsx src/components/public-site/hr-contacts-panel.tsx src/components/public-site/hr-contacts-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat: let HR manage, reorder and hide public contact entries

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: HR page, navigation entry, end-to-end coverage and full verification

**Files:**
- Create: `src/components/public-site/hr-public-site-workspace.tsx`, `src/components/public-site/hr-public-site-workspace.test.tsx`
- Create: `src/app/(app)/hr/public-site/page.tsx`
- Modify: `src/lib/app/role-config.ts` (HR navigation, after the `/reports` entry)
- Modify: `src/lib/app/role-config.test.ts` (the HR navigation expectation)
- Modify: `src/components/app-shell/app-shell.test.tsx` (the heading list near line 78)
- Modify: `e2e/business-journeys.spec.ts` (the `"read-only and public journeys"` describe)
- Modify: `e2e/iso25010-quality.spec.ts` (the `pages` list near line 70)
- Modify: `e2e/responsive-layout.spec.ts` (the HR entry in `sets`, and a new public test)

**Interfaces:**
- Consumes: `HrAnnouncementsPanel` (Task 7), `HrContactsPanel` (Task 8) and `PageHeader`.
- Produces: the route `/hr/public-site` (HR only, through `src/app/(app)/hr/layout.tsx` → `requireRole("hr_personnel")`), and `HrPublicSiteWorkspace()` with tabs "Announcements" and "Contacts".

- [ ] **Step 1: Write the failing unit tests**

`src/components/public-site/hr-public-site-workspace.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("./hr-announcements-panel", () => ({ HrAnnouncementsPanel: () => <p>Announcements panel</p> }));
vi.mock("./hr-contacts-panel", () => ({ HrContactsPanel: () => <p>Contacts panel</p> }));

import { HrPublicSiteWorkspace } from "./hr-public-site-workspace";

it("switches between the Announcements and Contacts tabs by click and arrow keys", async () => {
  const user = userEvent.setup();
  render(<HrPublicSiteWorkspace />);
  expect(screen.getByRole("tab", { name: "Announcements" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Announcements panel");

  await user.click(screen.getByRole("tab", { name: "Contacts" }));
  expect(screen.getByRole("tab", { name: "Contacts" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel", { name: "Contacts" })).toHaveTextContent("Contacts panel");

  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("tab", { name: "Announcements" })).toHaveFocus();
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Announcements panel");
});
```

In `src/lib/app/role-config.test.ts`, append this entry to the `navigation` array of the `"returns HR navigation scoped to HR personnel routes"` expectation, after the `/reports` line:

```ts
        { href: "/hr/public-site", label: "Public Announcements", group: "Public Portal" },
```

and add this test inside the describe:

```ts
  it("gives HR one place to manage the public portal", () => {
    expect(getRoleConfig("hr_personnel").navigation).toContainEqual({ href: "/hr/public-site", label: "Public Announcements", icon: "ScrollText", group: "Public Portal" });
  });
```

In `src/components/app-shell/app-shell.test.tsx`, change the heading list to:

```ts
    for (const heading of ["Overview", "Recruitment", "Personnel Management", "Attendance Management", "Insights", "Public Portal"]) {
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/public-site/hr-public-site-workspace.test.tsx src/lib/app/role-config.test.ts src/components/app-shell/app-shell.test.tsx`
Expected: FAIL. `./hr-public-site-workspace` does not resolve, the HR navigation is missing `/hr/public-site`, and `Unable to find an element with the text: Public Portal`.

- [ ] **Step 3: Implement**

`src/components/public-site/hr-public-site-workspace.tsx`:

```tsx
"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

import { HrAnnouncementsPanel } from "./hr-announcements-panel";
import { HrContactsPanel } from "./hr-contacts-panel";

const TABS = [
  { key: "announcements", label: "Announcements" },
  { key: "contacts", label: "Contacts" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Announcements and Contacts tabs (WAI-ARIA tabs pattern, like RecordTabs). */
export function HrPublicSiteWorkspace() {
  const [active, setActive] = useState<TabKey>("announcements");
  const tabRefs = useRef(new Map<TabKey, HTMLButtonElement>());

  function select(index: number) {
    const tab = TABS[(index + TABS.length) % TABS.length]!;
    setActive(tab.key);
    tabRefs.current.get(tab.key)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: TABS.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  }

  return (
    <div className="space-y-6">
      <div aria-label="Public portal content" className="flex gap-1 border-b" role="tablist">
        {TABS.map((tab, index) => {
          const selected = tab.key === active;
          return (
            <button
              aria-controls={selected ? `public-site-panel-${tab.key}` : undefined}
              aria-selected={selected}
              className={cn(
                "min-h-11 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              id={`public-site-tab-${tab.key}`}
              key={tab.key}
              onClick={() => setActive(tab.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(element) => {
                if (element) tabRefs.current.set(tab.key, element);
                else tabRefs.current.delete(tab.key);
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div aria-labelledby={`public-site-tab-${active}`} id={`public-site-panel-${active}`} role="tabpanel" tabIndex={0}>
        {active === "announcements" ? <HrAnnouncementsPanel /> : <HrContactsPanel />}
      </div>
    </div>
  );
}
```

`src/app/(app)/hr/public-site/page.tsx`:

```tsx
import { HrPublicSiteWorkspace } from "@/components/public-site/hr-public-site-workspace";
import { PageHeader } from "@/components/ui/page-header";

export default function HrPublicSitePage() {
  return (
    <div className="space-y-8">
      <PageHeader description="Publish announcements and keep the station's contact details current on the public landing page." title="Public Announcements" />
      <HrPublicSiteWorkspace />
    </div>
  );
}
```

In `src/lib/app/role-config.ts`, add this as the last entry of `hr_personnel.navigation`, after `/reports`:

```ts
      { href: "/hr/public-site", label: "Public Announcements", icon: "ScrollText", group: "Public Portal" },
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `npx vitest run src/components/public-site src/lib/app src/components/app-shell`
Expected: PASS. This includes `"keeps grouped navigation items adjacent"`, because "Public Portal" is a single trailing group.

- [ ] **Step 5: Add the Playwright coverage**

In `e2e/business-journeys.spec.ts`, add inside `test.describe("read-only and public journeys", …)`:

```ts
  test("an announcement HR publishes appears on the public landing page", async ({ page }) => {
    const title = `E2E Announcement ${runId}`;
    await signIn(page, "demo.hr@example.test", "/hr");
    await page.goto("/hr/public-site");
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Public Announcements" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("button", { name: "New announcement" }).click();
    const form = page.getByRole("form", { name: "New announcement" });
    await form.getByLabel(/^Title/).fill(title);
    await form.getByLabel(/^Category/).selectOption("advisory");
    await form.getByLabel(/^Summary/).fill("Road works near the station this weekend.");
    await form.getByLabel(/^Announcement text/).fill("First paragraph.\n\nSecond paragraph.");
    await form.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(`${title} was saved as a draft.`)).toBeVisible();

    await page.getByRole("button", { name: `Publish ${title}` }).click();
    await expect(page.getByText(`${title} is now published on the landing page.`)).toBeVisible();
    await signOut(page, "demo.hr@example.test");

    await page.goto("/");
    const announcements = page.getByRole("region", { name: "Announcements" });
    await expect(announcements.getByRole("heading", { name: title })).toBeVisible();
    await announcements.getByRole("link", { name: `Read more about ${title}` }).click();
    await expect(page).toHaveURL(/\/announcements\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Second paragraph.")).toBeVisible();
  });
```

In `e2e/iso25010-quality.spec.ts`, add `"/hr/public-site"` to the `hr` route list:

```ts
    ["hr", ["/hr", "/hr/employees", "/hr/employees/new", "/hr/leave-requests", "/hr/attendance", "/hr/public-site", "/reports"]],
```

In `e2e/responsive-layout.spec.ts`:
- Add `"/hr/public-site"` to the `demo.hr@example.test` path list, just before `"/reports"`.
- Append this test at the end of the file:

```ts
test("the public landing page fits a phone and keeps text readable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const small = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(el).fontSize) < 14 && (el as HTMLElement).offsetParent !== null).map((el) => `${el.tagName}:${parseFloat(getComputedStyle(el).fontSize)}:${el.textContent!.trim().slice(0, 30)}`).slice(0, 3));
  expect(overflow).toBeLessThanOrEqual(0);
  expect(small).toEqual([]);
});
```

- [ ] **Step 6: Run the end-to-end tests**

Run: `npx supabase start && npx playwright test e2e/business-journeys.spec.ts e2e/iso25010-quality.spec.ts e2e/responsive-layout.spec.ts`
Expected: PASS. The new journey passes. Axe reports no serious or critical violations on `/` and `/hr/public-site`. The landing page has no horizontal scroll and no text under 14px at 390px. If axe flags contrast on a `text-slate-300` line inside a `glass-panel`, raise it to `text-slate-200` and re-run.

- [ ] **Step 7: Run the full verification**

```bash
npm run lint
npm run typecheck
npm run test:run
npx supabase db reset && npx supabase test db
npm run build
```

Expected: every command exits 0, and `vitest` and pgTAP report no failures. `next build` lists `/`, `/announcements/[id]` and `/hr/public-site` among its routes.

- [ ] **Step 8: Commit**

```bash
git add src/components/public-site/hr-public-site-workspace.tsx src/components/public-site/hr-public-site-workspace.test.tsx "src/app/(app)/hr/public-site" src/lib/app/role-config.ts src/lib/app/role-config.test.ts src/components/app-shell/app-shell.test.tsx e2e/business-journeys.spec.ts e2e/iso25010-quality.spec.ts e2e/responsive-layout.spec.ts
git commit -m "$(cat <<'EOF'
feat: add the HR Public Announcements page and end-to-end coverage

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

Coverage of spec Part D, with the task that implements each requirement:

- Visual direction (navy, grid, gold, Montserrat and Inter, glass, real logos, lucide, ≥14px, contrast, 44px targets, reduced motion): Tasks 4 and 5, checked in Task 9 Steps 5 and 6.
- The 11 sections in order: Task 5. The order and the absence of the recruitment process are both tested.
- Data model and RLS: Task 1. No seeded contacts: Task 1. Contact section hidden when empty: Task 5.
- HR page, tabs and nav entry: Tasks 7, 8 and 9. `/announcements/[id]` with `notFound` and `generateMetadata`: Task 6.
- Spec tests: pgTAP (Task 1); Vitest landing, contacts and forms (Tasks 5, 7 and 8); Playwright publish-then-visible (Task 9).

Decisions made where the spec is silent:

- **Allowed status moves.** Draft or archived to published, and published to archived. A repeat publish is refused. Delete works only on drafts, per the spec. Editing a published announcement keeps it published.
- **Contact labels.** The spec gives no length, so labels are limited to 1–80 characters.
- **Phone, email and Facebook values** are format-checked on both the client and the server, so the landing page can build safe `tel:`, `mailto:` and `https:` links. Address and hours stay free text.
- **Contacts table.** Following the spec literally ("plus timestamps"), it has no `created_by` or `updated_by`. The audit log records who made each change.
- **HR navigation.** "Public Portal" is the last sidebar group.
- **Theme.** The landing page uses the app's existing `.dark` tokens, plus `--cta` for gold, rather than new colour tokens.
- **Public announcement page theme.** `/announcements/[id]` uses the light public theme, like `/jobs`, with `PublicSiteHeader`.
