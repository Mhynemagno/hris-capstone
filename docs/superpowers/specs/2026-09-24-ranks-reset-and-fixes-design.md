# Ranks, Data Reset, and Client Feedback Fixes — Design

Date: 2026-09-24
Status: Approved in conversation; awaiting written-spec review

## Intent

The client reviewed the HRIS and asked for a batch of corrections so the system matches how a
PNP police station is actually organised, and for a clean database they can refill with correct
demo data. Success means:

- There is exactly one concept, **Rank** (name + code), used everywhere. "Position" no longer exists
  in the database, code, or UI. Every rank is available in every department.
- The department and rank catalogues match the client's document (`Doc1.pdf`).
- All transactional/demo data is gone; every login account still works.
- Several UI issues are fixed (gender label, employee status, applicant application detail,
  personnel record layout, department deletion).
- The AI recommendation actually completes instead of showing "Analyzing application…" forever.

### What the client said vs. assumptions

Said: rename sex → gender; statuses only Active / On leave; position → rank, not department-specific,
"no position and rank, it's just 1"; remove department delete; reset everything except accounts;
clean all job openings; tabs or drawers for personnel records; fix AI; use the PDF data.

Assumed (confirmed in conversation): reset option A (keep employee/applicant rows linked to
accounts); tabs over drawers; full DB rename to `ranks`; ranks also lose delete; system
configuration (leave types, organization settings, attendance settings) is kept; rank code
`PCMSg.` is stored as `PCMSg`.

## 1. Data model and reset (single migration)

### 1.1 Wipe

Delete all rows from:

- Recruitment: `job_openings`, `job_qualification_criteria`, `applications`,
  `application_status_history`, `applicant_documents`, `application_ai_scores`,
  `employee_activation_requests`, and the `application_analysis` pgmq queue contents.
- Leave: `leave_requests`, `leave_request_attachments`, `leave_request_history`.
- Deployments: `deployments`, `deployment_history`.
- Attendance: `attendance_imports`, `attendance_logs`, `attendance_identity_mappings`,
  `attendance_unmatched_events`.
- Promotions: `promotion_criteria`, `promotion_criteria_requirements`, `performance_ratings`,
  `promotion_evaluations`, `promotion_evaluation_evidence`,
  `employee_promotion_eligibility_summaries`.
- Personnel sub-records: `service_history`, `qualifications`, `certifications`,
  `training_records`, `employee_record_history`.
- Profile changes: `profile_change_requests` and its `_changes`, `_documents`, `_history` tables.
- `notifications`, `audit_logs`.
- Master data: `unit_stations`, `departments`, `positions`.
- Storage objects belonging to the wiped rows (applicant application documents, leave attachments,
  profile change documents).

### 1.2 Keep

- `auth.users`, `profiles`, `user_roles`.
- `employees` rows linked to a profile; unlinked employee rows are deleted. Kept rows get
  `department_id`, `rank_id`, `unit_station` set to null and `employment_status = 'active'`.
- `applicants` and `applicant_profile_documents` (with their storage objects) and applicant /
  employee profile photos.
- `leave_types`, `organization_settings`, `attendance_integration_settings`.

### 1.3 Positions → Ranks

- Rename `positions` → `ranks`; drop `department_id` and the `(department_id, title)` unique;
  rename `title` → `name`; add `code text not null unique`, `sort_order int not null unique`.
  Keep `is_active`, timestamps.
- Rename columns: `employees.position_id`, `service_history.position_id`,
  `job_openings.position_id` → `rank_id`; promotion `target_position_id` → `target_rank_id`.
  Rename related indexes and constraints.
- Drop `employees.rank` (free-text column and its check constraint).
- Recreate every function, view, RPC, and RLS policy that referenced positions/position_id
  (hire application, atomic job-opening save, promotion criteria/evaluation RPCs, dashboards and
  reports, safe-deletion helpers, employee profile photo-safe update paths, etc.) against `ranks`.
  PL/pgSQL bodies are not updated by renames, so each one is redefined explicitly.

### 1.4 Seed

Ranks, in `sort_order` (junior → senior):

| # | Name | Code |
|---|------|------|
| 1 | Patrolman / Patrolwoman | Pat |
| 2 | Police Corporal | PCpl |
| 3 | Police Staff Sergeant | PSSg |
| 4 | Police Master Sergeant | PMSg |
| 5 | Police Senior Master Sergeant | PSMSg |
| 6 | Police Chief Master Sergeant | PCMSg |
| 7 | Police Executive Master Sergeant | PEMSg |
| 8 | Police Lieutenant | PLt |
| 9 | Police Captain | PCapt |
| 10 | Police Major | PMAJ |
| 11 | Police Lieutenant Colonel | PLTCOL |
| 12 | Police Colonel | PCOL |

