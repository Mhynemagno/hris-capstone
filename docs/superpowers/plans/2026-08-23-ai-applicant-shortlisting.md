# AI Applicant Shortlisting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure, HR-triggered Gemini recommendation flow that scores approved anonymized CV text against job criteria and ranks the HR application queue without changing hiring decisions.

**Architecture:** A server-only `score-application` Edge Function authorizes HR, obtains job criteria, calls a testable Gemini provider, and persists only a normalized recommendation record. A RLS-protected score table plus an HR-only shortlist RPC provides ranking, while the Next.js client adds Zod validation, TanStack Query mutations, filters, and clear advisory-only UI.

**Tech Stack:** Next.js 16, TypeScript, React 19, TanStack Query, React Hook Form, Zod 4, Supabase PostgreSQL/RLS/pgTAP, Supabase Edge Functions (Deno), Gemini REST API.

**Spec:** `docs/superpowers/specs/2026-08-23-ai-applicant-shortlisting-design.md`

## Global Constraints

- Use only dummy, consented, or anonymized CV text; never read, parse, or send private uploaded CV files to Gemini.
- Retain no raw CV text, prompt, provider response, or API key in database rows, logs, audit metadata, browser code, or commits.
- `GEMINI_API_KEY` is an Edge Function secret only; never add it or any secret to a `NEXT_PUBLIC_*` variable or `.env.example`.
- Validate at the browser and Edge Function boundaries with Zod; validate Gemini's normalized JSON response before persistence.
- Only `hr_personnel` may request or read AI analyses. Applicants, Employees, Management, anonymous users, and non-HR authenticated users are denied.
- AI analysis is advisory only. It must not invoke or modify the `transition_application_status` or `hire_application` workflows and can never set `Hired` or `Not Selected`.
- Follow existing Supabase function patterns: CORS preflight, bearer-token verification, caller-role check, server-only service client, generic user-facing errors, and dependency-injected handlers for Deno tests.
- Generate the imperative migration using `supabase migration new ai_applicant_shortlisting`; do not invent its timestamped filename.

---

## File Structure

- `supabase/migrations/<generated>_ai_applicant_shortlisting.sql` — score table, integrity checks, RLS/grants, ranking RPC, and indexes.
- `supabase/tests/recruitment_and_applicant_portal.test.sql` — pgTAP constraints and HR/non-HR score access coverage.
- `supabase/functions/_shared/application-scoring-provider.ts` — provider contract and Gemini REST implementation with injected fetch.
- `supabase/functions/_shared/application-scoring-provider.test.ts` — request, response, and failure tests.
- `supabase/functions/score-application/index.ts` — protected scoring handler, persistence, and safe audit entries.
- `supabase/functions/score-application/index.test.ts` — authorization, validation, provider, and advisory-only behavior.
- `src/schemas/recruitment.ts`, `src/schemas/index.ts`, `src/lib/types/database.ts`, and `src/lib/query-keys.ts` — shared client contracts.
- `src/queries/recruitment.ts` and `src/hooks/use-recruitment.ts` — data access, invocation, and cache invalidation.
- `src/components/recruitment/hr-application-list.tsx`, `hr-application-detail.tsx`, and `hr-job-editor.tsx` — ranked queue, recommendation detail, and criteria guidance.
- `docs/AI_SHORTLISTING_SETUP.md` — secret configuration, deployment, and privacy-safe demo steps.

### Task 1: Persist and securely query AI recommendation history

**Files:**
- Create: `supabase/migrations/<generated>_ai_applicant_shortlisting.sql`
- Modify: `supabase/tests/recruitment_and_applicant_portal.test.sql`

**Interfaces:**
- Consumes: `public.applications`, `public.user_roles`, and existing `private.current_user_has_role`.
- Produces: `public.application_ai_scores` and `public.list_hr_application_shortlist(target_application_status text, target_ai_status text, minimum_score smallint)`.

- [ ] **Step 1: Write the failing pgTAP tests**

