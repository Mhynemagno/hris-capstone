# Administration Master Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the protected System Administrator master-data workspace and send authenticated users to their role workspace after sign-in.

**Architecture:** The database remains the authorization boundary. A private transactional PostgreSQL function is the sole path for role and activation changes, while RLS-protected Data API access handles reference data, settings, and audit-log reads. Next.js server routes resolve authenticated role-home redirects; interactive administration screens use shared Zod schemas, Supabase query functions, and TanStack Query mutations with targeted invalidation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/Base UI, Lucide, Supabase Auth/PostgreSQL/RLS/Edge Functions, Zod 4, TanStack Query 5, Vitest, pgTAP.

## Global Constraints

- Work only on `feat/04-administration-master-data`, based on the merged feature 03 `main`.
- Use semantic design tokens, a light accessible data-dense dashboard, Lucide icons, visible keyboard focus, and responsive layouts from 375px upward.
- The public browser client contains only the publishable Supabase key; secret/service-role keys stay in the existing Edge Function.
- Use shared Zod schemas at every browser, URL, server, Edge Function, and PostgreSQL workflow boundary.
- Keep direct Applicant-to-internal-role assignment available to administrators; prevent self-lockout and removal/deactivation of the last active system administrator.
- Every new public table has RLS, explicit grants, least-privilege policies, indexes for its actual filters, and pgTAP permitted/denied coverage.
- Do not hard-delete departments or positions from the UI. Do not add future employee, recruitment, notification, leave, or external-integration work.

---

## File Map

| Path | Responsibility |
| --- | --- |
| The migration filename emitted by `npx supabase migration new administration_master_data` | Schema additions, RLS, audit triggers, and the private role/status workflow. |
| `supabase/tests/administration_master_data.test.sql` | pgTAP database structure, RLS, workflow, lockout, and audit coverage. |
| `src/lib/types/database.ts` | Typed database records for departments, positions, settings, and audits. |
| `src/schemas/administration.ts` | Zod source of truth for filters and every administration payload. |
| `src/lib/auth/role-home.ts` | Maps an `AppRole` to the role's configured home path. |
| `src/app/auth/continue/route.ts` | Server-side destination resolver after browser sign-in. |
| `src/queries/administration.ts` | Small RLS-protected Supabase query functions and typed workflow calls. |
| `src/hooks/use-administration.ts` | TanStack Query hooks and exact mutation invalidations. |
| `src/components/administration/*` | Focused tables, filter bars, dialogs, and audit metadata presentation. |
| `src/app/(app)/admin/*` | Protected Server Component routes for the overview and six administration pages. |
| `src/lib/app/role-config.ts` | Typed, icon-bearing administrator navigation. |
| `src/components/auth/login-form.tsx`, `src/app/page.tsx` | Role-aware authenticated navigation. |

### Task 1: Secure the administration schema and prove its database boundary

**Files:**
- Create: the generated `supabase/migrations/*_administration_master_data.sql` migration file
- Create: `supabase/tests/administration_master_data.test.sql`
- Modify: `supabase/functions/invite-internal-user/index.ts`
- Modify: `src/lib/types/database.ts`

**Interfaces:**
- Produces `private.update_managed_user(target_user_id uuid, next_role public.app_role, next_is_active boolean) returns void` callable only by authenticated system administrators.
- Produces `public.organization_settings` with `id boolean primary key default true check (id)`, `organization_name text`, `support_email text`, `default_timezone text`, `updated_by uuid`, `updated_at timestamptz`.
- Produces `Department`, `Position`, `OrganizationSettings`, and `AuditLog` TypeScript record types.

