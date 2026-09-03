# Profile Completion and Account Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete secure optional employee photos, simplify self-service changes, add HR training edit/delete controls, and consolidate duplicated Users/Roles administration into one account-management workspace.

**Architecture:** Keep the existing Next.js client-query/TanStack Query pattern. Profile photos stay in the private Storage bucket and a narrow RPC updates only the linked employee's image path. `/admin/users` is the visible Account management page; `/admin/roles` redirects to it.

**Tech Stack:** Next.js 16, React, TypeScript, TanStack Query, Supabase JS/Postgres RLS/Storage, Zod, Vitest, Testing Library, pgTAP.

**Spec:** `docs/superpowers/specs/2026-09-03-profile-completion-account-management-design.md`

## Global Constraints

- Keep `employee-profile-photos` private; never expose a service-role credential or public URL.
- The photo-path RPC must use a pinned empty `search_path`, schema-qualified relations, caller/path validation, and restricted execute privileges.
- Employee self-service supports only email, phone, emergency-contact name, and emergency-contact phone.
- Administrators remain read-only for employee records; `/admin/roles` must preserve legacy links via redirect.
- Each behavior change follows red-green TDD before production implementation.

---

### Task 1: Consolidate Users and Roles

**Files:**
- Modify: `src/lib/app/role-config.ts`
- Modify: `src/lib/app/role-config.test.ts`
- Modify: `src/app/(app)/admin/page.tsx`
- Modify: `src/app/(app)/admin/users/page.tsx`
- Modify: `src/app/(app)/admin/roles/page.tsx`
- Modify: `src/components/administration/administration-workspaces.tsx`
- Modify: `src/components/administration/administration-workspaces.test.tsx`

**Interfaces:** Reuse `UsersWorkspace`. The Admin navigation exposes `{ href: "/admin/users", label: "Account management" }`; the legacy roles page calls `redirect("/admin/users")`.

- [ ] Write failing tests that the sidebar has Account management, has no `/admin/roles` item, and the roles page redirects.
- [ ] Run `npm run test:run -- src/lib/app/role-config.test.ts src/components/administration/administration-workspaces.test.tsx`; expect the old navigation/page behavior to fail.
- [ ] Replace the two Administrator navigation/dashboard cards with Account management, update the Users page heading, and implement the server-side legacy redirect. Keep invitation, role/status edit, delete, and linked employee `View profile` actions in the single workspace.
- [ ] Re-run the focused tests; expect pass.
- [ ] Commit with `git commit -m "feat: consolidate account management"`.

### Task 2: Remove unsupported Address changes and stabilize the leave cleanup test

**Files:**
- Modify: `src/schemas/profile-change-requests.ts`
- Modify: `src/schemas/profile-change-requests.test.ts`
- Modify: `src/components/profile-change-requests/profile-change-request-form.tsx`
- Modify: `src/components/profile-change-requests/profile-change-request-form.test.tsx`
- Modify: `src/queries/leave-management.test.ts`

**Interfaces:** `profileChangeContactChangeSchema` accepts only `personalEmail`, `phone`, `emergencyContactName`, and `emergencyContactPhone`. The server RPC retains the Address rejection as defense in depth.

- [ ] Write a failing schema test that `{ kind: "contact", field: "address", originalValue: null, requestedValue: "X" }` is rejected; write a form test that no Address textbox renders and all four supported inputs remain.
- [ ] Run `npm run test:run -- src/schemas/profile-change-requests.test.ts src/components/profile-change-requests/profile-change-request-form.test.tsx`; expect failure because Address is currently accepted/rendered.
- [ ] Remove Address from the contact-field tuple and rendered field mapping. Update the form's no-change error copy if necessary.
- [ ] Replace the fixed 2026-08-28 leave dates with `new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)` in the cleanup test so validation always reaches the intended RPC-failure path.
- [ ] Re-run the three focused tests including `src/queries/leave-management.test.ts`; expect pass.
- [ ] Commit with `git commit -m "fix: restrict profile changes to supported contacts"`.

### Task 3: Secure photo data flow

**Files:**
- Create: generated `supabase/migrations/*_employee_profile_photo_updates.sql`
- Modify: `supabase/tests/personnel_records.test.sql`
- Modify: `src/schemas/personnel-records.ts`
- Modify: `src/schemas/personnel-records.test.ts`
- Modify: `src/queries/personnel-records.ts`
- Modify: `src/queries/personnel-records.test.ts`
- Modify: `src/hooks/use-personnel-records.ts`
- Modify: `src/lib/query-keys.ts`

**Interfaces:** Create `profilePhotoFileSchema`, `getEmployeeProfilePhotoUrl(path)`, `replaceMyEmployeeProfilePhoto(employee, file)`, and `removeMyEmployeeProfilePhoto(employee)`. Mutations invalidate the current employee profile query.

