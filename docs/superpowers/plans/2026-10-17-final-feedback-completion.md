# Final Feedback Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended for independent UI tracks) or `superpowers:executing-plans` (recommended here because the database contracts join several tracks) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved final-feedback scope from `Final Changes (6).pdf`, the supplied promotion reference, and the follow-up corrections without weakening existing HRIS security or historical records.

**Architecture:** Keep presentation changes in the existing client components, and put permission checks, lifecycle rules, and data validation in Supabase RPCs. Extend the existing promotion criteria/readiness model rather than creating a parallel promotion workflow. Existing browser query and React Query conventions remain the boundary between the UI and RPCs.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Tailwind CSS, Zod, Vitest/Testing Library, Supabase/Postgres, pgTAP.

**Spec:** `docs/superpowers/specs/2026-10-17-final-feedback-completion-design.md`

## Global constraints

- Preserve role-based access, RLS, private/public function boundaries, and grants/revocations for every changed RPC.
- Deleting a recruitment opening is allowed only for a draft or closed opening with zero applications. Published openings, and every opening with applications, remain historical records and can only use the applicable non-destructive lifecycle.
- Applicant actions must never imply that a person or their account is deleted. “Disqualify” moves only the application to `Not Selected`, retaining the audit trail and reason.
- A scanned time-out must leave an attendance log as `present` or `late`, never `incomplete`; no dashboard metric should retain stale incomplete/time-out meaning.
- Profile-change requests require at least one uploaded supporting document on both client and database paths. New eligibility, certification, and training changes must be approved atomically with existing contact and qualification changes.
- Promotion criteria stay advisory. Adding IPER, PFT, and course requirements must never automatically alter an employee rank or promotion recommendation.
- Use the five English criterion groups in this exact order: Target Rank, Time in Grade, IPER Performance Rating Requirement, PFT, then Mandatory Courses / Training. The supplied `promotion.html` informs hierarchy only; do not copy its external assets or Tagalog copy.
- Use the established San Juan CPS visual language, accessible labels, visible focus states, and explicit confirmation for destructive actions.

## Review focus

- A closed, zero-application opening is deletable; a closed opening with an application and a published opening are not. Task 1 owns this invariant.
- A profile request with no document fails before upload/RPC completion and also fails if the UI is bypassed. Task 2 owns this invariant.
- An approved certification/training request changes the real personnel record while stale-record conflicts still prevent an incorrect approval. Task 2 owns this invariant.
- Employee-facing promotion readiness distinguishes unmet IPER, PFT, and course requirements without changing a rank. Task 3 owns this invariant.
- A completed time-out does not contribute to the dashboard’s incomplete count, and no KPI explanatory caption remains. Task 4 owns this invariant.
- An application that times out during AI screening has a concise failed/retry state without the rejected disclaimer or unsupported negative claims. Task 5 owns this invariant.

## File map

- `supabase/migrations/<timestamp>_final_feedback_completion.sql`: additive schema/RPC changes for profile requests, safe job deletion, promotion criteria/readiness, activation contact, and attendance semantics.
- `supabase/tests/safe_record_deletion.test.sql`, `supabase/tests/profile_change_approval.test.sql`, `supabase/tests/promotion_eligibility.test.sql`, and `supabase/tests/promotion_live_readiness.test.sql`: database authorization and business-rule coverage.
- `src/components/profile-change-requests/*`, `src/schemas/profile-change-requests.ts`, and `src/queries/profile-change-requests.ts`: employee submission and HR review flow.
- `src/components/promotion-eligibility/*`, `src/schemas/promotion-eligibility.ts`, `src/queries/promotion-eligibility.ts`, and `src/lib/types/database.ts`: promotion criterion input and readiness display.
- `src/components/recruitment/*`, `src/lib/recruitment/job-postings.ts`, and the nearby tests: public job, HR recruitment, applicant data, documents, and analysis state.
- `src/components/employee/*`, `src/components/leave-management/*`, `src/lib/app/role-config.ts`, `src/components/staff-shell/*`, and `src/components/staff-dashboard/*`: employee/HR navigation, dashboard, header, and announcement presentation.

### Task 1: Correct recruitment deletion and application-record behavior

**Files:**
- Create: `supabase/migrations/<timestamp>_final_feedback_recruitment_deletion.sql`
- Modify: `supabase/tests/safe_record_deletion.test.sql`
- Modify: `src/queries/deletion.ts`
- Modify: `src/lib/recruitment/job-postings.ts`
- Modify: `src/lib/recruitment/job-postings.test.ts`
- Modify: `src/components/recruitment/staff-job-postings.tsx`
- Modify: `src/components/recruitment/staff-job-postings.test.tsx`
- Modify: `src/components/recruitment/staff-applicant-roster.tsx`
- Modify: `src/components/recruitment/staff-applicant-roster.test.tsx`

