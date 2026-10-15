# Final PDF Revisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved PDF revisions as a safe, tested HRIS update on a branch based on `main`.

**Architecture:** Keep visual and copy changes in their current client components. Put behavior and data-invariant changes behind existing Zod schemas and Supabase RPC/migration boundaries. Reuse the existing station logo, job-deletion guard, promotion-readiness RPC, and browser-side query conventions instead of adding a parallel subsystem.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Tailwind CSS, Vitest/Testing Library, Supabase/Postgres/pgTAP, Deno Edge Functions.

**Spec:** `docs/superpowers/specs/2026-10-15-final-pdf-revisions-design.md`

## Global Constraints

- Preserve the supplied PDF; derive the provided ceremony photo only as a new static public asset.
- Keep the existing `"use client"` client boundary for interactive components and do not expose server secrets in it.
- Dashboard On Duty is active personnel whose status is `present` or `late`; it excludes `incomplete`, `absent`, and approved leave.
- Set the attendance workday start to exactly `05:00` while retaining timezone and late-grace behavior.
- NUP IDs accept eight digits, display as `YYYY-MM-DD`, and never use the police badge format.
- Preserve existing Supabase RLS, private/public function boundaries, and explicit function-execution revocations.
- Promotion and AI analysis remain advisory; neither changes a personnel rank or application stage automatically.
- Do not alter the face-recognition age behavior or introduce a minor-consent workflow.

## Review Focus

- A late active employee must increase On Duty, while an incomplete time-in must not; Task 3 owns this regression.
- An existing employee with an inactive rank must remain editable, but a restored rank must become a target-rank option; Task 5 owns this regression.
- NUP input must reject letters and fewer/more than eight digits even when a form submission bypasses the visual mask; Task 5 owns this regression.
- A published/closed opening with applications must not become deletable merely because a UI label changes; Task 4 owns this regression.
- AI must not infer a negative result from missing height/criminal-case wording, while still considering actual eligibility, skills, and experience; Task 7 owns this regression.

## File map

- `public/sjcp-ceremony.webp`: user-provided ceremony image derived from the PDF for the landing hero.
- `src/components/recruitment/public-careers-landing.tsx`: public navigation, hero, recruitment card, and contact panel.
- `src/components/recruitment/public-job-detail.tsx`, `src/app/(auth)/login/page.tsx`, and `src/components/recruitment/application-detail/overview-tab.tsx`: public job, applicant login, and applicant-detail copy/sections.
- `src/components/workspace-shell/workspace-shell.tsx` and `src/components/staff-dashboard/hr-dashboard-overview.tsx`: requested staff-shell and dashboard presentation.
- `src/schemas/personnel-records.ts`, `src/components/personnel-records/employee-form.tsx`, and the generated Supabase migration: NUP ID, relationship, and Unit/Station validation.
- `supabase/functions/_shared/application-scoring-provider.ts`: bounded prompt instructions for advisory applicant analysis.
- Existing adjacent `*.test.tsx`, `*.test.ts`, Deno test, and `supabase/tests/*.sql` files: behavior evidence.

### Task 1: Public landing page and ceremony asset

**Files:**
- Create: `public/sjcp-ceremony.webp`
- Modify: `src/components/recruitment/public-careers-landing.tsx`
- Modify: `src/components/recruitment/public-careers-landing.test.tsx`

**Interfaces:**
- Consumes: the supplied photo on page 2 of the review PDF and the existing `usePublishedJobs` query.
- Produces: accessible `About`, `Contact Us`, `LOGIN`, recruitment, and emergency-hotline UI that preserves existing in-page and sign-in destinations.

- [ ] **Step 1: Write failing landing-page tests**

