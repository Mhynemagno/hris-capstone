# Personnel Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an HR-managed official employee-record workspace with employee read-only access, auditable personnel data, and a consistent accessible authentication experience.

**Architecture:** Supabase PostgreSQL and RLS remain the authorization boundary: HR has narrowly scoped personnel mutations while an employee can select only their linked record. Next.js protected pages compose focused React components; client-side Supabase queries and TanStack Query hooks own reads, mutations, pagination, and invalidation. A shared auth shell changes presentation only, preserving the existing authentication flows.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/Base UI, Lucide, Supabase Auth/PostgreSQL/RLS, Zod 4, TanStack Query 5, Vitest, pgTAP.

## Global Constraints

- Work only on `feat/05-personnel-records`, based on the merged feature 04 `main`.
- Use the existing publishable browser Supabase key only; never expose `service_role` or a secret key.
- Every public table needs explicit authenticated grants, RLS, least-privilege policies, foreign-key indexes, and pgTAP permitted/denied coverage.
- Authorize with the existing `private.current_user_has_role('hr_personnel')` helper and `(select auth.uid())`, never JWT user metadata.
- Validate every form and directory URL input with shared Zod schemas; use TanStack Query only for browser data access and invalidate only after successful mutations.
- Employees view their own official records but cannot change official fields. Retire employee records using status; do not hard-delete them.
- Keep authentication behavior, redirects, and Supabase calls intact while applying the light, responsive, accessible design system.
- Do not add documents, profile-change approvals, accounts/invitations, recruitment, notifications, leave, deployments, promotion, attendance, dashboards, or external dependencies.

---

## File Map

| Path | Responsibility |
| --- | --- |
| Generated `supabase/migrations/*_personnel_records.sql` | Personnel tables, constraints, indexes, audit triggers, grants, and RLS policies. |
| `supabase/tests/personnel_records.test.sql` | pgTAP structure, allowed-role, denied-role, own-record, history, and range-validation coverage. |
| `src/lib/types/database.ts` | Personnel record types shared by forms, queries, and components. |
| `src/schemas/personnel-records.ts` | Zod schemas and inferred input types for every personnel form and directory filter. |
| `src/queries/personnel-records.ts` | RLS-protected Supabase data operations with typed return values. |
| `src/hooks/use-personnel-records.ts` | TanStack Query read/mutation hooks and exact invalidations. |
| `src/components/personnel-records/*` | Directory, filter bar, employee profile form, record tabs, and scoped child-record forms. |
| `src/app/(app)/hr/employees/*` | HR-protected employee directory, creation, detail, service-history, and qualifications routes. |
| `src/app/(app)/employee/page.tsx` | Employee landing page link to their read-only personnel record. |
| `src/lib/app/role-config.ts` | HR Personnel records navigation item and its Lucide icon type. |
| `src/components/auth/auth-card.tsx`, `src/components/auth/*-form.tsx`, `src/app/(auth)/*` | Shared auth layout, form control usage, and consistent success/error/link presentation. |

### Task 1: Establish the secure personnel database boundary

**Files:**
- Create: the migration emitted by `npx supabase migration new personnel_records`
- Create: `supabase/tests/personnel_records.test.sql`
- Modify: `src/lib/types/database.ts`

**Interfaces:**
- Produces `public.employees`, `public.service_history`, `public.qualifications`, `public.certifications`, `public.training_records`, and immutable `public.employee_record_history`.
- Produces the TypeScript types `Employee`, `ServiceHistory`, `Qualification`, `Certification`, `TrainingRecord`, and `EmployeeRecordHistory`.
- Produces `private.write_employee_record_history() returns trigger`, callable only as a schema-qualified trigger function.

- [ ] **Step 1: Create the migration and write the failing pgTAP test file**

  Run `npx supabase migration new personnel_records` and use the emitted file. In `supabase/tests/personnel_records.test.sql`, use the five existing fixture accounts from `administration_master_data.test.sql`, create one HR-linked employee and a second employee, then assert RLS/constraints before any implementation exists.

  ```sql
  select extensions.has_table('public', 'employees', 'Employee records table exists');
  select extensions.throws_ok(
    $$insert into public.service_history (employee_id, started_on, ended_on)
      values ('00000000-0000-0000-0000-000000000010', '2026-02-01', '2026-01-01')$$,
    '23514',
    null,
    'Service history rejects an inverted date range'
  );
  ```

