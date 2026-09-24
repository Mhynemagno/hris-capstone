# Ranks, Data Reset, and Client Feedback Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace positions with a single department-independent Rank catalogue, reset demo data (keeping accounts), and fix the gender label, employee status, applicant application detail, personnel record layout, department deletion, and the stuck AI recommendation.

**Architecture:** Three new Supabase migrations (schema + function rewrite; data reset + seed; AI worker schedule + sweeper) followed by a front-end rename from `position` to `rank` across types → schemas → queries → hooks → components, plus three focused UI features (applicant "What you applied for" card, tabbed personnel record, AI score polling). Remote rollout is the last task and is gated on explicit user confirmation.

**Tech Stack:** Next.js 16 / React 19, TanStack Query 5, Zod 4, Supabase (Postgres 17, pgTAP, pgmq, pg_cron, pg_net, Vault), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-24-ranks-reset-and-fixes-design.md`

## Global Constraints

- The word "position" must not appear in the database schema, SQL functions, TypeScript identifiers, routes, or UI copy after this work (except CSS `position`, `components/ui/*`, and historical migrations). Verify with the grep in Task 9.
- Ranks: 12 rows exactly as in spec §1.4, codes unique and case-sensitive (`Pat`, `PCpl`, …, `PCMSg` with no trailing period).
- Departments: 9 rows exactly as in spec §1.4.
- `employees.employment_status` ∈ {`active`, `on_leave`}; UI labels "Active" / "On leave".
- Column `gender` (was `sex`) on `employees` and `applicants`; values `female`, `male`, `prefer_not_to_say`; UI label "Gender".
- Rank dropdown label format: `` `${code} — ${name}` ``, ordered by `sort_order`.
- Departments and ranks can never be deleted (no RPC, no button); they can be deactivated.
- New migrations are named `20260924110000_ranks_catalogue.sql`, `20260924111000_demo_data_reset.sql`, `20260924112000_application_analysis_schedule.sql`.
- Never commit secrets. Never run anything against the linked (remote) project before Task 10's explicit user confirmation.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Hiring after reset.** HR hires an applicant when the kept employee rows have no rank → `hire_application` must find the `Pat` rank by code and succeed. Test in Task 1.
2. **Closed job still visible to its applicant.** An applicant opens an application whose job was withdrawn/closed → the card still shows title, department, rank, criteria. Test in Tasks 1 (RLS) and 6 (UI).
3. **Inactive rank on an existing record.** Editing an employee whose rank was later deactivated → the rank stays selected, labelled "(inactive)", and saving does not drop it. Test in Task 5.
4. **Tab deep link with a bad value.** `?tab=nonsense` → falls back to Official record without crashing. Test in Task 7.
5. **Polling stops.** Score goes queued → completed → polling interval becomes `false`, so the page doesn't poll forever. Test in Task 8.

---

## File Structure

**Database (new):**
- `supabase/migrations/20260924110000_ranks_catalogue.sql` — rename positions→ranks, columns, gender, status, failure code, RLS, function rewrites, drop delete RPCs.
- `supabase/migrations/20260924111000_demo_data_reset.sql` — wipe + seed ranks/departments.
- `supabase/migrations/20260924112000_application_analysis_schedule.sql` — sweeper function + pg_cron job.
- `supabase/tests/ranks_catalogue.test.sql`, `supabase/tests/application_analysis_schedule.test.sql`.

**Database (modify):** `supabase/seed.sql`, `supabase/config.toml`, existing `supabase/tests/*.test.sql` that reference positions/sex/inactive statuses.

**Front end (rename/modify):**
- `src/lib/types/database.ts` — `Position` → `Rank`; `position_id` → `rank_id`; `sex` → `gender`; drop `employees.rank`; status union.
- `src/schemas/{administration,personnel-records,recruitment,promotion-eligibility,index}.ts`
- `src/queries/{administration,personnel-records,recruitment,promotion-eligibility,deletion}.ts`
- `src/hooks/{use-administration,use-deletion,use-recruitment}.ts`, `src/lib/query-keys.ts`, `src/lib/app/role-config.ts`, `src/lib/administration/audit-presentation.ts`
- `src/components/personnel-records/department-position-fields.tsx` → `department-rank-fields.tsx`
- `src/components/administration/administration-workspaces.tsx` (Ranks workspace, remove department delete)
- `src/app/(app)/admin/positions/` → `src/app/(app)/admin/ranks/page.tsx`; `src/app/(app)/admin/page.tsx`
- Employee form/profile/directory/record-entry-form, HR job form, careers landing, promotion components, report detail, applicant profile form.

**Front end (new):**
- `src/components/recruitment/applied-job-summary.tsx` (+ test) — the "What you applied for" card.
- `src/components/personnel-records/record-tabs.tsx` (+ test) — tab bar with URL sync.
- `src/lib/recruitment/analysis-polling.ts` (+ test) — `analysisRefetchInterval()`.

**Docs:** `docs/AI_SHORTLISTING_SETUP.md`, `docs/DEPLOYMENT_RUNBOOK.md`.

---

### Task 1: Ranks catalogue migration (schema + function rewrite)

**Files:**
- Create: `supabase/migrations/20260924110000_ranks_catalogue.sql`
- Create: `supabase/tests/ranks_catalogue.test.sql`
- Modify: every `supabase/tests/*.test.sql` that references `positions`, `position_id`, `sex`, `'inactive'`/`'separated'` employment status, `delete_department`, or `delete_position`

**Interfaces:**
- Produces (DB): table `public.ranks(id bigint, name text, code text unique not null, sort_order int unique not null, is_active bool, created_at, updated_at)`; columns `employees.rank_id`, `service_history.rank_id`, `job_openings.rank_id`, `promotion_criteria.target_rank_id`, `promotion_evaluations.target_rank_id`, `employee_promotion_eligibility_summaries.target_rank_id`; `employees.gender`, `applicants.gender`.
- Produces (RPC signatures, param renames): `public.save_job_opening(target_job_id bigint, target_department_id bigint, target_rank_id bigint, target_title text, target_description text, target_location text, target_closes_on date, target_status text, requested_criteria jsonb)`; `public.create_promotion_criterion(target_rank_id integer, target_minimum_years integer, target_minimum_rating integer, target_requirements jsonb)`; `public.create_promotion_evaluation(target_employee_id uuid, target_rank_id integer, target_criterion_id uuid, target_evaluated_on date, target_recommendation text, target_notes text, target_evidence jsonb)`; `public.update_promotion_criterion(target_criterion_id uuid, expected_updated_at timestamptz, target_rank_id integer, target_minimum_years integer, target_minimum_rating integer, target_is_active boolean, target_requirements jsonb)`.
- Produces: HR report JSON column key `rank` (label "Rank") replacing `position` / `position_title`.
- Removed: `public.delete_department(bigint)`, `public.delete_position(bigint)`; `deletion_impact` no longer accepts `'department'` or `'position'`.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/ranks_catalogue.test.sql`:

```sql
begin;
select plan(14);

select has_table('public', 'ranks', 'ranks table exists');
select hasnt_table('public', 'positions', 'positions table is gone');
select hasnt_column('public', 'ranks', 'department_id', 'ranks are not department-specific');
select has_column('public', 'ranks', 'code', 'ranks have a code');
select has_column('public', 'employees', 'rank_id', 'employees reference a rank');
select hasnt_column('public', 'employees', 'rank', 'free-text rank column removed');
select hasnt_column('public', 'employees', 'position_id', 'employees.position_id removed');
select has_column('public', 'job_openings', 'rank_id', 'job openings reference a rank');
select has_column('public', 'employees', 'gender', 'employees.gender exists');
select has_column('public', 'applicants', 'gender', 'applicants.gender exists');
select hasnt_function('public', 'delete_department', array['bigint'], 'department delete RPC removed');
select hasnt_function('public', 'delete_position', array['bigint'], 'position delete RPC removed');

select throws_ok(
  $$ update public.employees set employment_status = 'inactive' where id = (select id from public.employees limit 1) $$,
  '23514', null, 'only active / on_leave statuses are allowed'
);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'reporting') and p.prosrc ~* 'position'),
  0, 'no function body still mentions position'
);

select * from finish();
rollback;
```

Note: the `throws_ok` test needs at least one employee row; seed.sql provides one locally. If none exist, insert a minimal employee in the test first.

- [ ] **Step 2: Run to verify it fails**

Run: `npx supabase test db`
Expected: `ranks_catalogue.test.sql` FAILs (`ranks table exists` fails, etc.).

- [ ] **Step 3: Capture the current definitions to rewrite**

Write the extraction query to the scratchpad and run it:

```sql
-- scratchpad/extract_functions.sql
select string_agg(pg_get_functiondef(p.oid), E';\n\n' order by n.nspname, p.proname) || ';'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.prosrc ~* 'position|\msex\M|employment_status';
```

Run: `npx supabase db query --local -f <scratchpad>/extract_functions.sql -o csv > <scratchpad>/functions_before.sql`

Expected list (18): `private.{create_promotion_criterion, create_promotion_evaluation, deletion_impact, get_hr_dashboard_summary, get_hr_report, get_management_dashboard_summary, get_management_report, hire_application, reference_label, save_job_opening, update_promotion_criterion}`, `public.{create_promotion_criterion, create_promotion_evaluation, delete_department, delete_position, save_job_opening, set_promotion_criterion_active, update_promotion_criterion}`. Also run `select pg_get_viewdef('reporting.current_workforce'::regclass, true);` and save it.

- [ ] **Step 4: Write the migration — structural part**

Start `supabase/migrations/20260924110000_ranks_catalogue.sql` with:

```sql
-- Positions become Ranks: one police rank catalogue shared by every department.
-- Runs before the demo-data reset, so existing rows only need to survive the renames.

-- Drop the objects whose signatures or dependencies change; they are recreated below.
drop view if exists reporting.current_workforce;
drop function if exists public.delete_department(bigint);
drop function if exists public.delete_position(bigint);
drop function if exists public.save_job_opening(bigint, bigint, bigint, text, text, text, date, text, jsonb);
drop function if exists private.save_job_opening(bigint, bigint, bigint, text, text, text, date, text, jsonb);
drop function if exists public.create_promotion_criterion(integer, integer, integer, jsonb);
drop function if exists private.create_promotion_criterion(integer, integer, integer, jsonb);
drop function if exists public.create_promotion_evaluation(uuid, integer, uuid, date, text, text, jsonb);
drop function if exists private.create_promotion_evaluation(uuid, integer, uuid, date, text, text, jsonb);
drop function if exists public.update_promotion_criterion(uuid, timestamptz, integer, integer, integer, boolean, jsonb);
drop function if exists private.update_promotion_criterion(uuid, timestamptz, integer, integer, integer, boolean, jsonb);

-- Table
alter table public.positions rename to ranks;
alter table public.ranks drop constraint if exists positions_department_id_title_key;
alter table public.ranks drop column department_id;
alter table public.ranks drop column description;
alter table public.ranks rename column title to name;
update public.ranks set code = coalesce(nullif(btrim(code), ''), 'LEGACY-' || id);
alter table public.ranks
  alter column code set not null,
  add column sort_order integer;
update public.ranks set sort_order = 1000 + id;
alter table public.ranks
  alter column sort_order set not null,
  add constraint ranks_name_key unique (name),
  add constraint ranks_code_key unique (code),
  add constraint ranks_sort_order_key unique (sort_order),
  add constraint ranks_code_check check (code = btrim(code) and char_length(code) between 1 and 16),
  add constraint ranks_name_check check (char_length(btrim(name)) between 2 and 160);
alter index if exists positions_pkey rename to ranks_pkey;
alter trigger positions_touch_updated_at on public.ranks rename to ranks_touch_updated_at;
alter trigger positions_write_audit_log on public.ranks rename to ranks_write_audit_log;
alter policy positions_select_authenticated on public.ranks rename to ranks_select_authenticated;
alter policy positions_insert_admin on public.ranks rename to ranks_insert_admin;
alter policy positions_update_admin on public.ranks rename to ranks_update_admin;
-- Delete policy (if any) goes away: ranks are never deleted.
drop policy if exists positions_delete_admin on public.ranks;
revoke delete on public.ranks from authenticated;
drop policy if exists departments_delete_admin on public.departments;
revoke delete on public.departments from authenticated;

-- Referencing columns
alter table public.employees rename column position_id to rank_id;
alter table public.service_history rename column position_id to rank_id;
alter table public.job_openings rename column position_id to rank_id;
alter table public.promotion_criteria rename column target_position_id to target_rank_id;
alter table public.promotion_evaluations rename column target_position_id to target_rank_id;
alter table public.employee_promotion_eligibility_summaries rename column target_position_id to target_rank_id;
alter index if exists job_openings_position_id_idx rename to job_openings_rank_id_idx;
-- Rename remaining FK constraints / indexes whose names contain "position":
--   select conname from pg_constraint where conname ~ 'position';
--   select indexname from pg_indexes where indexname ~ 'position';
-- and add one `alter table ... rename constraint` / `alter index ... rename` line per result.

alter table public.employees drop column rank;

-- Gender
alter table public.employees rename column sex to gender;
alter table public.applicants rename column sex to gender;
alter table public.employees rename constraint employees_sex_check to employees_gender_check;
alter table public.applicants rename constraint applicants_sex_check to applicants_gender_check;

-- Employment status: Active or On leave only
update public.employees set employment_status = 'active' where employment_status not in ('active', 'on_leave');
alter table public.employees drop constraint employees_employment_status_check;
alter table public.employees add constraint employees_employment_status_check
  check (employment_status in ('active', 'on_leave'));

-- AI analysis timeout failure code (used by the sweeper in 20260924112000)
alter table public.application_ai_scores drop constraint application_ai_scores_failure_code_check;
alter table public.application_ai_scores add constraint application_ai_scores_failure_code_check
  check (failure_code is null or failure_code in
    ('configuration_unavailable', 'provider_unavailable', 'provider_invalid_response', 'persistence_failed', 'timed_out'));

-- Applicants keep seeing the job they applied for after it closes
create policy job_openings_select_own_application on public.job_openings
  for select to authenticated
  using (exists (
    select 1 from public.applications application
    join public.applicants applicant on applicant.id = application.applicant_id
    where application.job_opening_id = job_openings.id
      and applicant.profile_id = (select auth.uid())
  ));
create policy job_criteria_select_own_application on public.job_qualification_criteria
  for select to authenticated
  using (exists (
    select 1 from public.applications application
    join public.applicants applicant on applicant.id = application.applicant_id
    where application.job_opening_id = job_qualification_criteria.job_opening_id
      and applicant.profile_id = (select auth.uid())
  ));
```

Check the real constraint names first with `select conname from pg_constraint where conrelid in ('public.employees'::regclass,'public.applicants'::regclass,'public.positions'::regclass);` and adjust the `rename constraint` / `drop constraint` names if they differ.

- [ ] **Step 5: Write the migration — function part**

Append to the migration the definitions saved in Step 3, **except** `public.delete_department` and `public.delete_position` (leave them dropped), after these edits:

| Find | Replace |
|------|---------|
| `public.positions` | `public.ranks` |
| `positions%rowtype` | `ranks%rowtype` |
| `position_id` (column refs, and `target_position_id` params) | `rank_id` / `target_rank_id` |
| `position.title` / alias `position` | `rank.name` / alias `rank` |
| `position_title` | `rank_name` |
| `.sex` / `sex,` in column lists | `.gender` / `gender,` |
| report column `jsonb_build_object('key','position','label','Position')` | `jsonb_build_object('key','rank','label','Rank')` and the row key `'position', position_title` → `'rank', rank_name` |

Specific logic changes (not just renames):

- `private.hire_application`: replace the patrol lookup with
  ```sql
  select * into patrol_rank from public.ranks where code = 'Pat' and is_active;
  if patrol_rank.id is null then raise exception 'Configure the active Patrolman / Patrolwoman (Pat) rank before hiring.' using errcode = 'P0001'; end if;
  ```
  and insert `patrol_rank.id` into `rank_id`.
- `private.deletion_impact`: delete the whole `when 'department' then …` and `when 'position' then …` branches; in the promotion-criterion branch change `join public.positions position on position.id = criterion.target_position_id` to `join public.ranks rank on rank.id = criterion.target_rank_id` and `position.title` → `rank.name`.
- `private.reference_label`: `when 'positions' then 'positions'` → `when 'ranks' then 'ranks'`.
- Status filters in `private.get_hr_report` / `private.get_management_report`: if they validate `target_status`, allow only `'active'`, `'on_leave'`.

After each recreated `public.*` wrapper, restore grants (they were dropped with the function):

```sql
revoke all on function public.save_job_opening(bigint, bigint, bigint, text, text, text, date, text, jsonb) from public, anon;
grant execute on function public.save_job_opening(bigint, bigint, bigint, text, text, text, date, text, jsonb) to authenticated, service_role;
revoke all on function private.save_job_opening(bigint, bigint, bigint, text, text, text, date, text, jsonb) from public, anon, authenticated;
-- repeat the same pair for create_promotion_criterion, create_promotion_evaluation, update_promotion_criterion
```

Recreate the view from the saved `reporting.current_workforce` definition with `position_id` → `rank_id`, then re-apply its original grants (check with `select grantee, privilege_type from information_schema.role_table_grants where table_schema='reporting'` before Step 4).

- [ ] **Step 6: Update the existing pgTAP tests**

Run: `grep -rln "positions\|position_id\|\bsex\b\|'inactive'\|'separated'\|delete_department\|delete_position" supabase/tests`
For each file: `positions`→`ranks`, `title`→`name` for rank rows (and add a `code` + `sort_order` to every rank insert, e.g. `insert into public.ranks (name, code, sort_order) values ('Test Rank', 'TST', 900)`), `position_id`→`rank_id`, `target_position_id`→`target_rank_id`, `sex`→`gender`, change employment-status fixtures to `active`/`on_leave`, delete tests for department/position deletion (in `safe_record_deletion.test.sql`, `department_catalog.test.sql`) and lower each file's `plan(n)` to match. Tests that hire applicants must insert a rank with `code = 'Pat'`.

- [ ] **Step 7: Apply and run all DB tests**

Run: `npx supabase db reset` (local only) then `npx supabase test db`
Expected: all test files PASS, including `ranks_catalogue.test.sql` 14/14.

- [ ] **Step 8: Add Review Focus #1 and #2 assertions** to `ranks_catalogue.test.sql` (bump `plan` to 16):

```sql
-- #1 hire works with the Pat rank looked up by code (reuse the hire fixture pattern from
-- recruitment_workflow_feedback.test.sql: HR user, applicant, application in 'Offer' status)
select lives_ok($$ select public.hire_application(<fixture application id>, 'PNP-0001', 'Hired') $$, 'hiring assigns the Pat rank');
-- #2 applicant can read a withdrawn job they applied to
update public.job_openings set status = 'withdrawn' where id = <fixture job id>;
set local role authenticated; set local request.jwt.claims = '{"sub":"<fixture applicant profile id>"}';
select is((select count(*)::int from public.job_openings where id = <fixture job id>), 1, 'applicant still sees their withdrawn job');
reset role;
```

Replace the `<fixture …>` markers with the ids the fixture inserts (copy the fixture block from `recruitment_workflow_feedback.test.sql`). Run `npx supabase test db` again → PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260924110000_ranks_catalogue.sql supabase/tests
git commit -m "feat(db): replace positions with a department-independent ranks catalogue"
```

---

### Task 2: Demo data reset + rank/department seed

**Files:**
- Create: `supabase/migrations/20260924111000_demo_data_reset.sql`
- Modify: `supabase/tests/ranks_catalogue.test.sql` (seed assertions), `supabase/seed.sql`

**Interfaces:**
- Consumes: Task 1 schema.
- Produces: exactly 12 ranks and 9 departments, no job openings/applications, kept accounts.

- [ ] **Step 1: Add failing assertions** to `ranks_catalogue.test.sql` (bump plan by 5):

```sql
select is((select count(*)::int from public.ranks), 12, 'twelve ranks seeded');
select is((select string_agg(code, ',' order by sort_order) from public.ranks),
  'Pat,PCpl,PSSg,PMSg,PSMSg,PCMSg,PEMSg,PLt,PCapt,PMAJ,PLTCOL,PCOL', 'rank codes in seniority order');
select is((select count(*)::int from public.departments), 9, 'nine departments seeded');
select is((select count(*)::int from public.job_openings), 0, 'job openings cleared');
select ok((select count(*) from auth.users) > 0, 'accounts kept');
```

Run `npx supabase db reset && npx supabase test db` → the rank/department count assertions FAIL.

- [ ] **Step 2: Write the reset migration**

```sql
-- Client-requested reset: clear all demo/transactional data so the client can enter correct
-- data. Login accounts, profiles, roles, applicant profiles, account-linked employee rows, and
-- system configuration (leave types, organization and attendance settings) are kept.

truncate table
  public.application_ai_scores,
  public.application_status_history,
  public.applicant_documents,
  public.employee_activation_requests,
  public.applications,
  public.job_qualification_criteria,
  public.job_openings,
  public.leave_request_attachments,
  public.leave_request_history,
  public.leave_requests,
  public.deployment_history,
  public.deployments,
  public.attendance_unmatched_events,
  public.attendance_logs,
  public.attendance_identity_mappings,
  public.attendance_imports,
  public.promotion_evaluation_evidence,
  public.employee_promotion_eligibility_summaries,
  public.promotion_evaluations,
  public.promotion_criteria_requirements,
  public.promotion_criteria,
  public.performance_ratings,
  public.service_history,
  public.qualifications,
  public.certifications,
  public.training_records,
  public.employee_record_history,
  public.profile_change_request_history,
  public.profile_change_request_documents,
  public.profile_change_request_changes,
  public.profile_change_requests,
  public.notifications,
  public.audit_logs
restart identity;

select pgmq.purge_queue('application_analysis');

-- Storage objects that belonged to the rows above
delete from storage.objects where bucket_id in ('applicant-documents', 'leave-attachments', 'profile-change-documents');

-- Keep only employee rows linked to a login; clear their organization placement
delete from public.employees where profile_id is null;
update public.employees set department_id = null, rank_id = null, unit_station = null, employment_status = 'active';

truncate table public.unit_stations restart identity;
delete from public.ranks;
delete from public.departments;

insert into public.ranks (name, code, sort_order) values
  ('Patrolman / Patrolwoman', 'Pat', 1),
  ('Police Corporal', 'PCpl', 2),
  ('Police Staff Sergeant', 'PSSg', 3),
  ('Police Master Sergeant', 'PMSg', 4),
  ('Police Senior Master Sergeant', 'PSMSg', 5),
  ('Police Chief Master Sergeant', 'PCMSg', 6),
  ('Police Executive Master Sergeant', 'PEMSg', 7),
  ('Police Lieutenant', 'PLt', 8),
  ('Police Captain', 'PCapt', 9),
  ('Police Major', 'PMAJ', 10),
  ('Police Lieutenant Colonel', 'PLTCOL', 11),
  ('Police Colonel', 'PCOL', 12);

insert into public.departments (name) values
  ('Station Administrative and Resource Management Section'),
  ('Station Investigation and Detective Management Section'),
  ('Women and Children Protection Desk'),
  ('Traffic and Investigation Unit'),
  ('Station Warrant and Subpoena Section'),
  ('Tactical Operations Center'),
  ('Intelligence Section'),
  ('Drug Enforcement Unit'),
  ('Police Community Precincts / Sub-Stations');
```

Before running: confirm bucket ids with `select id from storage.buckets;` and replace the three names above with the real application-document, leave-attachment, and profile-change-document bucket ids (do **not** include `employee-profile-photos` or the applicant profile photo/document buckets). Confirm every table in the `truncate` list exists (`\dt public.*`); `truncate … restart identity` fails on a missing table. If the audit trigger on `ranks`/`departments` writes `audit_logs` rows during the inserts, that is expected (they are the first entries after the reset). If `delete from public.ranks`/`departments` is blocked by FKs from `unit_stations` or others, truncate those first.

- [ ] **Step 3: Update `supabase/seed.sql`**

Remove/replace every insert into `positions`, `departments`, job openings, and any demo row the reset clears; change `sex` → `gender`, `position_id` → `rank_id`, employment status values to `active`/`on_leave`. Keep the six demo auth users, profiles, roles, and their linked employee/applicant rows (with null department/rank). Ranks and departments now come from the migration, so the seed must not insert them.

- [ ] **Step 4: Run**

Run: `npx supabase db reset && npx supabase test db`
Expected: all PASS. Seeded demo logins still work (`demo.hr@example.test` / `DemoPass!2026` signs in via `npm run dev`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260924111000_demo_data_reset.sql supabase/seed.sql supabase/tests/ranks_catalogue.test.sql
git commit -m "feat(db): reset demo data and seed the station ranks and departments"
```

---

### Task 3: AI analysis schedule + stale-attempt sweeper

**Files:**
- Create: `supabase/migrations/20260924112000_application_analysis_schedule.sql`
- Create: `supabase/tests/application_analysis_schedule.test.sql`
- Modify: `supabase/config.toml`, `docs/AI_SHORTLISTING_SETUP.md`, `docs/DEPLOYMENT_RUNBOOK.md`

**Interfaces:**
- Produces: `private.fail_stale_application_analyses(stale_after interval default '15 minutes') returns integer` (count of rows failed); cron job `process-application-analysis` (every minute); Vault secret names `project_url`, `analysis_worker_secret`.

- [ ] **Step 1: Write the failing test**

```sql
begin;
select plan(4);
select has_function('private', 'fail_stale_application_analyses', array['interval']);

-- fixture: one application (copy the applicant/job/application fixture from
-- recruitment_and_applicant_portal.test.sql), then:
insert into public.application_ai_scores (application_id, status, created_at, queued_at)
values (<fixture application id>, 'queued', now() - interval '20 minutes', now() - interval '20 minutes');

select is(private.fail_stale_application_analyses('15 minutes'), 1, 'one stale attempt failed');
select is((select status from public.application_ai_scores where application_id = <fixture application id>), 'failed');
select is((select failure_code from public.application_ai_scores where application_id = <fixture application id>), 'timed_out');
select * from finish();
rollback;
```

Check the real column list of `application_ai_scores` (`queued_at` may be defaulted) and adapt the insert. Run `npx supabase test db` → FAIL (function missing).

- [ ] **Step 2: Write the migration**

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Attempts left queued or processing too long (worker never ran, crashed, or timed out) are
-- failed so HR can retry them from the application screen.
create or replace function private.fail_stale_application_analyses(stale_after interval default interval '15 minutes')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  failed_count integer;
begin
  update public.application_ai_scores
  set status = 'failed',
      failure_code = 'timed_out',
      completed_at = now()
  where (status = 'queued' and coalesce(queued_at, created_at) < now() - stale_after)
     or (status = 'processing' and processing_started_at < now() - stale_after);
  get diagnostics failed_count = row_count;
  return failed_count;
end;
$$;
revoke all on function private.fail_stale_application_analyses(interval) from public, anon, authenticated;

-- Every minute: fail stale attempts, then ask the worker to drain the queue. The worker URL and
-- shared secret live in Vault (see docs/AI_SHORTLISTING_SETUP.md); if they are missing the HTTP
-- call is skipped and the sweeper alone runs.
create or replace function private.run_application_analysis_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  worker_secret text;
begin
  perform private.fail_stale_application_analyses();
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name = 'analysis_worker_secret';
  if base_url is null or worker_secret is null then return; end if;
  if not exists (select 1 from pgmq.q_application_analysis) then return; end if;
  perform net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/process-application-analysis',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-analysis-worker-secret', worker_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;
revoke all on function private.run_application_analysis_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'process-application-analysis';
select cron.schedule('process-application-analysis', '* * * * *', $$ select private.run_application_analysis_tick(); $$);
```

Before relying on `pgmq.q_application_analysis`, confirm the queue table name with `select queue_name from pgmq.list_queues();` (pgmq stores queue `x` in `pgmq.q_x`).

- [ ] **Step 3: Disable gateway JWT check for the worker** — append to `supabase/config.toml`:

```toml
[functions.process-application-analysis]
verify_jwt = false
```

(The worker authenticates every request with `x-analysis-worker-secret`, `index.ts:48-51`.)

- [ ] **Step 4: Run** `npx supabase db reset && npx supabase test db` → PASS. Then `npx supabase db query --local "select jobname, schedule from cron.job"` → shows `process-application-analysis | * * * * *`.

- [ ] **Step 5: Rewrite `docs/AI_SHORTLISTING_SETUP.md`** with these sections: (1) Deploy: `npx supabase functions deploy process-application-analysis`; (2) Function secrets: `npx supabase secrets set GEMINI_API_KEY=<key> ANALYSIS_WORKER_SECRET=<long random string>`; (3) Vault secrets (SQL editor): `select vault.create_secret('https://<project-ref>.supabase.co', 'project_url'); select vault.create_secret('<same ANALYSIS_WORKER_SECRET>', 'analysis_worker_secret');`; (4) Verify: submit an application, wait ≤ 2 min, HR sees a score; `select * from cron.job_run_details order by start_time desc limit 5;` and `select * from net._http_response order by created desc limit 5;`; (5) Troubleshooting: "Analysis timed out" means the worker never completed within 15 minutes — check secrets and function logs. Remove references to the retired `score-application` function. Replace the manual cron instructions at `docs/DEPLOYMENT_RUNBOOK.md:22` with a link to this doc.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260924112000_application_analysis_schedule.sql supabase/tests/application_analysis_schedule.test.sql supabase/config.toml docs/AI_SHORTLISTING_SETUP.md docs/DEPLOYMENT_RUNBOOK.md
git commit -m "fix(ai): schedule the analysis worker and time out stuck attempts"
```

---

### Task 4: Front-end data layer rename (types, schemas, queries, hooks) + Admin Ranks page

**Files:**
- Modify: `src/lib/types/database.ts`, `src/schemas/administration.ts`, `src/schemas/index.ts`, `src/queries/administration.ts`, `src/hooks/use-administration.ts`, `src/lib/query-keys.ts`, `src/queries/deletion.ts`, `src/hooks/use-deletion.ts`, `src/lib/administration/audit-presentation.ts`, `src/lib/app/role-config.ts`, `src/components/administration/administration-workspaces.tsx`, `src/app/(app)/admin/page.tsx`
- Move: `src/app/(app)/admin/positions/page.tsx` → `src/app/(app)/admin/ranks/page.tsx`
- Test: `src/components/administration/administration-workspaces.test.tsx`, `src/queries/administration.test.ts`, `src/schemas/administration.test.ts`, `src/hooks/use-administration.test.tsx`, `src/queries/deletion.test.ts`, `src/lib/administration/audit-presentation.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Rank = { id: number; name: string; code: string; sort_order: number; is_active: boolean; created_at: string; updated_at: string };
  export const rankSchema = z.object({ name: z.string().trim().min(2).max(160), code: z.string().trim().min(1).max(16), sortOrder: z.coerce.number().int().min(1).max(10000), isActive: z.boolean().default(true) });
  export type RankInput = z.infer<typeof rankSchema>;
  listRanks(input?: Partial<ReferenceDataFilters>): Promise<PaginatedResult<Rank, ReferenceDataFilters>>   // ordered by sort_order
  listRankOptions(): Promise<Rank[]>                                                                          // ordered by sort_order
  saveRank(input: RankInput, rankId?: number): Promise<Rank>
  useRanks(filters), useRankOptions(), useSaveRank()
  queryKeys.administration.ranks(filters)
  export function rankLabel(rank: Pick<Rank, "code" | "name">): string  // `${code} — ${name}`, in src/lib/ranks.ts
  ```
  `DeletableKind` no longer includes `"department"` or `"position"`.

- [ ] **Step 1: Write failing tests**

In `src/schemas/administration.test.ts` add:

```ts
it("validates a rank with a code", () => {
  expect(rankSchema.parse({ name: "Police Corporal", code: "PCpl", sortOrder: 2 })).toEqual({ name: "Police Corporal", code: "PCpl", sortOrder: 2, isActive: true });
  expect(() => rankSchema.parse({ name: "Police Corporal", code: "", sortOrder: 2 })).toThrow();
});
```

Create `src/lib/ranks.test.ts`:

```ts
import { rankLabel } from "./ranks";
it("formats a rank as code — name", () => {
  expect(rankLabel({ code: "Pat", name: "Patrolman / Patrolwoman" })).toBe("Pat — Patrolman / Patrolwoman");
});
```

In `administration-workspaces.test.tsx`, replace the positions workspace tests with: renders `RanksWorkspace` rows showing Code and Name columns; no button named `/delete/i` exists in `RanksWorkspace` or `DepartmentsWorkspace`; saving calls `saveRank` with `{ name, code, sortOrder, isActive }`. Copy the existing mocking pattern used by the departments tests in the same file.

Run: `npx vitest run src/schemas/administration.test.ts src/lib/ranks.test.ts src/components/administration` → FAIL.

- [ ] **Step 2: Implement**

- `src/lib/ranks.ts`: `export function rankLabel(rank: Pick<Rank, "code" | "name">) { return `${rank.code} — ${rank.name}`; }`
- `database.ts`: replace `Position` with `Rank` (above); in `Employee`, `ServiceHistory`, `JobOpening` rename `position_id` → `rank_id`; promotion types `target_position_id` → `target_rank_id`; `sex` → `gender`; delete `rank: string | null` from `Employee`; `employment_status: "active" | "on_leave"`.
- `schemas/administration.ts`: replace `positionSchema`/`PositionInput` with `rankSchema`/`RankInput`; update `schemas/index.ts` re-exports.
- `queries/administration.ts`: `listRanks`/`listRankOptions` query `from("ranks")` ordered by `sort_order`; search filter on `name`/`code` (`query.or(\`name.ilike.%${s}%,code.ilike.%${s}%\`)`); `saveRank` payload `{ name, code, sort_order, is_active }`. Audit lookups: `entity_type === "ranks"`, read `metadata.name`, fetch `from("ranks").select("id, name")`, store in `lookups.ranks`.
- `audit-presentation.ts`: `positions` lookup → `ranks`; `case "ranks": … quoted("Rank", name) … \`Rank #${id}\``; keep `case "positions"` returning `Rank #${id}` for any historic log shape (none after reset, but harmless and keeps the type total).
- `hooks/use-administration.ts`: `useRanks`, `useRankOptions`, `useSaveRank` (invalidate `"ranks", "audit-logs"`); department save invalidates `"departments", "audit-logs"`.
- `query-keys.ts`: `ranks: (filters = {}) => ["administration", "ranks", filters] as const`.
- `queries/deletion.ts` / `hooks/use-deletion.ts`: remove the `department` and `position` kinds and their entries.
- `role-config.ts`: `{ href: "/admin/ranks", label: "Ranks", icon: "BriefcaseBusiness", group: "Organization" }`.
- `admin/ranks/page.tsx`: `<AdminPage title="Ranks" description="Maintain the police ranks available to every department."><RanksWorkspace /></AdminPage>`; delete the `positions` folder; update the card/link in `admin/page.tsx`.
- `administration-workspaces.tsx`: rename `PositionsWorkspace` → `RanksWorkspace`. Table columns: Code, Name, Order, Status, actions (Edit, Activate/Deactivate). Form fields: Name, Code, Order (number), Active. Remove the department select, the delete button, the `DeleteRecordDialog`, and the "can be deleted" help text. In `DepartmentsWorkspace`, remove the Delete button, the `DeleteRecordDialog`, the `deleting` state, and change the help text to "Deactivated departments are hidden from new records but stay on historic ones."

- [ ] **Step 3: Run** `npx vitest run src/schemas src/lib src/queries/administration.test.ts src/queries/deletion.test.ts src/hooks/use-administration.test.tsx src/components/administration` → PASS (update the remaining position-named assertions in these files as part of this step).

- [ ] **Step 4: Commit**

```bash
git add -A src/lib src/schemas src/queries src/hooks "src/app/(app)/admin" src/components/administration
git commit -m "feat(admin): manage ranks instead of positions and remove department deletion"
```

(`npm run typecheck` will still fail in files owned by Task 5 — that is expected until Task 5 lands.)

---

### Task 5: Rank, gender, and status across forms and screens

**Files:**
- Rename: `src/components/personnel-records/department-position-fields.tsx` → `department-rank-fields.tsx`
- Modify: `src/components/personnel-records/{employee-form,employee-profile,employee-directory,record-entry-form}.tsx`, `src/schemas/personnel-records.ts`, `src/queries/personnel-records.ts`, `src/components/recruitment/{hr-job-form,public-careers-landing,applicant-profile-form}.tsx`, `src/schemas/recruitment.ts`, `src/queries/recruitment.ts`, `src/components/promotion-eligibility/*.tsx`, `src/schemas/promotion-eligibility.ts`, `src/queries/promotion-eligibility.ts`, `src/app/(app)/hr/promotions/page.tsx`, `src/components/reporting/report-detail.tsx`
- Test: the matching `*.test.tsx` / `*.test.ts` files for each

**Interfaces:**
- Consumes: `Rank`, `useRankOptions`, `rankLabel` (Task 4); RPC params `target_rank_id` (Task 1).
- Produces:
  ```ts
  export function buildRankChoices(ranks: readonly Rank[] | undefined, savedRankId: number | null | undefined, options?: { activeOnly?: boolean }): SelectChoice[]
  export function DepartmentRankFields(props: { idPrefix: string; departmentId: string; rankId: string; onDepartmentChange(v: string): void; onRankChange(v: string): void; savedDepartmentId?: number | null; savedRankId?: number | null; departmentName?: string; rankName?: string; departmentError?: string; rankError?: string; required?: boolean; activeOnly?: boolean; departmentLabel?: string; rankLabel?: string }): JSX.Element
  ```
  Employee schema input field `rankId` (replaces `positionId` and `rank`), `gender` (replaces `sex`), `employmentStatus: z.enum(["active", "on_leave"])`.

- [ ] **Step 1: Write failing tests**

`src/components/personnel-records/department-rank-fields.test.tsx`:

```tsx
import { buildRankChoices } from "./department-rank-fields";
const ranks = [
  { id: 1, name: "Patrolman / Patrolwoman", code: "Pat", sort_order: 1, is_active: true, created_at: "", updated_at: "" },
  { id: 2, name: "Police Corporal", code: "PCpl", sort_order: 2, is_active: false, created_at: "", updated_at: "" },
];
it("lists active ranks as code — name in seniority order", () => {
  expect(buildRankChoices(ranks, null)).toEqual([{ value: "1", label: "Pat — Patrolman / Patrolwoman" }]);
});
it("keeps a saved inactive rank selectable and labelled", () => {
  expect(buildRankChoices(ranks, 2)).toEqual([
    { value: "1", label: "Pat — Patrolman / Patrolwoman" },
    { value: "2", label: "PCpl — Police Corporal (inactive)" },
  ]);
});
it("keeps the saved rank submittable while ranks load", () => {
  expect(buildRankChoices(undefined, 5)).toEqual([{ value: "5", label: "Current rank (loading…)" }]);
});
```

In `employee-form.test.tsx`: assert a field labelled "Gender" exists and "Sex" does not; the status select has exactly the options Active and On leave; the rank select offers every rank regardless of the selected department (render with two departments, pick either, rank options unchanged). In `applicant-profile-form.test.tsx`: label "Gender". In `hr-job-form.test.tsx`: the RPC is called with `target_rank_id`. In `promotion-eligibility.test.tsx`: criteria use "Rank" copy and `target_rank_id`.

Run: `npx vitest run src/components/personnel-records src/components/recruitment src/components/promotion-eligibility` → FAIL.

- [ ] **Step 2: Implement**

- `department-rank-fields.tsx`: keep `buildDepartmentChoices` unchanged. Replace `buildPositionChoices` with:

  ```ts
  export function buildRankChoices(ranks: readonly Rank[] | undefined, savedRankId: number | null | undefined, { activeOnly = true }: ChoiceOptions = {}): SelectChoice[] {
    const rows = [...(ranks ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const choices = rows
      .filter((rank) => !activeOnly || rank.is_active || rank.id === savedRankId)
      .map((rank) => ({ value: String(rank.id), label: rank.is_active ? rankLabel(rank) : `${rankLabel(rank)} (inactive)` }));
    if (savedRankId && !rows.some((rank) => rank.id === savedRankId)) {
      choices.unshift({ value: String(savedRankId), label: ranks ? "Current rank (unavailable)" : "Current rank (loading…)" });
    }
    return choices;
  }
  ```

  `DepartmentRankFields` renders the two selects independently: the department `onChange` no longer clears the rank, the rank select is never disabled, descriptions read "Loading ranks…" / "Ranks could not be loaded. Refresh the page to try again.", default rank label "Rank", placeholder "Select a rank". Update every import site.
- `schemas/personnel-records.ts`: `employmentStatuses = ["active", "on_leave"] as const`; rename `sex` → `gender` (and `demographicSexes` → `genders`); replace `positionId` and `rank` with `rankId: z.union([z.coerce.number().int().positive(), z.null()]).default(null)` (match how `departmentId` is declared in the same schema).
- `queries/personnel-records.ts`: payload `gender`, `rank_id`; remove the `rank` text field; `getEmployee`/`getMyEmployee` select `"*, ranks(name, code), departments(name)"` so the profile can show them; type the result as `Employee & { ranks: Pick<Rank, "name" | "code"> | null; departments: { name: string } | null }`.
- `employee-form.tsx`: remove the `POLICE_RANKS` select (lines 70–75) and the constant; use `DepartmentRankFields` with `rankName="rankId"`; "Sex" → "Gender" (`id="gender" name="gender"`); status selects offer only Active / On leave (delete the Inactive/Separated options at lines ~112 and ~160–161).
- `employee-profile.tsx`: label "Gender"; Rank row shows `employee.ranks ? rankLabel(employee.ranks) : "Not provided"`.
- `employee-directory.tsx`: status labels map only `active: "Active", on_leave: "On leave"`; column header "Rank" showing the rank code; filter by `rank_id`.
- `record-entry-form.tsx`: service history "Position" → "Rank" select from `useRankOptions` (`rank_id`).
- `hr-job-form.tsx`: `DepartmentRankFields`; RPC arg `target_rank_id`; copy "Rank".
- `public-careers-landing.tsx`: show `rankLabel(job.ranks)`; the query in `queries/recruitment.ts` selects `ranks(name, code)` instead of `positions(title)`.
- `applicant-profile-form.tsx` / `schemas/recruitment.ts` / `queries/recruitment.ts`: `sex` → `gender`, label "Gender".
- Promotion components, schema, query, page: `targetPositionId` → `targetRankId`, `target_position_id` → `target_rank_id`, `positions(title)` → `ranks(name, code)`, copy "Target rank".
- `report-detail.tsx`: status options only Active / On leave.

- [ ] **Step 3: Run** `npx vitest run` and `npm run typecheck` → both PASS. Fix every remaining failure caused by the rename.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "feat: use ranks, gender, and two employee statuses across all screens"
```

---

### Task 6: Applicant "What you applied for" card

**Files:**
- Create: `src/components/recruitment/applied-job-summary.tsx`, `src/components/recruitment/applied-job-summary.test.tsx`
- Modify: `src/queries/recruitment.ts` (`getMyApplication`), `src/components/recruitment/applicant-application-detail.tsx`, `src/components/recruitment/applicant-application-detail.test.tsx`

**Interfaces:**
- Consumes: `rankLabel`, `Rank`.
- Produces:
  ```ts
  export type AppliedJob = Pick<JobOpening, "id" | "title" | "description" | "location" | "closes_on" | "status"> & {
    departments: { name: string } | null;
    ranks: Pick<Rank, "name" | "code"> | null;
    job_qualification_criteria: Pick<JobQualificationCriterion, "id" | "kind" | "requirement" | "is_required" | "ordinal">[];
  };
  export function AppliedJobSummary(props: { job: AppliedJob | null; status: Application["status"]; submittedAt: string }): JSX.Element
  ```
  `getMyApplication` returns `{ application: Application & { job_openings: AppliedJob | null }, history, documents }`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { AppliedJobSummary } from "./applied-job-summary";

const job = {
  id: 1, title: "Investigator", description: "Handles case files.", location: "Main station", closes_on: "2026-10-31", status: "withdrawn" as const,
  departments: { name: "Intelligence Section" }, ranks: { name: "Police Corporal", code: "PCpl" },
  job_qualification_criteria: [{ id: "c1", kind: "education", requirement: "Bachelor's degree", is_required: true, ordinal: 1 }],
};

it("shows what the applicant applied for", () => {
  render(<AppliedJobSummary job={job} status="Under Review" submittedAt="2026-09-20T08:00:00Z" />);
  expect(screen.getByRole("heading", { name: "What you applied for" })).toBeInTheDocument();
  expect(screen.getByText("Investigator")).toBeInTheDocument();
  expect(screen.getByText("Intelligence Section")).toBeInTheDocument();
  expect(screen.getByText("PCpl — Police Corporal")).toBeInTheDocument();
  expect(screen.getByText("Handles case files.")).toBeInTheDocument();
  expect(screen.getByText(/Bachelor's degree/)).toBeInTheDocument();
  expect(screen.getByText("Under Review")).toBeInTheDocument();
});

it("explains when the job details are unavailable", () => {
  render(<AppliedJobSummary job={null} status="Submitted" submittedAt="2026-09-20T08:00:00Z" />);
  expect(screen.getByText(/job details are no longer available/i)).toBeInTheDocument();
});
```

Match the `kind`/`status` literal types to `database.ts` (check `JobQualificationCriterion["kind"]` and `JobOpening["status"]`). Run `npx vitest run src/components/recruitment/applied-job-summary.test.tsx` → FAIL.

- [ ] **Step 2: Implement**

`applied-job-summary.tsx`: a `<section className="rounded-xl border p-5">` with `<h2>What you applied for</h2>`, a `<dl>` grid (Job, Department, Rank, Location, Applications close, Submitted — `new Date(submittedAt).toLocaleString()`), a status `Badge` (from `@/components/ui/badge`), the description paragraph, and a "Qualifications" list rendering each criterion's requirement with " (required)" when `is_required`, ordered by `ordinal`. When `job` is null render the status, submitted date, and the text "The job details are no longer available."

`getMyApplication`: change the application select to
`"*, job_openings(id, title, description, location, closes_on, status, departments(name), ranks(name, code), job_qualification_criteria(id, kind, requirement, is_required, ordinal)), applicants(*)"`.

`applicant-application-detail.tsx`: replace the first card with `<AppliedJobSummary job={application.job_openings} status={application.status} submittedAt={application.submitted_at} />`; status history items show `new Date(entry.created_at).toLocaleDateString()` and the note; documents show `document.kind === "cv" ? "CV" : "Credential"` before the file name (check the `ApplicantDocument` kind field name in `database.ts`).

- [ ] **Step 3: Run** `npx vitest run src/components/recruitment` → PASS (update `applicant-application-detail.test.tsx` fixtures to include `job_openings`).

- [ ] **Step 4: Commit**

```bash
git add src/components/recruitment src/queries/recruitment.ts
git commit -m "feat(applicant): show the job, department, and rank on the application page"
```

---

### Task 7: Tabbed personnel record

**Files:**
- Create: `src/components/personnel-records/record-tabs.tsx`, `src/components/personnel-records/record-tabs.test.tsx`
- Modify: `src/components/personnel-records/employee-record-detail.tsx`, `src/components/personnel-records/employee-record-detail.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export const RECORD_TABS = [
    { key: "official", label: "Official record" },
    { key: "service-history", label: "Service history" },
    { key: "qualifications", label: "Qualifications" },
    { key: "certifications", label: "Certifications" },
    { key: "training", label: "Training" },
  ] as const;
  export type RecordTabKey = (typeof RECORD_TABS)[number]["key"];
  export function parseRecordTab(value: string | null): RecordTabKey   // unknown/null → "official"
  export function RecordTabs(props: { active: RecordTabKey; onChange(key: RecordTabKey): void; idPrefix: string }): JSX.Element
  ```

- [ ] **Step 1: Write failing tests**

`record-tabs.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseRecordTab, RecordTabs } from "./record-tabs";

it("falls back to the official record for unknown tabs", () => {
  expect(parseRecordTab(null)).toBe("official");
  expect(parseRecordTab("nonsense")).toBe("official");
  expect(parseRecordTab("training")).toBe("training");
});

it("renders an accessible tablist and reports changes", async () => {
  const onChange = vi.fn();
  render(<RecordTabs active="official" idPrefix="rec" onChange={onChange} />);
  expect(screen.getByRole("tab", { name: "Official record" })).toHaveAttribute("aria-selected", "true");
  await userEvent.click(screen.getByRole("tab", { name: "Service history" }));
  expect(onChange).toHaveBeenCalledWith("service-history");
});

it("moves between tabs with the arrow keys", async () => {
  const onChange = vi.fn();
  render(<RecordTabs active="official" idPrefix="rec" onChange={onChange} />);
  screen.getByRole("tab", { name: "Official record" }).focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(onChange).toHaveBeenCalledWith("service-history");
});
```

In `employee-record-detail.test.tsx`: mock `next/navigation` (`useSearchParams` returning `new URLSearchParams("tab=qualifications")`, `useRouter` returning `{ replace: vi.fn() }`, `usePathname` returning `"/hr/employees/x"`) and assert the Qualifications panel renders and the Service history heading does not; clicking the "Training" tab calls `replace("/hr/employees/x?tab=training", { scroll: false })`.

Run → FAIL.

- [ ] **Step 2: Implement**

`record-tabs.tsx` (`"use client"`): `<div role="tablist" aria-label="Personnel record sections" className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">`; each tab is a `<button role="tab" id={`${idPrefix}-tab-${key}`} aria-controls={`${idPrefix}-panel-${key}`} aria-selected={active === key} tabIndex={active === key ? 0 : -1}>` with `min-h-11 shrink-0 whitespace-nowrap border-b-2 px-4 text-sm font-medium` and `border-primary text-foreground` when active, `border-transparent text-muted-foreground hover:text-foreground` otherwise. ArrowLeft/ArrowRight/Home/End change tabs (wrap around) and focus the new tab.

`employee-record-detail.tsx`: read `const searchParams = useSearchParams(); const active = parseRecordTab(searchParams.get("tab"));`; `onChange` builds `new URLSearchParams(searchParams)`, sets `tab`, and calls `router.replace(\`${pathname}?${params}\`, { scroll: false })`. Under the header render `<RecordTabs … />` then a single `<div role="tabpanel" id={`rec-panel-${active}`} aria-labelledby={`rec-tab-${active}`}>` holding only the active section: `official` → `<EmployeeEditor employee={employee.data} />`; `service-history` / `qualifications` / `certifications` → `<Records kind="serviceHistory" | "qualification" | "certification" />`; `training` → `<TrainingRecords />`. Remove the old `kinds.map(...)` block. The page file (`src/app/(app)/hr/employees/[employeeId]/page.tsx`) must wrap the component in `<Suspense>` if Next requires it for `useSearchParams` (the build in Task 9 will fail otherwise).

- [ ] **Step 3: Run** `npx vitest run src/components/personnel-records` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/personnel-records "src/app/(app)/hr/employees"
git commit -m "feat(hr): organise the personnel record into tabs"
```

---

### Task 8: Poll AI scores while analysis is running

**Files:**
- Create: `src/lib/recruitment/analysis-polling.ts`, `src/lib/recruitment/analysis-polling.test.ts`
- Modify: `src/hooks/use-recruitment.ts`, `src/components/recruitment/hr-application-detail.tsx`, `src/components/recruitment/hr-application-list.tsx`, `src/components/recruitment/hr-recruitment-workspace.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export const ANALYSIS_POLL_MS = 5000;
  export function analysisRefetchInterval(statuses: ReadonlyArray<string | null | undefined>): number | false
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { analysisRefetchInterval, ANALYSIS_POLL_MS } from "./analysis-polling";
it("polls while any analysis is queued or processing", () => {
  expect(analysisRefetchInterval(["queued"])).toBe(ANALYSIS_POLL_MS);
  expect(analysisRefetchInterval(["completed", "processing"])).toBe(ANALYSIS_POLL_MS);
});
it("stops polling once analyses settle", () => {
  expect(analysisRefetchInterval(["completed"])).toBe(false);
  expect(analysisRefetchInterval(["failed", "unscored"])).toBe(false);
  expect(analysisRefetchInterval([])).toBe(false);
});
```

Run `npx vitest run src/lib/recruitment` → FAIL.

- [ ] **Step 2: Implement**

```ts
export const ANALYSIS_POLL_MS = 5000;
const RUNNING = new Set(["queued", "processing"]);
export function analysisRefetchInterval(statuses: ReadonlyArray<string | null | undefined>): number | false {
  return statuses.some((status) => status != null && RUNNING.has(status)) ? ANALYSIS_POLL_MS : false;
}
```

`use-recruitment.ts`:
- `useApplicationAiScores`: add `refetchInterval: (query) => analysisRefetchInterval([query.state.data?.[0]?.status])`.
- `useHrApplications`: add `refetchInterval: (query) => analysisRefetchInterval((query.state.data?.rows ?? []).map((row) => row.ai_score_status))` (check the returned shape of `listHrApplications`; adapt the path to the rows array).

`hr-application-detail.tsx` and `hr-application-list.tsx`: when the latest score is `failed` with `failure_code === "timed_out"`, show "Analysis timed out." instead of "Analysis failed." (keep the Retry button). If the list row doesn't carry the failure code, keep "Analysis failed" there.

- [ ] **Step 3: Add the Review Focus #5 hook test** in `hr-recruitment-workspace.test.tsx`: mock `getApplicationAiScores` to return `[{ status: "queued" }]` then `[{ status: "completed", score: 80, explanation: "Good fit" }]`; with `vi.useFakeTimers({ shouldAdvanceTime: true })`, advance 5000 ms and assert "Score: 80/100" appears; advance another 10000 ms and assert the mock was called exactly twice.

- [ ] **Step 4: Run** `npx vitest run src/lib/recruitment src/components/recruitment` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recruitment src/hooks/use-recruitment.ts src/components/recruitment
git commit -m "fix(ai): refresh the recommendation automatically while analysis runs"
```

---

### Task 9: End-to-end tests and full verification

**Files:**
- Modify: `e2e/**/*.spec.ts` that reference Positions, Sex, Inactive/Separated statuses, department deletion, or seeded job openings.

- [ ] **Step 1: Leftover-terminology check**

Run:
```bash
grep -rniE "\bpositions?\b|position_id|\bsex\b|separated|'inactive'" src e2e supabase/seed.sql supabase/functions \
  | grep -viE "components/ui/|civil|position:\s*(absolute|relative|fixed|sticky)|getBoundingClientRect|scrollPosition"