- [ ] **Step 1: Create a migration through the project CLI and write failing pgTAP coverage**

  Run `npx supabase migration new administration_master_data`, use the generated filename, and create `supabase/tests/administration_master_data.test.sql`. Set up the same five fixture users and JWT claims as `auth_rbac_foundation.test.sql`. Assert that the new settings table has RLS, that a non-admin cannot read it or invoke the workflow, and that direct `update public.user_roles` and `update public.profiles set is_active` as an admin are denied.

  Include explicit workflow cases:

  ```sql
  select extensions.lives_ok(
    $$select private.update_managed_user(
      '00000000-0000-0000-0000-000000000003'::uuid,
      'employee'::public.app_role,
      true
    )$$,
    'Administrator can promote an applicant through the workflow'
  );

  select extensions.throws_ok(
    $$select private.update_managed_user(
      '00000000-0000-0000-0000-000000000001'::uuid,
      'employee'::public.app_role,
      true
    )$$,
    'P0001',
    'Administrators cannot remove their own administrator role',
    'Workflow prevents self-demotion'
  );
  ```

- [ ] **Step 2: Run the pgTAP file and verify it fails because the objects do not exist**

  Run the repository's established local database test command after first checking `npx supabase test db --help`; select the command that runs `supabase/tests/administration_master_data.test.sql`. Expected result: failure mentioning `organization_settings` and `private.update_managed_user` are missing.

- [ ] **Step 3: Implement the migration with narrow permissions and auditable state changes**

  Add `organization_settings`; seed no organization-specific production data. Add nullable `positions.code` and `positions.description`, and use a partial unique index for non-null codes. Do not add an email-search index in this branch because the account directory uses a small, case-insensitive contains search; add an index only when real account volume and query plans justify it. Enable RLS, revoke implicit access as necessary, grant `select`, `insert`, and `update` only to `authenticated`, and add administrator-only `using` and `with check` policies.

  Add an audit trigger for `profiles` that records activation changes without recording unrelated profile fields, and add the settings audit trigger. Replace the existing direct-admin `profiles` and `user_roles` update policies with no direct update policy. Keep department and position mutation policies administrator-only.

  Implement the workflow in `private` with an empty `search_path`, revoke `EXECUTE` from `public`, and grant it only to `authenticated`:

  ```sql
  create or replace function private.update_managed_user(
    target_user_id uuid,
    next_role public.app_role,
    next_is_active boolean
  ) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
  begin
    if not private.current_user_has_role('system_administrator'::public.app_role) then
      raise exception 'Administrator access is required.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.user_roles where user_id = target_user_id) then
      raise exception 'Managed account was not found.' using errcode = 'P0001';
    end if;
    if target_user_id = (select auth.uid())
       and (next_role <> 'system_administrator'::public.app_role or not next_is_active) then
      raise exception 'Administrators cannot remove their own administrator role or deactivate themselves.' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.user_roles where user_id = target_user_id and role = 'system_administrator'::public.app_role
    ) and (next_role <> 'system_administrator'::public.app_role or not next_is_active)
       and (select count(*) from public.user_roles ur join public.profiles p on p.id = ur.user_id where ur.role = 'system_administrator'::public.app_role and p.is_active) = 1 then
      raise exception 'At least one active system administrator is required.' using errcode = 'P0001';
    end if;
    update public.user_roles set role = next_role, assigned_by = (select auth.uid()), assigned_at = now() where user_id = target_user_id;
    update public.profiles set is_active = next_is_active where id = target_user_id;
  end;
  $$;
  ```

  Update the invitation Edge Function to invoke this workflow with the caller's JWT after invitation, retain its compensating user deletion on workflow failure, and ensure errors do not reveal account existence beyond the supplied email.

- [ ] **Step 4: Run database tests and inspect migration security**

  Run the selected pgTAP command and confirm all assertions pass. Run `npx supabase db advisors` if the installed CLI supports it; otherwise inspect the generated SQL for public function execution, RLS, grants, `USING`, `WITH CHECK`, and foreign-key indexes. Record any advisor finding and correct the migration before proceeding.

- [ ] **Step 5: Commit the database boundary**

  ```powershell
  git add supabase/migrations supabase/tests supabase/functions/invite-internal-user/index.ts src/lib/types/database.ts
  git commit -m "feat: secure administration master data"
  ```

