# Recruitment and Applicant Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver secure public job browsing, applicant application tracking, HR recruitment management, and an administrator-controlled employee-account activation handoff.

**Architecture:** Existing browser Supabase client plus RLS handles ordinary CRUD. Database RPCs implement application submission, HR state changes, hiring, and administrator activation completion atomically. Zod validates all inputs; TanStack Query owns all cache state.

**Tech Stack:** Next.js App Router, TypeScript, React, Tailwind, shadcn/ui, React Hook Form, Zod, TanStack Query, Supabase PostgreSQL/Auth/Storage/RLS, pgTAP, Vitest.

**Spec:** docs/superpowers/specs/2026-08-23-recruitment-and-applicant-portal-design.md

## Global Constraints

- Never expose a service-role key or secret in browser code.
- Reuse public.app_role, private.current_user_has_role, private.touch_updated_at, and private SECURITY DEFINER patterns with empty search path and authenticated-only public wrappers.
- Each exposed table gets RLS, least-privilege grants, separate per-operation policies, and indexes on all foreign-key/RLS predicates.
- CVs/credentials use a non-public applicant-documents bucket. Browser uploads are non-upsert and never broad-list/delete.
- Use Zod at form/filter/route/file/RPC boundaries. Use TanStack Query for server state, with mutation invalidation.
- HR creates an employee record after hiring; the user remains Applicant. The existing Administrator Users update_managed_user workflow alone grants Employee and completes the activation request.
- Do not add AI, automatic hiring, or a second account-management endpoint.

---

## File Structure

| File or area | Responsibility |
| --- | --- |
| src/schemas/recruitment.ts | Validation contracts, status map, and input types. |
| src/lib/types/database.ts | Job, applicant, application, document, history, and activation types. |
| src/lib/query-keys.ts | Recruitment cache-key namespace. |
| Generated Supabase migration | Tables, constraints, RLS/grants, bucket/policies, workflows, indexes. |
| supabase/tests/recruitment_and_applicant_portal.test.sql | pgTAP database/RLS/Storage/workflow tests. |
| src/queries/recruitment.ts | Parsed reads, uploads, signed URLs, and RPC calls. |
| src/hooks/use-recruitment.ts | Query/mutation hooks with invalidation. |
| src/components/recruitment | Public jobs, applicant portal, HR jobs and review UIs. |
| src/app/jobs plus applicant/HR routes | Public and role-protected pages. |
| Administration query/hook/workspace files | Pending activation indicator in existing Admin Users page. |

### Task 1: Define recruitment contracts, types, keys, and navigation

**Files:**
- Create: src/schemas/recruitment.ts
- Create: src/schemas/recruitment.test.ts
- Modify: src/schemas/index.ts
- Modify: src/lib/types/database.ts
- Modify: src/lib/query-keys.ts and src/lib/query-keys.test.ts
- Modify: src/lib/app/role-config.ts and src/lib/app/role-config.test.ts

**Interfaces:**
- Consumes: existing UUID/date/pagination primitives and role types.
- Produces: ApplicationStatus, JobOpeningInput, JobCriterionInput, ApplicantProfileInput, ApplicationSubmissionInput, ApplicationStatusTransitionInput, HiringDecisionInput, JobFilters, ApplicationFilters, and ApplicantDocumentInput.

- [ ] **Step 1: Write failing contracts/keys/navigation tests**

~~~ts
expect(applicationStatusSchema.options).toEqual([
  "Submitted", "Under Review", "Shortlisted", "Interview", "Hired", "Not Selected",
]);
expect(hiringDecisionSchema.safeParse({
  applicationId: "bad-id", employeeNumber: "emp 1", departmentId: 1,
  positionId: 2, employmentStartedOn: "2026-10-01",
}).success).toBe(false);
expect(queryKeys.recruitment.applications({ page: 1, pageSize: 20 }))
  .toEqual(["recruitment", "applications", { page: 1, pageSize: 20 }]);
expect(ROLE_CONFIG.hr_personnel.navigation)
  .toContainEqual(expect.objectContaining({ href: "/hr/jobs" }));
~~~

- [ ] **Step 2: Run to verify failure**

Run: npm run test:run -- src/schemas/recruitment.test.ts src/lib/query-keys.test.ts src/lib/app/role-config.test.ts

Expected: FAIL; recruitment contracts do not exist.

