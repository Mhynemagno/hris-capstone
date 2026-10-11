# Capstone UI: Applicant Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every applicant screen match the Capstone UI mockups 1:1 and apply the Applicant notes from `Final Changes (1).pdf`:
- email login
- the applicant number issued only when HR accepts the application
- no in-account "Apply now"
- a confirmation link that doesn't fail with "expired"

**Architecture:**
- **Database:** two new migrations. One moves applicant-number assignment from registration to acceptance. The other adds the remembered posting, stage schedule fields, notification delete RPCs and a target-posting RPC.
- **UI:** applicant-only components (`AppShell` and `src/components/recruitment/applicant-*`) are rewritten with the mockups' literal Tailwind classes. HR/Employee/SysAd screens and global theme tokens are untouched, except two schedule inputs in HR's stage-result dialog.
- **Auth:** the login route and Supabase cookie writers gain email login and a real "Remember me".

**Tech Stack:** Next.js 16.3 (App Router, see `node_modules/next/dist/docs/` before using Next APIs), React 19, Tailwind v4, Supabase (Postgres, pgTAP, `@supabase/ssr` 0.12.4), TanStack Query 5, sonner 2, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-capstone-ui-applicant-design.md`. Read it before starting any task.

## Global Constraints

- **Branch:** `feat/capstone-ui-applicant`. One PR into `main`. Never push migrations to live Supabase.
- **Mockup source of truth:** `docs/design/capstone-ui/` (copied in Task 1). Copy markup and Tailwind classes literally; only replace sample data with real data. Use **lucide-react** icons in place of Font Awesome (`fa-shield-halved` → the logo image, `fa-envelope` → `Mail`, `fa-lock` → `Lock`, `fa-eye` → `Eye`/`EyeOff`, `fa-bell` → `Bell`, `fa-bullhorn` → `Megaphone`, `fa-user` → `User`, `fa-right-from-bracket` → `LogOut`, `fa-check` → `Check`, `fa-trash` → `Trash2`, `fa-cloud-arrow-up` → `CloudUpload`, `fa-file-pdf` → `FileText`, `fa-image` → `Image`, `fa-floppy-disk` → `Save`, `fa-camera` → `Camera`, `fa-graduation-cap` → `GraduationCap`, `fa-id-card` → `IdCard`, `fa-chevron-down` → `ChevronDown`, `fa-xmark` → `X`, `fa-bars` → `Menu`, `fa-table-columns` → `PanelLeft`, `fa-house`/`fa-gauge` → `LayoutDashboard`, `fa-folder-open` → `FolderOpen`, `fa-clock-rotate-left` → `History`, `fa-calendar` → `CalendarDays`, `fa-list-check` → `ListChecks`, `fa-school` → `School`, `fa-building-columns` → `Landmark`, `fa-award` → `Award`, `fa-circle-check` → `CircleCheck`, `fa-triangle-exclamation` → `TriangleAlert`).
- **Logo:** `/san-juan-police-logo.png` (via `next/image`) wherever a mockup shows the shield/badge.
- **Font:** Inter is already global (`src/app/layout.tsx`). Do not add fonts.
- **Dates:** in words via `src/lib/format-date.ts` (`formatDate`), e.g. "October 18, 2026".
- **Copy text:** the mockups' copy, verbatim, unless the spec gives different wording.
- **Applicant number format:** `public.format_applicant_number` / `src/lib/recruitment/applicant-number.ts`. 202601 → "2-02601" and 2026100 → "2-026100". A null number shows **"Pending"**.
- **Accessibility floor:** every interactive control is keyboard-reachable, has an accessible name, and has visible focus. The notification panel and account menu close on Escape and outside click.
- **Commits:** end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Commands:** `npm run lint`, `npm run typecheck`, `npx vitest run <path>`, `npx supabase test db`, `npx supabase db reset` (local only), `npm run test:e2e`.

## Review Focus

1. **An applicant who registered before this PR** (has a number, maybe an application): the dashboard, profile and status pages must still render, and the number must not be re-assigned. Pinned in Task 2's SQL test ("keeps an existing number") and Task 11's profile test.
2. **Pressing Save on Documents twice quickly, or after the application already exists:** this must not create a duplicate application or show an error. Pinned in Task 12's test "does not submit again when an application is active".
3. **A posting chosen at registration that closes before the documents are saved:** fall back to the newest open posting instead of failing. Pinned in Task 3's SQL test for `my_application_target_job`.
4. **Notification panel with zero notifications, and with more than the first page:** show the empty state, and cap the list at 20 newest with a "View all" link to `/notifications`. Pinned in Task 9's drawer tests.
5. **Remember me unticked, then a token refresh in the proxy:** the refreshed cookies must stay session cookies. Pinned in Task 5's `applyRememberMe` unit test for the removal-vs-set cases.

---

## File Structure

**Create**
- `docs/design/capstone-ui/*.html`: the 24 mockups, read-only reference for this and later PRs.
- `public/login-hero.jpg`: the login hero background photo.
- `supabase/migrations/20261011090001_applicant_number_on_acceptance.sql`
- `supabase/migrations/20261011090002_applicant_portal_redesign.sql`: preferred posting, target RPC, stage schedule, notification delete.
- `supabase/tests/applicant_number_on_acceptance.test.sql`
- `supabase/tests/applicant_portal_redesign.test.sql`
- `supabase/templates/confirmation.html`
- `src/lib/supabase/remember-me.ts` + `.test.ts`: session-only cookie helper.
- `src/lib/recruitment/recruitment-notice.ts` + `.test.ts`: server read of the newest open posting.
- `src/components/recruitment/privacy-sections.tsx`: the privacy text shared by the apply notice and the login's Privacy Policy dialog.
- `src/components/auth/privacy-policy-dialog.tsx` + `.test.tsx`
- `src/components/auth/applicant-auth-frame.tsx` + `.test.tsx`: the split-card frame shared by applicant login and register.
- `src/components/app-shell/notification-drawer.tsx` + `.test.tsx`
- `src/components/app-shell/applicant-account-menu.tsx` + `.test.tsx`
- `src/components/app-shell/applicant-toaster.tsx` + `.test.tsx`: mockup-styled sonner toasts (`notifyApplicant`).
- `src/components/recruitment/applicant-status-card.tsx` + `.test.tsx`: the Application Status page body.
- `src/lib/recruitment/applicant-progress.ts` + `.test.ts`: pure helpers for the dashboard and status page (stage index, short labels, next action).

**Modify**
- **Auth:** `src/schemas/auth.ts`, `src/app/auth/login/route.ts`, `src/lib/supabase/{server,proxy,client}.ts`, `src/components/auth/{login-form,sign-out-button,applicant-registration-form}.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/applicant/register/page.tsx`, `src/app/auth/{callback/page.tsx,continue/route.ts}`, `src/app/(app)/layout.tsx`, `src/proxy.ts`.
- **Shell and pages:** `src/lib/app/role-config.ts`, `src/components/app-shell/app-shell.tsx`, `src/app/(app)/applicant/**/page.tsx`.
- **Recruitment components:** `src/components/recruitment/{applicant-dashboard,applicant-profile-form,applicant-profile-documents,applicant-profile-photo-control,apply-privacy-notice,public-job-detail,stage-dialogs}.tsx`.
- **Data:** `src/queries/{notifications,recruitment}.ts`, `src/hooks/{use-notifications,use-recruitment}.ts`, `src/lib/types/database.ts`, `src/lib/recruitment/applicant-number.ts`, `src/schemas/applicant-portal.ts`.
- **Supabase:** `supabase/config.toml`, `supabase/tests/recruitment_stage_results.test.sql`.
- **E2E:** `e2e/demo-accounts.ts`, `e2e/capstone-objectives.spec.ts`, `e2e/role-access.spec.ts`, `e2e/responsive-layout.spec.ts`, `e2e/applicant-visual-baseline.spec.ts`.

**Delete:** `src/components/recruitment/{applicant-apply-workspace,applicant-application-form,applicant-application-status,applicant-application-detail}.tsx` and their tests, plus `supabase/tests/applicant_number_email.test.sql`. Delete these only after nothing imports them; Task 13 checks with `rg`.

---

### Task 1: Reference assets

**Files:**
- Create: `docs/design/capstone-ui/` (24 files), `public/login-hero.jpg`

- [ ] **Step 1: Copy the mockups into the repo**

```bash
mkdir -p docs/design/capstone-ui
cp "/c/Users/ASUS/Downloads/drive-download-20261011T044128Z-1-001/"*.html docs/design/capstone-ui/
ls docs/design/capstone-ui | wc -l   # expect 24
```

- [ ] **Step 2: Download the hero photo**

```bash
curl -L -o public/login-hero.jpg "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80"
file public/login-hero.jpg   # expect "JPEG image data"
```

If the download fails, leave `LOGIN_HERO` null in Task 8; the gradient alone still matches the mockup's look.

- [ ] **Step 3: Commit**

```bash
git add docs/design/capstone-ui public/login-hero.jpg
git commit -m "docs: add the Capstone UI mockups and the login hero photo"
```

---

### Task 2: Applicant number on acceptance (database)

**Files:**
- Create: `supabase/migrations/20261011090001_applicant_number_on_acceptance.sql`, `supabase/tests/applicant_number_on_acceptance.test.sql`
- Delete: `supabase/tests/applicant_number_email.test.sql`

**Interfaces:**
- Produces:
  - `applicants.applicant_number` is now **nullable**.
  - Trigger `applications_assign_applicant_number` (AFTER UPDATE OF status).
  - Notification type `applicant_number_assigned` → outbox template `applicant_welcome`.

- [ ] **Step 1: Write the failing pgTAP test**

`supabase/tests/applicant_number_on_acceptance.test.sql`:

```sql
begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(9);

-- A brand-new self-registered applicant.
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-000000003001', 'authenticated', 'authenticated', 'accept-me@example.test',
  '{"first_name":"Nora","last_name":"Santos","registration":"applicant"}'::jsonb, now(), now());

select extensions.is(
  (select applicant_number from public.applicants where profile_id = '00000000-0000-4000-8000-000000003001'),
  null::bigint, 'Registration no longer assigns an applicant number');