Run `supabase migration new ai_applicant_shortlisting`. In the recruitment pgTAP file, add assertions for the new table and RPC; create completed score fixtures; assert HR can read rows; assert an applicant sees zero rows and cannot insert; and assert the ranking function returns the latest completed recommendation per application in descending score order. Increase `extensions.plan(33)` by the exact number of assertions added.

~~~sql
select extensions.has_table('public', 'application_ai_scores', 'AI score table exists');
select extensions.has_function(
  'public', 'list_hr_application_shortlist',
  array['text', 'text', 'smallint'], 'HR shortlist RPC exists'
);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009102';
select extensions.is(
  (select count(*) from public.application_ai_scores), 0::bigint,
  'Applicants cannot read AI recommendations'
);
select extensions.throws_ok(
  $$insert into public.application_ai_scores (application_id, requested_by_user_id, status)
    values ('00000000-0000-4000-8000-000000009401', '00000000-0000-4000-8000-000000009102', 'pending')$$,
  '42501', null, 'Applicants cannot write AI recommendations'
);
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx --yes supabase@latest test db --local supabase/tests/recruitment_and_applicant_portal.test.sql`

Expected: FAIL because the table and RPC do not exist.

- [ ] **Step 3: Write the minimal secure migration**

Create an append-only score history table with a UUID primary key, application/requester foreign keys, `pending|completed|failed` status, nullable `score smallint` constrained to 0--100, bounded explanation/provider/model/model-version/failure-code fields, and `input_at`, `completed_at`, and `created_at` timestamptz fields. A check must require score/explanation/provider/model/version/completion data only for `completed` rows, and restrict failed rows to an allow-listed safe failure code.

Index the foreign key and completed ranking path. Enable RLS, revoke default table access, grant only `SELECT` to `authenticated`, and create an HR-only select policy using the existing role helper wrapped in a scalar select. Do not create any browser write policy.

Create a `SECURITY INVOKER`, `set search_path = ''` SQL RPC which left-joins the latest score to each application, applies nullable application-status/AI-status/minimum-score filters, places completed scores descending before failed/unscored rows, and relies on underlying RLS to return no rows for non-HR callers. Revoke public execution and grant it only to authenticated callers.

~~~sql
create index application_ai_scores_application_created_idx
  on public.application_ai_scores (application_id, created_at desc);
create index application_ai_scores_completed_score_idx
  on public.application_ai_scores (score desc, completed_at desc)
  where status = 'completed';

create policy application_ai_scores_select_hr
  on public.application_ai_scores for select to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)));
~~~

- [ ] **Step 4: Run the database test to verify it passes**

Run: `npx --yes supabase@latest db reset --local && npx --yes supabase@latest test db --local supabase/tests/recruitment_and_applicant_portal.test.sql`

Expected: PASS with all existing recruitment assertions and the new RLS/ranking assertions.

- [ ] **Step 5: Commit**

~~~bash
git add supabase/migrations supabase/tests/recruitment_and_applicant_portal.test.sql
git commit -m "feat: add secure applicant AI score storage"
~~~

### Task 2: Build the testable Gemini scoring Edge Function

**Files:**
- Create: `supabase/functions/_shared/application-scoring-provider.ts`
- Create: `supabase/functions/_shared/application-scoring-provider.test.ts`
- Create: `supabase/functions/score-application/index.ts`
- Create: `supabase/functions/score-application/index.test.ts`

**Interfaces:**
- Consumes: Task 1 schema, existing HR roles/job criteria, `GEMINI_API_KEY`, `SUPABASE_URL`, and the server-only Supabase secret.
- Produces: `ApplicationScoringProvider.score(input)`, `createScoreApplicationHandler(dependencies?)`, and `{ scoreId, status, score?, explanation?, model?, modelVersion? }`.

- [ ] **Step 1: Write failing provider and handler tests**

Use injected fetch/client factories as in `delete-managed-user/index.test.ts`. Assert a successful Gemini request includes only CV text and job criteria, requests JSON output, and never sends document paths, applicant identifiers, or user data. Test malformed JSON and non-2xx Gemini responses. Test the handler rejects wrong methods, missing JWT, non-HR roles, false consent, invalid/oversized CV text, missing application/criteria, absent key, and invalid provider output. Test success writes pending then completed score data and safe audit metadata; provider failure writes only a safe failure code. Assert no test double receives a status-transition or hiring invocation.

~~~ts
Deno.test("rejects analysis without explicit anonymization confirmation", async () => {
  const response = await handler(request({
    applicationId, cvText: "A".repeat(80), confirmedAnonymized: false,
  }));
  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "Invalid analysis request." });
});

Deno.test("stores only an advisory recommendation", async () => {
  const response = await handler(request(validRequest));
  assertEquals(response.status, 201);
  assertEquals(applicationStatusUpdates.length, 0);
  assertEquals(storedScore.status, "completed");
});
~~~

- [ ] **Step 2: Run the Deno tests to verify they fail**

Run: `deno test --allow-env supabase/functions/_shared/application-scoring-provider.test.ts supabase/functions/score-application/index.test.ts`

Expected: FAIL because the provider and handler are absent.

- [ ] **Step 3: Implement the provider contract and Gemini adapter**

Define input/output interfaces and Zod response schema. The adapter accepts CV text and normalized job criteria, reads only `GEMINI_API_KEY`, calls Gemini with a JSON-only response instruction, validates `{ score, explanation }`, and returns normalized provider/model/version metadata. The adapter must neither log nor return prompt/raw response content and must map upstream conditions to safe internal codes.

~~~ts
export type ApplicationScoringInput = {
  cvText: string;
  criteria: Array<{ kind: string; requirement: string; isRequired: boolean }>;
};
export type ApplicationScoringResult = {
  score: number;
  explanation: string;
  provider: "gemini";
  model: string;
  modelVersion: string;
};
export interface ApplicationScoringProvider {
  score(input: ApplicationScoringInput): Promise<ApplicationScoringResult>;
}
~~~

- [ ] **Step 4: Implement the protected handler**

Mirror `createDeleteManagedUserHandler`: support CORS OPTIONS/POST, extract bearer JWT, use Zod to validate input, authenticate the caller, require `hr_personnel`, load only the selected application's criteria, and use the service client after authorization to persist score/audit records. Insert a pending row before scoring; update it to completed after validated provider output; otherwise update it to failed with an allow-listed code. Return only generic browser errors: `Invalid analysis request.`, `HR access is required.`, `AI analysis is unavailable.`, and `Unable to score this application.`.

~~~ts
export function createScoreApplicationHandler(
  dependencies: ScoreApplicationDependencies = {},
) {
  return async (request: Request) => {
    // authenticate HR, load criteria, persist pending, call provider,
    // then persist completed or failed without changing application status
  };
}

if (import.meta.main) Deno.serve(createScoreApplicationHandler());
~~~

- [ ] **Step 5: Run the Deno tests to verify they pass**

Run: `deno test --allow-env supabase/functions/_shared/application-scoring-provider.test.ts supabase/functions/score-application/index.test.ts`

Expected: PASS with no real Gemini key; all access, redaction, and advisory-only scenarios are covered by mocks.

- [ ] **Step 6: Commit**

~~~bash
git add supabase/functions/_shared/application-scoring-provider.ts supabase/functions/_shared/application-scoring-provider.test.ts supabase/functions/score-application
git commit -m "feat: add secure AI applicant scoring function"
~~~

### Task 3: Add shared client contracts and data access

**Files:**
- Modify: `src/schemas/recruitment.ts`
- Modify: `src/schemas/index.ts`
- Modify: `src/schemas/recruitment.test.ts`
- Modify: `src/lib/types/database.ts`
- Modify: `src/lib/query-keys.ts`
- Modify: `src/queries/recruitment.ts`
- Modify: `src/hooks/use-recruitment.ts`
- Modify: `src/hooks/use-recruitment.test.tsx`

**Interfaces:**
- Consumes: Task 1 shortlist RPC/score table and Task 2 Edge Function.
- Produces: `applicationAnalysisRequestSchema`, `applicationAiFiltersSchema`, `getApplicationAiScores`, `requestApplicationAnalysis`, `useApplicationAiScores`, and `useRequestApplicationAnalysis`.

- [ ] **Step 1: Write failing schema/query/hook tests**

Test a confirmed UUID request containing 80--30,000 text characters, and failures for false confirmation, bad UUID, blank/oversized text, and score range outside 0--100. Mock `functions.invoke` to prove input is validated before invoking the Edge Function. Mock the shortlist RPC to prove UI filter fields map to `target_application_status`, `target_ai_status`, and `minimum_score`. Assert successful scoring invalidates application-list, application-detail, and score-detail cache keys.

~~~ts
expect(applicationAnalysisRequestSchema.safeParse({
  applicationId, cvText: "A".repeat(80), confirmedAnonymized: true,
}).success).toBe(true);
expect(applicationAnalysisRequestSchema.safeParse({
  applicationId, cvText: "A".repeat(80), confirmedAnonymized: false,
}).success).toBe(false);
~~~

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm run test:run -- src/schemas/recruitment.test.ts src/hooks/use-recruitment.test.tsx`