- [ ] **Step 2: Run the database test and confirm the missing-object failure**

  First inspect `npx supabase test db --help`, then run the command that executes `supabase/tests/personnel_records.test.sql`. Expected result: FAIL because the six personnel tables and history trigger do not exist.

- [ ] **Step 3: Implement tables, constraints, audit history, indexes, grants, and policies**

  Create `employees` with normalized unique `employee_number`, optional unique `profile_id references public.profiles(id)`, legal/contact/emergency fields, department/position references, `employment_status`, `employment_started_on`, and optional `employment_ended_on` with a valid range check. Create each child table with UUID primary key, `employee_id references public.employees(id) on delete cascade`, timestamps, and its relevant date/range checks. Create `employee_record_history` with its employee foreign key protected from deletion, actor ID, record kind/action, old/new JSON snapshots, and timestamp.

  Index directory predicates and child lookups, including:

  ```sql
  create index employees_hr_directory_idx
    on public.employees (employment_status, department_id, position_id, employee_number);
  create index service_history_employee_started_idx
    on public.service_history (employee_id, started_on desc);
  ```

  Add one private `after insert or update or delete` trigger function using `tg_table_name`, `to_jsonb(old/new)`, and `(select auth.uid())`; attach it to each official/child table. Enable RLS and grant only the operations each role uses. HR receives select/insert/update/delete on child records and select/insert/update on employees/history. Employee select policies must join their row to `employees.profile_id = (select auth.uid())`; give them no insert/update/delete policy. Use HR `using` **and** `with check` policies, never a policy targeted only at `authenticated`.

- [ ] **Step 4: Complete the pgTAP coverage and run it to green**

  Add permitted HR CRUD cases, employee self-read cases, cross-employee and other-role denial cases, direct history insert/update/delete denial, trigger snapshot assertion, duplicate employee-number denial, and every date-range check. Run the same Task 1 command. Expected result: PASS for all pgTAP assertions.

- [ ] **Step 5: Inspect migration security and commit the database boundary**

  Run `npx supabase db advisors` when supported by the installed CLI; otherwise inspect the migration for RLS, grants, schema-qualified trigger functions, no broad history write policy, indexes, and `USING`/`WITH CHECK`. Then commit:

  ```powershell
  git add supabase/migrations supabase/tests src/lib/types/database.ts
  git commit -m "feat: add secure personnel records schema"
  ```

### Task 2: Define personnel contracts, query keys, and testable query functions

**Files:**
- Create: `src/schemas/personnel-records.ts`
- Create: `src/schemas/personnel-records.test.ts`
- Create: `src/queries/personnel-records.ts`
- Create: `src/queries/personnel-records.test.ts`
- Modify: `src/schemas/index.ts`
- Modify: `src/lib/query-keys.ts`

**Interfaces:**
- Produces `employeeSchema`, `serviceHistorySchema`, `qualificationSchema`, `certificationSchema`, `trainingRecordSchema`, and `employeeDirectoryFiltersSchema` plus inferred input types.
- Produces `queryKeys.personnelRecords.directory(filters)`, `.detail(employeeId)`, `.serviceHistory(employeeId)`, `.qualifications(employeeId)`, `.certifications(employeeId)`, and `.training(employeeId)`.
- Produces `listEmployees(filters)`, `getEmployee(employeeId)`, and one create/update/delete query function per child record.

- [ ] **Step 1: Write failing contract tests**

  Cover trimmed employee number/name values, valid UUIDs, max-length contact data, invalid employment/service/certification/training date ranges, non-negative training hours, and directory page-size/filter bounds. Mock Supabase and assert the directory query adds its select, range, text search, department, position, status, and deterministic order constraints.

  ```ts
  expect(
    certificationSchema.safeParse({
      employeeId: "00000000-0000-0000-0000-000000000010",
      name: "First aid",
      issuer: "Red Cross",
      issuedOn: "2026-02-01",
      expiresOn: "2026-01-01",
    }).success,
  ).toBe(false);
  ```

- [ ] **Step 2: Run focused contracts tests and confirm failure**

  Run `npm run test:run -- src/schemas/personnel-records.test.ts src/queries/personnel-records.test.ts`. Expected result: FAIL because personnel schemas, keys, and query functions are absent.

