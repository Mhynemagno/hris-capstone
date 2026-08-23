# Deployment Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver secure HR deployment assignment creation, correction, and history views, plus each employee's read-only deployment history.

**Architecture:** A new Supabase migration owns the deployment data, RLS, audit/history records, and HR-only RPC mutations. Browser code consumes the exposed read models and RPCs through Zod-validated query functions, TanStack Query hooks, and role-scoped route components. The update RPC uses optimistic concurrency with `expected_updated_at` so a stale editor cannot overwrite a later HR correction.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Zod 4, TanStack Query 5, Supabase Postgres/RLS/RPC, Vitest, Testing Library, pgTAP.

**Spec:** `docs/superpowers/specs/2026-08-24-deployment-tracking-design.md`

## Global Constraints

- Create and work only on `feat/12-deployment-tracking`, based on `main`.
- Deployment status values are exactly `planned`, `active`, `completed`, and `cancelled`.
- Concurrent/overlapping assignments for the same employee are valid; do not add an exclusion or unique date-range constraint.
- Destination is free text: at least one of location, unit, or project is required; no destination master-data tables are in scope.
- Only completed records require an end date; any supplied end date must be on or after its start date.
- Do not expose deployment deletion, notifications, attendance integration, management reports, or routes for roles other than HR Personnel and Employees.
- Use security-definer functions with `set search_path = ''`, revoke public/default execute rights, and grant the public wrappers only to `authenticated`.
- Direct browser writes to `deployments` and `deployment_history` are forbidden; mutations must use RPCs.
- Preserve the established formatting and test commands: `npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build`.

---

## File Structure

- Create `supabase/migrations/<timestamp>_deployment_tracking.sql` — deployment tables, constraints, indexes, RLS policies, private/public RPC functions, audit/history writes, grants.
- Create `supabase/tests/deployment_tracking.test.sql` — pgTAP schema, authorized, denied, history, lifecycle, concurrent-assignment, and stale-update checks.
- Modify `src/lib/types/database.ts` — deployment row, history row, status, and employee-summary TypeScript types.
- Create `src/schemas/deployment-tracking.ts` and `src/schemas/deployment-tracking.test.ts` — browser payload/filter/route-ID validation and contract tests.
- Modify `src/schemas/index.ts`, `src/lib/query-keys.ts`, and `src/lib/query-keys.test.ts` — public schema exports and stable deployment query keys.
- Create `src/queries/deployment-tracking.ts` and `src/queries/deployment-tracking.test.ts` — Supabase reads/RPC calls and query-layer contract tests.
- Create `src/hooks/use-deployment-tracking.ts` and `src/hooks/use-deployment-tracking.test.tsx` — TanStack Query read/mutation interfaces and invalidation tests.
- Create `src/components/deployment-tracking/deployment-status-badge.tsx`, `deployment-form.tsx`, `hr-deployment-directory.tsx`, `hr-deployment-editor.tsx`, `employee-deployment-list.tsx`, and `deployment-tracking.test.tsx` — accessible status presentation and HR/employee workspaces.
- Create `src/app/(app)/hr/deployments/page.tsx`, `new/page.tsx`, `[deploymentId]/page.tsx`, and `src/app/(app)/employee/deployments/page.tsx` — role-inheriting route pages.
- Modify `src/lib/app/role-config.ts` and `src/lib/app/role-config.test.ts` — role-scoped navigation entries.

## Task 1: Add the protected database model and SQL tests

**Files:**
- Create: `supabase/migrations/<timestamp>_deployment_tracking.sql`
- Create: `supabase/tests/deployment_tracking.test.sql`

**Interfaces:**
- Consumes: `public.employees`, `public.profiles`, `public.audit_logs`, `public.user_roles`, `private.require_active_hr()`, and `private.current_user_has_role(public.app_role)` from earlier migrations.
- Produces: `public.deployments`, `public.deployment_history`, `public.create_deployment(uuid,text,text,text,text,date,date,text,text) returns uuid`, and `public.update_deployment(uuid,timestamptz,text,text,text,text,date,date,text,text) returns void`.