### Task 2: Define administration validation, query keys, and query contracts

**Files:**
- Create: `src/schemas/administration.ts`
- Create: `src/schemas/administration.test.ts`
- Create: `src/queries/administration.ts`
- Create: `src/queries/administration.test.ts`
- Modify: `src/schemas/index.ts`
- Modify: `src/lib/query-keys.ts`

**Interfaces:**
- Produces `managedUserUpdateSchema`, `departmentSchema`, `positionSchema`, `organizationSettingsSchema`, `administrationFiltersSchema`, and inferred input types.
- Produces query keys `administration.users(filters)`, `.roles()`, `.departments(filters)`, `.positions(filters)`, `.settings()`, and `.auditLogs(filters)`.
- Produces query functions `listManagedUsers`, `listDepartments`, `listPositions`, `getOrganizationSettings`, and `listAuditLogs`.

- [ ] **Step 1: Write failing schema and query-contract tests**

  Cover malformed UUIDs, empty names, duplicate whitespace-only codes, invalid email, unsupported time zone, page-size bounds, and an Applicant-to-Employee workflow payload. Mock the browser Supabase client and assert each query selects only the fields it renders and sends filters as query constraints.

  ```ts
  expect(
    managedUserUpdateSchema.safeParse({
      userId: "00000000-0000-0000-0000-000000000003",
      role: "employee",
      isActive: true,
    }).success,
  ).toBe(true);
  expect(departmentSchema.safeParse({ name: "   " }).success).toBe(false);
  ```

- [ ] **Step 2: Run the focused tests and confirm they fail**

  Run `npm run test:run -- src/schemas/administration.test.ts src/queries/administration.test.ts`. Expected result: imports and query functions are missing.

- [ ] **Step 3: Implement exact schemas and query functions**

  Use Zod `trim`, max lengths, `appRoleSchema`, and the established pagination schema. Parse filter/search URL input before querying. Query account rows through the RLS-protected profile/role relationship, invoke `private.update_managed_user` only through an RPC wrapper after schema validation, and never expose `assigned_by` or raw audit metadata as form input. Make audit list ordering deterministic (`created_at desc`, then `id desc`).

- [ ] **Step 4: Re-run focused tests**

  Run `npm run test:run -- src/schemas/administration.test.ts src/queries/administration.test.ts`. Expected result: PASS.

- [ ] **Step 5: Commit contracts**

  ```powershell
  git add src/schemas src/queries src/lib/query-keys.ts
  git commit -m "feat: add administration data contracts"
  ```

### Task 3: Restore the correct signed-in destination

**Files:**
- Create: `src/lib/auth/role-home.ts`
- Create: `src/lib/auth/role-home.test.ts`
- Create: `src/app/auth/continue/route.ts`
- Create: `src/app/auth/continue/route.test.ts`
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`

**Interfaces:**
- Produces `getRoleHome(role: AppRole): \`/${string}\`` and `getRoleHome(null): "/unauthorized"`.
- `/auth/continue?next=<safe-path>` redirects a verified user to a same-role safe next path or their role home.

- [ ] **Step 1: Write failing routing tests**

  Mock `getCurrentRole` and `getAuthenticatedUser`. Test each role's default route, an administrator's safe `/admin/users` next route, rejection of `/hr` for an administrator, missing role to `/unauthorized`, and an authenticated root request redirecting instead of rendering the public Sign out screen.

  ```ts
  await expect(getRoleHome("system_administrator")).resolves.toBe("/admin");
  expect(response.headers.get("location")).toContain("/admin/users");
  ```

- [ ] **Step 2: Run tests to verify the current screenshot behavior is reproduced**

  Run `npm run test:run -- src/lib/auth/role-home.test.ts src/app/auth/continue/route.test.ts src/app/page.test.tsx`. Expected result: missing route/helper tests fail, and the existing root-page test shows authenticated users still render Sign out.