- [ ] **Step 3: Implement schemas and RLS-protected queries**

  Use Zod `.trim()`, `.min()`, `.max()`, `z.iso.date()`, coercion for URL page inputs, and `.refine()` for ranges. Parse directory input before querying. Select only UI-rendered fields and return a typed `{ rows, count }`; include `count: "exact"`, `order("last_name")`, `order("first_name")`, and stable employee-number ordering. Every mutation validates its input before calling the browser client and returns Supabase errors instead of swallowing them.

- [ ] **Step 4: Re-run the focused tests and commit the contracts**

  Run the Task 2 command. Expected result: PASS.

  ```powershell
  git add src/schemas src/queries src/lib/query-keys.ts
  git commit -m "feat: add personnel record contracts"
  ```

### Task 3: Build personnel hooks and reusable form/table components

**Files:**
- Create: `src/hooks/use-personnel-records.ts`
- Create: `src/hooks/use-personnel-records.test.tsx`
- Create: `src/components/personnel-records/employee-directory-filters.tsx`
- Create: `src/components/personnel-records/employee-directory-table.tsx`
- Create: `src/components/personnel-records/employee-form.tsx`
- Create: `src/components/personnel-records/record-entry-form.tsx`
- Create: `src/components/personnel-records/personnel-record-tabs.tsx`
- Create: `src/components/personnel-records/personnel-records.test.tsx`

**Interfaces:**
- Produces `useEmployeeDirectory(filters)`, `useEmployee(employeeId)`, `useSaveEmployee()`, `useSavePersonnelEntry(kind)`, and `useDeletePersonnelEntry(kind)`.
- `useSavePersonnelEntry(kind)` invalidates the matching collection, employee detail, and directory keys only after success.
- `RecordEntryForm` accepts `{ kind, employeeId, initialValue?, onComplete }` for `serviceHistory`, `qualification`, `certification`, and `training`.

- [ ] **Step 1: Write failing hook and accessibility interaction tests**

  Assert the directory hook uses the parsed filter key; a successful employee save invalidates directory/detail keys; a rejected mutation preserves the visible error. Render filter controls, employee fields, tabs, and each record type; assert labels, a 44px primary action, disabled pending submit, row action names, and employee-number/record validation feedback.

  ```tsx
  await user.click(screen.getByRole("button", { name: /save employee/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/employee number/i);
  ```

- [ ] **Step 2: Run the focused component tests and confirm failure**

  Run `npm run test:run -- src/hooks/use-personnel-records.test.tsx src/components/personnel-records/personnel-records.test.tsx`. Expected result: FAIL because hooks and personnel components are missing.

- [ ] **Step 3: Implement focused components with shared primitives**

  Use the existing `Input`, `Button`, `FormField`, `EmptyTableState`, `LoadingState`, and `ErrorState` components. Make filters URL-friendly (text, department, position, status); use a labelled table on wide screens and readable stacked metadata on narrow screens. `EmployeeForm` owns official profile/contact/emergency/employment fields. `PersonnelRecordTabs` gives service, qualifications, certifications, and training real tab labels; child forms render only fields owned by their `kind`.

- [ ] **Step 4: Re-run the focused tests and commit reusable UI**

  Run the Task 3 command. Expected result: PASS.

  ```powershell
  git add src/hooks/use-personnel-records.ts src/hooks/use-personnel-records.test.tsx src/components/personnel-records
  git commit -m "feat: add personnel record UI components"
  ```

### Task 4: Deliver HR employee directory, creation, detail, and deep-link pages

**Files:**
- Create: `src/app/(app)/hr/employees/page.tsx`
- Create: `src/app/(app)/hr/employees/page.test.tsx`
- Create: `src/app/(app)/hr/employees/new/page.tsx`
- Create: `src/app/(app)/hr/employees/new/page.test.tsx`
- Create: `src/app/(app)/hr/employees/[employeeId]/page.tsx`
- Create: `src/app/(app)/hr/employees/[employeeId]/page.test.tsx`
- Create: `src/app/(app)/hr/employees/[employeeId]/service-history/page.tsx`
- Create: `src/app/(app)/hr/employees/[employeeId]/qualifications/page.tsx`
- Modify: `src/lib/app/role-config.ts`
- Modify: `src/components/app-shell/app-shell.tsx`

