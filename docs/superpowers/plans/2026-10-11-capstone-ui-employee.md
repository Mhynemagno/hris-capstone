# Capstone UI Employee Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the employee-side Capstone UI redesign, including rank-driven promotion readiness and safe employee promotion-docket submission.

**Architecture:** Route employee sessions through the existing `StaffShell` and evolve the employee-only components into focused Capstone UI modules. Keep authoritative writes behind local Supabase RPCs: a migration derives readiness from the caller’s current rank and records a constrained promotion docket; React Query adapters provide the typed client boundary. Existing HR evaluations remain the decision workflow.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Tailwind CSS 4, Lucide, React Query, Supabase/Postgres/RLS/pgTAP, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-capstone-ui-employee-design.md`

## Global Constraints

- Build only on `codex/capstone-ui-employee`, from the merged `main`; open one PR into `main`.
- Reuse `StaffShell`; keep `.capstone-ui`, Lucide icons, the police logo, slate-500 light-surface captions, and slate-400 inactive dark-sidebar labels.
- Employee and HR Capstone screens have a 9px minimum font floor. Dates are written in words.
- Never add roles or stock photographs of real people.
- `/login?as=employee` remains badge-number login titled **Employee / HR**; `/login?as=admin` remains email plus Access Level.
- Active HR/SysAd personnel with a resolvable badge may use the badge login, but authentication must not grant or change a role.
- Remove the standalone employee Scan page; scanning must remain available from Attendance.
- Preserve `playwright.local.config.ts` as an untracked local file: no `webServer`, one worker, localhost base URL.
- Do not push migrations to live Supabase. Run `npx supabase db reset` before `npx supabase test db`.
- Follow RED -> GREEN for every behavior. Build once before E2E; start `next start --hostname 127.0.0.1 --port 3000`; run Playwright one spec file at a time; do not blindly update visual snapshots.

## Review Focus

- A personnel record without a photo, rank, deployment, current attendance, or active leave balance renders a clear empty/fallback state without stock imagery. (Tasks 5 and 6.)
- An employee can never submit a promotion docket for another person, a non-immediate rank, an inactive criterion, or an unready criterion. (Task 3.)
- A criterion for PCpl reaches PAT personnel but not PCpl, PSSg, or a rank with a skipped/deactivated successor. (Task 3.)
- Badge sign-in for HR/SysAd retains the account’s authorized post-login landing page; an email-only admin login still requires the matching Access Level. (Tasks 2 and 11.)
- Direct `/employee/attendance/scan` traffic cannot leave a live camera session behind and lands on the redesigned Attendance experience. (Task 9.)

---

## File Structure

| Area | Files | Responsibility |
| --- | --- | --- |
| Staff framing | `src/app/(app)/layout.tsx`, `src/lib/app/role-config.ts`, `src/components/staff-shell/*`, `src/components/app-shell/capstone-account-menu.tsx` | Select Employee StaffShell, navigation, title metadata, account-menu Profile link. |
| Auth | `src/app/(auth)/login/page.tsx`, `src/components/auth/login-form.tsx`, `src/components/auth/employee-auth-frame.tsx` | Capstone employee/HR badge-login presentation while retaining separate admin login. |
| Promotion persistence | generated `supabase/migrations/*_employee_promotion_dockets.sql`, `supabase/tests/employee_promotion_dockets.test.sql`, `supabase/tests/promotion_live_readiness.test.sql` | Caller-safe rank matching, docket submit RPC, RLS, and pgTAP proof. |
| Promotion client | `src/lib/types/database.ts`, `src/schemas/promotion-eligibility.ts`, `src/queries/promotion-eligibility.ts`, `src/hooks/use-promotion-eligibility.ts` | Typed readiness/docket data, validation, queries, mutations, invalidation. |
| Employee UI | `src/components/employee/*`, existing `components/{leave-management,deployment-tracking,attendance-integration,promotion-eligibility,personnel-records}/*`, employee route pages | Focused Capstone cards and modals that compose real employee data. |
| Route coverage | `src/app/(app)/employee/**`, unit tests colocated beside changed components, `e2e/*.spec.ts` and visual snapshots | Redirects, accessible screen behavior, responsive/visual and employee workflow coverage. |

### Task 1: Route employee sessions through the Capstone staff frame

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/lib/app/role-config.ts`
- Modify: `src/components/staff-shell/page-meta.ts`
- Modify: `src/components/staff-shell/staff-shell.tsx`
- Modify: `src/components/staff-shell/staff-shell.test.tsx`
- Modify: `src/lib/app/role-config.test.ts`
- Modify: `src/components/app-shell/capstone-account-menu.test.tsx`

**Interfaces:**
- Consumes: `ROLE_CONFIG.employee`, `StaffShell` props `{ config, displayName, email, children }`.
- Produces: Employee routes render inside `StaffShell`; `CapstoneAccountMenu` receives `profileHref="/employee/profile"` only for the employee role.

- [ ] **Step 1: Write failing StaffShell and role-config tests**

```tsx
expect(ROLE_CONFIG.employee.navigation.map((item) => item.label)).toEqual([
  "Dashboard", "My Profile 201", "My Leaves", "My Deployments", "Promotion Status", "My Attendance",
]);
expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute("href", "/employee/profile");
expect(screen.queryByRole("link", { name: "Scan" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/staff-shell/staff-shell.test.tsx src/lib/app/role-config.test.ts src/components/app-shell/capstone-account-menu.test.tsx`

Expected: FAIL because employee routes still use `WorkspaceShell`, the old labels exist, and Profile is absent.

- [ ] **Step 3: Implement employee StaffShell selection and metadata**

In `ProtectedLayout`, select `StaffShell` for `role === "employee"`, retrieving the employee display name through `getStaffDisplayName`. Rename/reorder the employee configuration to the six approved labels, remove Scan, add employee subtitle/redesigned-route entries, and pass `profileHref` only when `config.role === "employee"`. Preserve existing HR behavior unchanged.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npx vitest run src/components/staff-shell/staff-shell.test.tsx src/lib/app/role-config.test.ts src/components/app-shell/capstone-account-menu.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/(app)/layout.tsx src/lib/app/role-config.ts src/lib/app/role-config.test.ts src/components/staff-shell src/components/app-shell/capstone-account-menu.test.tsx
git commit -m "feat: use staff shell for employee portal"
```

### Task 2: Restyle the badge login and preserve admin access-level login

**Files:**
- Create: `src/components/auth/employee-auth-frame.tsx`
- Create: `src/components/auth/employee-auth-frame.test.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/login/page.test.tsx`
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/components/auth/login-form.test.tsx`
- Modify: `src/app/auth/login/route.test.ts`

**Interfaces:**
- Consumes: `LoginForm` mode `"employee" | "applicant" | "admin"` and `switchHref` behavior.
- Produces: `EmployeeAuthFrame({ children }: { children: ReactNode })` and employee heading **Employee / HR**; the admin branch remains untouched in structure and inputs.

- [ ] **Step 1: Write failing employee-login tests**

```tsx
await renderLogin({ as: "employee" });
expect(screen.getByRole("heading", { name: "Employee / HR" })).toBeVisible();
expect(screen.getByLabel("Badge Number")).toBeVisible();
expect(screen.getByText("Employee Portal")).toBeVisible();
```

Also add the route-level regression assertion that an employee-mode badge submission uses the resolved email and retains `as=employee` on failure; retain the current admin email/access-level assertions verbatim.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/(auth)/login/page.test.tsx src/components/auth/login-form.test.tsx src/app/auth/login/route.test.ts`

Expected: FAIL because the current employee heading is “Employee login” and uses the generic card.

- [ ] **Step 3: Implement the `emplogin.html`-inspired employee form frame**

Create the frame with police logo, employee portal identity, Capstone light panels, and 9px-or-larger text. Use it only for employee mode. Keep a badge-number identifier, password reveal, forgot-password link, status/error semantics, safe next path, and the Admin & HR switch link. Do not alter the applicant or admin branches or convert badge login into email login.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npx vitest run src/app/(auth)/login/page.test.tsx src/components/auth/login-form.test.tsx src/app/auth/login/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/(auth)/login src/app/auth/login src/components/auth
git commit -m "feat: restyle employee badge login"
```

### Task 3: Add rank-matched readiness and secured promotion dockets locally

**Files:**
- Create: generated `supabase/migrations/<timestamp>_employee_promotion_dockets.sql`
- Create: `supabase/tests/employee_promotion_dockets.test.sql`
- Modify: `supabase/tests/promotion_live_readiness.test.sql`
- Modify: `supabase/migrations/20260924111000_demo_data_reset.sql` only if reset fixtures need a deterministic second rank/criterion/docket case

**Interfaces:**
- Consumes: `public.ranks.sort_order`, `public.employees.rank_id`, active `promotion_criteria`, `private.promotion_readiness`, `private.require_active_employee_self`, `private.require_active_hr`, existing notifications/audit primitives.
- Produces: `public.get_my_promotion_readiness() -> jsonb` for the immediate next target rank; `public.submit_employee_promotion_docket(target_criterion_id uuid, target_remarks text) -> uuid`; table `public.employee_promotion_dockets`.

- [ ] **Step 1: Write failing pgTAP assertions for rank matching, docket validation, and RLS**

```sql
select extensions.is(
  public.get_my_promotion_readiness() ->> 'targetRankName',
  'Police Corporal',
  'A PAT employee sees the active PCpl criterion'
);
select extensions.throws_ok(
  $$select public.submit_employee_promotion_docket(current_setting('test.bad_criterion')::uuid, 'Ready')$$,
  '42501', null, 'An employee cannot submit a nonmatching or unready promotion docket'
);
select extensions.is_empty(
  $$select * from public.employee_promotion_dockets where employee_id <> private.require_active_employee_self()$$,
  'An employee cannot read another employee docket'
);
```

Cover inactive/no-next-rank/no-criterion null results, required trimmed remarks, duplicate submissions, HR select access, no employee status update, and badge resolution for an active HR/SysAd personnel record.

- [ ] **Step 2: Run database reset and the new tests to verify RED**

Run: `npx supabase db reset; npx supabase test db --file supabase/tests/promotion_live_readiness.test.sql; npx supabase test db --file supabase/tests/employee_promotion_dockets.test.sql`

Expected: FAIL because readiness still selects the latest HR review and no docket contract exists.

- [ ] **Step 3: Generate and implement the imperative migration**

First run `npx supabase migration new employee_promotion_dockets` and use the generated filename. In its SQL, add the constrained docket table, RLS, grants, indexes/unique constraint, audit/notification behavior, and an RPC that derives the caller’s employee identity and rechecks live rank-matched readiness server-side. Replace the employee readiness function to choose exactly the active immediate-next-rank criterion using `sort_order`, with a fixed `search_path` and explicit active employee/HR checks. Update `resolve_login_identifier` only to allow a badge held by an active employee/HR/SysAd personnel account; it must not use client-supplied role data.

- [ ] **Step 4: Reset and run the database tests to verify GREEN**

Run: `npx supabase db reset; npx supabase test db --file supabase/tests/promotion_live_readiness.test.sql; npx supabase test db --file supabase/tests/employee_promotion_dockets.test.sql`

Expected: PASS. Then run `npx supabase db advisors` when the installed CLI supports it.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations supabase/tests
git commit -m "feat: match employee promotion criteria by rank"
```

### Task 4: Expose typed readiness and docket data to employee UI

**Files:**
- Modify: `src/lib/types/database.ts`
- Modify: `src/schemas/promotion-eligibility.ts`
- Modify: `src/schemas/promotion-eligibility.test.ts`
- Modify: `src/queries/promotion-eligibility.ts`
- Modify: `src/queries/promotion-eligibility.test.ts`
- Modify: `src/hooks/use-promotion-eligibility.ts`
- Create: `src/hooks/use-promotion-eligibility.test.ts`
- Modify: `src/lib/query-keys.ts`

**Interfaces:**
- Consumes: Task 3 RPC response and `submit_employee_promotion_docket(target_criterion_id, target_remarks)`.
- Produces: `MyPromotionReadiness` including target-rank code/name, criterion ID, readiness rows/progress, and optional docket; `submitEmployeePromotionDocket(input: PromotionDocketInput)`; `useSubmitEmployeePromotionDocket()`.

- [ ] **Step 1: Write failing parser/query/hook tests**

```ts
expect(promotionDocketSchema.safeParse({ criterionId: id, remarks: "  " }).success).toBe(false);
await expect(submitEmployeePromotionDocket({ criterionId: id, remarks: "Board-ready record" })).resolves.toBe(docketId);
expect(invalidateQueries).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["promotion-eligibility"] }));
```

- [ ] **Step 2: Run the focused tests to verify RED**

Run: `npx vitest run src/schemas/promotion-eligibility.test.ts src/queries/promotion-eligibility.test.ts src/hooks/use-promotion-eligibility.test.ts`

Expected: FAIL because no docket schema/client mutation exists.

- [ ] **Step 3: Implement the minimal typed data boundary**

Parse RPC responses at the query boundary, validate trimmed required remarks, call only the submit RPC, and invalidate promotion, employee dashboard, notifications, HR promotion, and reporting keys on success. Keep direct table writes out of browser code.

- [ ] **Step 4: Run the focused tests to verify GREEN**

Run: `npx vitest run src/schemas/promotion-eligibility.test.ts src/queries/promotion-eligibility.test.ts src/hooks/use-promotion-eligibility.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/types/database.ts src/schemas/promotion-eligibility* src/queries/promotion-eligibility* src/hooks/use-promotion-eligibility.ts src/lib/query-keys.ts
git commit -m "feat: add employee promotion docket client"
```

### Task 5: Build the live employee dashboard

**Files:**
- Create: `src/components/employee/employee-dashboard.tsx`
- Create: `src/components/employee/employee-dashboard.test.tsx`
- Modify: `src/app/(app)/employee/page.tsx`
- Modify: relevant employee query/hook files only when a missing read-only aggregate is required

**Interfaces:**
- Consumes: current employee record, deployment list, leave balances, today’s attendance, Task 4 readiness, and published announcements.
- Produces: `<EmployeeDashboard />`, including no-data states and links to Leave, Attendance, and Promotion.

- [ ] **Step 1: Write failing dashboard tests**

```tsx
render(<EmployeeDashboard />);
expect(await screen.findByRole("heading", { name: "Personnel Dashboard" })).toBeVisible();
expect(screen.getByRole("link", { name: "File Leave" })).toHaveAttribute("href", "/employee/leave?request=1");
expect(screen.getByText("No current field assignment")).toBeVisible();
```

Include a test that the fallback avatar is initials rather than an external/stock image and that a missing active criterion is explained without a false eligible state.

- [ ] **Step 2: Run the test to verify RED**

Run: `npx vitest run src/components/employee/employee-dashboard.test.tsx`

Expected: FAIL because the dashboard renders the prior record-summary only.

- [ ] **Step 3: Implement `EmployeeDashboard`**

Compose existing employee-safe hooks into the navy profile banner, field assignment, concise leave entitlement list, today attendance, rank-matched promotion panel, and published announcements. Prefer server/RPC aggregation only if multiple independent client queries cannot represent an empty state safely; never show personal data from another employee.

- [ ] **Step 4: Run the test to verify GREEN**

Run: `npx vitest run src/components/employee/employee-dashboard.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/(app)/employee/page.tsx src/components/employee src/hooks src/queries
git commit -m "feat: redesign employee dashboard"
```

### Task 6: Redesign the personnel profile without weakening record permissions

**Files:**
- Modify: `src/app/(app)/employee/profile/page.tsx`
- Modify: `src/components/personnel-records/employee-record-summary.tsx`
- Modify: `src/components/personnel-records/employee-profile.tsx`
- Modify: their colocated tests

**Interfaces:**
- Consumes: existing current-user record and personnel-entry hooks.
- Produces: Capstone profile summary, separate eligibility/certification/training cards, and preserved request/password actions.

- [ ] **Step 1: Write failing profile tests**

```tsx
expect(await screen.findByRole("heading", { name: "My Profile 201" })).toBeVisible();
expect(screen.getByRole("link", { name: "Request Profile Change" })).toHaveAttribute("href", "/employee/profile/change-request");
expect(screen.getByText("Certification / Training")).toBeVisible();
```

Add an empty record test and a document-link test that only renders a real stored document URL.

- [ ] **Step 2: Run the tests to verify RED**

Run: `npx vitest run src/components/personnel-records/employee-record-summary.test.tsx src/components/personnel-records/employee-profile.test.tsx`

Expected: FAIL because the Capstone layout and headings are absent.

- [ ] **Step 3: Implement the `empprof.html`-aligned presentation**

Use personnel data already visible to the employee; preserve profile-change requests, password changes, profile-photo permissions, government-ID management, and record-document access as currently authorized. Do not add employee writes to HR-owned record types unless existing policies support them.

- [ ] **Step 4: Run the focused tests to verify GREEN**

Run: `npx vitest run src/components/personnel-records/employee-record-summary.test.tsx src/components/personnel-records/employee-profile.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/(app)/employee/profile src/components/personnel-records
git commit -m "feat: redesign employee profile"
```

### Task 7: Convert employee leave to the Capstone portal and modal

**Files:**
- Modify: `src/app/(app)/employee/leave/page.tsx`
- Modify: `src/app/(app)/employee/leave/new/page.tsx`
- Modify: `src/components/leave-management/employee-leave.tsx`
- Modify: `src/components/leave-management/employee-leave.test.tsx`
- Create: `src/components/leave-management/employee-leave-request-modal.tsx`
- Create: `src/components/leave-management/employee-leave-request-modal.test.tsx`

**Interfaces:**
- Consumes: existing leave balances, requestable type and leave-request hooks/form validation.
- Produces: `EmployeeLeaveRequestModal({ open, onOpenChange })` and query-param compatible `?request=1` entry point.

- [ ] **Step 1: Write failing leave portal/modal tests**

```tsx
await user.click(screen.getByRole("button", { name: "Request New Leave" }));
expect(await screen.findByRole("dialog", { name: "File Leave Application" })).toBeVisible();
expect(screen.getByRole("tab", { name: "For Approval" })).toBeVisible();
expect(screen.getByText("Notes from HR: OK.")).toBeVisible();
```

Include finite/no-limit balances, filtered pending rows, required attachment/validation failures, cancellation, and request success tests.

- [ ] **Step 2: Run the tests to verify RED**

Run: `npx vitest run src/components/leave-management/employee-leave.test.tsx src/components/leave-management/employee-leave-request-modal.test.tsx`

Expected: FAIL because leave request is a separate page and history has no tabbed Capstone layout.

- [ ] **Step 3: Implement the leave cards, history view, and modal**

Keep existing leave calculations and schemas authoritative. Render accessible tabs/filter controls, responsive table/card behavior, word-form ranges, status colors plus text, and existing cancellation protections. Make `/employee/leave/new` redirect to the modal route or preserve it as an accessible route wrapper so old links remain valid.

- [ ] **Step 4: Run the focused tests to verify GREEN**

Run: `npx vitest run src/components/leave-management/employee-leave.test.tsx src/components/leave-management/employee-leave-request-modal.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/(app)/employee/leave src/components/leave-management
git commit -m "feat: redesign employee leave portal"
```

### Task 8: Redesign deployment cards and status filtering

**Files:**
- Modify: `src/app/(app)/employee/deployments/page.tsx`
- Modify: `src/components/deployment-tracking/employee-deployment-list.tsx`
- Modify: `src/components/deployment-tracking/employee-deployment-list.test.tsx`

**Interfaces:**
- Consumes: `useMyDeployments({ page, pageSize })` and existing report/proof component.
- Produces: a status-filterable `<EmployeeDeploymentList />` retaining pagination and report access.

- [ ] **Step 1: Write failing deployment tests**

```tsx
await user.selectOptions(screen.getByLabelText("Filter Status"), "ongoing");
expect(screen.getByText("Greenhills Area Deployment")).toBeVisible();
expect(screen.queryByText("Completed detail")).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "Report / Proof of Attendance" })).toBeVisible();
```

- [ ] **Step 2: Run the test to verify RED**

Run: `npx vitest run src/components/deployment-tracking/employee-deployment-list.test.tsx`

Expected: FAIL because the list has no status filter or approved card semantics.

- [ ] **Step 3: Implement deployment module/card rendering**

Add mockup-aligned module heading, status picker, accessible status labels, accent styling, word-form dates, notes, empty state, and pagination. Reuse `DeploymentReports`; do not expose create/edit controls to employees.

- [ ] **Step 4: Run the test to verify GREEN**

Run: `npx vitest run src/components/deployment-tracking/employee-deployment-list.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/(app)/employee/deployments src/components/deployment-tracking
git commit -m "feat: redesign employee deployments"
```

### Task 9: Merge face attendance into the Attendance page and remove Scan route

**Files:**
- Modify: `src/app/(app)/employee/attendance/page.tsx`
- Modify: `src/app/(app)/employee/attendance/scan/page.tsx`
- Modify: `src/components/attendance-integration/employee-attendance-list.tsx`
- Modify: `src/components/attendance-integration/employee-attendance-list.test.tsx`
- Modify: `src/components/face-recognition/employee-face-scan.test.tsx`
- Modify: `e2e/face-attendance.spec.ts`
- Modify: `e2e/iso25010-quality.spec.ts`

**Interfaces:**
- Consumes: existing employee face-scanner component and `useMyAttendanceLogs`.
- Produces: one attendance route with scan CTA/overlay or inline panel, safe redirect from `/employee/attendance/scan`, and a paginated live log view.

- [ ] **Step 1: Write failing attendance and redirect tests**

```tsx
expect(screen.getByRole("button", { name: "Scan Attendance Now" })).toBeVisible();
expect(screen.getByText("Attendance Logs")).toBeVisible();
await expect(page).toHaveURL(/\/employee\/attendance$/);
```

Include a test that closing/unmounting the scan UI calls the existing camera stop cleanup, and a log row maps late/present/incomplete/absent to text-bearing status badges.

- [ ] **Step 2: Run the tests to verify RED**

Run: `npx vitest run src/components/attendance-integration/employee-attendance-list.test.tsx src/components/face-recognition/employee-face-scan.test.tsx; npx playwright test e2e/face-attendance.spec.ts --config=playwright.local.config.ts`

Expected: FAIL because the standalone Scan page is still required and Attendance lacks the Capstone biometric panel.

- [ ] **Step 3: Implement the unified Attendance experience**

Place the scanner behind the redesigned CTA in `/employee/attendance`, preserve enrollment/permission errors and cleanup, render today in words, and redesign logs with time-in/time-out and accessible status cards. Make the old scan route redirect rather than retain a second page wrapper; remove it from role navigation and protected-route assertions.

- [ ] **Step 4: Run the focused tests to verify GREEN**

Run: `npx vitest run src/components/attendance-integration/employee-attendance-list.test.tsx src/components/face-recognition/employee-face-scan.test.tsx`

Expected: PASS. E2E runs after the single build/server in Task 11.

- [ ] **Step 5: Commit**

```powershell
git add src/app/(app)/employee/attendance src/components/attendance-integration src/components/face-recognition e2e/face-attendance.spec.ts e2e/iso25010-quality.spec.ts
git commit -m "feat: redesign employee attendance"
```

### Task 10: Build the promotion-status screen and docket modal

**Files:**
- Modify: `src/app/(app)/employee/promotion-eligibility/page.tsx`
- Modify: `src/components/promotion-eligibility/employee-promotion-eligibility.tsx`
- Modify: `src/components/promotion-eligibility/employee-promotion-eligibility.test.tsx`
- Create: `src/components/promotion-eligibility/employee-promotion-docket-modal.tsx`
- Create: `src/components/promotion-eligibility/employee-promotion-docket-modal.test.tsx`

**Interfaces:**
- Consumes: Task 4 `useMyPromotionEligibility()` result and `useSubmitEmployeePromotionDocket()`.
- Produces: live readiness checklist/progress and `<EmployeePromotionDocketModal criterionId targetRankName />`.

- [ ] **Step 1: Write failing promotion screen and modal tests**

```tsx
expect(await screen.findByText("Promotion Status")).toBeVisible();
expect(screen.getByText("Police Corporal")).toBeVisible();
expect(screen.getByText("Missing Requirements")).toBeVisible();
await user.click(screen.getByRole("button", { name: "Submit to Promotion Board" }));
await user.click(screen.getByRole("button", { name: "Submit Application" }));
expect(screen.getByText("Enter your remarks before submitting.")).toBeVisible();
```

Add ready, not-ready, no-active-criterion, submitted-docket, and mutation-error states. Assert unmet checklist rows expose `NOT MET` text rather than relying solely on a rose color.

- [ ] **Step 2: Run the tests to verify RED**

Run: `npx vitest run src/components/promotion-eligibility/employee-promotion-eligibility.test.tsx src/components/promotion-eligibility/employee-promotion-docket-modal.test.tsx`

Expected: FAIL because the old screen only shows generic target/years/missing requirements and cannot submit.

- [ ] **Step 3: Implement the rank-aware promotion view**

Render the `empromote.html` overview, criterion cards, missing-requirements panel, and docket modal from real RPC fields. Submit only through Task 4’s mutation, show its success/error state, and replace submit controls with the submitted state when a docket exists. Keep the disclaimer that readiness is not an automatic promotion decision.

- [ ] **Step 4: Run the focused tests to verify GREEN**

Run: `npx vitest run src/components/promotion-eligibility/employee-promotion-eligibility.test.tsx src/components/promotion-eligibility/employee-promotion-docket-modal.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/(app)/employee/promotion-eligibility src/components/promotion-eligibility
git commit -m "feat: redesign employee promotion status"
```

### Task 11: Add employee E2E, responsive, accessibility, and visual coverage

**Files:**
- Modify: `e2e/demo-accounts.ts`
- Modify: `e2e/responsive-layout.spec.ts`
- Modify: `e2e/iso25010-quality.spec.ts`
- Modify: `e2e/business-journeys.spec.ts`
- Modify: `e2e/capstone-objectives.spec.ts`
- Modify: `e2e/applicant-visual-baseline.spec.ts`
- Create/update only reviewed employee visual snapshots under `e2e/applicant-visual-baseline.spec.ts-snapshots/`

**Interfaces:**
- Consumes: final routes/components from Tasks 1-10 and local Playwright server configuration.
- Produces: employee route coverage, 9px employee floor checks, accessible dialogs/controls, and reviewed visual baselines.

- [ ] **Step 1: Write failing E2E expectations**

```ts
await page.goto("/login?as=employee");
await expect(page.getByRole("heading", { name: "Employee / HR" })).toBeVisible();
await signIn(page, EMPLOYEE.email, EMPLOYEE.home);
await page.getByRole("button", { name: "Scan Attendance Now" }).click();
await expect(page.getByText("Record Attendance with Face Verification")).toBeVisible();
```

Add employee pages to the 9px responsive set at desktop and phone widths, axe checks for all six routes plus leave/docket dialogs, HR/SysAd badge-login regression coverage, and employee style signatures/screenshots.

- [ ] **Step 2: Build once and run each changed E2E file to verify RED**

Run: `npm run build`

Run: `npm run start -- --hostname 127.0.0.1 --port 3000`

In a second terminal, run each individually:

```powershell
npx playwright test e2e/responsive-layout.spec.ts --config=playwright.local.config.ts
npx playwright test e2e/iso25010-quality.spec.ts --config=playwright.local.config.ts
npx playwright test e2e/business-journeys.spec.ts --config=playwright.local.config.ts
npx playwright test e2e/capstone-objectives.spec.ts --config=playwright.local.config.ts
npx playwright test e2e/face-attendance.spec.ts --config=playwright.local.config.ts
npx playwright test e2e/applicant-visual-baseline.spec.ts --config=playwright.local.config.ts
```

Expected: FAIL on the new assertions or only visual mismatches; inspect every mismatch before a snapshot update.

- [ ] **Step 3: Implement only the test-support changes and review visual output**

Update shared sign-in helpers for the new employee heading and allowed privileged badge path. Keep `/login?as=admin` selectors unchanged. Regenerate only employee baseline artifacts after comparing actual page screenshots/style JSON to the approved mockups; copy cross-platform snapshots only when the normalized output matches.

- [ ] **Step 4: Re-run each changed E2E spec one at a time to verify GREEN**

Run the six commands from Step 2 again, one after another while the built server is running.

Expected: PASS with no unexpected screenshot updates.

- [ ] **Step 5: Commit**

```powershell
git add e2e
git commit -m "test: cover employee capstone redesign"
```

### Task 12: Final regression verification, review, and PR delivery

**Files:**
- Modify only if verification identifies a scoped defect: affected production code and its RED/GREEN test.
- Create: PR description with manual local-to-live migration steps and the PR 4 SysAd prompt.

**Interfaces:**
- Consumes: all completed tasks and the untracked local Playwright configuration.
- Produces: verified branch and one PR targeting `main`.

- [ ] **Step 1: Run lint, typecheck, and Vitest in memory-safe halves**

Run:

```powershell
npm run lint
npm run typecheck
npx vitest run src/app src/components src/hooks src/lib src/queries src/schemas
npx vitest run --exclude 'src/app/**' --exclude 'src/components/**' --exclude 'src/hooks/**' --exclude 'src/lib/**' --exclude 'src/queries/**' --exclude 'src/schemas/**'
```

Expected: PASS. If the repository defines a safer existing split, use it instead and document the two commands in the PR.

- [ ] **Step 2: Reset local database and run all database tests**

Run: `npx supabase db reset; npx supabase test db`

Expected: PASS. Do not run a live link, push, or production migration command.

- [ ] **Step 3: Rebuild and repeat affected E2E/visual checks**

Run: `npm run build`, start `npm run start -- --hostname 127.0.0.1 --port 3000`, then execute each affected Playwright file separately with `--config=playwright.local.config.ts`.

Expected: PASS.

- [ ] **Step 4: Inspect branch state and request a fresh code review**

Run: `git status --short; git diff main...HEAD --check; git log --oneline main..HEAD`

Expected: only intentional tracked changes; do not stage `playwright.local.config.ts` or any temporary output. Resolve review findings with fresh RED -> GREEN tests and commits.

- [ ] **Step 5: Push and open exactly one PR into `main`**

The PR description must include: summary of employee redesign; migration files; exact manual post-merge/live deployment steps; confirmation that no live Supabase migration was pushed; test commands/results; and the ready-to-paste PR 4 SysAd prompt naming `sysad.html` and PDF page 49. Attach the created PR to the chat.

## Plan Self-Review

- **Spec coverage:** Tasks 1-2 cover shell/navigation/login; Tasks 5-10 cover every employee mockup and the removed Scan page; Tasks 3-4 cover rank filtering, dockets, RLS, login resolution and notification; Tasks 11-12 cover required verification and PR delivery.
- **Step scan:** Every task begins with a concrete failing assertion, runs it RED, names the implementation interface, runs GREEN, and commits a scoped deliverable.
- **Type consistency:** Task 3 defines `submit_employee_promotion_docket`, Task 4 exposes `submitEmployeePromotionDocket`/`useSubmitEmployeePromotionDocket`, and Task 10 consumes only that hook. Task 3 remains the sole authority on caller identity and rank matching.
- **Review Focus:** Each listed failure mode has a dedicated owning task and test requirement.
- **Proportion:** The plan fixes interfaces, files, exact behavior, test commands, and commits without embedding implementation bodies.
