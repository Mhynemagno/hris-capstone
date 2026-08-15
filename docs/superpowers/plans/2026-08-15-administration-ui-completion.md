# Administration UI Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the six protected System Administrator routes with paginated, validated, RLS-backed workflows that use the existing invitation and managed-user server workflows.

**Architecture:** Each protected server route renders a focused client workspace. Zod validates filters and forms before a query function sends them to Supabase; TanStack Query owns cached records and precisely invalidates affected lists after mutations. Normal reference-data actions use the RLS-protected browser client, while invitation and role/status actions invoke the existing protected Edge Function and RPC.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Tailwind CSS, Base UI/shadcn conventions, Supabase JS, TanStack Query v5, Zod v4, React Hook Form, `@hookform/resolvers`, Vitest, React Testing Library, pgTAP/Supabase CLI.

## Global Constraints

- Keep the existing `system_administrator` server route guard; do not rely on hidden controls for authorization.
- All administration lists fetch exactly 20 rows per Supabase request. Do not add Zustand or fetch an entire table.
- Use React Hook Form plus `zodResolver` for all interactive forms, and re-parse input in the query function.
- Set a non-zero TanStack Query stale time and invalidate only administration keys affected by a successful mutation.
- Never directly update `user_roles` or `profiles` from the browser. Call `update_managed_user`; invitations call `invite-internal-user` through the existing explicit POST function endpoint.
- Departments and positions only set `is_active` false. Audit logs are read-only. Never expose application secrets.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `package.json`, `package-lock.json` | Add React Hook Form and the Zod resolver. |
| `src/schemas/administration.ts` | Invitation and page-specific filter schemas. |
| `src/lib/types/database.ts` | Managed-user and paginated-result types. |
| `src/lib/query-keys.ts`, `src/components/providers/query-provider.tsx` | Filter-sensitive cache keys and stale-time default. |
| `src/queries/administration.ts` | Validated Supabase reads and mutations. |
| `src/hooks/use-administration.ts` | Query and mutation hooks with scoped invalidation. |
| `src/components/administration/paginated-table-controls.tsx` | Shared accessible paging controls. |
| `src/components/administration/administration-form-panel.tsx` | Shared Sheet wrapper for RHF forms. |
| `src/components/administration/administration-workspaces.tsx` | Six focused client workspaces. |
| `src/app/(app)/admin/*/page.tsx` | Replace static placeholders with corresponding workspaces. |
| `*.test.ts(x)` files below | Unit and UI coverage. |
| `supabase/tests/administration_master_data.test.sql` | Administrator success and non-Administrator denial checks. |

## Task 1: Establish Dependencies, Schemas, Types, and Query Defaults

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/schemas/administration.ts`, `src/schemas/administration.test.ts`
- Modify: `src/lib/types/database.ts`, `src/lib/query-keys.ts`
- Modify: `src/components/providers/query-provider.tsx`, `src/components/providers/query-provider.test.tsx`

**Interfaces:**
- Produces: `internalInvitationSchema`, `managedUserFiltersSchema`, `referenceDataFiltersSchema`, `auditLogFiltersSchema`, `InternalInvitationInput`, `ManagedUserFilters`, `ReferenceDataFilters`, `AuditLogFilters`, `ManagedUser`, and `PaginatedResult<T, TFilters>`.

- [ ] **Step 1: Install form dependencies.**

Run: `npm install react-hook-form @hookform/resolvers`.

- [ ] **Step 2: Write failing schema and default-option tests.**

Add to `src/schemas/administration.test.ts`:

```ts
it("accepts an internal invitation and a 20-row managed-user page", () => {
  expect(internalInvitationSchema.parse({ email: "new.hr@example.com", fullName: "New HR", role: "hr_personnel" })).toMatchObject({ role: "hr_personnel" });
  expect(managedUserFiltersSchema.parse({ page: "2", pageSize: 20, status: "active" })).toMatchObject({ page: 2, pageSize: 20 });
});

