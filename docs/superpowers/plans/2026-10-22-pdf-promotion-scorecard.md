# PDF Promotion Scorecard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace simplified promotion gating with the complete, fixed PDF scorecard and show every active uniformed employee's transparent score in HR's Promotion Evaluation dashboard.

**Architecture:** A forward-only Supabase migration owns the immutable three-band policy and evaluates all score components in a private function. HR-only evidence RPCs supply inputs not present in the HRIS. Existing promotion read/decision RPCs return the scorecard and preserve immutable decision snapshots; TypeScript schemas, hooks, and the HR dashboard render score totals and evidence state.

**Tech Stack:** PostgreSQL/Supabase migrations, pgTAP, Next.js App Router, TypeScript, Zod, TanStack Query, React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-22-pdf-promotion-scorecard-design.md`

## Global Constraints

- Treat `Final Revisions .pdf` pages 17–20 as fixed policy; HR cannot edit policy values, intervals, caps, or bands.
- Evaluate `PCPL–PMSG`, `PSMS–PEMS`, and `PLT–PLTCOL`; show every active uniformed employee with a next rank, without inventing a passing score or automatic recommendation.
- The score is `/100`; eligibility/rating is visible but contributes no points, and neither score nor approval changes an employee rank.
- Missing evidence is never invented; distinguish missing/unassessed from a recorded zero.
- Enable RLS on exposed evidence tables; non-HR users cannot read/write evidence; revoke default function execution and use role-checked RPCs.
- Follow TDD. Create the schema migration through `supabase migration new`, then validate it with a fresh local reset and test database.

## Review Focus

- Seniority boundary dates match exactly one PDF point row; Task 1 pgTAP tests own this.
- Overlapping assignment periods cannot double-count months or exceed a cap; Task 2 owns this.
- Missing interview/reputation data shows as unassessed rather than zero or automatic rejection; Tasks 1 and 5 own this.
- Authenticated non-HR callers cannot access score evidence; Task 2 owns this.
- Identical scores have deterministic list order and historical decision snapshots do not change after correction; Task 3 owns this.

---

### Task 1: Encode the fixed PDF policy and calculate the core scorecard

**Files:**
- Create: `supabase/migrations/<timestamp>_pdf_promotion_scorecard.sql`
- Create: `supabase/tests/promotion_pdf_scorecard.test.sql`
- Modify: `src/lib/promotion-policies.ts`
- Test: `src/lib/promotion-policies.test.ts`

**Interfaces:**
- Produces `private.evaluate_promotion_scorecard(target_employee_id uuid, target_on date default current_date) returns jsonb`.
- Returns `band`, `totalScore`, `maximumScore`, `criteria`, `eligibility`, `currentRank`, `targetRank`, and `reason`.

- [ ] Write failing `promotion-policies.test.ts` assertions for all three 100-point allocations, including PCPL–PMSG `30/20/10/5/15/20` and the other bands' `25/25/10/5/10/25`.
- [ ] Run `npx vitest run src/lib/promotion-policies.test.ts`; expect FAIL because detailed point rows are absent.
- [ ] Transcribe every PDF seniority interval, assignment rate/cap, award value, and IPER pair into typed, read-only policy constants while preserving the matrix display API.
- [ ] Re-run the policy test; expect PASS.
- [ ] Write failing pgTAP tests for evaluator existence; all seniority boundaries; all three bands; and `PAT`, `NUP`, inactive, and top-rank exclusions.
- [ ] Run `npx supabase test db -- --file supabase/tests/promotion_pdf_scorecard.test.sql`; expect FAIL because the evaluator is absent.
- [ ] Run `npx supabase migration new pdf_promotion_scorecard`, then implement policy lookup tables, private evaluator, non-overlapping seniority ranges, and a criterion result `{ key, label, points, maximumPoints, state, evidence }`. Enable RLS and remove non-service policy writes.
- [ ] Re-run the pgTAP file; expect PASS.
- [ ] Commit: `git add src/lib/promotion-policies.ts src/lib/promotion-policies.test.ts supabase/migrations/*_pdf_promotion_scorecard.sql supabase/tests/promotion_pdf_scorecard.test.sql && git commit -m "feat: add PDF promotion scorecard policy"`.

### Task 2: Store verified score evidence with secured HR RPCs

**Files:**
- Modify: `supabase/migrations/<timestamp>_pdf_promotion_scorecard.sql`
- Modify: `supabase/tests/promotion_pdf_scorecard.test.sql`
- Create: `src/schemas/promotion-scorecard.ts`
- Create: `src/schemas/promotion-scorecard.test.ts`

**Interfaces:**
- Produces `public.record_promotion_assignment(...)`, `public.record_promotion_award(...)`, and `public.record_promotion_board_assessment(...)`, each returning `uuid`.
- Produces `promotionAssignmentInputSchema`, `promotionAwardInputSchema`, and `promotionBoardAssessmentInputSchema`.

- [ ] Write failing schema tests: inverted assignment dates/unknown region fail, unknown award key fails, and board scores outside the policy maximum fail.
- [ ] Run `npx vitest run src/schemas/promotion-scorecard.test.ts`; expect FAIL because schemas are absent.
- [ ] Implement the schemas with employee UUID, ISO dates, fixed assignment/region/criterion enums, trimmed evidence text, bounded document metadata, and no browser-provided point cap.
- [ ] Re-run the schema test; expect PASS.
- [ ] Add failing pgTAP/RLS cases for assignment and award caps, every IPER pair, unassessed board criteria, overlapping records, present-rank mismatch, audit entries, and employee/non-HR denial.
- [ ] Run the pgTAP file; expect FAIL because evidence tables/RPCs are absent.
- [ ] Add assignment, award, and board-assessment tables with foreign keys, indexes, constraints, HR-only RLS, audit writes, and role-checked `security definer` RPCs using `set search_path = ''`. Reject interval overlap and policy/rank mismatches; revoke default execution.
- [ ] Re-run the pgTAP file; expect PASS.
- [ ] Commit: `git add supabase src/schemas/promotion-scorecard.ts src/schemas/promotion-scorecard.test.ts && git commit -m "feat: record promotion score evidence"`.

### Task 3: Replace promotion read/decision contracts with scorecard contracts

**Files:**
- Modify: `supabase/migrations/<timestamp>_pdf_promotion_scorecard.sql`
- Modify: `supabase/tests/promotion_auto_evaluation.test.sql`
- Modify: `supabase/tests/list_search_and_retired_readiness.test.sql`
- Modify: `supabase/migrations/20261022150000_final_revisions_report_shapes.sql`
- Modify: `src/lib/types/database.ts`
- Modify: `src/schemas/promotion-eligibility.ts` and test
- Modify: `src/queries/promotion-eligibility.ts` and test
- Modify: `src/hooks/use-promotion-eligibility.ts` and test

**Interfaces:**
- `list_promotion_candidates_page` returns `score`, `maximum_score`, `band`, `eligibility_rating`, and scorecard state.
- `PromotionCandidateRow`, `PromotionEvaluationResult`, and `PromotionEvaluationDetail` expose criteria/evidence totals.

- [ ] Change database tests to expect every active uniformed employee with a next rank, including incomplete/zero scorecards, ordered by score descending then name/ID; assert evidence corrections do not rewrite decisions and approval never changes `employees.rank_id`.
- [ ] Run the modified database files; expect FAIL because the list remains qualification-filtered.
- [ ] Make list/detail/self/decision RPCs consume `evaluate_promotion_scorecard`; preserve search, status, pagination, rank immutability, and snapshots, but remove the obsolete simplified-qualification approval gate. Update reports to use scorecard fields.
- [ ] Re-run promotion pgTAP files; expect PASS.
- [ ] Add failing Zod/query/hook tests for `score: 63.5`, `maximumScore: 100`, and an unassessed criterion, retaining rejection-reason validation.
- [ ] Run `npx vitest run src/schemas/promotion-eligibility.test.ts src/queries/promotion-eligibility.test.ts src/hooks/use-promotion-eligibility.test.tsx`; expect FAIL.
- [ ] Extend Zod/database types/query mappings and hooks for score totals, band, criteria, evidence state, and eligibility display.
- [ ] Re-run the focused tests; expect PASS.
- [ ] Commit: `git add supabase src/lib/types/database.ts src/schemas/promotion-eligibility* src/queries/promotion-eligibility* src/hooks/use-promotion-eligibility* && git commit -m "feat: expose promotion scorecards"`.

### Task 4: Add HR evidence entry queries and dialog

**Files:**
- Create: `src/queries/promotion-scorecard.ts` and test
- Create: `src/hooks/use-promotion-scorecard.ts` and test
- Create: `src/components/promotion-eligibility/promotion-score-evidence-dialog.tsx` and test
- Modify: `src/lib/query-keys.ts`
- Modify: `src/schemas/index.ts`

**Interfaces:**
- Produces `PromotionScoreEvidenceDialog({ employeeId, band, criterion, open, onOpenChange })`.
- Consumes Task 2 Zod contracts and exposes only the Task 2 RPCs.

- [ ] Write failing query/hook tests proving validated RPC arguments and invalidation of promotion, report, and audit caches.
- [ ] Run the new query/hook tests; expect FAIL because they are absent.
- [ ] Implement RPC-only queries/hooks and matching query keys; do not allow direct evidence-table writes.
- [ ] Re-run query/hook tests; expect PASS.
- [ ] Write a failing dialog test asserting bounded board-score/evidence inputs, fixed assignment types/regions, policy-derived award choices, error display, and successful close/refresh.
- [ ] Run the dialog test; expect FAIL because the dialog is absent.
- [ ] Implement the criterion-specific HR evidence dialog. Do not render editable policy labels, caps, or arbitrary points.
- [ ] Re-run dialog test; expect PASS.
- [ ] Commit: `git add src/lib/query-keys.ts src/schemas/index.ts src/queries/promotion-scorecard* src/hooks/use-promotion-scorecard* src/components/promotion-eligibility/promotion-score-evidence-dialog* && git commit -m "feat: add promotion score evidence entry"`.

### Task 5: Render all scorecards and criterion detail

**Files:**
- Modify: `src/components/promotion-eligibility/staff-promotions.tsx` and test
- Modify: `src/components/promotion-eligibility/promotion-details-modal.tsx`
- Modify: `src/components/promotion-eligibility/promotion-decision-dialog.tsx`
- Modify: `src/components/promotion-eligibility/employee-promotion-eligibility.tsx` and test
- Modify: `src/components/staff-dashboard/hr-dashboard-overview.tsx` and test

- [ ] Write failing component tests asserting all scores—including `0 / 100`—list, one decimal appears only when needed, each criterion shows earned/max/unassessed state, eligibility/rating is outside total, and no pass/recommended label appears.
- [ ] Run `npx vitest run src/components/promotion-eligibility/staff-promotions.test.tsx src/components/promotion-eligibility/employee-promotion-eligibility.test.tsx src/components/staff-dashboard/hr-dashboard-overview.test.tsx`; expect FAIL.
- [ ] Replace qualified-only copy/columns with scorecard display, keep the policy matrix read-only, add detail/evidence actions, preserve approve/reject, and count evaluated scorecards in the HR dashboard.
- [ ] Re-run component tests; expect PASS.
- [ ] Commit: `git add src/components/promotion-eligibility src/components/staff-dashboard && git commit -m "feat: show promotion scorecards"`.

### Task 6: Release verification and PR update

**Files:**
- Modify only intentional generated type files, if their existing generation command changes tracked output.

- [ ] Run `npx supabase db reset --local --yes`; expect all migrations apply.
- [ ] Run `npx supabase test db`; expect PASS.
- [ ] Run `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, and `npm run build`; expect exit code 0 and separately note any pre-existing warnings.
- [ ] Run the repository's documented E2E command against its supported local environment; verify HR can open scorecards, record evidence, refresh a score, and approve/reject without rank mutation.
- [ ] Run `git diff --check`, inspect function grants/RLS/snapshots and scorecard UI, commit intentional changes, push `fix/final-revisions-audit`, and update PR #97. Wait for required checks before merge or remote database deployment.

## Self-review

- **Spec coverage:** Tasks 1–3 cover fixed policy, scoring, secure inputs, evaluator, reads, reports, decisions, and immutable snapshots. Tasks 4–5 cover HR evidence entry and the scorecard dashboard. Task 6 covers release verification and PR safety.
- **Step scan:** Each implementation slice starts RED, defines an interface, turns GREEN, and has a focused commit.
- **Type consistency:** Task 1 evaluator values flow through Task 3 contracts into Tasks 4–5; Task 2 RPCs are the only evidence mutation path used by Task 4.
- **Review focus:** Each listed failure mode has a named test in its owning task.
- **Proportion:** The plan fixes policy values, interfaces, file boundaries, and verification without transcribing implementation bodies.