- [ ] **Step 3: Implement role-home and continuation redirects**

  Have `LoginForm` replace to `/auth/continue`, preserving only a URL-encoded safe `next` value. The server route reads the verified role, confirms a supplied next path starts under that role's configured root, and redirects. Update the root Server Component to redirect an authenticated account via `getRoleHome`; do not fetch role data in browser JavaScript.

- [ ] **Step 4: Run focused routing tests**

  Run the Task 3 command. Expected result: PASS.

- [ ] **Step 5: Commit routing repair**

  ```powershell
  git add src/lib/auth/role-home.ts src/lib/auth/role-home.test.ts src/app/auth/continue src/components/auth/login-form.tsx src/app/page.tsx src/app/page.test.tsx
  git commit -m "fix: route signed-in users to their workspace"
  ```

### Task 4: Extend the protected admin shell and build reusable administration UI primitives

**Files:**
- Create: `src/components/administration/admin-page-header.tsx`
- Create: `src/components/administration/data-table-toolbar.tsx`
- Create: `src/components/administration/role-badge.tsx`
- Create: `src/components/administration/status-badge.tsx`
- Create: `src/components/administration/admin-page-header.test.tsx`
- Create: `src/components/administration/data-table-toolbar.test.tsx`
- Modify: `src/lib/app/role-config.ts`
- Modify: `src/components/app-shell/app-shell.tsx`
- Modify: `src/components/app-shell/app-shell.test.tsx`

**Interfaces:**
- Produces `AdminPageHeader({ title, description, actions })`, `DataTableToolbar({ search, filters, children })`, `RoleBadge({ role })`, and `StatusBadge({ active })`.
- Extends `RoleNavigationItem.icon` to the exact Lucide icon component type and declares all seven administrator links.

- [ ] **Step 1: Write failing accessibility and navigation tests**

  Assert all admin links exist with their accessible labels, inactive roles receive none of them, the sidebar renders each configured icon, badge text contains role/status rather than relying only on color, and filter controls have visible labels.

- [ ] **Step 2: Run focused component tests and confirm failures**

  Run `npm run test:run -- src/components/administration src/components/app-shell/app-shell.test.tsx`. Expected result: administration component modules and navigation links are missing.

- [ ] **Step 3: Implement small reusable components and navigation**

  Use `Users`, `ShieldCheck`, `Building2`, `BriefcaseBusiness`, `Settings`, and `ScrollText` from Lucide. Keep admin page content inside the existing shell's responsive maximum-width frame. Use native labelled inputs/selects, 44px-or-larger action targets, semantic table support, 150–300ms color/opacity transitions, and no raw color values in components.

- [ ] **Step 4: Run focused component tests**

  Run the Task 4 command. Expected result: PASS.

- [ ] **Step 5: Commit the reusable administration UI**

  ```powershell
  git add src/components/administration src/lib/app/role-config.ts src/components/app-shell
  git commit -m "feat: add administration navigation and UI primitives"
  ```

### Task 5: Deliver account directory, invitation, role, and activation workflows

**Files:**
- Create: `src/hooks/use-administration.ts`
- Create: `src/hooks/use-administration.test.tsx`
- Create: `src/components/administration/user-filters.tsx`
- Create: `src/components/administration/user-table.tsx`
- Create: `src/components/administration/managed-user-dialog.tsx`
- Create: `src/components/administration/invite-user-dialog.tsx`
- Create: `src/components/administration/user-management.test.tsx`
- Create: `src/app/(app)/admin/users/page.tsx`
- Create: `src/app/(app)/admin/users/page.test.tsx`
- Create: `src/app/(app)/admin/roles/page.tsx`
- Create: `src/app/(app)/admin/roles/page.test.tsx`
- Modify: `src/app/(app)/admin/page.tsx`

**Interfaces:**
- Produces `useManagedUsers(filters)`, `useUpdateManagedUser()`, and `useInviteInternalUser()`.
- `useUpdateManagedUser().mutateAsync({ userId, role, isActive })` invalidates Users, Roles, and Audit Logs only after successful RPC completion.

