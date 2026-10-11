# Capstone UI: HR Side Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every HR screen match the Capstone UI mockups 1:1 and apply the HR notes from `Final Changes (1).pdf` (pp. 16–37):
- a new Admin & HR login with an enforced Access Level
- a new staff shell with logout in the profile menu and a bell panel
- in-place panels instead of separate pages
- documents on Eligibility and Certification / Training
- the Kiosk page removed

**Architecture:**
- **Shell:** a new role-neutral `StaffShell` (`src/components/staff-shell/`) wraps HR routes only. `WorkspaceShell` stays for Employee, Management and SysAd.
- **Screens:** redesigned HR screens are new components carrying the mockups' literal Tailwind classes inside `.capstone-ui`. They are built from a small set of shared primitives (modal, slide-over, table card, pills, inputs). Panels are driven by URL search params, and old routes redirect to those URLs.
- **Unredesigned pages:** pages without a mockup render inside a `.workspace` wrapper, so they look as before.
- **Database:** two migrations: certification documents, and a read-only `get_hr_dashboard_overview` RPC.

**Tech Stack:**
- Next.js 16.3 App Router. Read `node_modules/next/dist/docs/` before using any Next API.
- React 19, Tailwind v4, `@base-ui/react` 1.7 (dialogs/menus), TanStack Query 5, sonner 2, zod 4, lucide-react.
- Supabase (Postgres, pgTAP, Storage).
- Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-capstone-ui-hr-design.md`. Read it before starting any task. Section numbers below (§) refer to it.

## Global Constraints

- **Branch and migrations:** `feat/capstone-ui-hr`, one PR into `main`. Never push migrations to live Supabase.
- **Mockups:** the source of truth is `docs/design/capstone-ui/`. Copy markup and Tailwind classes literally; replace only sample data with real data. Copy text verbatim unless the spec gives other wording.
- **Icons:** `lucide-react` in place of Font Awesome:

| Font Awesome | lucide |
|---|---|
| shield-halved | the logo image |
| chart-pie | `ChartPie` |
| briefcase | `Briefcase` |
| id-card-clip | `IdCard` |
| users | `Users` |
| map-location-dot | `MapPinned` |
| calendar-check | `CalendarCheck` |
| award | `Award` |
| clock / clock-rotate-left | `Clock` / `History` |
| file-invoice | `FileText` |
| bullhorn | `Megaphone` |
| bell | `Bell` |
| magnifying-glass | `Search` |
| chevron-down / left / right | `ChevronDown` / `ChevronLeft` / `ChevronRight` |
| plus | `Plus` |
| eye | `Eye` |
| pen-to-square | `SquarePen` |
| trash-can | `Trash2` |
| xmark | `X` |
| check | `Check` |
| file-signature | `FileSignature` |
| list-check | `ListChecks` |
| circle-info | `Info` |
| circle-check | `CircleCheck` |
| thumbs-up | `ThumbsUp` |
| folder-open | `FolderOpen` |
| camera | `Camera` |
| file-import | `FileUp` |
| id-card | `IdCard` |
| triangle-exclamation | `TriangleAlert` |
| expand | `Expand` |
| user-clock | `UserRoundSearch` |
| arrow-right-to-bracket / arrow-right-from-bracket | `LogIn` / `LogOut` |
| building-shield | `Building2` |
| user-shield | `ShieldUser` |
| user-plus / user-check / user-xmark | `UserPlus` / `UserCheck` / `UserX` |
| chart-line | `ChartLine` |
| print | `Printer` |
| download | `Download` |
| file-excel | `FileSpreadsheet` |
| filter | `Funnel` |
| arrow-down-up | `ArrowUpDown` |
| arrow-down | `ArrowDown` |
| location-dot | `MapPin` |
| sliders | `SlidersHorizontal` |
| address-card | `Contact` |
| mars / venus | `Mars` / `Venus` |
| layer-group | `Layers` |
| baby | `Baby` |
| children | `Users` |
| notes-medical | `Stethoscope` |
| star | `Star` |
| paper-plane | `Send` |
| lock | `Lock` |

- **Logo:** `/san-juan-police-logo.png` via `next/image` wherever a mockup shows the shield.
- **Fonts:** Inter is already global; do not add fonts.
- **Contrast:** grey caption text on light backgrounds uses **slate-500**, not the mockups' slate-400. The axe gate in `e2e/iso25010-quality.spec.ts` fails otherwise. slate-400 is fine for icons and on dark backgrounds.
- **Text floor:** HR screens may go down to **9px** (`text-[9px]`). Nothing smaller.
- **Dates and times:**
  - Dates are in words via `src/lib/format-date.ts`: `formatDate` ("October 18, 2026"), `formatDateTime`, `formatDateRange`.
  - The mockup's short form "Oct 5, 2026" is not used; use `formatDate`.
  - Attendance clock times are 24-hour `HH:mm`, Asia/Manila.
- **Roles:** no new roles.
- **Toasts:** use `notifyStaff()` (Task 5) in place of every mockup `alert()`.
- **Accessibility:**
  - Every control is keyboard-reachable, has an accessible name and has visible focus.
  - Modals and slide-overs trap focus, close on Escape, the close button and overlay click, and return focus to their trigger.
- **Commits:** end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Memory-constrained machine:**
  - Run Vitest on the files you touched (`npx vitest run <paths>`), never the whole suite until Task 21.
  - Run e2e per spec file against `next start --hostname 127.0.0.1` with a no-webServer config (Task 19).
  - Run `npx supabase db reset` before `npx supabase test db`.

## Review Focus

1. **Access Level vs the real role.** An HR account choosing System Administrator, or a SysAd account choosing HR Admin, must be signed out and told why. It must never land on `/unauthorized` with a live session. Pinned in Task 3.
2. **A stale or foreign id in a panel URL.** `?review=<id>`, `?edit=<id>`, `?view=<id>` or `?review=<employeeId>` pointing at a missing, already-decided or other-status record must show a clear message inside the panel, or close it. It must never crash or open an empty form that saves junk. Pinned in Tasks 12, 13, 14, 15, 18.
3. **Replacing a document uploaded by another HR user.** Replace and Remove must work across HR users (the widened delete policy). A failed row update must not leave the old file deleted or the new one orphaned. Pinned in Tasks 1 and 11.
4. **Announcement markup safety.** A body containing `<script>`, `javascript:` links, unbalanced markers or `**` alone must render as literal text, never as HTML or a dead link. Old plain posts must render exactly as before. Pinned in Task 17.
5. **Double submission.** Pressing Approve, Save, Submit Endorsement or Save document twice quickly must not send two RPCs. Every primary button disables while its mutation is pending. Pinned in Tasks 11, 12, 13, 14, 18.

---

## File Structure

**New, shared (staff shell):**
- `src/components/staff-shell/staff-shell.tsx`: the HR frame (sidebar, top bar, bell, account menu, toaster, scope wrapper).
- `src/components/staff-shell/staff-nav-badge.tsx`: the mockup-style nav count.
- `src/components/staff-shell/page-meta.ts`: `staffPageSubtitle(pathname)` and `isRedesignedStaffRoute(pathname)`.
- `src/components/staff-shell/staff-notify.tsx`: `notifyStaff`, `StaffToaster` (thin re-exports of the #78 toaster).
- `src/components/staff-shell/ui/staff-modal.tsx`: centred modal.
- `src/components/staff-shell/ui/staff-slide-over.tsx`: right panel.
- `src/components/staff-shell/ui/staff-table-card.tsx`: header bar, table wrapper, pager footer.
- `src/components/staff-shell/ui/status-pill.tsx`
- `src/components/staff-shell/ui/staff-fields.tsx`: `StaffInput`, `StaffSelect`, `StaffTextarea`, `StaffLabel`.
- `src/components/staff-shell/ui/initials-avatar.tsx`
- `src/components/staff-shell/ui/page-title.tsx`
- `src/hooks/use-panel-param.ts`: read and write one URL search param for panel state.
- `src/lib/auth/staff-display-name.ts`: "PMAJ M. C. Balneg" formatting and a server lookup.
- `src/components/app-shell/capstone-account-menu.tsx`: the account menu shared by the applicant and staff shells.

**New, screens:**
- `src/components/staff-dashboard/hr-dashboard-overview.tsx` (+ `distribution-card.tsx`, `pipeline-columns.tsx`, `attendance-doughnut.tsx`)
- `src/components/recruitment/staff-job-postings.tsx`
- `src/components/recruitment/staff-applicant-roster.tsx`
- `src/components/personnel-records/document-upload-dialog.tsx`, `src/components/personnel-records/record-document-row.tsx`
- `src/components/deployment-tracking/staff-deployments.tsx`, `src/components/deployment-tracking/deployment-panel.tsx`
- `src/components/leave-management/staff-leave.tsx`, `leave-review-modal.tsx`, `leave-details-modal.tsx`, `leave-policy-modal.tsx`
- `src/components/promotion-eligibility/staff-promotions.tsx`, `criteria-slide-over.tsx`, `promotion-review-modal.tsx`
- `src/components/attendance-integration/staff-attendance.tsx`, `attendance-record-modal.tsx`, `attendance-kiosk-overlay.tsx`
- `src/components/reporting/staff-reports.tsx`, `report-generate-modal.tsx`, `src/lib/reporting/masterlist.ts`
- `src/components/public-site/staff-announcements.tsx`, `announcement-modal.tsx`, `markup-toolbar.tsx`
- `src/lib/public-site/announcement-markup.ts`
- `src/lib/personnel/rank-category.ts`
- `src/lib/staff/status-maps.ts`: label and tone maps for leave, deployment, attendance, application and promotion statuses.
- `src/components/auth/admin-auth-hero.tsx`: the hero copy for `sample.html`.

**New, database:**
- `supabase/migrations/20261011120001_certification_documents.sql` + `supabase/tests/certification_documents.test.sql`
- `supabase/migrations/20261011120002_hr_dashboard_overview.sql` + `supabase/tests/hr_dashboard_overview.test.sql`

**Modified (main ones):**
- `src/app/(app)/layout.tsx`
- `src/lib/app/role-config.ts`, `src/components/workspace-shell/nav-icons.ts`
- `src/app/(auth)/login/page.tsx`, `src/components/auth/login-form.tsx`, `src/components/auth/applicant-auth-frame.tsx`
- `src/app/auth/login/route.ts`, `src/app/auth/continue/route.ts`, `src/schemas/auth.ts`
- `src/components/app-shell/notification-drawer.tsx`, `applicant-account-menu.tsx`
- HR `page.tsx` files listed per task
- `src/queries/personnel-records.ts`, `src/hooks/use-personnel-records.ts`
- `src/components/personnel-records/employee-record-detail.tsx`, `record-entry-form.tsx`
- `src/lib/recruitment/application-list.ts`, `src/components/recruitment/hr-registered-applicants.tsx`
- `src/components/public-site/announcement-body.tsx`, landing announcement components
- `src/components/reporting/report-detail.tsx`
- e2e specs and `e2e/demo-accounts.ts`

---

### Task 1: Certification documents (database)

**Files:**
- Create: `supabase/migrations/20261011120001_certification_documents.sql`
- Create: `supabase/tests/certification_documents.test.sql`

**Interfaces:**
- Produces:
  - `public.certifications.document_path | document_name | document_mime_type | document_size_bytes`, all nullable and all-or-none.
  - Path pattern: `certifications/<employee uuid>/<file>`.
  - Storage: HR can insert `certifications/…` objects and delete any `personnel-documents` object. Reads reuse `personnel_documents_read`.

- [ ] **Step 1: Write the failing pgTAP test**

`supabase/tests/certification_documents.test.sql`:

```sql
begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(11);

select extensions.has_column('public', 'certifications', 'document_path', 'Certification / Training keeps a document');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000003101', 'authenticated', 'authenticated', 'cert-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000003102', 'authenticated', 'authenticated', 'cert-hr2@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000003103', 'authenticated', 'authenticated', 'cert-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000003104', 'authenticated', 'authenticated', 'cert-other@example.test', now(), now());
update public.user_roles set role = case
    when user_id in ('00000000-0000-4000-8000-000000003101'::uuid, '00000000-0000-4000-8000-000000003102'::uuid) then 'hr_personnel'::public.app_role
    else 'employee'::public.app_role end
where user_id in ('00000000-0000-4000-8000-000000003101'::uuid, '00000000-0000-4000-8000-000000003102'::uuid, '00000000-0000-4000-8000-000000003103'::uuid, '00000000-0000-4000-8000-000000003104'::uuid);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on, gender)
values
  ('00000000-0000-4000-8000-000000003111', '00000000-0000-4000-8000-000000003103', 'CRT-001', 'Cert', 'Officer', 'cert-employee@example.test', '2024-01-01', 'female'),
  ('00000000-0000-4000-8000-000000003112', '00000000-0000-4000-8000-000000003104', 'CRT-002', 'Other', 'Officer', 'cert-other@example.test', '2024-01-01', 'male');

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata) values
  ('00000000-0000-4000-8000-000000003181', 'personnel-documents', 'certifications/00000000-0000-4000-8000-000000003111/psbrc.pdf', '00000000-0000-4000-8000-000000003101', '00000000-0000-4000-8000-000000003101', '{"mimetype":"application/pdf","size":100}'::jsonb);

select extensions.throws_ok(
  $$insert into public.certifications (employee_id, name, issued_on, document_path, document_name)
    values ('00000000-0000-4000-8000-000000003111', 'Public Safety Basic Recruit Course (PSBRC)', '2016-03-14', 'certifications/00000000-0000-4000-8000-000000003111/psbrc.pdf', 'psbrc.pdf')$$,
  '23514', null, 'A certification document needs all four document fields'
);
select extensions.throws_ok(
  $$insert into public.certifications (employee_id, name, issued_on, document_path, document_name, document_mime_type, document_size_bytes)
    values ('00000000-0000-4000-8000-000000003111', 'Public Safety Basic Recruit Course (PSBRC)', '2016-03-14', 'certifications/00000000-0000-4000-8000-000000003111/missing.pdf', 'missing.pdf', 'application/pdf', 100)$$,
  '22023', 'The supporting document was not uploaded.', 'The document must exist in storage'
);
select extensions.throws_ok(
  $$insert into public.certifications (employee_id, name, issued_on, document_path, document_name, document_mime_type, document_size_bytes)
    values ('00000000-0000-4000-8000-000000003112', 'Public Safety Basic Recruit Course (PSBRC)', '2016-03-14', 'certifications/00000000-0000-4000-8000-000000003111/psbrc.pdf', 'psbrc.pdf', 'application/pdf', 100)$$,
  '22023', 'The supporting document was not uploaded.', 'The document must sit in the same employee''s folder'
);
select extensions.lives_ok(
  $$insert into public.certifications (employee_id, name, issued_on, document_path, document_name, document_mime_type, document_size_bytes)
    values ('00000000-0000-4000-8000-000000003111', 'Public Safety Basic Recruit Course (PSBRC)', '2016-03-14', 'certifications/00000000-0000-4000-8000-000000003111/psbrc.pdf', 'psbrc.pdf', 'application/pdf', 100)$$,
  'A certification is saved with its document'
);
select extensions.lives_ok(
  $$insert into public.certifications (employee_id, name, issued_on) values ('00000000-0000-4000-8000-000000003111', 'Criminal Investigation Course (CIC)', '2018-05-01')$$,
  'A certification without a document is still valid'
);

-- Storage policies, exercised as real users.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003101';
select extensions.lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('personnel-documents', 'certifications/00000000-0000-4000-8000-000000003111/cic.pdf', '00000000-0000-4000-8000-000000003101')$$,
  'HR uploads a certification document'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003103';
select extensions.throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('personnel-documents', 'certifications/00000000-0000-4000-8000-000000003111/self.pdf', '00000000-0000-4000-8000-000000003103')$$,
  '42501', null, 'An employee cannot upload certification documents'
);
select extensions.is(
  (select count(*) from storage.objects where bucket_id = 'personnel-documents' and name like 'certifications/00000000-0000-4000-8000-000000003111/%'),
  2::bigint, 'The employee can read their own certification documents'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003104';
select extensions.is(
  (select count(*) from storage.objects where bucket_id = 'personnel-documents'),
  0::bigint, 'Another employee cannot see them'
);

-- Direct SQL deletes are blocked by Supabase Storage; its API deletes under these policies.
set local role postgres;
select extensions.is(
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE' and policyname = 'personnel_documents_delete_hr'),
  1::bigint, 'Any HR user can remove personnel documents (Replace / Remove across HR users)'
);

select * from extensions.finish();

rollback;
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx supabase db reset && npx supabase test db`
Expected: `certification_documents.test.sql` FAILS (`document_path` column missing). Every other test passes.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261011120001_certification_documents.sql`:

```sql
-- Capstone UI HR redesign (PDF p. 23): Certification / Training entries carry one uploaded document, like Eligibility.

alter table public.certifications
  add column document_path text unique check (document_path is null or document_path ~ '^certifications/[0-9a-fA-F-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$'),
  add column document_name text check (document_name is null or (document_name = btrim(document_name) and char_length(document_name) between 1 and 255)),
  add column document_mime_type text check (document_mime_type is null or document_mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  add column document_size_bytes integer check (document_size_bytes is null or document_size_bytes between 1 and 10485760),
  add constraint certifications_document_complete check ((document_path is null) = (document_name is null) and (document_path is null) = (document_mime_type is null) and (document_path is null) = (document_size_bytes is null));

create policy personnel_documents_upload_hr_certifications
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'personnel-documents'
    and (storage.foldername(name))[1] = 'certifications'
    and array_length(storage.foldername(name), 1) = 2
    and (select private.current_user_has_role('hr_personnel'::public.app_role))
  );

-- Replace / Remove must work when a different HR user uploaded the file.
create policy personnel_documents_delete_hr
  on storage.objects for delete to authenticated
  using (bucket_id = 'personnel-documents' and (select private.current_user_has_role('hr_personnel'::public.app_role)));

create function private.check_certification_document()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.document_path is not null
    and new.document_path is distinct from (case when tg_op = 'UPDATE' then old.document_path end)
    and (
      split_part(new.document_path, '/', 2) <> new.employee_id::text
      or not exists (select 1 from storage.objects where bucket_id = 'personnel-documents' and name = new.document_path)
    )
  then
    raise exception 'The supporting document was not uploaded.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.check_certification_document() from public, anon, authenticated;

create trigger certifications_check_document
  before insert or update of document_path on public.certifications
  for each row execute function private.check_certification_document();
```

The existing `personnel_documents_read` policy already covers both prefixes, because it checks folder 2 against the employee id.

- [ ] **Step 4: Run the database tests**

Run: `npx supabase db reset && npx supabase test db`
Expected: all pass, including `certification_documents.test.sql` (11 assertions) and the unchanged `proof_uploads.test.sql`.

- [ ] **Step 5: Update the generated types and commit**

Add the four fields to `Certification` in `src/lib/types/database.ts`, matching the `Qualification` type's document fields:

```ts
  document_path: string | null;
  document_name: string | null;
  document_mime_type: "application/pdf" | "image/png" | "image/jpeg" | "image/webp" | null;
  document_size_bytes: number | null;
```

Run: `npm run typecheck` (expect PASS).

```bash
git add supabase/migrations/20261011120001_certification_documents.sql supabase/tests/certification_documents.test.sql src/lib/types/database.ts
git commit -m "feat(db): certification / training entries carry an uploaded document

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: HR dashboard overview RPC (database + query)

**Files:**
- Create: `supabase/migrations/20261011120002_hr_dashboard_overview.sql`
- Create: `supabase/tests/hr_dashboard_overview.test.sql`
- Modify: `src/schemas/reporting.ts`, `src/queries/reporting.ts`, `src/hooks/use-reporting.ts`
- Test: `src/queries/reporting.test.ts` (create if absent)

**Interfaces:**
- Produces:
  - SQL `public.get_hr_dashboard_overview() returns jsonb`, returning `{ personnelByRank: [{code, name, count}], personnelByGender: [{label, count}], attendanceToday: {present, late, incomplete, absent, onLeave} }`.
  - TS `hrDashboardOverviewSchema`, `type HrDashboardOverview`.
  - `getHrDashboardOverview(): Promise<HrDashboardOverview>`.
  - `useHrDashboardOverview()`.

- [ ] **Step 1: Write the failing pgTAP test**

`supabase/tests/hr_dashboard_overview.test.sql`:

```sql
begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(7);

select extensions.has_function('public', 'get_hr_dashboard_overview', array[]::text[], 'HR has a dashboard overview RPC');

-- Isolate from seed data: only these employees are active during the test.
update public.employees set employment_status = 'retired';

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000003201', 'authenticated', 'authenticated', 'overview-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000003202', 'authenticated', 'authenticated', 'overview-employee@example.test', now(), now());
update public.user_roles set role = case user_id when '00000000-0000-4000-8000-000000003201'::uuid then 'hr_personnel'::public.app_role else 'employee'::public.app_role end
where user_id in ('00000000-0000-4000-8000-000000003201'::uuid, '00000000-0000-4000-8000-000000003202'::uuid);

insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on, gender, rank_id, employment_status)
values
  ('00000000-0000-4000-8000-000000003211', 'OVR-001', 'Ana', 'Major', 'ovr1@example.test', '2020-01-01', 'female', (select id from public.ranks where code = 'PMAJ'), 'active'),
  ('00000000-0000-4000-8000-000000003212', 'OVR-002', 'Ben', 'Patrol', 'ovr2@example.test', '2020-01-01', 'male', (select id from public.ranks where code = 'PAT'), 'active'),
  ('00000000-0000-4000-8000-000000003213', 'OVR-003', 'Cy', 'Patrol', 'ovr3@example.test', '2020-01-01', 'male', (select id from public.ranks where code = 'PAT'), 'active'),
  ('00000000-0000-4000-8000-000000003214', 'OVR-004', 'Di', 'Civilian', 'ovr4@example.test', '2020-01-01', null, null, 'active');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003201';