**Interfaces:**
- Consumes: `job_openings`, `applications`, `get_deletion_impact`, and the existing HR-only deletion hook.
- Produces: a constrained job-opening deletion RPC and UI actions whose names match their actual lifecycle effects.

- [ ] **Step 1: Add failing business-rule tests for opening deletion**

Extend pgTAP coverage to prove active HR may delete draft or closed openings with no applications, while published openings and every opening with one or more applications fail with the safe withdraw/retain-history guidance. Assert a non-HR caller cannot use the RPC. Update the TypeScript action helper tests for the same state matrix.

- [ ] **Step 2: Run the targeted tests to verify the new cases fail**

Run:

```powershell
npm run test:run -- src/lib/recruitment/job-postings.test.ts src/components/recruitment/staff-job-postings.test.tsx src/components/recruitment/staff-applicant-roster.test.tsx
supabase test db --file supabase/tests/safe_record_deletion.test.sql
```

Expected: FAIL for closed zero-application deletion and the corrected applicant terminology.

- [ ] **Step 3: Make the database policy and RPC enforce the safe matrix**

Replace the draft-only check in `private.deletion_impact` and the job-opening deletion RPC with an explicitly named, HR-authorized function that locks the opening/application rows, permits only `draft` or `closed` with no applications, removes owned qualification criteria, and emits the existing deletion audit entry. Keep all dependent-record checks and no-force-delete behavior. Update `deleteRecord` to call the renamed RPC.

- [ ] **Step 4: Put Delete on recruitment openings and keep applicant disqualification distinct**

Have `jobActions` expose Delete for qualifying draft/closed empty openings, Withdraw only for published openings, and no destructive action where history prevents it. Keep the existing confirmation and error feedback, with text that clearly identifies a posting. Replace the applicant-row trash icon/title and “delete/remove” copy with a non-delete Disqualify action that sends the existing `Not Selected` transition and reason; do not add any candidate/account deletion path.

- [ ] **Step 5: Run focused tests and commit**

Run the commands from Step 2 again. Expected: PASS.

```powershell
git add supabase/migrations supabase/tests/safe_record_deletion.test.sql src/queries/deletion.ts src/lib/recruitment/job-postings.ts src/lib/recruitment/job-postings.test.ts src/components/recruitment/staff-job-postings.tsx src/components/recruitment/staff-job-postings.test.tsx src/components/recruitment/staff-applicant-roster.tsx src/components/recruitment/staff-applicant-roster.test.tsx
git commit -m "fix: place safe deletion on recruitment postings"
```

### Task 2: Complete secure profile-change requests and unlinked-personnel contact

**Files:**
- Create: `supabase/migrations/<timestamp>_profile_change_request_expansion.sql`
- Modify: `supabase/tests/profile_change_approval.test.sql`
- Modify: `src/schemas/profile-change-requests.ts`
- Modify: `src/schemas/profile-change-requests.test.ts`
- Modify: `src/queries/profile-change-requests.ts`
- Modify: `src/queries/profile-change-requests.test.ts`
- Modify: `src/components/profile-change-requests/profile-change-request-form.tsx`
- Modify: `src/components/profile-change-requests/profile-change-request-form.test.tsx`
- Modify: `src/components/profile-change-requests/admin-profile-change-request-detail.tsx`
- Modify: `src/components/profile-change-requests/admin-profile-change-request-queue.test.tsx`
- Modify: the existing unlinked-employee/account activation component and its adjacent test after locating the current route owner.

**Interfaces:**
- Consumes: profile change RPCs, `qualifications`, `certifications`, `training_records`, private document storage, and HR notifications.
- Produces: one document-backed request model with approval-safe changes for contact, eligibility, certification, and training; plus a Contact HR request that creates a notification but never creates a personnel record.

- [ ] **Step 1: Write failing validation and approval tests**

Add Zod/query/component tests that reject an empty attachment list, use `Remarks` and a single `Submit request` action, and submit eligibility, certification, and training rows. Add pgTAP cases that reject zero documents at the RPC, accept valid records stored under the caller-owned request path, approve each new change kind, reject stale source-record changes, and keep the caller limited to their own data. Add a UI/RPC test for the unlinked account’s `Contact HR` request and assert that it does not insert an `employees` row.

- [ ] **Step 2: Run targeted tests to verify failure**

Run:

