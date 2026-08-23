# Attendance Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure, role-scoped CSV/XLSX attendance import module with explicit external-ID mapping, idempotent event ingestion, attendance statuses, and a replaceable vendor-adapter boundary.

**Architecture:** A Supabase migration owns integration settings, mappings, import/audit records, canonical attendance logs, unmatched events, RLS, and narrow RPCs. A JWT-protected Deno Edge Function parses a bounded file through the CSV/XLSX adapter, then asks the database to process each normalized event atomically. Next.js consumes only RLS-protected read models and RPCs via Zod-validated queries and TanStack Query.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Zod 4, TanStack Query 5, Supabase Postgres/RLS/RPC, Supabase Edge Functions/Deno, `npm:xlsx@0.18.5`, Vitest, Testing Library, pgTAP.

**Spec:** `docs/superpowers/specs/2026-08-24-attendance-integration-design.md`

## Global Constraints

- Work only on `feat/14-attendance-integration`, created from `main`.
- The supported initial integration is a validated CSV/XLSX import; future vendor API/webhook code must implement the same normalized-event boundary.
- Never persist or log fingerprint templates, facial templates/images, raw biometric payloads, vendor credentials, or names as matching inputs.
- Match only a normalized stable `external_employee_id`; unknown IDs enter the HR review queue and are never name-matched.
- Demo defaults are `Asia/Ulaanbaatar`, 08:00 start, and 15-minute grace; store them as administrator-managed configuration, not hard-coded client behavior.
- Use `attendance` and `absence` event types. Only explicit imported absence rows create `absent`; missing data never implies absence.
- Use `(integration_id, source_event_id)` as the idempotency key. Replays are skipped and counted, not duplicated.
- All new public tables need RLS, explicit `anon`/`authenticated` privilege revocation, least-privilege select policies, and pgTAP policy tests.
- Browser writes to attendance tables are forbidden. All imports, mapping resolution, and settings mutation use protected Edge Function/RPC workflows.
- `SECURITY DEFINER` functions use `set search_path = ''`, revoke default execution, grant only intended public wrappers to `authenticated`, and validate the caller inside the private function.
- Apply the validated migration to the connected Supabase project with MCP `apply_migration`; then verify schema, RLS, migration name, and PostgREST cache through MCP before declaring the remote deployment ready.
- Preserve project checks: `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, and relevant `supabase test db --file ...`.

---

## File Structure

- Create `supabase/migrations/<timestamp>_attendance_integration.sql` — tables, constraints, indexes, RLS, private/public RPCs, audit writes, and grants.
- Create `supabase/tests/attendance_integration.test.sql` — pgTAP authorization, mapping, event idempotency, status, unmatched, and audit tests.
- Create `supabase/functions/_shared/attendance-adapter.ts` and `.test.ts` — adapter interface, normalized-event Zod schema, CSV/XLSX parser, template validation, ID normalization, and safe diagnostics.
- Create `supabase/functions/import-attendance/index.ts` and `.test.ts` — authenticated HR ingestion handler, file limits, adapter invocation, and RPC orchestration.
- Modify `src/lib/types/database.ts` — attendance row, import, mapping, settings, unmatched-event, and status types.
- Create `src/schemas/attendance-integration.ts` and `.test.ts`; modify `src/schemas/index.ts` — settings, filter, mapping, route and import contracts.
- Modify `src/lib/query-keys.ts` and `.test.ts` — attendance cache keys.
- Create `src/queries/attendance-integration.ts` and `.test.ts` — RLS-protected reads, admin settings RPC, HR mapping RPC, and Edge Function invocation.
- Create `src/hooks/use-attendance-integration.ts` and `.test.tsx` — query/mutation cache contracts.
- Create `src/components/attendance-integration/attendance-status-badge.tsx`, `hr-attendance-directory.tsx`, `attendance-importer.tsx`, `unmatched-attendance-queue.tsx`, `employee-attendance-list.tsx`, `attendance-integration-settings.tsx`, and `attendance-integration.test.tsx` — focused UI workspaces.
- Create `src/app/(app)/hr/attendance/page.tsx`, `import/page.tsx`, `unmatched/page.tsx`, `src/app/(app)/employee/attendance/page.tsx`, and `src/app/(app)/admin/integrations/attendance/page.tsx` — protected routes inheriting existing role layouts.
- Modify `src/lib/app/role-config.ts` and `.test.ts` — HR, Employee, and Administrator navigation entries.
- Modify `README.md` — documented template columns, Edge Function deployment command, function-only secret rules, sample import, and deferred vendor checklist.

### Task 1: Create the protected attendance database vertical slice

**Files:**
- Create: `supabase/migrations/<timestamp>_attendance_integration.sql`
- Create: `supabase/tests/attendance_integration.test.sql`

**Interfaces:**
- Consumes: `public.employees`, `public.profiles`, `public.user_roles`, `public.audit_logs`, `private.require_active_hr()`, `private.current_user_has_role(public.app_role)`, and the existing active-administrator helper.
- Produces: `attendance_integration_settings`, `attendance_identity_mappings`, `attendance_imports`, `attendance_logs`, `attendance_unmatched_events`; `public.update_attendance_integration_settings(text,time,integer,text,boolean) returns void`; `public.create_attendance_import(text,text,text,text) returns uuid`; `public.process_attendance_event(uuid,text,text,date,timestamptz,timestamptz,text,jsonb) returns text`; `public.resolve_attendance_unmatched_event(uuid,uuid) returns uuid`; and `public.fail_attendance_import(uuid,text) returns void`.

- [ ] **Step 1: Generate a migration and write the failing pgTAP journey**

  Run `npx supabase@latest migration new attendance_integration` to create the migration filename; do not invent a timestamp. In `attendance_integration.test.sql`, add a 24-assertion transaction that seeds one HR user, one administrator, two employees, and an unmapped device ID. Assert all five tables/RPCs and RLS exist; HR can create an import and process a `DEV-001` event once; replaying `EVT-001` returns `duplicate`; a mapped employee sees only their log; the second employee sees none; an unknown ID produces an unmatched row; HR can resolve it only by choosing an employee; non-HR cannot create/process/resolve; only the administrator changes settings; and invalid status/times are rejected.

  ```sql
  select extensions.has_function('public', 'process_attendance_event',
    array['uuid','text','text','date','timestamp with time zone','timestamp with time zone','text','jsonb'],
    'Attendance event RPC exists');

  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000801';
  select extensions.is(
    public.process_attendance_event(
      current_setting('test.import_id')::uuid, 'DEV-001', 'EVT-001', '2026-08-24',
      '2026-08-24 08:16:00+08'::timestamptz, '2026-08-24 17:00:00+08'::timestamptz,
      'attendance', '{"adapterVersion":"csv-xlsx-v1","rowNumber":2}'::jsonb
    ), 'inserted', 'HR imports a mapped late event'
  );
  ```

- [ ] **Step 2: Run the database test and confirm it fails**

  Run: `supabase test db --file supabase/tests/attendance_integration.test.sql`

  Expected: FAIL because the attendance tables and functions do not exist.

- [ ] **Step 3: Implement tables, constraints, indexes, RLS, and atomic RPCs**

  Add these stable types and core tables. `attendance_logs` must include a unique `(integration_id, source_event_id)` index; it is the only duplicate guard. Use `timestamptz` for recorded times and `date` for attendance date. `sync_metadata` is an object containing only `adapterVersion`, `templateVersion`, `rowNumber`, and checksum; reject any other metadata keys in the RPC.

  ```sql
  create table public.attendance_integration_settings (
    id uuid primary key default gen_random_uuid(),
    adapter_key text not null unique default 'csv_xlsx' check (adapter_key = 'csv_xlsx'),
    timezone text not null default 'Asia/Ulaanbaatar' check (timezone = 'Asia/Ulaanbaatar'),
    workday_start time not null default time '08:00',
    late_grace_minutes integer not null default 15 check (late_grace_minutes between 0 and 120),
    template_version text not null default 'v1' check (template_version = btrim(template_version) and char_length(template_version) between 1 and 40),
    is_enabled boolean not null default true, updated_by_user_id uuid references public.profiles(id), updated_at timestamptz not null default now()
  );
  create table public.attendance_identity_mappings (
    id uuid primary key default gen_random_uuid(), employee_id uuid not null unique references public.employees(id) on delete restrict,
    external_employee_id text not null unique check (external_employee_id = upper(btrim(external_employee_id)) and char_length(external_employee_id) between 1 and 64),
    created_by_user_id uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
  );
  create table public.attendance_imports (
    id uuid primary key default gen_random_uuid(), source_filename text not null check (source_filename = btrim(source_filename) and char_length(source_filename) between 1 and 255),
    mime_type text not null check (mime_type in ('text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
    checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'), adapter_key text not null default 'csv_xlsx',
    status text not null default 'processing' check (status in ('processing','completed','completed_with_issues','failed')),
    accepted_count integer not null default 0 check (accepted_count >= 0), duplicate_count integer not null default 0 check (duplicate_count >= 0),
    unmatched_count integer not null default 0 check (unmatched_count >= 0), invalid_count integer not null default 0 check (invalid_count >= 0),
    error_summary text check (error_summary is null or (error_summary = btrim(error_summary) and char_length(error_summary) <= 2000)),
    imported_by_user_id uuid not null references public.profiles(id), created_at timestamptz not null default now(), completed_at timestamptz
  );
  ```

  Add `attendance_logs` with `employee_id`, `integration_id`, `source_event_id`, `external_employee_id`, `attendance_date`, nullable `time_in` and `time_out`, calculated status (`present`, `late`, `absent`, `incomplete`), `import_id`, and `sync_metadata`; enforce `time_out is null or time_out >= time_in`, explicit absences with both time columns null, and non-absence events with a time-in. Add `attendance_unmatched_events` with the same normalized event data, import reference, unique integration/event ID, resolution user/time, and `resolved_log_id`.

  Enable RLS and revoke table privileges from `anon`/`authenticated`, then grant only `select` to `authenticated`. Policies permit HR reads of every attendance operational table, Employee reads of `attendance_logs` only where `employees.profile_id = auth.uid()`, and Administrator reads of settings only. Add no direct mutation policies.

  Private RPCs must call their role guard, lock mapping/event rows, and write `audit_logs`: `process_attendance_event` calculates `absent` only for explicit `absence`, `late` when `time_in::time > workday_start + make_interval(mins => late_grace_minutes)`, otherwise `present`/`incomplete`; it returns `inserted`, `duplicate`, or `unmatched`. `resolve_attendance_unmatched_event` locks the unresolved event, upserts one mapping only when no conflicting employee/device mapping exists, creates a canonical event using the same idempotency guard, marks the queue row resolved, and records an audit entry. `fail_attendance_import` marks the run failed and logs `attendance_import_failed`.

- [ ] **Step 4: Run database tests and inspect schema quality**

  Run: `supabase test db --file supabase/tests/attendance_integration.test.sql`

  Expected: PASS with every pgTAP assertion completed.

  Run `supabase db advisors` and resolve any new security/performance finding created by this migration before proceeding.

- [ ] **Step 5: Commit the database vertical slice**

  ```bash
  git add supabase/migrations/*_attendance_integration.sql supabase/tests/attendance_integration.test.sql
  git commit -m "feat: add secure attendance data model"
  ```

### Task 2: Implement and test the CSV/XLSX adapter and Edge Function

**Files:**
- Create: `supabase/functions/_shared/attendance-adapter.ts`
- Create: `supabase/functions/_shared/attendance-adapter.test.ts`
- Create: `supabase/functions/import-attendance/index.ts`
- Create: `supabase/functions/import-attendance/index.test.ts`

**Interfaces:**
- Consumes: `attendance_integration_settings`, the Task 1 RPCs, the caller JWT, and `npm:xlsx@0.18.5`.
- Produces: `NormalizedAttendanceEvent`, `CsvXlsxAttendanceAdapter.parse(file, settings)`, and `createImportAttendanceHandler(dependencies)`.

- [ ] **Step 1: Write failing adapter and handler tests**

  Test a UTF-8 CSV and an in-memory XLSX workbook with the exact v1 headers `external_employee_id`, `source_event_id`, `attendance_date`, `time_in`, `time_out`, `event_type`. Assert lowercase/space-padded external IDs normalize to uppercase; valid 08:16 attendance emits a timestamp event; an explicit absence permits blank times; missing header, name-only row, invalid event type, inverted times, overlong ID, unrecognized metadata, and oversized row count are rejected with safe row-number diagnostics. Mock Supabase clients to prove a missing token returns 401, Employee returns 403, input error returns 400, an accepted file invokes `create_attendance_import`, `process_attendance_event` per valid row, and `fail_attendance_import` on unexpected failure.

  ```ts
  Deno.test("normalizes a CSV event without accepting a name", async () => {
    const result = await new CsvXlsxAttendanceAdapter().parse(csvFile([
      ["external_employee_id","source_event_id","attendance_date","time_in","time_out","event_type"],
      [" dev-001 ","EVT-001","2026-08-24","08:16","17:00","attendance"],
    ]), settings);
    assertEquals(result.events[0]?.externalEmployeeId, "DEV-001");
    assertEquals(result.events[0]?.sourceEventId, "EVT-001");
  });
  ```

- [ ] **Step 2: Run Edge Function tests and confirm they fail**

  Run: `deno test --allow-env supabase/functions/_shared/attendance-adapter.test.ts supabase/functions/import-attendance/index.test.ts`

  Expected: FAIL because the adapter and import handler do not exist.

- [ ] **Step 3: Implement the normalized adapter contract and secure handler**

  Define `NormalizedAttendanceEvent` as `{ externalEmployeeId: string; sourceEventId: string; attendanceDate: string; timeIn: string | null; timeOut: string | null; eventType: "attendance" | "absence"; metadata: { adapterVersion: "csv-xlsx-v1"; templateVersion: "v1"; rowNumber: number } }`. `CsvXlsxAttendanceAdapter.parse` accepts exactly CSV or XLSX, a maximum 2 MB body and 5,000 data rows, reads the first worksheet only, requires exact headers, never reads unknown columns into metadata, and returns `{ events, invalidRows }`.

  `createImportAttendanceHandler` accepts `POST` multipart form data with field `file`, validates the bearer token using a caller client, verifies `hr_personnel`, and uses that same token for every settings/read and mutation RPC so `auth.uid()` and the SQL role guard remain enforceable. It computes SHA-256 on file bytes, creates the import record, then calls `process_attendance_event` for every normalized valid event. It returns `{ importId, acceptedCount, duplicateCount, unmatchedCount, invalidCount, status }`; it calls `fail_attendance_import` and returns a generic 500 response if processing fails. No service-role key is required for this function, and no secret belongs in browser code. Do not use CORS because the browser invokes the function with the authenticated Supabase client.

- [ ] **Step 4: Run Edge Function tests and format/type-check the function**

  Run: `deno test --allow-env supabase/functions/_shared/attendance-adapter.test.ts supabase/functions/import-attendance/index.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit adapter and function**

  ```bash
  git add supabase/functions/_shared/attendance-adapter.ts supabase/functions/_shared/attendance-adapter.test.ts supabase/functions/import-attendance/index.ts supabase/functions/import-attendance/index.test.ts
  git commit -m "feat: add secure attendance import function"
  ```

### Task 3: Define client contracts, types, and query keys

**Files:**
- Modify: `src/lib/types/database.ts`
- Create: `src/schemas/attendance-integration.ts`
- Create: `src/schemas/attendance-integration.test.ts`
- Modify: `src/schemas/index.ts`
- Modify: `src/lib/query-keys.ts`
- Modify: `src/lib/query-keys.test.ts`

**Interfaces:**
- Consumes: Task 1 table/RPC names and Task 2 import response.
- Produces: `AttendanceLog`, `AttendanceImport`, `AttendanceUnmatchedEvent`, `AttendanceIntegrationSettings`, `attendanceFiltersSchema`, `attendanceSettingsSchema`, `attendanceMappingSchema`, and `queryKeys.attendanceIntegration`.

- [ ] **Step 1: Write failing schema/query-key tests**

  Assert filters normalize a one-day range, reject reversed dates and page sizes over 100; settings accept `08:00` and 15 but reject timezone changes and a grace value outside 0–120; a mapping trims and uppercases `dev-001`; route IDs require UUIDs; HR history, employee history, imports, unmatched, and settings keys are distinct and stable.

- [ ] **Step 2: Run focused tests and confirm they fail**

  Run: `npm run test:run -- src/schemas/attendance-integration.test.ts src/lib/query-keys.test.ts`

  Expected: FAIL because attendance contracts and keys do not exist.

- [ ] **Step 3: Add types, contracts, and keys**

  Add database types whose fields mirror the SQL tables. Make the UI status union exactly `"present" | "late" | "absent" | "incomplete"`. `attendanceFiltersSchema` has optional `employeeId`, status, `startsOn`, `endsOn`, page and pageSize. `attendanceSettingsSchema` exposes only `workdayStart`, `lateGraceMinutes`, `templateVersion`, and `isEnabled`; timezone and adapter key are read-only. `attendanceMappingSchema` requires `{ employeeId, externalEmployeeId, unmatchedEventId? }`. Add query keys `hrLogs(filters)`, `mine(filters)`, `imports(filters)`, `unmatched(filters)`, and `settings()`.

- [ ] **Step 4: Run focused tests and confirm they pass**

  Run: `npm run test:run -- src/schemas/attendance-integration.test.ts src/lib/query-keys.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit client contracts**

  ```bash
  git add src/lib/types/database.ts src/schemas/attendance-integration.ts src/schemas/attendance-integration.test.ts src/schemas/index.ts src/lib/query-keys.ts src/lib/query-keys.test.ts
  git commit -m "feat: add attendance client contracts"
  ```

### Task 4: Add attendance data access and cache behavior

**Files:**
- Create: `src/queries/attendance-integration.ts`
- Create: `src/queries/attendance-integration.test.ts`
- Create: `src/hooks/use-attendance-integration.ts`
- Create: `src/hooks/use-attendance-integration.test.tsx`

**Interfaces:**
- Consumes: Task 1 protected reads/RPCs, Task 2 `import-attendance` function, and Task 3 contracts/keys.
- Produces: `listHrAttendanceLogs`, `listMyAttendanceLogs`, `listAttendanceImports`, `listUnmatchedAttendanceEvents`, `getAttendanceSettings`, `importAttendanceFile`, `saveAttendanceSettings`, `resolveUnmatchedAttendanceEvent`, and their `use...` hooks.

- [ ] **Step 1: Write failing query and hook tests**

  Mock `createBrowserSupabaseClient`. Assert the HR list parses filters, selects employee summary fields, filters status/date/employee, orders `attendance_date` then `time_in` descending, and paginates. Assert employee listing never takes an employee ID. Assert `importAttendanceFile` calls `functions.invoke("import-attendance", { body: FormData })`, settings call `update_attendance_integration_settings` with snake-case keys, and resolution calls `resolve_attendance_unmatched_event`. Assert successful import/resolution invalidates the attendance prefix and audit-log keys; settings invalidates settings and attendance logs.

- [ ] **Step 2: Run focused tests and confirm they fail**

  Run: `npm run test:run -- src/queries/attendance-integration.test.ts src/hooks/use-attendance-integration.test.tsx`

  Expected: FAIL because attendance data access does not exist.

- [ ] **Step 3: Implement safe reads and mutations**

  Parse all public inputs before requests and preserve `throwIfError` error mapping. `listHrAttendanceLogs` selects `*, employee:employees(id, employee_number, first_name, last_name)`; `listMyAttendanceLogs` selects only `attendance_logs` under RLS. Neither query reads mappings or unmatched events for employees. Import accepts a `File`, validates MIME and 2 MB client-side before invoke, and returns the server count result without retaining the file. Mapping resolution must never send a name; it maps only schema-validated UUID/normalized external ID values to the RPC.

- [ ] **Step 4: Run focused tests and confirm they pass**

  Run: `npm run test:run -- src/queries/attendance-integration.test.ts src/hooks/use-attendance-integration.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit query and hook behavior**

  ```bash
  git add src/queries/attendance-integration.ts src/queries/attendance-integration.test.ts src/hooks/use-attendance-integration.ts src/hooks/use-attendance-integration.test.tsx
  git commit -m "feat: add attendance data access"
  ```

### Task 5: Build the HR, Employee, and Administrator workspaces

**Files:**
- Create: `src/components/attendance-integration/attendance-status-badge.tsx`
- Create: `src/components/attendance-integration/hr-attendance-directory.tsx`
- Create: `src/components/attendance-integration/attendance-importer.tsx`
- Create: `src/components/attendance-integration/unmatched-attendance-queue.tsx`
- Create: `src/components/attendance-integration/employee-attendance-list.tsx`
- Create: `src/components/attendance-integration/attendance-integration-settings.tsx`
- Create: `src/components/attendance-integration/attendance-integration.test.tsx`
- Create: `src/app/(app)/hr/attendance/page.tsx`
- Create: `src/app/(app)/hr/attendance/import/page.tsx`
- Create: `src/app/(app)/hr/attendance/unmatched/page.tsx`
- Create: `src/app/(app)/employee/attendance/page.tsx`
- Create: `src/app/(app)/admin/integrations/attendance/page.tsx`
- Modify: `src/lib/app/role-config.ts`
- Modify: `src/lib/app/role-config.test.ts`

**Interfaces:**
- Consumes: Task 3 status/types and Task 4 hooks.
- Produces: role-inheriting pages and UI components with no client-side authorization assumptions.

- [ ] **Step 1: Write failing component and navigation tests**

  Test all four status badges render accessible labels. Test the importer disables unsupported file types and shows accepted/duplicate/unmatched/invalid counts. Test the HR directory renders filters, employee/dates/statuses, empty and error states, and links to Import/Unmatched. Test the unmatched queue lets HR select an employee but has no free-text name matching field. Test employee history shows only supplied logs and has no upload/mapping/settings control. Test administrator settings renders read-only adapter/timezone plus editable start/grace/template/enabled values and a visible deferred-vendor checklist. Assert the navigation has `/hr/attendance`, `/employee/attendance`, and `/admin/integrations/attendance` only for their intended roles.

- [ ] **Step 2: Run focused UI tests and confirm they fail**

  Run: `npm run test:run -- src/components/attendance-integration/attendance-integration.test.tsx src/lib/app/role-config.test.ts`

  Expected: FAIL because attendance components/routes/navigation do not exist.

- [ ] **Step 3: Implement accessible role-scoped workspaces**

  `AttendanceStatusBadge` maps exact status values to existing `Badge` variants and plain text. `HrAttendanceDirectory` calls the HR hook with bounded filters and renders `<table>` loading, error, and empty states. `AttendanceImporter` uses a labeled `<input type="file" accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">`, sends only one selected file, and reports server counts. `UnmatchedAttendanceQueue` renders external IDs and safe dates, fetches/selects an existing employee record, then calls the resolution hook; it never sends/compares a name. `EmployeeAttendanceList` is read-only. `AttendanceIntegrationSettings` explains that credential fields do not belong in the browser and that a vendor replacement requires docs/test credentials/event semantics.

  Keep page components thin with existing page-heading style. HR and Employee routes inherit their layouts; create `src/app/(app)/admin/integrations/layout.tsx` if needed to enforce `requireRole("system_administrator")` before the attendance settings page. Use `BriefcaseBusiness`/`Settings` existing icon variants rather than expanding navigation icon contracts.

- [ ] **Step 4: Run focused UI tests and confirm they pass**

  Run: `npm run test:run -- src/components/attendance-integration/attendance-integration.test.tsx src/lib/app/role-config.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit UI and routes**

  ```bash
  git add src/components/attendance-integration src/app/'(app)'/hr/attendance src/app/'(app)'/employee/attendance src/app/'(app)'/admin/integrations src/lib/app/role-config.ts src/lib/app/role-config.test.ts
  git commit -m "feat: add attendance workspaces"
  ```

### Task 6: Deploy safely, document the template, and run the full verification suite

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–5 and the connected Supabase MCP project.
- Produces: deployed migration/Edge Function, a reproducible CSV/XLSX import procedure, and current verification evidence.

- [ ] **Step 1: Write documentation assertions and prepare demo input**

  Add README sections with the six exact template columns, valid `attendance`/`absence` examples, 2 MB/5,000-row limit, external-ID-only rule, no-biometric-data rule, Edge Function secret names, and the future-vendor readiness checklist. Include a CSV sample with one `DEV-001` attendance row, one explicit `DEV-002` absence row, and one unmatched ID; do not include real personnel or biometric data.

- [ ] **Step 2: Verify the docs/test command fails before implementation is complete**

  Run: `npm run test:run -- src/components/attendance-integration/attendance-integration.test.tsx`

  Expected before Task 5: FAIL; after Tasks 1–5, PASS. Do not skip this recorded red/green checkpoint.

- [ ] **Step 3: Apply and deploy the validated remote artifacts through Supabase MCP**

  After local SQL and Edge tests pass, use MCP `list_tables`, `list_migrations`, and security/performance advisors. Call MCP `apply_migration` with the exact contents of `supabase/migrations/<timestamp>_attendance_integration.sql`. Deploy `import-attendance` with MCP `deploy_edge_function`, `verify_jwt: true`, the entrypoint plus `_shared/attendance-adapter.ts`, and any required import-map files. Never pass a secret in a client file or output.

- [ ] **Step 4: Verify the remote schema and original attendance journey**

  With MCP, verify every new table exists and RLS is enabled; verify the applied migration name is `attendance_integration`; query for the settings row and policy count; confirm PostgREST schema cache reload logs after DDL. Invoke the deployed function with an HR token and demo CSV/XLSX once each; assert the first creates logs, replay returns duplicate counts, the unmatched ID is queued, and an employee session reads only its own record. Run MCP security advisors and address any new warning caused by this branch.

- [ ] **Step 5: Run complete local checks and commit documentation**

  Run:

  ```bash
  supabase test db --file supabase/tests/attendance_integration.test.sql
  deno test --allow-env supabase/functions/_shared/attendance-adapter.test.ts supabase/functions/import-attendance/index.test.ts
  npm run lint
  npm run typecheck
  npm run test:run
  npm run build
  git diff --check
  ```

  Expected: every command exits 0. Then commit only the README work:

  ```bash
  git add README.md
  git commit -m "docs: document attendance import setup"
  ```

## Plan self-review

- **Spec coverage:** Task 1 implements configuration, identity mapping, import metadata, canonical logs, unmatched queue, idempotency, RLS, and audited failure paths. Task 2 implements the vendor-neutral CSV/XLSX boundary and secure function. Tasks 3–5 implement every required route and role boundary. Task 6 applies/verifies MCP migration and function deployment, validates CSV/XLSX once, and documents vendor replacement.
- **Placeholder scan:** The plan uses generated migration paths only where the Supabase CLI must create a timestamp; every required schema, interface, command, and test behavior is named above.
- **Type consistency:** All later tasks use `NormalizedAttendanceEvent`, the `process_attendance_event` RPC, exact status/event unions, and `attendanceIntegration` query-key namespace defined by earlier tasks.