select extensions.is(
  (select jsonb_agg(item ->> 'code') from jsonb_array_elements(public.get_hr_dashboard_overview() -> 'personnelByRank') item),
  '["PMAJ", "PAT", null]'::jsonb,
  'Ranks are ordered highest first, with unranked personnel last'
);
select extensions.is(
  (select (item ->> 'count')::int from jsonb_array_elements(public.get_hr_dashboard_overview() -> 'personnelByRank') item where item ->> 'code' = 'PAT'),
  2, 'Rank counts are per rank'
);
select extensions.is(
  public.get_hr_dashboard_overview() -> 'personnelByGender',
  '[{"label": "male", "count": 2}, {"label": "female", "count": 1}, {"label": "unspecified", "count": 1}]'::jsonb,
  'Gender counts cover male, female and unspecified'
);
select extensions.ok(
  (public.get_hr_dashboard_overview() -> 'attendanceToday') ?& array['present', 'late', 'incomplete', 'absent', 'onLeave'],
  'Today''s attendance has every bucket'
);
select extensions.is(
  (public.get_hr_dashboard_overview() -> 'attendanceToday' ->> 'present')::int, 0, 'No one has a log yet today'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003202';
select extensions.throws_ok($$select public.get_hr_dashboard_overview()$$, '42501', null, 'Only HR can read the overview');

select * from extensions.finish();

rollback;
```

Before running, check that ranks with codes `PMAJ` and `PAT` exist in the seeded catalogue: `grep -n "'PMAJ'\|'PAT'" supabase/migrations/*ranks*.sql supabase/seed.sql`. If `PAT` is named differently (e.g. `PATROLMAN`), use the catalogue's code in both the insert and the expected array.

- [ ] **Step 2: Run it to see it fail**

Run: `npx supabase db reset && npx supabase test db`
Expected: `hr_dashboard_overview.test.sql` FAILS (function missing).

- [ ] **Step 3: Write the migration**

First read `private.require_active_hr()` in `supabase/migrations/20260823162829_leave_management.sql:91` to confirm it raises `42501` for non-HR callers.

```sql
-- Capstone UI HR dashboard (dashboard.html): rank and gender distribution and today's attendance split.
create or replace function private.get_hr_dashboard_overview()
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare
  manila_today date := (now() at time zone 'Asia/Manila')::date;
begin
  perform private.require_active_hr();
  return jsonb_build_object(
    'personnelByRank', coalesce((
      select jsonb_agg(jsonb_build_object('code', grouped.code, 'name', grouped.name, 'count', grouped.total) order by grouped.sort_key, grouped.code)
      from (
        select rank.code, rank.name, coalesce(rank.sort_order, 2147483647) as sort_key, count(*) as total
        from public.employees employee
        left join public.ranks rank on rank.id = employee.rank_id
        where employee.employment_status = 'active'
        group by rank.code, rank.name, rank.sort_order
      ) grouped
    ), '[]'::jsonb),
    'personnelByGender', (
      select jsonb_agg(jsonb_build_object('label', bucket.label, 'count', (
        select count(*) from public.employees employee
        where employee.employment_status = 'active' and coalesce(employee.gender, 'unspecified') = bucket.label
      )) order by bucket.sort_key)
      from (values ('male', 1), ('female', 2), ('unspecified', 3)) as bucket(label, sort_key)
    ),
    'attendanceToday', jsonb_build_object(
      'present', (select count(*) from public.attendance_logs where attendance_date = manila_today and status = 'present'),
      'late', (select count(*) from public.attendance_logs where attendance_date = manila_today and status = 'late'),
      'incomplete', (select count(*) from public.attendance_logs where attendance_date = manila_today and status = 'incomplete'),
      'onLeave', (select count(*) from public.employees employee where employee.employment_status = 'active'
        and exists (select 1 from public.leave_requests leave_request where leave_request.employee_id = employee.id and leave_request.status = 'approved' and manila_today between leave_request.starts_on and leave_request.ends_on)),
      'absent', (select count(*) from public.employees employee where employee.employment_status = 'active'
        and (employee.employment_started_on is null or employee.employment_started_on <= manila_today)
        and not exists (select 1 from public.attendance_logs log where log.employee_id = employee.id and log.attendance_date = manila_today)
        and not exists (select 1 from public.leave_requests leave_request where leave_request.employee_id = employee.id and leave_request.status = 'approved' and manila_today between leave_request.starts_on and leave_request.ends_on))
    )
  );
end;
$$;

create or replace function public.get_hr_dashboard_overview()
returns jsonb language plpgsql security definer stable set search_path = '' as $$
begin
  return private.get_hr_dashboard_overview();
end;
$$;

revoke all on function private.get_hr_dashboard_overview() from public, anon, authenticated;
revoke all on function public.get_hr_dashboard_overview() from public, anon;
grant execute on function public.get_hr_dashboard_overview() to authenticated;
```

If `private.require_active_hr()` is declared `volatile` and Postgres rejects `perform` inside a `stable` function, drop `stable` from both functions.

- [ ] **Step 4: Run the database tests**

Run: `npx supabase db reset && npx supabase test db`
Expected: all pass.

- [ ] **Step 5: Write the failing query test**

`src/queries/reporting.test.ts` (add a `describe` if the file exists):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ rpc }) }));

import { getHrDashboardOverview } from "./reporting";

describe("getHrDashboardOverview", () => {
  beforeEach(() => rpc.mockReset());

  it("parses the overview", async () => {
    rpc.mockResolvedValue({ data: {
      personnelByRank: [{ code: "PMAJ", name: "Police Major", count: 1 }, { code: null, name: null, count: 4 }],
      personnelByGender: [{ label: "male", count: 20 }, { label: "female", count: 8 }, { label: "unspecified", count: 0 }],
      attendanceToday: { present: 25, late: 1, incomplete: 1, absent: 0, onLeave: 1 },
    }, error: null });
    const overview = await getHrDashboardOverview();
    expect(rpc).toHaveBeenCalledWith("get_hr_dashboard_overview");
    expect(overview.personnelByRank[1]).toEqual({ code: null, name: null, count: 4 });
    expect(overview.attendanceToday.present).toBe(25);
  });

  it("throws the server's message", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Only HR personnel can do this." } });
    await expect(getHrDashboardOverview()).rejects.toThrow("Only HR personnel can do this.");
  });
});
```

Run: `npx vitest run src/queries/reporting.test.ts`. Expected: FAIL (export missing).

- [ ] **Step 6: Implement**

`src/schemas/reporting.ts`, append:

```ts
const countSchema = z.number().int().nonnegative();
export const hrDashboardOverviewSchema = z.object({
  personnelByRank: z.array(z.object({ code: z.string().nullable(), name: z.string().nullable(), count: countSchema })),
  personnelByGender: z.array(z.object({ label: z.enum(["male", "female", "unspecified"]), count: countSchema })),
  attendanceToday: z.object({ present: countSchema, late: countSchema, incomplete: countSchema, absent: countSchema, onLeave: countSchema }),
});
export type HrDashboardOverview = z.output<typeof hrDashboardOverviewSchema>;
```

`src/queries/reporting.ts`, append, adding `hrDashboardOverviewSchema` to the existing import:

```ts
export async function getHrDashboardOverview() {
  const { data, error } = await createBrowserSupabaseClient().rpc("get_hr_dashboard_overview");
  throwIfError(error);
  return hrDashboardOverviewSchema.parse(data);
}
```

`src/hooks/use-reporting.ts`, append, following the file's existing `useQuery` style:

```ts
export function useHrDashboardOverview() {
  return useQuery({ queryKey: ["reporting", "hr-dashboard-overview"] as const, queryFn: getHrDashboardOverview });
}
```

- [ ] **Step 7: Run, typecheck, commit**

Run: `npx vitest run src/queries/reporting.test.ts && npm run typecheck`. Expected: PASS.

```bash
git add supabase/migrations/20261011120002_hr_dashboard_overview.sql supabase/tests/hr_dashboard_overview.test.sql src/schemas/reporting.ts src/queries/reporting.ts src/queries/reporting.test.ts src/hooks/use-reporting.ts
git commit -m "feat(db): HR dashboard overview with rank, gender and today's attendance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Admin login route with an enforced Access Level

**Files:**
- Modify: `src/schemas/auth.ts`
- Modify: `src/app/auth/login/route.ts`
- Test: `src/app/auth/login/route.test.ts`, `src/schemas/auth.test.ts` (create if absent)

**Interfaces:**
- Produces, from `src/schemas/auth.ts`:
  - `type LoginMode = "applicant" | "employee" | "admin"`
  - `ADMIN_ACCESS_LEVELS: { hr: { role: "hr_personnel"; label: "HR Admin" }; sysad: { role: "system_administrator"; label: "System Administrator" } }`
  - `type AdminAccessLevel = "hr" | "sysad"`
  - `adminAccessLevel(value: unknown): AdminAccessLevel` (anything but `"sysad"` → `"hr"`)
  - `adminLoginSchema: z.ZodObject<{ identifier: email (trimmed, lowercased); password }>`
- Route contract:
  - POST fields: `as=admin`, `access_level`, `identifier` (email), `password`, `remember`, `next`.
  - On mismatch: sign out, then 303 to `/login?as=admin[&next=…]&error=wrong_access_level&level=<hr|sysad>`.

- [ ] **Step 1: Write the failing tests**

`src/schemas/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { adminAccessLevel, adminLoginSchema, ADMIN_ACCESS_LEVELS } from "./auth";

describe("admin login schema", () => {
  it("accepts an email, trimmed and lowercased", () => {
    expect(adminLoginSchema.parse({ identifier: " MC.Balneg@Example.TEST ", password: "secret1" }).identifier).toBe("mc.balneg@example.test");
  });
  it("rejects a badge number", () => {
    expect(adminLoginSchema.safeParse({ identifier: "0-00002", password: "secret1" }).success).toBe(false);
  });
  it("maps access levels to roles, defaulting to HR Admin", () => {
    expect(adminAccessLevel("sysad")).toBe("sysad");
    expect(adminAccessLevel("anything")).toBe("hr");
    expect(ADMIN_ACCESS_LEVELS.sysad.role).toBe("system_administrator");
    expect(ADMIN_ACCESS_LEVELS.hr.label).toBe("HR Admin");
  });
});
```

Append to `src/app/auth/login/route.test.ts`:

```ts
describe("admin & HR login", () => {
  function clientWithRole(role: string | null) {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue(table === "profiles" ? { data: { is_active: true }, error: null } : { data: role ? { role } : null, error: null }),
        }),
      }),
    }));
    createServerSupabaseClient.mockResolvedValue({ auth: { signInWithPassword, signOut }, from });
    return { signOut };
  }

  beforeEach(() => {
    cookieStore.set.mockReset();
    cookieStore.delete.mockReset();
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  });

  it("signs HR in with their email when HR Admin is chosen", async () => {
    clientWithRole("hr_personnel");
    const response = await POST(loginRequest({ as: "admin", access_level: "hr", identifier: "HR@Example.test", password: "secret1", remember: "on", next: "/hr" }));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "hr@example.test", password: "secret1" });
    expect(response.headers.get("location")).toBe("http://localhost/auth/continue?next=%2Fhr");
    expect(cookieStore.delete).toHaveBeenCalledWith("hris-session-only");
  });

  it("signs a SysAd in when System Administrator is chosen", async () => {
    clientWithRole("system_administrator");
    const response = await POST(loginRequest({ as: "admin", access_level: "sysad", identifier: "admin@example.test", password: "secret1" }));
    expect(response.headers.get("location")).toContain("/auth/continue");
    expect(cookieStore.set).toHaveBeenCalledWith("hris-session-only", "1", expect.objectContaining({ path: "/" }));
  });

  it("signs an HR account straight back out when System Administrator is chosen", async () => {
    const { signOut } = clientWithRole("hr_personnel");
    const response = await POST(loginRequest({ as: "admin", access_level: "sysad", identifier: "hr@example.test", password: "secret1", next: "/admin" }));
    expect(signOut).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost/login?as=admin&next=%2Fadmin&error=wrong_access_level&level=sysad");
  });

  it("refuses an employee account at the admin login", async () => {
    const { signOut } = clientWithRole("employee");
    const response = await POST(loginRequest({ as: "admin", access_level: "hr", identifier: "employee@example.test", password: "secret1" }));
    expect(signOut).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost/login?as=admin&error=wrong_access_level&level=hr");
  });

  it("rejects a badge number without calling Supabase", async () => {
    const response = await POST(loginRequest({ as: "admin", access_level: "hr", identifier: "0-00002", password: "secret1" }));
    expect(response.headers.get("location")).toBe("http://localhost/login?as=admin&error=invalid_credentials");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
```

Note: `signInWithPassword.mockReset()` runs in the outer `beforeEach`. The inner `beforeEach` re-arms it; for the last test, clear its calls first with `signInWithPassword.mockClear()` at the top of the test.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/schemas/auth.test.ts src/app/auth/login/route.test.ts`
Expected: FAIL (exports missing; `as=admin` is treated as an internal login).

- [ ] **Step 3: Implement**

`src/schemas/auth.ts`: replace `export type LoginMode = "applicant" | "employee";` with:

```ts
export type LoginMode = "applicant" | "employee" | "admin";

/** The Admin & HR Login's Access Level (Capstone UI sample.html). The account's real role must match it. */
export const ADMIN_ACCESS_LEVELS = {
  hr: { role: "hr_personnel", label: "HR Admin" },
  sysad: { role: "system_administrator", label: "System Administrator" },
} as const;
export type AdminAccessLevel = keyof typeof ADMIN_ACCESS_LEVELS;
export function adminAccessLevel(value: unknown): AdminAccessLevel {
  return value === "sysad" ? "sysad" : "hr";
}

export const adminLoginSchema = z.object({
  identifier: z.string().trim().transform((value) => value.toLowerCase()).pipe(z.email("Enter your email address.")),
  password: passwordSchema,
});
```

Narrow the existing overload signature `loginIdentifierSchema(mode: LoginMode)` to `mode: "applicant" | "employee"`, so the admin mode can't reach it.

`src/app/auth/login/route.ts`:

1. Change `loginRedirect` to accept extra params:

```ts
function loginRedirect(request: NextRequest, nextPath: string, error?: string, mode?: string, extra: Record<string, string> = {}) {
  const url = new URL("/login", request.url);
  if (mode) url.searchParams.set("as", mode);
  if (nextPath !== "/") url.searchParams.set("next", nextPath);
  if (error) url.searchParams.set("error", error);
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}
```

2. Recognise the mode and parse:

```ts
  const mode = asValue === "employee" || asValue === "applicant" || asValue === "admin" ? asValue : undefined;
  const credentials = { identifier: formData.get("identifier"), password: formData.get("password") };
  const accessLevel = adminAccessLevel(formData.get("access_level"));
  const result = mode === "admin"
    ? adminLoginSchema.safeParse(credentials)
    : mode === "applicant"
      ? loginIdentifierSchema("applicant").safeParse(credentials)
      : mode === "employee"
        ? loginIdentifierSchema("employee").safeParse(credentials)
        : internalLoginSchema.safeParse({ identifier: formData.get("identifier") ?? formData.get("email"), password: formData.get("password") });
```

3. The email for admin mode is the identifier itself:

```ts
  let email = mode === "admin"
    ? (identifier as string)
    : typeof identifier === "object"
      ? (identifier.kind === "email" ? identifier.value : null)
      : (mode ? null : (z.email().safeParse(identifier).success ? identifier : null));
```

The service-role lookup block stays as is; `email` is never null for admin.

4. Remember me applies to applicants **and** admins:

```ts
  if ((mode === "applicant" || mode === "admin") && formData.get("remember") !== "on") cookieStore.set(SESSION_ONLY_COOKIE, "1", { path: "/", sameSite: "lax" });
  else cookieStore.delete(SESSION_ONLY_COOKIE);
```

Update the comment above it: "Employees have no such box yet."

5. After the `is_active` check, inside `if (data?.user)`:

```ts
    if (mode === "admin") {
      const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle();
      if (roleRow?.role !== ADMIN_ACCESS_LEVELS[accessLevel].role) {
        await supabase.auth.signOut();
        return loginRedirect(request, nextPath, "wrong_access_level", mode, { level: accessLevel });
      }
    }
```

Import `ADMIN_ACCESS_LEVELS`, `adminAccessLevel`, `adminLoginSchema` from `@/schemas/auth`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/schemas/auth.test.ts src/app/auth/login/route.test.ts && npm run typecheck`
Expected: PASS, including every pre-existing case.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/auth.ts src/schemas/auth.test.ts src/app/auth/login/route.ts src/app/auth/login/route.test.ts
git commit -m "feat(auth): admin & HR login by email with an enforced Access Level

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Admin & HR Login screen (`sample.html`) and login redirects

**Files:**
- Modify: `src/components/auth/applicant-auth-frame.tsx`: add a `hero` slot and a `portalLabel` prop
- Create: `src/components/auth/admin-auth-hero.tsx`
- Modify: `src/components/auth/login-form.tsx`: admin fields
- Modify: `src/app/(auth)/login/page.tsx`: `admin` mode, default mode, error copy, employee page link
- Modify: `src/app/auth/continue/route.ts`: unauthenticated `/hr` and `/admin` destinations go to `as=admin`
- Test: `src/app/(auth)/login/page.test.tsx`, `src/components/auth/login-form.test.tsx`, `src/app/auth/continue/route.test.ts`

**Interfaces:**
- Consumes: `ADMIN_ACCESS_LEVELS`, `adminAccessLevel`, `LoginMode` (Task 3).
- Produces:
  - `ApplicantAuthFrame({ children, notice, hero?, mobilePortalLabel?, footerNote? })`. When `hero` is given, it replaces the motto block and the Recruitment Notice. `mobilePortalLabel` defaults to "Recruitment Portal". `footerNote` defaults to the applicant note; pass `null` for none.
  - `LoginForm` with `mode: "employee" | "applicant" | "admin"` and an optional `accessLevel` (preselected).

- [ ] **Step 1: Write the failing tests**

In `src/app/(auth)/login/page.test.tsx`, add (follow the file's existing render helper for the async server page, e.g. `render(await LoginPage({ searchParams: Promise.resolve({...}) }))`):

```tsx
  it("renders the Admin & HR Login (sample.html)", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ as: "admin" }) }));
    expect(screen.getByText("Administrative Access")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Admin & HR Login" })).toBeInTheDocument();
    expect(screen.getByText("Authorized management portal for HR Personnel Officers and System Administrators.")).toBeInTheDocument();
    expect(screen.getByLabelText("Access Level")).toHaveValue("hr");
    expect(screen.getByRole("option", { name: "System Administrator" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email Address")).toHaveAttribute("type", "email");
    expect(screen.getByText("System Management & Administration")).toBeInTheDocument();
    expect(screen.getByText("Management Portal")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login as Employee" })).toHaveAttribute("href", "/login?as=employee");
  });

  it("explains an Access Level mismatch and keeps the chosen level", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ as: "admin", error: "wrong_access_level", level: "sysad" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("This account does not have System Administrator access.");
    expect(screen.getByLabelText("Access Level")).toHaveValue("sysad");
  });

  it("sends visitors bound for /hr or /admin to the admin login", async () => {
    await expect(LoginPage({ searchParams: Promise.resolve({ next: "/hr/jobs" }) })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirect).toHaveBeenCalledWith("/login?as=admin&next=%2Fhr%2Fjobs");
  });

  it("links the employee login to the admin login", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ as: "employee" }) }));
    expect(screen.getByRole("link", { name: "Admin & HR Login" })).toHaveAttribute("href", "/login?as=admin");
  });
```

If the file mocks `next/navigation`'s `redirect` differently (e.g. it throws a custom error), match its existing pattern for the redirect assertion. Also mock `@/lib/recruitment/recruitment-notice` as the file already does.

In `src/app/auth/continue/route.test.ts`, add:

```ts
  it("sends a signed-out visitor bound for /hr to the admin login", async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/auth/continue?next=/hr/leave-requests"));
    expect(response.headers.get("location")).toBe("http://localhost/login?as=admin&next=%2Fhr%2Fleave-requests");
  });
```

Use the mock names the file already defines.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run "src/app/(auth)/login/page.test.tsx" src/app/auth/continue/route.test.ts src/components/auth/login-form.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the frame and hero**

In `applicant-auth-frame.tsx`:
- Change the signature to `{ children, notice, hero, mobilePortalLabel = "Recruitment Portal", footerNote = "San Juan City PNP Online Recruitment & Applicant Portal System", portalPill = "Applicant Portal", portalDotClassName = "bg-emerald-400" }`, with `hero?: ReactNode`, `footerNote?: string | null`, `notice?: RecruitmentNotice`.
- Render `{hero ?? <the existing MIDDLE HERO block>}`.
- Render the footer note only when `footerNote` is not null.
- The pill text uses `portalPill`, and the dot uses `portalDotClassName`.

`src/components/auth/admin-auth-hero.tsx` (copied from `sample.html` lines 170–183):

```tsx
/** Capstone UI sample.html: the Management Portal hero copy. */
export function AdminAuthHero() {
  return (
    <div className="relative z-10 my-auto py-6">
      <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold tracking-widest text-amber-400 uppercase">
        <span>Service</span> • <span>Honor</span> • <span>Justice</span>
      </div>
      <h2 className="text-3xl leading-tight font-extrabold text-white">System Management &amp; Administration</h2>
      <p className="mt-3 max-w-md text-xs leading-relaxed font-normal text-slate-300">
        Authorized portal for managing personnel records, reviewing promotion applications, auditing DTR logs, and configuring station system settings.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Implement the form**

In `login-form.tsx`:
- Widen `mode` to `"employee" | "applicant" | "admin"` and add `accessLevel?: AdminAccessLevel`.
- Generalise `ApplicantFields` into `CapstoneFields({ pending, accessLevel }: { pending: boolean; accessLevel?: AdminAccessLevel })`.
- When `accessLevel` is given, render the Access Level select first (from `sample.html` lines 50–66):

```tsx
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="login-access-level">Access Level</label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
            <ShieldUser aria-hidden="true" className="size-4" />
          </div>
          <select
            className={`${applicantInputClassName} cursor-pointer appearance-none pr-10 pl-10`}
            defaultValue={accessLevel}
            id="login-access-level"
            name="access_level"
          >
            <option value="hr">HR Admin</option>
            <option value="sysad">System Administrator</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500">
            <ChevronDown aria-hidden="true" className="size-3.5" />
          </div>
        </div>
      </div>
```

- The email placeholder is `juan.delacruz@gmail.com` for admin, `juan.delacruz@email.com` for applicants.
- In `LoginForm`, the applicant branch handles `mode === "applicant" || mode === "admin"`, passing `accessLevel={mode === "admin" ? (accessLevel ?? "hr") : undefined}`.

Add to `login-form.test.tsx`:

```tsx
  it("posts the Access Level with the admin login", () => {
    const { container } = render(<LoginForm accessLevel="sysad" mode="admin" nextPath="/admin" />);
    expect(screen.getByLabelText("Access Level")).toHaveValue("sysad");
    expect(container.querySelector('input[name="as"]')).toHaveValue("admin");
    expect(screen.getByLabelText("Email Address")).toHaveAttribute("placeholder", "juan.delacruz@gmail.com");
  });
```

- [ ] **Step 5: Implement the page and redirects**

In `src/app/(auth)/login/page.tsx`:
- `type LoginMode = "employee" | "applicant" | "admin";`
- Add:

```ts
/** HR and System Administrators sign in at the Admin & HR Login. */
function isAdminPath(path: string) {
  const pathname = new URL(path, "http://hris.local").pathname;
  return ["/hr", "/admin"].some((root) => pathname === root || pathname.startsWith(`${root}/`));
}
```

- `defaultMode`: return `"applicant"` as today, else `isAdminPath(nextPath) ? "admin" : "employee"`.
- Accept `level` in `searchParams`.
- The redirect guard accepts `as === "admin"`.
- `switchHref(mode, nextPath)`: keep `next` only when it belongs to the target mode. Applicant: as today. Admin: only when `isAdminPath(next)`. Employee: when it is neither a recruitment nor an admin path.
- Add the error copy:

```ts
    : error === "wrong_access_level"
      ? `This account does not have ${ADMIN_ACCESS_LEVELS[adminAccessLevel(level)].label} access.`
```

- **Admin branch** (before the employee branch):

```tsx
  if (mode === "admin") {
    return (
      <ApplicantAuthFrame footerNote={null} hero={<AdminAuthHero />} mobilePortalLabel="Admin Portal" portalDotClassName="bg-amber-400" portalPill="Management Portal">
        <div className="mb-6">
          <span className="mb-3 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold tracking-wider text-amber-900 uppercase">
            Administrative Access
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Admin &amp; HR Login</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Authorized management portal for HR Personnel Officers and System Administrators.
          </p>
        </div>
        <LoginForm accessLevel={adminAccessLevel(level)} error={errorMessage} mode="admin" nextPath={nextPath} notice={notice} />
        <p className="mt-6 text-center text-[11px] text-slate-500">
          Station personnel?{" "}
          <Link className="font-semibold text-slate-500 hover:text-slate-700 hover:underline" href={switchHref("employee", nextPath)}>Login as Employee</Link>
        </p>
      </ApplicantAuthFrame>
    );
  }
```

- **Employee branch:** under the existing "Login as Applicant" paragraph, add:

```tsx
            <p className="mt-2 text-center text-sm text-muted-foreground">
              HR / Admin?{" "}
              <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={switchHref("admin", nextPath)}>Admin &amp; HR Login</Link>
            </p>
```

In `src/app/auth/continue/route.ts`, for the signed-out case:

```ts
    const mode = isWithin(nextPath, "/applicant") || isWithin(nextPath, "/jobs")
      ? "applicant"
      : isWithin(nextPath, "/hr") || isWithin(nextPath, "/admin") ? "admin" : "employee";
    login.searchParams.set("as", mode);
```

- [ ] **Step 6: Run the tests and look at the page**

Run: `npx vitest run "src/app/(auth)/login" src/app/auth src/components/auth && npm run typecheck`
Expected: PASS.

Then `npm run dev` and compare `/login?as=admin` with `docs/design/capstone-ui/sample.html` (open the file in a browser) at 1366 px and 390 px.

- [ ] **Step 7: Commit**

```bash
git add src/components/auth src/app/\(auth\)/login src/app/auth/continue
git commit -m "feat(auth): Admin & HR Login screen from the Capstone UI sample.html

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Shared account menu, role-neutral notification panel, staff notices

**Files:**
- Create: `src/components/app-shell/capstone-account-menu.tsx` (+ `capstone-account-menu.test.tsx`)
- Modify: `src/components/app-shell/applicant-account-menu.tsx`: becomes a thin wrapper
- Modify: `src/components/app-shell/notification-drawer.tsx`: `onError` prop
- Create: `src/components/staff-shell/staff-notify.tsx`

**Interfaces:**
- Produces:
  - `CapstoneAccountMenu(props: { name: string; email: string | null; ariaLabel: string; tone: "dark" | "light"; profileHref?: string; afterLogoutHref: string; onError: (title: string, description: string) => void })`
  - `NotificationDrawer({ onError?: (title: string, description: string) => void })`, defaulting to `notifyApplicant`
  - `notifyStaff({ title, description?, tone? })` and `StaffToaster()`

- [ ] **Step 1: Write the failing test**

`src/components/app-shell/capstone-account-menu.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CapstoneAccountMenu } from "./capstone-account-menu";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
const signOut = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ auth: { signOut } }) }));

describe("CapstoneAccountMenu", () => {
  it("offers Logout only when there is no profile page", async () => {
    render(<CapstoneAccountMenu afterLogoutHref="/login?as=admin" ariaLabel="Account menu for hr@example.test" email="hr@example.test" name="PMAJ M. C. Balneg" onError={vi.fn()} tone="light" />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu for hr@example.test" }));
    expect(screen.queryByRole("menuitem", { name: /profile/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Logout" }));
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(replace).toHaveBeenCalledWith("/login?as=admin");
  });

  it("shows initials from the name", () => {
    render(<CapstoneAccountMenu afterLogoutHref="/" ariaLabel="menu" email={null} name="PMAJ M. C. Balneg" onError={vi.fn()} tone="light" />);
    expect(screen.getByText("MB")).toBeInTheDocument();
  });
});
```

Initials rule: the first letter of the first and last words that aren't an all-caps rank code. For "PMAJ M. C. Balneg" that gives "M" and "B", i.e. "MB". For a name without a rank (e.g. "Aldrick Jamlani") it gives "AJ", the same as the #78 behaviour.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/app-shell/capstone-account-menu.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`capstone-account-menu.tsx`: move the body of `ApplicantAccountMenu` here with these changes:

```tsx
"use client";

import { ChevronDown, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { clearSessionOnlyCookie } from "@/lib/supabase/remember-me";
import { cn } from "@/lib/utils";

export function accountInitials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  const named = words.length > 1 && /^[A-Z]{2,}$/.test(words[0]!) ? words.slice(1) : words;
  const picked = named.length > 1 ? [named[0]!, named.at(-1)!] : named;
  return picked.map((word) => word[0]!.toUpperCase()).join("") || "U";
}

type Props = {
  name: string;
  email: string | null;
  ariaLabel: string;
  /** "dark" sits on the applicant's navy bar, "light" on the staff shell's white bar. */
  tone: "dark" | "light";
  profileHref?: string;
  afterLogoutHref: string;
  onError: (title: string, description: string) => void;
};

/** Capstone UI account menu: avatar, name and email, opening (Profile and) Logout. */
export function CapstoneAccountMenu({ name, email, ariaLabel, tone, profileHref, afterLogoutHref, onError }: Props) {
  const router = useRouter();
  async function logout() {
    // Local scope: signing out here must not end the same account's sessions on other devices.
    const { error } = await createBrowserSupabaseClient().auth.signOut({ scope: "local" });
    if (error) { onError("Could not log out", error.message); return; }
    clearSessionOnlyCookie();
    router.replace(afterLogoutHref);
    router.refresh();
  }
  const dark = tone === "dark";
  return (
    <div className={cn("relative border-l pl-3", dark ? "border-slate-800" : "border-slate-200")}>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={ariaLabel} className={cn("group flex items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2", dark ? "focus-visible:ring-blue-400" : "focus-visible:ring-blue-700")}>
          <span className={cn("flex items-center justify-center rounded-full font-bold shadow-sm", dark ? "size-8 border border-blue-400 bg-blue-600 text-xs text-white" : "size-9 border border-slate-700 bg-slate-900 text-xs text-amber-400")}>
            {accountInitials(name)}
          </span>
          <span className="hidden text-left sm:block">
            <span className={cn("block text-xs leading-tight", dark ? "font-semibold text-slate-200 group-hover:text-white" : "font-bold text-slate-900")}>{name}</span>
            {email ? <span className={cn("block text-[10px] leading-tight", dark ? "text-slate-400" : "text-slate-500")}>{email}</span> : null}
          </span>
          <ChevronDown aria-hidden="true" className={cn("ml-1 size-3", dark ? "text-slate-400" : "text-slate-500")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="capstone-ui w-52 rounded-xl border border-slate-200 bg-white py-1.5 text-xs text-slate-700 shadow-xl ring-0">
          <div className="border-b border-slate-100 px-4 py-2 sm:hidden">
            <p className="font-bold text-slate-900">{name}</p>
            {email ? <p className="truncate text-[10px] text-slate-500">{email}</p> : null}
          </div>
          {profileHref ? (
            <>
              <DropdownMenuItem className="flex w-full items-center gap-2.5 rounded-none px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:bg-slate-50" render={<Link href={profileHref} />}>
                <User aria-hidden="true" className="size-4 text-slate-500" /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-0 my-1 bg-slate-100" />
            </>
          ) : null}
          <DropdownMenuItem className="flex w-full items-center gap-2.5 rounded-none px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 focus:bg-red-50 focus:text-red-600" onClick={() => void logout()}>
            <LogOut aria-hidden="true" className="size-4" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

`applicant-account-menu.tsx` becomes:

```tsx
"use client";

import { notifyApplicant } from "@/components/app-shell/applicant-toaster";
import { CapstoneAccountMenu } from "@/components/app-shell/capstone-account-menu";

/** Capstone UI notifapp.html: the applicant's avatar, name and email, opening Profile and Logout. */
export function ApplicantAccountMenu({ email, name }: { email: string | null; name: string }) {
  return (
    <CapstoneAccountMenu
      afterLogoutHref="/"
      ariaLabel={`Account menu for ${name}`}
      email={email}
      name={name}
      onError={(title, description) => notifyApplicant({ title, description, tone: "error" })}
      profileHref="/applicant/profile"
      tone="dark"
    />
  );
}
```

In `notification-drawer.tsx`, change `export function NotificationDrawer()` to:

```tsx
export function NotificationDrawer({ onError = (title, description) => notifyApplicant({ title, description, tone: "error" }) }: { onError?: (title: string, description: string) => void } = {}) {
```

and `failed` to `({ onError: (error: Error) => onError(title, error.message) })`.

`src/components/staff-shell/staff-notify.tsx`:

```tsx
"use client";

import { ApplicantToaster, notifyApplicant } from "@/components/app-shell/applicant-toaster";

/** Staff screens use the same dark Capstone UI notices as the applicant portal. */
export const notifyStaff = notifyApplicant;
export const StaffToaster = ApplicantToaster;
export const notifyStaffError = (title: string, description: string) => notifyApplicant({ title, description, tone: "error" });
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/app-shell && npm run typecheck`
Expected: PASS. The existing `applicant-account-menu.test.tsx` and `notification-drawer.test.tsx` still pass unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell src/components/staff-shell/staff-notify.tsx
git commit -m "refactor: share the Capstone UI account menu and notification panel with staff

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `StaffShell` for HR (sidebar, top bar, scope)

**Files:**
- Create: `src/components/staff-shell/staff-shell.tsx`, `staff-nav-badge.tsx`, `page-meta.ts`
- Create: `src/lib/auth/staff-display-name.ts` (+ `.test.ts`)
- Modify: `src/lib/app/role-config.ts`, `src/components/workspace-shell/nav-icons.ts`, `src/app/(app)/layout.tsx`
- Test: `src/components/staff-shell/staff-shell.test.tsx`, `src/components/staff-shell/page-meta.test.ts`, `src/lib/app/role-config.test.ts` (create if absent), `src/app/(app)/role-layouts.test.tsx` (update)

**Interfaces:**
- Consumes: `CapstoneAccountMenu`, `NotificationDrawer` (with `onError`), `StaffToaster`, `notifyStaffError` (Task 5).
- Produces:
  - `StaffShell({ children, config, email, displayName }: { children: ReactNode; config: RoleConfig; email: string | null; displayName: string })`
  - `staffPageSubtitle(pathname: string): string`
  - `isRedesignedStaffRoute(pathname: string): boolean`
  - `formatStaffDisplayName(input: { rankCode: string | null; firstName: string; middleName: string | null; lastName: string } | null, fallback: string): string`
  - `getStaffDisplayName(userId: string, fallback: string): Promise<string>` (server only)
  - `RoleNavigationIcon` gains `"ChartPie" | "Briefcase" | "IdCard" | "MapPinned" | "CalendarCheck" | "Award" | "Megaphone"`.

- [ ] **Step 1: Write the failing tests**

`src/lib/auth/staff-display-name.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatStaffDisplayName } from "./staff-display-name";

describe("formatStaffDisplayName", () => {
  it("writes the rank code, initials and last name", () => {
    expect(formatStaffDisplayName({ rankCode: "PMAJ", firstName: "Maria Cristina", middleName: "Baldoz", lastName: "Balneg" }, "x")).toBe("PMAJ M. C. Balneg");
  });
  it("uses the full name without a rank", () => {
    expect(formatStaffDisplayName({ rankCode: null, firstName: "Juan", middleName: null, lastName: "Dela Cruz" }, "x")).toBe("Juan Dela Cruz");
  });
  it("falls back when there is no linked employee", () => {
    expect(formatStaffDisplayName(null, "hr@example.test")).toBe("hr@example.test");
  });
});
```

The rule (the mockup's "PMAJ M. C. Balneg" for Maria Cristina Balneg): the rank code, then the initials of the first-name words, then the last name. The middle name is not shown.

`src/components/staff-shell/page-meta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isRedesignedStaffRoute, staffPageSubtitle } from "./page-meta";

describe("staff page meta", () => {
  it("gives each section its mockup subtitle", () => {
    expect(staffPageSubtitle("/hr/jobs")).toBe("Recruitment Module • Plantilla & Job Openings");
    expect(staffPageSubtitle("/hr/jobs/12")).toBe("Recruitment Module • Plantilla & Job Openings");
    expect(staffPageSubtitle("/hr/leave-requests")).toBe("Leave Management & Personnel Entitlements");
    expect(staffPageSubtitle("/reports/deployments")).toBe("Personnel Management • Official Analytics & Station Reports");
    expect(staffPageSubtitle("/hr")).toBe("Dashboard • Manpower, Attendance & Deployment Overview");
  });
  it("knows which pages are redesigned (the rest keep the workspace look)", () => {
    expect(isRedesignedStaffRoute("/hr/deployments")).toBe(true);
    expect(isRedesignedStaffRoute("/hr/deployments/abc")).toBe(false);
    expect(isRedesignedStaffRoute("/hr/employees")).toBe(false);
    expect(isRedesignedStaffRoute("/reports")).toBe(true);
    expect(isRedesignedStaffRoute("/reports/deployments")).toBe(false);
  });
});
```

`src/lib/app/role-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ROLE_CONFIG } from "./role-config";

