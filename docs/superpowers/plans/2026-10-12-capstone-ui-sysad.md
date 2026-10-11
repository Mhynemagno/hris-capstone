# System Administrator Capstone UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Redesign all authoritative System Administrator screens in the Capstone staff UI while preserving roles, data hooks, authorization, and audit behavior.

**Architecture:** Keep SysAd on StaffShell and change only its role configuration and route metadata. Convert the dashboard and established administration workspaces to staff presentation building blocks while retaining hooks, query URLs, protected mutations, and requireRole("system_administrator"). No database schema, RPC, or migration change is part of this work.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Lucide, TanStack Query, React Hook Form/Zod, Vitest, Testing Library, Supabase client hooks, Playwright.

**Spec:** docs/superpowers/specs/2026-10-12-capstone-ui-sysad-design.md

## Global Constraints

- Work only on codex/capstone-ui-sysad, based directly on main; do not affect the employee worktree or branch.
- Reuse StaffShell; add no shell, role, or SysAd links to HR-only modules.
- Preserve .capstone-ui, Lucide, police logo, slate-500 light captions, slate-400 dark sidebar labels, word-form dates, no stock people images, and the 9px font floor.
- Keep the two login modes exactly as specified; retain all current /admin routes and the SysAd role guard.
- Reuse PageTitle, StatusPill, StaffPager, StaffModal, staffButton, and ui/staff-fields.
- Never render a definitive empty state or 0 of 0 pager while a query loads or errors; surface mutation errors.
- No migration, live Supabase change, or fake/non-persisted justification field. Never stage playwright.local.config.ts.
- Hold database reset/tests, production server, and Playwright until the user explicitly authorizes them.

## Review Focus

- Preserve the current SysAd-only layout guard; cover it with a Task 2 route regression.
- A first-list query failure must be retryable, not an empty state or 0 of 0; cover it in Task 4.
- A successful zero-row result has no pager; cover it in Task 4.
- Failed account, settings, integration, and approval mutations remain visible; cover them in Tasks 4–5.
- At 375px, 768px, 1024px, and 1440px, sidebar, cards, filters, dialogs, and tables remain usable; inspect after runtime authorization in Task 6.

---

## File structure

- src/lib/app/role-config.ts: SysAd mockup-matched navigation.
- src/components/staff-shell/page-meta.ts: SysAd header subtitle and redesigned-route membership.
- src/components/staff-shell/staff-shell.test.tsx, src/components/staff-shell/page-meta.test.ts, src/lib/app/role-config.test.ts: shell regressions.
- src/app/(app)/admin/page.tsx and page.test.tsx: page-49 dashboard.
- src/components/administration/admin-page.tsx: shared PageTitle wrapper.
- src/components/administration/administration-workspaces.tsx: admin tables/forms/dialogs and safe list-state behavior.
- src/components/administration/administration-workspaces.test.tsx: visual, loading/error/empty, pager, and mutation contracts.
- src/app/(app)/admin/integrations/attendance/page.tsx and attendance-integration-settings.tsx: integration presentation.
- src/app/(app)/admin/profile-change-requests/page.tsx and admin-profile-change-request-queue.tsx: approval queue presentation.

### Task 1: Establish SysAd navigation and StaffShell metadata

**Files:**
- Modify: src/lib/app/role-config.ts and src/lib/app/role-config.test.ts
- Modify: src/components/staff-shell/page-meta.ts, page-meta.test.ts, and staff-shell.test.tsx

**Interfaces:**
- Consumes: RoleConfig.navigation, staffPageSubtitle(pathname), and isRedesignedStaffRoute(pathname).
- Produces: SysAd navigation used unchanged by StaffShell and /admin metadata used by its header/canvas.

- [ ] **Step 1: Write failing navigation and metadata tests**

Require Dashboard; People and Access (Manage Accounts, Review Approvals); Station Organization (Units and Sections, Units and Stations, Ranks); and System Oversight (Attendance Integration, Audit Log, System Settings). Assert no HR operational paths, the SysAd subtitle, redesigned status, active link, and slate-400 group-label class.