- [ ] Write pgTAP tests proving a linked employee can set only `employees/<own-employee-id>/<uuid>.(png|jpg|jpeg|webp)`, cannot set another employee's or malformed path, and Administrators remain read-only. Write Vitest tests for accepted <=5 MiB image types, signed URL retrieval, and upload → RPC → previous object deletion ordering.
- [ ] Run `npx supabase test db supabase/tests/personnel_records.test.sql` and `npm run test:run -- src/schemas/personnel-records.test.ts src/queries/personnel-records.test.ts`; expect failure because the contract does not yet exist.
- [ ] Generate the migration with `npx supabase migration new employee_profile_photo_updates`. Implement `public.update_my_employee_profile_image_path(target_path text)` as `security definer set search_path = ''`: schema-qualify `auth.uid()` and `public.employees`, find only the caller's link, validate the exact owned path, update only `profile_image_path`, use SQLSTATE `42501` for denied paths, revoke `public`/`anon`, and grant `authenticated`.
- [ ] Implement the Zod file validation and browser query functions. Use `storage.from("employee-profile-photos")`, `createSignedUrl(path, 60)`, generated UUID paths, `upload(..., { upsert: false })`, the RPC, and old-object deletion only after RPC success. Never write to `storage.objects` directly.
- [ ] Re-run the focused SQL and Vitest tests; expect pass.
- [ ] Commit with `git commit -m "feat: secure employee profile photos"`.

### Task 4: Render and manage optional photos from My profile

**Files:**
- Create: `src/components/personnel-records/employee-profile-photo-control.tsx`
- Create: `src/components/personnel-records/employee-profile-photo-control.test.tsx`
- Modify: `src/components/personnel-records/employee-profile.tsx`
- Modify: `src/components/personnel-records/employee-profile.test.tsx`
- Modify: `src/components/personnel-records/employee-record-summary.tsx`

**Interfaces:** `EmployeeProfile` accepts optional `photoUrl` and `canManagePhoto`; `EmployeeRecordSummary` supplies `true`, while the Admin profile keeps the default false.

- [ ] Write failing component tests for initials fallback, signed image rendering with accessible alt text, rejected file feedback before mutation, and the absence of photo controls in an Admin/read-only profile.
- [ ] Run `npm run test:run -- src/components/personnel-records/employee-profile.test.tsx src/components/personnel-records/employee-profile-photo-control.test.tsx`; expect failure because the control and image path do not exist.
- [ ] Implement a client-only photo control with labelled input, upload/replace/remove actions, pending/error/warning feedback, and the Task 3 mutations. Render `AvatarImage` only for a signed URL and preserve `AvatarFallback`. Remove first clears the approved database path, then attempts Storage cleanup.
- [ ] Re-run focused component tests; expect pass.
- [ ] Commit with `git commit -m "feat: add employee profile photo controls"`.

### Task 5: Manage existing training records in HR

**Files:**
- Modify: `src/components/personnel-records/record-entry-form.tsx`
- Create: `src/components/personnel-records/record-entry-form.test.tsx`
- Modify: `src/components/personnel-records/employee-record-detail.tsx`
- Create: `src/components/personnel-records/employee-record-detail.test.tsx`

**Interfaces:** Use existing `useSavePersonnelEntry("training", employeeId)` and `useDeletePersonnelEntry("training", employeeId)`. `RecordEntryForm` receives an optional `TrainingRecord` to prefill/update one entry.

- [ ] Write failing tests that existing training rows expose Edit/Delete, Edit pre-fills course/provider/date/expiry/hours/notes and saves the entry ID, and Delete opens a confirmation dialog before its mutation.
- [ ] Run `npm run test:run -- src/components/personnel-records/record-entry-form.test.tsx src/components/personnel-records/employee-record-detail.test.tsx`; expect failure because existing entries have no controls.
- [ ] Extend the record form with a training edit mode and Notes textarea. In employee detail, add training-only Edit/Delete buttons and use the existing form panel/dialog pattern for deletion confirmation. Call save with `{ input, id }` and delete with the training id; do not broaden edit/delete UI for unrelated record kinds.
- [ ] Re-run focused tests; expect pass.
- [ ] Commit with `git commit -m "feat: manage existing training records"`.

### Task 6: Update documentation and run release verification

**Files:**
- Modify: `docs/user-guides/hris-role-user-guide.md`
- Modify: `docs/reviews/2026-09-03-employee-profile-implementation-review.md`

**Interfaces:** Documentation reflects the completed photo flow, Account management page, supported contact fields, and training edit/delete controls.

- [ ] Update the tutor and review to remove resolved limitation notices and describe the final user-facing paths.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run test:run`, `npx supabase test db`, and `npm run build`; expect every command to pass.
- [ ] Commit with `git commit -m "docs: update completed profile workflows"`.