- [ ] **Step 3: Implement minimal contracts**

Define statuses exactly as Submitted, Under Review, Shortlisted, Interview, Hired, Not Selected. Validate trimmed opening data, positive department/position IDs, ISO dates, applicant contact data, a nonempty application with at least one CV, and files limited to PDF/DOC/DOCX/PNG/JPEG at 10 MB. Reuse the employee-number schema.

~~~ts
export const applicationStatusSchema = z.enum([
  "Submitted", "Under Review", "Shortlisted", "Interview", "Hired", "Not Selected",
]);
export const hiringDecisionSchema = z.object({
  applicationId: uuidSchema,
  employeeNumber: employeeNumberSchema,
  departmentId: positiveIntegerSchema,
  positionId: positiveIntegerSchema,
  employmentStartedOn: isoDateSchema,
  note: optionalTrimmedTextSchema(2000),
});
~~~

Create record types and query keys for public jobs, job detail, applicant profile/list/detail, HR jobs, and HR queue/detail. Add Applicant links for jobs/profile/applications and HR links for jobs/applications without removing existing links.

- [ ] **Step 4: Run tests to verify success**

Run: npm run test:run -- src/schemas/recruitment.test.ts src/lib/query-keys.test.ts src/lib/app/role-config.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/schemas src/lib/types/database.ts src/lib/query-keys.ts src/lib/query-keys.test.ts src/lib/app/role-config.ts src/lib/app/role-config.test.ts
git commit -m "feat: add recruitment contracts"
~~~

### Task 2: Build secure schema, Storage policies, and database workflows

**Files:**
- Create: migration generated by npx supabase@latest migration new recruitment_and_applicant_portal
- Create: supabase/tests/recruitment_and_applicant_portal.test.sql

**Interfaces:**
- Consumes: profiles, user_roles, departments, positions, employees, audit_logs, private.current_user_has_role, and public.update_managed_user(uuid, public.app_role, boolean).
- Produces: recruitment tables plus public.submit_application(uuid, bigint, text, jsonb), public.transition_application_status(uuid, text, text), public.hire_application(uuid, text, bigint, bigint, date, text), and compatible public.update_managed_user.

- [ ] **Step 1: Write failing pgTAP coverage**

Set up HR, administrator, two applicants, and an unauthorized employee. Assert tables/functions/RLS/grants, unique applicant/opening pair, published-only anonymous reads, own-data isolation, HR-only actions, and Storage path isolation.

~~~sql
select extensions.has_table('public', 'job_openings', 'Job openings table exists');
select extensions.has_function(
  'public', 'hire_application',
  array['uuid', 'text', 'bigint', 'bigint', 'date', 'text'],
  'Hiring is atomic'
);
select extensions.throws_ok(
  $$select public.transition_application_status(
    '00000000-0000-4000-8000-000000009001'::uuid, 'Hired', null
  )$$,
  '42501', 'HR access is required.', 'Applicant cannot change application status'
);
~~~

- [ ] **Step 2: Run SQL tests to verify failure**

Run: npx supabase@latest test db --local supabase/tests/recruitment_and_applicant_portal.test.sql

Expected: FAIL; migration is absent.

- [ ] **Step 3: Generate and implement migration**

Run npx supabase@latest migration new recruitment_and_applicant_portal. Define:

~~~sql
create table public.job_openings (
  id bigint generated always as identity primary key,
  department_id bigint references public.departments (id) on delete restrict,
  position_id bigint references public.positions (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null check (char_length(btrim(description)) between 20 and 10000),
  location text check (location is null or char_length(btrim(location)) between 2 and 160),
  closes_on date,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  published_at timestamptz,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published') = (published_at is not null))
);
create table public.applicants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  middle_name text check (middle_name is null or char_length(btrim(middle_name)) between 1 and 80),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 80),
  phone text check (phone is null or char_length(btrim(phone)) between 3 and 32),
  address text check (address is null or char_length(btrim(address)) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
~~~

Create job_qualification_criteria, applications, application_status_history, applicant_documents, and employee_activation_requests. Use UUIDs for application-facing records, unique applicant_id/job_opening_id, immutable history, and activation statuses pending/activated. Use restrict for openings with applications, cascade for application children, and set null only for historical actor FKs.

Index published jobs on status/closes_on/published_at where published; each FK; applications by applicant/date and status/date; history/documents by application/date; and pending activation profile/status. Enable RLS, revoke default anon/authenticated access, and grant only public published reads, applicant own profile/application/doc/history actions, HR job/criteria management plus recruitment read/review, and admin activation-request reads.

Create private bucket applicant-documents. Applicant Storage INSERT/SELECT requires bucket and keys under applicants/{authenticated-user-id}/{generated-application-id}/. HR SELECT can access the bucket. Do not grant applicant Storage update/delete.

Private SECURITY DEFINER functions use empty search path, explicit caller validation, locks, and no PUBLIC execute. Public wrappers grant only authenticated:

1. submit_application checks applicant ownership, published/unexpired opening, no duplicate, one CV metadata object, exact caller-owned Storage objects; inserts application/documents/Submitted history in one transaction.
2. transition_application_status allows Submitted -> Under Review; Under Review -> Shortlisted/Interview/Not Selected; Shortlisted/Interview -> each other/Hired/Not Selected; terminal rows never change; it appends history.
3. hire_application accepts Shortlisted/Interview only, locks application, validates active HR/no employee link, inserts employee linked to existing applicant profile, pending request, Hired history/audit, and returns employee ID atomically.
4. Replace private.update_managed_user without changing the public signature/existing safeguards. Only assigning Employee to matching pending applicant activates that request with administrator/timestamp.

- [ ] **Step 4: Verify migration and workflows**

Run:

~~~bash
npx supabase@latest db reset --local
npx supabase@latest test db --local supabase/tests/recruitment_and_applicant_portal.test.sql
npx supabase@latest db lint --local
~~~

Expected: PASS. Add a duplicate employee-number hire test proving neither pending request nor Hired history survives rollback.

- [ ] **Step 5: Commit**

~~~bash
git add supabase/migrations supabase/tests/recruitment_and_applicant_portal.test.sql
git commit -m "feat: add recruitment database workflows"
~~~

### Task 3: Implement recruitment queries and cache-aware hooks

**Files:**
- Create: src/queries/recruitment.ts and src/queries/recruitment.test.ts
- Create: src/hooks/use-recruitment.ts and src/hooks/use-recruitment.test.tsx
- Modify: src/hooks/index.ts

**Interfaces:**
- Consumes: Task 1 contracts/keys and Task 2 tables/RPCs/Storage.
- Produces: listPublishedJobs, getPublishedJob, getApplicantProfile, saveApplicantProfile, listMyApplications, getMyApplication, listHrJobs, saveJobOpening, listHrApplications, getHrApplication, submitApplication, transitionApplicationStatus, hireApplication, getApplicantDocumentUrl, and use hooks.

- [ ] **Step 1: Write failing query/hook tests**

~~~ts
await expect(submitApplication({
  applicationId, jobId: 7, coverNote: "Ready to contribute.",
  documents: [{ kind: "cv", file }],
})).resolves.toEqual(applicationId);
expect(storageUpload).toHaveBeenCalledWith(
  expect.stringContaining(applicationId), file,
  expect.objectContaining({ upsert: false })
);
await result.current.mutateAsync(hiringInput);
expect(invalidateQueries).toHaveBeenCalledWith({
  queryKey: ["personnel-records", "directory"],
});
~~~

- [ ] **Step 2: Run to verify failure**

Run: npm run test:run -- src/queries/recruitment.test.ts src/hooks/use-recruitment.test.tsx

Expected: FAIL; modules do not exist.

- [ ] **Step 3: Implement data functions and hooks**

Parse all IDs, filters, and payloads; map camelCase to snake_case explicitly. Public jobs are published/unexpired and criteria are ordinal. Use existing pagination convention. Generate application UUID before files upload. Throw before submit RPC if upload fails; retain private orphan files if RPC fails. Generate signed URL only with createSignedUrl(path, 60) after parsing.

~~~ts
export async function hireApplication(input: HiringDecisionInput) {
  const values = hiringDecisionSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("hire_application", {
    target_application_id: values.applicationId,
    target_employee_number: values.employeeNumber,
    target_department_id: values.departmentId,
    target_position_id: values.positionId,
    target_employment_started_on: values.employmentStartedOn,
    decision_note: values.note ?? null,
  });
  throwIfError(error);
  return data as string;
}
~~~

Hiring invalidates recruitment, personnel directory/detail, administrator users, and audit logs. Other mutations invalidate their list/detail keys and applicant profile as appropriate.

- [ ] **Step 4: Run tests to verify success**

Run: npm run test:run -- src/queries/recruitment.test.ts src/hooks/use-recruitment.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/queries/recruitment.ts src/queries/recruitment.test.ts src/hooks/use-recruitment.ts src/hooks/use-recruitment.test.tsx src/hooks/index.ts
git commit -m "feat: add recruitment data layer"
~~~

### Task 4: Build public job browsing and applicant portal

**Files:**
- Create: src/components/recruitment/public-job-list.tsx and test
- Create: src/components/recruitment/public-job-detail.tsx and test
- Create: src/components/recruitment/applicant-profile-form.tsx and test
- Create: src/components/recruitment/application-form.tsx and test
- Create: src/components/recruitment/my-application-list.tsx and test
- Create: src/components/recruitment/applicant-application-detail.tsx and test
- Create: src/app/jobs/page.tsx, src/app/jobs/[jobId]/page.tsx
- Create: src/app/(app)/applicant/profile/page.tsx
- Create: src/app/(app)/applicant/applications/page.tsx
- Create: src/app/(app)/applicant/applications/[applicationId]/page.tsx
- Modify: src/app/(app)/applicant/page.tsx

**Interfaces:**
- Consumes: Task 1 schemas and Task 3 public/applicant hooks.
- Produces: public job routes and applicant-owned profile/submission/list/detail routes.

- [ ] **Step 1: Write failing applicant/public UI tests**

~~~tsx
render(<ApplicationForm jobId={7} />);
await user.click(screen.getByRole("button", { name: "Submit application" }));
expect(await screen.findByText("Attach a CV before submitting.")).toBeInTheDocument();
render(<ApplicantApplicationDetail applicationId={applicationId} />);
expect(screen.queryByRole("button", { name: /mark as hired/i })).not.toBeInTheDocument();
~~~

Also test public detail registration redirect, profile valid submit, own rows only, loading/error/empty states.

- [ ] **Step 2: Run to verify failure**

Run: npm run test:run -- src/components/recruitment/public-job-list.test.tsx src/components/recruitment/public-job-detail.test.tsx src/components/recruitment/applicant-profile-form.test.tsx src/components/recruitment/application-form.test.tsx src/components/recruitment/my-application-list.test.tsx src/components/recruitment/applicant-application-detail.test.tsx

Expected: FAIL; components absent.

- [ ] **Step 3: Implement public/applicant experience**

Use existing LoadingState, ErrorState, EmptyTableState, Card, Badge, Button, FormField, and React Hook Form with zodResolver. Detail displays ordered criteria and register/login/apply based on session/role. Application form displays file name/type/size and sends only its own metadata. Detail displays own status/history/signed links but no HR controls. Retain applicant landing page with links.

- [ ] **Step 4: Run tests to verify success**

Run: npm run test:run -- src/components/recruitment/public-job-list.test.tsx src/components/recruitment/public-job-detail.test.tsx src/components/recruitment/applicant-profile-form.test.tsx src/components/recruitment/application-form.test.tsx src/components/recruitment/my-application-list.test.tsx src/components/recruitment/applicant-application-detail.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/components/recruitment src/app/jobs "src/app/(app)/applicant"
git commit -m "feat: add applicant portal"
~~~

### Task 5: Build HR job opening and criteria management

**Files:**
- Create: src/components/recruitment/hr-job-list.tsx and test
- Create: src/components/recruitment/hr-job-form.tsx and test
- Create: src/components/recruitment/hr-job-detail.tsx and test
- Create: src/app/(app)/hr/jobs/page.tsx
- Create: src/app/(app)/hr/jobs/new/page.tsx
- Create: src/app/(app)/hr/jobs/[jobId]/page.tsx
- Modify: src/app/(app)/hr/page.tsx

**Interfaces:**
- Consumes: Task 1 opening/criteria schemas, Task 3 HR-job hooks, existing department/position hooks.
- Produces: HR create/edit/publish/close/list/filter/criteria workflows.

- [ ] **Step 1: Write failing HR-job tests**

~~~tsx
render(<HrJobForm departments={[department]} positions={[position]} />);
await user.click(screen.getByRole("button", { name: "Add criterion" }));
await user.type(screen.getByLabelText("Requirement 1"), "Bachelor degree");
await user.click(screen.getByRole("button", { name: "Save draft" }));
expect(saveJob).toHaveBeenCalledWith(expect.objectContaining({
  criteria: [expect.objectContaining({ ordinal: 1, isRequired: true })],
}));
~~~

Also test published jobs offer close rather than delete and filters reset page.

- [ ] **Step 2: Run to verify failure**

Run: npm run test:run -- src/components/recruitment/hr-job-list.test.tsx src/components/recruitment/hr-job-form.test.tsx src/components/recruitment/hr-job-detail.test.tsx

Expected: FAIL; HR job UI absent.

- [ ] **Step 3: Implement HR job workflows**

Use React Hook Form field arrays. Each criterion has requirement/type/required flag/remove/move controls and ordinal normalization. Load active departments/positions through existing admin hooks. Publish/close invalidate public and HR jobs; do not hard-delete referenced openings. Preserve values on validation/server error.

- [ ] **Step 4: Run tests to verify success**

Run: npm run test:run -- src/components/recruitment/hr-job-list.test.tsx src/components/recruitment/hr-job-form.test.tsx src/components/recruitment/hr-job-detail.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/components/recruitment "src/app/(app)/hr/jobs" "src/app/(app)/hr/page.tsx"
git commit -m "feat: add HR job management"
~~~

### Task 6: Build HR application queue, review, status, and hiring UI

**Files:**
- Create: src/components/recruitment/hr-application-queue.tsx and test
- Create: src/components/recruitment/hr-application-detail.tsx and test
- Create: src/components/recruitment/application-status-form.tsx and test
- Create: src/components/recruitment/hiring-decision-form.tsx and test
- Create: src/app/(app)/hr/applications/page.tsx
- Create: src/app/(app)/hr/applications/[applicationId]/page.tsx

**Interfaces:**
- Consumes: Task 3 HR app/document hooks, Task 1 status/hiring schemas, active departments/positions.
- Produces: HR-only queue/detail with controlled status and hire action.

- [ ] **Step 1: Write failing review tests**

~~~tsx
render(<ApplicationStatusForm application={shortlistedApplication} />);
expect(screen.getByRole("option", { name: "Hired" })).toBeInTheDocument();
render(<HiringDecisionForm applicationId={applicationId} departments={[department]} positions={[position]} />);
await user.click(screen.getByRole("button", { name: "Record hiring decision" }));
expect(await screen.findByText("Employee number is required.")).toBeInTheDocument();
~~~

Test filters, signed-document failure, immutable history, terminal no-controls, and one hire mutation.

- [ ] **Step 2: Run to verify failure**

Run: npm run test:run -- src/components/recruitment/hr-application-queue.test.tsx src/components/recruitment/hr-application-detail.test.tsx src/components/recruitment/application-status-form.test.tsx src/components/recruitment/hiring-decision-form.test.tsx

Expected: FAIL; HR review UI absent.

- [ ] **Step 3: Implement HR review**

Show applicant data, signed private docs, and immutable history. Only render status options allowed by shared client map; RPC is authoritative. Hired opens validated employee number/department/position/start-date/optional-note form. Success refetches detail and reports pending account activation. HR UI must never call update_managed_user.

- [ ] **Step 4: Run tests to verify success**

Run: npm run test:run -- src/components/recruitment/hr-application-queue.test.tsx src/components/recruitment/hr-application-detail.test.tsx src/components/recruitment/application-status-form.test.tsx src/components/recruitment/hiring-decision-form.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/components/recruitment "src/app/(app)/hr/applications"
git commit -m "feat: add HR application review"
~~~

### Task 7: Surface activation requests in existing Administrator Users workflow

**Files:**
- Modify: src/lib/types/database.ts
- Modify: src/schemas/administration.ts and test
- Modify: src/queries/administration.ts and test
- Modify: src/hooks/use-administration.ts and test
- Modify: src/components/administration/administration-workspaces.tsx and test

**Interfaces:**
- Consumes: Task 2 employee_activation_requests and existing update_managed_user RPC.
- Produces: activation pending filter/badge and safe completion through existing Admin action.

- [ ] **Step 1: Write failing administration tests**

~~~ts
const result = await listManagedUsers({ page: 1, pageSize: 20, activation: "pending" });
expect(result.rows[0]).toMatchObject({
  id: applicantProfileId,
  pendingActivation: expect.objectContaining({ employee_id: employeeId, status: "pending" }),
});
~~~

Test UI sees Employee activation pending and saving the Employee role still calls only updateManagedUser.

- [ ] **Step 2: Run to verify failure**

Run: npm run test:run -- src/schemas/administration.test.ts src/queries/administration.test.ts src/hooks/use-administration.test.tsx src/components/administration/administration-workspaces.test.tsx

Expected: FAIL; activation data/UI absent.

- [ ] **Step 3: Implement handoff visibility**

Add activation pending filter and nullable pendingActivation type. When the filter is pending, first query pending activation profile IDs and constrain the profile query with those IDs before pagination; otherwise fetch pending requests for visible profile IDs and attach them. Retain existing search/role/status behavior. Add badge/filter to UsersWorkspace. Save invokes only useUpdateManagedUser; database Task 2 atomically activates matching request. Invalidate administrator users/audit/recruitment data on success.

- [ ] **Step 4: Run tests to verify success**

Run: npm run test:run -- src/schemas/administration.test.ts src/queries/administration.test.ts src/hooks/use-administration.test.tsx src/components/administration/administration-workspaces.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/lib/types/database.ts src/schemas/administration.ts src/schemas/administration.test.ts src/queries/administration.ts src/queries/administration.test.ts src/hooks/use-administration.ts src/hooks/use-administration.test.tsx src/components/administration/administration-workspaces.tsx src/components/administration/administration-workspaces.test.tsx
git commit -m "feat: surface employee activation requests"
~~~

### Task 8: Verify full branch and prepare PR handoff

**Files:**
- Modify only a focused Task 1-7 file if verification proves a defect.
- Create: docs/verification/feat-09-recruitment-and-applicant-portal.md only if repository policy requires it.

**Interfaces:**
- Consumes: all feature work.
- Produces: feature branch ready for a PR to main.

- [ ] **Step 1: Run feature tests**

~~~bash
npm run test:run -- src/schemas/recruitment.test.ts src/queries/recruitment.test.ts src/hooks/use-recruitment.test.tsx src/components/recruitment src/schemas/administration.test.ts src/queries/administration.test.ts src/hooks/use-administration.test.tsx src/components/administration/administration-workspaces.test.tsx
npx supabase@latest db reset --local
npx supabase@latest test db --local supabase/tests/recruitment_and_applicant_portal.test.sql
~~~

Expected: PASS.

- [ ] **Step 2: Run quality gates**

~~~bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npx supabase@latest db lint --local
git diff --check
rg -n "service_role|SUPABASE_SECRET_KEY|NEXT_PUBLIC_.*(SECRET|SERVICE)" src supabase
~~~

Expected: all checks PASS and no browser secret.

- [ ] **Step 3: Exercise role journeys**

Verify anonymous published-only browsing; Applicant own profile/application/docs isolation; HR create/publish/review/hire; Administrator pending activation to Employee; and Employee/Management denial from recruitment routes/data.

- [ ] **Step 4: Review and record evidence**

Review git status --short, git diff main...HEAD --stat, migration RLS/grants/Storage, and results. Include commands/results, screenshots, database changes, and configuration in PR description or required verification record.

- [ ] **Step 5: Commit any verified corrections and hand off**

If Step 4 proves a defect, return to that task's failing focused test, make the minimal correction in the files explicitly listed by that task, rerun the task's focused command and all Task 8 checks, then commit it with a conventional fix message. If all Task 8 checks pass without a correction, create no verification-only commit.

~~~bash
git push -u origin feat/09-recruitment-and-applicant-portal
~~~

Open a PR to main naming feature 09, migration/RLS/Storage changes, Applicant -> HR -> Administrator journey, test results, screenshots, and local Supabase configuration. Do not start feature 10 until this PR merges.

## Plan self-review

- **Spec coverage:** Tasks 1-2 implement contracts, schema, RLS, Storage, status rules, atomic hiring, and activation handoff. Tasks 3-6 implement every public, Applicant, and HR route. Task 7 makes the activation request actionable through the existing administrator workflow. Task 8 verifies the required journey and handoff.
- **Placeholder scan:** Commands, function signatures, transitions, validation, error outcomes, and test cases are explicit. The migration filename is generated through the required Supabase command so its timestamp is valid.
- **Type consistency:** Task 1 names statuses/types/keys. Task 2 declares the RPC signatures. Task 3 calls those exact RPCs and exports the hooks Tasks 4-7 use.