it("rejects applicant invitations, blank filters, and non-20 page sizes", () => {
  expect(internalInvitationSchema.safeParse({ email: "a@example.com", fullName: "A User", role: "applicant" }).success).toBe(false);
  expect(auditLogFiltersSchema.safeParse({ entityType: " ", pageSize: 20 }).success).toBe(false);
  expect(managedUserFiltersSchema.safeParse({ pageSize: 21 }).success).toBe(false);
});
```

In the QueryProvider test, render a `useQueryClient` probe and expect `queryClient.getDefaultOptions().queries?.staleTime` to be greater than zero.

- [ ] **Step 3: Confirm tests fail.**

Run: `npm run test:run -- src/schemas/administration.test.ts src/components/providers/query-provider.test.tsx`.

Expected: FAIL because the schemas and stale-time default do not exist.

- [ ] **Step 4: Implement the contracts.**

Define the allowed invitation role schema and fixed-page schemas in `src/schemas/administration.ts`:

```ts
export const internalInvitationSchema = z.object({
  email: z.email(),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(["system_administrator", "hr_personnel", "employee", "management"]),
});

const administrationPageSchema = paginationSchema.extend({ pageSize: z.literal(20).default(20) });
export const managedUserFiltersSchema = administrationPageSchema.extend({
  search: z.string().trim().min(1).max(120).optional(),
  role: appRoleSchema.optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
```

Create equivalent reference filters (`search`, `status`) and audit filters (`search`, `entityType`, `action`). Transform a blank optional string to `undefined`, so it does not make an unintended Supabase filter. Export these inferred types: `InternalInvitationInput`, `ManagedUserFilters`, `ReferenceDataFilters`, and `AuditLogFilters`.

Add the types below to `src/lib/types/database.ts`:

```ts
export type ManagedUser = Profile & Pick<UserRole, "role" | "assigned_at">;
export type PaginatedResult<T, TFilters> = { rows: T[]; count: number; filters: TFilters };
```

Make each `queryKeys.administration` list key include its parsed filter object. Construct QueryClient with `defaultOptions: { queries: { staleTime: 30_000 } }`.

- [ ] **Step 5: Confirm tests pass.**

Run: `npm run test:run -- src/schemas/administration.test.ts src/components/providers/query-provider.test.tsx`.

Expected: PASS.

- [ ] **Step 6: Commit the contracts.**

Run: `git add package.json package-lock.json src/schemas/administration.ts src/schemas/administration.test.ts src/lib/types/database.ts src/lib/query-keys.ts src/components/providers/query-provider.tsx src/components/providers/query-provider.test.tsx`.

Run: `git commit -m "feat: add administration client contracts"`.

## Task 2: Implement Validated Administration Data Functions

**Files:**
- Create: `src/queries/administration.ts`, `src/queries/administration.test.ts`
- Modify: `src/queries/index.ts`

**Interfaces:**
- Consumes: Task 1 schemas/types and `createBrowserSupabaseClient`.
- Produces: `listManagedUsers`, `inviteInternalUser`, `updateManagedUser`, `listDepartments`, `saveDepartment`, `listPositions`, `savePosition`, `getOrganizationSettings`, `saveOrganizationSettings`, and `listAuditLogs`.

- [ ] **Step 1: Write failing mocked-client tests.**

Mock `@/lib/supabase/client`. Verify pagination, protected workflow use, and serialization:

```ts
await listManagedUsers({ search: "Ada", role: "employee", page: 2, pageSize: 20 });
expect(range).toHaveBeenCalledWith(20, 39);
expect(eq).toHaveBeenCalledWith("user_roles.role", "employee");

await updateManagedUser({ userId, role: "management", isActive: false });
expect(rpc).toHaveBeenCalledWith("update_managed_user", {
  target_user_id: userId, next_role: "management", next_is_active: false,
});

await inviteInternalUser({ email: "new@example.com", fullName: "New User", role: "employee" });
expect(invoke).toHaveBeenCalledWith("invite-internal-user", expect.objectContaining({ body: expect.any(Object) }));
```

Also assert reference and audit lists use `.select("*", { count: "exact" })` and `.range`; a position uses `department_id`; settings use `id: true`; Supabase `{ message: "Denied" }` becomes `throw new Error("Denied")`.

- [ ] **Step 2: Confirm tests fail.**

Run: `npm run test:run -- src/queries/administration.test.ts`.

Expected: FAIL because the module is missing.

- [ ] **Step 3: Write the query layer.**

Create these helpers:

```ts
function throwIfError(error: { message: string } | null) { if (error) throw new Error(error.message); }
function pageRange(page: number) { const from = (page - 1) * 20; return { from, to: from + 19 }; }
```

`listManagedUsers` parses its filters, queries `profiles` with inner `user_roles(role, assigned_at)`, applies full-name/email search, optional role/status filters, exact count, deterministic order, and range. Map its nested relation into a flat `ManagedUser`.

Every other list parses its filter schema, calls `.select("*", { count: "exact" })`, applies only supplied filters, deterministic ordering, and the range. Audit search covers `entity_type`, `entity_id`, and `action`, and has no mutation function.

`saveDepartment` and `savePosition` parse the current form schemas, map camel case to database fields, and use either `.insert(...).select("*").single()` or `.update(...).eq("id", id).select("*").single()`. Deactivation is a normal update with `isActive: false`; no delete function is allowed. `saveOrganizationSettings` parses its schema, then upserts `{ id: true, organization_name, support_email, default_timezone }` and selects the result.

`inviteInternalUser` parses `internalInvitationSchema`, then calls `client.functions.invoke("invite-internal-user", { body })`. `updateManagedUser` parses the existing schema and calls only `client.rpc("update_managed_user", { target_user_id, next_role, next_is_active })`.

- [ ] **Step 4: Export and verify.**

Add `export * from "./administration";` to `src/queries/index.ts`.

Run: `npm run test:run -- src/queries/administration.test.ts`.

Expected: PASS, proving pages request ranges 0-19, 20-39, and so on.

- [ ] **Step 5: Commit the query layer.**

Run: `git add src/queries/administration.ts src/queries/administration.test.ts src/queries/index.ts`.

Run: `git commit -m "feat: add administration data queries"`.

## Task 3: Add TanStack Query Hooks and Invalidation

**Files:**
- Create: `src/hooks/use-administration.ts`, `src/hooks/use-administration.test.tsx`
- Modify: `src/hooks/index.ts`

**Interfaces:**
- Consumes: Task 2 functions and Task 1 query keys.
- Produces: `useManagedUsers`, `useManagedRoles`, `useInviteInternalUser`, `useUpdateManagedUser`, `useDepartments`, `useSaveDepartment`, `usePositions`, `useSavePosition`, `useOrganizationSettings`, `useSaveOrganizationSettings`, and `useAuditLogs`.

- [ ] **Step 1: Write failing hook tests.**

Mock Task 2 queries, render a QueryClientProvider, and assert a managed-user mutation invalidates its related caches:

```ts
await result.current.mutateAsync({ input: { userId, role: "employee", isActive: false } });
expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["administration", "users"] });
expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["administration", "roles"] });
expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["administration", "audit-logs"] });
```

Verify department/position writes invalidate their list prefix and audit logs, settings writes invalidate settings and audit logs, and list hooks use a parsed filter with `pageSize: 20`.

- [ ] **Step 2: Confirm tests fail.**

Run: `npm run test:run -- src/hooks/use-administration.test.tsx`.

Expected: FAIL because the hooks are missing.

- [ ] **Step 3: Implement hooks with scoped invalidation.**

Each list hook parses `{ page: 1, pageSize: 20, ...filters }` before giving the result to both the query key and query function. `useManagedUsers` and `useManagedRoles` both call `listManagedUsers`, but use the separate users and roles key families so either workspace can be refreshed precisely. Each mutation uses `useMutation`; its `onSuccess` invalidates key prefixes rather than mutating cached records. `useInviteInternalUser` invalidates users, roles, and audit logs.

- [ ] **Step 4: Export, verify, and commit.**

Add `export * from "./use-administration";` to `src/hooks/index.ts`.

Run: `npm run test:run -- src/hooks/use-administration.test.tsx`.

Expected: PASS.

Run: `git add src/hooks/use-administration.ts src/hooks/use-administration.test.tsx src/hooks/index.ts`.

Run: `git commit -m "feat: add administration query hooks"`.

## Task 4: Build Reusable Pagination and Form Panel Controls

**Files:**
- Create: `src/components/administration/paginated-table-controls.tsx`, `src/components/administration/administration-form-panel.tsx`
- Create: `src/components/administration/administration-workspaces.test.tsx`

**Interfaces:**
- Produces: `PaginatedTableControls({ page, pageSize, totalCount, onPageChange })` and `AdministrationFormPanel({ open, onOpenChange, title, description, children })`.

- [ ] **Step 1: Write failing control tests.**

```tsx
render(<PaginatedTableControls page={2} pageSize={20} totalCount={45} onPageChange={onPageChange} />);
await user.click(screen.getByRole("button", { name: /next page/i }));
expect(onPageChange).toHaveBeenCalledWith(3);
expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
```

Also expect Previous disabled on page 1, Next disabled on the last page, and an `AdministrationFormPanel` Sheet to contain an accessible title, description, and close button.

- [ ] **Step 2: Confirm tests fail.**

Run: `npm run test:run -- src/components/administration/administration-workspaces.test.tsx`.

Expected: FAIL because the components are missing.

- [ ] **Step 3: Implement shared UI.**

`PaginatedTableControls` calculates `Math.max(1, Math.ceil(totalCount / pageSize))`, renders `Page {page} of {pageCount}`, gives Previous/Next clear aria labels, and calls only the parent-owned `onPageChange`.

`AdministrationFormPanel` composes existing `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, and `SheetDescription` with `side="right"`. It accepts an RHF form as children and never resets the form when a mutation errors.

