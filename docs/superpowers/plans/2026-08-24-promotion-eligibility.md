# Promotion Eligibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver position-specific promotion-readiness reviews that HR manages manually and employees can view only as a restricted personal summary.

**Architecture:** A secure Supabase migration owns promotion criteria, ratings, evaluations, evidence, and the employee-safe summary. Zod contracts, browser query functions, and TanStack Query hooks expose separate HR and employee projections. HR pages create and assess advisory reviews; the Employee page is read-only and cannot expose ratings, notes, recommendations, or evidence links.

**Tech Stack:** Next.js App Router, TypeScript, React 19, Zod 4, TanStack Query 5, Supabase PostgreSQL/RLS/RPC, pgTAP, Vitest, Testing Library, Tailwind CSS, shadcn/ui.

**Spec:** docs/superpowers/specs/2026-08-24-promotion-eligibility-design.md

## Global Constraints

- The branch is feat/13-promotion-eligibility, based on the current merged main; do not start branch 14 until this branch is merged.
- Use imperative Supabase migrations: create the migration with supabase migration new promotion_eligibility; never create a timestamped migration filename by hand.
- Every public table must enable RLS, revoke broad table access, grant only necessary access, and have permitted and denied pgTAP cases.
- Browser code uses only the publishable Supabase key; public RPC wrappers call private authorization-checking functions and never expose service_role.
- Parse every form, URL/filter, query, and RPC payload with shared Zod schemas. TanStack Query is the server-data cache and invalidates affected data after mutations.
- HR may manage criteria, ratings, evaluations, and evidence. Employees may read only their own restricted summary. The module never writes employees.position_id, roles, rank, or employment status as a side effect.
- Retain criteria referenced by an evaluation, performance ratings, and evaluations; use deactivation or correction/update rather than hard deletion. There is no approval or export flow.
- Before the PR run npm run lint, npm run typecheck, npm run test:run, npm run build, and fresh-database migration/pgTAP checks.

---

## File structure