describe("HR navigation (Capstone UI dashboard.html)", () => {
  it("lists the mockup's items in order, without the Kiosk", () => {
    expect(ROLE_CONFIG.hr_personnel.navigation.map((item) => [item.group ?? null, item.label, item.href])).toEqual([
      [null, "Dashboard", "/hr"],
      ["Recruitment", "Plantilla Openings", "/hr/jobs"],
      ["Recruitment", "Applicant Roster", "/hr/applications"],
      ["Personnel 201", "Active Personnel", "/hr/employees"],
      ["Personnel 201", "Duty Deployments", "/hr/deployments"],
      ["Personnel 201", "Leave Applications", "/hr/leave-requests"],
      ["Personnel 201", "Promotion Records", "/hr/promotions"],
      ["Attendance & DTR", "Daily Attendance Logs", "/hr/attendance"],
      ["Reports", "HR Audit & Reports", "/reports"],
      ["Public Site", "Announcements", "/hr/public-site"],
    ]);
  });
});
```

`src/components/staff-shell/staff-shell.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_CONFIG } from "@/lib/app/role-config";

import { StaffShell } from "./staff-shell";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/app-shell/notification-drawer", () => ({ NotificationDrawer: () => <button type="button">Notifications</button> }));
vi.mock("./staff-notify", () => ({ StaffToaster: () => null, notifyStaffError: vi.fn() }));
vi.mock("./staff-nav-badge", () => ({ StaffNavBadge: () => null }));