- [ ] **Step 1: Write the failing pgTAP contract and journey test**

  Create fixtures for one HR profile and two employee profiles/employee records. Assert the tables, both public RPC signatures, and RLS exist. Under `authenticated`, prove HR can create two overlapping records for one employee, an employee can read only their own record/history, the other employee sees zero rows, and an employee cannot invoke either mutation. Assert a completed assignment without an end date throws `22007`; a completed update produces a history entry and audit row; reusing an old `updated_at` throws `P0001` and does not change the row.

  ```sql
  select extensions.has_function(
    'public', 'update_deployment',
    array['uuid', 'timestamp with time zone', 'text', 'text', 'text', 'text', 'date', 'date', 'text', 'text'],
    'HR deployment update RPC exists'
  );

  set local role authenticated;
  set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
  select extensions.lives_ok(
    $$select public.create_deployment(
      '00000000-0000-4000-8000-000000000201', 'Central station', null, null,
      'Patrol officer', '2026-09-01', null, 'active', 'Primary assignment'
    )$$,
    'HR creates an active deployment'
  );
  ```

- [ ] **Step 2: Run the SQL test to verify it fails**

  Run: `supabase test db --file supabase/tests/deployment_tracking.test.sql`

  Expected: FAIL because the deployment tables and RPC functions do not exist.

- [ ] **Step 3: Implement the migration with constrained rows, indexes, RLS, and atomic RPCs**

  Use a timestamped migration filename later than `20260823162829_leave_management.sql`. Add the following core shape; use `nullif(btrim(...), '')` in both RPCs so browser whitespace cannot bypass the constraints.

  ```sql
  create table public.deployments (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public.employees(id) on delete restrict,
    location text check (location is null or (location = btrim(location) and char_length(location) between 1 and 200)),
    unit text check (unit is null or (unit = btrim(unit) and char_length(unit) between 1 and 200)),
    project text check (project is null or (project = btrim(project) and char_length(project) between 1 and 200)),
    assignment_role text not null check (assignment_role = btrim(assignment_role) and char_length(assignment_role) between 1 and 200),
    starts_on date not null,
    ends_on date,
    status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'cancelled')),
    notes text check (notes is null or (notes = btrim(notes) and char_length(notes) <= 2000)),
    created_by_user_id uuid not null references public.profiles(id),
    updated_by_user_id uuid not null references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (location is not null or unit is not null or project is not null),
    check (ends_on is null or ends_on >= starts_on),
    check (status <> 'completed' or ends_on is not null)
  );
  create index deployments_active_employee_idx on public.deployments (employee_id, starts_on desc) where status = 'active';
  create index deployments_date_range_idx on public.deployments (starts_on, ends_on);
  ```

  Add `deployment_history(id bigint generated always as identity primary key, deployment_id uuid not null references public.deployments(id) on delete restrict, actor_user_id uuid references public.profiles(id), event_type text not null check (event_type in ('created','updated','status_changed')), metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'), created_at timestamptz not null default now())` and an index on `(deployment_id, created_at asc)`.

  Enable RLS, revoke every table privilege from `anon`/`authenticated`, grant only `select` to `authenticated`, and add policies: HR may select all; an employee may select a row/history only through `employees.profile_id = auth.uid()`. Do not add insert/update/delete policies.

  Implement private functions with a fully qualified schema after `set search_path = ''`. `private.create_deployment(...)` calls `private.require_active_hr()`, verifies the employee exists, validates status/date/destination, inserts the row, inserts `deployment_history` with `{ "after": to_jsonb(new_row) }`, and inserts an `audit_logs` event. `private.update_deployment(...)` locks the row `for update`, compares `expected_updated_at`, applies the same validation, records `{ "before": ..., "after": ..., "changedFields": [...] }`, chooses `status_changed` when status differs, and writes the audit log. Public wrappers only call their private counterpart. Revoke execution on every private function and the public wrappers from `public`/`anon`; grant the two public wrappers to `authenticated`.

