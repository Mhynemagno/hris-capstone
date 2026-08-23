# Quality Release and Turnover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the confirmed dashboard and employee-account release blockers, then provide evidence that the intended HRIS role journeys are ready for demonstration and turnover.

**Architecture:** First reconcile the connected Supabase schema without blindly replaying drifted migration history, then add a minimal protected RPC that exposes only unlinked Employee accounts to HR. The existing personnel-record form consumes that typed account candidate and creates the binding. A release matrix, dummy seed data, and operational documentation turn existing automated tests plus manual checks into an auditable handover package.

**Tech Stack:** Next.js App Router, TypeScript, React, TanStack Query, Zod, Vitest, Supabase PostgreSQL/RLS/Storage/Edge Functions, pgTAP, Mermaid, Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-08-24-quality-release-and-turnover-design.md`

## Global Constraints

- Do not add Playwright, Cypress, a browser-test CI dependency, or Vercel CLI automation.
- Use only fictitious, anonymized, or consented demo data; do not commit secrets, `service_role`, raw biometric data, or private documents.
- Keep Management read-only; HR makes hiring decisions; Administrators manage internal accounts and approve profile changes.
- All browser data access remains through Supabase with RLS; narrow privileged workflows use validated, revocation-hardened database functions.
- Verify remote migration history and live schema before modifying the connected Supabase project; never blindly replay drifted migrations.

---

## File structure

- `supabase/migrations/<generated>_quality_release_employee_account_linking.sql` — guarded account-candidate RPC and any idempotent reporting-schema repair proved necessary by remote inventory.
- `supabase/tests/quality_release_employee_account_linking.test.sql` — pgTAP permission, filtering, and binding regression tests.
- `src/lib/types/database.ts` — `UnlinkedEmployeeAccount` type.
- `src/queries/personnel-records.ts` and test — typed RPC client function and account-aware employee save payload.
- `src/hooks/use-personnel-records.ts` — query key, candidate query, and mutation invalidation.
- `src/components/personnel-records/employee-account-picker.tsx` — focused loading/error/empty/select UI for account candidates.
- `src/components/personnel-records/employee-directory.tsx`, `employee-editor.tsx`, `employee-form.tsx`, and tests — selected-account route/form integration and prefill behavior.
- `supabase/seed.sql` — idempotent anonymous local demo fixtures; no credentials or private documents.
- `docs/release-verification-matrix.md` — role/action evidence matrix and discovered-gap register.
- `docs/DEPLOYMENT_RUNBOOK.md`, `docs/ENVIRONMENT_CHECKLIST.md`, `docs/BIOMETRIC_PROVIDER_READINESS.md`, `docs/ARCHITECTURE.md`, `docs/USER_GUIDE.md`, `docs/ADMIN_GUIDE.md` — turnover package.

### Task 1: Establish baseline and reconcile the reporting deployment

**Files:**
- Modify only if required by verified remote state: `supabase/migrations/<generated>_quality_release_employee_account_linking.sql`
- Test: `supabase/tests/dashboards_and_reports.test.sql`
- Document: `docs/release-verification-matrix.md`

**Interfaces:**
- Consumes: existing `public.get_hr_dashboard_summary(date, date)` and `public.get_management_dashboard_summary(date, date)` contracts.
- Produces: a live, PostgREST-visible reporting RPC contract with `authenticated` execution only.

- [ ] **Step 1: Record the current local baseline**

Run:

```powershell
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run build
npx supabase@latest test db --local supabase/tests/dashboards_and_reports.test.sql
```

Record every pass/failure with command, date, and environment in the matrix; do not label an unrun command as passed.

- [ ] **Step 2: Prove the live schema mismatch before changing it**

Run read-only inventory queries through `npx supabase@latest db query --linked` for `supabase_migrations.schema_migrations`, `pg_proc` entries named `get_hr_dashboard_summary`/`get_management_dashboard_summary`, the `reporting` schema, required module tables, and grants. Record the actual rows in the matrix.

- [ ] **Step 3: Write a failing live-contract test record**

Add a matrix finding with the exact PostgREST error and a reproduction: authenticated HR requests `get_hr_dashboard_summary` with `target_starts_on` and `target_ends_on`; expected result is a JSON payload with `metrics`, current result is missing-schema-function error.

- [ ] **Step 4: Choose the minimal safe remote repair from the inventory**

If the remote objects exactly match the missing local migrations but history timestamps differ, use `supabase migration repair` only for the verified equivalent versions, then push the dashboards migration. If tables/functions are absent, apply the ordered missing migrations with `npx supabase@latest db push --linked`. If the remote schema is partially divergent, create a new migration with `npx supabase@latest migration new quality_release_reporting_repair`, containing only `create or replace` definitions and grants proven absent. Do not run a repair or push until the selected path is written in the matrix.

- [ ] **Step 5: Verify the repaired reporting boundary**

Run the dashboard pgTAP test against a fresh local reset and query the remote `pg_proc` identity arguments plus routine grants. Call the live RPC with an HR token only after the function is visible. Expected: two `date` arguments in start/end order, `authenticated` execute grant, successful HR payload, and no callable `anon`/`PUBLIC` path.

- [ ] **Step 6: Commit the reporting evidence or repair**

```powershell
git add supabase docs/release-verification-matrix.md
git commit -m "fix: reconcile reporting release contract"
```

### Task 2: Add secure unlinked Employee-account discovery

**Files:**
- Create: `supabase/migrations/<generated>_quality_release_employee_account_linking.sql`
- Create: `supabase/tests/quality_release_employee_account_linking.test.sql`
- Modify: `src/lib/types/database.ts`

**Interfaces:**
- Produces `public.list_unlinked_employee_accounts()` returning `profile_id uuid`, `first_name text`, `last_name text`, `full_name text`, and `email text`.
- Produces TypeScript `UnlinkedEmployeeAccount = { profile_id: string; first_name: string | null; last_name: string | null; full_name: string | null; email: string | null }`.

- [ ] **Step 1: Write pgTAP tests before SQL**

The test creates active/inactive profiles, Employee/HR/Management roles, linked/unlinked `employees` rows, and invitation-style auth metadata. Assert: an HR caller receives only the active unlinked Employee account; linked, inactive, and non-Employee accounts are absent; Employee, Management, Applicant, Administrator, and anon callers receive `42501`; `anon` has no function execute grant.

- [ ] **Step 2: Run the new pgTAP test and confirm it fails**

```powershell
npx supabase@latest test db --local supabase/tests/quality_release_employee_account_linking.test.sql
```

Expected: failure because `list_unlinked_employee_accounts` does not exist.

- [ ] **Step 3: Create the migration through the Supabase CLI**

```powershell
npx supabase@latest migration new quality_release_employee_account_linking
```

Implement a private `security definer`, empty-`search_path` function that checks an active HR caller, joins `profiles`, `user_roles`, and `employees`, filters to active unlinked `employee` roles, and returns only the declared fields. Derive `first_name` and `last_name` only from the target account's `auth.users.raw_user_meta_data`; return `profiles.full_name` as the non-destructive fallback. Create a public wrapper, revoke `PUBLIC`/`anon`, grant `authenticated`, and use explicit ordering.

- [ ] **Step 4: Run tests and security checks**

Run the new pgTAP test and the existing personnel-records test on a clean local reset. Inspect function configuration/grants with `pg_get_functiondef`, `pg_proc.proconfig`, and `information_schema.routine_privileges`.

- [ ] **Step 5: Commit the protected account boundary**

```powershell
git add supabase src/lib/types/database.ts
git commit -m "feat: expose unlinked employee accounts to HR"
```

### Task 3: Bind a selected account to a new personnel record

**Files:**
- Create: `src/components/personnel-records/employee-account-picker.tsx`
- Modify: `src/queries/personnel-records.ts`, `src/queries/personnel-records.test.ts`, `src/hooks/use-personnel-records.ts`, `src/components/personnel-records/employee-directory.tsx`, `src/components/personnel-records/employee-editor.tsx`, `src/components/personnel-records/employee-form.tsx`
- Test: `src/components/personnel-records/personnel-records.test.tsx`

**Interfaces:**
- `listUnlinkedEmployeeAccounts(): Promise<UnlinkedEmployeeAccount[]>` calls only `rpc("list_unlinked_employee_accounts")`.
- `useUnlinkedEmployeeAccounts()` uses `queryKeys.personnelRecords.unlinkedAccounts()`.
- `EmployeeForm` accepts optional `account: UnlinkedEmployeeAccount`; a selected account submits its `profileId` and prefilled identity fields.

- [ ] **Step 1: Write failing query and component tests**

Mock the Supabase RPC and assert its exact function name. Render the picker in loading, retryable error, empty, and populated states. Select an account and assert the create form contains its first name, last name, email, and hidden `profileId`; submit and assert `saveEmployee` receives that binding. Assert a manual creation still works when no account is selected.

- [ ] **Step 2: Run the focused tests and confirm failure**

```powershell
npx vitest run src/queries/personnel-records.test.ts src/components/personnel-records/personnel-records.test.tsx
```

Expected: missing query/hook/component behavior.

- [ ] **Step 3: Implement the smallest account-aware flow**

Add the typed RPC query and hook. Render a dedicated `Accounts awaiting personnel record` section above the current directory; its action navigates to `/hr/employees/new?profileId=<uuid>`. Load the selected candidate on that page, show a concise retryable error if it is no longer eligible, and pass it into the existing form. Use a hidden `profileId`, keep prefilled first name, last name, and email editable for legacy records, and preserve all existing official-field validation and insert RLS.

- [ ] **Step 4: Invalidate both lists after a bind**

On a successful employee save, invalidate the personnel directory, detail record, and `unlinkedAccounts` query keys. Add an assertion that the candidate list refetches after binding.

- [ ] **Step 5: Run focused then full application tests**

```powershell
npx vitest run src/queries/personnel-records.test.ts src/components/personnel-records/personnel-records.test.tsx src/hooks/use-personnel-records.test.ts
npm run test:run
```

- [ ] **Step 6: Commit the completed workflow**

```powershell
git add src
git commit -m "feat: link employee accounts to personnel records"
```

### Task 4: Build reproducible demo data and release documentation

**Files:**
- Create: `supabase/seed.sql`, `docs/release-verification-matrix.md`, `docs/DEPLOYMENT_RUNBOOK.md`, `docs/ENVIRONMENT_CHECKLIST.md`, `docs/BIOMETRIC_PROVIDER_READINESS.md`, `docs/ARCHITECTURE.md`, `docs/USER_GUIDE.md`, `docs/ADMIN_GUIDE.md`

**Interfaces:**
- Consumes all route, RLS, Storage, Edge Function, and migration contracts already present in the repository.
- Produces a manual demonstration procedure with explicit local-versus-production evidence and owner handoff.

- [ ] **Step 1: Define idempotent fake demo fixtures**

Create a `supabase/seed.sql` that uses deterministic test IDs/emails under `.test`, `on conflict` guards, fake departments/positions, five roles, one unlinked Employee account, and minimal records supporting all five mandatory journeys. Do not create real attachment payloads, biometric data, AI credentials, or production users.

- [ ] **Step 2: Verify a clean local reset uses only demo data**

```powershell
npx supabase@latest db reset --local
npx supabase@latest test db --local supabase/tests/auth_rbac_foundation.test.sql
npx supabase@latest test db --local supabase/tests/quality_release_employee_account_linking.test.sql
```

Inspect `git diff --check` and `git status --ignored` to ensure no environment file, generated credential, or document was added.

- [ ] **Step 3: Write the functional audit matrix**

For each role and every mandatory journey, include: feature/action, intended/prohibited role, route, database or function boundary, data fixture, manual steps, automated test path, result, evidence date, and external dependency. Add a numbered findings register; include the dashboard mismatch and account-linking defects as resolved only after their verification evidence exists.

- [ ] **Step 4: Write handover documentation**

Document the exact migration-inventory/reconciliation flow, Edge Function deployment commands, Vercel public variables and Supabase Auth redirect URL setup, manual production smoke test, rollback verification, biometric-vendor prerequisites, architecture data flows, employee/user instructions, and administrator account/role procedures. The architecture diagram is Mermaid source and explicitly identifies no raw biometric storage.

- [ ] **Step 5: Commit the handover package**

```powershell
git add supabase/seed.sql docs
git commit -m "docs: add release turnover package"
```

### Task 5: Execute and record the release certification

**Files:**
- Modify: `docs/release-verification-matrix.md`, plus only test/doc files necessary to correct a finding within branch scope.

**Interfaces:**
- Consumes the seed, protected account RPC, existing role guards, RLS tests, and published runbook.
- Produces evidence for every branch-16 acceptance criterion or an explicit, non-hidden external blocker.

- [ ] **Step 1: Run all configured static and application checks**

```powershell
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Record the command, commit, date, and result in the matrix.

- [ ] **Step 2: Run every pgTAP suite on a clean local database**

```powershell
npx supabase@latest db reset --local
Get-ChildItem supabase/tests/*.test.sql | ForEach-Object { npx supabase@latest test db --local $_.FullName }
```

Record each suite and correct only branch-scope failures using a new failing regression test first.

- [ ] **Step 3: Manually certify each role journey**

Using local seeded accounts and the running Next.js app, perform the six matrix journeys plus an unauthorized-route attempt for every role. At narrow and desktop widths, inspect tables/forms for labels, keyboard focus, visible error state, empty state, and overflow behavior. Capture route/result evidence in the matrix; do not claim a browser check that cannot be performed.

- [ ] **Step 4: Perform production-owned checks when access permits**

Follow the runbook to verify the linked Supabase project migrations/functions and the Vercel deployment. If project access or an external vendor credential is unavailable, record the exact owner action and leave the result `blocked-external`, not `passed`.

- [ ] **Step 5: Final review and commit**

```powershell
git diff --check
git status --short
git log --oneline main..HEAD
git add docs supabase src
git commit -m "test: certify quality release readiness"
```

Re-run the full checks after the final commit. A clean working tree and recorded evidence are required before PR handoff.