describe("StaffShell (HR)", () => {
  beforeEach(() => usePathname.mockReturnValue("/hr/jobs"));

  it("shows the mockup sidebar with groups and the active item", () => {
    render(<StaffShell config={ROLE_CONFIG.hr_personnel} displayName="PMAJ M. C. Balneg" email="hr@example.test"><h1>Jobs</h1></StaffShell>);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByText("Personnel 201")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Plantilla Openings" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("link", { name: /kiosk/i })).not.toBeInTheDocument();
    expect(screen.getByText("San Juan City PS")).toBeInTheDocument();
  });

  it("has the mockup top bar, a bell and an account menu, and no sidebar sign-out", () => {
    render(<StaffShell config={ROLE_CONFIG.hr_personnel} displayName="PMAJ M. C. Balneg" email="hr@example.test"><h1>Jobs</h1></StaffShell>);
    expect(screen.getByText("HRDD Portal")).toBeInTheDocument();
    expect(screen.getByText("Recruitment Module • Plantilla & Job Openings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu for hr@example.test" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("keeps the workspace look on pages without a mockup", () => {
    usePathname.mockReturnValue("/hr/employees");
    render(<StaffShell config={ROLE_CONFIG.hr_personnel} displayName="x" email="hr@example.test"><h1>Employees</h1></StaffShell>);
    expect(screen.getByRole("heading", { name: "Employees" }).closest(".workspace")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/auth/staff-display-name.test.ts src/components/staff-shell src/lib/app/role-config.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the config, icons and meta**

**`role-config.ts`:**
- Extend `RoleNavigationIcon` with the seven icons listed under Interfaces.
- Replace the `hr_personnel.navigation` array:

```ts
    navigation: [
      { href: "/hr", label: "Dashboard", icon: "ChartPie" },
      { href: "/hr/jobs", label: "Plantilla Openings", icon: "Briefcase", group: "Recruitment" },
      { href: "/hr/applications", label: "Applicant Roster", icon: "IdCard", group: "Recruitment", badge: "applicationsAwaitingReview" },
      { href: "/hr/employees", label: "Active Personnel", icon: "Users", group: "Personnel 201" },
      { href: "/hr/deployments", label: "Duty Deployments", icon: "MapPinned", group: "Personnel 201" },
      { href: "/hr/leave-requests", label: "Leave Applications", icon: "CalendarCheck", group: "Personnel 201", badge: "leaveForApproval" },
      { href: "/hr/promotions", label: "Promotion Records", icon: "Award", group: "Personnel 201" },
      { href: "/hr/attendance", label: "Daily Attendance Logs", icon: "Clock", group: "Attendance & DTR" },
      { href: "/reports", label: "HR Audit & Reports", icon: "FileText", group: "Reports" },
      { href: "/hr/public-site", label: "Announcements", icon: "Megaphone", group: "Public Site" },
    ],
```

**`nav-icons.ts`:** import and add `ChartPie, Briefcase, IdCard, MapPinned, CalendarCheck, Award, Megaphone` to both the import and the map.

**`page-meta.ts`:**

```ts
const SUBTITLES: [root: string, subtitle: string][] = [
  ["/hr/jobs", "Recruitment Module • Plantilla & Job Openings"],
  ["/hr/applications", "Recruitment Module • Applicant Tracking & Roster"],
  ["/hr/employees", "Personnel Management • Personnel 201 Records"],
  ["/hr/deployments", "Personnel Management • Duty Deployments & Field Assignments"],
  ["/hr/leave-requests", "Leave Management & Personnel Entitlements"],
  ["/hr/promotions", "Personnel Management • Promotion Board & Criteria"],
  ["/hr/attendance", "Personnel Management • Face Biometrics & Attendance Logs"],
  ["/reports", "Personnel Management • Official Analytics & Station Reports"],
  ["/hr/public-site", "Public Site • Announcements & Station Contacts"],
  ["/notifications", "Notifications"],
];

const within = (pathname: string, root: string) => pathname === root || pathname.startsWith(`${root}/`);

/** The grey line under the station name in the top bar (Capstone UI jobpost.html header). */
export function staffPageSubtitle(pathname: string) {
  return SUBTITLES.find(([root]) => within(pathname, root))?.[1] ?? "Dashboard • Manpower, Attendance & Deployment Overview";
}

/** Pages copied from a Capstone UI mockup; every other staff page keeps the workspace look. */
const REDESIGNED = new Set(["/hr", "/hr/jobs", "/hr/applications", "/hr/deployments", "/hr/leave-requests", "/hr/promotions", "/hr/attendance", "/reports", "/hr/public-site"]);
export function isRedesignedStaffRoute(pathname: string) {
  return REDESIGNED.has(pathname);
}
```

- [ ] **Step 4: Implement the display name**

`src/lib/auth/staff-display-name.ts`:

```ts
import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

type Person = { rankCode: string | null; firstName: string; middleName: string | null; lastName: string };

/** "PMAJ M. C. Balneg" (Capstone UI header): rank code, first-name initials and last name. */
export function formatStaffDisplayName(person: Person | null, fallback: string) {
  if (!person) return fallback;
  if (!person.rankCode) return `${person.firstName} ${person.lastName}`.trim();
  const initials = person.firstName.split(/\s+/).filter(Boolean).map((word) => `${word[0]!.toUpperCase()}.`).join(" ");
  return [person.rankCode, initials, person.lastName].filter(Boolean).join(" ");
}

export async function getStaffDisplayName(userId: string, fallback: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("employees").select("first_name, middle_name, last_name, ranks(code)").eq("profile_id", userId).maybeSingle();
  if (!data) return fallback;
  const rank = Array.isArray(data.ranks) ? data.ranks[0] : data.ranks;
  return formatStaffDisplayName({ rankCode: rank?.code ?? null, firstName: data.first_name, middleName: data.middle_name, lastName: data.last_name }, fallback);
}
```

`server-only` makes the test environment fail to import. Either move `formatStaffDisplayName` into `src/lib/auth/staff-display-name-format.ts` (no `server-only`, imported by both), or mock `server-only` in the test with `vi.mock("server-only", () => ({}))`. Pick the mock if other tests in the repo already do that (`grep -rn 'vi.mock("server-only"' src`), else split the file.

- [ ] **Step 5: Implement the shell**

`src/components/staff-shell/staff-nav-badge.tsx`:

```tsx
"use client";

import { useWorkspaceCount } from "@/hooks/use-workspace-counts";
import type { NavBadgeKey } from "@/lib/app/role-config";

/** Capstone UI sidebar count pill. Sits outside the link so the link's name stays stable. */
export function StaffNavBadge({ badge }: { badge: NavBadgeKey }) {
  const { data, isError } = useWorkspaceCount(badge);
  if (isError || !data) return null;
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{data > 99 ? "99+" : data}</span>
      <span className="sr-only">{data} waiting</span>
    </>
  );
}
```

`src/components/staff-shell/staff-shell.tsx`. It mirrors `AppShell`'s structure (`SidebarProvider` / `Sidebar collapsible="offcanvas"` / `SidebarInset`, skip link, focus-heading-on-route-change), using `dashboard.html` lines 43–169 for the classes:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { CapstoneAccountMenu } from "@/components/app-shell/capstone-account-menu";
import { NotificationDrawer } from "@/components/app-shell/notification-drawer";
import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NAVIGATION_ICONS } from "@/components/workspace-shell/nav-icons";
import type { RoleConfig, RoleNavigationItem } from "@/lib/app/role-config";
import { cn } from "@/lib/utils";

import { isRedesignedStaffRoute, staffPageSubtitle } from "./page-meta";
import { StaffNavBadge } from "./staff-nav-badge";
import { notifyStaffError, StaffToaster } from "./staff-notify";

type StaffShellProps = { children: ReactNode; config: RoleConfig; email: string | null; displayName: string };

function groupNavigation(items: readonly RoleNavigationItem[]) {
  const groups: { label: string | null; items: RoleNavigationItem[] }[] = [];
  for (const item of items) {
    const label = item.group ?? null;
    const current = groups.at(-1);
    if (current && current.label === label) current.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function useFocusHeadingOnRouteChange(pathname: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const frame = requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("#main-content h1");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
}

function StaffNavigation({ activeHref, config }: { activeHref: string | undefined; config: RoleConfig }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <nav aria-label="Main navigation" className="space-y-6 px-3 py-4">
      {groupNavigation(config.navigation).map((group) => (
        <div key={group.label ?? "top"}>
          {group.label ? <p className="mb-1.5 px-3 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">{group.label}</p> : null}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = activeHref === item.href;
              const Icon = NAVIGATION_ICONS[item.icon];
              return (
                <div className="relative" key={item.href}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                      active ? "rounded-xl bg-blue-700 px-3.5 py-2.5 font-bold text-white shadow-lg shadow-blue-900/40" : "rounded-lg px-3.5 py-2 font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-white",
                    )}
                    href={item.href}
                    onClick={() => { if (isMobile) setOpenMobile(false); }}
                  >
                    <Icon aria-hidden="true" className={cn("w-4 shrink-0", active && "size-4")} />
                    <span>{item.label}</span>
                  </Link>
                  {item.badge ? <StaffNavBadge badge={item.badge} /> : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** HR frame from the Capstone UI dashboard.html: navy sidebar, white top bar, slate canvas. */
export function StaffShell({ children, config, email, displayName }: StaffShellProps) {
  const pathname = usePathname();
  const active = config.navigation
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .toSorted((left, right) => right.href.length - left.href.length)[0];
  const redesigned = isRedesignedStaffRoute(pathname);

  // Unredesigned pages' dialogs render in portals under <body>; scoping <html> gives them the workspace tokens.
  useEffect(() => {
    document.documentElement.classList.add("workspace");
    return () => document.documentElement.classList.remove("workspace");
  }, []);
  useFocusHeadingOnRouteChange(pathname);

  return (
    <TooltipProvider>
      <SidebarProvider className="capstone-ui h-svh overflow-hidden font-sans text-slate-800 antialiased" style={{ "--sidebar-width": "16rem" } as CSSProperties}>
        <a className="sr-only fixed top-4 left-4 z-50 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-blue-700" href="#main-content">
          Skip to main content
        </a>
        <Sidebar className="border-r border-slate-800 [&_[data-sidebar=sidebar]]:bg-[#0B132B] [&_[data-sidebar=sidebar]]:text-slate-300" collapsible="offcanvas">
          <SidebarHeader className="border-b border-slate-800/80 p-4">
            <Link className="flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400" href={config.homeHref}>
              <Image alt="San Juan City Police Station logo" className="size-10 shrink-0 object-contain" height={40} priority src="/san-juan-police-logo.png" width={40} />
              <span className="truncate text-xs font-extrabold tracking-wider text-white uppercase">San Juan City PS</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <StaffNavigation activeHref={active?.href} config={config} />
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="min-w-0 overflow-y-auto overscroll-contain bg-slate-50" id="main-content">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger aria-label="Toggle sidebar" className="size-9 rounded-lg text-slate-500 hover:bg-slate-100 md:hidden" />
              <Image alt="" className="hidden size-8 shrink-0 object-contain sm:block" height={32} src="/san-juan-police-logo.png" width={32} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-extrabold tracking-tight text-slate-900">SAN JUAN CITY POLICE STATION</span>
                  <span className="hidden rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 sm:inline">HRDD Portal</span>
                </div>
                <p className="truncate text-[10px] font-medium text-slate-500">{staffPageSubtitle(pathname)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationDrawer onError={notifyStaffError} />
              <CapstoneAccountMenu afterLogoutHref="/login?as=admin" ariaLabel={`Account menu for ${email ?? displayName}`} email={email} name={displayName} onError={notifyStaffError} tone="light" />
            </div>
          </header>
          <div className={cn("flex-1", redesigned ? "space-y-6 p-4 sm:p-6" : "workspace bg-background p-4 text-foreground sm:p-6 lg:p-8")}>
            <div className="mx-auto w-full max-w-7xl min-w-0">{children}</div>
          </div>
        </SidebarInset>
        <StaffToaster />
      </SidebarProvider>
    </TooltipProvider>
  );
}
```

The applicant `NotificationDrawer`'s bell is styled for a dark bar. Add a `tone?: "dark" | "light"` prop to it: `"light"` uses `text-slate-500 hover:bg-slate-100 rounded-xl p-2`, as in `dashboard.html` line ~150. Pass `tone="light"` from `StaffShell`. Add a test case to `notification-drawer.test.tsx` that the light bell button still has its accessible name.

`src/app/(app)/layout.tsx`:

```tsx
  const config = getRoleConfig(role);
  if (role === "hr_personnel") {
    const displayName = await getStaffDisplayName(user.id, user.email ?? "HR Personnel");
    return (
      <QueryProvider>
        <StaffShell config={config} displayName={displayName} email={user.email}>{children}</StaffShell>
      </QueryProvider>
    );
  }
  // Applicants keep the Capstone UI applicant shell; other internal roles keep the workspace shell until their redesign.
  const Shell = role === "applicant" ? AppShell : WorkspaceShell;
```

Check `getAuthenticatedUser()`'s return shape for `id` (`grep -n "export async function getAuthenticatedUser" -A15 src/lib/auth/current-user.ts`) and use the right field.

Update `src/app/(app)/role-layouts.test.tsx` so HR expects `StaffShell`, mocking `@/components/staff-shell/staff-shell` and `@/lib/auth/staff-display-name` the way the file mocks the other shells.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/components/staff-shell src/lib/auth src/lib/app "src/app/(app)/role-layouts.test.tsx" src/components/app-shell src/components/workspace-shell && npm run typecheck`
Expected: PASS. If `workspace-shell.test.tsx` asserts HR-specific labels ("Job postings" etc.), switch those assertions to the SysAd config, because HR no longer uses `WorkspaceShell`.

- [ ] **Step 7: Look at it, then commit**

Run `npm run dev`, sign in at `/login?as=admin` as `demo.hr@example.test` (HR Admin), and compare the frame with `dashboard.html` at 1366 px and 390 px.

```bash
git add src/components/staff-shell src/lib/auth/staff-display-name* src/lib/app src/components/workspace-shell/nav-icons.ts src/components/app-shell/notification-drawer* "src/app/(app)/layout.tsx" "src/app/(app)/role-layouts.test.tsx"
git commit -m "feat: Capstone UI staff shell for HR (sidebar, top bar, bell panel, account menu)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Staff UI primitives, panel URL state and status maps

**Files:**
- Create: `src/components/staff-shell/ui/staff-modal.tsx`, `staff-slide-over.tsx`, `staff-table-card.tsx`, `status-pill.tsx`, `staff-fields.tsx`, `staff-buttons.ts`, `initials-avatar.tsx`, `page-title.tsx`
- Create: `src/hooks/use-panel-param.ts`
- Create: `src/lib/staff/status-maps.ts`, `src/lib/staff/distribution.ts`, `src/lib/personnel/rank-category.ts`
- Test: `src/components/staff-shell/ui/staff-ui.test.tsx`, `src/hooks/use-panel-param.test.tsx`, `src/lib/staff/status-maps.test.ts`, `src/lib/staff/distribution.test.ts`, `src/lib/personnel/rank-category.test.ts`

**Interfaces:**
- Produces:
  - **`StaffModal`:**

    ```ts
    StaffModal(props: {
      open: boolean; onClose: () => void; title: string; subtitle?: string;
      icon?: ReactNode; iconClassName?: string;
      size?: "md" | "lg" | "xl" | "2xl";
      children: ReactNode; footer?: ReactNode; footerClassName?: string;
    })
    ```

    Sizes: `md` = `max-w-md`, `lg` = `max-w-lg`, `xl` = `max-w-xl`, `2xl` = `max-w-2xl`.
  - **`StaffSlideOver`:**

    ```ts
    StaffSlideOver(props: {
      open: boolean; onClose: () => void; title: string; subtitle?: string;
      size?: "lg" | "xl"; children: ReactNode; footer?: ReactNode;
    })
    ```

  - **`StaffTableCard`:**

    ```ts
    StaffTableCard(props: {
      title: string; subtitle?: string; count?: string; toolbar?: ReactNode;
      children: ReactNode;
      pager?: { page: number; pageSize: number; total: number; noun: string; onPageChange: (page: number) => void };
    })
    ```

  - `StatusPill({ tone, children, icon? })`, with `type PillTone = "amber" | "emerald" | "rose" | "blue" | "slate"`.
  - `StaffLabel`, `StaffInput`, `StaffSelect`, `StaffTextarea`, which forward native props and add the mockup classes. `StaffSelect` draws the chevron.
  - `staffButton.primary | dark | secondary | danger | success` and `staffIconButton`: class strings.
  - `InitialsAvatar({ name, size?: "sm" | "md" | "lg", tone?: "blue" | "emerald" | "purple" | "rose" | "slate" })`. Initials are the first letters of the first two words.
  - `PageTitle({ title, subtitle, actions? })`.
  - `usePanelParam(name: string): readonly [value: string | null, set: (next: string | null) => void]`.
  - From `status-maps.ts`:
    - `LEAVE_STATUS`, `DEPLOYMENT_STATUS`, `ATTENDANCE_STATUS`, `RECOMMENDATION_STATUS`, each `Record<key, { label: string; tone: PillTone }>`
    - `applicationStatusPill(status: ApplicationStatus | "Pending"): { label: string; tone: PillTone }`
    - `aiMatchLabel(score: number | null): string | null`
  - From `distribution.ts`: `distributionRows(items: { label: string; count: number }[]): { label: string; count: number; percent: string; width: number }[]`.
  - From `rank-category.ts`: `rankCategory(code: string | null): string` and `rankRowLabel(code: string | null, name: string | null): string`.

- [ ] **Step 1: Write the failing tests**

`src/lib/staff/status-maps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { aiMatchLabel, applicationStatusPill, ATTENDANCE_STATUS, DEPLOYMENT_STATUS, LEAVE_STATUS } from "./status-maps";

describe("staff status maps", () => {
  it("labels leave as in leave.html", () => {
    expect(LEAVE_STATUS.pending).toEqual({ label: "For Approval", tone: "amber" });
    expect(LEAVE_STATUS.cancelled).toEqual({ label: "Cancelled", tone: "slate" });
  });
  it("labels deployments and attendance", () => {
    expect(DEPLOYMENT_STATUS.ongoing).toEqual({ label: "Ongoing", tone: "blue" });
    expect(ATTENDANCE_STATUS.incomplete).toEqual({ label: "Partial", tone: "amber" });
    expect(ATTENDANCE_STATUS.late.tone).toBe("rose");
  });
  it("labels the roster", () => {
    expect(applicationStatusPill("Pending")).toEqual({ label: "Pending", tone: "amber" });
    expect(applicationStatusPill("Application Submission")).toEqual({ label: "Pending / For Evaluation", tone: "amber" });
    expect(applicationStatusPill("Drug Test")).toEqual({ label: "Drug Test", tone: "blue" });
    expect(applicationStatusPill("Hired").tone).toBe("emerald");
    expect(applicationStatusPill("Not Selected").tone).toBe("rose");
  });
  it("names AI match scores", () => {
    expect(aiMatchLabel(5)).toBe("Excellent Match");
    expect(aiMatchLabel(4)).toBe("Good Match");
    expect(aiMatchLabel(3)).toBe("Fair Match");
    expect(aiMatchLabel(1)).toBe("Low Match");
    expect(aiMatchLabel(null)).toBeNull();
  });
});
```

`src/lib/staff/distribution.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { distributionRows } from "./distribution";

describe("distributionRows", () => {
  it("adds percentages of the total and widths relative to the largest", () => {
    expect(distributionRows([{ label: "ARMS", count: 7 }, { label: "IDMS", count: 4 }, { label: "SDEU", count: 0 }])).toEqual([
      { label: "ARMS", count: 7, percent: "63.6%", width: 100 },
      { label: "IDMS", count: 4, percent: "36.4%", width: 57.14285714285714 },
      { label: "SDEU", count: 0, percent: "0.0%", width: 0 },
    ]);
  });
  it("handles an empty station", () => {
    expect(distributionRows([{ label: "ARMS", count: 0 }])).toEqual([{ label: "ARMS", count: 0, percent: "0.0%", width: 0 }]);
  });
});
```

`src/lib/personnel/rank-category.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rankCategory, rankRowLabel } from "./rank-category";

describe("rank categories", () => {
  it("classifies commissioned, non-commissioned and civilian", () => {
    expect(rankCategory("PMAJ")).toBe("Commissioned Officer (PCO)");
    expect(rankCategory("PSSG")).toBe("Non-Commissioned (PNCO)");
    expect(rankCategory(null)).toBe("Civilian Staff");
  });
  it("labels rows as in dashboard.html", () => {
    expect(rankRowLabel("PMAJ", "Police Major")).toBe("Police Major (PMAJ)");
    expect(rankRowLabel(null, null)).toBe("Non-Uniformed Personnel (NUP)");
  });
});
```

`src/hooks/use-panel-param.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/hr/leave-requests",
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("status=pending&review=abc"),
}));

import { usePanelParam } from "./use-panel-param";

describe("usePanelParam", () => {
  it("reads and clears a panel param, keeping other params", () => {
    const { result } = renderHook(() => usePanelParam("review"));
    expect(result.current[0]).toBe("abc");
    act(() => result.current[1](null));
    expect(replace).toHaveBeenCalledWith("/hr/leave-requests?status=pending", { scroll: false });
    act(() => result.current[1]("xyz"));
    expect(replace).toHaveBeenLastCalledWith("/hr/leave-requests?status=pending&review=xyz", { scroll: false });
  });
});
```

`src/components/staff-shell/ui/staff-ui.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StaffModal } from "./staff-modal";
import { StaffSlideOver } from "./staff-slide-over";
import { StaffTableCard } from "./staff-table-card";

describe("staff UI primitives", () => {
  it("opens a titled modal that closes on Escape", async () => {
    const onClose = vi.fn();
    render(<StaffModal onClose={onClose} open subtitle="Approve or Decline application with required HR notes" title="Review Leave Request"><p>Body</p></StaffModal>);
    expect(screen.getByRole("dialog", { name: "Review Leave Request" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("opens a slide-over with a close button", async () => {
    const onClose = vi.fn();
    render(<StaffSlideOver onClose={onClose} open title="Create Deployment"><p>Form</p></StaffSlideOver>);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("pages a table", async () => {
    const onPageChange = vi.fn();
    render(<StaffTableCard pager={{ page: 1, pageSize: 10, total: 23, noun: "leave requests", onPageChange }} title="Leave Request Queue"><table><tbody /></table></StaffTableCard>);
    expect(screen.getByText("Showing 1–10 of 23 leave requests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("says when there is nothing to page", () => {
    render(<StaffTableCard pager={{ page: 1, pageSize: 10, total: 0, noun: "postings", onPageChange: vi.fn() }} title="Postings"><table><tbody /></table></StaffTableCard>);
    expect(screen.getByText("Showing 0 of 0 postings")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/staff src/lib/personnel src/hooks/use-panel-param.test.tsx src/components/staff-shell/ui`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the libraries**

`src/lib/staff/status-maps.ts`:

```ts
import type { AttendanceStatus, DeploymentStatus, LeaveRequestStatus, PromotionEvaluation } from "@/lib/types/database";
import type { ApplicationStatus } from "@/schemas/recruitment";

export type PillTone = "amber" | "emerald" | "rose" | "blue" | "slate";
type Pill = { label: string; tone: PillTone };

export const LEAVE_STATUS: Record<LeaveRequestStatus, Pill> = {
  pending: { label: "For Approval", tone: "amber" },
  approved: { label: "Approved", tone: "emerald" },
  rejected: { label: "Rejected", tone: "rose" },
  cancelled: { label: "Cancelled", tone: "slate" },
};

export const DEPLOYMENT_STATUS: Record<DeploymentStatus, Pill> = {
  scheduled: { label: "Scheduled", tone: "slate" },
  ongoing: { label: "Ongoing", tone: "blue" },
  completed: { label: "Completed", tone: "emerald" },
  cancelled: { label: "Cancelled", tone: "rose" },
};

export const ATTENDANCE_STATUS: Record<AttendanceStatus, Pill> = {
  present: { label: "Present", tone: "emerald" },
  late: { label: "Late", tone: "rose" },
  incomplete: { label: "Partial", tone: "amber" },
  absent: { label: "Absent", tone: "slate" },
};

export const RECOMMENDATION_STATUS: Record<PromotionEvaluation["recommendation"], Pill> = {
  recommended: { label: "Recommended", tone: "blue" },
  not_recommended: { label: "Not Recommended", tone: "rose" },
  deferred: { label: "Deferred", tone: "slate" },
};

/** Applicant Roster status pill (roster.html, PDF p. 22): "Pending" before anything is submitted. */
export function applicationStatusPill(status: ApplicationStatus | "Pending"): Pill {
  if (status === "Pending") return { label: "Pending", tone: "amber" };
  if (status === "Application Submission") return { label: "Pending / For Evaluation", tone: "amber" };
  if (status === "Hired") return { label: "Hired", tone: "emerald" };
  if (status === "Not Selected") return { label: "Not Selected", tone: "rose" };
  return { label: status, tone: "blue" };
}

export function aiMatchLabel(score: number | null) {
  if (score === null) return null;
  if (score >= 5) return "Excellent Match";
  if (score >= 4) return "Good Match";
  if (score >= 3) return "Fair Match";
  return "Low Match";
}
```

`src/lib/staff/distribution.ts`:

```ts
export function distributionRows(items: { label: string; count: number }[]) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const largest = Math.max(0, ...items.map((item) => item.count));
  return items.map((item) => ({
    ...item,
    percent: `${(total ? (item.count / total) * 100 : 0).toFixed(1)}%`,
    width: largest ? (item.count / largest) * 100 : 0,
  }));
}
```

`src/lib/personnel/rank-category.ts`:

```ts
// The ranks table has no category column; the PNP rank codes decide it.
const COMMISSIONED = new Set(["PGEN", "PLTGEN", "PMGEN", "PBGEN", "PCOL", "PLTCOL", "PMAJ", "PCPT", "PLT"]);
const NON_COMMISSIONED = new Set(["PEMS", "PCMS", "PSMS", "PMSG", "PSSG", "PCPL", "PAT"]);

export function rankCategory(code: string | null) {
  const value = code?.toUpperCase() ?? "";
  if (COMMISSIONED.has(value)) return "Commissioned Officer (PCO)";
  if (NON_COMMISSIONED.has(value)) return "Non-Commissioned (PNCO)";
  return "Civilian Staff";
}

export function rankRowLabel(code: string | null, name: string | null) {
  if (!code) return "Non-Uniformed Personnel (NUP)";
  return name ? `${name} (${code})` : code;
}
```

Check the seeded rank codes (`grep -n "insert into public.ranks" -A30 supabase/migrations/*ranks*reset*.sql supabase/seed.sql | head -60`) and add any PNP code missing from the two sets.

`src/hooks/use-panel-param.ts`:

```ts
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** One URL search param holding which panel is open (e.g. ?review=<id>), so panels survive reloads and links. */
export function usePanelParam(name: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(name);
  const set = useCallback((next: string | null) => {
    const updated = new URLSearchParams(params.toString());
    if (next === null) updated.delete(name);
    else updated.set(name, next);
    const query = updated.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [name, params, pathname, router]);
  return [value, set] as const;
}
```

`useSearchParams` needs a `<Suspense>` boundary for prerendering. Check `node_modules/next/dist/docs/` for "useSearchParams" to confirm. Every screen that uses `usePanelParam` is wrapped in `<Suspense>` in its `page.tsx` (Tasks 8–18).

- [ ] **Step 4: Implement the components**

`staff-buttons.ts`:

```ts
const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
export const staffButton = {
  primary: `${base} bg-blue-700 text-white shadow-md shadow-blue-900/20 hover:bg-blue-800`,
  dark: `${base} bg-slate-900 text-white shadow-md hover:bg-slate-800`,
  secondary: `${base} border border-slate-200 bg-white text-slate-700 hover:bg-slate-100`,
  danger: `${base} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`,
  success: `${base} bg-emerald-600 text-white shadow-md shadow-emerald-900/20 hover:bg-emerald-700`,
} as const;
export const staffIconButton = "rounded-lg p-2 text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600";
```

`status-pill.tsx`:

```tsx
import type { ReactNode } from "react";
import type { PillTone } from "@/lib/staff/status-maps";
import { cn } from "@/lib/utils";

const tones: Record<PillTone, string> = {
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

export function StatusPill({ tone, children, icon, className }: { tone: PillTone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase", tones[tone], className)}>
      {icon}{children}
    </span>
  );
}
```

`staff-fields.tsx`:

```tsx
import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const staffInputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-900 transition-all placeholder:text-slate-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none disabled:opacity-60";

export function StaffLabel({ children, required, className, ...props }: ComponentProps<"label"> & { required?: boolean }) {
  return <label className={cn("mb-1.5 block text-xs font-semibold text-slate-700", className)} {...props}>{children}{required ? <span aria-hidden="true" className="text-rose-500"> *</span> : null}</label>;
}
export function StaffInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(staffInputClass, className)} {...props} />;
}
export function StaffTextarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(staffInputClass, "resize-y", className)} {...props} />;
}
export function StaffSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(staffInputClass, "cursor-pointer appearance-none pr-9 font-semibold", className)} {...props}>{children}</select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-slate-500" />
    </div>
  );
}
```

`initials-avatar.tsx`:

```tsx
import { cn } from "@/lib/utils";

const tones = {
  blue: "bg-blue-100 border-blue-200 text-blue-800",
  emerald: "bg-emerald-100 border-emerald-300 text-emerald-800",
  purple: "bg-purple-100 border-purple-200 text-purple-800",
  rose: "bg-rose-100 border-rose-200 text-rose-800",
  slate: "bg-slate-100 border-slate-200 text-slate-700",
} as const;
const sizes = { sm: "size-8 text-[10px]", md: "size-9 text-xs", lg: "size-10 text-xs" } as const;

export function initialsOf(name: string) {
  return name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join("") || "?";
}

export function InitialsAvatar({ name, size = "md", tone = "blue" }: { name: string; size?: keyof typeof sizes; tone?: keyof typeof tones }) {
  return <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-full border font-extrabold", sizes[size], tones[tone])}>{initialsOf(name)}</span>;
}

/** A stable colour per person, so the same name always gets the same avatar tint. */
export function avatarTone(seed: string): keyof typeof tones {
  const order = ["blue", "purple", "emerald", "rose"] as const;
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return order[hash % order.length]!;
}
```

`page-title.tsx`:

```tsx
import type { ReactNode } from "react";

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
        <p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
```

`staff-modal.tsx`. This uses `@base-ui/react/dialog`; read `src/components/ui/dialog.tsx` for the Portal/Backdrop/Popup usage:

```tsx
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const sizes = { md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl", "2xl": "max-w-2xl" } as const;

export function StaffModal({ open, onClose, title, subtitle, icon, iconClassName, size = "lg", children, footer, footerClassName }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; icon?: ReactNode; iconClassName?: string;
  size?: keyof typeof sizes; children: ReactNode; footer?: ReactNode; footerClassName?: string;
}) {
  return (
    <Dialog.Root onOpenChange={(next) => { if (!next) onClose(); }} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm" />
        <Dialog.Popup className={cn("capstone-ui fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white font-sans text-slate-800 shadow-2xl", sizes[size])}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-5">
            <div className="flex min-w-0 items-center gap-3">
              {icon ? <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", iconClassName)}>{icon}</span> : null}
              <div className="min-w-0">
                <Dialog.Title className="text-sm font-bold text-slate-900">{title}</Dialog.Title>
                {subtitle ? <Dialog.Description className="text-[11px] text-slate-500">{subtitle}</Dialog.Description> : null}
              </div>
            </div>
            <Dialog.Close aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              <X aria-hidden="true" className="size-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 text-xs">{children}</div>
          {footer ? <div className={cn("flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4", footerClassName)}>{footer}</div> : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

`staff-slide-over.tsx`: the same structure, with:
- Popup: `capstone-ui fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white font-sans text-slate-800 shadow-2xl`, plus `max-w-lg` or `max-w-xl`.
- Header: `flex items-start justify-between border-b border-slate-200 bg-slate-50 p-6`.
- Title: `text-lg font-black text-slate-900`. Subtitle: `text-xs text-slate-500`.
- Close: `flex size-8 items-center justify-center rounded-xl bg-slate-200 text-slate-600 hover:bg-slate-300` with `aria-label="Close"`.
- Body: `flex-1 space-y-4 overflow-y-auto p-6 text-xs font-semibold text-slate-700`.
- Footer: `flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4`.

These classes come from `dep.html` lines 453–555 and `promotions.html` lines 377–503.

`staff-table-card.tsx`:

```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type Pager = { page: number; pageSize: number; total: number; noun: string; onPageChange: (page: number) => void };

const pagerButton = "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60";

export function StaffTableCard({ title, subtitle, count, toolbar, children, pager }: { title: string; subtitle?: string; count?: string; toolbar?: ReactNode; children: ReactNode; pager?: Pager }) {
  const pageCount = pager ? Math.max(1, Math.ceil(pager.total / pager.pageSize)) : 1;
  const from = pager && pager.total ? (pager.page - 1) * pager.pageSize + 1 : 0;
  const to = pager ? Math.min(pager.total, pager.page * pager.pageSize) : 0;
  return (
    <section aria-label={title} className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {count ? <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-extrabold text-blue-700">{count}</span> : null}
          </div>
          {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {toolbar ? <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{toolbar}</div> : null}
      </div>
      <div className="overflow-x-auto">{children}</div>
      {pager ? (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-500">
          <p>{pager.total ? `Showing ${from}–${to} of ${pager.total} ${pager.noun}` : `Showing 0 of 0 ${pager.noun}`}</p>
          <div className="flex gap-2">
            <button className={pagerButton} disabled={pager.page <= 1} onClick={() => pager.onPageChange(pager.page - 1)} type="button"><ChevronLeft aria-hidden="true" className="size-3" /> Previous</button>
            <button className={pagerButton} disabled={pager.page >= pageCount} onClick={() => pager.onPageChange(pager.page + 1)} type="button">Next <ChevronRight aria-hidden="true" className="size-3" /></button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** The mockup table classes, shared by every staff list. */
export const staffTable = {
  table: "w-full min-w-[760px] text-left text-xs",
  thead: "bg-slate-50 text-[11px] font-bold tracking-wider text-slate-500 uppercase",
  th: "px-4 py-3.5 first:pl-6 last:pr-6",
  tbody: "divide-y divide-slate-100 font-medium text-slate-700",
  tr: "transition-colors hover:bg-slate-50/80",
  td: "px-4 py-4 first:pl-6 last:pr-6",
} as const;
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/staff src/lib/personnel src/hooks/use-panel-param.test.tsx src/components/staff-shell/ui && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/staff-shell/ui src/hooks/use-panel-param* src/lib/staff src/lib/personnel
git commit -m "feat: Capstone UI staff primitives, panel URL state and status maps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Dashboard Overview `/hr` (`dashboard.html`)

**Files:**
- Create: `src/components/staff-dashboard/hr-dashboard-overview.tsx`, `distribution-card.tsx`, `pipeline-columns.tsx`, `attendance-doughnut.tsx`
- Modify: `src/app/(app)/hr/page.tsx`: render `HrDashboardOverview` instead of `WorkspaceDashboard role="hr_personnel"`
- Test: `src/components/staff-dashboard/hr-dashboard-overview.test.tsx`

**Interfaces:**
- Consumes:
  - `useHrDashboard({ startsOn, endsOn })`: `metrics.openJobs`, `breakdowns.workforceByDepartment`, `breakdowns.recruitmentPipeline`.
  - `useHrDashboardOverview()` (Task 2).
  - `usePromotionReadiness()`: `PromotionReadinessRow[]`.
  - `useRecentApplications()`.
  - `useHrDeployments({ page: 1, pageSize: 5 })`.
  - `distributionRows`, `rankCategory`, `rankRowLabel`, `StatusPill`, `InitialsAvatar`, `PageTitle` (Task 7).
- Produces: `HrDashboardOverview()`.

`WorkspaceDashboard` stays for Management; do not delete it.

- [ ] **Step 1: Write the failing test**

`hr-dashboard-overview.test.tsx`: mock the five hooks with `vi.mock("@/hooks/use-reporting", …)`, `vi.mock("@/hooks/use-promotion-eligibility", …)`, `vi.mock("@/hooks/use-recruitment", …)` and `vi.mock("@/hooks/use-deployment-tracking", …)`. Return:
- `overview`:

  ```ts
  {
    personnelByRank: [{ code: "PMAJ", name: "Police Major", count: 1 }, { code: null, name: null, count: 4 }],
    personnelByGender: [{ label: "male", count: 20 }, { label: "female", count: 8 }, { label: "unspecified", count: 0 }],
    attendanceToday: { present: 25, late: 1, incomplete: 1, absent: 0, onLeave: 1 },
  }
  ```

- `summary`: `metrics: { openJobs: 1 }`, `breakdowns.workforceByDepartment: [{ label: "ARMS", count: 7 }, { label: "IDMS", count: 4 }]`, and `recruitmentPipeline` with "Application Submission" 0, "Physical Agility Test" 1 and "Not Selected" 1.
- Readiness: two rows, one `isReady: true`.
- One recent application (Juan Dela Cruz, "Physical Agility Test").
- One deployment (status "ongoing").

Assertions:

```tsx
  it("matches dashboard.html with live numbers", async () => {
    render(<HrDashboardOverview />);
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard Overview" })).toBeInTheDocument();
    const kpi = (label: string) => screen.getByText(label).closest("article")!;
    expect(kpi("Total Active 201")).toHaveTextContent("28");
    expect(kpi("Present On Duty")).toHaveTextContent("25/ 28");
    expect(kpi("Present On Duty")).toHaveTextContent("89.3% Operational Strength");
    expect(kpi("Absent / Leave")).toHaveTextContent("1");
    expect(kpi("Partial / Late")).toHaveTextContent("2");
    expect(kpi("Plantilla Vacancies")).toHaveTextContent("1");
    expect(screen.getByText("Personnel Distribution by Unit")).toBeInTheDocument();
    expect(screen.getByText("Total: 28 Personnel")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Filter personnel distribution"), "ranks");
    expect(screen.getByText("Police Major (PMAJ)")).toBeInTheDocument();
    expect(screen.getByText("Non-Uniformed Personnel (NUP)")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Filter personnel distribution"), "gender");
    expect(screen.getByText("Male Personnel")).toBeInTheDocument();
    expect(screen.queryByText("Not specified")).not.toBeInTheDocument();
    expect(screen.getByText("2 Total Applicants")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to full attendance roster/i })).toHaveAttribute("href", "/hr/attendance");
    expect(screen.getByText(/1 personnel meet the criteria/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all applications/i })).toHaveAttribute("href", "/hr/applications");
    expect(screen.getByRole("link", { name: /view full roster/i })).toHaveAttribute("href", "/hr/deployments");
  });

  it("hides the Promotion Notice when nobody is ready", () => {
    readiness = [];
    render(<HrDashboardOverview />);
    expect(screen.queryByText(/Promotion Endorsement/)).not.toBeInTheDocument();
  });
```

Totals:
- Total Active 201 = sum of `personnelByGender` counts (28).
- Present On Duty = `present` (25) "/ 28", with operational strength `(25/28*100).toFixed(1)` = "89.3%".
- Absent / Leave = `absent + onLeave` (1).
- Partial / Late = `late + incomplete` (2).
- Total Applicants = sum of the `recruitmentPipeline` counts.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/staff-dashboard`
Expected: FAIL.

- [ ] **Step 3: Implement by porting `dashboard.html` lines 171–510**

- **Title** (lines 173–188): `PageTitle` with "Dashboard Overview" and subtitle `<>Real-time manpower analytics, daily attendance, and deployment status for <span className="font-bold text-slate-700">{formatDate(today)}</span>.</>`. The right-hand action is the static chip (`Calendar` icon and "Last 30 days", with the mockup chip classes).
- **KPI grid** (lines 190–253):
  - Five `<article>` tiles with the mockup classes, icon tiles and captions.
  - Caption for tile 1: "Active personnel", in `text-emerald-600` with `Check`.
  - Present: `{present}<span className="text-xs font-normal text-slate-400">/ {total}</span>`. Use `text-slate-500` there for contrast.
- **`DistributionCard`** (lines 261–294):
  - A `StaffSelect` with `aria-label="Filter personnel distribution"` and options `units` "Filter by Units", `ranks` "Filter by Ranks (Highest to Lowest)", `gender` "Filter by Gender".
  - **Units:** heading "Personnel Distribution by Unit", subtitle `Headcount breakdown across {n} station units`, footer `Showing {n} Station Units`.
    - Rows come from `distributionRows(workforceByDepartment)`.
    - Bar colours by position: `["bg-slate-900", "bg-slate-800", "bg-blue-800", "bg-blue-800", "bg-slate-700", "bg-slate-700", "bg-slate-700"]`, then `bg-teal-600`.
  - **Ranks:** heading "Personnel Distribution by Rank Hierarchy", subtitle "Rank structure sorted from Highest Rank to Lowest Rank", footer `Showing {n} Rank Classifications`.
    - Label: `rankRowLabel`, with `rankCategory` in brackets (`text-[10px] text-slate-500`).
    - Bars: `bg-slate-900/800/700` for PCO, `bg-blue-900`…`bg-blue-500` for PNCO in order, `bg-amber-600` for civilian.
  - **Gender:** heading "Personnel Distribution by Gender", subtitle "Demographic breakdown of Male and Female station personnel", footer "Showing Gender Distribution".
    - Two cards ("Male Personnel" with `Mars` and a blue-700 bar; "Female Personnel" with `Venus` and a pink-600 bar).
    - A third "Not specified" card only when its count is above 0.
  - Each row has a label, `font-mono` "{count} Personnel ({percent})", and an `h-3` bar in a `bg-slate-100` track with `style={{ width: `${width}%` }}`.
  - Footer: "Total: {total} Personnel".
- **`PipelineColumns`** (lines 296–326):
  - Card "Recruitment Pipeline Overview", subtitle "Vertical column breakdown of candidates per recruitment stage", pill "{n} Total Applicants".
  - An `h-80` flex row of columns (no chart library). Each column is a `w-6 rounded-t-md` bar with `style={{ height: `${max ? count / max * 100 : 0}%` }}` and min height 2px.
  - Colours: `bg-slate-300` when 0, `bg-blue-600` when above 0, `bg-rose-500` for "Not Selected".
  - Under each column, the stage label (`text-[9px] font-semibold text-slate-600`, wrapped).
  - Add a visually hidden `<table>` listing stage and count, for screen readers.
  - Legend footer: "Active Candidate", "Empty Stage", "Disqualified / Not Selected", and "Updated Real-Time".
- **`AttendanceDoughnut`** (lines 331–391):
  - "Daily Attendance Overview", "Real-time DTR & Attendance Status", and the "Live Log" badge.
  - A `size-44 rounded-full` element with `background: conic-gradient(#10b981 0 {p}%, #f59e0b {p}% {p+a}%, #f43f5e {p+a}% 100%)` and an inner white circle `inset-[14%]` holding `{total}` and "Total Active".
  - Segment order follows the mockup: Present emerald, Absent amber, Partial rose.
  - The three tinted rows: "Present", "Absent / Leave", "Partial / Late", each with count and percent.
  - "Go to Full Attendance Roster" is a `Link` to `/hr/attendance`.
- **Promotion Notice** (lines 393–411), only when the ready count is above 0:
  - Heading `Q{Math.floor(month / 3) + 1} Promotion Endorsement`.
  - Text `{n} personnel meet the criteria for regular promotion evaluation.`
  - "Review Endorsements" is a `Link` to `/hr/promotions` with the amber button classes.
- **Recent Applications / Recent Duty Deployments** (lines 414–510):
  - Read `hr-dashboard-attention.tsx` and `workspace-dashboard.tsx` for the field names that `useRecentApplications` returns.
  - Applications: `InitialsAvatar` with `avatarTone(name)`, the name, `{posting title} • {formatDate(submitted_at)}`, and `StatusPill` from `applicationStatusPill`.
  - Deployments: `MapPinned` in an emerald tile when ongoing, `Shield` in slate otherwise; `{rank code} {first initial}. {last name}` if available (else the full name); `{deployment_type ?? "Deployment"} • {location}`; `StatusPill` from `DEPLOYMENT_STATUS`.
  - Empty states: "No recent applications." and "No recent deployments." (`text-xs text-slate-500`).

- **Loading and errors:** each card shows the existing `LoadingState`/`ErrorState` (from `@/components/ui/`) inside the card while its own query loads or fails.

`src/app/(app)/hr/page.tsx`:

```tsx
import { HrDashboardOverview } from "@/components/staff-dashboard/hr-dashboard-overview";

export default function HrDashboardPage() {
  return <HrDashboardOverview />;
}
```

Keep the existing `metadata` export if the file has one.

- [ ] **Step 4: Run, typecheck and look**

Run: `npx vitest run src/components/staff-dashboard && npm run typecheck`. Expected: PASS.

Compare `/hr` with `dashboard.html` and PDF pp. 17–19 at 1366 px and 390 px. No horizontal overflow at 390 px.

- [ ] **Step 5: Commit**

```bash
git add src/components/staff-dashboard "src/app/(app)/hr/page.tsx"
git commit -m "feat: HR Dashboard Overview from the Capstone UI dashboard.html

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Recruitment Openings `/hr/jobs` (`jobpost.html`)

**Files:**
- Create: `src/components/recruitment/staff-job-postings.tsx` (+ test)
- Modify: `src/app/(app)/hr/jobs/page.tsx`

**Interfaces:**
- Consumes:
  - `useAllHrJobs()`. Read `hr-job-postings.tsx` for the row fields it uses (title, location, status, deadline field, application count, `updated_at`) and reuse them.
  - `useDeleteRecord("job_opening")` (`src/hooks/use-deletion.ts`).
  - `StaffTableCard`, `staffTable`, `StatusPill`, `PageTitle`, `staffButton`, `staffIconButton`, `notifyStaff`.

- [ ] **Step 1: Write the failing test**

`staff-job-postings.test.tsx`: mock `useAllHrJobs` with four jobs (one published with a deadline 3 days ahead, three closed) and `useDeleteRecord`. Assert:
- The heading "RECRUITMENT OPENINGS" and the link "Create Recruitment" with `href="/hr/jobs/new"`.
- Tab buttons named "All 4", "Published 1", "Draft 0" and "Closed 3". Clicking "Published 1" leaves one row.
- "Closes in 3 days" on the published row.
- The search box "Search job postings..." filters by title.
- Clicking the "Updated" header toggles sorting (`aria-sort` goes from `descending` to `ascending`).
- "View Posting" links to `/jobs/{id}`; "Edit Posting" links to `/hr/jobs/{id}`.
- Delete: mock `window.confirm` to return true. Clicking "Delete Posting" calls `mutateAsync(id)`. When it rejects with "This posting has applications.", `notifyStaff` is called with `tone: "error"` and that description.

Use fake timers or a fixed "today" for the deadline, e.g. `vi.setSystemTime(new Date("2026-10-11T08:00:00+08:00"))`.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/recruitment/staff-job-postings.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement by porting `jobpost.html` lines 147–378**

- **Title:** `PageTitle` "RECRUITMENT OPENINGS" with "Manage recruitment openings and vacancies for San Juan City Police Station." and a `Link` styled `staffButton.primary` with `Plus` and "Create Recruitment".
- **Tabs** (lines 168–186):
  - `role="tablist"` buttons `aria-pressed`. The active tab is `bg-white text-slate-900 shadow-sm rounded-lg`.
  - Count chips: `font-mono text-[10px] rounded-md px-1.5 py-0.5`. Published is emerald-100/emerald-800; the others slate.
  - The active tab is held in `?status=` via `usePanelParam("status")`, so dashboard links with `?status=published` keep working.
- **Search:** `StaffInput` with a `Search` icon, placeholder "Search job postings...", `aria-label="Search job postings"`.
- **Table columns:** Posting Title, Status, Applications, Deadline, Updated, Actions.
  - Sortable headers are `<button>`s inside `<th aria-sort>`, with `ArrowUpDown` or `ArrowDown`/`ArrowUp` at `size-2.5`.
  - The default sort is Updated, descending.
- **Cells:**
  - Title: `font-bold text-sm text-slate-900`, with the location sub-line `text-[11px] text-slate-500`.
  - Status: `StatusPill` (published emerald, draft slate, closed slate).
  - Applications: `font-mono font-bold text-sm`, `text-slate-900` or `text-slate-500` when 0.
  - Deadline: `formatDate`, then `text-[10px]` "Closes in N days" / "Closes today" (emerald-600) or "Closed" (slate-500).
- **Actions:**
  - `Link` View (`Eye`, `aria-label="View Posting"`, hover blue).
  - `Link` Edit (`SquarePen`, "Edit Posting", hover amber).
  - `button` Delete (`Trash2`, "Delete Posting", hover rose). It runs `window.confirm("Are you sure you want to delete this posting?")`, then `mutateAsync`, then `notifyStaff({ title: "Posting deleted" })`. On error: `notifyStaff({ title: "Could not delete posting", description: error.message, tone: "error" })`.
- **Pager:** client-side, 10 per page, noun "postings".

`src/app/(app)/hr/jobs/page.tsx`: render `<Suspense><StaffJobPostings /></Suspense>`.

- [ ] **Step 4: Run, typecheck and look**

Run: `npx vitest run src/components/recruitment/staff-job-postings.test.tsx && npm run typecheck`. Compare with `jobpost.html` and PDF p. 21.

- [ ] **Step 5: Commit**

```bash
git add src/components/recruitment/staff-job-postings* "src/app/(app)/hr/jobs/page.tsx"
git commit -m "feat: Recruitment Openings list from the Capstone UI jobpost.html

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Applicant Roster `/hr/applications` (`roster.html`, PDF p. 22)

**Files:**
- Create: `src/components/recruitment/staff-applicant-roster.tsx` (+ test)
- Modify: `src/app/(app)/hr/applications/page.tsx`
- Modify: `src/lib/recruitment/application-list.ts`: the `not-yet-applied` quick view label becomes "Pending"
- Modify: `src/components/recruitment/hr-registered-applicants.tsx:89`: the option label "Not yet applied" becomes "Pending"
- Modify: `src/components/recruitment/application-detail/application-header.tsx:65`: add `id="stage-actions"` and `className="… scroll-mt-24"` to the actions group
- Test: `src/lib/recruitment/application-list.test.ts` (update), `hr-registered-applicants` test if it asserts the old label

**Interfaces:**
- Consumes:
  - `useAllHrApplications`, `buildApplicationRows`, `QUICK_VIEWS`, `ApplicationListRow` (`src/lib/recruitment/application-list.ts`), and the registered-applicants hook used by `hr-applications.tsx`. Read `hr-applications.tsx` and `hr-applications-workspace.tsx` first; this component replaces their rendering and keeps their data flow.
  - `useTransitionApplicationStatus()`, `useAllHrJobs()`, `applicationStatusPill`, `aiMatchLabel`.
  - `RegisteredApplicantDrawer`.

- [ ] **Step 1: Write the failing tests**

Update `application-list.test.ts`: assert `QUICK_VIEWS.find((view) => view.value === "not-yet-applied")?.label` is `"Pending"`.

`staff-applicant-roster.test.tsx`, with one application row (Aldrick Jamlani, "2-02613", "Application Submission", AI 5) and one registered row (Maria Santos, no application). Assert:
- The heading "APPLICANT ROSTER".
- The segmented buttons "Applications" (pressed) and "Registered Applicants".
- Aldrick's row:
  - "ID: 2-02613"
  - the pill "Pending / For Evaluation"
  - "5 / 5" and "Excellent Match"
  - links "View Profile" → `/hr/applications/{id}` and "Edit Candidate" → `/hr/applications/{id}#stage-actions`
- Maria's row has the pill "Pending" and only one action button, "View Profile", which opens the drawer.
- Delete:
  - Click "Delete Candidate". A dialog "Disqualify or remove applicant?" opens.
  - Clicking "Disqualify" with an empty reason shows "Enter a reason." and does not call the mutation.
  - With "Failed requirements" typed, it calls the transition mutation with `{ applicationId, status: "Not Selected", note: "Failed requirements" }`. Check the real input shape of `useTransitionApplicationStatus` in `src/queries/recruitment.ts` and match it.
- The status filter has the options "Pending" and "Physical Agility Test".

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/recruitment/application-list.test.ts src/components/recruitment/staff-applicant-roster.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement by porting `roster.html` lines 147–313**

- **Header** (lines 149–167): "APPLICANT ROSTER", "Review and track candidates for recruitment openings.", and segmented buttons linked to `?view=applications|applicants` (keep `useUrlTab` or the param the workspace uses).
- **Filter bar** (lines 172–213):
  - Search "Search name or applicant number...".
  - "Recruitment Openings" select (real postings from `useAllHrJobs`).
  - "Status" select (Pending, then `PIPELINE_STAGES`, Hired, Not Selected).
  - "More filters": a popover holding the existing AI status / minimum score / quick-view controls from `hr-applications.tsx`.
  - These map onto `ApplicationListParams`: Pending → `quick: "not-yet-applied"`, a stage → `stage`, Hired → `quick: "hired"`, Not Selected → `quick: "not-selected"`.
- **Table** (lines 215–296): columns "Applicant", "Recruitment Opening", "Status", "AI Match Score", "Submitted", "Actions".
  - AI cell: `w-24 h-2` track `bg-slate-200` with an `emerald-500` fill at `score / 5 * 100%`, "n / 5" (`font-mono font-black text-emerald-700`), and a chip `text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5`. A "—" in slate-500 when there is no score.
- **Registered rows:** status `applicationStatusPill("Pending")`; opening and AI cells "—"; only the View button, which opens the existing `RegisteredApplicantDrawer`.
- **Delete:** `StaffModal` titled "Disqualify or remove applicant?" with subtitle "The application moves to Not Selected. This cannot be undone from the roster."
  - A required `StaffTextarea` labelled "Reason". The error "Enter a reason." uses `text-[10px] font-bold text-rose-500`.
  - Buttons: Cancel, and **Disqualify** (`staffButton.danger`, disabled while pending).
  - On success: `notifyStaff({ title: "Applicant disqualified" })`.
- The **Registered Applicants** view renders the same table component over registered rows only, with the existing filter (now labelled "Pending").
- **Pager:** 10 per page, noun "applications".

`page.tsx`: `<Suspense><StaffApplicantRoster /></Suspense>`. If `HrApplicationsWorkspace` is still imported elsewhere, keep it; otherwise delete it with its test.

- [ ] **Step 4: Run, typecheck and look**

Run: `npx vitest run src/lib/recruitment src/components/recruitment && npm run typecheck`. Expected: PASS. Fix any older `hr-applications` tests that assert "Not yet applied" by changing them to "Pending". Compare with `roster.html` and PDF p. 22.

- [ ] **Step 5: Commit**

```bash
git add src/components/recruitment src/lib/recruitment "src/app/(app)/hr/applications/page.tsx"
git commit -m "feat: Applicant Roster from the Capstone UI roster.html; registered applicants show Pending

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Documents on Eligibility and Certification / Training (PDF p. 23)

**Files:**
- Modify: `src/queries/personnel-records.ts`: both kinds upload; add `replacePersonnelDocument` and `removePersonnelDocument`; storage cleanup after delete
- Modify: `src/hooks/use-personnel-records.ts`: `useReplacePersonnelDocument`, `useRemovePersonnelDocument`
- Create: `src/components/personnel-records/document-upload-dialog.tsx`, `record-document-row.tsx`
- Modify: `src/components/personnel-records/employee-record-detail.tsx` (`Records`, around line 80–112), `record-entry-form.tsx` (lines 120–122 and 215–224)
- Test: `src/queries/personnel-documents.test.ts` (extend), `src/components/personnel-records/document-upload-dialog.test.tsx`, `record-document-row.test.tsx`

**Interfaces:**
- Produces:
  - `type DocumentKind = "qualification" | "certification"`
  - `validatePersonnelDocument(file: File): string | null`, returning an error message or null. Rules: PDF/PNG/JPEG/WEBP, 1 B–10 MB.
  - `savePersonnelEntry(kind, input, id?, document?)`, unchanged signature, now uploading for both kinds.
  - `replacePersonnelDocument(kind: DocumentKind, entry: { id: string; employee_id: string; document_path: string | null }, file: File): Promise<PersonnelEntry>`
  - `removePersonnelDocument(kind: DocumentKind, entry: { id: string; document_path: string }): Promise<void>`
  - `DocumentUploadDialog({ open, onClose, onSave, saving }: { open: boolean; onClose: () => void; onSave: (file: File) => Promise<void>; saving: boolean })`
  - `RecordDocumentRow({ kind, entry, canEdit }: { kind: DocumentKind; entry: PersonnelEntry; canEdit: boolean })`

- [ ] **Step 1: Write the failing tests**

Extend `src/queries/personnel-documents.test.ts`, keeping its existing mock style for the storage bucket and `from()`. Add:

```ts
  it("uploads a certification document under certifications/<employee>/", async () => {
    await savePersonnelEntry("certification", { employeeId: EMPLOYEE_ID, name: "PSBRC", issuedOn: "2016-03-14" }, undefined, pdf("psbrc.pdf"));
    expect(mocks.upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^certifications/${EMPLOYEE_ID}/[0-9a-f-]{36}\\.pdf$`)), expect.any(File), expect.objectContaining({ contentType: "application/pdf", upsert: false }));
  });

  it("replaces a document: upload new, update row, then remove the old object", async () => {
    await replacePersonnelDocument("certification", { id: "c1", employee_id: EMPLOYEE_ID, document_path: `certifications/${EMPLOYEE_ID}/old.pdf` }, pdf("new.pdf"));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ document_name: "new.pdf", document_mime_type: "application/pdf" }));
    expect(mocks.remove).toHaveBeenLastCalledWith([`certifications/${EMPLOYEE_ID}/old.pdf`]);
  });

  it("keeps the old document and removes the new upload when the row update fails", async () => {
    mocks.updateResult = { data: null, error: { message: "denied" } };
    await expect(replacePersonnelDocument("qualification", { id: "q1", employee_id: EMPLOYEE_ID, document_path: `qualifications/${EMPLOYEE_ID}/old.pdf` }, pdf("new.pdf"))).rejects.toThrow("denied");
    expect(mocks.remove).toHaveBeenCalledWith([expect.stringMatching(/^qualifications\/.+\/[0-9a-f-]{36}\.pdf$/)]);
    expect(mocks.remove).not.toHaveBeenCalledWith([`qualifications/${EMPLOYEE_ID}/old.pdf`]);
  });

  it("removes a document: clear the row, then the object", async () => {
    await removePersonnelDocument("qualification", { id: "q1", document_path: `qualifications/${EMPLOYEE_ID}/old.pdf` });
    expect(mocks.update).toHaveBeenCalledWith({ document_path: null, document_name: null, document_mime_type: null, document_size_bytes: null });
    expect(mocks.remove).toHaveBeenCalledWith([`qualifications/${EMPLOYEE_ID}/old.pdf`]);
  });

  it("rejects the wrong file type before uploading", () => {
    expect(validatePersonnelDocument(new File(["x"], "clip.mp4", { type: "video/mp4" }))).toBe("Use a PDF, JPEG, PNG or WEBP file up to 10 MB.");
  });
```

Adapt the helper names (`pdf()`, `EMPLOYEE_ID`, `mocks.*`) to the file's existing mock setup; add `update`/`updateResult` to it if it lacks them.

`document-upload-dialog.test.tsx`:

```tsx
  it("matches the p. 23 dialog and saves the chosen file", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<DocumentUploadDialog onClose={vi.fn()} onSave={onSave} open saving={false} />);
    expect(screen.getByRole("dialog", { name: "Upload files" })).toBeInTheDocument();
    expect(screen.getByText("Choose a file or drag & drop it here")).toBeInTheDocument();
    expect(screen.getByText("PDF, JPEG, PNG or WEBP formats, up to 10 MB")).toBeInTheDocument();
    const file = new File(["%PDF"], "my-cv.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText("Browse File"), file);
    expect(screen.getByText("my-cv.pdf")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save document" }));
    expect(onSave).toHaveBeenCalledWith(file);
  });

  it("refuses a video and a file over 10 MB", async () => {
    render(<DocumentUploadDialog onClose={vi.fn()} onSave={vi.fn()} open saving={false} />);
    await userEvent.upload(screen.getByLabelText("Browse File"), new File(["x"], "clip.mp4", { type: "video/mp4" }), { applyAccept: false });
    expect(screen.getByRole("alert")).toHaveTextContent("Use a PDF, JPEG, PNG or WEBP file up to 10 MB.");
    expect(screen.getByRole("button", { name: "Save document" })).toBeDisabled();
  });

  it("shows Uploading… and blocks a second save while saving", () => {
    render(<DocumentUploadDialog onClose={vi.fn()} onSave={vi.fn()} open saving />);
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });
```

`record-document-row.test.tsx`:
- With a document: the file name, an "Open {name}" button, and "Replace" and "Remove" buttons when `canEdit`.
- Remove asks `window.confirm("Remove the uploaded document for PSBRC?")` and calls the remove mutation.
- Without a document and with `canEdit`: an "Upload document" button that opens the dialog.
- With `canEdit={false}`: no Replace, Remove or Upload buttons.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/queries/personnel-documents.test.ts src/components/personnel-records`. Expected: FAIL.

- [ ] **Step 3: Implement the queries**

In `src/queries/personnel-records.ts`:

```ts
export type DocumentKind = "qualification" | "certification";
const documentFolders: Record<DocumentKind, string> = { qualification: "qualifications", certification: "certifications" };
const documentTables: Record<DocumentKind, "qualifications" | "certifications"> = { qualification: "qualifications", certification: "certifications" };
const DOCUMENT_ERROR = "Use a PDF, JPEG, PNG or WEBP file up to 10 MB.";

export function validatePersonnelDocument(file: File) {
  return documentExtensions[file.type] && file.size >= 1 && file.size <= 10 * 1024 * 1024 ? null : DOCUMENT_ERROR;
}

async function uploadPersonnelDocument(kind: DocumentKind, employeeId: string, file: File) {
  const problem = validatePersonnelDocument(file);
  if (problem) throw new Error(problem);
  const path = `${documentFolders[kind]}/${employeeId}/${crypto.randomUUID()}.${documentExtensions[file.type]}`;
  const { error } = await createBrowserSupabaseClient().storage.from(personnelDocumentBucket).upload(path, file, { contentType: file.type, upsert: false });
  throwIfError(error);
  return { document_path: path, document_name: file.name.slice(0, 255), document_mime_type: file.type, document_size_bytes: file.size };
}

async function removeStoredDocument(path: string) {
  // Best effort: a leftover object is harmless, a failed save is not.
  await createBrowserSupabaseClient().storage.from(personnelDocumentBucket).remove([path]).catch(() => undefined);
}
```

- **`savePersonnelEntry`:** replace the `document && kind === "qualification"` block with `document && (kind === "qualification" || kind === "certification")`, using `uploadPersonnelDocument`. On failure, call `removeStoredDocument(uploaded.document_path)`.
- **`replacePersonnelDocument`:** upload, then `update(fields).eq("id", entry.id).select("*").single()`.
  - On error: remove the new object and throw.
  - On success: when `entry.document_path` is set, remove the old object, then return the row.
- **`removePersonnelDocument`:** `update({ document_path: null, document_name: null, document_mime_type: null, document_size_bytes: null }).eq("id", entry.id)`. Throw on error; otherwise remove the object.
- **Deletes:** `src/queries/deletion.ts` `deleteRecord`: after a successful delete of `qualification` or `certification`, the caller passes the entry's `document_path`. Add an optional `afterDelete?: () => Promise<void>` parameter to `useDeleteRecord`'s mutation (or to the call in `employee-record-detail.tsx`), and run `removeStoredDocument` there. Keep `deleteRecord`'s signature unchanged for other callers. Export `removeStoredDocument` as `removePersonnelDocumentObject` for that use.

Hooks in `use-personnel-records.ts`: `useReplacePersonnelDocument(kind, employeeId)` and `useRemovePersonnelDocument(kind, employeeId)`. On success, both invalidate the same query key as `usePersonnelEntries(kind, employeeId)`.

- [ ] **Step 4: Implement the dialog and row**

`document-upload-dialog.tsx` is built on `@base-ui/react/dialog` (like `StaffModal`) but styled like the p. 23 screenshot:
- **Popup:** `capstone-ui … w-[calc(100%-2rem)] max-w-lg rounded-3xl bg-white p-6 shadow-2xl`.
- **Header row:** a `size-12 rounded-full border border-slate-200` circle with `CloudUpload`, the title "Upload files" (`text-lg font-semibold text-slate-900`), and the description "Select and upload the file of your choice." (`text-sm text-slate-500`). On the right, a close button `aria-label="Close"` with `CircleX` (`size-6 text-slate-400 hover:text-slate-600`). A `border-b border-slate-200 pb-5` divider follows.
- **Drop zone:** `mt-5 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 text-center`. It has `onDragOver` (preventDefault, and add `border-blue-500 bg-blue-50/40`), `onDragLeave`, and `onDrop` (take `dataTransfer.files[0]`). It contains:
  - `CloudUpload` (`size-7 text-slate-700`)
  - "Choose a file or drag & drop it here" (`text-sm font-medium text-slate-900`)
  - "PDF, JPEG, PNG or WEBP formats, up to 10 MB" (`text-xs text-slate-500`)
  - a `<label>` styled as the "Browse File" button (`mt-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-600`), wrapping a visually hidden `<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" aria-label="Browse File">`
- **Chosen file row:** `mt-4 flex items-center gap-3 rounded-xl bg-slate-100 p-3`. It has a file icon (`FileText`, with a small red "PDF" tag `absolute -bottom-1 -left-1 rounded bg-red-600 px-1 text-[9px] font-bold text-white` for PDFs, `Image` otherwise), the name (`text-sm font-medium text-slate-900 truncate`), and `{formatBytes(size)}`. While `saving`, it adds ` • ` + `Loader2 animate-spin text-blue-600` + "Uploading…". A remove button `aria-label="Remove {name}"` with `CircleX` sits on the right.
- **Validation error:** `role="alert"`, `text-xs font-bold text-rose-600`.
- **Footer:** `mt-6 flex justify-end gap-2`, with Cancel (`staffButton.secondary`) and **Save document** (`staffButton.primary`). Save is disabled without a valid file or while `saving`; it shows "Saving…" while saving.

Add `formatBytes(bytes)` to `src/lib/format-bytes.ts` if no such helper exists (`grep -rn "function formatBytes\|formatFileSize" src/lib`): "60 KB", "1.2 MB".

`record-document-row.tsx`:
- **With a document:** a row `flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3`, holding the icon, the name and the size.
  - An eye button `aria-label="Open {document_name}"` calls `getPersonnelDocumentUrl` and opens it in a new tab with `window.open(url, "_blank", "noopener")`.
  - When `canEdit`: "Replace" (opens the dialog; `onSave` calls replace) and "Remove" (confirm, then remove).
- **Without a document and `canEdit`:** an "Upload document" button opening the dialog; `onSave` calls replace with `document_path: null`.
- **Toasts:** "Document uploaded", "Document replaced", "Document removed". Errors show `tone: "error"` with the message.

In `employee-record-detail.tsx`, `Records` renders `<RecordDocumentRow kind=… entry=… canEdit={isHr} />` under each qualification and certification entry. It replaces the existing "View" document button at line ~112. `isHr` is what the page already uses to decide editing (`mode=edit` availability); check how the component decides it. Employees viewing their own record see only the open button.

In `record-entry-form.tsx`, replace the bare file input (lines 215–224) with a "Supporting document" field:
- A button "Choose document" opens `DocumentUploadDialog`. Its `onSave` just stores the file in form state and closes; the actual upload happens on form submit through `savePersonnelEntry`.
- The chosen file name and a "Remove" link show under the button.
- Show this field for `kind === "qualification"` (required on new entries, as today) and for `kind === "certification"` (optional).

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/queries/personnel-documents.test.ts src/components/personnel-records src/hooks/use-personnel-records.test.tsx && npm run typecheck`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/queries/personnel-records.ts src/queries/personnel-documents.test.ts src/queries/deletion.ts src/hooks/use-personnel-records.ts src/hooks/use-deletion.ts src/components/personnel-records src/lib/format-bytes*
git commit -m "feat: upload, replace and remove documents on Eligibility and Certification / Training

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Deployments `/hr/deployments` with the side panel (`dep.html`, PDF pp. 24–25)

**Files:**
- Create: `src/components/deployment-tracking/staff-deployments.tsx`, `deployment-panel.tsx` (+ tests)
- Modify: `src/app/(app)/hr/deployments/page.tsx`
- Modify: `src/app/(app)/hr/deployments/new/page.tsx` → `redirect("/hr/deployments?create=1")`
- Modify: `src/app/(app)/hr/deployments/[id]/edit/page.tsx` → `redirect(`/hr/deployments?edit=${id}`)`. Await `params` the way the file already does.
- Modify: `src/components/deployment-tracking/hr-deployment-details.tsx:38`: the Update link goes to `/hr/deployments?edit=${id}`

**Interfaces:**
- Consumes:
  - `useHrDeployments(filters)`, `useDeployment(id)`, `useCreateDeployment()`, `useUpdateDeployment()`, `useEmployeeOptions()`.
  - The validation schema `DeploymentForm` uses. Read `deployment-form.tsx`; reuse its schema and its input-building function, extracting them to `src/lib/deployment-tracking/deployment-input.ts` if they are inline.
  - `DEPLOYMENT_STATUS`, `StaffSlideOver`, `usePanelParam`.

- [ ] **Step 1: Write the failing tests**

`staff-deployments.test.tsx` (mock the hooks):
- The heading "DEPLOYMENTS" and a button "New Deployment".
- Clicking it sets `?create=1`: assert the `usePanelParam` setter was called with `"1"`, or render with `?create=1` and assert the dialog "Create Deployment".
- Rows show "Badge: 0-11152", "Oct 13, 2026 – Oct 13, 2026" rendered as `formatDateRange`, and status pills.
- "Delete Deployment" on an ongoing row: confirm "Cancel or delete this deployment?", then `update.mutateAsync` with the row's existing fields, `status: "cancelled"`, and `expectedUpdatedAt: row.updated_at`. `update_deployment` validates the whole record, so send every field it requires; read `updateDeployment` in `src/queries/deployment-tracking.ts`.
- There is no Delete button on a cancelled row.
- The type filter lists exactly "Public Assembly", "Special Event", "Election Security" and "Disaster Response".

`deployment-panel.test.tsx`:
- **Create:**
  - Labels "Employee", "Location", "Deployment Type", "Event / Operation", "Status", "Start Date", "End Date", "Remarks / Instructions".
  - The help texts "Search active station personnel by full name or badge ID." and "Optional. Leave blank for ongoing duty."
  - Saving with empty fields shows the schema's errors and does not call create.
  - Filling everything and clicking **Save** calls `create.mutateAsync` once; a second click while pending does nothing (the button is disabled).
  - Then `notifyStaff({ title: "Deployment saved" })`, and `onClose`.
- **Edit with an unknown id:** `useDeployment` returns an error → the panel shows "This deployment could not be found." with only a Close button.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/deployment-tracking`. Expected: FAIL.

- [ ] **Step 3: Implement by porting `dep.html` lines 147–555**

- **List** (lines 149–449):
  - `PageTitle` "DEPLOYMENTS" with "Create and manage personnel deployments without losing their history." and "New Deployment".
  - Filters: search "Search employee name or badge number..." (5 columns), Type (4), Status (3), in a 12-column grid.
  - They map onto `DeploymentFilters`; check `deploymentFiltersSchema` for the field names, and add `deploymentType` there if missing, with a matching query `.eq("deployment_type", …)`.
  - Table columns Employee, Location, Type / Event, Dates, Status, Actions.
  - **Actions:**
    - `Link` View → `/hr/deployments/{id}`.
    - Edit button → `setEdit(id)`.
    - Delete button (not for cancelled rows) → confirm, then update to cancelled. Toast "Deployment cancelled".
  - Server pager on `page`.
- **Panel** (lines 453–555):
  - `StaffSlideOver size="lg"`, open when `create === "1"` or `edit` is set.
  - Title "Create Deployment" or "Edit Deployment", subtitle "Assign an employee to a duty location and operation.".
  - Fields use the `Staff*` inputs and the mockup grid (`grid grid-cols-1 gap-4 sm:grid-cols-2` for the paired rows).
  - The Employee field reuses the existing employee search control from `DeploymentForm` (read it; it may be a combobox over `useEmployeeOptions`), restyled with `staffInputClass`, with the `ShieldUser` icon and placeholder "Type a name or badge number...".
  - Required markers follow the schema.
  - **Footer:** Cancel (`staffButton.secondary`) and **Save** (`staffButton.primary`, disabled while pending).
  - **On submit:** `create`, or `update` with `expectedUpdatedAt: deployment.updated_at`. On success: toast, `setCreate(null)`/`setEdit(null)`, refetch. On error: `notifyStaff({ title: "Could not save deployment", description, tone: "error" })` and keep the panel open.

`page.tsx`: `<Suspense><StaffDeployments /></Suspense>`. `HrDeploymentEditor` is no longer used by any page; delete it and its test if nothing else imports it.

- [ ] **Step 4: Run, typecheck and look**

Run: `npx vitest run src/components/deployment-tracking && npm run typecheck`. Compare with `dep.html` and PDF pp. 24–25.

- [ ] **Step 5: Commit**

```bash
git add src/components/deployment-tracking src/lib/deployment-tracking src/schemas src/queries/deployment-tracking.ts "src/app/(app)/hr/deployments"
git commit -m "feat: Deployments list and Create Deployment side panel from the Capstone UI dep.html

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13: Leave Management `/hr/leave-requests` (`leave.html`, PDF pp. 26–27)

**Files:**
- Create: `src/components/leave-management/staff-leave.tsx`, `leave-review-modal.tsx`, `leave-details-modal.tsx`, `leave-policy-modal.tsx`, `src/lib/leave-management/leave-type-style.ts` (+ tests)
- Modify: `src/app/(app)/hr/leave-requests/page.tsx`
- Modify: `src/app/(app)/hr/leave-requests/[requestId]/page.tsx` → a server redirect. It loads the request status with the server Supabase client, then redirects to `?review=<id>` (pending) or `?view=<id>` (otherwise).
- Modify: `src/components/leave-management/leave-request-table.tsx`, which the old dashboard attention tab uses: its link goes to `/hr/leave-requests?review=${id}` for pending and `?view=${id}` otherwise

**Interfaces:**
- Consumes:
  - `useLeaveTypes()`, `useHrLeaveRequests(filters)`, `useLeaveRequest(id)`, `useEmployeeLeaveBalances(employeeId, year)`, `useLeaveAttachmentUrl(path)`.
  - `useDecideLeaveRequest()`, `useUpdateLeaveType()`, `useSetLeaveTypeAllotment()`.
  - Read `hr-leave.tsx` (`HrLeaveDetail`, lines 110–251) for how it loads attachments and balances, and for the exact `decideLeaveRequest` input (`leaveDecisionSchema` in `src/schemas/leave-management.ts`).
  - Read `leave-type-manager.tsx` for the update inputs.
- Produces: `leaveTypeStyle(name: string): { Icon: LucideIcon; tone: "blue" | "purple" | "emerald" | "rose" | "amber" | "slate"; footnote: string }`.

- [ ] **Step 1: Write the failing tests**

`src/lib/leave-management/leave-type-style.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { leaveTypeStyle } from "./leave-type-style";

describe("leaveTypeStyle", () => {
  it("uses the leave.html icon, colour and footnote", () => {
    expect(leaveTypeStyle("Maternity Leave")).toMatchObject({ tone: "purple", footnote: "Full pay for female personnel." });
    expect(leaveTypeStyle("Sick Leave")).toMatchObject({ tone: "rose", footnote: "Requires medical certificate." });
    expect(leaveTypeStyle("Special Privilege Leave").tone).toBe("amber");
  });
  it("falls back for other leave types", () => {
    expect(leaveTypeStyle("Study Leave")).toMatchObject({ tone: "slate", footnote: "" });
  });
});
```

The map, matched case-insensitively on the name:
- **Mandatory** → `CalendarCheck`, blue, "Standard yearly entitlement."
- **Maternity** → `Baby`, purple, "Full pay for female personnel."
- **Paternity** → `Users`, emerald, "Married male personnel."
- **Sick** → `Stethoscope`, rose, "Requires medical certificate."
- **Special Privilege** → `Star`, amber, "Non-cumulative entitlement."

`staff-leave.test.tsx` (mock the hooks):
- The heading "Leave Management" and "Annual Leave Entitlements" with "5 Active Categories".
- A card "Maternity Leave" showing "105 Days" and "/ Year". A type with `days_per_year: null` shows "No limit".
- "Update Policy: Maternity Leave" opens the policy modal, with "Allowed Days Per Year" holding 105.
- A pending row shows "For Approval" and a "Review" button. An approved row has "View Details" but no edit pen.
- The status filter has an option "Cancelled".

`leave-review-modal.test.tsx`:

```tsx
  it("requires HR remarks before approving or declining", async () => {
    render(<LeaveReviewModal onClose={onClose} requestId="r1" />);
    expect(screen.getByRole("dialog", { name: "Review Leave Request" })).toBeInTheDocument();
    expect(screen.getByText("Badge: 4-15889")).toBeInTheDocument();
    expect(screen.getByText("Balance: 1 of 2 days")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve Request" }));
    expect(screen.getByText("HR Remarks are required to proceed.")).toBeInTheDocument();
    expect(decide.mutateAsync).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Decline Request" }));
    expect(decide.mutateAsync).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/HR Remarks \/ Notes/), "Endorsed by Station Admin.");
    await userEvent.click(screen.getByRole("button", { name: "Approve Request" }));
    expect(decide.mutateAsync).toHaveBeenCalledTimes(1);
    expect(decide.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ decision: "approved", note: "Endorsed by Station Admin." }));
  });

  it("says when the request was already decided", () => {
    request = { ...request, status: "approved" };
    render(<LeaveReviewModal onClose={onClose} requestId="r1" />);
    expect(screen.getByText("This leave request was already decided.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve Request" })).not.toBeInTheDocument();
  });
```

Match the real `decideLeaveRequest` input keys (they may be `requestId`, `status` and `decisionNote`).

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/leave-management src/components/leave-management`. Expected: FAIL.

- [ ] **Step 3: Implement by porting `leave.html` lines 147–500**

- **Title:** `PageTitle` "Leave Management", "Manage leave entitlement policies and process employee leave applications.". No "File Leave Application" button.
- **Entitlements** (lines 162–270):
  - The `Layers` heading "Annual Leave Entitlements" and "{n} Active Categories" (`text-[11px] font-semibold text-slate-500`).
  - Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4`; one card per active type, with the mockup classes and the tone's 50/200/700 tile.
  - Pen button `aria-label="Update Policy: {name}"`.
  - Label `text-[10px] font-extrabold text-slate-500 uppercase`; value `text-xl font-black`, "{days} Days" + "/ Year", or "No limit".
  - Footnote box: the type's `description` if set, else `leaveTypeStyle(name).footnote`, else hidden.
- **Policy modal** (lines 471–500): `StaffModal size="md"`, titled "Update Policy: {name}".
  - Fields: "Allowed Days Per Year" (number, `font-mono font-bold`, blank = no limit), then "Name" and "Description".
  - Save calls the same mutations `LeaveTypeManager` uses. Toast "Leave policy updated".
- **Queue** (lines 272–333):
  - `StaffTableCard` "Leave Request Queue", subtitle "Review pending and processed personnel leave applications".
  - Search "Search employee or badge no..." and the status select.
  - Columns: EMPLOYEE, LEAVE TYPE, INCLUSIVE DATES, SUBMITTED, STATUS, ACTIONS.
  - Pending rows get `bg-amber-50/20`.
  - **Actions:**
    - Pending: a `Review` button (`FileSignature`, `bg-blue-700 text-white rounded-lg px-3 py-1.5 text-[11px] font-bold`), with `aria-label="Review {name}'s {type} leave request, {dates}"`. `e2e/business-journeys` relies on that name; keep it.
    - Others: an `Eye` button "View Details" (`aria-label="View {name}'s {type} leave request, {dates}"`).
  - Server pager.
- **Review modal** (lines 339–405): `StaffModal size="lg"`, icon `FileSignature` (`bg-blue-100 text-blue-700`), title "Review Leave Request", subtitle "Approve or Decline application with required HR notes".
  - **Summary box:** name, "Badge: {number}" (`font-mono text-[10px]`), the type pill, then "Inclusive Dates:" / "Submitted:" (labels slate-500), plus "Balance: {remaining} of {allotment} days" when the type has an allotment, plus attachment links ("Attachment: {file_name}", opening the signed URL).
  - **Textarea:** label "HR Remarks / Notes", required, hint "Required before approving or declining", placeholder "Enter justification, endorsement details, or reason for decline...".
  - **Footer** (`justify-between`):
    - Cancel (`staffButton.secondary`).
    - Decline Request (`X`, `staffButton.danger`).
    - Approve Request (`Check`, `staffButton.success`).
    - All are disabled while the mutation is pending.
  - **Outcome:** toast "Leave request approved" or "Leave request declined", `setReview(null)`.
  - **Not-pending request:** the body shows "This leave request was already decided." with only a Close button.
  - **Load error:** the body shows "This leave request could not be found." with only a Close button.
- **Details modal** (lines 407–469): icon `Eye` (`bg-slate-200 text-slate-700`), "Leave Application Details", "Historical record and processing remarks".
  - Key/value rows: Employee Name, Badge ID, Leave Type, Inclusive Dates, Date Submitted, Current Status.
  - "HR Processing Notes / Remarks:" box (`bg-slate-50 italic`) with `decision_note`, or "No HR processing notes provided.".
  - Footer: "Close Window" (`staffButton.dark`).

`page.tsx`: `<Suspense><StaffLeave /></Suspense>`. Remove `HrLeaveWorkspace`, `HrLeaveQueue` and `HrLeaveDetail` once nothing imports them (`grep -rn "HrLeaveDetail\|HrLeaveQueue\|HrLeaveWorkspace" src`). Delete or adapt their tests.

- [ ] **Step 4: Run, typecheck and look**

Run: `npx vitest run src/lib/leave-management src/components/leave-management && npm run typecheck`. Compare with `leave.html` and PDF pp. 26–27.

- [ ] **Step 5: Commit**

```bash
git add src/components/leave-management src/lib/leave-management "src/app/(app)/hr/leave-requests"
git commit -m "feat: Leave Management with in-place Review from the Capstone UI leave.html

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Promotions Evaluation `/hr/promotions` (`promotions.html`, PDF pp. 28–30)

**Files:**
- Create: `src/components/promotion-eligibility/staff-promotions.tsx`, `criteria-slide-over.tsx`, `promotion-review-modal.tsx` (+ tests)
- Modify: `src/components/promotion-eligibility/promotion-criteria-manager.tsx`: extract `CriterionForm` and the criteria list logic into hooks or components that `criteria-slide-over.tsx` reuses, restyled
- Modify: `src/app/(app)/hr/promotions/page.tsx`, `criteria/page.tsx` (→ `redirect("/hr/promotions?criteria=1")`), `[employeeId]/page.tsx` (→ `redirect(`/hr/promotions?review=${employeeId}`)`)
- Modify: `src/components/personnel-records/employee-record-detail.tsx:354`: the link becomes `/hr/promotions?review=${record.id}`

**Interfaces:**
- Consumes:
  - `usePromotionReadinessPage(filters)`, `usePromotionCriteria({ isActive })`, `useHrPromotionEmployee(id)`, `usePromotionReadiness(id)`.
  - `useCreatePromotionCriterion()`, `useSetPromotionCriterionActive()`, `useDeleteRecord("promotion_criterion")`, `useCreatePromotionEvaluation()`.
  - `PerformanceEvaluation` (existing, `performance-evaluation.tsx`), `RECOMMENDATION_STATUS`.
  - Read `hr-promotion-review.tsx` fully: the modal keeps its data flow (criterion choice, readiness "as of today", recommendation, notes, `create_promotion_evaluation` input) and only changes layout.

- [ ] **Step 1: Write the failing tests**

`staff-promotions.test.tsx`:
- The heading "Promotions Evaluation" and the banner title "Promotion Board Guidelines".
- A row "Peters, Tyson" with "PMSG — Police Master Sergeant", "Ready" and "Recommended" pills, and an "Open Review" button with `aria-label="Open review for Peters, Tyson, PMSG — Police Master Sergeant"`.
- "Manage Criteria" sets `?criteria=1`.

`criteria-slide-over.test.tsx`:
- The dialog "Promotion Criteria" with "Add Promotion Criteria".
- Labels "Target Rank", "Years of Service", "Certification / Training Requirements".
- "Add another certification / training" adds a second select.
- **Save Criteria** with no rank shows the existing validation message and does not call create.
- "Existing Criteria Policies" lists "PLTCOL — Police Lieutenant Colonel" with "At least 3 years of service".
- "Deactivate" calls `setActive({ id, isActive: false })`.
- "Delete" asks "Delete criteria?" and calls delete.

`promotion-review-modal.test.tsx`:
- The dialog "Promotion Eligibility Evaluation" with "Review candidate criteria checklist for PMSG rank".
- "Current Rank: Police Staff Sergeant (PSSG) • Badge 4-15889".
- One PASSED row and one NOT MET row.
- The "Performance evaluation" disclosure is collapsed and opens on click.
- The "Recommendation" select.
- **Submit Endorsement** calls `createEvaluation.mutateAsync` once, with the recommendation and remarks.
- With an unknown employee id, the body reads "This employee could not be found." with only Close.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/promotion-eligibility`. Expected: FAIL.

- [ ] **Step 3: Implement by porting `promotions.html` lines 151–503**

- **Title, button and banner** (lines 153–177):
  - "Manage Criteria": `staffButton.dark` with `ListChecks` in `text-amber-400`.
  - Banner: `p-4 bg-gradient-to-r from-blue-900 to-slate-900 rounded-2xl text-white border border-blue-800/60`, with the `Info` tile, title "Promotion Board Guidelines" (`text-amber-300`), and the body copy verbatim (`text-[11px] text-slate-300`).
- **Table** (lines 179–286):
  - `StaffTableCard` "Candidates for Promotion", count chip "{n} Candidate(s)", search "Search employee or rank...".
  - Columns: EMPLOYEE, TARGET RANK, LAST REVIEWED, STATUS, RECOMMENDATION, ACTION.
  - Name format "Last, First": `employee_name` is "First Last". Read how the readiness query builds it; if only the full name is available, show it as is. Don't guess-split names that contain spaces.
  - Rank chip: `CODE — Name`, using the rank catalogue hook the current directory uses (`rankTitle`).
  - STATUS: `CircleCheck` READY (emerald) or `TriangleAlert` NOT READY (amber).
  - RECOMMENDATION: `ThumbsUp` with the `RECOMMENDATION_STATUS` pill.
  - "Open Review": `FolderOpen`, blue `rounded-xl`.
- **Slide-over** (lines 377–503): `StaffSlideOver size="xl"`, title "Promotion Criteria", subtitle "Configure criteria requirements for rank progression.".
  - The "Add Promotion Criteria" card (`p-4 bg-slate-50 border rounded-2xl`, `PlusCircle` blue heading) holds today's `CriterionForm` fields restyled with `Staff*`. The rank options read "CODE — Name".
  - "Existing Criteria Policies" with its hint. Item cards show the Active (emerald) or Inactive (slate) chip, Deactivate/Activate and Delete, the years line, and the certification bullets.
  - Footer: "Close" (`staffButton.dark`).
- **Review modal** (lines 292–375): `StaffModal size="xl"`, icon `Award` on `bg-blue-900 text-amber-400`.
  - When the employee has more than one active criterion that applies, show a "Target Rank" `StaffSelect` above the candidate box (the existing "Target rank (active criteria)" control). Otherwise use the single one.
  - **Candidate box:** pill "Ready for Board Review" (emerald) or "Not Yet Ready" (amber).
  - **Checklist header:** "Criteria Requirements Checklist" (`text-[10px] uppercase text-slate-500`).
    - Met rows: `bg-emerald-50/60 border-emerald-200/80`, `CircleCheck` in emerald-600, PASSED.
    - Unmet rows: `bg-rose-50/60 border-rose-200/80`, `CircleX` in rose-600, NOT MET (rose-700).
    - The time-in-grade row reads "At least {n} years in current {rank} rank (Actual: {x} Years)".
  - **Performance evaluation:** a `<details>` (or a button with `aria-expanded`) labelled "Performance evaluation", holding the existing `<PerformanceEvaluation …/>` unchanged.
  - **Recommendation** `StaffSelect` (Recommended / Not recommended / Deferred) and **Remarks** `StaffTextarea` (placeholder "Enter promotion board endorsement remarks...").
  - **Footer:** Close (`staffButton.secondary`) and **Submit Endorsement** (`staffButton.primary`, disabled while pending). On success: toast "Board endorsement submitted", `setReview(null)`.

`page.tsx`: `<Suspense><StaffPromotions /></Suspense>`. Remove `HrPromotionDirectory`, `HrPromotionReview` and `PromotionCriteriaManager`'s page wrapper once unused; keep `PerformanceEvaluation`. Move their still-valid assertions into the new tests.

- [ ] **Step 4: Run, typecheck and look**

Run: `npx vitest run src/components/promotion-eligibility src/components/personnel-records && npm run typecheck`. Compare with `promotions.html` and PDF pp. 28–30.

- [ ] **Step 5: Commit**

```bash
git add src/components/promotion-eligibility src/components/personnel-records/employee-record-detail.tsx "src/app/(app)/hr/promotions"
git commit -m "feat: Promotions Evaluation with in-place criteria and review from the Capstone UI promotions.html

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Attendance Logs `/hr/attendance`, the record view and the kiosk overlay (`attendance.html`, PDF pp. 31–33)

**Files:**
- Create: `src/components/attendance-integration/staff-attendance.tsx`, `attendance-record-modal.tsx`, `attendance-kiosk-overlay.tsx` (+ tests), `src/lib/attendance-integration/clock.ts` (+ test)
- Modify: `src/queries/attendance-integration.ts` (`listHrAttendanceLogs` select embeds), `src/lib/types/database.ts` (`AttendanceLogWithEmployee`)
- Modify: `src/app/(app)/hr/attendance/page.tsx`; `src/app/(app)/hr/attendance/kiosk/page.tsx` → `redirect("/hr/attendance?kiosk=1")`
- Delete: `src/components/face-recognition/face-attendance-kiosk.tsx` page wrapper, once nothing imports it (keep `FaceScanner`)

**Interfaces:**
- Consumes: `useHrAttendanceLogs(filters)`, `FaceScanner` (read `face-attendance-kiosk.tsx` for the exact props it passes in kiosk mode), `ATTENDANCE_STATUS`.
- Produces:
  - `manilaClock(iso: string | null): string`, giving "00:49" (24-hour, Asia/Manila) or "—".
  - `AttendanceLogWithEmployee` gains `employees: { first_name; last_name; employee_number; ranks: { code: string } | null; departments: { name: string } | null } | null` and `attendance_imports: { source_filename: string } | null`.

- [ ] **Step 1: Write the failing tests**

`src/lib/attendance-integration/clock.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { manilaClock } from "./clock";

describe("manilaClock", () => {
  it("shows 24-hour Manila time", () => {
    expect(manilaClock("2026-10-10T16:49:00Z")).toBe("00:49");
    expect(manilaClock("2026-10-11T09:38:00Z")).toBe("17:38");
  });
  it("shows a dash without a time", () => {
    expect(manilaClock(null)).toBe("—");
  });
});
```

`staff-attendance.test.tsx`:
- The heading "Attendance Logs".
- Links "Import Attendance" → `/hr/attendance/import`, "Face Registration" → `/hr/attendance/face-enrollment`, "Unmatched IDs" → `/hr/attendance/unmatched`.
- A button "Launch Attendance Kiosk".
- A row shows "October 11, 2026", "00:49", "—", "Partial", "Face scan", and a "View Details" button with `aria-label="View attendance for Maria Cristina Balneg, October 11, 2026"`.
- The name links to `/hr/employees/{employee_id}`.
- The status filter has "Absent".

`attendance-record-modal.test.tsx`:
- The dialog "Employee Attendance Record".
- "Rank: PMAJ • Badge / ID: 1-60482".
- "San Juan City Police Station — Admin Division" when the department is set.
- "Face Scan Biometrics" and "Scan Mode:" for a face log.
- "Imported File" and "Import File: dtr-oct.csv" for an import log.
- No "Facial Match Score".
- An unknown log id shows "This attendance record could not be found."

`attendance-kiosk-overlay.test.tsx` (mock `FaceScanner` as a stub that renders "scanner"):
- The overlay has the accessible name "Attendance kiosk".
- It shows "Biometric Face Recognition Attendance Kiosk", "Look at the Camera", the stub, and a clock matching `/\d{2}:\d{2}:\d{2} (AM|PM)/`.
- "Exit Kiosk Mode" calls `onClose`; Escape calls `onClose`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/attendance-integration src/components/attendance-integration`. Expected: FAIL.

- [ ] **Step 3: Implement by porting `attendance.html` lines 151–388**

- **`clock.ts`:** `new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))`.
- **Query:** in `listHrAttendanceLogs`, change the select to `*, employees(first_name, last_name, employee_number, ranks(code), departments(name)), attendance_imports(source_filename)`. Keep the existing filters. Add `status` and `q` filters (name or external ID) if `attendanceFiltersSchema` lacks them, with `.ilike` on `external_employee_id`. For the name, filter client-side within the page, or use an `or()` on the embedded resource if PostgREST supports it here; prefer the simple client-side page filter and note it in the code comment.
- **Page:**
  - **Toolbar** (lines 153–182): three `Link`s styled `px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50`, with `FileUp` blue-700, `IdCard` purple-600 and `TriangleAlert` amber-500. Then "Launch Attendance Kiosk" (`Expand`, `staffButton.primary`) → `setKiosk("1")`.
  - **Table** (lines 184–247): `StaffTableCard` "Recent Attendance Logs", count "{total} Records", search "Search name or external ID...", and the status select.
  - **Columns:** DATE, PERSONNEL NAME, EXTERNAL ID, TIME IN, TIME OUT, STATUS, SOURCE, ACTION.
  - **Source chip:** `Camera`/`FileUp` `size-2.5` + "Face scan"/"Imported", in `rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5`.
  - The empty state reads "No attendance logs found.".
- **Record modal** (lines 253–339): `StaffModal size="lg"`, icon `UserRoundSearch` on `bg-blue-900 text-amber-400`, "Employee Attendance Record", "Detailed biometrics log and station verification".
  - The profile box, the 2×2 grid (`LogIn` emerald / `LogOut` rose), and the verification box from §3.8.
  - "Close Window" (`staffButton.dark`).
  - The log is looked up from the current page's rows; if it isn't on the page, fetch it with a small `getHrAttendanceLog(id)` query using the same select.
- **Kiosk overlay** (lines 341–388): a `@base-ui/react/dialog` Popup `capstone-ui fixed inset-0 z-50 flex flex-col justify-between bg-slate-950 p-8 text-white`, with `aria-label="Attendance kiosk"`.
  - **Header:** the logo, "San Juan City Police Station" (`text-sm font-extrabold uppercase tracking-widest text-amber-400`), "Biometric Face Recognition Attendance Kiosk", and "Exit Kiosk Mode" (`X`, `rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold hover:bg-slate-800`).
  - **Centre:** a `max-w-md w-full rounded-3xl border-2 border-dashed border-blue-500/60 p-4` frame holding `<FaceScanner mode="kiosk" …>` with the props the old kiosk passed, plus "Look at the Camera" and "Position face inside frame for instant scan".
  - **Clock:** a live `hh:mm:ss AM/PM` in Asia/Manila (`setInterval` every second, cleared on unmount; `text-3xl font-black font-mono text-amber-400`) and `formatDate(today)`.
  - **Status bar:** the pinging emerald dot, "Device Terminal Active", and "System Status: Operational".
  - Closing unmounts `FaceScanner`, which stops the camera; check that `FaceScanner`/`useCamera` stop tracks on unmount, and add a cleanup there if not.

`page.tsx`: `<Suspense><StaffAttendance /></Suspense>`.

- [ ] **Step 4: Run, typecheck and look**

Run: `npx vitest run src/lib/attendance-integration src/components/attendance-integration src/components/face-recognition src/queries && npm run typecheck`. Compare with `attendance.html` and PDF pp. 31–32.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attendance-integration src/components/attendance-integration src/components/face-recognition src/queries/attendance-integration.ts src/lib/types/database.ts "src/app/(app)/hr/attendance"
git commit -m "feat: Attendance Logs with in-place record view and kiosk overlay; remove the Kiosk page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Reports & Analytics `/reports` (`reports.html`, PDF p. 34)

**Files:**
- Create: `src/components/reporting/staff-reports.tsx`, `report-generate-modal.tsx`, `src/lib/reporting/masterlist.ts` (+ tests)
- Modify: `src/app/(app)/reports/page.tsx`: HR gets `StaffReports`; management keeps the current list
- Modify: `src/components/reporting/report-detail.tsx`: read `from`, `to`, `department`, `print`, `export` from the URL; add the letterhead in print; auto-print or auto-export once the data has loaded
- Modify: `src/queries/reporting.ts`: `listStationMasterlist()`

**Interfaces:**
- Produces:
  - `buildMasterlistCsv(rows: { badge: string; rank: string | null; name: string; unit: string | null; status: string }[]): string`
  - `listStationMasterlist(): Promise<MasterlistRow[]>`
  - `reportGenerateHref(key: ReportKey, input: { from: string; to: string; departmentId: number | null; format: "pdf" | "csv" | "print" }): string`

- [ ] **Step 1: Write the failing tests**

`src/lib/reporting/masterlist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildMasterlistCsv, reportGenerateHref } from "./masterlist";

describe("station masterlist", () => {
  it("writes a CSV with a header and quoted cells", () => {
    expect(buildMasterlistCsv([{ badge: "1-60482", rank: "PMAJ", name: "Balneg, Maria Cristina", unit: "ARMS", status: "active" }]))
      .toBe('Badge No.,Rank,Name,Unit / Section,Employment Status\r\n"1-60482","PMAJ","Balneg, Maria Cristina","ARMS","active"\r\n');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(buildMasterlistCsv([{ badge: "=1+1", rank: null, name: "x", unit: null, status: "active" }])).toContain(`"'=1+1"`);
  });
});

describe("reportGenerateHref", () => {
  it("routes each export format to the report page", () => {
    expect(reportGenerateHref("deployments", { from: "2026-10-01", to: "2026-10-11", departmentId: 3, format: "pdf" })).toBe("/reports/deployments?from=2026-10-01&to=2026-10-11&department=3&print=1");
    expect(reportGenerateHref("deployments", { from: "2026-10-01", to: "2026-10-11", departmentId: null, format: "csv" })).toBe("/reports/deployments?from=2026-10-01&to=2026-10-11&export=csv");
    expect(reportGenerateHref("deployments", { from: "2026-10-01", to: "2026-10-11", departmentId: null, format: "print" })).toBe("/reports/deployments?from=2026-10-01&to=2026-10-11&print=1");
  });
});
```

Check `src/lib/reporting/csv.ts` first. If it already exports a CSV writer with formula neutralising, build `buildMasterlistCsv` on it, and make the expected strings match that writer's quoting.

`staff-reports.test.tsx`:
- The heading "Reports & Analytics".
- Six cards, titled "Applicant Tracking" … "Promotion & Training Needs", each with a "Generate" button.
- "Live data" appears twice; "CY 2026 Cycle" appears (with fake timers set to 2026).
- Generate on "Duty Deployments" opens the dialog "Duty Deployments Master Report".
- The format select has "Excel Spreadsheet (.csv)".
- From after To shows "Start date must be on or before the end date." and blocks download.
- **Download Official Report** calls `router.push` with the right href.
- "Export Station Masterlist" calls `listStationMasterlist` and triggers a download. Mock `URL.createObjectURL` and spy on an anchor click.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/reporting src/components/reporting`. Expected: FAIL.

- [ ] **Step 3: Implement by porting `reports.html` lines 151–416**

- **`masterlist.ts`:** the CSV builder (CRLF, every cell quoted, `"` doubled, cells starting with `= + - @` prefixed with `'`) and `reportGenerateHref`.
- **`listStationMasterlist`:** `from("employees").select("employee_number, first_name, middle_name, last_name, employment_status, ranks(code), departments(name)").eq("employment_status", "active").order("last_name")`, mapped to rows with name "Last, First Middle".
- **Page:**
  - **Title:** "Reports & Analytics" with its subtitle. "Export Station Masterlist" is `staffButton.dark` with `FileSpreadsheet` in emerald-400; it downloads `station-masterlist-{YYYY-MM-DD}.csv` and toasts "Masterlist exported".
  - **Cards** (lines 166–331): `md:grid-cols-2 lg:grid-cols-3 gap-5`, each with its icon tile, the tag (`bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase`), title, description, and a footer with the label (`text-[10px] text-slate-500`) and "Generate" (`Printer`, blue). The card table is in §3.9.
- **Modal** (lines 337–416): `StaffModal size="2xl"`, icon `FileText` on `bg-blue-900 text-amber-400`, the report title, and "Configure parameters and print official PNP station document".
  - **Letterhead box:** "REPUBLIC OF THE PHILIPPINES • PNP", "SAN JUAN CITY POLICE STATION", "Human Resource and Doctrine Development Section" (blue-700). Use `text-slate-500` for the first line.
  - **Fields:** Date Range From and Date Range To (required), Station Sub-Unit / Sector (`useDepartments` or the hook the current report filters use), and Export Format.
  - **Footer:** Cancel and **Download Official Report** (`Download`), which runs `router.push(reportGenerateHref(...))`.
- **`report-detail.tsx`:**
  - Read the params with `useSearchParams` and seed the existing filter state from `from`/`to`/`department`.
  - When `print=1`: render the letterhead block (`print:block`; hidden on screen except in print preview), and call `window.print()` once after the first successful load, guarded by a ref.
  - When `export=csv`: call the existing CSV export once after load, then `router.replace` without `export`.
- **`reports/page.tsx`:** `const role = await getCurrentRole();` HR → `<Suspense><StaffReports /></Suspense>`, otherwise the current markup.

- [ ] **Step 4: Run, typecheck and look**

Run: `npx vitest run src/lib/reporting src/components/reporting && npm run typecheck`. Compare with `reports.html` and PDF p. 34. Generate a PDF via print preview once.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reporting src/components/reporting src/queries/reporting.ts "src/app/(app)/reports"
git commit -m "feat: Reports & Analytics with Generate modal and station masterlist from the Capstone UI reports.html

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Safe announcement markup (parser, toolbar actions, public rendering)

**Files:**
- Create: `src/lib/public-site/announcement-markup.ts` (+ `.test.ts`)
- Modify: `src/components/public-site/announcement-body.tsx`; the landing announcement card components that show summaries or excerpts (`grep -rln "summary\|announcementParagraphs" src/components/public-site src/app/(public)`)
- Test: `src/components/public-site/announcement-body.test.tsx` (create or extend)

**Interfaces:**
- Produces:
  - `type InlineNode = { type: "text"; text: string } | { type: "strong" | "em" | "u"; children: InlineNode[] } | { type: "link"; href: string; children: InlineNode[] }`
  - `type MarkupBlock = { type: "paragraph"; lines: InlineNode[][] } | { type: "list"; items: InlineNode[][] }`
  - `parseInline(text: string): InlineNode[]`
  - `parseAnnouncementMarkup(body: string): MarkupBlock[]`
  - `stripAnnouncementMarkup(text: string): string`
  - `applyMarkup(value: string, start: number, end: number, action: "bold" | "italic" | "underline" | "list" | "link", url?: string): { value: string; selectionStart: number; selectionEnd: number }`

- [ ] **Step 1: Write the failing tests**

`src/lib/public-site/announcement-markup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyMarkup, parseAnnouncementMarkup, parseInline, stripAnnouncementMarkup } from "./announcement-markup";

const text = (value: string) => ({ type: "text", text: value });

describe("parseInline", () => {
  it("reads bold, italic, underline and links", () => {
    expect(parseInline("Hello **world**")).toEqual([text("Hello "), { type: "strong", children: [text("world")] }]);
    expect(parseInline("*one* and ++two++")).toEqual([{ type: "em", children: [text("one")] }, text(" and "), { type: "u", children: [text("two")] }]);
    expect(parseInline("See [PNP](https://pnp.gov.ph) now")).toEqual([text("See "), { type: "link", href: "https://pnp.gov.ph", children: [text("PNP")] }, text(" now")]);
    expect(parseInline("**bold *and italic***")[0]).toMatchObject({ type: "strong" });
  });
  it("keeps anything unsafe or unbalanced as literal text", () => {
    expect(parseInline("[x](javascript:alert(1))")).toEqual([text("[x](javascript:alert(1))")]);
    expect(parseInline("<script>alert(1)</script>")).toEqual([text("<script>alert(1)</script>")]);
    expect(parseInline("**")).toEqual([text("**")]);
    expect(parseInline("2 * 3 * 4")).toEqual([text("2 * 3 * 4")]);
    expect(parseInline("**open only")).toEqual([text("**open only")]);
  });
});

describe("parseAnnouncementMarkup", () => {
  it("keeps old plain posts as paragraphs with line breaks", () => {
    expect(parseAnnouncementMarkup("Line one\nLine two\n\nSecond paragraph")).toEqual([
      { type: "paragraph", lines: [[text("Line one")], [text("Line two")]] },
      { type: "paragraph", lines: [[text("Second paragraph")]] },
    ]);
  });
  it("turns dash lines into a bullet list", () => {
    expect(parseAnnouncementMarkup("Bring:\n- ID\n- **Pen**\n\nThanks")).toEqual([
      { type: "paragraph", lines: [[text("Bring:")]] },
      { type: "list", items: [[text("ID")], [{ type: "strong", children: [text("Pen")] }]] },
      { type: "paragraph", lines: [[text("Thanks")]] },
    ]);
  });
});

describe("stripAnnouncementMarkup", () => {
  it("leaves the words for card excerpts", () => {
    expect(stripAnnouncementMarkup("**Bold** [link](https://a.ph) ++u++ *i*\n- item")).toBe("Bold link u i\nitem");
  });
});

describe("applyMarkup", () => {
  it("wraps the selection", () => {
    expect(applyMarkup("say hello", 4, 9, "bold")).toEqual({ value: "say **hello**", selectionStart: 6, selectionEnd: 11 });
    expect(applyMarkup("say hello", 4, 9, "underline").value).toBe("say ++hello++");
  });
  it("inserts empty markers at the cursor", () => {
    expect(applyMarkup("ab", 1, 1, "italic")).toEqual({ value: "a**b", selectionStart: 2, selectionEnd: 2 });
  });
  it("bullets every selected line", () => {
    expect(applyMarkup("one\ntwo", 0, 7, "list").value).toBe("- one\n- two");
  });
  it("links the selection to a URL", () => {
    expect(applyMarkup("visit site", 6, 10, "link", "https://pnp.gov.ph").value).toBe("visit [site](https://pnp.gov.ph)");
  });
});
```

`announcement-body.test.tsx`:
- `<AnnouncementBody body={"**Hi** [PNP](https://pnp.gov.ph)\n- one"} />` renders a `strong` "Hi", a link "PNP" with `target="_blank"` and `rel="noopener noreferrer"`, and a list item "one".
- `<AnnouncementBody body={"<img src=x onerror=alert(1)>"} />` renders that text literally, with no `img` element.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/public-site src/components/public-site/announcement-body.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement**

`announcement-markup.ts`:

```ts
import { announcementParagraphs } from "./announcement-text";

export type InlineNode =
  | { type: "text"; text: string }
  | { type: "strong" | "em" | "u"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] };
export type MarkupBlock = { type: "paragraph"; lines: InlineNode[][] } | { type: "list"; items: InlineNode[][] };

// Order matters when two patterns start at the same place: links, then bold, then underline, then italic.
const PATTERNS = [
  { type: "link", regex: /\[([^\]\n]+)\]\((https?:\/\/[^\s()]+)\)/ },
  { type: "strong", regex: /\*\*(\S(?:[^\n]*?\S)?)\*\*/ },
  { type: "u", regex: /\+\+(\S(?:[^\n]*?\S)?)\+\+/ },
  { type: "em", regex: /\*([^*\s](?:[^*\n]*?[^*\s])?)\*/ },
] as const;

/** Inline formatting. Never produces HTML: anything that is not a complete, safe marker stays literal text. */
export function parseInline(input: string): InlineNode[] {
  let best: { index: number; match: RegExpExecArray; type: (typeof PATTERNS)[number]["type"] } | null = null;
  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(input);
    if (match && (best === null || match.index < best.index)) best = { index: match.index, match, type: pattern.type };
  }
  if (!best) return input ? [{ type: "text", text: input }] : [];
  const before = input.slice(0, best.index);
  const after = input.slice(best.index + best.match[0].length);
  const node: InlineNode = best.type === "link"
    ? { type: "link", href: best.match[2]!, children: parseInline(best.match[1]!) }
    : { type: best.type, children: parseInline(best.match[1]!) };
  return [...(before ? [{ type: "text" as const, text: before }] : []), node, ...parseInline(after)];
}

const BULLET = /^- (.*)$/;

export function parseAnnouncementMarkup(body: string): MarkupBlock[] {
  const blocks: MarkupBlock[] = [];
  for (const lines of announcementParagraphs(body)) {
    let current: MarkupBlock | null = null;
    for (const line of lines) {
      const bullet = BULLET.exec(line);
      if (bullet) {
        if (current?.type !== "list") { current = { type: "list", items: [] }; blocks.push(current); }
        current.items.push(parseInline(bullet[1]!));
      } else {
        if (current?.type !== "paragraph") { current = { type: "paragraph", lines: [] }; blocks.push(current); }
        current.lines.push(parseInline(line));
      }
    }
  }
  return blocks;
}

function plain(nodes: InlineNode[]): string {
  return nodes.map((node) => (node.type === "text" ? node.text : plain(node.children))).join("");
}

export function stripAnnouncementMarkup(text: string) {
  return text.split("\n").map((line) => plain(parseInline(line.replace(BULLET, "$1")))).join("\n");
}

const MARKERS = { bold: "**", italic: "*", underline: "++" } as const;

export function applyMarkup(value: string, start: number, end: number, action: "bold" | "italic" | "underline" | "list" | "link", url?: string) {
  if (action === "list") {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end);
    const block = value.slice(lineStart, lineEnd).split("\n").map((line) => (line.startsWith("- ") ? line : `- ${line}`)).join("\n");
    const next = value.slice(0, lineStart) + block + value.slice(lineEnd);
    return { value: next, selectionStart: lineStart, selectionEnd: lineStart + block.length };
  }
  const selected = value.slice(start, end);
  if (action === "link") {
    const label = selected || url || "";
    const inserted = `[${label}](${url ?? ""})`;
    return { value: value.slice(0, start) + inserted + value.slice(end), selectionStart: start + 1, selectionEnd: start + 1 + label.length };
  }
  const marker = MARKERS[action];
  return { value: value.slice(0, start) + marker + selected + marker + value.slice(end), selectionStart: start + marker.length, selectionEnd: end + marker.length };
}
```

Read `announcement-text.ts`'s `announcementParagraphs` to confirm it returns `string[][]` (paragraphs of lines). Adapt the loop if its shape differs.

`announcement-body.tsx`: render `parseAnnouncementMarkup(body)`:
- `paragraph` → `<p>` with `<br />` between lines.
- `list` → `<ul className="list-disc space-y-1 pl-6">` with `<li>`s.
- Inline nodes through a small recursive `renderInline`: `strong`, `em`, `u`, and `<a href target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">`.
- Keep the existing wrapper classes, and keep "Never renders HTML" in the doc comment.

The landing card summaries and excerpts pass through `stripAnnouncementMarkup`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/public-site src/components/public-site && npm run typecheck`. Expected: PASS, including the existing landing announcement tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/public-site src/components/public-site
git commit -m "feat: safe bold/italic/underline/list/link markup for announcements

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Announcements & Public Content `/hr/public-site` (`announcements.html`, PDF pp. 35–37)

**Files:**
- Create: `src/components/public-site/staff-announcements.tsx`, `announcement-modal.tsx`, `markup-toolbar.tsx`, `staff-contacts.tsx` (+ tests)
- Modify: `src/app/(app)/hr/public-site/page.tsx`

**Interfaces:**
- Consumes:
  - `useHrAnnouncements()`, `useSaveAnnouncement()`, `useSetAnnouncementStatus()`, `useDeleteAnnouncement()`.
  - `useHrContacts()`, `useSavePublicContact()`, `useDeletePublicContact()`, `useReorderPublicContacts()`.
  - `announcementSchema` (`src/schemas/public-site.ts`) and `applyMarkup` (Task 17).
  - Read `hr-announcements-panel.tsx`, `hr-announcement-form.tsx`, `hr-contacts-panel.tsx` and `hr-contact-form.tsx` for their inputs and behaviour; the new components keep the behaviour and change the markup.

- [ ] **Step 1: Write the failing tests**

`staff-announcements.test.tsx` (mock the hooks with one published News card, one draft Advisory and one archived Advisory):
- The heading "Announcements & Public Content".
- Tabs "Announcements 3" and "Station Contacts 2"; "Showing 2 active entries".
- The published card has "Published", "News", "First published October 9, 2026", and the buttons "Edit Oplan Bisita Eskwela…" and "Archive Oplan Bisita Eskwela…". Archive calls `setStatus` with `"archived"`.
- The draft card shows "Draft" and "Publish {title}". `e2e/business-journeys` uses the `Publish <title>` name.
- The archived card shows "Archived" and "Publish {title}".
- "New Announcement" opens the dialog "Create New Announcement".

`announcement-modal.test.tsx`:
- **Create:** labels "Title", "Category", "Summary", "Announcement Text"; the helper "Short summary for quick preview on the public dashboard."; the checkbox "Publish immediately"; the button "Save Announcement".
  - Saving empty shows the schema errors.
  - Filled, with Publish immediately ticked: `save.mutateAsync` once, then `setStatus(id, "published")`, or a single call if `saveAnnouncement` accepts a status. Match the existing form's flow.
  - Unticked: no publish call; toast "Draft saved".
- **Toolbar:** select "hello" in the textarea, click "Bold" → the textarea value contains `**hello**`. "Insert link" with `window.prompt` mocked to `"javascript:alert(1)"` → error toast "Links must start with https:// or http://" and the value unchanged.
- **Edit:** the title "Edit Announcement", prefilled, with "Delete" (confirm "Delete this announcement?", then delete) and "Update Changes".

`staff-contacts.test.tsx`: the existing `hr-contacts-panel.test.tsx` assertions (list, add, edit, delete, reorder), ported to the new component. Move the test file and update the selectors.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/public-site`. Expected: FAIL.

- [ ] **Step 3: Implement by porting `announcements.html` and PDF pp. 35–37**

- **Header** (`announcements.html` lines 12–23): `pb-4 border-b border-slate-200`, h1 `text-xl font-bold text-slate-900` with `Megaphone` in `text-blue-900`, the subtitle, and "New Announcement" (`Plus`, `bg-blue-950 hover:bg-blue-900 text-white font-semibold text-xs rounded-xl px-4 py-2.5`). This page's h1 is smaller than the others, as in the mockup.
- **Tabs** (lines 25–36): underline tabs `role="tablist"`, active `text-blue-900 border-b-2 border-blue-900`, count pills, and "Showing {n} active entries" (`text-[11px] text-slate-500`). The tab is kept in `?tab=` via `usePanelParam("tab")`.
- **Cards** (lines 38–120): `bg-white rounded-xl p-4 shadow-sm border border-slate-200 border-l-4`, with the accent and badge per category from §3.10.
  - Status badges: "● Published" (emerald), "Draft" (slate-100/600), "Archived" (slate-200/700).
  - Archived cards: `bg-slate-50/80`, content `opacity-75`.
  - Date: `text-[11px] text-slate-500`. Title `text-sm font-bold`. Summary `text-xs text-slate-500 line-clamp-1`, passed through `stripAnnouncementMarkup`.
  - Buttons:
    - Edit: `SquarePen`, `bg-slate-100 text-slate-700`, or white with a border on archived cards.
    - Archive: `text-amber-700 bg-amber-50 border-amber-200`.
    - Publish: `bg-blue-950 text-white`.
    - Accessible names: "Edit {title}", "Archive {title}", "Publish {title}".
- **`AnnouncementModal`** (PDF pp. 35–36): a `@base-ui/react/dialog` popup `capstone-ui max-w-2xl rounded-2xl overflow-hidden`.
  - **Header:** navy `bg-[#0B132B] px-6 py-4`, with `Megaphone` (create) or `SquarePen` (edit) in `text-amber-400`, the uppercase title (`text-sm font-bold tracking-wider text-white uppercase`, "Create New Announcement" or "Edit Announcement"), and a white `X` close button.
  - **Body:** `p-6 space-y-4`.
    - Row 1, `grid sm:grid-cols-[1fr_12rem] gap-4`: Title (placeholder "e.g. Oplan Bisita Eskwela (BES)") and Category (News / Advisory / Event / Recruitment).
    - Summary (placeholder "One or two sentences shown on the landing page card.", helper `text-[10px] text-slate-500`).
    - Announcement Text: `MarkupToolbar` above a `StaffTextarea rows={8}` (placeholder "Write full details here. Leave a blank line between paragraphs.").
    - Inputs use `staffInputClass`. Required markers appear in create mode only, as in the screenshots.
  - **Footer** (`border-t border-slate-200 px-6 py-4 flex items-center justify-between`):
    - Create: the "Publish immediately" checkbox on the left; Cancel (`bg-slate-100 text-slate-700`) and **Save Announcement** (`Send` in amber, `bg-slate-900 text-white`) on the right.
    - Edit: **Delete** (`Trash2`, `bg-rose-50 text-rose-700`) on the left; Cancel and **Update Changes** (`Check` in amber, `bg-blue-950 text-white`) on the right.
  - All buttons are disabled while pending.
  - Open state: `?new=1` / `?edit=<id>` via `usePanelParam`. An unknown edit id shows "This announcement could not be found." with only Cancel.
- **`MarkupToolbar`** (`flex items-center gap-1 rounded-t-xl border border-b-0 border-slate-200 bg-slate-100 px-2 py-1.5`):
  - Buttons "Bold" (**B**), "Italic" (*I*), "Underline" (U underlined), a separator, "Bulleted list" (`List`), "Insert link" (`Link`). Each button has `aria-label`, `type="button"` and `aria-controls` pointing at the textarea.
  - Each calls `applyMarkup` with the textarea's `selectionStart/End`, updates the value, then restores focus and selection in a `requestAnimationFrame`.
  - Link: `window.prompt("Link address (https://…)")`. A value not matching `^https?://` → `notifyStaff({ title: "Links must start with https:// or http://", tone: "error" })`.
- **`StaffContacts`:** the existing contacts behaviour, rendered as `StaffCard`-style rows (`bg-white rounded-xl p-4 border border-slate-200 shadow-sm`) with the kind icon, label, value and visibility chip; up/down reorder buttons; and Edit/Delete. Add and edit use a `StaffModal` with the existing `HrContactForm` fields, restyled with `Staff*`. Its "New Contact" button sits in the tab panel header.

`page.tsx`: `<Suspense><StaffAnnouncements /></Suspense>`. Remove `HrPublicSiteWorkspace`, `HrAnnouncementsPanel`, `HrAnnouncementForm`, `HrContactsPanel` and `HrContactForm` once nothing imports them, moving still-valid tests over.

- [ ] **Step 4: Run, typecheck and look**

Run: `npx vitest run src/components/public-site src/lib/public-site && npm run typecheck`. Compare with `announcements.html` and PDF pp. 35–37.

- [ ] **Step 5: Commit**

```bash
git add src/components/public-site "src/app/(app)/hr/public-site"
git commit -m "feat: Announcements & Public Content with create/edit modals from the Capstone UI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: End-to-end tests

**Files:**
- Modify: `e2e/demo-accounts.ts`, `e2e/role-access.spec.ts`, `e2e/responsive-layout.spec.ts`, `e2e/iso25010-quality.spec.ts`, `e2e/capstone-objectives.spec.ts`, `e2e/business-journeys.spec.ts`, `e2e/face-attendance.spec.ts`
- Create: `playwright.local.config.ts` in the scratchpad (not committed)

- [ ] **Step 1: Prepare a server**

```bash
npx supabase start
npx supabase db reset
```

Then build against local Supabase. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `npx supabase status -o env`, then:

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

Run the server in the background. Create the no-webServer config in the scratchpad:

```ts
import base from "C:/Users/ASUS/hris-capstone/playwright.config";
export default { ...base, webServer: undefined, workers: 1, use: { ...base.use, baseURL: "http://127.0.0.1:3000" } };
```

Run each spec with `npx playwright test --config=<scratchpad>/playwright.local.config.ts e2e/<file>`.

- [ ] **Step 2: Update the specs**

- **`demo-accounts.ts`:**
  - `LoginAccount` becomes `{ mode: "employee" | "applicant" | "admin"; identifier: string; accessLevel?: "hr" | "sysad" }`.
  - `demo.hr@example.test` → `{ mode: "admin", identifier: "demo.hr@example.test", accessLevel: "hr" }`.
  - `demo.admin@example.test` → `{ mode: "admin", identifier: "demo.admin@example.test", accessLevel: "sysad" }`.
  - `fillLogin`: for admin, `selectOption` on "Access Level", then fill "Email Address".
  - `signOutFromShell`: try the account menu first (`/^Account menu for /` → menuitem "Logout"), then fall back to "Sign out" (still used by Employee, Management and SysAd in `WorkspaceShell`).
- **`role-access.spec.ts`:** HR and SysAd use the new login. Add a test where `demo.hr@example.test` with Access Level "System Administrator" stays on `/login?as=admin` with the alert "This account does not have System Administrator access.", and visiting `/hr` afterwards redirects to the login (no live session).
- **`responsive-layout.spec.ts`:**
  - Replace the HR minimum: keep `WORKSPACE_MIN_FONT = 12` for other roles and add `HR_MIN_FONT = 9`, selected when the role is HR.
  - Remove `/hr/promotions/criteria` from the HR paths (it redirects now). Add `/login?as=admin` to the public login checks, with the applicant minimum.
- **`iso25010-quality.spec.ts`:**
  - Keep the HR route list. Add axe checks after opening `/hr/deployments?create=1`, `/hr/leave-requests?review=<a pending id>` (seed one through the UI, or reuse the business-journeys helper), `/hr/promotions?criteria=1` and `/hr/attendance?view=<first log id>` when one exists.
  - The employee-denied list keeps `/hr/attendance/kiosk` (it still redirects to unauthorized for employees, because `/hr/layout.tsx` guards it).
- **`capstone-objectives.spec.ts`:**
  - **Dashboard block** (around lines 516–543): expect the h1 "Dashboard Overview"; articles "Total Active 201", "Present On Duty", "Absent / Leave", "Partial / Late", "Plantilla Vacancies"; headings "Personnel Distribution by Unit", "Recruitment Pipeline Overview", "Daily Attendance Overview", "Recent Applications", "Recent Duty Deployments". Remove the "Needs attention" tab expectation.
  - **Deployments** (lines ~92 and 326–346): click "New Deployment", fill the panel, click **Save**, and expect the toast "Deployment saved" and the row in the list.
  - **Promotions** (lines 375–413): open "Manage Criteria", add criteria in the slide-over, close it, use "Open Review", "Submit Endorsement".
  - **Leave** (line ~450): "Review" → type HR remarks → "Approve Request".
  - **Attendance** (lines 478–503): the "Attendance kiosk" link becomes the "Launch Attendance Kiosk" button.
  - **Employee record:** add an eligibility entry with a PDF via the upload dialog (`page.setInputFiles` on "Browse File"), then see the file row.
- **`business-journeys.spec.ts`:**
  - Sign out via `signOutFromShell`.
  - Leave flow: the "Review …'s … leave request, <date>" button, then "Approve Request" with remarks.
  - Announcements: "New Announcement" → fill → untick "Publish immediately" → "Save Announcement" → `Publish <title>` → `Archive <title>`. The nav link is still "Announcements".
- **`face-attendance.spec.ts`:** go to `/hr/attendance` → "Launch Attendance Kiosk" → "Start scanning" → "Exit Kiosk Mode" (instead of "Open scanner"/"Close scanner").

- [ ] **Step 3: Run each spec file and fix what fails**

Run the following, one at a time with the local config: `role-access`, `responsive-layout`, `iso25010-quality`, `capstone-objectives`, `business-journeys`, `face-attendance`. Then run every other e2e spec file once (`ls e2e/*.spec.ts`).

Expected: all pass. A failure in product code goes back to the owning task's files, with a unit test added for it.

- [ ] **Step 4: Commit**

```bash
git add e2e
git commit -m "test: e2e journeys for the redesigned HR side and the admin login

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Visual baselines (Windows + Linux)

**Files:**
- Modify: `e2e/applicant-visual-baseline.spec.ts`
- Snapshots under `e2e/applicant-visual-baseline.spec.ts-snapshots/`

Follow the visual-baseline-regeneration procedure (the memory note): Windows first, then Linux PNGs in the Playwright container. Style JSON is rounded, so the win32 and linux files are identical.

- [ ] **Step 1: Extend the spec**

- Add `"/login?as=admin"` to the static-page list; `name` becomes `_login_as_admin`.
- Add a signed-in HR test:

```ts
async function signInHr(page: Page) {
  await page.goto("/login?as=admin&next=/hr");
  await page.getByLabel("Access Level").selectOption("hr");
  await page.getByLabel("Email Address").fill("demo.hr@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill(demoPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/hr$/, { timeout: 30_000 });
}

  test("signed-in HR pages", async ({ page }) => {
    await signInHr(page);
    for (const path of ["/hr", "/hr/jobs", "/hr/applications", "/hr/deployments", "/hr/leave-requests", "/hr/promotions", "/hr/attendance", "/reports", "/hr/public-site"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(JSON.stringify(await styleSignature(page), null, 2)).toMatchSnapshot(`${path.replaceAll("/", "_")}.styles.json`);
    }
  });
```

- Rename the `describe` title to "applicant, admin login and HR pages keep their approved look".

- [ ] **Step 2: Regenerate the Windows baselines**

With the 127.0.0.1 server from Task 19 running:

```bash
npx playwright test --config=<scratchpad>/playwright.local.config.ts e2e/applicant-visual-baseline.spec.ts --update-snapshots
```

Expected new or changed files:
- `_login_as_admin.png`, `_login_as_admin.styles.json`
- `_login.png` (the employee login gains the "Admin & HR Login" link)
- `_login.styles.json` if its probes changed
- the nine HR `*.styles.json`

Applicant and public baselines must be **unchanged**: `git diff --stat` shows no other snapshot files.

- [ ] **Step 3: Regenerate the Linux PNGs**

1. Restart the server with `--hostname 0.0.0.0`.
2. Create a temporary config with `baseURL: "http://host.docker.internal:3000"`.
3. Run:

```bash
MSYS_NO_PATHCONV=1 docker run --rm --add-host=host.docker.internal:host-gateway -v C:/Users/ASUS/hris-capstone:/work -w /work -e CI=1 mcr.microsoft.com/playwright:v1.63.0-noble node node_modules/@playwright/test/cli.js test --config=<tmp> e2e/applicant-visual-baseline.spec.ts -g "static page" --update-snapshots
```

Then copy each new or changed `*-win32.styles.json` for the HR pages to its `-linux` name; the container cannot sign in. Check that `_login_as_admin-styles` win32 and linux are byte-identical (`cmp`).

- [ ] **Step 4: Verify and commit**

Restart with `--hostname 127.0.0.1`. Run the visual spec without `--update-snapshots`. Expected: PASS.

```bash
git add e2e/applicant-visual-baseline.spec.ts e2e/applicant-visual-baseline.spec.ts-snapshots
git commit -m "test: visual baselines for the admin login and the redesigned HR pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: Full verification, PR and the PR 3 prompt

- [ ] **Step 1: Run every gate**

```bash
npm run lint
npm run typecheck
npm run test:run
npx supabase db reset && npx supabase test db
```

e2e already ran per spec file in Tasks 19–20; re-run any spec whose files changed since. All must pass. If `npm run test:run` is killed for memory, run it in halves by folder (`npx vitest run src/components` then `npx vitest run src/lib src/queries src/hooks src/app src/schemas`) and report that.

- [ ] **Step 2: Self-review and code review**

Use superpowers:requesting-code-review over the whole branch diff (`git diff main...HEAD`). Fix what's confirmed, re-run the affected tests, and commit.

- [ ] **Step 3: Open the PR**

```bash
git push -u origin feat/capstone-ui-hr
gh pr create --base main --title "Capstone UI redesign: HR side (PR 2 of 4)" --body-file <scratchpad>/pr-body.md
```

`pr-body.md` holds:
- **Summary:** per screen, with the mockup and PDF pages.
- **Decisions:** SysAd kept with an enforced Access Level, 9px floor, one document per entry, rubric kept in the modal, dashboard mockup only, safe markup, remarks required for both leave actions, roster Delete = disqualify, deployment Delete = cancel, Facial Match Score omitted.
- **Manual steps:**
  1. After merging and deploying, push the two migrations to live Supabase: `20261011120001_certification_documents.sql` and `20261011120002_hr_dashboard_overview.sql`.
  2. Tell HR and SysAd users to sign in at **Admin & HR Login** (`/login?as=admin`) with their email address and the matching Access Level.
- **Testing:** the commands from Step 1 and the e2e specs run.
- It ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 4: Hand the user the PR 3 prompt**

Reply with the PR link and a ready-to-paste prompt for PR 3 (Employee). It names:
- **Sources:** the mockups `empdash`, `empprof`, `empleave`, `empdeploy`, `empfacere`, `empromote` and `emplogin` in `docs/design/capstone-ui/`; PDF pages 39–47, including p. 44 (a page to remove) and pp. 45–46 (promotion criteria auto-filtering by rank).
- **Previous specs:** `docs/superpowers/specs/2026-10-11-capstone-ui-applicant-design.md` and `…-hr-design.md`.
- **Decisions not to re-decide:**
  - Reuse `StaffShell` for the employee role, with a "Profile" item in the account menu.
  - `.capstone-ui`, lucide, the logo, slate-500 captions, no stock photos of real people.
  - Dates in words; no new roles.
  - `/login?as=employee` stays the badge-number login, restyled from `emplogin.html`. Its heading reads "Login as HR / " in the mockup; ask the user what it should say.
- **Questions to raise:** the employee font floor (HR is 9px); whether HR/SysAd accounts may still use the badge login.
- **Process rules:** branch off the latest main, one PR, no live migrations, memory-safe test runs, and the visual-baseline procedure. After the PR, give the prompt for PR 4 (SysAd: `sysad.html`, PDF p. 49).