Assert that the navigation names are `About`, `Contact Us`, and `LOGIN`; Contact Us targets the contact section; the hero uses the new ceremony image and exact approved heading; the recruitment card has no reference-number input or View-all link; and Contact Us contains Emergency Hotline 911.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:run -- src/components/recruitment/public-careers-landing.test.tsx`

Expected: FAIL because the old labels/controls and hero are still rendered.

- [ ] **Step 3: Create the static asset and implement the landing changes**

Extract only the supplied ceremony photo into `public/sjcp-ceremony.webp`. Update `PublicCareersLanding` to use it as a contrast-safe, subdued background; remove the specified red-header text and redundant HRIS line; replace copy/navigation; remove reference input and View-all; expose View details before Apply; and apply the restrained blue-to-red contact gradient without degrading text contrast.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm run test:run -- src/components/recruitment/public-careers-landing.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the landing-page change**

```bash
git add public/sjcp-ceremony.webp src/components/recruitment/public-careers-landing.tsx src/components/recruitment/public-careers-landing.test.tsx
git commit -m "feat: refresh public recruitment landing page"
```

### Task 2: Applicant-facing recruitment cleanup

**Files:**
- Modify: `src/components/recruitment/public-job-detail.tsx`
- Modify: `src/components/recruitment/public-job-detail.test.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/components/recruitment/application-detail/overview-tab.tsx`
- Modify: `src/components/recruitment/application-detail/tabs.test.tsx`

**Interfaces:**
- Consumes: existing published-job route `/jobs/[id]`, applicant registration path, and application-detail props.
- Produces: an applicant flow with a landing-page Back link, no duplicate general-requirements section, revised login copy, and no Cover note region.

- [ ] **Step 1: Write failing applicant-flow tests**

Assert that the job detail calls its return action `Back` and links to `/`, does not render the duplicate General Requirements block, the applicant login has no Station-personnel prompt and uses `Don't have an account? Contact HR`/`Access your PDS`, and Overview has no region named Cover note.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm run test:run -- src/components/recruitment/public-job-detail.test.tsx src/components/recruitment/application-detail/tabs.test.tsx`

Expected: FAIL on the old return/copy/section assertions.

- [ ] **Step 3: Implement only the approved applicant-facing changes**

Remove the duplicated requirement renderer from public job detail (job posting content remains), link Back to `/`, update login copy, and remove the Cover note prop/section plumbing from the detail overview without altering stored `cover_note` data.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm run test:run -- src/components/recruitment/public-job-detail.test.tsx src/components/recruitment/application-detail/tabs.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the applicant-facing change**

```bash
git add src/components/recruitment/public-job-detail.tsx src/components/recruitment/public-job-detail.test.tsx src/app/(auth)/login/page.tsx src/components/recruitment/application-detail/overview-tab.tsx src/components/recruitment/application-detail/tabs.test.tsx
git commit -m "feat: simplify applicant recruitment flow"
```

### Task 3: On-duty semantics and 05:00 attendance schedule

**Files:**
- Modify: `src/components/staff-dashboard/hr-dashboard-overview.tsx`
- Modify: `src/components/staff-dashboard/hr-dashboard-overview.test.tsx`
- Modify: `src/components/attendance-integration/attendance-integration-settings.test.tsx`
- Create: migration generated by `supabase migration new final_pdf_attendance_dashboard`
- Modify: `supabase/tests/hr_dashboard_overview.test.sql`
- Modify: `supabase/tests/attendance_integration.test.sql`

**Interfaces:**
- Consumes: `get_hr_dashboard_overview()` attendance JSON and `attendance_integration_settings.workday_start`.
- Produces: dashboard counts `{ onDuty = present + late, absent, onLeave }` and persisted `05:00` schedule values.

- [ ] **Step 1: Write failing UI and pgTAP tests**