- [ ] **Step 4: Verify and commit.**

Run: `npm run test:run -- src/components/administration/administration-workspaces.test.tsx`.

Expected: PASS.

Run: `git add src/components/administration/paginated-table-controls.tsx src/components/administration/administration-form-panel.tsx src/components/administration/administration-workspaces.test.tsx`.

Run: `git commit -m "feat: add administration table controls"`.

## Task 5: Implement Users and Roles Workspaces

**Files:**
- Create: `src/components/administration/administration-workspaces.tsx`
- Modify: `src/components/administration/administration-workspaces.test.tsx`
- Modify: `src/app/(app)/admin/users/page.tsx`, `src/app/(app)/admin/roles/page.tsx`

**Interfaces:**
- Consumes: Task 3 hooks, Task 4 controls, `internalInvitationSchema`, and `managedUserUpdateSchema`.
- Produces: `UsersWorkspace` and `RolesWorkspace`.

- [ ] **Step 1: Write failing user/role UI journey tests.**

Mock administration hooks and test loading, empty state, invalid invitation, filtering, mutation input, and pagination:

```tsx
render(<UsersWorkspace />);
expect(screen.getByRole("status", { name: /loading accounts/i })).toBeInTheDocument();

mockUsersQuery({ rows: [], count: 0, filters: { page: 1, pageSize: 20 } });
render(<UsersWorkspace />);
expect(screen.getByText(/no accounts match/i)).toBeInTheDocument();

await user.click(screen.getByRole("button", { name: /invite account/i }));
await user.type(screen.getByLabelText(/email/i), "bad-email");
await user.click(screen.getByRole("button", { name: /send invitation/i }));
expect(screen.getByText(/valid email/i)).toBeInTheDocument();
```