**Interfaces:**
- Produces the required HR routes and the navigation item `{ href: "/hr/employees", label: "Personnel records", icon: "ContactRound" }`.
- Detail page accepts `{ params: Promise<{ employeeId: string }> }`, validates the UUID before querying, and displays the same `PersonnelRecordTabs` content as direct child-page links.

- [ ] **Step 1: Write failing route and page tests**

  Mock the personnel hooks and assert HR directory renders its create action/table/empty state, `/new` renders the official employee form, detail includes all four tabs, and service-history/qualification routes preserve the employee context. Add a role-layout assertion that `/hr/employees` calls `requireRole("hr_personnel")`; invalid ID input must not call a data query.

- [ ] **Step 2: Run page tests and confirm failure**

  Run `npm run test:run -- 'src/app/(app)/hr/employees/**/*.test.tsx' src/app/'(app)'/role-layouts.test.tsx src/components/app-shell/app-shell.test.tsx`. Expected result: FAIL because personnel pages and navigation icon support do not exist.

- [ ] **Step 3: Implement protected routes and navigation**

  Retain server-side HR authorization through the existing HR layout. Use server page wrappers with client interactive components, `notFound()` for malformed/missing records, and `Link` deep links. Extend the role-navigation icon union and `navigationIcons` map with `ContactRound`; no other role receives this menu item. After creating an employee, route to its detail page. Detail edits and child saves remain visible only to HR UI; no remove-employee button is rendered.

- [ ] **Step 4: Re-run page tests and commit HR pages**

  Run the Task 4 command. Expected result: PASS.

  ```powershell
  git add src/app/'(app)'/hr/employees src/lib/app/role-config.ts src/components/app-shell
  git commit -m "feat: add HR personnel record workspace"
  ```

### Task 5: Add the employee’s read-only personnel-record entry point

**Files:**
- Create: `src/components/personnel-records/employee-record-summary.tsx`
- Create: `src/components/personnel-records/employee-record-summary.test.tsx`
- Modify: `src/app/(app)/employee/page.tsx`
- Modify: `src/app/(app)/employee/page.test.tsx`

**Interfaces:**
- Produces `EmployeeRecordSummary`, which consumes `useEmployeeForCurrentUser()` and renders official details plus service/qualification/certification/training summaries without mutations.
- Produces `/employee` content with no official-field edit, add, delete, or HR directory controls.

- [ ] **Step 1: Write failing read-only tests**

  Mock a linked employee and assert the page exposes employee number, assignment, contact summary, and all four record collections. Assert that the rendered page contains no buttons whose name matches add, edit, save, or delete and that an unlinked employee receives a helpful empty state.

- [ ] **Step 2: Run the read-only tests and confirm failure**

  Run `npm run test:run -- src/components/personnel-records/employee-record-summary.test.tsx 'src/app/(app)/employee/page.test.tsx'`. Expected result: FAIL because the summary hook/component does not exist.

- [ ] **Step 3: Implement current-user query and read-only presentation**

  Add `getEmployeeForCurrentUser` and `useEmployeeForCurrentUser` using the authenticated employee RLS select policy; do not pass a user ID from the browser. Render semantic definition-list/card content and collections with no mutation hooks. Preserve the employee route’s existing `requireRole("employee")` server guard.

- [ ] **Step 4: Re-run read-only tests and commit**

  Run the Task 5 command. Expected result: PASS.

  ```powershell
  git add src/queries/personnel-records.ts src/hooks/use-personnel-records.ts src/components/personnel-records src/app/'(app)'/employee
  git commit -m "feat: add employee personnel record view"
  ```

### Task 6: Refresh every authentication page through one responsive auth shell