Expected: FAIL because the analysis schemas, query methods, and hooks do not exist.

- [ ] **Step 3: Implement schemas, data types, queries, and hooks**

Add the analysis request schema, status enum, filter schema, `ApplicationAiScore`, and `HrShortlistApplication`. Add `queryKeys.recruitment.aiScores(applicationId)`. Query rankings with the Task 1 RPC, read score history ordered newest-first, and invoke `score-application` only after parsing input. Add a mutation hook that invalidates every recruitment queue plus the selected application and its score history after success.

~~~ts
export const applicationAnalysisRequestSchema = z.object({
  applicationId: uuidSchema,
  cvText: z.string().trim().min(80).max(30_000),
  confirmedAnonymized: z.literal(true),
});

export function useRequestApplicationAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestApplicationAnalysis,
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "applications"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.application(input.applicationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.aiScores(input.applicationId) });
    },
  });
}
~~~

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npm run test:run -- src/schemas/recruitment.test.ts src/hooks/use-recruitment.test.tsx`

Expected: PASS; invalid data never reaches the function, filters map correctly, and mutation success refreshes affected data.

- [ ] **Step 5: Commit**

~~~bash
git add src/schemas/recruitment.ts src/schemas/index.ts src/schemas/recruitment.test.ts src/lib/types/database.ts src/lib/query-keys.ts src/queries/recruitment.ts src/hooks/use-recruitment.ts src/hooks/use-recruitment.test.tsx
git commit -m "feat: add AI shortlist client data access"
~~~

### Task 4: Deliver the HR ranking and review experience

**Files:**
- Modify: `src/components/recruitment/hr-application-list.tsx`
- Modify: `src/components/recruitment/hr-application-detail.tsx`
- Modify: `src/components/recruitment/hr-job-editor.tsx`
- Modify: `src/components/recruitment/hr-recruitment-workspace.test.tsx`

**Interfaces:**
- Consumes: Task 3 shortlist rows, score history hook, and scoring mutation.
- Produces: ranked/filterable HR queue, analysis form, explanation/retry state, criteria guidance, and advisory-only copy.

- [ ] **Step 1: Write failing component tests**

Extend the recruitment hook mock with `useApplicationAiScores` and `useRequestApplicationAnalysis`. Assert the list has application-status, AI-status, and minimum-score controls; labels scores as AI recommendations; and keeps unscored/failed applications visible. Assert detail renders “HR makes the final decision,” blocks mutation until consent, submits application ID/text/confirmation, displays score/explanation/model, and offers retry for a failed analysis. Assert analysis never invokes the existing transition or hire mocks.

~~~tsx
await user.type(screen.getByLabelText("Approved anonymized CV text"), "A".repeat(80));
await user.click(screen.getByLabelText("I confirm this text is anonymized and approved for AI analysis"));
await user.click(screen.getByRole("button", { name: "Analyze application" }));
expect(mocks.analyze).toHaveBeenCalledWith({
  applicationId: "00000000-0000-0000-0000-000000000001",
  cvText: "A".repeat(80),
  confirmedAnonymized: true,
});
expect(screen.getByText("HR makes the final decision.")).toBeInTheDocument();
~~~

- [ ] **Step 2: Run the component test to verify it fails**

Run: `npm run test:run -- src/components/recruitment/hr-recruitment-workspace.test.tsx`

Expected: FAIL because recommendation components and filters are absent.

- [ ] **Step 3: Implement the smallest accessible UI changes**

Add labeled filter controls to the list and use the hook filters. Display score state independently from application status. In the application detail, render the static human-decision notice, current/latest score panel, failed/retry state, controlled textarea, consent checkbox, and Analyze button. Hold CV text only in component state, clear it after success, never place it in a URL/query key, and use generic error text. Add concise guidance beside the existing job criteria editor that required/preferred criteria inform the advisory analysis.

~~~tsx
<p className="rounded-xl border border-primary/30 bg-muted p-4 text-sm">
  HR makes the final decision. AI scores are recommendations only and never change an application status.
</p>
<FormField htmlFor="ai-cv-text" label="Approved anonymized CV text">
  <textarea id="ai-cv-text" value={cvText} onChange={(event) => setCvText(event.target.value)} />
</FormField>
~~~

- [ ] **Step 4: Run the component test to verify it passes**

Run: `npm run test:run -- src/components/recruitment/hr-recruitment-workspace.test.tsx`

Expected: PASS; the UI safely requests scoring, displays rankings/explanations, and preserves human controls.

- [ ] **Step 5: Commit**

~~~bash
git add src/components/recruitment/hr-application-list.tsx src/components/recruitment/hr-application-detail.tsx src/components/recruitment/hr-job-editor.tsx src/components/recruitment/hr-recruitment-workspace.test.tsx
git commit -m "feat: add HR AI applicant shortlist UI"
~~~

### Task 5: Document deployment and run full verification

**Files:**
- Create: `docs/AI_SHORTLISTING_SETUP.md`

**Interfaces:**
- Consumes: Tasks 1--4 and the approved design.
- Produces: operator configuration instructions and verified feature handoff evidence.

- [ ] **Step 1: Write the failing documentation checklist**

Create a checklist requiring a Gemini API key, the `GEMINI_API_KEY` Supabase Edge Function secret, deployment of `score-application`, dummy/consented/anonymized data only, HR verification, and proof that non-HR roles cannot view results. Do not include a secret value.

- [ ] **Step 2: Verify the documentation is initially absent**

Run: `Test-Path docs/AI_SHORTLISTING_SETUP.md`

Expected: `False`.

- [ ] **Step 3: Write setup and privacy guidance**

Include these operator commands with a replacement value only, and explain that automated tests mock the provider and that `.env.example` deliberately remains public-only.

~~~powershell
supabase secrets set GEMINI_API_KEY="<your-key>"
supabase functions deploy score-application
~~~

- [ ] **Step 4: Run complete verification**

Run:

~~~powershell
npm run lint
npm run typecheck
npm run test:run
npm run build
npx --yes supabase@latest db reset --local
npx --yes supabase@latest test db --local
deno test --allow-env supabase/functions/_shared/application-scoring-provider.test.ts supabase/functions/score-application/index.test.ts
git diff --check
git status --short
~~~

Expected: every command exits 0; status shows only intended setup documentation before committing it.

- [ ] **Step 5: Commit and prepare handoff**

~~~bash
git add docs/AI_SHORTLISTING_SETUP.md
git commit -m "docs: add AI shortlisting setup guidance"
~~~

Prepare a PR to `main` that names branch `feat/10-ai-applicant-shortlisting`, task-10 acceptance criteria, migration/RLS changes, `GEMINI_API_KEY` configuration, verification output, and screenshots of the HR queue/detail. Do not begin task 11 until this PR is reviewed, merged, and local `main` is current.