- [ ] **Step 4: Run the SQL test to verify it passes**

  Run: `supabase test db --file supabase/tests/deployment_tracking.test.sql`

  Expected: PASS; the plan count equals the number of assertions and the denied queries/RPCs are rejected.

- [ ] **Step 5: Commit the database vertical slice**

  ```bash
  git add supabase/migrations/*_deployment_tracking.sql supabase/tests/deployment_tracking.test.sql
  git commit -m "feat: add secure deployment tracking data model"
  ```

## Task 2: Define typed browser contracts and query keys

**Files:**
- Modify: `src/lib/types/database.ts`
- Create: `src/schemas/deployment-tracking.ts`
- Create: `src/schemas/deployment-tracking.test.ts`
- Modify: `src/schemas/index.ts`
- Modify: `src/lib/query-keys.ts`
- Modify: `src/lib/query-keys.test.ts`

**Interfaces:**
- Consumes: the database/RPC contracts from Task 1 and `isoDateSchema`, `paginationSchema`, and `uuidSchema` from `src/schemas/common.ts`.
- Produces: `Deployment`, `DeploymentHistory`, `DeploymentStatus`, `deploymentInputSchema`, `deploymentUpdateSchema`, `deploymentFiltersSchema`, and `queryKeys.deploymentTracking`.

- [ ] **Step 1: Write failing schema/key tests**

  Assert a `planned` assignment with only `unit` is accepted; all-empty destinations, a reversed range, and a completed record with no end date are rejected. Assert optional text becomes `null`, pagination caps at 100, and the HR directory/detail/employee-list query keys are stable and distinct.

  ```ts
  expect(deploymentInputSchema.safeParse({
    employeeId: employeeId, location: " ", unit: " Operations ", project: " ",
    assignmentRole: " Analyst ", startsOn: "2026-09-01", endsOn: undefined,
    status: "planned", notes: " ",
  }).data).toMatchObject({ unit: "Operations", location: null, notes: null });
  expect(deploymentInputSchema.safeParse({
    employeeId, location: "", unit: "", project: "", assignmentRole: "Analyst",
    startsOn: "2026-09-01", status: "planned",
  }).success).toBe(false);
  ```

- [ ] **Step 2: Run the focused tests to verify they fail**

  Run: `npm run test:run -- src/schemas/deployment-tracking.test.ts src/lib/query-keys.test.ts`

  Expected: FAIL because the new module and keys do not exist.

- [ ] **Step 3: Add the contracts and types**

  Add these types to `database.ts` and keep SQL field names in the row types:

  ```ts
  export type DeploymentStatus = "planned" | "active" | "completed" | "cancelled";
  export type Deployment = {
    id: string; employee_id: string; location: string | null; unit: string | null;
    project: string | null; assignment_role: string; starts_on: string; ends_on: string | null;
    status: DeploymentStatus; notes: string | null; created_by_user_id: string;
    updated_by_user_id: string; created_at: string; updated_at: string;
  };
  export type DeploymentHistory = {
    id: number; deployment_id: string; actor_user_id: string | null;
    event_type: "created" | "updated" | "status_changed"; metadata: Record<string, unknown>;
    created_at: string;
  };
  ```

  Make `deploymentInputSchema` trim `{location, unit, project, assignmentRole, notes}`, turn blank optional fields into `null`, require one destination and an assignment role of 1–200 characters, validate ISO dates, and `superRefine` the range/completed rule. Extend it in `deploymentUpdateSchema` with `id: uuidSchema` and `expectedUpdatedAt: z.string().datetime({ offset: true })`. Define `deploymentFiltersSchema` as paginated filters with optional status, employee ID, startsOn, and endsOn; reject a reversed filter range. Add keys `hrDirectory(filters)`, `detail(id)`, and `mine(filters)` under `deploymentTracking`.