Departments:

1. Station Administrative and Resource Management Section
2. Station Investigation and Detective Management Section
3. Women and Children Protection Desk
4. Traffic and Investigation Unit
5. Station Warrant and Subpoena Section
6. Tactical Operations Center
7. Intelligence Section
8. Drug Enforcement Unit
9. Police Community Precincts / Sub-Stations

`supabase/seed.sql` is updated to match so local resets produce the same catalogue.

### 1.5 Other schema changes

- `employees.employment_status` check becomes `in ('active', 'on_leave')`, default `'active'`.
  Report RPC status filters accept only these values.
- Rename `sex` → `gender` on `employees` and `applicants` (constraint renamed; values unchanged:
  `female`, `male`, `prefer_not_to_say`). Update every function that reads or writes the column
  (hiring copies applicant → employee).
- Drop the department and rank delete RPCs / deletion-safety entries and revoke their grants.

### 1.6 Safety

Before applying to the hosted project, take a data-only dump
(`supabase db dump --data-only`) into the session scratchpad. The migration runs in one
transaction; if any step fails nothing is changed.

## 2. UI changes

### 2.1 Terminology

- "Sex" → "Gender" in employee form, employee profile, applicant profile form.
- "Position" → "Rank" in all screens, schemas, queries, hooks, types, query keys, audit labels,
  role config, and tests. `/admin/positions` → `/admin/ranks`.
- Rank selects show `Code — Name` (e.g. `Pat — Patrolman / Patrolwoman`), ordered by
  `sort_order`, active ranks only (plus the record's current rank if inactive).
- `department-position-fields.tsx` → independent Department and Rank selects (no filtering).
- `POLICE_RANKS` constant removed; ranks come from the `ranks` table.

### 2.2 Admin

- Ranks page: table of Code, Name, Active; add / edit / deactivate. No delete.
- Departments page: delete button, dialog, and help text removed; deactivate remains.

### 2.3 Employee status

Forms, directory filter, and report filters offer only Active and On leave.

### 2.4 Applicant application detail

Add a "What you applied for" card at the top: job title, department, rank, closing date,
job description, qualification criteria, submitted date, and a status badge. The status history
shows dates and HR notes. Documents show their type (CV / credential). The applicant query is
extended to join the job opening, department, rank, and criteria. Current RLS only exposes
published, unexpired openings, so once a job closes the applicant loses it; add SELECT policies
letting an applicant read the job opening and criteria of their own applications.

### 2.5 HR personnel record

Tabs: Official record | Service history | Qualifications | Certifications | Training. Only
the selected tab's content renders. The tab bar scrolls horizontally on narrow screens. The
selected tab is kept in the URL (`?tab=official|service-history|qualifications|certifications|training`),
defaulting to Official record.

## 3. AI recommendation fix

Root cause: applications are queued (trigger + pgmq), but nothing invokes the
`process-application-analysis` worker; no stuck-job recovery exists; the UI never polls.

1. Migration: enable `pg_cron` and `pg_net`; schedule a job every minute that reads
   `project_url` and `analysis_worker_secret` from Vault and `net.http_post`s the worker with the
   `x-analysis-worker-secret` header. The function is deployed with JWT verification disabled
   (it authenticates via the worker secret), set in `supabase/config.toml`.
2. Sweeper (in the same cron tick, as a SQL function): rows `queued` > 15 min or `processing`
   > 15 min become `failed` with error "Analysis timed out", enabling HR retry.
3. Worker crash recovery is handled by the sweeper (a row left `processing` after a worker crash
   is failed after 15 minutes). `failure_code` gains the value `timed_out`, and the HR UI shows
   "Analysis timed out" for it. The worker code itself is unchanged.
4. UI: `useApplicationAiScores` (and the HR list's score query) use a `refetchInterval` of 5 s
   while the latest status is `queued` or `processing`, and stop otherwise.
5. Rewrite `docs/AI_SHORTLISTING_SETUP.md`: deploy command, required function secrets
   (`GEMINI_API_KEY`, `ANALYSIS_WORKER_SECRET`), and the two Vault secrets. The user sets secrets;
   they are never committed.

## 4. Testing

- Update Vitest suites for renames, status options, tabs, applicant detail card, admin pages.
- New tests: AI score polling starts/stops by status; tab switching and URL sync; applicant
  detail shows job/department/rank.
- Database tests (`supabase/tests`): ranks seeded with 12 unique codes; status constraint rejects
  `inactive`; department/rank delete RPCs no longer exist; sweeper marks stale rows failed.
- Run `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`; update and run
  Playwright e2e for changed labels.

## Out of scope

- Adding new demo data (the client will enter it).
- Changing the AI scoring model or prompt.
- Setting production secrets.