- [ ] **Step 2: Run RED**

Run: npm run test:run -- src/lib/app/role-config.test.ts src/components/staff-shell/page-meta.test.ts src/components/staff-shell/staff-shell.test.tsx

Expected: FAIL because SysAd still has the old configuration and no admin route metadata.

- [ ] **Step 3: Implement the role metadata**

Update only the system_administrator navigation labels/groups/icons and preserve its current hrefs. Add /admin route prefixes to SUBTITLES and every authoritative SysAd screen to REDESIGNED.

- [ ] **Step 4: Run GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

Commit the listed role-config and shell files with: feat: align SysAd shell navigation with Capstone UI.

### Task 2: Rebuild /admin as the page-49 control grid

**Files:**
- Modify: src/app/(app)/admin/page.tsx and page.test.tsx
- Regression only: src/app/(app)/admin/layout.tsx

**Interfaces:**
- Consumes: PageTitle, Lucide icons, and the existing eight /admin hrefs.
- Produces: a stateless dashboard linking to—not replacing—authoritative admin workspaces.

- [ ] **Step 1: Write a failing dashboard test**

Require h1 System Administration, its approved caption, the three card titles, all eight labelled routes, audit-trail informational copy, and no Administrator Remarks / Log Justification field/modal.

- [ ] **Step 2: Run RED**

Run: npm run test:run -- src/app/(app)/admin/page.test.tsx

Expected: FAIL because the legacy heading/card presentation does not match the approved dashboard.

- [ ] **Step 3: Implement the dashboard**

Use PageTitle, white rounded-2xl cards, slate borders, tinted Lucide icon blocks, text-xs action labels, and slate-500 descriptions. Keep action rows as existing-route Link elements and omit the generic mockup modal.

- [ ] **Step 4: Run GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Verify authority and commit**

Run focused admin route/redirect tests; expect PASS and no changed AdminLayout or roles redirect. Commit with: feat: add Capstone SysAd control dashboard.

### Task 3: Convert shared administration chrome and collection states

**Files:**
- Modify: src/components/administration/admin-page.tsx
- Modify: src/components/administration/administration-workspaces.tsx and administration-workspaces.test.tsx
- Modify if needed: src/components/administration/paginated-table-controls.tsx

**Interfaces:**
- Consumes: current administration hooks/mutations and named staff building blocks.
- Produces: unchanged UsersWorkspace, DepartmentsWorkspace, UnitStationsWorkspace, RanksWorkspace, SettingsWorkspace, and AuditLogsWorkspace behavior with Capstone presentation.

- [ ] **Step 1: Write failing workspace-state tests**

Assert AdminPage uses PageTitle. Assert first loading retains usable filters/actions but has no empty message/pager; error displays retry/error and no empty message/pager; successful zero rows displays empty state without pager; populated results use a staff range pager. Assert active/inactive StatusPill text and centered StaffModal form flows.

- [ ] **Step 2: Run RED**

Run: npm run test:run -- src/components/administration/administration-workspaces.test.tsx

Expected: FAIL because legacy pagination emits a zero pager and legacy cards/panels remain.

- [ ] **Step 3: Implement the shared conversion**

Make AdminPage render PageTitle. Replace presentation-only cards, tables, buttons, fields, and dialogs with staff primitives. Preserve hook arguments, URL filters, Zod forms, mutations, success messaging, retries, and delete behavior. Pass StaffPager only after a successful non-empty query.

- [ ] **Step 4: Run GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Verify hook contracts and commit**

Run: npm run test:run -- src/hooks/use-administration.test.tsx src/components/administration/administration-workspaces.test.tsx

Expected: PASS. Commit with: feat: restyle SysAd administration workspaces.

### Task 4: Apply presentation-only conversions to specialized SysAd flows