select extensions.is(
  (select count(*) from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000003001'),
  0::bigint, 'Nothing is sent about an applicant number at sign-up');

insert into public.job_openings (title, description, location, closes_on, status, published_at, created_by_user_id)
values ('Acceptance test opening', 'Opening for acceptance tests.', 'San Juan City', current_date + 30, 'published', now(), '00000000-0000-4000-8000-000000008102');

insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000030001', applicant.id, opening.id, 'Application Submission'
from public.applicants applicant join public.job_openings opening on opening.title = 'Acceptance test opening'
where applicant.profile_id = '00000000-0000-4000-8000-000000003001';

update public.applications set stage_result = 'verified' where id = '00000000-0000-4000-8000-000000030001';
select extensions.is(
  (select applicant_number from public.applicants where profile_id = '00000000-0000-4000-8000-000000003001'),
  null::bigint, 'Verifying the documents does not issue a number yet');

-- Force the counter to 99 so the next number is the 100th of the year (padding bug regression).
insert into private.applicant_number_counters (registration_year, last_value)
values (extract(year from now() at time zone 'Asia/Manila')::integer, 99)
on conflict (registration_year) do update set last_value = 99;

update public.applications set status = 'Physical Agility Test', stage_result = 'pending' where id = '00000000-0000-4000-8000-000000030001';

select extensions.is(
  (select applicant_number::text from public.applicants where profile_id = '00000000-0000-4000-8000-000000003001'),
  extract(year from now() at time zone 'Asia/Manila')::integer::text || '100',
  'Passing Application Submission issues the next number of the year');
select extensions.is(
  (select body from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000003001' and type = 'applicant_number_assigned'),
  'Your application was accepted. Your applicant number is '
    || public.format_applicant_number((extract(year from now() at time zone 'Asia/Manila')::integer::text || '100')::bigint) || '.',
  'The applicant is told the number, formatted without truncation');
select extensions.is(
  (select job.template_key from private.notification_email_outbox job join public.notifications n on n.id = job.notification_id
   where n.recipient_user_id = '00000000-0000-4000-8000-000000003001' and n.type = 'applicant_number_assigned'),
  'applicant_welcome', 'The number is also emailed');

-- Moving on again does not re-issue.
update public.applications set status = 'Physical & Medical Examination' where id = '00000000-0000-4000-8000-000000030001';
select extensions.is(
  (select count(*) from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000003001' and type = 'applicant_number_assigned'),
  1::bigint, 'A number is issued only once');

-- An applicant who already has a number keeps it.
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-000000003002', 'authenticated', 'authenticated', 'old-applicant@example.test',
  '{"first_name":"Old","last_name":"Number","registration":"applicant"}'::jsonb, now(), now());
update public.applicants set applicant_number = 202655 where profile_id = '00000000-0000-4000-8000-000000003002';
insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000030002', applicant.id, opening.id, 'Application Submission'
from public.applicants applicant join public.job_openings opening on opening.title = 'Acceptance test opening'
where applicant.profile_id = '00000000-0000-4000-8000-000000003002';
update public.applications set status = 'Physical Agility Test' where id = '00000000-0000-4000-8000-000000030002';
select extensions.is(
  (select applicant_number from public.applicants where profile_id = '00000000-0000-4000-8000-000000003002'),
  202655::bigint, 'An existing applicant number is kept');

-- Failing Application Submission issues nothing.
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-000000003003', 'authenticated', 'authenticated', 'failed@example.test',
  '{"first_name":"Fail","last_name":"Ed","registration":"applicant"}'::jsonb, now(), now());
insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000030003', applicant.id, opening.id, 'Application Submission'
from public.applicants applicant join public.job_openings opening on opening.title = 'Acceptance test opening'
where applicant.profile_id = '00000000-0000-4000-8000-000000003003';
update public.applications set status = 'Not Selected' where id = '00000000-0000-4000-8000-000000030003';
select extensions.is(
  (select applicant_number from public.applicants where profile_id = '00000000-0000-4000-8000-000000003003'),
  null::bigint, 'A disqualified applicant gets no number');

select * from extensions.finish();
rollback;
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx supabase db reset && npx supabase test db supabase/tests/applicant_number_on_acceptance.test.sql`
Expected: FAIL at test 1 (a number is still assigned at registration).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261011090001_applicant_number_on_acceptance.sql`:

```sql
-- Capstone UI / Final Changes PDF p. 2: an applicant number is issued only once HR accepts the
-- application, i.e. when it leaves Application Submission for the Physical Agility Test (HR marks
-- the first stage Passed). Registration no longer assigns one, and the sign-up "your applicant
-- number" notification/email (20261010110001) is replaced by one sent on acceptance.
-- Applicants who already have a number keep it.

drop trigger applicants_assign_applicant_number on public.applicants;
drop function private.assign_applicant_number();
alter table public.applicants alter column applicant_number drop not null;

drop trigger applicants_notify_applicant_number on public.applicants;
drop function private.notify_applicant_number();

create or replace function private.enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_template_key text;
begin
  selected_template_key := case new.type
    when 'application_status_updated' then 'application_update'
    when 'application_remark_added' then 'application_remark'
    when 'leave_request_decision' then 'leave_decision'
    when 'profile_change_decision' then 'profile_change_decision'
    when 'deployment_assigned' then 'deployment_update'
    when 'deployment_updated' then 'deployment_update'
    when 'applicant_number_assigned' then 'applicant_welcome'
    else null
  end;

  if selected_template_key is null or new.link is null then
    return new;
  end if;

  insert into private.notification_email_outbox (
    notification_id, recipient_user_id, template_key, continue_path, notification_title, notification_body
  ) values (
    new.id, new.recipient_user_id, selected_template_key, new.link, new.title, new.body
  );

  return new;
end;
$$;

revoke all on function private.enqueue_notification_email() from public, anon, authenticated, service_role;

create function private.assign_applicant_number_on_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned bigint;
  recipient uuid;
begin
  if old.status <> 'Application Submission' or new.status in ('Application Submission', 'Not Selected') then
    return new;
  end if;

  update public.applicants applicant
  set applicant_number = private.next_applicant_number(private.applicant_registration_year(now()))
  where applicant.id = new.applicant_id and applicant.applicant_number is null
  returning applicant.applicant_number, applicant.profile_id into assigned, recipient;

  if assigned is null then
    return new;
  end if;

  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (
    recipient,
    'applicant_number_assigned',
    'Your applicant number',
    'Your application was accepted. Your applicant number is ' || public.format_applicant_number(assigned) || '.',
    '/applicant'
  );
  return new;
end;
$$;

revoke all on function private.assign_applicant_number_on_acceptance() from public, anon, authenticated;

create trigger applications_assign_applicant_number
  after update of status on public.applications
  for each row execute function private.assign_applicant_number_on_acceptance();
```

- [ ] **Step 4: Remove the obsolete test and run the suite**

```bash
git rm supabase/tests/applicant_number_email.test.sql
npx supabase db reset && npx supabase test db
```

Expected: the new file PASSES (9/9). Other SQL tests may now fail where they assumed every applicant has a number, e.g. `hris_feedback_profiles`, `recruitment_and_applicant_portal` or `applicant_portal_feedback`. Fix each one by giving the fixture applicant an explicit number (`update public.applicants set applicant_number = 2026xx where …`) or by asserting `is null`, whichever matches that test's intent. Don't change the migration to satisfy an old test. Re-run until everything passes.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261011090001_applicant_number_on_acceptance.sql supabase/tests
git commit -m "feat: issue the applicant number when HR accepts the application"
```

---

### Task 3: Preferred posting, target posting, stage schedule, notification delete (database)

**Files:**
- Create: `supabase/migrations/20261011090002_applicant_portal_redesign.sql`, `supabase/tests/applicant_portal_redesign.test.sql`
- Modify: `supabase/tests/recruitment_stage_results.test.sql` (the `has_function` signature line)

**Interfaces:**
- Produces:
  - `applicants.preferred_job_opening_id bigint null`
  - `public.set_my_preferred_job_opening(target_job_opening_id bigint) returns void`
  - `public.my_application_target_job() returns bigint` (null when no open posting)
  - `applications.stage_scheduled_at timestamptz null`, `applications.stage_venue text null`
  - `public.record_stage_result(target_application_id uuid, target_result text, target_note text, target_document jsonb, target_scheduled_at timestamptz default null, target_venue text default null)`
  - `public.delete_my_notification(target_notification_id uuid)`, `public.delete_my_notifications()`

- [ ] **Step 1: Write the failing pgTAP test**

`supabase/tests/applicant_portal_redesign.test.sql`:

```sql
begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(14);

insert into public.job_openings (title, description, location, closes_on, status, published_at, created_by_user_id) values
  ('Older open posting', 'Older posting for redesign tests.', 'San Juan City', current_date + 30, 'published', now() - interval '2 days', '00000000-0000-4000-8000-000000008102'),
  ('Newest open posting', 'Newest posting for redesign tests.', 'San Juan City', current_date + 30, 'published', now() - interval '1 day', '00000000-0000-4000-8000-000000008102'),
  ('Draft posting', 'Draft posting for redesign tests.', 'San Juan City', null, 'draft', null, '00000000-0000-4000-8000-000000008102');

-- Registration remembers a published posting and ignores anything else.
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-4000-8000-000000004001', 'authenticated', 'authenticated', 'prefers@example.test',
  jsonb_build_object('first_name', 'Pia', 'last_name', 'Ramos', 'registration', 'applicant', 'preferred_job_opening_id', id::text), now(), now()
from public.job_openings where title = 'Older open posting';
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-4000-8000-000000004002', 'authenticated', 'authenticated', 'draft-pref@example.test',
  jsonb_build_object('first_name', 'Dan', 'last_name', 'Cruz', 'registration', 'applicant', 'preferred_job_opening_id', id::text), now(), now()
from public.job_openings where title = 'Draft posting';

select extensions.is(
  (select opening.title from public.applicants applicant join public.job_openings opening on opening.id = applicant.preferred_job_opening_id
   where applicant.profile_id = '00000000-0000-4000-8000-000000004001'),
  'Older open posting', 'The posting chosen before registering is remembered');
select extensions.is(
  (select preferred_job_opening_id from public.applicants where profile_id = '00000000-0000-4000-8000-000000004002'),
  null::bigint, 'An unpublished posting is not remembered');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000004001';
select extensions.is((select title from public.job_openings where id = public.my_application_target_job()), 'Older open posting', 'The remembered posting is the target');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000004002';
select extensions.is((select title from public.job_openings where id = public.my_application_target_job()), 'Newest open posting', 'Without a remembered posting the newest open posting is the target');

select extensions.throws_ok(
  $$select public.set_my_preferred_job_opening((select id from public.job_openings where title = 'Draft posting'))$$,
  'P0001', 'The selected job opening is not accepting applications.', 'An unpublished posting cannot be chosen');
select extensions.lives_ok(
  $$select public.set_my_preferred_job_opening((select id from public.job_openings where title = 'Older open posting'))$$,
  'A signed-in applicant can choose an open posting');
select extensions.is((select title from public.job_openings where id = public.my_application_target_job()), 'Older open posting', 'The newly chosen posting becomes the target');

-- A remembered posting that closed falls back to the newest open one.
set local role postgres;
update public.job_openings set status = 'closed', published_at = null where title = 'Older open posting';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000004001';
select extensions.is((select title from public.job_openings where id = public.my_application_target_job()), 'Newest open posting', 'A closed remembered posting falls back to the newest open posting');

-- Stage schedule.
set local role postgres;
insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000040001', applicant.id, opening.id, 'Physical Agility Test'
from public.applicants applicant join public.job_openings opening on opening.title = 'Newest open posting'
where applicant.profile_id = '00000000-0000-4000-8000-000000004001';
insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata) values (
  '00000000-0000-4000-8000-000000040101', 'recruitment-stage-documents',
  'applications/00000000-0000-4000-8000-000000040001/agility.pdf',
  '00000000-0000-4000-8000-000000008102', '00000000-0000-4000-8000-000000008102', '{"mimetype":"application/pdf","size":2048}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008102';
select public.record_stage_result('00000000-0000-4000-8000-000000040001', 'scheduled', 'Bring PT uniform', null, '2026-10-17T22:00:00Z', ' Grandstand Sports Complex ');
set local role postgres;
select extensions.is(
  (select array[stage_scheduled_at::text, stage_venue] from public.applications where id = '00000000-0000-4000-8000-000000040001'),
  array['2026-10-17 22:00:00+00', 'Grandstand Sports Complex'], 'HR stores the stage date/time and venue');
select extensions.is(
  (select body from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000004001' and type = 'application_status_updated' order by created_at desc limit 1),
  'You are scheduled for the Physical Agility Test on October 18, 2026, 6:00 AM at Grandstand Sports Complex. Note: Bring PT uniform',
  'The applicant is told when and where');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008102';
select public.record_stage_result('00000000-0000-4000-8000-000000040001', 'passed', null,
  '{"objectPath":"applications/00000000-0000-4000-8000-000000040001/agility.pdf","fileName":"agility.pdf","mimeType":"application/pdf","sizeBytes":2048}'::jsonb);
set local role postgres;
select extensions.is(
  (select array[stage_scheduled_at::text, stage_venue] from public.applications where id = '00000000-0000-4000-8000-000000040001'),
  array[null, null]::text[], 'Moving to the next stage clears the schedule');

-- Notification delete is limited to the owner.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000004002';
select public.delete_my_notifications();
set local role postgres;
select extensions.ok(
  (select count(*) from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000004001') > 0,
  'Clearing my notifications leaves other people''s alone');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000004001';
select public.delete_my_notification((select id from public.notifications order by created_at limit 1));
select public.delete_my_notifications();
set local role postgres;
select extensions.is(
  (select count(*) from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000004001'),
  0::bigint, 'An applicant can delete and clear their own notifications');
select extensions.has_function('public', 'record_stage_result', array['uuid', 'text', 'text', 'jsonb', 'timestamp with time zone', 'text'], 'record_stage_result takes a schedule');

select * from extensions.finish();
rollback;
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx supabase test db supabase/tests/applicant_portal_redesign.test.sql`
Expected: FAIL (`preferred_job_opening_id` metadata is not stored).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261011090002_applicant_portal_redesign.sql`. Build it from these sections, in this order:

```sql
-- Capstone UI applicant redesign (Final Changes PDF pp. 4-14):
--   * The posting chosen on the landing page is remembered through registration; the applicant applies by
--     saving all required documents on the Documents page (no in-account "Apply now").
--   * HR can attach a date/time and venue when marking a stage Scheduled.
--   * Applicants can delete notifications from the notification panel.

alter table public.applicants
  add column preferred_job_opening_id bigint references public.job_openings (id) on delete set null;

-- private.handle_new_user: same body as 20260927150000_applicant_registration_details.sql, plus the
-- remembered posting (only a published one; anything else is ignored so sign-up never fails).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  middle_name_value text := nullif(btrim(metadata ->> 'middle_name'), '');
  qualifier_value text := nullif(btrim(metadata ->> 'qualifier'), '');
  phone_value text := nullif(btrim(metadata ->> 'phone'), '');
  birthdate_value date := private.applicant_metadata_birthdate(nullif(btrim(metadata ->> 'date_of_birth'), ''));
  preferred_value bigint := case when metadata ->> 'preferred_job_opening_id' ~ '^[0-9]{1,18}$' then (metadata ->> 'preferred_job_opening_id')::bigint end;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(metadata ->> 'full_name', metadata ->> 'name'))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'applicant'::public.app_role)
  on conflict (user_id) do nothing;

  if nullif(btrim(metadata ->> 'first_name'), '') is not null
     and nullif(btrim(metadata ->> 'last_name'), '') is not null then
    insert into public.applicants (profile_id, first_name, last_name, middle_name, qualifier, phone, date_of_birth, preferred_job_opening_id)
    values (
      new.id,
      btrim(metadata ->> 'first_name'),
      btrim(metadata ->> 'last_name'),
      case when char_length(middle_name_value) <= 80 then middle_name_value end,
      case when qualifier_value in ('Jr.', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX') then qualifier_value end,
      case when phone_value ~ '^\+639[0-9]{9}$' then phone_value end,
      case when birthdate_value < current_date then birthdate_value end,
      (select opening.id from public.job_openings opening where opening.id = preferred_value and opening.status = 'published')
    )
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;
```

**Before saving:** diff the block above against the latest `private.handle_new_user` (`rg -n "function private.handle_new_user" supabase/migrations`; use the newest file). If a newer migration than `20260927150000` changed it, merge that change in. The function must stay a strict superset of the current one.

```sql
create function private.posting_is_open(target_job_opening_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.job_openings opening
    where opening.id = target_job_opening_id and opening.status = 'published'
      and (opening.closes_on is null or opening.closes_on >= current_date)
  )
$$;
revoke all on function private.posting_is_open(bigint) from public, anon, authenticated;

create function public.set_my_preferred_job_opening(target_job_opening_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then raise exception 'Authenticated applicant access is required.' using errcode = '42501'; end if;
  if not private.posting_is_open(target_job_opening_id) then
    raise exception 'The selected job opening is not accepting applications.' using errcode = 'P0001';
  end if;
  update public.applicants set preferred_job_opening_id = target_job_opening_id, updated_at = now() where profile_id = caller_id;
  if not found then raise exception 'Complete an applicant profile before applying.' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.set_my_preferred_job_opening(bigint) from public, anon;
grant execute on function public.set_my_preferred_job_opening(bigint) to authenticated;

-- The posting a Documents-page Save submits to: the remembered one while it is open, otherwise the newest
-- open posting. Postings the applicant already applied to are skipped. Null when nothing is open.
create function public.my_application_target_job()
returns bigint language sql stable security definer set search_path = '' as $$
  with me as (select applicant.id, applicant.preferred_job_opening_id from public.applicants applicant where applicant.profile_id = (select auth.uid())),
  candidates as (
    select opening.id, opening.published_at, (opening.id = (select preferred_job_opening_id from me)) as preferred
    from public.job_openings opening
    where private.posting_is_open(opening.id)
      and not exists (select 1 from public.applications application where application.applicant_id = (select id from me) and application.job_opening_id = opening.id)
  )
  select id from candidates order by preferred desc, published_at desc nulls last, id desc limit 1
$$;
revoke all on function public.my_application_target_job() from public, anon;
grant execute on function public.my_application_target_job() to authenticated;

alter table public.applications
  add column stage_scheduled_at timestamptz,
  add column stage_venue text check (stage_venue is null or (stage_venue = btrim(stage_venue) and char_length(stage_venue) between 1 and 200));
```

Then replace `record_stage_result`. Drop both old 4-argument functions, then copy the full body from `20261010100002_recruitment_stage_results.sql` (`create function private.record_stage_result … $$;`) with **exactly** these changes:

1. Signature: `(target_application_id uuid, target_result text, target_note text, target_document jsonb, target_scheduled_at timestamptz default null, target_venue text default null)`.
2. Declare `clean_venue text := nullif(btrim(target_venue), '');`. After the note-length check add `if clean_venue is not null and char_length(clean_venue) > 200 then raise exception 'Venue must be at most 200 characters.' using errcode = '22023'; end if;`.
3. In the `verified`/`scheduled` branch, the update becomes:
   ```sql
   update public.applications set stage_result = target_result,
     stage_scheduled_at = case when target_result = 'scheduled' then target_scheduled_at end,
     stage_venue = case when target_result = 'scheduled' then clean_venue end,
     reviewed_at = coalesce(reviewed_at, now()), updated_at = now() where id = target_application_id;
   ```
   and the message becomes:
   ```sql
   message := case when target_result = 'verified' then 'Your submitted documents have been verified.'
     else 'You are scheduled for the ' || application_row.status
       || coalesce(' on ' || to_char(target_scheduled_at at time zone 'Asia/Manila', 'FMMonth FMDD, YYYY, FMHH12:MI AM'), '')
       || coalesce(' at ' || clean_venue, '') || '.' end;
   ```
4. In the passed/failed branch, the update adds `stage_scheduled_at = null, stage_venue = null`.
5. The notification link becomes `'/applicant/applications'` (no id).

The public wrapper and grants:

```sql
drop function public.record_stage_result(uuid, text, text, jsonb);
drop function private.record_stage_result(uuid, text, text, jsonb);
-- create function private.record_stage_result(...) as described above
create function public.record_stage_result(target_application_id uuid, target_result text, target_note text, target_document jsonb, target_scheduled_at timestamptz default null, target_venue text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_stage_result(target_application_id, target_result, target_note, target_document, target_scheduled_at, target_venue);
end;
$$;
revoke all on function private.record_stage_result(uuid, text, text, jsonb, timestamptz, text) from public, anon, authenticated;
revoke all on function public.record_stage_result(uuid, text, text, jsonb, timestamptz, text) from public, anon;
grant execute on function public.record_stage_result(uuid, text, text, jsonb, timestamptz, text) to authenticated;
```

Notification delete:

```sql
create function public.delete_my_notification(target_notification_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authenticated user required.' using errcode = '42501'; end if;
  delete from public.notifications notification where notification.id = target_notification_id and notification.recipient_user_id = current_user_id;
end;
$$;

create function public.delete_my_notifications()
returns void language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authenticated user required.' using errcode = '42501'; end if;
  delete from public.notifications notification where notification.recipient_user_id = current_user_id;
end;
$$;

revoke all on function public.delete_my_notification(uuid) from public, anon;
revoke all on function public.delete_my_notifications() from public, anon;
grant execute on function public.delete_my_notification(uuid) to authenticated;
grant execute on function public.delete_my_notifications() to authenticated;
```

`private.notification_email_outbox.notification_id` has no foreign key to `notifications` (verified: `unique` only), so deleting a notification never blocks on a queued email.

- [ ] **Step 4: Update the old signature assertion**

In `supabase/tests/recruitment_stage_results.test.sql`, change the first `has_function` line to:

```sql
select extensions.has_function('public', 'record_stage_result', array['uuid', 'text', 'text', 'jsonb', 'timestamp with time zone', 'text'], 'HR records Passed / Failed / Scheduled / Verified results');
```

Then search that file for any assertion on the notification `link` containing `/applicant/applications/` and update it to `/applicant/applications`.

- [ ] **Step 5: Run all database tests**

Run: `npx supabase db reset && npx supabase test db`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261011090002_applicant_portal_redesign.sql supabase/tests
git commit -m "feat: remember the chosen posting, schedule stages, and let applicants delete notifications"
```

---

### Task 4: Client data layer

**Files:**
- Modify: `src/lib/types/database.ts`, `src/lib/recruitment/applicant-number.ts`, `src/queries/notifications.ts`, `src/hooks/use-notifications.ts`, `src/queries/recruitment.ts`, `src/hooks/use-recruitment.ts`
- Test: `src/queries/notifications.test.ts`, `src/queries/recruitment-stage-results.test.ts`, `src/queries/recruitment.test.ts`, `src/lib/recruitment/applicant-number.test.ts` (create if missing)

**Interfaces:**
- Consumes: the RPCs from Task 3.
- Produces:
  - `Applicant.applicant_number: number | null`, `Applicant.preferred_job_opening_id: number | null`
  - `Application.stage_scheduled_at?: string | null`, `Application.stage_venue?: string | null`
  - `formatApplicantNumber(value): string | null` (unchanged signature). It now pads to 6 **only** below 6 digits: 2026100 → "2-026100".
  - `deleteNotification(id: string): Promise<void>`, `deleteAllNotifications(): Promise<void>`
  - hooks `useDeleteNotification()`, `useDeleteAllNotifications()`
  - `setMyPreferredJobOpening(jobId: number): Promise<void>`
  - `submitMyApplication(): Promise<{ outcome: "submitted"; applicationId: string } | { outcome: "already-active" } | { outcome: "no-open-posting" }>`
  - hook `useSubmitMyApplication()`
  - `StageResultInput` gains `scheduledAt?: string | null` (ISO) and `venue?: string`.

- [ ] **Step 1: Write failing tests**

Append to `src/queries/notifications.test.ts`. Extend the import to include `deleteNotification, deleteAllNotifications`:

```ts
it("deletes one notification through the owner-only RPC", async () => {
  mocks.rpc.mockResolvedValue({ error: null });
  await deleteNotification(notificationId);
  expect(mocks.rpc).toHaveBeenCalledWith("delete_my_notification", { target_notification_id: notificationId });
});

it("clears all of my notifications", async () => {
  mocks.rpc.mockResolvedValue({ error: null });
  await deleteAllNotifications();
  expect(mocks.rpc).toHaveBeenCalledWith("delete_my_notifications");
});
```

Append to `src/queries/recruitment-stage-results.test.ts`:

```ts
it("sends the schedule with a Scheduled result", async () => {
  mocks.rpc.mockResolvedValue({ error: null });
  await recordStageResult({ applicationId, result: "scheduled", scheduledAt: "2026-10-17T22:00:00.000Z", venue: "Grandstand" });
  expect(mocks.rpc).toHaveBeenCalledWith("record_stage_result", expect.objectContaining({ target_scheduled_at: "2026-10-17T22:00:00.000Z", target_venue: "Grandstand" }));
});
```

Also update the existing "records a result without a document" expectation to include `target_scheduled_at: null, target_venue: null`.

Create or extend `src/lib/recruitment/applicant-number.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatApplicantNumber } from "./applicant-number";

describe("formatApplicantNumber", () => {
  it("formats like the database", () => {
    expect(formatApplicantNumber(202601)).toBe("2-02601");
    expect(formatApplicantNumber(2026100)).toBe("2-026100");
    expect(formatApplicantNumber(12345)).toBe("0-12345");
    expect(formatApplicantNumber(null)).toBeNull();
  });
});
```

Add a `submitMyApplication` describe block to `src/queries/recruitment.test.ts`, following that file's existing mock style (read its top first). Three cases:
- **Active application:** `from("applications")` returns a row with status `"Physical Agility Test"` → resolves `{ outcome: "already-active" }`, and `rpc("submit_application")` is not called.
- **No open posting:** no active rows, and `rpc("my_application_target_job")` → `{ data: null }` → resolves `{ outcome: "no-open-posting" }`.
- **Submits:** no active rows, the target is `7`, and the saved resume loads → `rpc("submit_application", expect.objectContaining({ target_job_opening_id: 7 }))` and `{ outcome: "submitted" }`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/queries/notifications.test.ts src/queries/recruitment-stage-results.test.ts src/queries/recruitment.test.ts src/lib/recruitment/applicant-number.test.ts`
Expected: FAIL (functions missing, `2-02610` vs `2-026100`).

- [ ] **Step 3: Implement**

`src/lib/recruitment/applicant-number.ts`:

```ts
/** Applicant numbers display like badge numbers: 12345 → "0-12345", 202601 → "2-02601", 2026100 → "2-026100". */
export function formatApplicantNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const digits = String(value).padStart(6, "0");
  return `${digits.slice(0, 1)}-${digits.slice(1)}`;
}
```

`padStart` never truncates, so this was already right; the test pins it. Delete the duplicate `formatApplicantNumber` in `applicant-profile-form.tsx` in Task 11.

`src/queries/notifications.ts` additions:

```ts
export async function deleteNotification(notificationId: string) {
  const targetNotificationId = uuidSchema.parse(notificationId);
  const { error } = await createBrowserSupabaseClient().rpc("delete_my_notification", { target_notification_id: targetNotificationId });
  throwIfError(error);
}

export async function deleteAllNotifications() {
  const { error } = await createBrowserSupabaseClient().rpc("delete_my_notifications");
  throwIfError(error);
}
```

`src/hooks/use-notifications.ts` additions:

```ts
export function useDeleteNotification() {
  const invalidate = useNotificationInvalidation();
  return useMutation({ mutationFn: deleteNotification, onSuccess: invalidate });
}

export function useDeleteAllNotifications() {
  const invalidate = useNotificationInvalidation();
  return useMutation({ mutationFn: deleteAllNotifications, onSuccess: invalidate });
}
```

`src/queries/recruitment.ts`:
- `StageResultInput = { applicationId: string; result: RecordableResult; note?: string; file?: File | null; scheduledAt?: string | null; venue?: string }`.
- In `recordStageResult`, pass `target_scheduled_at: scheduledAt ?? null, target_venue: venue?.trim() || null`.
- Add:

```ts
export async function setMyPreferredJobOpening(jobId: number) {
  const id = jobOpeningSchema.shape.id.unwrap().parse(jobId);
  const { error } = await createBrowserSupabaseClient().rpc("set_my_preferred_job_opening", { target_job_opening_id: id });
  throwIfError(error);
}

export type SubmitMyApplicationResult =
  | { outcome: "submitted"; applicationId: string }
  | { outcome: "already-active" }
  | { outcome: "no-open-posting" };

const CLOSED_STATUSES = ["Hired", "Not Selected"] as const;

/** The Documents-page Save: submits one application to the remembered (or newest open) posting once all documents are on file. */
export async function submitMyApplication(): Promise<SubmitMyApplicationResult> {
  const client = createBrowserSupabaseClient();
  const { data: active, error: activeError } = await client
    .from("applications")
    .select("id, status")
    .not("status", "in", `(${CLOSED_STATUSES.map((status) => `"${status}"`).join(",")})`)
    .limit(1);
  throwIfError(activeError);
  if ((active ?? []).length > 0) return { outcome: "already-active" };

  const { data: target, error: targetError } = await client.rpc("my_application_target_job");
  throwIfError(targetError);
  if (typeof target !== "number") return { outcome: "no-open-posting" };

  const documents = await listApplicantProfileDocuments();
  const resume = documents.find((document) => document.kind === "resume");
  if (!resume) throw new Error("Please upload required documents");
  const cv = await loadMyProfileDocumentFile(resume);
  const applicationId = await submitApplication({ applicationId: crypto.randomUUID(), jobId: target, documents: [{ kind: "cv", file: cv }] });
  return { outcome: "submitted", applicationId };
}
```

`src/hooks/use-recruitment.ts`: add `useSubmitMyApplication()`. It's a `useMutation` on `submitMyApplication`; `onSuccess` invalidates `queryKeys.recruitment.myApplications` (prefix `["recruitment", "my-applications"]`; read `src/lib/query-keys.ts` for the exact prefix) and `queryKeys.recruitment.profileDocuments()`.

`src/lib/types/database.ts`:
- `Applicant`: `applicant_number: number | null;` and add `preferred_job_opening_id: number | null;`.
- `Application`: add `stage_scheduled_at?: string | null; stage_venue?: string | null;`.

- [ ] **Step 4: Run the tests, then the type check**

Run: `npx vitest run src/queries src/lib/recruitment && npm run typecheck`
Expected: tests PASS. `typecheck` may flag places that assumed a non-null `applicant_number`. Fix each one with `formatApplicantNumber(x) ?? "Pending"` (applicant-facing) or `?? "—"` (HR tables). Don't use non-null assertions.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: client queries for notification delete, stage schedule, and submit-on-save"
```

---

### Task 5: Email login and Remember me

**Files:**
- Create: `src/lib/supabase/remember-me.ts`, `src/lib/supabase/remember-me.test.ts`
- Modify: `src/schemas/auth.ts`, `src/app/auth/login/route.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/client.ts`, `src/components/auth/sign-out-button.tsx`
- Test: `src/app/auth/login/route.test.ts`, `src/schemas/auth.test.ts`

**Interfaces:**
- Produces:
  - `SESSION_ONLY_COOKIE = "hris-session-only"`
  - `applyRememberMe<T extends CookieOptionsLike>(options: T | undefined, sessionOnly: boolean): T | undefined`
  - `clearSessionOnlyCookie(): void` (browser)
  - The login form posts `remember=on|<absent>`.
  - `loginIdentifierSchema("applicant")` now accepts an **email** or a legacy applicant number.

- [ ] **Step 1: Write failing tests**

`src/lib/supabase/remember-me.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyRememberMe } from "./remember-me";

describe("applyRememberMe", () => {
  const persistent = { path: "/", sameSite: "lax" as const, maxAge: 34560000 };

  it("keeps persistent cookies when the user chose to be remembered", () => {
    expect(applyRememberMe(persistent, false)).toEqual(persistent);
  });

  it("turns auth cookies into session cookies when the user did not tick Remember me", () => {
    expect(applyRememberMe(persistent, true)).toEqual({ path: "/", sameSite: "lax" });
    expect(applyRememberMe({ ...persistent, expires: new Date() }, true)).toEqual({ path: "/", sameSite: "lax" });
  });

  it("never touches a removal (maxAge 0), so sign-out and chunk clean-up still delete cookies", () => {
    expect(applyRememberMe({ path: "/", maxAge: 0 }, true)).toEqual({ path: "/", maxAge: 0 });
  });

  it("passes undefined through", () => {
    expect(applyRememberMe(undefined, true)).toBeUndefined();
  });
});
```

In `src/app/auth/login/route.test.ts`:
- Mock `next/headers` with a fake cookie store: `const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn(), getAll: vi.fn(() => []) }; vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));`.
- Extend `createServerSupabaseClient`'s mock to also return `from().select().eq().maybeSingle()` resolving `{ data: { is_active: true } }`.

Then add:

```ts
it("signs an applicant in with their email address and remembers the device", async () => {
  signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const response = await POST(loginRequest({ as: "applicant", identifier: "Juan.Delacruz@Email.com ", password: "secret1", remember: "on", next: "/applicant" }));
  expect(signInWithPassword).toHaveBeenCalledWith({ email: "juan.delacruz@email.com", password: "secret1" });
  expect(response.headers.get("location")).toContain("/auth/continue");
  expect(cookieStore.delete).toHaveBeenCalledWith("hris-session-only");
});