- [ ] **Step 1: Write failing interaction tests**

  Mock query hooks and verify Users renders an Applicant account, search plus role/status filters alter the query input, an Applicant can be changed to Employee, invitations exclude the Applicant role, pending mutation controls are disabled, and an error message is announced. Verify `/admin/roles` uses the same `ManagedUserDialog` and does not create a second update implementation.

- [ ] **Step 2: Run the account-management tests and confirm failures**

  Run `npm run test:run -- src/hooks/use-administration.test.tsx src/components/administration/user-management.test.tsx 'src/app/(app)/admin/users/page.test.tsx' 'src/app/(app)/admin/roles/page.test.tsx'`. Expected result: hooks, pages, and dialogs are missing.

- [ ] **Step 3: Implement the directory and workflows**

  Use TanStack Query for every browser list/mutation. Render server-protected pages and client interactive children. Keep filters in parsed URL search parameters so they are shareable; debounce only text search. Invoke the existing `invite-internal-user` function for new internal accounts. Use a confirmation dialog for deactivation and self/last-admin errors returned from the database; never present an optimistic success before the workflow resolves.

- [ ] **Step 4: Run account-management tests**

  Run the Task 5 command. Expected result: PASS.

- [ ] **Step 5: Commit account administration**

  ```powershell
  git add src/hooks src/components/administration src/app/'(app)'/admin
  git commit -m "feat: add administrator account management"
  ```

### Task 6: Deliver department and position master-data management

**Files:**
- Create: `src/components/administration/department-dialog.tsx`
- Create: `src/components/administration/position-dialog.tsx`
- Create: `src/components/administration/master-data-tables.test.tsx`
- Create: `src/app/(app)/admin/departments/page.tsx`
- Create: `src/app/(app)/admin/departments/page.test.tsx`
- Create: `src/app/(app)/admin/positions/page.tsx`
- Create: `src/app/(app)/admin/positions/page.test.tsx`
- Modify: `src/hooks/use-administration.ts`
- Modify: `src/queries/administration.ts`

**Interfaces:**
- Produces create/update mutations for `Department` and `Position`; their successful mutations invalidate both reference-data list keys and position selectors.

- [ ] **Step 1: Write failing reference-data form and page tests**

  Test required department name, optional position department/code/description, duplicate-code conflict presentation, edit prefill, deactivation action labelling, and the absence of a hard-delete control. Assert a position's department selector receives only active departments.

- [ ] **Step 2: Run focused tests and confirm failures**

  Run `npm run test:run -- src/components/administration/master-data-tables.test.tsx 'src/app/(app)/admin/departments/page.test.tsx' 'src/app/(app)/admin/positions/page.test.tsx'`. Expected result: missing form/page modules.

- [ ] **Step 3: Implement departments and positions**

  Use the Task 2 schemas in dialogs and RLS-protected query functions. Present active/inactive state in text and badge form. Create and edit with a clear save state; deactivate by updating `is_active` and keep every record visible via an Active/Inactive/All filter. Use the generated position code partial unique index for conflict safety; display its returned conflict as a form error.

- [ ] **Step 4: Run focused tests**

  Run the Task 6 command. Expected result: PASS.

- [ ] **Step 5: Commit reference data**

  ```powershell
  git add src/components/administration src/hooks/use-administration.ts src/queries/administration.ts src/app/'(app)'/admin/departments src/app/'(app)'/admin/positions
  git commit -m "feat: manage departments and positions"
  ```

### Task 7: Deliver organization settings and read-only audit history

**Files:**
- Create: `src/components/administration/settings-form.tsx`
- Create: `src/components/administration/audit-log-table.tsx`
- Create: `src/components/administration/audit-log-details.tsx`
- Create: `src/components/administration/settings-audit.test.tsx`
- Create: `src/app/(app)/admin/settings/page.tsx`
- Create: `src/app/(app)/admin/settings/page.test.tsx`
- Create: `src/app/(app)/admin/audit-logs/page.tsx`
- Create: `src/app/(app)/admin/audit-logs/page.test.tsx`
- Modify: `src/hooks/use-administration.ts`
- Modify: `src/queries/administration.ts`