```powershell
npm run test:run -- src/schemas/profile-change-requests.test.ts src/queries/profile-change-requests.test.ts src/components/profile-change-requests/profile-change-request-form.test.tsx src/components/profile-change-requests/admin-profile-change-request-queue.test.tsx
supabase test db --file supabase/tests/profile_change_approval.test.sql
```

Expected: FAIL because only qualifications are currently modeled and documents are optional.

- [ ] **Step 3: Extend the request contract without bypassing authorization**

Add the new allowed change kinds and references/checks in the migration; extend the request-value normalization functions so each record’s immutable snapshot and requested value are validated before insert. Require one to ten documents in both the public wrapper/private submit function, preserving ownership/path/mime/size checks. Extend approval to add/edit/remove certification and training records, and add eligibility handling using the existing personnel record structure. Retain row locks, stale-value conflict detection, audit logging, RLS, and grants.

Create an authenticated Contact HR RPC that validates an unlinked employee/account request, routes a concise notification to active HR recipients, deduplicates an open request, and records an audit event. It must not insert or link an employee row.

- [ ] **Step 4: Implement the form and HR review presentation**

Replace intermediate “Add proposal to request” wording with one submit flow. Mark supporting documents required, display client errors accessibly, rename the employee note label to `Remarks`, and provide add/edit/remove sections for Eligibility, Certification, and Training using the same catalogs/field rules as HR. Update the HR detail card renderer so each requested record type is legible before approval, and add a `Contact HR` button/state to the unlinked employee screen.

- [ ] **Step 5: Run focused tests and commit**

Run the commands from Step 2 again. Expected: PASS.

```powershell
git add supabase/migrations supabase/tests/profile_change_approval.test.sql src/schemas/profile-change-requests.ts src/schemas/profile-change-requests.test.ts src/queries/profile-change-requests.ts src/queries/profile-change-requests.test.ts src/components/profile-change-requests
git commit -m "feat: expand verified profile change requests"
```

### Task 3: Add the approved promotion-evaluation criterion groups

**Files:**
- Create: `supabase/migrations/<timestamp>_promotion_criteria_evaluations.sql`
- Modify: `supabase/tests/promotion_eligibility.test.sql`
- Modify: `supabase/tests/promotion_live_readiness.test.sql`
- Modify: `src/lib/types/database.ts`
- Modify: `src/schemas/promotion-eligibility.ts`
- Modify: `src/schemas/promotion-eligibility.test.ts`
- Modify: `src/queries/promotion-eligibility.ts`
- Modify: `src/queries/promotion-eligibility.test.ts`
- Modify: `src/components/promotion-eligibility/promotion-criteria-manager.tsx`
- Modify: `src/components/promotion-eligibility/promotion-criteria-manager.test.tsx`
- Modify: `src/components/promotion-eligibility/employee-promotion-eligibility.tsx`
- Modify: its associated promotion-readiness tests.

**Interfaces:**
- Consumes: the existing `promotion_criteria`, `performance_ratings`, qualifications/certifications/training records, and readiness RPCs.
- Produces: a single persisted criterion configuration with target rank, time in grade, IPER threshold/period, PFT expectation/evidence validity, and required courses; employee/HR readiness explains which requirements are outstanding.

- [ ] **Step 1: Define failing database and UI examples**

Add pgTAP examples for a criterion containing all five groups; valid null/optional settings where the policy does not require a group; valid IPER rating within the configured period; missing or expired PFT evidence; and matching/missing mandatory courses. Assert readiness is advisory and does not change `employees.rank_id`. Add schema/query tests for request/response serialization and component tests for the exact English ordering and labels.

- [ ] **Step 2: Run focused tests to verify failure**

Run:

```powershell
npm run test:run -- src/schemas/promotion-eligibility.test.ts src/queries/promotion-eligibility.test.ts src/components/promotion-eligibility/promotion-criteria-manager.test.tsx src/components/promotion-eligibility/employee-promotion-eligibility.test.tsx
supabase test db --file supabase/tests/promotion_eligibility.test.sql
supabase test db --file supabase/tests/promotion_live_readiness.test.sql
```

Expected: FAIL because the criterion create payload presently discards the performance threshold and has no PFT contract.

- [ ] **Step 3: Extend the persisted promotion contract and readiness calculation**

Add additive, constrained fields/tables for time-in-grade policy, IPER minimum rating and review period, PFT pass/score/valid-through evidence, and course requirements. Preserve existing criterion rows with backward-compatible defaults. Replace/create the relevant criterion and readiness RPC signatures atomically, restore explicit privileges, and calculate readiness from authoritative performance and PFT data rather than trusting a browser payload. Include structured missing-requirement labels so existing HR/employee consumers remain safe when a newer field is absent.

