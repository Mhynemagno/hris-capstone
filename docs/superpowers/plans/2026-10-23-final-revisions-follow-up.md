# Final Revisions Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the supplied final-revisions feedback without deleting personnel records or allowing invalid deployment assignments.

**Architecture:** Restore the existing `retired` enum value in the Personnel form, filter NUP and already assigned personnel out of the Deployment picker, and enforce the same deployment rule inside the HR-only database RPC. Reshape Leave report data and its downloadable PDF into the requested numbered table while preserving role checks and the existing filters.

**Tech Stack:** Next.js 16 / React 19, TypeScript, Vitest, Supabase PostgreSQL / pgTAP, PDF byte-stream generator.

**Spec:** `C:\Users\ASUS\Downloads\Final Revisions  (1).pdf`

## Global Constraints

- Personnel status values are exactly `active` and `retired`; HR changes the status instead of deleting a record.
- Deployment must reject NUP personnel and any person with a scheduled or ongoing assignment.
- Leave reports show Number, Rank, Name, Badge Number, Leave Type, and Status; the downloadable PDF must not include a generated timestamp and must use visible table lines.
- The IPER prompt has no new scoring policy: retain the existing supervisor-entered adjectival rating for a period of at most six months.
- Preserve existing RLS, role validation, audit logging, and function execute grants.

## Review Focus

- A saved retired employee must be changeable back to Active and submit the selected value.
- NUP must be absent from the picker and rejected by the database if sent directly.
- A scheduled/ongoing assignment must exclude its employee regardless of date overlap; completed and cancelled assignments must not.
- The Leave table’s number must remain sequential after filtering and pagination.
- Wrapped PDF values must remain inside table cells and never overlap the footer.

---

### Task 1: Restore the Personnel Status selector

**Files:**
- Modify: `src/components/personnel-records/employee-form.tsx`
- Modify: `src/components/personnel-records/employee-form.test.tsx`

**Interfaces:**
- Consumes: `Employee["employment_status"]` and `EmployeeInput["employmentStatus"]`.
- Produces: a required native select offering Active and Retired for new and saved records.

- [x] **Step 1: Write failing form tests**

Assert both Active and Retired options are available and a saved Retired record can select Active before submission.

- [x] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:run -- src/components/personnel-records/employee-form.test.tsx`
Expected: the selector contains only Active or is disabled.

- [x] **Step 3: Render the shared selectable status field**

Use the employee’s saved status as the default and preserve the existing `employmentStatus` form field name.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `npm run test:run -- src/components/personnel-records/employee-form.test.tsx`
Expected: PASS.

### Task 2: Enforce deployable-person eligibility

**Files:**
- Modify: `src/queries/deployment-tracking.ts`
- Modify: `src/queries/deployment-tracking.test.ts`
- Modify: `src/components/deployment-tracking/deployment-panel.test.tsx`
- Modify: `supabase/tests/deployment_status_approval.test.sql`
- Create: a forward-only migration through `supabase migration new`

**Interfaces:**
- Consumes: `EmployeeOption`, `create_deployment_group(...)`, deployment-assignment status.
- Produces: a picker without NUP/currently assigned personnel and a server-side guard with the same rule.

- [x] **Step 1: Write failing client and pgTAP tests**

Prove NUP and scheduled/ongoing assignees are unavailable, and direct NUP/current-assignment RPC calls fail.

- [x] **Step 2: Run targeted tests to verify they fail**

Run: `npm run test:run -- src/queries/deployment-tracking.test.ts src/components/deployment-tracking/deployment-panel.test.tsx` and the relevant pgTAP file after a reset.
Expected: NUP/current assignments remain accepted or displayed.

- [x] **Step 3: Filter options and replace the protected RPC**

Filter the client list for the feedback path and add an additive migration that validates rank and checks any active (`scheduled`/`ongoing`) assignment before inserting.

- [x] **Step 4: Run targeted tests to verify they pass**

Run the same Vitest and pgTAP commands.
Expected: PASS.

### Task 3: Correct Leave report output

**Files:**
- Modify: `src/lib/reporting/pdf.ts`
- Modify: `src/lib/reporting/pdf.test.ts`
- Modify: `supabase/tests/` report coverage or a new forward-only migration test
- Create: a forward-only migration through `supabase migration new`

**Interfaces:**
- Consumes: `ReportResponse` from `private.get_hr_report`.
- Produces: Leave rows with Number, Rank, Name, Badge Number, Leave Type, and Status; a portrait PDF grid without a generated timestamp.

- [x] **Step 1: Write failing PDF and report-shape tests**

Assert the generated timestamp is absent, headers and values are laid out as cells, and Leave returns the requested Number column.

- [x] **Step 2: Run focused tests to verify they fail**

Run: `npm run test:run -- src/lib/reporting/pdf.test.ts`
Expected: the generated timestamp is present and the output contains pipe-separated cells.

- [x] **Step 3: Implement grid rendering and add the Leave sequence column**

Calculate reusable column widths, wrap content per cell, draw vertical and horizontal borders, then forward-migrate `private.get_hr_report` with deterministic row numbering.

- [x] **Step 4: Run focused tests to verify they pass**

Run: `npm run test:run -- src/lib/reporting/pdf.test.ts`
Expected: PASS.

### Task 4: Verify integrated behavior

**Files:**
- Verify only.

- [x] **Step 1: Run database migrations and pgTAP tests**

Run: `npx supabase db reset` then `npx supabase test db`.

- [x] **Step 2: Run TypeScript, lint, and affected tests**

Run: `npm run typecheck`, `npm run lint`, and `npm run test:run`.

- [x] **Step 3: Build and inspect the generated PDF**

Run: `npm run build`; generate a sample report PDF and inspect its rendered pages for row borders, wrapping, and footer clearance.