Assert a role edit submits `{ userId, role, isActive }` to the update mutation; search/filter starts at page 1; and `RolesWorkspace` has role editing but no invitation control.

- [ ] **Step 2: Confirm tests fail.**

Run: `npm run test:run -- src/components/administration/administration-workspaces.test.tsx`.

Expected: FAIL because workspace exports are absent.

- [ ] **Step 3: Implement `UsersWorkspace`.**

Use local `search`, `role`, `status`, and `page` state, always call `useManagedUsers` with `pageSize: 20`, and reset page to 1 whenever a filter changes. Render account name, email, role, active status, edit action, `LoadingState`, `ErrorState`, `EmptyTableState`, and `PaginatedTableControls`.

Use `useForm<InternalInvitationInput>({ resolver: zodResolver(internalInvitationSchema), defaultValues: { email: "", fullName: "", role: "employee" } })` in `AdministrationFormPanel`. Submit `inviteMutation.mutateAsync(values)`, surface thrown errors using `ErrorState`, and reset/close only on success. Do not access an environment variable or manually add credentials.

Create a managed-user edit form using `useForm<ManagedUserUpdateInput>` prefilled from the selected row. Submit only `updateMutation.mutateAsync({ input: values })`; render RPC errors, including self-deactivation/last-active-admin protection failures.

- [ ] **Step 4: Implement `RolesWorkspace` without a duplicate workflow.**

Use `useManagedRoles` with the same fixed page/filter/pagination model, omit invitation controls, and use the same audited update mutation in a clearly labeled role/status form. Do not call `from("user_roles").update()`.

- [ ] **Step 5: Connect both protected pages.**

Replace the static child in `/admin/users` with:

```tsx
import { UsersWorkspace } from "@/components/administration/administration-workspaces";

export default function UsersPage() {
  return <AdminPage title="Users" description="Search, filter, invite, and manage every account, including applicants."><UsersWorkspace /></AdminPage>;
}
```

Use `RolesWorkspace` in `/admin/roles`; retain both existing `AdminPage` titles/descriptions and the parent server admin layout.

- [ ] **Step 6: Verify and commit.**