**Interfaces:**
- Produces `useOrganizationSettings`, `useUpdateOrganizationSettings`, and `useAuditLogs(filters)`.
- `AuditLogDetails({ auditLog })` renders an allowlisted labelled set of metadata fields; it never renders arbitrary HTML.

- [ ] **Step 1: Write failing tests**

  Verify settings rejects invalid email/time zone, persists the three supported fields, and invalidates settings plus audit log queries only after success. Verify audit logs paginate deterministically, filter by action/entity/date, render empty states, and expose metadata through an accessible details control with no mutation button.

- [ ] **Step 2: Run focused tests and confirm failures**

  Run `npm run test:run -- src/components/administration/settings-audit.test.tsx 'src/app/(app)/admin/settings/page.test.tsx' 'src/app/(app)/admin/audit-logs/page.test.tsx'`. Expected result: missing components and routes.

- [ ] **Step 3: Implement settings and audit history**

  Render organization name, support email, and time-zone form controls with helper text that secrets are not configured here. Query audit logs in `created_at desc, id desc` order, use parsed URL filters, and show user-facing actor/entity/action/time fields. Convert known metadata to text values, never `dangerouslySetInnerHTML`, and label unknown metadata as structured JSON text only after escaping through React rendering.

- [ ] **Step 4: Run focused tests**

  Run the Task 7 command. Expected result: PASS.

- [ ] **Step 5: Commit settings and audit log UI**

  ```powershell
  git add src/components/administration src/hooks/use-administration.ts src/queries/administration.ts src/app/'(app)'/admin/settings src/app/'(app)'/admin/audit-logs
  git commit -m "feat: add administration settings and audit history"
  ```

### Task 8: Verify end-to-end branch requirements and prepare review

**Files:**
- Modify: the specific affected test file only when a verification step exposes a branch regression.
- Modify: `README.md` only when the completed branch requires an operator step that is absent from the existing documentation.

**Interfaces:**
- Produces verified evidence that administrators can complete every intended journey and every other role is denied at both route and data boundaries.

- [ ] **Step 1: Run the complete automated suite**

  ```powershell
  npm run lint
  npm run typecheck
  npm run test:run
  npm run build
  ```

  Expected result: all commands exit 0. Fix only failures caused by this branch, adding a regression test before every fix.

- [ ] **Step 2: Apply and test the migration against a clean local database**

  Discover exact local commands with `npx supabase db --help` and `npx supabase test --help`, reset or create an isolated local test database, apply all migrations, and run both `auth_rbac_foundation.test.sql` and `administration_master_data.test.sql`. Expected result: every pgTAP assertion passes on a fresh database.

- [ ] **Step 3: Perform manual role journeys**

  In a local seeded environment, sign in as administrator and confirm redirect to `/admin`; invite an internal account; filter an Applicant; change it to Employee; deactivate another account; create/deactivate department and position; update settings; and locate each action in Audit Logs. Then sign in as HR, Employee, Applicant, and Management: direct `/admin/*` URLs must resolve to `/unauthorized`, and direct role/status mutation RPC calls must fail.

- [ ] **Step 4: Perform responsive and accessibility QA**

  Inspect `/admin/users`, `/admin/departments`, and `/admin/audit-logs` at 375px, 768px, 1024px, and 1440px. Tab through sidebar, filters, dialogs, table actions, and details controls; check visible focus, labels, no horizontal page scroll, and readable empty/error/pending states. Capture screenshots for the pull request.

- [ ] **Step 5: Confirm a clean working tree and write PR evidence**

  Run `git status --short` and confirm it prints no files. The PR description must identify roadmap branch 04, database migration/RLS/function changes, intended and denied role journeys, test commands/results, screenshots, and any Supabase deployment configuration needed for the Edge Function.