**Files:**
- Modify: `src/components/auth/auth-card.tsx`
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/components/auth/forgot-password-form.tsx`
- Modify: `src/components/auth/reset-password-form.tsx`
- Modify: `src/components/auth/applicant-registration-form.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/forgot-password/page.tsx`
- Modify: `src/app/(auth)/reset-password/page.tsx`
- Modify: `src/app/(auth)/applicant/register/page.tsx`
- Modify: `src/components/auth/auth-forms.test.tsx`
- Create: `src/components/auth/auth-card.test.tsx`

**Interfaces:**
- `AuthCard({ children, description, title })` renders a labelled HRIS identity panel, a main form surface, and preserves `children` as the only flow-specific content slot.
- Existing form submit contracts remain unchanged: `LoginForm({ nextPath? })`, `ForgotPasswordForm()`, `ResetPasswordForm()`, and `ApplicantRegistrationForm()`.

- [ ] **Step 1: Write failing visual-structure and behavior-regression tests**

  Assert `AuthCard` exposes a single page heading, “HRIS Capstone” identity text, a main landmark, and no dark-surface class contract. Extend the current form tests to assert all four forms use labelled shared inputs/buttons, show inline `role="alert"` validation, retain their existing successful Supabase calls, and preserve all login/recovery/register links.

  ```tsx
  render(<AuthCard title="Sign in" description="Secure access"><p>Form</p></AuthCard>);
  expect(screen.getByRole("main")).toHaveTextContent("HRIS Capstone");
  expect(screen.getByRole("heading", { name: "Sign in" })).toBeVisible();
  ```

- [ ] **Step 2: Run authentication tests and confirm the structure failure**

  Run `npm run test:run -- src/components/auth/auth-card.test.tsx src/components/auth/auth-forms.test.tsx`. Expected result: FAIL because the new identity/landmark structure and shared controls are missing.

- [ ] **Step 3: Implement the light, balanced, accessible presentation**

  Rebuild `AuthCard` with a light slate full-height background, a desktop two-column maximum-width surface, and a compact single-column mobile layout. Use existing Geist typography, semantic token classes, professional blue primary actions, visible focus rings, 44px minimum form controls, and concise security/assurance copy. Use the existing `Input` and `Button` primitives in every auth form; keep names, IDs, Zod schemas, client calls, navigation, and `aria-live` success messages unchanged. Style links consistently with the tokenized primary color and underline/focus treatment.

- [ ] **Step 4: Re-run auth tests and inspect responsive states**

  Run the Task 6 command. Expected result: PASS. Start the dev server and inspect `/login`, `/forgot-password`, `/reset-password`, and `/applicant/register` at 375px, 768px, 1024px, and 1440px; check no horizontal scroll, obvious labels, readable error/success text, and keyboard-visible focus.

- [ ] **Step 5: Commit the authentication refresh**

  ```powershell
  git add src/components/auth src/app/'(auth)'
  git commit -m "feat: refresh authentication experience"
  ```

### Task 7: Verify the full feature branch and prepare review evidence

**Files:**
- Modify: only a focused regression test or source file when this verification exposes a branch-created failure.
- Modify: `README.md` only if a required operator configuration step is absent.

**Interfaces:**
- Produces evidence that HR completes each official-record journey, employees can read only their own record, all other roles are denied, and authentication retains its behavior.

- [ ] **Step 1: Run quality commands**

  ```powershell
  npm run lint
  npm run typecheck
  npm run test:run
  npm run build
  ```

  Expected result: each command exits 0. For a branch-created failure, first add or adjust the narrow regression test, then make the minimal correction.

- [ ] **Step 2: Apply and test migrations on an isolated local database**

  Inspect `npx supabase db --help` and `npx supabase test --help`, apply the full migration chain to a clean local database, and run `auth_rbac_foundation.test.sql`, `administration_master_data.test.sql`, and `personnel_records.test.sql`. Expected result: every pgTAP assertion passes.

- [ ] **Step 3: Perform manual security and responsive journeys**

  As HR, create an employee, search/filter it, edit official data, then add/edit/delete service, qualification, certification, and training entries; verify history is created. As the linked employee, verify only their own values are visible and no mutation control exists. As Administrator, Applicant, and Management, verify direct `/hr/employees` access is denied and direct Data API mutations fail. At 375px through 1440px, inspect all HR and auth pages for readable content, no horizontal scroll, focus visibility, and labelled controls.

- [ ] **Step 4: Confirm branch cleanliness and capture PR handoff**

  Run `git status --short` and confirm no output. Capture screenshots for the HR directory/detail and refreshed login. The PR description must name roadmap branch 05, schema/RLS/history changes, intended/denied role journeys, all command results, screenshots, and any Supabase configuration required.