Add tests for an On Duty card containing present plus late, separate Absent and On Leave cards, and a 05:00 configured workday with a 05:00 attendance event classified by normal late-grace rules.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/components/staff-dashboard/hr-dashboard-overview.test.tsx src/components/attendance-integration/attendance-integration-settings.test.tsx`

Expected: FAIL because current UI uses Present On Duty and combines leave with absence. Run the repository pgTAP command for the two SQL files and confirm the migration-dependent assertions fail before applying the migration.

- [ ] **Step 3: Generate and implement the forward-only migration and dashboard updates**

Use `supabase migration new final_pdf_attendance_dashboard`; in the generated migration, update the integration default and existing CSV/XLSX setting to `05:00`, and replace `private.get_hr_dashboard_overview()`/its public wrapper with equivalent role-checked definitions returning separate `present`, `late`, `incomplete`, `absent`, and `onLeave` counts. Update the UI to render On Duty as present plus late and distinct absent/on-leave cards.

- [ ] **Step 4: Run focused verification**

Run the focused Vitest command and the repository pgTAP command for `hr_dashboard_overview` and `attendance_integration`.

Expected: PASS; an incomplete scan never appears in On Duty, and the migration preserves function grants/revocations.

- [ ] **Step 5: Commit the attendance/dashboard change**

```bash
git add src/components/staff-dashboard/hr-dashboard-overview.tsx src/components/staff-dashboard/hr-dashboard-overview.test.tsx src/components/attendance-integration/attendance-integration-settings.test.tsx supabase/migrations supabase/tests/hr_dashboard_overview.test.sql supabase/tests/attendance_integration.test.sql
git commit -m "feat: count late personnel as on duty"
```

### Task 4: Staff presentation, safe opening deletion, and rank distribution

**Files:**
- Modify: `src/components/workspace-shell/workspace-shell.tsx`
- Modify: `src/components/workspace-shell/workspace-shell.test.tsx`
- Modify: `src/components/staff-dashboard/hr-dashboard-overview.tsx`
- Modify: `src/components/staff-dashboard/hr-dashboard-overview.test.tsx`
- Modify: `src/components/recruitment/staff-job-postings.test.tsx`

**Interfaces:**
- Consumes: existing `jobActions(job)` safety rule and rank ordering supplied by `get_hr_dashboard_overview()`.
- Produces: station/EPD branding, requested dashboard labels, and regression coverage for the already-present safe delete action.

- [ ] **Step 1: Write failing presentation/regression tests**

Assert San Juan City Police Station/Eastern Police District branding, removal of the requested redundant HRDD/Dashboard copy, labels `Recruitment Openings` and `Recent Deployments`, NUP after PAT in the rank distribution, and delete availability only for drafts without applications.

- [ ] **Step 2: Run the focused tests to verify the missing presentation behavior fails**

Run: `npm run test:run -- src/components/workspace-shell/workspace-shell.test.tsx src/components/staff-dashboard/hr-dashboard-overview.test.tsx src/components/recruitment/staff-job-postings.test.tsx`

Expected: FAIL on requested branding/label/order assertions; existing deletion guard stays green and documents the safe boundary.

- [ ] **Step 3: Implement presentation changes without weakening deletion safeguards**

Update shell and dashboard copy/order. Do not make published or closed openings with applications hard-deletable: retain the existing Delete action for empty drafts and Withdraw alternative for published openings.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm run test:run -- src/components/workspace-shell/workspace-shell.test.tsx src/components/staff-dashboard/hr-dashboard-overview.test.tsx src/components/recruitment/staff-job-postings.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit staff presentation changes**

```bash
git add src/components/workspace-shell/workspace-shell.tsx src/components/workspace-shell/workspace-shell.test.tsx src/components/staff-dashboard/hr-dashboard-overview.tsx src/components/staff-dashboard/hr-dashboard-overview.test.tsx src/components/recruitment/staff-job-postings.test.tsx
git commit -m "feat: align staff dashboard and station branding"
```

### Task 5: Personnel form and rank-restoration behavior

**Files:**
- Modify: `src/schemas/personnel-records.ts`
- Modify: `src/schemas/personnel-records.test.ts`
- Modify: `src/components/personnel-records/employee-form.tsx`
- Modify: `src/components/personnel-records/employee-form.test.tsx`
- Modify: `src/components/personnel-records/department-rank-fields.tsx`
- Modify: `src/components/personnel-records/department-rank-fields.test.tsx`
- Modify: `src/components/administration/administration-workspaces.tsx`
- Modify: `src/components/administration/administration-workspaces.test.tsx`
- Create: migration generated by `supabase migration new nup_identification_and_employee_requirements`
- Modify: `supabase/tests/ranks_catalogue.test.sql`

**Interfaces:**
- Consumes: `rankCategory(code)`, `employeeSchema`, existing rank options, and `employees.employee_number`.
- Produces: `EmployeeInput` that validates a NUP ID versus a badge number, includes `emergencyContactRelationship`, and requires `unitStation`.

- [ ] **Step 1: Write failing schema/component/pgTAP tests**

Assert a NUP rank switches the label to ID number, accepts eight digits and renders `YYYY-MM-DD`, rejects non-digits/wrong lengths, keeps badge validation for sworn ranks, requires Unit/Station and relationship from the five approved values, and makes a reactivated rank selectable in promotion target-rank controls.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm run test:run -- src/schemas/personnel-records.test.ts src/components/personnel-records/employee-form.test.tsx src/components/personnel-records/department-rank-fields.test.tsx src/components/administration/administration-workspaces.test.tsx`