```
Expected: no matches except the civil-status value `separated` in `schemas/recruitment.ts` / applicant profile form (that's marital status, not employment). Fix anything else.

- [ ] **Step 2: Update e2e specs** for the new labels (Ranks nav item, "Gender", "Rank", tabs on the record page). Journeys that relied on seeded job openings must create one first through the HR UI (the reset leaves none).

- [ ] **Step 3: Full verification**

Run, in order, and record each result:
```bash
npx supabase db reset
npx supabase test db
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```
Expected: all pass. Do not claim success for any command you did not see pass.

- [ ] **Step 4: Commit**

```bash
git add -A e2e
git commit -m "test(e2e): cover ranks, gender, and tabbed personnel records"
```

---

### Task 10: Remote rollout (requires explicit user confirmation)

This task changes the hosted Supabase project and permanently deletes its demo data. **Stop and ask the user before Step 2**, showing: the three migrations to be pushed, the tables being wiped, and the backup location.

- [ ] **Step 1: Backup + dry run**

```bash
npx supabase migration list --linked
npx supabase db dump --linked --data-only -f "<scratchpad>/remote-data-backup-2026-09-24.sql"
npx supabase db push --linked --dry-run
```
Expected: only the three new migrations are pending; the dump file is non-empty. If older migrations also show as pending, stop and report — the remote is out of sync.

- [ ] **Step 2: (After user confirms) Push and deploy**

```bash
npx supabase db push --linked
npx supabase functions deploy process-application-analysis
```

- [ ] **Step 3: Hand the user the secret-setup steps** from `docs/AI_SHORTLISTING_SETUP.md` §2–3 (they run them; never paste secrets into the chat or commit them).

- [ ] **Step 4: Smoke check** (after secrets are set): `npx supabase db query --linked "select count(*) from public.ranks"` → 12; `… from public.departments` → 9; `… from public.job_openings` → 0; `select jobname from cron.job` → `process-application-analysis`. Submit a test application as an applicant; within ~2 minutes HR sees a score (or "Analysis timed out" after 15 minutes, which points to missing secrets).