it("marks the session as browser-only before signing in when Remember me is unticked", async () => {
  signInWithPassword.mockImplementation(async () => {
    // The preference must already be in place when Supabase writes its session cookies.
    expect(cookieStore.set).toHaveBeenCalledWith("hris-session-only", "1", expect.objectContaining({ path: "/" }));
    return { data: { user: { id: "u1" } }, error: null };
  });
  await POST(loginRequest({ as: "applicant", identifier: "juan@email.com", password: "secret1" }));
  expect(signInWithPassword).toHaveBeenCalled();
});

it("rejects an applicant identifier that is neither an email nor an applicant number", async () => {
  const response = await POST(loginRequest({ as: "applicant", identifier: "juan", password: "secret1" }));
  expect(response.headers.get("location")).toContain("error=invalid_credentials");
  expect(signInWithPassword).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/supabase/remember-me.test.ts src/app/auth/login/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/supabase/remember-me.ts`:

```ts
/** Present (value "1") when the user signed in without "Remember me": auth cookies are then session cookies. */
export const SESSION_ONLY_COOKIE = "hris-session-only";

type CookieOptionsLike = { maxAge?: number; expires?: Date };

/**
 * @supabase/ssr always writes auth cookies with a 400-day maxAge. Without "Remember me" we drop maxAge/expires
 * so the browser forgets the session when it closes. Removals (maxAge 0) pass through untouched.
 */
export function applyRememberMe<T extends CookieOptionsLike>(options: T | undefined, sessionOnly: boolean): T | undefined {
  if (!options || !sessionOnly || options.maxAge === 0) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}

export function readSessionOnly(cookies: { get(name: string): { value: string } | undefined }) {
  return cookies.get(SESSION_ONLY_COOKIE)?.value === "1";
}

/** Browser-side: forget the preference at sign-out. */
export function clearSessionOnlyCookie() {
  document.cookie = `${SESSION_ONLY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
```

`src/lib/supabase/server.ts`: in `setAll`, pass `applyRememberMe(options, readSessionOnly(cookieStore))`.

`src/lib/supabase/proxy.ts`: in `setAll`, pass `applyRememberMe(options, readSessionOnly(request.cookies))` to `response.cookies.set`.

`src/lib/supabase/client.ts`: the browser client must honour it too, because it refreshes tokens:

```ts
import { createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseConfig } from "./env";
import { applyRememberMe, SESSION_ONLY_COOKIE } from "./remember-me";

function readCookies() {
  return document.cookie.split("; ").filter(Boolean).map((pair) => {
    const index = pair.indexOf("=");
    return { name: decodeURIComponent(pair.slice(0, index)), value: decodeURIComponent(pair.slice(index + 1)) };
  });
}

function serialize(name: string, value: string, options: { path?: string; domain?: string; maxAge?: number; expires?: Date; sameSite?: boolean | "lax" | "strict" | "none"; secure?: boolean } = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`, `Path=${options.path ?? "/"}`];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite === true ? "Strict" : options.sameSite[0]!.toUpperCase() + options.sameSite.slice(1)}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function createBrowserSupabaseClient() {
  const { url, publishableKey } = getPublicSupabaseConfig();
  return createBrowserClient(url, publishableKey, {
    cookies: {
      getAll: readCookies,
      setAll(cookiesToSet) {
        const sessionOnly = readCookies().some(({ name, value }) => name === SESSION_ONLY_COOKIE && value === "1");
        cookiesToSet.forEach(({ name, value, options }) => {
          document.cookie = serialize(name, value, applyRememberMe(options, sessionOnly));
        });
      },
    },
  });
}
```

`src/schemas/auth.ts`: make the applicant identifier accept an email (lower-cased) or a legacy number:

```ts
const applicantLoginIdentifierSchema = z.string().trim().transform((value, context) => {
  if (z.email().safeParse(value).success) return { kind: "email" as const, value: value.toLowerCase() };
  const digits = value.replace(/[^0-9]/g, "");
  if (/^\d{6,}$/.test(digits)) return { kind: "applicant_number" as const, value: digits };
  context.addIssue({ code: "custom", message: "Enter your email address." });
  return z.NEVER;
});
```

`loginIdentifierSchema("applicant")` uses it, and `badgeNumberLoginSchema` is unchanged. Keep `LoginMode`. Update `src/schemas/auth.test.ts` for the new parse shape.

`src/app/auth/login/route.ts`:
- After parsing in applicant mode: if `identifier.kind === "email"` use it directly as `email`; otherwise call `resolve_login_identifier` with `identifier.value`, exactly as today.
- Employee mode is unchanged.
- **Before** `createServerSupabaseClient()` / `signInWithPassword`, record the preference in the request cookie store. Supabase's own `setAll` then reads it, so its session cookies are written correctly:

```ts
import { cookies } from "next/headers";
// …
const cookieStore = await cookies();
// Employees have no Remember me box: their sessions stay persistent as before.
const sessionOnly = mode === "applicant" && formData.get("remember") !== "on";
if (sessionOnly) cookieStore.set(SESSION_ONLY_COOKIE, "1", { path: "/", sameSite: "lax" });
else cookieStore.delete(SESSION_ONLY_COOKIE);
```

Cookies set through `cookies()` in a route handler are sent with the redirect response, the same way Supabase's session cookies already are. Don't also set them on `NextResponse`. On a failed login the preference cookie is harmless: it only changes how a future session cookie is written.

`src/components/auth/sign-out-button.tsx`: call `clearSessionOnlyCookie()` after a successful `signOut`.

- [ ] **Step 4: Run tests, lint and type check**

Run: `npx vitest run src/lib/supabase src/app/auth src/schemas/auth.test.ts src/components/auth && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: applicants log in with email, and Remember me keeps or forgets the session"
```

---

### Task 6: Confirmation link and safe login redirects

**Files:**
- Modify: `src/app/auth/callback/page.tsx`, `src/app/auth/continue/route.ts`, `src/app/(app)/layout.tsx`, `src/app/(auth)/login/page.tsx` (message text only)
- Test: `src/app/auth/callback/page.test.tsx`, `src/app/auth/continue/route.test.ts`

**Interfaces:**
- Produces:
  - The login message key `email_confirmed_or_used` → "Your email may already be confirmed. Try logging in."
  - A successful sign-up `token_hash` verification goes to `/applicant`.

- [ ] **Step 1: Write failing tests**

In `src/app/auth/callback/page.test.tsx`, following its existing mocks (`useSearchParams`, `verifyOtp`, `router.replace`), add:

```ts
it("treats an expired sign-up link reported in the URL hash as possibly already confirmed", async () => {
  window.location.hash = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
  setSearchParams("flow=signup");
  render(<AuthCallbackPage />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?as=applicant&message=email_confirmed_or_used"));
});

it("verifies a sign-up token_hash link and opens the applicant portal", async () => {
  verifyOtp.mockResolvedValue({ error: null });
  setSearchParams("token_hash=abc&type=email&flow=signup");
  render(<AuthCallbackPage />);
  await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "email" }));
  expect(replace).toHaveBeenCalledWith("/applicant");
});