Expected: FAIL because today all ranks use `BadgeNumberInput`, Unit/Station is optional, and relationship is absent.

- [ ] **Step 3: Generate and implement the validation/data changes**

Use `supabase migration new nup_identification_and_employee_requirements`. Add the relationship column/check and compatible `employee_number`/Unit/Station constraints without rewriting historic data; add any `NOT VALID` check only where needed to preserve legacy rows while enforcing new writes. Update public types and client validation. Implement the NUP input mask as an eight-digit canonical value rendered `YYYY-MM-DD`; do not use `type=number`. Make rank changes reactively switch the input mode, and ensure the rank-admin save path persists an explicit reactivation rather than forcing the prior `is_active` value.

- [ ] **Step 4: Run focused verification**

Run the focused Vitest command and pgTAP `ranks_catalogue` suite.

Expected: PASS; restored PCPL appears again without deleting it, and bad NUP input is rejected at schema and database boundaries.

- [ ] **Step 5: Commit personnel changes**

```bash
git add src/schemas/personnel-records.ts src/schemas/personnel-records.test.ts src/components/personnel-records src/components/administration/administration-workspaces.tsx src/components/administration/administration-workspaces.test.tsx supabase/migrations supabase/tests/ranks_catalogue.test.sql
git commit -m "feat: support NUP identification and personnel requirements"
```

### Task 6: Qualified-promotion dashboard signal

**Files:**
- Modify: `src/components/staff-dashboard/hr-dashboard-overview.tsx`
- Modify: `src/components/staff-dashboard/hr-dashboard-overview.test.tsx`
- Modify: `src/queries/promotion-eligibility.test.ts`
- Modify: `supabase/tests/promotion_live_readiness.test.sql`

**Interfaces:**
- Consumes: `listPromotionReadiness()` rows containing `readiness.isReady` and active employee scope.
- Produces: an HR-only advisory count labelled Qualified for Promotion, linked to `/hr/promotions`.

- [ ] **Step 1: Write failing promotion-notice tests**

