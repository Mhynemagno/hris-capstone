# Attendance, Login, and Employee-save Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let consented personnel use kiosk face attendance without an account, allow HR and system administrators to use the HR / Employee portal with an email or badge number, and show a clear duplicate-badge error.

**Architecture:** Remove the account-link condition only from HR face enrollment; public kiosk recognition continues to use the existing enrollment table, and the HR authorization, consent, descriptor validation, and similarity safeguards remain unchanged. Reuse the existing employee-login identifier shape for both portal modes, then map the database's employee-number uniqueness violation at the client query boundary.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/Postgres, Vitest, pgTAP.

**Spec:** User request in this conversation (2026-10-12).

## Global Constraints

- A face enrollment still requires an existing personnel record, explicit consent, a valid descriptor, and an HR caller. A linked but deactivated account remains blocked.
- No service-role key or privileged credential may reach browser code.
- Portal login must retain the authenticated account's actual role and continue through `/auth/continue` to the role-specific home.
- Raw database constraint names must never be shown to the employee-record form user.

## Review Focus

- An active employee with no linked profile can enroll and be recognized through the kiosk.
- An employee whose profile is deactivated remains blocked from login; this change does not weaken account deactivation.
- HR and SysAd email logins submitted from the HR / Employee portal authenticate and redirect through the existing role-aware continuation flow.
- Badge-number login continues to resolve only active, linked internal personnel as already enforced by the RPC.
- A duplicate `employees_employee_number_key` result maps to a helpful badge-number message while an unrelated database error remains visible to the caller's generic error handler.

### Task 1: Make face enrollment independent of a linked login account

**Files:**
- Create: `supabase/migrations/<generated>_allow_unlinked_face_enrollment.sql`
- Modify: `supabase/tests/face_recognition_attendance.test.sql:6,79-83`

**Interfaces:**
- Consumes: `public.enroll_employee_face(uuid, real[], integer, boolean)`.
- Produces: The same JSON result for an active unlinked employee as for a linked employee.

- [x] **Step 1: Write the failing pgTAP assertion**

Replace the expectation that `FACE-004` enrollment throws with an assertion that it returns status `enrolled`; increase the pgTAP plan by one only if the test count changes.

- [ ] **Step 2: Run the focused database test to verify it fails**

Run: `npx supabase test db supabase/tests/face_recognition_attendance.test.sql`

Expected: FAIL because the current RPC raises the linked-account exception.

- [x] **Step 3: Create the generated migration**

Redefine only `private.enroll_employee_face` so it removes the linked-profile / `is_active` lookup and leaves the personnel existence, consent, descriptor, HR authorization, locking, similarity, audit, and upsert logic intact.

- [ ] **Step 4: Run the focused database test to verify it passes**

Run: `npx supabase test db supabase/tests/face_recognition_attendance.test.sql`

Expected: PASS.

### Task 2: Accept email or badge identifiers in the HR / Employee portal

**Files:**
- Modify: `src/schemas/auth.ts:loginIdentifierSchema`
- Modify: `src/schemas/auth.test.tsx`
- Modify: `src/components/auth/login-form.tsx:EmployeeFields`
- Modify: `src/app/auth/login/route.test.ts`

**Interfaces:**
- Consumes: a portal identifier and password from the existing `/auth/login` POST form.
- Produces: `{ kind: "email" | "badge_number", value: string }` for employee-portal credentials.

- [x] **Step 1: Write failing schema and route tests**

Assert that employee-mode schema lowercases an email and that an `as=employee` POST signs in an HR/SysAd email directly rather than rejecting it before `signInWithPassword`.

- [x] **Step 2: Run the focused tests to verify they fail**

Run: `npm run test:run -- src/schemas/auth.test.ts src/app/auth/login/route.test.ts`

Expected: FAIL because employee mode currently parses all identifiers as badge numbers.

- [x] **Step 3: Reuse the email-or-badge identifier parser for employee mode**

Keep applicant parsing unchanged. Update the Employee portal field copy, input type, autocomplete and placeholder to state that users may enter an email address or badge number.

- [x] **Step 4: Run the focused tests to verify they pass**

Run: `npm run test:run -- src/schemas/auth.test.ts src/app/auth/login/route.test.ts src/components/auth/auth-forms.test.tsx`

Expected: PASS.

### Task 3: Translate duplicate employee badge errors

**Files:**
- Modify: `src/queries/personnel-records.ts:saveEmployee`
- Modify: `src/queries/personnel-records.test.ts`

**Interfaces:**
- Consumes: Supabase's `23505` employee-number unique constraint response.
- Produces: `Error("This badge number is already assigned to another employee.")`.

- [x] **Step 1: Write the failing query test**

Mock the employee insert response with `code: "23505"` and message containing `employees_employee_number_key`, then assert the user-facing badge-number error.

- [x] **Step 2: Run the focused query test to verify it fails**

Run: `npm run test:run -- src/queries/personnel-records.test.ts`

Expected: FAIL because the raw constraint message is currently rethrown.

- [x] **Step 3: Add the narrow error translation**

Map only the known employee-number uniqueness constraint; retain the existing personal-email mapping and generic error behavior for all other failures.

- [x] **Step 4: Run the focused query test to verify it passes**

Run: `npm run test:run -- src/queries/personnel-records.test.ts`

Expected: PASS.

### Task 4: Verify and document the shipped behavior

**Files:**
- Modify: `docs/HRIS_WORKFLOWS.md` only if a search finds the removed linked-account requirement documented.

**Interfaces:**
- Consumes: the implemented database and portal behavior.
- Produces: a current test suite, typecheck, lint, build, and review evidence.

- [x] **Step 1: Search authoritative documentation for the old linked-account requirement**

Run: `rg -n -i "active linked account|linked account.*face|face attendance.*account" README.md docs src supabase`

- [x] **Step 2: Update only authoritative documentation that promises the removed condition**

- [ ] **Step 3: Run focused tests, the full Vitest suite, database tests, typecheck, lint, and production build**

- [ ] **Step 4: Commit the implementation and request an independent read-only code review**