- [ ] **Step 4: Build the criteria editor and readiness displays**

Update Zod, database types, queries, hooks, and the criterion manager. Render the five groups in the approved order with English-only copy, validation messages beside the relevant inputs, and the same station color/style system as surrounding HR pages. Show configured IPER/PFT/course results in existing readiness and docket views; keep the existing manual review/recommendation workflow and no automatic promotion behavior.

- [ ] **Step 5: Run focused tests and commit**

Run the commands from Step 2 again. Expected: PASS.

```powershell
git add supabase/migrations supabase/tests/promotion_eligibility.test.sql supabase/tests/promotion_live_readiness.test.sql src/lib/types/database.ts src/schemas/promotion-eligibility.ts src/schemas/promotion-eligibility.test.ts src/queries/promotion-eligibility.ts src/queries/promotion-eligibility.test.ts src/components/promotion-eligibility
git commit -m "feat: add promotion evaluation criteria"
```

### Task 4: Finish employee, HR dashboard, shell, and announcement corrections

**Files:**
- Create: `supabase/migrations/<timestamp>_attendance_timeout_dashboard.sql` only if the existing attendance RPC cannot satisfy the tests without it.
- Modify: `supabase/tests/attendance_integration.test.sql` or the focused attendance/dashboard pgTAP suite.
- Modify: `src/components/staff-dashboard/hr-dashboard-overview.tsx`
- Modify: `src/components/staff-dashboard/hr-dashboard-overview.test.tsx`
- Modify: `src/components/employee/employee-dashboard.tsx`
- Modify: `src/components/employee/employee-dashboard.test.tsx`
- Modify: `src/components/leave-management/employee-leave.tsx`
- Modify: `src/components/leave-management/employee-leave.test.tsx`
- Modify: `src/lib/app/role-config.ts` and its test.
- Modify: `src/components/staff-shell/staff-shell.tsx`, `src/components/staff-shell/page-meta.ts`, and adjacent tests.
- Modify: `src/components/public-site/staff-announcements.tsx`, its test, and the existing delete hook/query if required.

**Interfaces:**
- Consumes: attendance logs/RPC overview, leave entitlements, published announcements, role config, and HR announcement records.
- Produces: correct gender-aware employee options; direct readable announcements; a caption-free, time-out-safe HR overview; and consistent station/role terminology.

- [ ] **Step 1: Add failing focused UI and data tests**

Assert Maternity is absent for male employees and Paternity is absent for female employees; the dashboard section title is `Announcements`; each item exposes `View details`; employee labels omit the `My`/`201` suffixes; leave history has All, For Approval, Approved, and Rejected filters. Assert each HR KPI contains its number/label but no descriptive line, and an attendance record completed by time-out is present/late rather than incomplete. Assert station/role header copy, NUP ordering beneath Patrolman/Patrolwoman, and an HR announcement delete affordance with confirmation and refresh.

- [ ] **Step 2: Run the focused tests to verify failure**

Run:

```powershell
npm run test:run -- src/components/employee/employee-dashboard.test.tsx src/components/leave-management/employee-leave.test.tsx src/components/staff-dashboard/hr-dashboard-overview.test.tsx src/components/staff-shell/staff-shell.test.tsx src/components/staff-shell/page-meta.test.ts src/components/public-site/staff-announcements.test.tsx
supabase test db --file supabase/tests/attendance_integration.test.sql
```

Expected: FAIL on old labels/tabs/captions and any dashboard model that retains an incomplete time-out count.

- [ ] **Step 3: Correct the attendance and HR data semantics**

Verify the source attendance transition with pgTAP; if needed, replace the overview function so `present`/`late` states include completed time-outs and never expose an `incomplete` KPI bucket. Do not recategorize absent/leave records. Update the TypeScript dashboard contract and remove the incomplete card together with every KPI caption/description.

- [ ] **Step 4: Implement the remaining shell, employee, and announcement UI changes**

Filter leave entitlements from the employee’s recorded gender, make announcement cards focusable links with a `View details` action, and apply the requested navigation names. Add Rejected to leave history. Use the account holder’s last name in the header trigger. Replace duplicated gray email sublabels with `HR`, `Employee`, or `Applicant`; use `San Juan City Police Station` plus the gray `Eastern Police District`; remove the redundant portal/dashboard copy; enforce NUP’s lowest rank ordering. Add a deletion action to HR announcements using the existing safe delete flow.

- [ ] **Step 5: Run focused tests and commit**