Assert that only active ready rows are counted, the dashboard uses the exact Qualified for Promotion wording, links to HR review, and does not render a notice for zero qualified personnel.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm run test:run -- src/components/staff-dashboard/hr-dashboard-overview.test.tsx src/queries/promotion-eligibility.test.ts`

Expected: FAIL on the revised label/filter assertions.

- [ ] **Step 3: Implement advisory qualification presentation**

Keep existing readiness calculation and HR review link; update only the count derivation/copy necessary to express qualified personnel and maintain active-personnel scope. Do not add automatic promotion behavior.

- [ ] **Step 4: Run focused verification**

Run the focused Vitest command and pgTAP `promotion_live_readiness` suite.

Expected: PASS.

- [ ] **Step 5: Commit promotion-signal change**

```bash
git add src/components/staff-dashboard/hr-dashboard-overview.tsx src/components/staff-dashboard/hr-dashboard-overview.test.tsx src/queries/promotion-eligibility.test.ts supabase/tests/promotion_live_readiness.test.sql
git commit -m "feat: surface qualified promotion count"
```

### Task 7: Advisory applicant AI scoring criteria

**Files:**
- Modify: `supabase/functions/_shared/application-scoring-provider.ts`
- Modify: `supabase/functions/_shared/application-scoring-provider.test.ts`
- Modify: `docs/superpowers/specs/2026-08-23-ai-applicant-shortlisting-design.md`

**Interfaces:**
- Consumes: `ApplicationScoringInput.criteria` and submitted document evidence.
- Produces: a stable provider instruction that treats eligibility, skill, and experience evidence as positive while never penalizing absent height/criminal-case text.

- [ ] **Step 1: Write a failing Deno provider test**

Inspect the outbound text request and assert it explicitly says missing height or no-pending-criminal-case wording is neutral, while verified eligibility, relevant skills, and experience are positive evidence.

- [ ] **Step 2: Run the Deno test to verify it fails**

Run: `deno test supabase/functions/_shared/application-scoring-provider.test.ts`

Expected: FAIL because the current provider only says to evaluate against all criteria.

- [ ] **Step 3: Implement a bounded scoring instruction**

Add the exact neutral-evidence and positive-evidence rule to both text-CV and document-analysis prompts. Keep structured JSON response requirements, document minimization, `store: false`, and HR-only decision authority unchanged. Update the authoritative AI design document to match.

- [ ] **Step 4: Run the Deno test to verify it passes**

Run: `deno test supabase/functions/_shared/application-scoring-provider.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit advisory scoring change**

```bash
git add supabase/functions/_shared/application-scoring-provider.ts supabase/functions/_shared/application-scoring-provider.test.ts docs/superpowers/specs/2026-08-23-ai-applicant-shortlisting-design.md
git commit -m "feat: refine applicant analysis evidence rules"
```

### Task 8: Documentation sweep and release verification

**Files:**
- Modify: `README.md`
- Modify: `SYSTEM_SOURCE_OF_TRUTH.md`
- Modify: `docs/superpowers/specs/2026-10-15-final-pdf-revisions-design.md`

**Interfaces:**
- Consumes: completed UI/data behavior from Tasks 1-7.
- Produces: documentation that names the 05:00 attendance schedule, On Duty semantics, NUP ID format, and advisory AI/face-recognition boundaries.

- [ ] **Step 1: Write/adjust documentation assertions where a matching test file exists**

Add assertions for user-visible copy and behavior that documentation names; otherwise record each documentation claim in the final review evidence.

- [ ] **Step 2: Update the authoritative documents**

Search repository-wide for old behavior phrases including `Present On Duty`, `08:00`, `Badge number`, `Cover note`, and the former login/landing labels. Update each authoritative occurrence or record why it is intentionally historical.

- [ ] **Step 3: Run complete verification**

Run: `npm run test:run`, `npm run lint`, `npm run typecheck`, `npm run build`, relevant pgTAP suites, and `deno test supabase/functions/_shared/application-scoring-provider.test.ts`.

Expected: all commands pass. Record any pre-existing failure separately; do not misattribute it to this branch.

- [ ] **Step 4: Commit documentation and verification updates**

```bash
git add README.md SYSTEM_SOURCE_OF_TRUTH.md docs/superpowers/specs/2026-10-15-final-pdf-revisions-design.md
git commit -m "docs: describe final HRIS revisions"
```

## Plan self-review

- Spec coverage: Tasks 1-2 cover public, login, and Cover note changes; Tasks 3-6 cover attendance, dashboard, personnel, ranks, deletion safety, and promotions; Task 7 covers AI; Task 8 sweeps documentation. The no-minors face-recognition boundary is intentionally unchanged and documented in Tasks 7-8.
- Type consistency: Task 5 is the only producer of the NUP identifier/relationship fields, and its tests cover every consumer introduced in that task. Tasks 3 and 6 consume existing query shapes without widening public contracts.
- Review focus: Each listed risk is assigned to a concrete task and explicit failing-first test.
- Proportion: UI copy changes are grouped by existing component boundary; data migration tasks are isolated from visual tasks.