Run: `npm run test:run -- src/components/administration/administration-workspaces.test.tsx`.

Expected: PASS for loading, empty, invalid invitation, role update, filtering, and pagination.

Run: `git add src/components/administration/administration-workspaces.tsx src/components/administration/administration-workspaces.test.tsx "src/app/(app)/admin/users/page.tsx" "src/app/(app)/admin/roles/page.tsx"`.

Run: `git commit -m "feat: complete administration user management"`.

## Task 6: Implement Reference Data, Settings, and Audit Workspaces

**Files:**
- Modify: `src/components/administration/administration-workspaces.tsx`, `src/components/administration/administration-workspaces.test.tsx`
- Modify: `src/app/(app)/admin/departments/page.tsx`, `src/app/(app)/admin/positions/page.tsx`
- Modify: `src/app/(app)/admin/settings/page.tsx`, `src/app/(app)/admin/audit-logs/page.tsx`

**Interfaces:**
- Consumes: Task 3 reference/settings/audit hooks and Task 4 controls.
- Produces: `DepartmentsWorkspace`, `PositionsWorkspace`, `SettingsWorkspace`, and `AuditLogsWorkspace`.

- [ ] **Step 1: Write failing reference, settings, and audit UI tests.**

```tsx
await user.click(screen.getByRole("button", { name: /add department/i }));
await user.type(screen.getByLabelText(/^name/i), "Operations");
await user.click(screen.getByRole("button", { name: /save department/i }));
expect(saveDepartment).toHaveBeenCalledWith({ input: { name: "Operations", isActive: true } });
```

Also test that an existing department/position Deactivate action submits its current fields with `isActive: false` and calls no delete hook; the position form has an optional department selector; settings reject invalid support email; and audit history has entity/action filtering and no Add/Edit/Delete controls.

- [ ] **Step 2: Confirm tests fail.**

Run: `npm run test:run -- src/components/administration/administration-workspaces.test.tsx`.

Expected: FAIL because these workspace components are missing.

- [ ] **Step 3: Implement departments and positions.**

Both workspaces own `search`, `status`, and `page`; both call their list hook with `pageSize: 20`, reset to page 1 after filter changes, and use shared loading/error/empty/pagination controls.

Use `useForm<DepartmentInput>` and `useForm<PositionInput>` with `zodResolver` in create/edit panels. Submit `saveDepartmentMutation.mutateAsync({ input, id })` or `savePositionMutation.mutateAsync({ input, id })`. Positions load active departments through the existing department list hook, offer a labeled empty `None` choice, and submit `departmentId: null` when no department is selected.

Deactivate actions prefill the existing edit model and save `{ ...currentValues, isActive: false }`. Never add a `.delete()` call or a delete button.

- [ ] **Step 4: Implement settings and immutable audit history.**

`SettingsWorkspace` reads `useOrganizationSettings`, calls `form.reset` once settings arrive, and submits only `{ organizationName, supportEmail, defaultTimezone }` through `useSaveOrganizationSettings`. Do not display an editable ID, environment variable, or secret.

`AuditLogsWorkspace` calls `useAuditLogs` with `search`, `entityType`, `action`, `page`, and `pageSize: 20`. It renders actor ID, entity type/ID, action, a concise metadata JSON/text summary, timestamp, loading/error/empty states, filters, and pagination. It imports no mutation hook and renders no form panel or record-action control.

- [ ] **Step 5: Connect the four server routes.**

Replace each `AdminEmptyState` child with its matching workspace while retaining the current `AdminPage` heading and description. Do not add client directives to route files or alter `src/app/(app)/admin/layout.tsx`.

- [ ] **Step 6: Verify and commit.**

Run: `npm run test:run -- src/components/administration/administration-workspaces.test.tsx`.

Expected: PASS for create, edit, deactivate, settings validation/save, immutable audit list, filtering, and 20-row pagination.

Run: `git add src/components/administration/administration-workspaces.tsx src/components/administration/administration-workspaces.test.tsx "src/app/(app)/admin/departments/page.tsx" "src/app/(app)/admin/positions/page.tsx" "src/app/(app)/admin/settings/page.tsx" "src/app/(app)/admin/audit-logs/page.tsx"`.

Run: `git commit -m "feat: complete administration data workspaces"`.

## Task 7: Extend RLS and Workflow Regression Coverage

**Files:**
- Modify: `supabase/tests/administration_master_data.test.sql`