it("keeps invitation errors as invitation_expired", async () => {
  setSearchParams("error_code=otp_expired");
  render(<AuthCallbackPage />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?as=employee&error=invitation_expired"));
});
```

`setSearchParams`/`replace`/`verifyOtp` are the helper names the file already uses; read it and match. Reset `window.location.hash = ""` in `afterEach`.

In `src/app/auth/continue/route.test.ts`:

```ts
it("sends a signed-out visitor to the applicant login and keeps an applicant destination", async () => {
  getAuthenticatedUser.mockResolvedValue(null);
  const response = await GET(new NextRequest("http://localhost/auth/continue?next=/applicant"));
  expect(response.headers.get("location")).toBe("http://localhost/login?as=applicant&next=%2Fapplicant");
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/app/auth`
Expected: FAIL.

- [ ] **Step 3: Implement**

`callback/page.tsx`:
- Read hash params once, inside the effect: `const hash = new URLSearchParams(window.location.hash.slice(1));` and `const linkError = searchParams.get("error_code") ?? searchParams.get("error") ?? hash.get("error_code") ?? hash.get("error");`. Move `linkError` from render into the effect, because `window` isn't available during server rendering.
- `const signupFlow = searchParams.get("flow") === "signup" || type === "signup";`
- On `linkError`: `router.replace(signupFlow ? "/login?as=applicant&message=email_confirmed_or_used" : "/login?as=employee&error=invitation_expired")`.
- Default destination for a successful sign-up without `next`: `const destination = searchParams.get("next") ? nextPath : signupFlow ? "/applicant" : nextPath;`.
- On a verify error in the sign-up flow (code or token_hash), redirect to `…&message=email_confirmed_or_used` instead of `error=invitation_expired`.

`continue/route.ts` (no user):

```ts
if (!user) {
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  const login = new URL("/login", request.url);
  login.searchParams.set("as", ["/applicant", "/jobs"].some((root) => nextPath === root || nextPath.startsWith(`${root}/`)) ? "applicant" : "employee");
  if (nextPath !== "/") login.searchParams.set("next", nextPath);
  return NextResponse.redirect(login);
}
```

`(app)/layout.tsx`: `redirect("/login")` stays. The login page itself chooses the mode from `next`, and the proxy already adds `next` for unauthenticated `/applicant/*`, so nothing else is needed.

`login/page.tsx`: add `message === "email_confirmed_or_used" ? "Your email may already be confirmed. Try logging in." : …` to `notice`, and treat `email_confirmed_or_used` like `email_confirmed` in `defaultMode`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/app`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app
git commit -m "fix: confirmation links that were already used no longer show an expired error"
```

---

### Task 7: Registration remembers the posting; Apply routes to Documents

**Files:**
- Modify: `src/components/auth/applicant-registration-form.tsx`, `src/components/recruitment/public-job-detail.tsx`, `src/app/(app)/applicant/apply/[jobId]/page.tsx`, `src/app/(app)/applicant/applications/page.tsx`
- Delete: `src/components/recruitment/applicant-apply-workspace.tsx`, `src/components/recruitment/applicant-application-form.tsx` (+ tests)
- Test: `src/components/auth/applicant-registration-form.test.tsx`, `src/components/recruitment/public-job-detail.test.tsx`, create `src/app/(app)/applicant/apply/[jobId]/page.test.tsx`

**Interfaces:**
- Consumes: `setMyPreferredJobOpening` (Task 4).
- Produces: the pure helper `preferredJobIdFromNext(next: string | null): number | null`, exported from `src/lib/auth/recruitment-next-path.ts`.

- [ ] **Step 1: Write failing tests**

Add to `src/lib/auth/recruitment-next-path.test.ts`:

```ts
it("reads the posting id from an apply destination", () => {
  expect(preferredJobIdFromNext("/applicant/apply/12")).toBe(12);
  expect(preferredJobIdFromNext("/jobs/7")).toBe(7);
  expect(preferredJobIdFromNext("/applicant")).toBeNull();
  expect(preferredJobIdFromNext(null)).toBeNull();
});
```

In `applicant-registration-form.test.tsx`, assert that `signUp` receives `options.data.preferred_job_opening_id === "12"` when rendered with `nextPath="/applicant/apply/12"`. Also assert the confirmation copy is "Check your email to confirm your account, then log in with your email address." and that the old "applicant number" sentence is absent.

`src/app/(app)/applicant/apply/[jobId]/page.test.tsx`: mock `next/navigation` `redirect`, and assert the page redirects to `/applicant/documents?apply=12`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/auth src/components/auth/applicant-registration-form.test.tsx "src/app/(app)/applicant/apply"`
Expected: FAIL.

- [ ] **Step 3: Implement**

`recruitment-next-path.ts`:

```ts
/** "/applicant/apply/12" or "/jobs/12" → 12: the posting a visitor was applying for when sent to register. */
export function preferredJobIdFromNext(next: string | null | undefined): number | null {
  if (!next) return null;
  const match = /^\/(?:applicant\/apply|jobs)\/(\d{1,12})(?:[/?#]|$)/.exec(next);
  return match ? Number(match[1]) : null;
}
```

Registration form:
- Add `preferred_job_opening_id: preferredJobIdFromNext(nextPath)?.toString()` to `options.data`, only when it's not null.
- Remove the "We also emailed your applicant number" paragraph. Change the first paragraph to "Check your email to confirm your account, then log in with your email address."
- Change `emailRedirectTo` to `confirmationRedirect("/applicant")`.
- After a sign-up with an immediate session, go to `/applicant/documents`.

Apply page (`/applicant/apply/[jobId]`) becomes a redirect: `redirect(`/applicant/documents?apply=${parsed}`)`. Task 12's Documents page reads `?apply=` and calls `setMyPreferredJobOpening` once on mount, then removes the param with `router.replace("/applicant/documents")`. This keeps a mutation out of a GET server render.

`applications/page.tsx`: the `?jobId=` redirect now targets `/applicant/documents?apply=${parsedJobId}`.

`public-job-detail.tsx`: no change to the signed-in href, since `/applicant/apply/{id}` now redirects. Confirm the existing test still passes.

Delete `applicant-apply-workspace.tsx`, `applicant-application-form.tsx` and their tests. Run `rg -n "applicant-apply-workspace|applicant-application-form" src e2e` and expect no hits.

- [ ] **Step 4: Run tests and the type check**

Run: `npx vitest run src && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: remember the posting chosen before registering and apply from the Documents page"
```

---

### Task 8: Applicant login and register screens (`loginapp.html`)

**Files:**
- Create: `src/components/auth/applicant-auth-frame.tsx` + test, `src/components/recruitment/privacy-sections.tsx`, `src/components/auth/privacy-policy-dialog.tsx` + test, `src/lib/recruitment/recruitment-notice.ts` + test
- Modify: `src/app/(auth)/login/page.tsx`, `src/components/auth/login-form.tsx`, `src/app/(auth)/applicant/register/page.tsx`, `src/components/auth/applicant-registration-form.tsx` (classes only), `src/components/recruitment/apply-privacy-notice.tsx` (import sections)
- Test: `src/app/(auth)/login/page.test.tsx`, `src/components/auth/login-form.test.tsx`, `src/app/(auth)/applicant/register/page.test.tsx`

**Interfaces:**
- Produces:
  - `ApplicantAuthFrame({ children, notice }: { children: ReactNode; notice: RecruitmentNotice })`
  - `type RecruitmentNotice = { title: string } | null`
  - `getRecruitmentNotice(): Promise<RecruitmentNotice>` (server)

- [ ] **Step 1: Write failing tests**

`src/lib/recruitment/recruitment-notice.test.ts`: mock `@/lib/supabase/server` so `from("job_openings").select().eq().or().order().limit().maybeSingle()` resolves `{ data: { title: "Patrolman / Patrolwoman (Cycle 2026)" } }`, and assert `getRecruitmentNotice()` resolves `{ title: "Patrolman / Patrolwoman (Cycle 2026)" }`. Add a second case where it resolves `{ data: null }` → `null`.

`applicant-auth-frame.test.tsx`:

```tsx
it("shows the open recruitment and the station branding", () => {
  render(<ApplicantAuthFrame notice={{ title: "Patrolman / Patrolwoman (Cycle 2026)" }}><p>form</p></ApplicantAuthFrame>);
  expect(screen.getByText("SAN JUAN CITY POLICE STATION")).toBeInTheDocument();
  expect(screen.getByText("To Serve and Protect.")).toBeInTheDocument();
  expect(screen.getByText(/Current Hiring Pool for/)).toHaveTextContent("Current Hiring Pool for Patrolman / Patrolwoman (Cycle 2026) is now open for verified candidates.");
  expect(screen.getByRole("link", { name: "Help Desk" })).toHaveAttribute("href", "/#contact");
  expect(screen.getByRole("button", { name: "Privacy Policy" })).toBeInTheDocument();
});

it("says when there is no active recruitment", () => {
  render(<ApplicantAuthFrame notice={null}><p>form</p></ApplicantAuthFrame>);
  expect(screen.getByText("There is no active recruitment at the moment. Please check back for new openings.")).toBeInTheDocument();
});
```

`login-form.test.tsx` (applicant mode):

```tsx
it("asks applicants for their email address and offers Remember me", () => {
  render(<LoginForm mode="applicant" nextPath="/" />);
  expect(screen.getByLabelText("Email Address")).toHaveAttribute("type", "email");
  expect(screen.getByRole("checkbox", { name: "Remember me on this device" })).toBeChecked();
  expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
});
```

Update `login/page.test.tsx`:
- The applicant heading is now "Login as Applicant" with the "Applicant Portal" pill text.
- Keep the employee-mode assertions unchanged; the employee login is not redesigned in this PR.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/auth src/lib/recruitment/recruitment-notice.test.ts "src/app/(auth)"`
Expected: FAIL.

- [ ] **Step 3: Implement**

`recruitment-notice.ts`:

```ts
import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type RecruitmentNotice = { title: string } | null;

/** The newest open posting, shown as the login page's Recruitment Notice. */
export async function getRecruitmentNotice(): Promise<RecruitmentNotice> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("job_openings")
    .select("title")
    .eq("status", "published")
    .or(`closes_on.is.null,closes_on.gte.${today}`)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.title ? { title: data.title } : null;
}
```

If `server-only` isn't installed (`rg -n '"server-only"' package.json`), omit that import line. Don't add a dependency.

`privacy-sections.tsx`: move the `SECTIONS` array and the intro paragraph out of `apply-privacy-notice.tsx` as `export const PRIVACY_INTRO` and `export const PRIVACY_SECTIONS`. `apply-privacy-notice.tsx` imports them; its behaviour is unchanged.

`privacy-policy-dialog.tsx`: a `@base-ui/react/dialog` Root whose Trigger is a `button` labelled "Privacy Policy" (class `hover:text-white transition-colors`). The popup shows `PRIVACY_INTRO` and `PRIVACY_SECTIONS` and has a single **Close** button. Reuse `apply-privacy-notice.tsx`'s Popup/Backdrop classes.

`applicant-auth-frame.tsx`: port `docs/design/capstone-ui/loginapp.html` lines 15–209 (from `<body>` to the end of the card) to JSX. The `children` slot replaces the form block, lines 39–115 (the APPLICANT PORTAL pill through the Sign up line stay in `LoginForm`/page).
- Outer wrapper: `<main className="flex min-h-svh items-center justify-center bg-slate-900 p-4 sm:p-6 lg:p-8">`.
- Card: `className="grid w-full max-w-[1024px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl lg:h-[620px] lg:grid-cols-12"`. The mockup's fixed `w-[1024px] h-[620px]` applies at `lg` only, so phones stack.
- Left column: `lg:col-span-5 …`, keeping the mockup's classes. Right column: `lg:col-span-7 …`, keeping its classes. Below `lg` the right column shows after the form, with `min-h-[420px]`.
- Background image: `<Image src="/login-hero.jpg" alt="" fill className="z-0 object-cover opacity-20" sizes="(min-width:1024px) 600px, 100vw" />` replaces the inline `background-image`.
- Logo tile: replace `fa-shield-halved` with `<Image src="/san-juan-police-logo.png" alt="San Juan City Police Station logo" width={40} height={40} className="size-10 object-contain" />` in the same `w-12 h-12 rounded-xl …` tile. The mobile header (`lg:hidden`) uses the logo the same way.
- Recruitment Notice body: `notice ? <>Current Hiring Pool for <strong>{notice.title}</strong> is now open for verified candidates.</> : "There is no active recruitment at the moment. Please check back for new openings."`.
- Footer: `© {new Date().getFullYear()} San Juan City Police Station`, then `<PrivacyPolicyDialog />`, `<span>•</span>`, `<Link href="/#contact">Help Desk</Link>`.

`login-form.tsx`, applicant mode (employee mode keeps its current markup exactly):
- Port lines 49–115 of `loginapp.html`.
- **Email:** the input gets `id="login-identifier" name="identifier" type="email" autoComplete="email"`, with the label text "Email Address" (`htmlFor="login-identifier"`) and the `Mail` icon.
- **Password:** reuse `PasswordInput` if it can take the mockup's classes through a `className` prop (read `src/components/auth/password-input.tsx`); otherwise inline an input with a show/hide button whose `aria-label` is "Show password"/"Hide password".
- **Forgot password:** "Forgot password?" links to `/forgot-password`.
- **Remember me:** `<input type="checkbox" id="remember" name="remember" defaultChecked className="…mockup classes…" />` with label "Remember me on this device".
- **Login button:** the mockup classes; text `pending ? "Signing in…" : "Login"`, with no arrow.
- **Notice and error:** these render above the email field. Notice: `rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800`, `role="status"`. Error: `rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700`, `role="alert"`.

`login/page.tsx`:
- When `mode === "applicant"`, `const notice = await getRecruitmentNotice();` and render `<ApplicantAuthFrame notice={notice}>` around:
  - the pill (`Applicant Portal`), `<h1>` "Login as Applicant" (use `h1` for the page title; keep the mockup classes), and the subtitle
  - `<LoginForm mode="applicant" …/>`
  - "Don't have an applicant account? **Sign up**" (`registerHref`), then "Station personnel? Login as Employee" (`text-[11px] text-slate-400`, kept for navigation)
  - the left-column footer note "San Juan City PNP Online Recruitment & Applicant Portal System"
- Employee mode renders exactly as today.

`register/page.tsx` + form:
- Wrap in `ApplicantAuthFrame` with the same notice. The left column shows the pill "Applicant Portal", `<h1>` "Create Applicant Account", the subtitle "Register to apply for the current recruitment.", then `ApplicantRegistrationForm`, then "Already have an account? **Login**".
- In the form, change `inputClassName` to the mockup input classes: `w-full px-4 py-2.5 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-transparent transition-all placeholder:text-slate-400 aria-invalid:border-red-500`.
- Change the submit button to the mockup Login button classes with text "Register".
- The left column needs `overflow-y-auto` at `lg`, because registration is taller than 620px.

- [ ] **Step 4: Run the tests, then look at it**

Run: `npx vitest run src/components/auth src/lib/recruitment "src/app/(auth)" && npm run typecheck && npm run lint`
Then `npm run dev`. Open `/login?as=applicant` and `/applicant/register` at 1280px and 390px and compare them side by side with `docs/design/capstone-ui/loginapp.html` opened in the browser. Fix any visible differences in spacing, colour or text.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: applicant login and register match the Capstone UI login design"
```

---

### Task 9: Applicant shell: sidebar, top bar, notification panel, account menu, toasts

**Files:**
- Create: `src/components/app-shell/notification-drawer.tsx` + test, `src/components/app-shell/applicant-account-menu.tsx` + test, `src/components/app-shell/applicant-toaster.tsx` + test
- Modify: `src/lib/app/role-config.ts`, `src/lib/app/role-config.test.ts`, `src/components/app-shell/app-shell.tsx`, `src/components/app-shell/app-shell.test.tsx`, `src/app/(app)/layout.tsx`, `src/app/jobs/layout.tsx`

**Interfaces:**
- Consumes:
  - `useNotifications`, `useUnreadNotificationCount`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`, `useDeleteNotification`, `useDeleteAllNotifications`
  - `useApplicantProfile` (for name)
- Produces:
  - `AppShell({ children, config, email })` (same props)
  - `notifyApplicant({ title, description, tone }: { title: string; description?: string; tone?: "success" | "warning" | "error" })`
  - `<ApplicantToaster />`

- [ ] **Step 1: Write failing tests**

`role-config.test.ts`:

```ts
it("gives applicants only the four portal pages", () => {
  expect(getRoleConfig("applicant").navigation.map((item) => item.label)).toEqual(["Dashboard", "Profile", "Documents", "Application Status"]);
});
```

`notification-drawer.test.tsx`: mock `@/hooks/use-notifications`.

```tsx
const rows = [
  { id: "n1", title: "Physical Agility Test Scheduled", body: "You have been moved to Stage 2.", link: "/applicant/applications", read_at: null, created_at: new Date(Date.now() - 10 * 60_000).toISOString(), type: "application_status_updated", recipient_user_id: "u" },
  { id: "n2", title: "Welcome", body: "Account registered.", link: null, read_at: "2026-10-10T00:00:00Z", created_at: "2026-10-10T00:00:00Z", type: "system", recipient_user_id: "u" },
];

it("opens from the bell with All and Unread tabs", async () => {
  render(<NotificationDrawer />);
  await userEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));
  const panel = screen.getByRole("dialog", { name: "Notifications" });
  expect(within(panel).getByText("1 Unread")).toBeInTheDocument();
  expect(within(panel).getAllByRole("listitem")).toHaveLength(2);
  await userEvent.click(within(panel).getByRole("tab", { name: "Unread" }));
  expect(within(panel).getAllByRole("listitem")).toHaveLength(1);
});

it("marks read, deletes, marks all read and clears all", async () => {
  render(<NotificationDrawer />);
  await userEvent.click(screen.getByRole("button", { name: /Notifications/ }));
  await userEvent.click(screen.getByRole("button", { name: "Mark Physical Agility Test Scheduled as read" }));
  expect(markRead).toHaveBeenCalledWith("n1");
  await userEvent.click(screen.getByRole("button", { name: "Delete Welcome" }));
  expect(deleteOne).toHaveBeenCalledWith("n2");
  await userEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
  expect(markAll).toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(clearAll).toHaveBeenCalled();
});

it("shows the empty state and closes on Escape", async () => {
  rowsMock.mockReturnValue([]);
  render(<NotificationDrawer />);
  await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
  expect(screen.getByText("No notifications available")).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog", { name: "Notifications" })).not.toBeInTheDocument();
});

it("links to the full list when there are more than shown", async () => {
  countMock.mockReturnValue(25);
  render(<NotificationDrawer />);
  await userEvent.click(screen.getByRole("button", { name: /Notifications/ }));
  expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/notifications");
});
```

`applicant-account-menu.test.tsx`:

```tsx
it("shows the applicant and offers Profile and Logout", async () => {
  render(<ApplicantAccountMenu email="aldrick.jamlani@gmail.com" name="Aldrick Jamlani" />);
  await userEvent.click(screen.getByRole("button", { name: "Account menu for Aldrick Jamlani" }));
  expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute("href", "/applicant/profile");
  await userEvent.click(screen.getByRole("menuitem", { name: "Logout" }));
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
});
```

`app-shell.test.tsx`: update it to expect:
- four nav links
- no "Sign out" button in the sidebar
- the brand texts "SAN JUAN CITY POLICE STATION", "Recruitment Division", "MENU" and "PNP San Juan Recruitment Portal"
- the breadcrumb "Applicant" › current page

`applicant-toaster.test.tsx`: render `<ApplicantToaster />`, call `notifyApplicant({ title: "Document Deleted", description: "CV / Resume has been removed." })`, and assert both texts appear inside an element with `role="status"`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/app-shell src/lib/app`
Expected: FAIL.

- [ ] **Step 3: Implement**

`role-config.ts`, applicant navigation:

```ts
navigation: [
  { href: "/applicant", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/applicant/profile", label: "Profile", icon: "ContactRound" },
  { href: "/applicant/documents", label: "Documents", icon: "FileText" },
  { href: "/applicant/applications", label: "Application Status", icon: "Clock" },
],
```

`app-shell.tsx`: rewrite it to port `docs/design/capstone-ui/notifapp.html` lines 63–117 (sidebar) and 124–296 (header). Keep these structural pieces from the current file:
- the shadcn `SidebarProvider`/`Sidebar collapsible="offcanvas"`/`SidebarTrigger`, which gives the mobile off-canvas and overlay
- the skip link
- the `id="main-content"` region
- `activeNavigationItem`

Restyle as follows:
- **Sidebar:** `className="border-r border-slate-200 bg-white"`. Header: logo (`size-16`) + `<h2 className="…mockup classes…">SAN JUAN CITY POLICE STATION</h2>` + `Recruitment Division`. Group label "Menu" with the mockup's `text-[10px] font-bold uppercase tracking-widest text-slate-400`.
- **Nav items:** the mockup button classes. Active is `bg-slate-900 text-white shadow-md`; inactive is `text-slate-600 hover:bg-slate-100 hover:text-slate-900`. Use the lucide icons from `NAVIGATION_ICONS`.
- **Footer:** `<p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-center">PNP San Juan Recruitment Portal</p>`. Remove `SignOutButton`.
- **Header:** `bg-slate-900` with the mockup's height and padding. Keep `SidebarTrigger` with the `PanelLeft` icon; its label is "Toggle sidebar". Breadcrumb: "Applicant" + `ChevronRight` + the page label in white. Right side: `<NotificationDrawer />` and `<ApplicantAccountMenu email={email} name={fullName} />`. `fullName` comes from `useApplicantProfile()` as `${first_name} ${last_name}`, falling back to the email.
- **Main area:** `bg-slate-50`, the mockup's `p-6 lg:p-8`, `max-w-6xl`.
- Mount `<ApplicantToaster />` once inside the shell.

`notification-drawer.tsx`: port lines 143–261 of `notifapp.html`.
- **Trigger:** a `button` with `aria-label={count ? \`Notifications, ${count} unread\` : "Notifications"}`, `aria-expanded` and `aria-haspopup="dialog"`, and the red count badge when `count > 0`.
- **Panel:** a `div role="dialog" aria-label="Notifications"` absolutely positioned like the mockup (`absolute right-0 mt-2 w-80 sm:w-96 …`). Focus moves to the panel heading on open and returns to the bell on close. Escape and an outside `pointerdown` close it.
- **Header:** `NOTIFICATIONS` + `{unread} Unread` pill + close `X` button (`aria-label="Close notifications"`).
- **Tabs:** `role="tablist"` with two `role="tab"` buttons, All and Unread (`aria-selected`).
- **List:** `<ul>` of up to 20 rows from `useNotifications({ pageSize: 20 })`. Each row:
  - a dot (`bg-blue-500` unread, `bg-slate-300` read) and the title
  - relative time, via a local `timeAgo(iso)` helper: "now", "{n}m ago", "{n}h ago", "{n}d ago"
  - the body
  - when `link`, a `<Link href={link}>` "View details" that closes the panel
  - icon buttons with `aria-label` "Mark {title} as read" (only when unread) and "Delete {title}"
- **Empty state:** "No notifications available".
- **Footer:** "Mark all as read" and a red "Clear all". Clear all confirms with `window.confirm("Clear all notifications?")`. When `count > rows.length`, add a "View all" link to `/notifications`.

`applicant-account-menu.tsx`: port lines 263–296.
- **Trigger:** a `button` with `aria-label="Account menu for {name}"`, an initials avatar `bg-blue-600 text-white` (first letters of the first two words of `name`), the name, the email and a `ChevronDown`.
- **Menu:** use the existing `DropdownMenu` primitives from `@/components/ui/dropdown-menu`, which already handle Escape, outside click and focus. Items:
  - `DropdownMenuItem render={<Link href="/applicant/profile" />}` "Profile" with the `User` icon.
  - "Logout" (red, `LogOut` icon): calls `createBrowserSupabaseClient().auth.signOut({ scope: "local" })`, then `clearSessionOnlyCookie()`, `router.replace("/")` and `router.refresh()`.

`applicant-toaster.tsx`:

```tsx
"use client";

import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, toast } from "sonner";

const tones = {
  success: { Icon: CircleCheck, ring: "bg-emerald-500/15 text-emerald-400" },
  warning: { Icon: TriangleAlert, ring: "bg-amber-500/15 text-amber-400" },
  error: { Icon: CircleX, ring: "bg-red-500/15 text-red-400" },
} as const;

/** The applicant portal's notices: dark cards in the top-right corner (Capstone UI documents.html / profile.html toast). */
export function ApplicantToaster() {
  return <Sonner position="top-right" toastOptions={{ unstyled: true }} />;
}

export function notifyApplicant({ title, description, tone = "success" }: { title: string; description?: string; tone?: keyof typeof tones }) {
  const { Icon, ring } = tones[tone];
  toast.custom(() => (
    <div className="flex w-80 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white shadow-2xl" role={tone === "error" ? "alert" : "status"}>
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${ring}`}><Icon aria-hidden="true" className="size-4" /></span>
      <div className="min-w-0">
        <p className="text-xs font-bold">{title}</p>
        {description ? <p className="mt-0.5 text-[11px] text-slate-300">{description}</p> : null}
      </div>
    </div>
  ));
}
```

Check the toast markup against `docs/design/capstone-ui/documents.html` lines 76–86 and match its classes exactly.

`(app)/layout.tsx` and `jobs/layout.tsx`: no prop changes. Confirm the `/notifications` page still renders inside `AppShell` for applicants; the full list stays reachable.

- [ ] **Step 4: Run the tests, then look at it**

Run: `npx vitest run src/components/app-shell src/lib/app && npm run typecheck && npm run lint`
Then use `npm run dev`. Sign in with the demo applicant: `demo.applicant@example.test`, password `DemoPass!2026`. Compare the shell with `notifapp.html` at 1280px and 390px.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: applicant shell with the notification panel and account menu from the Capstone UI"
```

---

### Task 10: Dashboard (`notifapp.html` tab 1)

**Files:**
- Create: `src/lib/recruitment/applicant-progress.ts` + test
- Modify: `src/components/recruitment/applicant-dashboard.tsx` + test

**Interfaces:**
- Produces, from `applicant-progress.ts`:
  - `STAGE_SHORT_LABELS: Record<PipelineStage, string>`: "Application Submission", "Physical Agility Test", "Physical & Medical Exam", "Neuro-Psychiatric Exam", "Drug Test", "Background Investigation", "Panel Interview", "Final Evaluation"
  - `stageProgress(status: ApplicationStatus | null): number`: 0 when null, `index + 1` within the pipeline, 8 for Shortlisted/Hired/Not Selected
  - `nextAction(application: Pick<Application, "status" | "stage_result" | "stage_scheduled_at" | "stage_venue"> | null): { title: string; detail: string; href: string }`

- [ ] **Step 1: Write failing tests**

`applicant-progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextAction, stageProgress } from "./applicant-progress";

describe("applicant progress", () => {
  it("counts the stage reached", () => {
    expect(stageProgress(null)).toBe(0);
    expect(stageProgress("Application Submission")).toBe(1);
    expect(stageProgress("Physical Agility Test")).toBe(2);
    expect(stageProgress("Hired")).toBe(8);
  });

  it("asks for documents before an application exists", () => {
    expect(nextAction(null)).toEqual({ title: "Upload your required documents", detail: "Upload all five documents, then press Save to submit your application.", href: "/applicant/documents" });
  });

  it("shows a scheduled stage with its date, time and venue", () => {
    expect(nextAction({ status: "Physical Agility Test", stage_result: "scheduled", stage_scheduled_at: "2026-10-17T22:00:00Z", stage_venue: "Grandstand Sports Complex" }))
      .toEqual({ title: "Physical Agility Test Attendance", detail: "Scheduled on October 18, 2026 (6:00 AM) at Grandstand Sports Complex.", href: "/applicant/applications" });
  });

  it("falls back to the stage's message", () => {
    expect(nextAction({ status: "Drug Test", stage_result: "pending", stage_scheduled_at: null, stage_venue: null }).detail).toBe("You are now scheduled for the drug test.");
  });
});
```

The time must be formatted in `Asia/Manila`, e.g. `new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })`. Use `formatDate` for the date part, after first converting to the Manila calendar date.

`applicant-dashboard.test.tsx`: replace its assertions to cover three states.
- **No application:**
  - "Welcome, Aldrick!"
  - "Latest application" card showing "Pending" and "0 / 8"
  - "Documents" card showing "3 of 5"
  - "Next Action Required" showing "Upload your required documents"
  - "RECRUITMENT PROCESS" with 8 list items, including "Background Investigation"
  - no "Job openings" text
- **Active application:** the stage name, "2 / 8" and "View application status →" linking to `/applicant/applications`.
- **Scheduled:** "Scheduled on October 18, 2026 (6:00 AM) at Grandstand Sports Complex."

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/recruitment/applicant-progress.test.ts src/components/recruitment/applicant-dashboard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Write `applicant-progress.ts`. It reuses `PIPELINE_STAGES`, and the `reviewDetails` map from `application-status-tracker.tsx`: move that map into `applicant-progress.ts` as `STAGE_MESSAGES` and import it back into the tracker. Next-action titles:
- `"{status} Attendance"` when scheduled and the stage is a test or exam
- `"{status}"` otherwise
- "Application under review" for Application Submission
- for Shortlisted/Hired/Not Selected, the tracker's final detail text

Rewrite `applicant-dashboard.tsx` by porting `notifapp.html` lines 301–468, without the qualifications card (it's absent from the PDF screenshot on p. 5):
- **Header:** "Welcome, {first_name}!" and "Monitor your application progress and manage your documentary requirements for CY {current year} Recruitment."
- **Card 1:** eyebrow `"{job title (uppercase)} – CY {year of submitted_at}"`, title = latest status (or "Pending"), and an emerald pill `"{stageProgress} / 8"`. The footer link is "View application status →" to `/applicant/applications`.
- **Card 2:** `"{uploaded} of 5"`, "Required documents uploaded and verified." (when 5), else "Upload your remaining required documents.", and "Manage documents →".
- **Card 3:** amber border, `nextAction(...)`, and "View Schedule Details →" to `href`.
- **Recruitment process:** two `<ol>` columns (1–4, 5–8) using `STAGE_SHORT_LABELS`.
- **Latest application progress:** the timeline with the mockup's markup.
  - Done steps get a green `CircleCheck` and "Completed & Verified on {formatDate(date)}." The date is the history entry where `next_status` left that stage. The dashboard needs the history, so add `useMyApplicationHistory(applicationId)`, which reads `application_status_history` for that id ordered by `created_at`, to `use-applicant-portal.ts` and a matching query in `queries/applicant-portal.ts`.
  - The current step is amber, with its `STAGE_MESSAGES` text.
  - Upcoming steps are slate-300, with "Pending {previous stage short label} evaluation." for the next one and "Scheduled upon medical clearance." only where the mockup has it. Otherwise upcoming steps have no detail line.
  - Show at most the current step + 2 upcoming steps, as in the mockup (4 rows total).
  - Before an application exists, show the first step as current with "Upload your required documents to start."

- [ ] **Step 4: Run the tests, then look at it**

Run: `npx vitest run src/lib/recruitment src/components/recruitment/applicant-dashboard.test.tsx && npm run typecheck`
Compare against the PDF p. 5 screenshot and `notifapp.html` in the browser.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: applicant dashboard matches the Capstone UI dashboard"
```

---

### Task 11: Profile (`profile.html`)

**Files:**
- Modify: `src/components/recruitment/applicant-profile-form.tsx` + test, `src/components/recruitment/applicant-profile-photo-control.tsx` + test, `src/app/(app)/applicant/profile/page.tsx`, `src/schemas/applicant-portal.ts`

**Interfaces:**
- Consumes: `notifyApplicant` (Task 9), `formatApplicantNumber` (Task 4).
- Produces: `RELIGION_OPTIONS` exported from `src/schemas/applicant-portal.ts`.

- [ ] **Step 1: Write failing tests**

In `applicant-profile-form.test.tsx`:

```tsx
it("shows Pending until HR accepts the application", async () => {
  profileMock.mockReturnValue({ ...applicant, applicant_number: null });
  render(<ApplicantProfileForm />);
  const box = await screen.findByText("Applicant Number");
  expect(box.parentElement).toHaveTextContent("Pending");
  expect(screen.getByText("Issued once HR accepts your application")).toBeInTheDocument();
});

it("keeps an applicant number from before this change", async () => {
  profileMock.mockReturnValue({ ...applicant, applicant_number: 202613 });
  render(<ApplicantProfileForm />);
  expect(await screen.findByText("2-02613")).toBeInTheDocument();
});

it("offers the religion list and keeps a typed religion that is not in it", async () => {
  profileMock.mockReturnValue({ ...applicant, religion: "Aglipayan" });
  render(<ApplicantProfileForm />);
  const select = await screen.findByLabelText(/Religion/);
  expect(within(select).getByRole("option", { name: "Iglesia ni Cristo (INC)" })).toBeInTheDocument();
  expect(select).toHaveValue("Aglipayan");
});

it("confirms a save with the Profile Updated notice", async () => {
  render(<ApplicantProfileForm />);
  await userEvent.click(await screen.findByRole("button", { name: "Save Changes & Update Profile" }));
  await waitFor(() => expect(notifyApplicant).toHaveBeenCalledWith({ title: "Profile Updated Successfully!", description: "Your personal and academic details have been saved." }));
});
```

Mock `@/components/app-shell/applicant-toaster` with `notifyApplicant: vi.fn()`. Adapt the `profileMock`/`applicant` names to the file's existing fixtures.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/recruitment/applicant-profile-form.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`applicant-portal.ts`: add

```ts
export const RELIGION_OPTIONS = ["Roman Catholic", "Islam", "Iglesia ni Cristo (INC)", "Christian", "Seventh-Day Adventist", "Baptist", "Jehovah's Witnesses", "Others"] as const;
```

The `religion` schema stays `requiredText(120, …)`.

`applicant-profile-form.tsx`: port `profile.html` lines 523–802.
- **Header card (526–566):** the gradient container and the photo ring. Restyle `ApplicantProfilePhotoControl` to a `variant="ring"` that renders the mockup's 2×2 box with a camera `label` button (`aria-label="Upload 2x2 ID picture"`); keep its existing upload/remove logic and tests. Then:
  - the full name `<h1>` (the page title; remove `PageHeader` from `profile/page.tsx`)
  - the red required pill, shown only when `!profile_image_path`
  - the **Applicant Number** box: `formatApplicantNumber(n) ?? "Pending"`, plus the helper "Issued once HR accepts your application" when null
- **Section I (571–670):** the navy header (`bg-slate-900` + `IdCard` icon chip + "I. PERSONAL INFORMATION" + "* Required fields"), then the 3-column grid of the existing fields.
  - Labels follow the mockup's casing: "Last Name", "First Name", "Middle Name", "Qualifier / Extension", "Date of Birth", "Place of Birth", "Citizenship", "Gender", "Civil Status", "Religion", "Mobile Number", "Email Address", "Home Address". Required fields show a red `*`.
  - **Religion** is a `<select>` of `RELIGION_OPTIONS`, plus the saved value as an extra option when it isn't in the list.
  - Keep `react-hook-form` registration and validation messages as they are.
- **Section II (673–790):** four sub-cards. Primary (`School`, teal), Secondary (`Landmark`, teal), Tertiary (`GraduationCap`, blue), Graduate (`Award`, amber, "OPTIONAL" tag), mapped to the `elementary`/`secondary`/`college`/`graduate` levels.
  - Field labels follow the mockup per level: "Name of School"/"Course Completed"/"Year Graduated"/"Location"; "Name of School"/"Course / Strand"/…; "Name of Institution"/"Degree / Course"/…; "Name of Institution"/"Degree / Program"/"Year Graduated / Units"/"Location".
  - Placeholders also come from the mockup.
- **Save (792–801):** the right-aligned `bg-blue-600` button with the `Save` icon and "Save Changes & Update Profile". On success, call `notifyApplicant({ title: "Profile Updated Successfully!", description: "Your personal and academic details have been saved." })`. On failure, call `notifyApplicant({ title: "Profile not saved", description: message, tone: "error" })` and keep the inline `ErrorState`.
- Delete the local `formatApplicantNumber`; import it from `@/lib/recruitment/applicant-number`.

Update every existing test in the file whose label text changed, e.g. "Last name" → "Last Name".

- [ ] **Step 4: Run tests, then look at it**

Run: `npx vitest run src/components/recruitment && npm run typecheck`
Compare against PDF pp. 8–10 and `profile.html`.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: applicant profile matches the Capstone UI profile page"
```

---

### Task 12: Documents (`documents.html`) with submit-on-save

**Files:**
- Modify: `src/components/recruitment/applicant-profile-documents.tsx` + test, `src/app/(app)/applicant/documents/page.tsx`

**Interfaces:**
- Consumes: `useSubmitMyApplication`, `setMyPreferredJobOpening` (Task 4), `notifyApplicant` (Task 9).
- Produces: `ApplicantProfileDocuments({ applyJobId }: { applyJobId?: number | null })`.

- [ ] **Step 1: Write failing tests**

Replace the behaviour tests in `applicant-profile-documents.test.tsx`; keep the file-validation tests. Mock `notifyApplicant`, `useSubmitMyApplication` and `setMyPreferredJobOpening`.

```tsx
it("uploads a chosen file straight away and confirms it", async () => {
  render(<ApplicantProfileDocuments />);
  await userEvent.upload(screen.getByLabelText("Upload CV / Resume"), new File(["%PDF"], "cv.pdf", { type: "application/pdf" }));
  expect(save).toHaveBeenCalledWith({ resume: expect.any(File) });
  await waitFor(() => expect(notifyApplicant).toHaveBeenCalledWith({ title: "Saved Successfully!", description: "Your document status has been updated." }));
});

it("asks before deleting and confirms the deletion", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<ApplicantProfileDocuments />);
  await userEvent.click(screen.getByRole("button", { name: "Delete CV / Resume" }));
  expect(window.confirm).toHaveBeenCalledWith("Are you sure you want to delete your uploaded CV / Resume?");
  await waitFor(() => expect(notifyApplicant).toHaveBeenCalledWith({ title: "Document Deleted", description: "CV / Resume has been removed." }));
});

it("shows the server's reason when a document cannot be deleted", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  remove.mockRejectedValue(new Error("Upload a replacement instead."));
  render(<ApplicantProfileDocuments />);
  await userEvent.click(screen.getByRole("button", { name: "Delete CV / Resume" }));
  await waitFor(() => expect(notifyApplicant).toHaveBeenCalledWith({ title: "Document not deleted", description: "Upload a replacement instead.", tone: "error" }));
});

it("asks for the missing documents on Save", async () => {
  documentsMock.mockReturnValue(threeOfFive);
  render(<ApplicantProfileDocuments />);
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(notifyApplicant).toHaveBeenCalledWith({ title: "Please upload required documents", description: "Still needed: Eligibility Certificate, College Diploma & TOR.", tone: "warning" });
  expect(submit).not.toHaveBeenCalled();
});

it("submits the application on Save once all five are on file", async () => {
  submit.mockResolvedValue({ outcome: "submitted", applicationId: "a1" });
  render(<ApplicantProfileDocuments />);
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(notifyApplicant).toHaveBeenCalledWith({ title: "All Documents Saved!", description: "Your files have been saved to your portal." }));
});

it("does not submit again when an application is active", async () => {
  submit.mockResolvedValue({ outcome: "already-active" });
  render(<ApplicantProfileDocuments />);
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(notifyApplicant).toHaveBeenCalledWith({ title: "All Documents Saved!", description: "Your files have been saved to your portal." }));
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
});

it("explains when there is no open recruitment", async () => {
  submit.mockResolvedValue({ outcome: "no-open-posting" });
  render(<ApplicantProfileDocuments />);
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(notifyApplicant).toHaveBeenCalledWith({ title: "All Documents Saved!", description: "Your documents are saved. There is no open recruitment right now.", tone: "warning" }));
});

it("remembers the posting the applicant clicked Apply on", async () => {
  render(<ApplicantProfileDocuments applyJobId={12} />);
  await waitFor(() => expect(setPreferred).toHaveBeenCalledWith(12));
});
```

`threeOfFive` and the label constants: use `APPLICANT_PROFILE_DOCUMENT_KINDS` and rename the labels there in Step 3 to the mockup's names: "CV / Resume", "PSA Birth Certificate", "2×2 ID Picture", "Eligibility Certificate", "College Diploma & TOR". Then update `src/lib/recruitment/required-documents.test.ts` and any HR test that asserts the old labels. Run `rg -n "PSA birth certificate|2x2 picture|Diploma\"" src`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/recruitment/applicant-profile-documents.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Port `documents.html` lines 140–346 (header, grid, cards, Save button). Use the same card markup for all five kinds:
- **Header:** the "REQUIREMENTS VERIFICATION" pill, `<h1>Required Documents</h1>` (remove `PageHeader` from the page) and the mockup sentence. The Status box shows `"{saved} of 5"` and an emerald bar with `style={{ width: \`${(saved / 5) * 100}%\` }}`.
- **Card heading:** label (uppercase via the mockup classes) + red `*`. Show the emerald "Saved" pill when on file.
- **Format line:** PDF kinds show "Format: PDF only (Max 10 MB)". The photo shows "Format: PNG or JPEG only". Eligibility shows "Format: PDF only (NAPOLCOM / CSC)". Diploma shows "Format: PDF only (Diploma and TOR)".
- **File row (when on file):** a red PDF tile (`FileText`) or a blue image tile (`Image`), the file name, `"Saved {formatDate(updated_at)} • {formatSize(size_bytes)}"`, and an eye button (`aria-label="View {label}"`) that opens the signed URL as today.
- **Upload:** a `<label>` styled as the mockup's "Upload Document"/"Upload Photo" button, wrapping a visually hidden `<input type="file" accept={accept} aria-label="Upload {label}" />`. On change: validate with `profileDocumentFileSchemaFor`, then `save.mutateAsync({ [kind]: file })` right away. On success show `notifyApplicant({ title: "Saved Successfully!", description: "Your document status has been updated." })`; on a validation or upload error show an error notice with the message. Remove the old pending/"Selected:"/beforeunload machinery; there are no unsaved picks any more.
- **Delete:** the mockup's red button (`aria-label="Delete {label}"`), disabled when nothing is on file. It runs `window.confirm(\`Are you sure you want to delete your uploaded ${label}?\`)` and then the remove mutation. Success: `Document Deleted` / `{label} has been removed.`. Failure: `Document not deleted` / message / `error`.
- **Save:** the full-width dark "Save" button (`aria-label` "Save") at the bottom, as in the mockup. Logic:

```ts
async function saveAll() {
  const status = requiredDocumentStatus(documents.data);
  if (!status.complete) {
    notifyApplicant({ title: "Please upload required documents", description: `Still needed: ${status.missing.map(({ label }) => label).join(", ")}.`, tone: "warning" });
    return;
  }
  try {
    const result = await submit.mutateAsync();
    if (result.outcome === "no-open-posting") notifyApplicant({ title: "All Documents Saved!", description: "Your documents are saved. There is no open recruitment right now.", tone: "warning" });
    else notifyApplicant({ title: "All Documents Saved!", description: "Your files have been saved to your portal." });
  } catch (cause) {
    notifyApplicant({ title: "Application not submitted", description: cause instanceof Error ? cause.message : "Please try again.", tone: "error" });
  }
}
```

The Save button is disabled while `submit.isPending`. This, plus the server-side "already applied" guard, prevents double submits.

- **Apply link:** when `applyJobId` is set, a `useEffect` with a ref guard runs once: `setMyPreferredJobOpening(applyJobId)`, then `router.replace("/applicant/documents")`. Errors show `notifyApplicant({ title: "Posting unavailable", description: message, tone: "warning" })`.

`documents/page.tsx`: `export default async function Page({ searchParams }) { const { apply } = await searchParams; const id = Number(apply); return <ApplicantProfileDocuments applyJobId={Number.isInteger(id) && id > 0 ? id : null} />; }`

- [ ] **Step 4: Run tests, then look at it**

Run: `npx vitest run src && npm run typecheck && npm run lint`
Compare against PDF pp. 11–13 and `documents.html`.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: documents page matches the Capstone UI and Save submits the application"
```

---

### Task 13: Application Status page

**Files:**
- Create: `src/components/recruitment/applicant-status-card.tsx` + test
- Modify: `src/app/(app)/applicant/applications/page.tsx`, `src/app/(app)/applicant/applications/[applicationId]/page.tsx` + `src/app/(app)/applicant/applications/page.test.tsx`
- Delete: `src/components/recruitment/applicant-application-status.tsx`, `src/components/recruitment/applicant-application-detail.tsx` (+ tests), once `rg` shows no importers

**Interfaces:**
- Consumes: `useMyApplicationStatuses`, `useMyApplicationHistory` (Task 10), `nextAction`, `STAGE_MESSAGES`.

- [ ] **Step 1: Write failing tests**

`applicant-status-card.test.tsx`:

```tsx
it("shows the next action, its schedule and HR's remarks", () => {
  applications.mockReturnValue([{ id: "a1", status: "Physical Agility Test", stage_result: "scheduled", stage_scheduled_at: "2026-10-17T22:00:00Z", stage_venue: "San Juan Grandstand Sports Complex" }]);
  history.mockReturnValue([
    { previous_status: "Physical Agility Test", next_status: "Physical Agility Test", note: "Proper Attire: White Plain T-Shirt, Navy Blue Shorts, Running Shoes.", result: null, created_at: "2026-10-11T00:00:00Z" },
    { previous_status: "Physical Agility Test", next_status: "Physical Agility Test", note: "Bring 2 hard copies of your Applicant Admission Slip.", result: "scheduled", created_at: "2026-10-11T01:00:00Z" },
  ]);
  render(<ApplicantStatusCard />);
  expect(screen.getByRole("heading", { name: "Application Status" })).toBeInTheDocument();
  expect(screen.getByText("Next Action Required: Physical Agility Test")).toBeInTheDocument();
  expect(screen.getByText("Reporting time: 6:00 AM on October 18, 2026 at San Juan Grandstand Sports Complex.")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "Proper Attire: White Plain T-Shirt, Navy Blue Shorts, Running Shoes.",
    "Bring 2 hard copies of your Applicant Admission Slip.",
  ]);
});

it("explains the pending state before an application exists", () => {
  applications.mockReturnValue([]);
  render(<ApplicantStatusCard />);
  expect(screen.getByText("Your application is pending. Upload all required documents and press Save to submit it.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Go to Documents" })).toHaveAttribute("href", "/applicant/documents");
});

it("shows the final result", () => {
  applications.mockReturnValue([{ id: "a1", status: "Not Selected", stage_result: "pending", stage_scheduled_at: null, stage_venue: null }]);
  history.mockReturnValue([]);
  render(<ApplicantStatusCard />);
  expect(screen.getByText("Thank you for applying. You were not selected for this opening.")).toBeInTheDocument();
});

it("says when HR has not added remarks", () => {
  applications.mockReturnValue([{ id: "a1", status: "Drug Test", stage_result: "pending", stage_scheduled_at: null, stage_venue: null }]);
  history.mockReturnValue([]);
  render(<ApplicantStatusCard />);
  expect(screen.getByText("No remarks from HR yet.")).toBeInTheDocument();
});
```

Remarks are history rows where `previous_status === next_status === current status` with a non-empty `note`, oldest first.

Update `applications/page.test.tsx` so `?jobId=12` redirects to `/applicant/documents?apply=12`. Add a test that `[applicationId]/page.tsx` redirects to `/applicant/applications`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/recruitment/applicant-status-card.test.tsx "src/app/(app)/applicant"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Port `notifapp.html` lines 537–564:
- **Card:** a white `rounded-xl` card with `<h1>Application Status</h1>`.
- **Banner:** the amber banner with the `Bell` icon. Title: `Next Action Required: {status}`. Detail: `Reporting time: {time} on {date} at {venue}.` when scheduled; otherwise `STAGE_MESSAGES[status]`.
- **Remarks:** a divider, the "REMARKS" heading and a `<ul className="list-disc pl-5 …">` of remarks.
- **Pending state (no application):** the same card with a slate banner, the pending sentence and a "Go to Documents" link.
- **Hired / Not Selected / Shortlisted:** the banner turns emerald or red, with the tracker's final detail text.

`applications/page.tsx`: render `<ApplicantStatusCard />` without a `PageHeader`.

`[applicationId]/page.tsx`: `redirect("/applicant/applications")`.

Delete the old components and tests only after `rg -n "applicant-application-status|applicant-application-detail" src` returns no imports. `applied-job-summary.tsx` stays if HR still uses it; check with `rg`.

- [ ] **Step 4: Run tests and the type check**

Run: `npx vitest run src && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: application status page matches the Capstone UI"
```

---

### Task 14: HR schedule inputs

**Files:**
- Modify: `src/components/recruitment/stage-dialogs.tsx` + test

**Interfaces:**
- Consumes: `StageResultInput.scheduledAt`/`venue` (Task 4).

- [ ] **Step 1: Write the failing test**

Add to `stage-dialogs.test.tsx`, and update the first existing test's expectation to include `scheduledAt: null, venue: undefined`:

```tsx
it("records the date, time and venue when scheduling", async () => {
  mocks.record.mockResolvedValue(undefined);
  render(<StageResultDialog applicationId={id} onOpenChange={() => undefined} open result="scheduled" status="Physical Agility Test" />);
  const dialog = screen.getByRole("dialog", { name: "Mark Physical Agility Test as Scheduled" });
  await userEvent.type(within(dialog).getByLabelText("Date and time"), "2026-10-18T06:00");
  await userEvent.type(within(dialog).getByLabelText("Venue"), "Grandstand Sports Complex");
  await userEvent.click(within(dialog).getByRole("button", { name: "Mark as Scheduled" }));
  expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ scheduledAt: "2026-10-17T22:00:00.000Z", venue: "Grandstand Sports Complex" }));
});
```

The `datetime-local` value is Manila time. Convert it with a helper, `manilaLocalToIso("2026-10-18T06:00")` → `"2026-10-17T22:00:00.000Z"`, implemented as `new Date(\`${value}:00+08:00\`).toISOString()`. Unit-test it in the same file.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/recruitment/stage-dialogs.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `StageResultDialog`, when `result === "scheduled"`, render two `FormField`s above the note, both optional and reset on open with the other fields:
- **Date and time:** `<Input type="datetime-local" id="stage-scheduled-at">`, description "Philippine time."
- **Venue:** `<Input id="stage-venue" maxLength={200}>`.

Pass `scheduledAt: scheduledAtValue ? manilaLocalToIso(scheduledAtValue) : null, venue: venue.trim() || undefined` to `record.mutateAsync`. Export `manilaLocalToIso` from `src/lib/format-date.ts`, which is where date helpers live.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/recruitment && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: HR can set the date, time and venue when scheduling a stage"
```

---

### Task 15: Confirmation email template

**Files:**
- Create: `supabase/templates/confirmation.html`
- Modify: `supabase/config.toml`

- [ ] **Step 1: Write the template**

Port `docs/design/capstone-ui/email.html` into `supabase/templates/confirmation.html`. Keep its inline styles; move any `<style>` rules into inline `style=""` attributes, because email clients drop `<style>`. Then:
- **Logo:** replace the seal placeholder (lines 112–118) with `<img src="{{ .SiteURL }}/san-juan-police-logo.png" alt="San Juan City Police Station" width="64" height="64" style="display:block;margin:0 auto;">`.
- **Registration details box (lines 128–134):** keep only `Registered Email: {{ .Email }}`. Delete the "Applicant No" line.
- **Button href and fallback URL text:** both become `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&flow=signup`.
- Keep the footer and the "ignore this email" note verbatim.

- [ ] **Step 2: Wire it into the local config**

In `supabase/config.toml`, under the commented invite template block, add:

```toml
[auth.email.template.confirmation]
subject = "Confirm Your Email Address"
content_path = "./supabase/templates/confirmation.html"
```

- [ ] **Step 3: Verify locally**

Run `npx supabase stop && npx supabase start`. It must start without config errors. Local `enable_confirmations = false`, so no email is sent. Then open `supabase/templates/confirmation.html` in a browser and compare it with `email.html` by eye.

- [ ] **Step 4: Commit**

```bash
git add supabase/templates/confirmation.html supabase/config.toml
git commit -m "feat: confirmation email in the Capstone UI design, using a token_hash link"
```

---

### Task 16: End-to-end tests and visual baselines

**Files:**
- Modify: `e2e/demo-accounts.ts`, `e2e/capstone-objectives.spec.ts`, `e2e/role-access.spec.ts`, `e2e/responsive-layout.spec.ts`, `e2e/applicant-visual-baseline.spec.ts`, and the snapshot PNGs under `e2e/applicant-visual-baseline.spec.ts-snapshots/`

- [ ] **Step 1: Update the helpers**

`demo-accounts.ts`:
- The applicant identifier becomes the email `demo.applicant@example.test`.
- `fillLogin` uses the label `mode === "applicant" ? "Email Address" : "Badge Number"`.
- Update the doc comment: applicants sign in with their email.

- [ ] **Step 2: Update the journeys**

- **`capstone-objectives.spec.ts` (Objective 2):**
  - Register.
  - Assert the profile shows "Pending" for the applicant number.
  - Upload the five documents on `/applicant/documents`; each upload shows "Saved Successfully!".
  - Press **Save** and expect "All Documents Saved!".
  - As HR, mark Application Submission **Passed**.
  - As the applicant, sign in **with email** and assert the profile now shows a `\d-\d{5,}` number and the bell has a "Your applicant number" notification.
  - Remove the old `/jobs` → apply steps.
- **`role-access.spec.ts`:** the invalid-credentials case types an email.
- **`responsive-layout.spec.ts`:** keep the applicant pages and add `/login?as=applicant`. There must be no horizontal scroll at 390px.

- [ ] **Step 3: Run the e2e suite locally**

Run: `npx supabase db reset && npm run test:e2e`
Expected: PASS, except the visual-baseline screenshots that changed, which are regenerated next.

- [ ] **Step 4: Regenerate the visual baselines**

- Add `/login?as=applicant` to the full-page screenshot list in `applicant-visual-baseline.spec.ts`.
- **Windows PNGs:** `npx playwright test e2e/applicant-visual-baseline.spec.ts --update-snapshots`.
- **Linux PNGs:** follow the established container procedure:
  1. Build against local Supabase.
  2. Run `npm run start -- --hostname 0.0.0.0 --port 3000`.
  3. Use a temporary config with `baseURL: http://host.docker.internal:3000` and no webServer.
  4. Run `MSYS_NO_PATHCONV=1 docker run --rm --add-host=host.docker.internal:host-gateway -v C:/Users/ASUS/hris-capstone:/work -w /work -e CI=1 mcr.microsoft.com/playwright:v1.63.0-noble node node_modules/@playwright/test/cli.js test --config=<tmp> e2e/applicant-visual-baseline.spec.ts --update-snapshots`.
- **Style JSON:** commit the regenerated `*-styles-*.json` only for applicant routes whose styles really changed (all `/applicant/*`, `/login?as=applicant`, `/applicant/register`). Keep the existing JSON for `/` and `/jobs`. If the container's JSON differs from the old one only in the fifth decimal of `lab()` values, keep the old file.
- Delete the temporary config.

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "test: e2e journeys and visual baselines for the redesigned applicant portal"
```

---

### Task 17: Full verification and PR

- [ ] **Step 1: Run everything**

```bash
npm run lint && npm run typecheck && npm run test:run && npx supabase db reset && npx supabase test db && npm run test:e2e
```

Expected: all green. If anything fails, fix it in the task it belongs to and re-run.

- [ ] **Step 2: Final visual pass**

With `npm run dev`, open each applicant screen next to its mockup at 1280px and 390px:
- login
- register
- dashboard
- notification panel
- account menu
- profile
- documents
- status

Fix any remaining differences.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/capstone-ui-applicant
gh pr create --base main --title "Capstone UI: applicant portal redesign" --body-file <tmp file>
```

The PR body contains:
- **Summary:** screens redone, flow changes, and the decisions from the spec table.
- **Manual steps after merge and deploy:**
  1. Push the migrations `20261011090001` and `20261011090002` to live Supabase.
  2. In the Supabase Dashboard → Authentication → Email Templates → **Confirm signup**: subject "Confirm Your Email Address", body = `supabase/templates/confirmation.html`.
  3. Under Authentication → URL Configuration, make sure the redirect allow-list includes `https://<prod-domain>/auth/callback**`.
- **Test evidence:** the command outputs.
- The line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 4: Hand off**

Give the user the PR link, the manual steps, and a ready-to-paste prompt for **PR 2 (HR)**, as described in spec §4.