- [ ] **Step 4: Run the focused tests to verify they pass**

  Run: `npm run test:run -- src/schemas/deployment-tracking.test.ts src/lib/query-keys.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit contracts and keys**

  ```bash
  git add src/lib/types/database.ts src/schemas/deployment-tracking.ts src/schemas/deployment-tracking.test.ts src/schemas/index.ts src/lib/query-keys.ts src/lib/query-keys.test.ts
  git commit -m "feat: add deployment tracking client contracts"
  ```

## Task 3: Implement deployment reads, mutations, and cache invalidation

**Files:**
- Create: `src/queries/deployment-tracking.ts`
- Create: `src/queries/deployment-tracking.test.ts`
- Create: `src/hooks/use-deployment-tracking.ts`
- Create: `src/hooks/use-deployment-tracking.test.tsx`

**Interfaces:**
- Consumes: Task 1 RPCs, Task 2 schemas/types/query keys, and `createBrowserSupabaseClient()`.
- Produces: `listHrDeployments`, `listMyDeployments`, `getDeployment`, `createDeployment`, `updateDeployment`, `useHrDeployments`, `useMyDeployments`, `useDeployment`, `useCreateDeployment`, and `useUpdateDeployment`.

- [ ] **Step 1: Write failing query and hook tests**

  Mock the browser Supabase client. Assert the HR list normalizes filters, selects the employee summary relation, applies status and inclusive date-overlap filters, orders current assignments before older ones, and returns `PaginatedResult<Deployment, DeploymentFilters>`. Assert create/update call the named RPC with snake_case arguments. Render a hook with `QueryClientProvider` and assert a successful mutation invalidates `['deployment-tracking']` and `['administration','audit-logs']`, but not notifications.

  ```ts
  expect(rpc).toHaveBeenCalledWith("update_deployment", {
    target_deployment_id: deploymentId,
    expected_updated_at: expectedUpdatedAt,
    target_location: null, target_unit: "Operations", target_project: null,
    target_assignment_role: "Analyst", target_starts_on: "2026-09-01",
    target_ends_on: null, target_status: "active", target_notes: null,
  });
  ```

- [ ] **Step 2: Run the focused tests to verify they fail**

  Run: `npm run test:run -- src/queries/deployment-tracking.test.ts src/hooks/use-deployment-tracking.test.tsx`

  Expected: FAIL because the queries and hooks do not exist.

- [ ] **Step 3: Implement safe query and hook APIs**

  Parse all public inputs before requests. Have `listHrDeployments` select `*, employee:employees(id, employee_number, first_name, last_name)`, paginate, and filter date overlap as `starts_on <= filters.endsOn` and `(ends_on is null or ends_on >= filters.startsOn)` when both range bounds are supplied. Have `listMyDeployments` use the RLS-protected `deployments` table, order by `starts_on` descending, and never accept an employee ID. Have `getDeployment` validate the UUID then select `*, deployment_history(*)` ordered ascending by history creation.

  Map camelCase schema values to the exact RPC keys shown in Step 1. Retain the repository's `throwIfError` helper pattern and return a clear `Error` for Supabase failures. Hooks must use Task 2 keys, disable an empty detail ID, and invalidate the deployment prefix plus administration audit logs after either mutation.

- [ ] **Step 4: Run focused tests to verify they pass**

  Run: `npm run test:run -- src/queries/deployment-tracking.test.ts src/hooks/use-deployment-tracking.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit query and hook behavior**

  ```bash
  git add src/queries/deployment-tracking.ts src/queries/deployment-tracking.test.ts src/hooks/use-deployment-tracking.ts src/hooks/use-deployment-tracking.test.tsx
  git commit -m "feat: add deployment tracking data access"
  ```

## Task 4: Build the HR and employee deployment workspaces