**Interfaces:**
- Consumes: existing RLS policies, audit triggers, fixture users, and `public.update_managed_user`.
- Produces: proof that Administrators can manage reference data but non-Administrators cannot, while audit history remains immutable.

- [ ] **Step 1: Add failing pgTAP assertions and update the planned assertion count.**

Under the Administrator fixture, insert a department and department-assigned position, update both to `is_active = false`, then assert both write paths succeed and audit entries exist. Under the HR fixture, assert direct department insert and position update raise `42501`:

```sql
select extensions.throws_ok(
  $$insert into public.departments (name) values ('Denied HR Department')$$,
  '42501', null, 'HR cannot create departments'
);
```

Assert that even an Administrator cannot delete audit rows:

```sql
select extensions.throws_ok(
  $$delete from public.audit_logs where id = 1$$,
  '42501', null, 'Administrators cannot delete audit logs'
);
```

Increase `extensions.plan(17)` by exactly the number of new assertions.

- [ ] **Step 2: Run the test and correct its assertions without weakening RLS.**

Run: `npx supabase@latest test db --linked supabase/tests/administration_master_data.test.sql`.

Expected: first run may FAIL for a stale planned-test count; after correcting count/SQL expectations it PASSes. Add a migration only if this exposes a real policy gap that blocks a specified action; preserve existing RLS and audit triggers.

- [ ] **Step 3: Commit database regression coverage.**

Run: `git add supabase/tests/administration_master_data.test.sql`.

Run: `git commit -m "test: cover administration UI workflows"`.

## Task 8: Verify the Complete Administration Journey

**Files:**
- Modify only if verification exposes a feature regression: files from Tasks 1-7.

**Interfaces:**
- Consumes: all completed feature layers.
- Produces: a clean, tested feature branch ready for code review and pull-request handoff.

- [ ] **Step 1: Run browser-layer verification.**

Run: `npm run lint`.

Run: `npm run typecheck`.

Run: `npm run test:run`.

Run: `npm run build`.

Expected: every command exits zero. Fix only regressions in this feature, rerun the failed command, then rerun the full suite.

- [ ] **Step 2: Run Supabase regression suites.**

Run: `npx supabase@latest test db --linked supabase/tests/auth_rbac_foundation.test.sql`.

Run: `npx supabase@latest test db --linked supabase/tests/administration_master_data.test.sql`.

Run: `npx supabase@latest test db --linked supabase/tests/personnel_records.test.sql`.

Expected: every linked-database suite passes. If a linked project is unavailable, state that external prerequisite in the handoff and do not report a fabricated pass.

- [ ] **Step 3: Perform Administrator and non-Administrator manual checks.**

With an Administrator session, verify that each table requests a 20-row page; invite a supported internal role; change another user's role/status; create/edit/deactivate departments and positions; update settings; and filter audit history. Confirm role/status changes produce audit records.

With an HR, Employee, Applicant, or Management session, verify `/admin/users` reaches `/unauthorized` and protected Supabase reads/mutations are denied by RLS, RPC, or Edge Function authorization.

- [ ] **Step 4: Review scope and create a final correction commit if needed.**

Run: `git status --short`.

Run: `git log --oneline main..HEAD`.

Run: `git diff --check main...HEAD`.

Expected: only branch-scope files are changed and the whitespace check is clean. If verification needed a final correction, commit it with a focused conventional message such as `fix: correct administration pagination`.

- [ ] **Step 5: Prepare the pull-request handoff.**

Include branch name, completed acceptance criteria, migration/RLS changes, browser and database test outcomes, screenshots of all six routes, and the existing Edge Function deployment/runtime-secret prerequisite. Do not commit or describe a secret value.

## Plan Self-Review

- **Spec coverage:** Tasks 1-6 implement all six routes, React Hook Form, Zod boundaries, TanStack Query stale-time/invalidation, explicit invitation POST, 20-row pagination, loading/empty/error states, no Zustand, non-destructive reference data, secret exclusion, and read-only audit logs. Tasks 7-8 cover RLS/workflow denial, route guards, and verification.
- **Placeholder scan:** The plan contains no unresolved placeholders or deferred implementation wording. Every task names exact files, commands, success expectations, and interfaces.
- **Type consistency:** `ManagedUser`, `PaginatedResult<T, TFilters>`, `InternalInvitationInput`, `ManagedUserUpdateInput`, `DepartmentInput`, `PositionInput`, `OrganizationSettingsInput`, and named query/hook exports are used consistently throughout.