Run the commands from Step 2 again. Expected: PASS.

```powershell
git add supabase/migrations supabase/tests src/components/staff-dashboard src/components/employee src/components/leave-management src/lib/app/role-config.ts src/components/staff-shell src/components/public-site/staff-announcements.tsx src/components/public-site/staff-announcements.test.tsx
git commit -m "fix: complete employee and HR dashboard feedback"
```

### Task 5: Finish applicant and public-recruitment presentation/data corrections

**Files:**
- Modify: `src/components/recruitment/public-job-detail.tsx`
- Modify: `src/components/recruitment/public-job-detail.test.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/components/recruitment/application-detail/profile-tab.tsx`
- Modify: `src/components/recruitment/application-detail/documents-tab.tsx`
- Modify: `src/components/recruitment/application-detail/overview-tab.tsx`
- Modify: `src/components/recruitment/application-detail/tabs.test.tsx`
- Modify: `src/components/recruitment/application-detail/application-review.tsx` and its test only if applicant education must be passed through explicitly.
- Modify: `supabase/functions/_shared/application-scoring-provider.ts` and its focused Deno test if unsupported negative criteria remain in the prompt/output filter.

**Interfaces:**
- Consumes: public published-job data, applicant profile/application documents, AI score state, and applicant login.
- Produces: a station-styled public job view; complete HR applicant education; non-duplicated document lists; clear support copy; and bounded advisory AI error/analysis language.

- [ ] **Step 1: Write failing applicant/public tests**

Assert the public job detail uses established station page styling/tokens rather than a mismatched layout; login says `Don't have an account? Contact HR.`; the HR profile tab includes applicant educational background; the same document is rendered once even when shared between profile/application sets; and a timed-out analysis uses a short failed/retry UI without the redundant description below it. Add Deno/provider tests that missing height or criminal-case text never produces a negative claim.

- [ ] **Step 2: Run focused tests to verify failure**

Run:

```powershell
npm run test:run -- src/components/recruitment/public-job-detail.test.tsx src/components/recruitment/application-detail/tabs.test.tsx src/components/recruitment/application-detail/application-review.test.tsx
deno test --allow-env --allow-net supabase/functions/_shared/application-scoring-provider.test.ts
```

Expected: FAIL on the absent education/dedupe/copy/style assertions.

- [ ] **Step 3: Implement data-preserving presentation changes**

Restyle only the public detail component using shared public/station primitives. Replace the login support sentence exactly. Load and render educational background from the applicant profile in the HR review view, retaining “Not provided” behavior. Deduplicate document groups by stable document identity/object path before rendering, preserving stage-specific evidence. For `timed_out`, show a concise retryable failed state and remove the explanatory line/disclaimer beneath it. Bound the AI provider/presentation so only evidence actually supplied can affect advice; retain retries and never auto-change application status.

- [ ] **Step 4: Run focused tests and commit**

Run the commands from Step 2 again. Expected: PASS.

```powershell
git add src/components/recruitment/public-job-detail.tsx src/components/recruitment/public-job-detail.test.tsx 'src/app/(auth)/login/page.tsx' src/components/recruitment/application-detail supabase/functions/_shared/application-scoring-provider.ts supabase/functions/_shared/application-scoring-provider.test.ts
git commit -m "fix: complete applicant review and recruitment presentation"
```

### Task 6: Full regression, generated types, and handoff review

**Files:**
- Modify: generated Supabase types only through the repository’s documented generation command, if the project tracks them.
- Modify: only tests or implementation files that fail due to the approved contract changes.

- [ ] **Step 1: Regenerate contracts and run all relevant database suites**

Use the repository’s existing Supabase type-generation workflow after migrations are applied. Run every changed pgTAP file and any dependent migration test. Confirm RLS/grants and RPC signatures from a non-privileged role.

- [ ] **Step 2: Run application verification**

Run:

```powershell
npm run test:run
npm run lint
npm run typecheck
npm run build
```

Run the relevant Deno function test(s) and `npm run test:e2e` if the configured local services are available. Record an unavailable integration dependency explicitly rather than treating it as passing.

- [ ] **Step 3: Review the diff against the approved spec**

Confirm each PDF/follow-up item is traced to a changed component or a deliberate no-change decision. Recheck destructive actions, row-level access, role copy, responsive keyboard behavior, and that no temporary PDF-render files are staged.

- [ ] **Step 4: Commit verification fixes and prepare handoff**

```powershell
git add <only verified implementation and test files>
git commit -m "test: verify final feedback completion"
git status --short
```

Expected: only intentional user-owned files, if any, remain outside commits.