**Files:**
- Create: `src/components/deployment-tracking/deployment-status-badge.tsx`
- Create: `src/components/deployment-tracking/deployment-form.tsx`
- Create: `src/components/deployment-tracking/hr-deployment-directory.tsx`
- Create: `src/components/deployment-tracking/hr-deployment-editor.tsx`
- Create: `src/components/deployment-tracking/employee-deployment-list.tsx`
- Create: `src/components/deployment-tracking/deployment-tracking.test.tsx`

**Interfaces:**
- Consumes: Task 2 schemas/types and Task 3 hooks; existing `Button`, `ErrorState`, `FormField`, `Input`, `LoadingState`, and `EmptyTableState` components.
- Produces: `DeploymentForm`, `HrDeploymentDirectory`, `HrDeploymentEditor`, and `EmployeeDeploymentList` for Task 5 routes.

- [ ] **Step 1: Write failing component tests**

  Test status text is accessible for all four states. Test the form rejects no destination and a completed deployment without end date before calling `onSaved`. Test the HR directory renders an empty state, status/date filters, a New deployment link, employee name/destination/status, and a Detail link. Test the employee list renders only the supplied assignments as read-only cards, including notes when present. Test the detail editor renders history metadata chronologically and displays a stale-update error returned by the mutation.

  ```tsx
  render(<DeploymentForm onSaved={onSaved} />);
  await user.type(screen.getByLabelText("Assignment role"), "Patrol officer");
  await user.selectOptions(screen.getByLabelText("Status"), "completed");
  await user.click(screen.getByRole("button", { name: "Save deployment" }));
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByText(/end date is required/i)).toBeVisible();
  ```

- [ ] **Step 2: Run the component test to verify it fails**

  Run: `npm run test:run -- src/components/deployment-tracking/deployment-tracking.test.tsx`

  Expected: FAIL because the deployment components do not exist.

- [ ] **Step 3: Implement focused, accessible components**

  `DeploymentStatusBadge` maps each exact status to visible text and existing badge variants. `DeploymentForm` uses the shared schema, fields for employee ID (create only), location, unit, project, assignment role, start/end dates, status, and notes; sets local error text from `safeParse` or `onSaved`; and submits a typed `DeploymentInput`. Do not render a delete action.

  `HrDeploymentDirectory` calls `useHrDeployments({ page: 1, pageSize: 25 })`, renders loading/error/empty states, and uses a table with filters. `HrDeploymentEditor` loads the detail, passes `expectedUpdatedAt: deployment.updated_at` to the save hook, navigates to the detail after create, and renders the chronological history with event type, timestamp, actor ID, and changed-field summary. `EmployeeDeploymentList` calls `useMyDeployments`, renders the same state patterns, and contains no form controls or HR-only data.