**Files:**
- Modify: src/app/(app)/admin/integrations/attendance/page.tsx and src/components/attendance-integration/attendance-integration-settings.tsx
- Modify: src/app/(app)/admin/profile-change-requests/page.tsx and src/components/profile-change-requests/admin-profile-change-request-queue.tsx
- Test: nearest existing component tests, creating a focused test only if absent.

**Interfaces:**
- Consumes: current integration hooks and the protected profile-change decision path.
- Produces: identical settings saves and approval decisions in Capstone PageTitle, table, modal, and field presentation.

- [ ] **Step 1: Write failing interaction/error tests**

Require attendance and approvals titles/captions and staff-style controls. Mock a failed integration save and a failed request decision, asserting each error remains visible. Cover loading/error/empty boundaries without an empty state or zero pager during loading/error.

- [ ] **Step 2: Run RED**

Run the exact focused attendance-settings and profile-change queue test files. Expected: FAIL because the Capstone wrappers/state contracts do not yet exist.

- [ ] **Step 3: Implement only presentation changes**

Wrap routes in PageTitle and use staff controls for fields, actions, tables, and detail dialogs. Retain every hook, validation rule, protected mutation, retry, URL, and error path. Do not grant SysAd operational attendance access or create an audit-justification field.

- [ ] **Step 4: Run GREEN and commit**

Rerun Step 2; expected PASS. Commit with: feat: apply Capstone UI to SysAd oversight workflows.

### Task 5: Route regression and static quality

**Files:**
- Modify only if exposed by a regression: src/app/(app)/admin/{users,roles,ranks,departments,unit-stations,settings,audit-logs}/page.tsx
- Test: associated existing route/component tests.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: each authoritative SysAd route retains its redirect, guard, read-only rule, and representative action.

- [ ] **Step 1: Add missing route regressions**

Cover Accounts, roles redirect, Ranks, Units/Sections, Units/Stations, Settings, and Audit Log with their Capstone heading/caption and one existing action/readonly rule each.

- [ ] **Step 2: RED, minimal change, GREEN**

Run each new route test independently and observe failure. Apply only the wrapper/presentation change required, never altering AdminLayout, hooks, schemas, Supabase clients, or roles. Rerun and expect PASS.

- [ ] **Step 3: Run static and memory-safe test checks**

Run npm run lint and npm run typecheck; then two file-list halves of Vitest discovered from project scripts and rg --files -g *.test.ts* src. Report every failure including baseline failures.

- [ ] **Step 4: Commit**

Commit final route corrections with: test: cover SysAd Capstone route regressions.

### Task 6: User-authorized production-like and visual verification

**Files:**
- Modify visual baselines only after manual review confirms an intentional change.
- Never add: playwright.local.config.ts

**Interfaces:**
- Consumes: built app and untracked local Playwright config.
- Produces: production-server, database, E2E, accessibility, and visual evidence.

- [ ] **Step 1: Obtain explicit authorization**

Do not run database reset/tests, a server, or Playwright until the user lifts the current hold.

- [ ] **Step 2: Database verification after authorization**

Run npx supabase db reset, then npx supabase test db. Expected: PASS; report baseline failures despite no migration.

- [ ] **Step 3: Build and run one production server after authorization**

Run npm run build; then npm run start -- --hostname 127.0.0.1 --port 3000. Expected: one successful build and localhost listener.

- [ ] **Step 4: Run affected Playwright specs one file at a time**

Use the preserved local config for SysAd role access, responsive layout, accessibility/quality, and visual specs. Never use webServer/multiple workers.

- [ ] **Step 5: Review responsive visual output**

Inspect restyled routes at 375px, 768px, 1024px, and 1440px. Update PNG/style baselines only after diff review confirms intentional Capstone changes.

- [ ] **Step 6: Final delivery review**

Run git diff --check and git status --short; verify no migration and no tracked local Playwright config. Open one PR to main, explaining no live Supabase action and summarizing all four UI PRs plus follow-ups.