| File | Responsibility |
| --- | --- |
| Generated Supabase promotion migration | Tables, constraints, indexes, RLS/grants, private mutation functions, public RPC wrappers, and audit/summary updates. |
| supabase/tests/promotion_eligibility.test.sql | Schema, permitted-role, denied-role, snapshot, and employee-summary isolation tests. |
| src/schemas/promotion-eligibility.ts | Zod contracts and inferred input/filter types. |
| src/lib/types/database.ts | Database-row types and safe summary types. |
| src/lib/query-keys.ts | Promotion criteria, HR directory/detail, and employee-summary cache keys. |
| src/queries/promotion-eligibility.ts | Parsed Supabase reads plus deliberately mapped RPC payloads. |
| src/hooks/use-promotion-eligibility.ts | Queries, mutations, and precise invalidation. |
| src/components/promotion-eligibility/* | Focused criteria, HR review, evidence, status, and employee-summary components. |
| src/app/(app)/hr/promotions/** | Server-guarded HR routes. |
| src/app/(app)/employee/promotion-eligibility/page.tsx | Server-guarded employee summary route. |

### Task 1: Promotion contracts, types, and cache namespace

**Files:**
- Create: src/schemas/promotion-eligibility.ts
- Create: src/schemas/promotion-eligibility.test.ts
- Modify: src/schemas/index.ts
- Modify: src/lib/types/database.ts
- Modify: src/lib/query-keys.ts

**Interfaces:**
- Produces promotionCriterionSchema, promotionCriterionUpdateSchema, performanceRatingSchema, promotionEvaluationSchema, promotionEvaluationUpdateSchema, promotionEvaluationFiltersSchema, and employeePromotionEligibilitySchema.
- Produces inferred PromotionCriterionInput, PerformanceRatingInput, PromotionEvaluationInput, and PromotionEvaluationFilters types.
- Produces queryKeys.promotionEligibility.criteria, .hrDirectory, .hrEmployee, and .mine.

- [ ] **Step 1: Write the failing schema tests.**

~~~
it("normalizes a target-position criterion and its required records", () => {
  expect(promotionCriterionSchema.parse({
    targetPositionId: "4", minimumYearsOfService: "3", minimumPerformanceRating: "4",
    requirements: [{ recordKind: "certification", requiredName: " First Aid ", label: " First-aid certification ", isMandatory: true }],
  })).toMatchObject({ targetPositionId: 4, minimumYearsOfService: 3, minimumPerformanceRating: 4, requirements: [{ requiredName: "First Aid", label: "First-aid certification" }] });
});

it("rejects invalid ratings, reversed periods, unknown evidence kinds, and unbounded filters", () => {
  expect(performanceRatingSchema.safeParse({ employeeId, rating: 6, reviewPeriodStartsOn: "2026-07-01", reviewPeriodEndsOn: "2026-06-30" }).success).toBe(false);
  expect(promotionCriterionSchema.safeParse({ targetPositionId: 4, minimumYearsOfService: -1, requirements: [{ recordKind: "deployment", requiredName: "x", label: "x", isMandatory: true }] }).success).toBe(false);
  expect(promotionEvaluationFiltersSchema.parse({ pageSize: 1000 }).pageSize).toBe(100);
});
~~~

- [ ] **Step 2: Run the new test to verify it fails.**

Run: npm run test:run -- src/schemas/promotion-eligibility.test.ts
Expected: FAIL because the promotion schemas do not exist.

- [ ] **Step 3: Write the minimal shared contracts and types.**

~~~
export const promotionRecordKindSchema = z.enum(["qualification", "certification", "training"]);
export const promotionRecommendationSchema = z.enum(["recommended", "not_recommended", "deferred"]);
export const performanceRatingSchema = z.object({
  employeeId: uuidSchema,
  rating: z.coerce.number().int().min(1).max(5),
  reviewPeriodStartsOn: isoDateSchema,
  reviewPeriodEndsOn: isoDateSchema,
  notes: optionalText(2000),
}).refine(({ reviewPeriodStartsOn, reviewPeriodEndsOn }) => reviewPeriodEndsOn >= reviewPeriodStartsOn, {
  path: ["reviewPeriodEndsOn"], message: "Review period end must be on or after its start.",
});
~~~

Use the existing database-row convention for PromotionCriterion, PromotionCriterionRequirement, PerformanceRating, PromotionEvaluation, PromotionEvaluationEvidence, and EmployeePromotionEligibilitySummary. The summary type includes only employee-safe fields. Export contracts from schemas/index.ts and add a dedicated promotionEligibility query-key namespace.

- [ ] **Step 4: Run schema tests and typecheck.**

Run: npm run test:run -- src/schemas/promotion-eligibility.test.ts
Run: npm run typecheck
Expected: PASS.

- [ ] **Step 5: Commit the contracts.**

~~~
git add src/schemas/promotion-eligibility.ts src/schemas/promotion-eligibility.test.ts src/schemas/index.ts src/lib/types/database.ts src/lib/query-keys.ts
git commit -m "feat: add promotion eligibility contracts"
~~~

### Task 2: Secure promotion schema, evaluation calculation, and RLS tests

**Files:**
- Create: the migration generated by supabase migration new promotion_eligibility
- Create: supabase/tests/promotion_eligibility.test.sql

**Interfaces:**
- Consumes employees, qualifications, certifications, training_records, positions, profiles, user_roles, audit_logs, and private.require_active_hr from earlier migrations.
- Produces public RPCs create_promotion_criterion, update_promotion_criterion, create_performance_rating, update_performance_rating, create_promotion_evaluation, and update_promotion_evaluation.
- Produces employee-readable employee_promotion_eligibility_summaries rows only.

- [ ] **Step 1: Write a failing pgTAP suite before the migration.**

~~~
select extensions.has_table('public', 'promotion_criteria', 'Promotion criteria table exists');
select extensions.has_table('public', 'employee_promotion_eligibility_summaries', 'Employee-safe summary table exists');
select extensions.has_function('public', 'create_promotion_evaluation', array['uuid', 'integer', 'uuid', 'text', 'text', 'jsonb'], 'Evaluation RPC exists');
select extensions.ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.promotion_evaluations')), false), 'Evaluations use RLS');
~~~

Seed one HR account, an Employee with an official record, a second Employee, a target position, matching qualification/certification/training records, and one unrelated role. Assert HR creates criterion/rating/evaluation; the evaluation snapshots criteria and produces correct missing items; the Employee sees only their safe summary; the other Employee gets zero rows; non-HR RPC calls raise 42501; and an evaluation writes an audit row without changing employees.position_id.

- [ ] **Step 2: Run the pgTAP file to verify it fails.**

Run: supabase test db supabase/tests/promotion_eligibility.test.sql
Expected: FAIL because the schema and RPCs are absent. If the local stack is stopped, run supabase start first.

- [ ] **Step 3: Generate and implement the migration.**

Run supabase migration new promotion_eligibility, then implement the generated migration. Use UUID primary keys for exposed review records, identity keys for ordered requirement/evidence rows where appropriate, timestamptz audit fields, typed foreign keys, and indexes on every foreign key plus target-position/activity and HR-list ordering/filter columns.

~~~
alter table public.promotion_criteria enable row level security;
revoke all on public.promotion_criteria from anon, authenticated;
grant select on public.promotion_criteria to authenticated;

create policy promotion_criteria_select_hr on public.promotion_criteria
for select to authenticated
using ((select private.current_user_has_role('hr_personnel'::public.app_role)));
~~~

The data model is exact: criteria has target position, thresholds, active state, audit fields, and concurrency timestamp; requirements have kind/name/label/mandatory/ordinal; ratings have employee/rating/period/private notes; evaluations have employee/target position/criterion, criteria and missing JSONB snapshots, derived service years, readiness, recommendation, private notes, and concurrency timestamp; evidence populates exactly one of three typed personnel-record FKs; summaries have only employee ID, evaluation ID, target-position display data, calculation time, years, readiness, and missing requirements.

Private mutation functions must call private.require_active_hr(), validate every scalar/JSON array, lock updates with FOR UPDATE, compare expected_updated_at, verify evidence belongs to the evaluated employee and expected kind, calculate full completed years from employment_started_on, ignore expired certifications/training, write snapshots, upsert the restricted summary, and append audit_logs. Public wrappers are thin. Revoke private execution from all public roles; revoke public wrappers from public/anon; grant only authenticated.

- [ ] **Step 4: Run fresh-database and RLS verification.**

Run: supabase db reset
Run: supabase test db supabase/tests/promotion_eligibility.test.sql
Expected: migration applies cleanly and every pgTAP assertion passes.

- [ ] **Step 5: Commit the secure database deliverable.**

~~~
git add supabase/migrations supabase/tests/promotion_eligibility.test.sql
git commit -m "feat: add secure promotion eligibility data model"
~~~

### Task 3: Promotion query functions and TanStack Query hooks

**Files:**
- Create: src/queries/promotion-eligibility.ts
- Create: src/queries/promotion-eligibility.test.ts
- Create: src/hooks/use-promotion-eligibility.ts
- Create: src/hooks/use-promotion-eligibility.test.tsx

**Interfaces:**
- Consumes Task 1 contracts and Task 2 table/RPC names.
- Produces listPromotionCriteria, listPromotionEvaluations, getHrPromotionEmployee, getMyPromotionEligibility, and mutation functions/hooks for all HR workflows.

- [ ] **Step 1: Write failing query and hook tests with a mocked browser client.**

~~~
it("maps a validated evaluation to the public RPC payload", async () => {
  await createPromotionEvaluation({ employeeId, targetPositionId: 4, criterionId, recommendation: "deferred", notes: "Needs training", evidence: [] });
  expect(rpc).toHaveBeenCalledWith("create_promotion_evaluation", expect.objectContaining({
    target_employee_id: employeeId, target_position_id: 4, target_criterion_id: criterionId,
    target_recommendation: "deferred", target_evidence: [],
  }));
});

it("invalidates promotion and audit data after an evaluation mutation", async () => {
  renderHook(() => useCreatePromotionEvaluation(), { wrapper });
  await act(() => result.current.mutateAsync(validEvaluation));
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["promotion-eligibility"] });
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["administration", "audit-logs"] });
});
~~~

- [ ] **Step 2: Run the tests to verify they fail.**

Run: npm run test:run -- src/queries/promotion-eligibility.test.ts src/hooks/use-promotion-eligibility.test.tsx
Expected: FAIL because the query functions and hooks do not exist.

- [ ] **Step 3: Implement parsed reads, explicit RPC payloads, and invalidation.**

~~~
export async function getMyPromotionEligibility() {
  const { data, error } = await createBrowserSupabaseClient()
    .from("employee_promotion_eligibility_summaries")
    .select("*")
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error);
  return data as EmployeePromotionEligibilitySummary | null;
}

function useInvalidatePromotionEligibility() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ["promotion-eligibility"] });
    void client.invalidateQueries({ queryKey: ["personnel-records"] });
    void client.invalidateQueries({ queryKey: ["administration", "audit-logs"] });
  };
}
~~~

Use parsed, deterministic, paginated HR listing queries. Parse employee IDs before detail reads; only enable detail queries for non-empty IDs. Map every camelCase field to target_* RPC arguments explicitly; never spread browser objects into RPC calls.

- [ ] **Step 4: Run query/hook tests and typecheck.**

Run: npm run test:run -- src/queries/promotion-eligibility.test.ts src/hooks/use-promotion-eligibility.test.tsx
Run: npm run typecheck
Expected: PASS.

- [ ] **Step 5: Commit the client data layer.**

~~~
git add src/queries/promotion-eligibility.ts src/queries/promotion-eligibility.test.ts src/hooks/use-promotion-eligibility.ts src/hooks/use-promotion-eligibility.test.tsx
git commit -m "feat: add promotion eligibility data access"
~~~

### Task 4: HR criteria and review workspace

**Files:**
- Create: src/components/promotion-eligibility/promotion-criteria-manager.tsx
- Create: src/components/promotion-eligibility/promotion-criteria-manager.test.tsx
- Create: src/components/promotion-eligibility/hr-promotion-directory.tsx
- Create: src/components/promotion-eligibility/hr-promotion-review.tsx
- Create: src/components/promotion-eligibility/promotion-eligibility.test.tsx
- Create: src/app/(app)/hr/promotions/page.tsx
- Create: src/app/(app)/hr/promotions/criteria/page.tsx
- Create: src/app/(app)/hr/promotions/[employeeId]/page.tsx
- Modify: src/lib/app/role-config.ts
- Modify: src/components/app-shell/app-shell.test.tsx

**Interfaces:**
- Consumes Task 3 HR hooks and Task 1 contracts.
- Produces an HR list, criteria editor, and employee review surface. The review invokes only the performance-rating and evaluation mutation hooks.

- [ ] **Step 1: Write failing UI and route tests.**

~~~
it("lets HR add a mandatory certification requirement to a target position", async () => {
  render(<PromotionCriteriaManager />);
  await user.selectOptions(screen.getByLabelText("Target position"), "4");
  await user.selectOptions(screen.getByLabelText("Record kind"), "certification");
  await user.type(screen.getByLabelText("Required name"), "First Aid");
  await user.click(screen.getByRole("button", { name: "Save criteria" }));
  expect(createCriterion).toHaveBeenCalledWith(expect.objectContaining({ targetPositionId: 4 }));
});

it("labels the HR recommendation as advisory and offers no promotion action", () => {
  render(<HrPromotionReview employeeId={employeeId} />);
  expect(screen.getByText(/does not promote the employee automatically/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /promote/i })).not.toBeInTheDocument();
});
~~~

- [ ] **Step 2: Run the component and navigation tests to verify they fail.**

Run: npm run test:run -- src/components/promotion-eligibility src/components/app-shell/app-shell.test.tsx
Expected: FAIL because promotion components/routes/navigation are absent.

- [ ] **Step 3: Implement focused HR components and routes.**

~~~
export function HrPromotionReview({ employeeId }: { employeeId: string }) {
  const detail = useHrPromotionEmployee(employeeId);
  if (detail.isLoading) return <LoadingState label="Loading promotion review…" />;
  if (detail.error || !detail.data) return <ErrorState message={detail.error?.message ?? "Employee record was not found."} />;
  return <section className="space-y-6"><p className="rounded-lg bg-muted p-3 text-sm">This review is advisory. Saving it never changes the employee’s position or rank.</p><dl><div><dt>Years of service</dt><dd>{detail.data.yearsOfService}</dd></div></dl></section>;
}
~~~

Use existing FormField, Input, Button, LoadingState, ErrorState, and pagination components. Criteria support create, edit, and deactivate, never hard delete referenced rows. The review shows qualifications, certifications/training expiry, derived years, current criteria, matched/missing requirements, and manual recommendation. Parse invalid employeeId with uuidSchema in the route and call notFound(). Add HR navigation entries for Promotions and Promotion criteria using BriefcaseBusiness; add neither link to another role.

- [ ] **Step 4: Run the HR UI and navigation tests.**

Run: npm run test:run -- src/components/promotion-eligibility src/components/app-shell/app-shell.test.tsx
Expected: PASS, including no-auto-promotion assertions.

- [ ] **Step 5: Commit the HR workspace.**

~~~
git add src/components/promotion-eligibility src/app/(app)/hr/promotions src/lib/app/role-config.ts src/components/app-shell/app-shell.test.tsx
git commit -m "feat: add HR promotion review workspace"
~~~

### Task 5: Employee-safe page and full branch verification

**Files:**
- Create: src/components/promotion-eligibility/employee-promotion-eligibility.tsx
- Create: src/components/promotion-eligibility/employee-promotion-eligibility.test.tsx
- Create: src/app/(app)/employee/promotion-eligibility/page.tsx
- Modify: src/lib/app/role-config.ts
- Modify: src/app/(app)/role-layouts.test.tsx

**Interfaces:**
- Consumes useMyPromotionEligibility from Task 3 and EmployeePromotionEligibilitySummary from Task 1.
- Produces the Employee's read-only personal eligibility route and invokes no mutation hook.

- [ ] **Step 1: Write failing employee isolation tests.**

~~~
it("renders only the safe readiness summary and missing requirements", () => {
  useMyPromotionEligibility.mockReturnValue({ isLoading: false, data: {
    target_position_title: "Senior Officer", years_of_service: 3, is_ready: false,
    missing_requirements: ["First-aid certification"],
  } });
  render(<EmployeePromotionEligibility />);
  expect(screen.getByText("First-aid certification")).toBeInTheDocument();
  expect(screen.queryByText(/recommendation|performance rating|HR notes/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /save|edit|promote/i })).not.toBeInTheDocument();
});
~~~

- [ ] **Step 2: Run employee component and role tests to verify they fail.**

Run: npm run test:run -- src/components/promotion-eligibility/employee-promotion-eligibility.test.tsx src/app/(app)/role-layouts.test.tsx
Expected: FAIL because the employee component/route/navigation link is absent.

- [ ] **Step 3: Implement the employee page and navigation link.**

~~~
export function EmployeePromotionEligibility() {
  const query = useMyPromotionEligibility();
  if (query.isLoading) return <LoadingState label="Loading your promotion eligibility…" />;
  if (query.error) return <ErrorState message={query.error.message} />;
  if (!query.data) return <p className="rounded-xl border p-5 text-sm text-muted-foreground">HR has not published a promotion-readiness review for you.</p>;
  return <section className="space-y-4"><h1 className="text-3xl font-semibold">Promotion eligibility</h1><p className="text-sm text-muted-foreground">This is a readiness review, not an automatic promotion decision.</p><dl><div><dt>Years of service</dt><dd>{query.data.years_of_service}</dd></div></dl></section>;
}
~~~

Add only the Employee navigation item for /employee/promotion-eligibility. Keep it inside the existing Employee layout so requireRole("employee") applies. The component renders target position, calculation date, years of service, readiness, and missing requirements only; no rating, notes, recommendation, evidence link, mutation control, or other employee data.

- [ ] **Step 4: Run branch checks and fresh-database tests.**

Run: supabase db reset
Run: supabase test db supabase/tests/promotion_eligibility.test.sql
Run: npm run lint
Run: npm run typecheck
Run: npm run test:run
Run: npm run build
Expected: every command exits 0. If an unrelated pre-existing test fails, record its command/output separately and do not claim branch verification passed.

- [ ] **Step 5: Review the diff and commit the employee workflow.**

~~~
git diff --check
git status --short
git add src/components/promotion-eligibility/employee-promotion-eligibility.tsx src/components/promotion-eligibility/employee-promotion-eligibility.test.tsx src/app/(app)/employee/promotion-eligibility/page.tsx src/lib/app/role-config.ts src/app/(app)/role-layouts.test.tsx
git commit -m "feat: add employee promotion eligibility view"
~~~

## Plan self-review

- **Spec coverage:** Task 1 supplies validation/types/cache keys. Task 2 supplies tables, RLS, employee projection, calculations, snapshots, audit trail, and no-auto-promotion rule. Task 3 supplies safe data access/invalidation. Task 4 implements all HR pages and maintenance. Task 5 implements the Employee page, navigation, and all requested verification.
- **Placeholder scan:** The generated migration path is intentionally described as the exact output of the required Supabase command, because the project uses timestamped imperative migrations and the Supabase workflow forbids inventing a timestamp.
- **Type consistency:** Criterion, rating, evaluation, evidence, summary, recommendation, and cache-key names remain consistent across schema, database, query, hook, and UI tasks. Public RPC payloads use explicit target_* snake_case arguments.