- [ ] **Step 4: Run the component test to verify it passes**

  Run: `npm run test:run -- src/components/deployment-tracking/deployment-tracking.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit the UI vertical slice**

  ```bash
  git add src/components/deployment-tracking
  git commit -m "feat: add deployment tracking workspaces"
  ```

## Task 5: Wire role-scoped routes and navigation

**Files:**
- Create: `src/app/(app)/hr/deployments/page.tsx`
- Create: `src/app/(app)/hr/deployments/new/page.tsx`
- Create: `src/app/(app)/hr/deployments/[deploymentId]/page.tsx`
- Create: `src/app/(app)/employee/deployments/page.tsx`
- Modify: `src/lib/app/role-config.ts`
- Modify: `src/lib/app/role-config.test.ts`
- Modify: `src/app/(app)/role-layouts.test.tsx`

**Interfaces:**
- Consumes: Task 4 components and the existing HR/employee layouts, which call `requireRole`.
- Produces: all four roadmap routes and Deployments navigation for only HR Personnel and Employees.

- [ ] **Step 1: Write failing navigation and route tests**

  Extend the role configuration test so HR has `{ href: "/hr/deployments", label: "Deployments" }` and Employees have `{ href: "/employee/deployments", label: "Deployments" }`; assert Applicant, Management, and System Administrator navigation lacks them. Add route-layout assertions that the HR deployment pages are guarded by the existing HR layout and employee page by the existing employee layout.

- [ ] **Step 2: Run the focused route tests to verify they fail**

  Run: `npm run test:run -- src/lib/app/role-config.test.ts src/app/(app)/role-layouts.test.tsx`

  Expected: FAIL because navigation entries and route modules do not exist.

- [ ] **Step 3: Add pages with clear page context and inherited guards**

  Implement each page as a small server component. HR directory: heading `Deployments`, description, and `HrDeploymentDirectory`. New: heading `New deployment` and `HrDeploymentEditor`. Detail: parse `params.deploymentId` as the string prop expected by `HrDeploymentEditor`, with heading `Deployment details`. Employee: heading `My deployments` and `EmployeeDeploymentList`. Do not duplicate role checks—the enclosing `hr/layout.tsx` and `employee/layout.tsx` already enforce them.

  Add the two `BriefcaseBusiness` navigation entries in `ROLE_CONFIG`; preserve navigation isolation for every other role.

- [ ] **Step 4: Run focused route tests to verify they pass**

  Run: `npm run test:run -- src/lib/app/role-config.test.ts src/app/(app)/role-layouts.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit routes and navigation**

  ```bash
  git add src/app/(app)/hr/deployments src/app/(app)/employee/deployments src/lib/app/role-config.ts src/lib/app/role-config.test.ts src/app/(app)/role-layouts.test.tsx
  git commit -m "feat: add deployment tracking routes"
  ```

## Task 6: Run integration verification and document the handoff

**Files:**
- Modify: `docs/IMPLEMENTATION_ORDER.md` only if the repository convention records task completion in this file; otherwise do not alter it.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: verified branch state ready for code review and PR creation.

- [ ] **Step 1: Apply the migration to a clean local database and run its pgTAP test**

  Run: `supabase db reset && supabase test db --file supabase/tests/deployment_tracking.test.sql`

  Expected: migration applies cleanly and all deployment RLS/RPC assertions pass.

- [ ] **Step 2: Run the complete automated suite**

  Run: `npm run lint && npm run typecheck && npm run test:run && npm run build`

  Expected: every command exits 0.

- [ ] **Step 3: Perform role-journey browser verification**

  Verify as HR: create an active assignment, create an overlapping planned assignment, edit an assignment to completed with an end date, and confirm chronological history/audit behavior. Verify as the assigned employee: `/employee/deployments` displays only their two assignments. Verify as another employee: no assignments are visible. Verify non-HR roles cannot open HR deployment routes.

- [ ] **Step 4: Inspect final diff and branch state**

  Run: `git diff main...HEAD --check && git status --short && git log --oneline main..HEAD`

  Expected: no whitespace errors, a clean worktree, and focused commits for database, contracts/data access, UI, and routing.

- [ ] **Step 5: Commit only a confirmed roadmap-status update, if applicable**

  ```bash
  git add docs/IMPLEMENTATION_ORDER.md
  git commit -m "docs: mark deployment tracking complete"
  ```

  Skip this commit when the order document has no completion-marker convention or the feature is not yet fully verified.

## Plan Self-Review

- Spec coverage: Task 1 implements the constrained data model, indexes, RLS, history, audit entries, and no-delete mutation surface. Tasks 2–3 implement validated client contracts/RPC access and cache rules. Task 4 covers the HR and employee experiences. Task 5 creates exactly the four required pages and role-scoped navigation. Task 6 covers migration/RLS, application, and role-journey verification.
- Placeholder scan: no `TODO`, `TBD`, deferred implementation instruction, or unnamed interface remains. The one conditional documentation commit is explicitly gated by the existing repository convention and verification status.
- Type consistency: `DeploymentStatus`, the create/update RPC signatures, `expectedUpdatedAt`/`expected_updated_at`, and the hook/component names are defined before later tasks consume them.
