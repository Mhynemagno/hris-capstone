# Automatic Applicant Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically score every newly submitted application, including OCR of scanned CVs and credentials, without requiring HR to copy and paste document text.

**Architecture:** `submit_application` will create an immutable AI-score attempt and enqueue its identifier in a private durable Supabase Queue within the same transaction. A scheduled, service-authenticated Edge Function consumes small batches, downloads the private documents, asks the existing Gemini provider to extract/OCR and score the evidence, then records completed or failed state. A single delayed retry is queued for transient failures; HR can create a new retry attempt after the automatic retry is exhausted.

**Tech Stack:** Next.js 16, React, TypeScript, Vitest, Supabase Postgres/RLS/Storage, Supabase Queues (`pgmq`), Supabase Cron/`pg_net`, Supabase Edge Functions (Deno), Gemini API.

**Spec:** `docs/superpowers/specs/2026-08-27-automatic-applicant-analysis-design.md`

## Global Constraints

- Queueing starts automatically after every successful application submission.
- Accept PDF, PNG, and JPEG CVs/credentials only; analyze every accepted document, including scanned PDFs via Gemini OCR.
- Do not add an applicant consent checkbox or applicant-facing AI notice.
- Retry transient processing failures exactly once; the next failure is terminal until HR explicitly retries.
- HR is the final decision-maker; no score may change application status.
- Keep queue operations, service-role credentials, and Gemini credentials server-only.
- Do not persist extracted document text in browser-readable tables.
- Keep queue tables/functions unavailable to `anon` and `authenticated`; only HR can read score results and request a retry.
- Preserve current score attempts as immutable audit history; an HR retry creates a new attempt.

---

## File structure

- `supabase/migrations/<timestamp>_automatic_application_analysis.sql` — enables/configures the private queue, extends score states, transactionally queues submissions, and exposes the HR retry RPC.
- `supabase/tests/recruitment_and_applicant_portal.test.sql` — proves automatic queueing, RLS boundaries, retry authorization, and shortlist state mapping.
- `supabase/functions/_shared/application-document-analysis.ts` — downloads-independent document payload limits and Gemini OCR/scoring contracts.
- `supabase/functions/_shared/application-scoring-provider.ts` — extends Gemini requests from text-only scoring to document extraction plus structured scoring.
- `supabase/functions/_shared/application-document-analysis.test.ts` — unit tests MIME handling, bounded payload construction, OCR/scoring parsing, and provider error normalization.
- `supabase/functions/process-application-analysis/index.ts` — service-only queue consumer, retry handling, score persistence, and audit logging.
- `supabase/functions/process-application-analysis/index.test.ts` — worker tests with fake queue, storage, database, and Gemini dependencies.
- `supabase/functions/score-application/index.ts` and `.test.ts` — retire the public manual-analysis request path.
- `src/lib/types/database.ts` — application AI statuses and attempt metadata types.
- `src/schemas/recruitment.ts` — UI filter/status schemas and HR retry input.
- `src/queries/recruitment.ts` and `.test.ts` — invoke `retry_application_analysis`; remove manual CV-text Edge Function invocation.
- `src/hooks/use-recruitment.ts` — invalidate recommendation, shortlist, and report queries after an HR retry.
- `src/components/recruitment/hr-application-list.tsx` and `.test.tsx` — clear queued/processing/completed/failed language and filters.
- `src/components/recruitment/hr-application-detail.tsx` and `.test.tsx` — status panel and HR retry action; remove the manual textarea and checkbox.
- `src/components/recruitment/applicant-application-form.tsx` and `.test.tsx` — restrict uploads to PDF, PNG, and JPEG and explain the supported formats.
- `docs/DEPLOYMENT_RUNBOOK.md` — hosted queue, cron, Vault secret, Edge Function deployment, and rollback steps.

## Task 1: Create the durable analysis-attempt and queue contract

**Files:**
- Create: `supabase/migrations/<timestamp>_automatic_application_analysis.sql`
- Modify: `supabase/tests/recruitment_and_applicant_portal.test.sql`

**Interfaces:**
- Consumes: `private.submit_application(...)`, `public.application_ai_scores`, `public.list_hr_application_shortlist(...)`, and the existing `private.current_user_has_role(...)` authorization helper.
- Produces: score statuses `queued | processing | completed | failed`; `public.retry_application_analysis(target_application_id uuid) returns uuid`; private queue name `application_analysis`; queue payload `{"scoreId":"<uuid>"}`.

- [ ] **Step 1: Write database assertions for automatic queueing and access control**

Add pgTAP assertions that submit a valid application and verify exactly one new
score attempt has `status = 'queued'`, `attempt_count = 0`, and the submitted
application ID. Verify that the same applicant cannot select score attempts or
queue data, an HR fixture can select the queued attempt, and an HR fixture can
call `retry_application_analysis` only after an attempt is `failed`.

```sql
select extensions.is(
  (select status from public.application_ai_scores where application_id = application_id_fixture),
  'queued',
  'Application submission creates a queued analysis attempt'
);

set local role authenticated;
select extensions.throws_ok(
  $$ select public.retry_application_analysis('00000000-0000-4000-8000-000000009401') $$,
  '42501', null, 'Applicants cannot retry application analysis'
);
reset role;
```

- [ ] **Step 2: Run the database test to verify it fails**

Run: `npx --yes supabase test db --local supabase/tests/recruitment_and_applicant_portal.test.sql`

Expected: FAIL because `queued`, `attempt_count`, and `retry_application_analysis` do not exist.

- [ ] **Step 3: Generate and write the migration**

Run `npx --yes supabase migration new automatic_application_analysis`, then
implement the generated migration. Enable `pgmq`; create a durable private
queue named `application_analysis`; do not expose `pgmq_public` through the
Data API and do not grant queue access to browser roles.

Extend `application_ai_scores` with:

```sql
status text not null check (status in ('queued', 'processing', 'completed', 'failed')),
attempt_count smallint not null default 0 check (attempt_count between 0 and 2),
queued_at timestamptz not null default now(),
processing_started_at timestamptz,
completed_at timestamptz,
failure_code text
```

Keep `application_id` indexed. Add a partial index for active attempts:

```sql
create index application_ai_scores_active_attempt_idx
  on public.application_ai_scores (application_id, created_at desc)
  where status in ('queued', 'processing');
```

Update `private.submit_application` after document inserts and before its
return to create the queued score record and call `pgmq.send` with the returned
score ID. The insert and queue send must occur in the function's existing
transaction. Update `list_hr_application_shortlist` to return the new states.

Create `private.retry_application_analysis(target_application_id uuid) returns
uuid` that verifies the caller has `hr_personnel`, verifies the latest attempt
is terminal `failed`, creates a new queued attempt, sends its ID to the private
queue, and writes an audit log. Expose only the narrow public wrapper:

```sql
create or replace function public.retry_application_analysis(target_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.retry_application_analysis(target_application_id);
end;
$$;
```

Revoke `PUBLIC` execute and grant only `authenticated`; authorization remains
inside the private function. Add an explicit foreign-key index for every new
foreign key and use targeted grants rather than broad table permissions.

- [ ] **Step 4: Reset the local database and run the pgTAP suite**

Run: `npx --yes supabase db reset`

Run: `npx --yes supabase test db --local supabase/tests/recruitment_and_applicant_portal.test.sql`

Expected: PASS, including the new queued-attempt, RLS, and retry assertions.

- [ ] **Step 5: Run database safety checks**

Run: `npx --yes supabase db advisors --local --type security --level warn`

Run: `npx --yes supabase migration list --local`

Expected: no security warnings introduced; the new migration appears locally.

- [ ] **Step 6: Commit the durable queue contract**

```bash
git add supabase/migrations supabase/tests/recruitment_and_applicant_portal.test.sql
git commit -m "feat: queue applicant analysis after submission"
```

## Task 2: Extend Gemini document extraction and structured scoring

**Files:**
- Create: `supabase/functions/_shared/application-document-analysis.ts`
- Create: `supabase/functions/_shared/application-document-analysis.test.ts`
- Modify: `supabase/functions/_shared/application-scoring-provider.ts`
- Modify: `supabase/functions/_shared/application-scoring-provider.test.ts`

**Interfaces:**
- Consumes: private document bytes and MIME types from the worker; job criteria from `public.job_qualification_criteria`.
- Produces: `ApplicationDocumentInput`, `ApplicationDocumentAnalysis`, and `GeminiApplicationScoringProvider.analyzeDocuments(input)`.

- [ ] **Step 1: Write failing unit tests for document payload handling**

Define and test the exact worker-facing types:

```ts
export type ApplicationDocumentInput = {
  fileName: string;
  mimeType: "application/pdf" | "image/png" | "image/jpeg";
  bytes: Uint8Array;
};

export type ApplicationDocumentAnalysis = {
  score: number;
  explanation: string;
  provider: "gemini";
  model: string;
  modelVersion: string;
};
```

Test a text PDF, a scanned PDF, and a PNG input produce a bounded Gemini
request with document data; test an empty document list, an over-limit document,
and malformed Gemini JSON return the existing normalized provider errors.

- [ ] **Step 2: Run the Deno tests to verify they fail**

Run: `deno test --allow-net supabase/functions/_shared/application-document-analysis.test.ts supabase/functions/_shared/application-scoring-provider.test.ts`

Expected: FAIL because document types and `analyzeDocuments` are absent.

- [ ] **Step 3: Implement bounded Gemini document analysis**

Create `application-document-analysis.ts` with constants that enforce a maximum
of ten documents, 10 MiB per document, and a combined encoded payload cap. It
must accept only PDF, PNG, and JPEG MIME types already validated by the submission RPC and
must never log file bytes or extracted text.

Add this provider method while retaining the existing `score` method for
backward-compatible unit coverage until Task 3 removes the manual endpoint:

```ts
async analyzeDocuments(input: {
  documents: ApplicationDocumentInput[];
  criteria: Array<{ kind: string; requirement: string; isRequired: boolean }>;
}): Promise<ApplicationDocumentAnalysis>
```

Send document parts to Gemini with instructions to OCR scanned pages, consider
CV and credentials together, compare only against supplied criteria, and return
the same validated `{ score, explanation }` JSON schema. Map transport errors to
`provider_unavailable` and malformed/invalid model output to
`provider_invalid_response`.

- [ ] **Step 4: Run the Deno unit tests to verify they pass**

Run: `deno test --allow-net supabase/functions/_shared/application-document-analysis.test.ts supabase/functions/_shared/application-scoring-provider.test.ts`

Expected: PASS with text-PDF, scanned-PDF, image, bounds, and invalid-response
coverage.

- [ ] **Step 5: Commit the Gemini document-analysis provider**

```bash
git add supabase/functions/_shared/application-document-analysis.ts supabase/functions/_shared/application-document-analysis.test.ts supabase/functions/_shared/application-scoring-provider.ts supabase/functions/_shared/application-scoring-provider.test.ts
git commit -m "feat: analyze applicant documents with Gemini"
```

## Task 3: Build the server-only queue worker and automatic retry

**Files:**
- Create: `supabase/functions/process-application-analysis/index.ts`
- Create: `supabase/functions/process-application-analysis/index.test.ts`
- Modify: `supabase/functions/score-application/index.ts`
- Modify: `supabase/functions/score-application/index.test.ts`

**Interfaces:**
- Consumes: `application_analysis` queue messages shaped as `{ scoreId: string }`, private Storage document paths, criteria rows, and `GeminiApplicationScoringProvider.analyzeDocuments`.
- Produces: `POST /functions/v1/process-application-analysis` callable only with `ANALYSIS_WORKER_SECRET`; database transitions `queued -> processing -> completed | failed`; retry queue message delayed once.

- [ ] **Step 1: Write failing worker tests with injected dependencies**

Create tests around a factory to avoid network/database dependencies:

```ts
export function createProcessApplicationAnalysisHandler(deps?: {
  createClient?: ClientFactory;
  getEnv?: (name: string) => string | undefined;
  analyzeDocuments?: typeof GeminiApplicationScoringProvider.prototype.analyzeDocuments;
}): (request: Request) => Promise<Response>;
```

Test that the handler rejects a missing or invalid worker secret, claims a
five-message batch, marks an attempt `processing`, downloads the CV and
credentials, persists one completed score, and removes/archives its queue
message. Add separate tests for one delayed retry (`attempt_count` becomes `1`)
and a final failed state after the second attempt. Assert that raw document bytes
and extracted text are not included in audit-log metadata or response bodies.

- [ ] **Step 2: Run the worker tests to verify they fail**

Run: `deno test --allow-net supabase/functions/process-application-analysis/index.test.ts`

Expected: FAIL because the worker module does not exist.

- [ ] **Step 3: Implement the worker**

Implement `process-application-analysis` as a service-only POST endpoint. Check
`x-analysis-worker-secret` against `ANALYSIS_WORKER_SECRET` before queue access.
Use `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and
`SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY` only in the Edge Function.

For each claimed message:

1. Validate `scoreId` as a UUID and load its score attempt, application,
   documents, and ordered job criteria.
2. Atomically mark only a `queued` attempt as `processing`; safely discard a
   stale message for an already terminal attempt.
3. Download every document from `applicant-documents`, pass bounded data to
   `analyzeDocuments`, then update the same attempt to `completed` with score,
   explanation, provider/model metadata, and `completed_at`.
4. Write an `ai_scored` audit event containing only score ID, final status, and
   provider/model metadata.
5. On a transient normalized provider error, increment attempt count, return the
   record to `queued`, and enqueue the identical `scoreId` with a delay. On the
   next error, set `failed`, safe `failure_code`, and `completed_at`.
6. Remove/archive the queue message only after the score state transition is
   durable.

Retire the public manual request semantics from `score-application`: either
remove the function and its client call once no callers remain, or make it an
HR-only wrapper around `retry_application_analysis` with no CV-text body. Do
not leave an endpoint that accepts arbitrary applicant document text.

- [ ] **Step 4: Run worker and existing Edge Function tests**

Run: `deno test --allow-net supabase/functions/process-application-analysis/index.test.ts supabase/functions/score-application/index.test.ts`

Expected: PASS for completed processing, retry-once, terminal failure, secret
authorization, and the removed manual-text path.

- [ ] **Step 5: Commit the analysis worker**

```bash
git add supabase/functions/process-application-analysis supabase/functions/score-application
git commit -m "feat: process queued applicant analysis"
```

## Task 4: Replace manual HR analysis with status and retry UI

**Files:**
- Modify: `src/lib/types/database.ts`
- Modify: `src/schemas/recruitment.ts`
- Modify: `src/queries/recruitment.ts`
- Modify: `src/queries/recruitment.test.ts`
- Modify: `src/hooks/use-recruitment.ts`
- Modify: `src/components/recruitment/hr-application-list.tsx`
- Create: `src/components/recruitment/hr-application-list.test.tsx`
- Modify: `src/components/recruitment/hr-application-detail.tsx`
- Create: `src/components/recruitment/hr-application-detail.test.tsx`
- Modify: `src/components/recruitment/applicant-application-form.tsx`
- Modify: `src/components/recruitment/applicant-application-form.test.tsx`

**Interfaces:**
- Consumes: `public.retry_application_analysis(applicationId)` and score statuses `queued | processing | completed | failed | unscored`.
- Produces: `retryApplicationAnalysis(applicationId: string): Promise<string>` and `useRetryApplicationAnalysis()`.

- [ ] **Step 1: Write failing UI and query tests**

Add query tests asserting:

```ts
await retryApplicationAnalysis(applicationId);
expect(mocks.rpc).toHaveBeenCalledWith("retry_application_analysis", {
  target_application_id: applicationId,
});
```

Add component tests that render each recommendation state. Assert `queued` and
`processing` render **Analyzing application…**, completed renders score and
explanation, failed renders a reachable **Retry analysis** button, and a legacy
`unscored` application renders **Not analyzed** plus **Analyze existing
application**. Assert the old “Approved anonymized CV text” field, checkbox,
and manual “Analyze application” button are absent.

Add applicant form assertions that the file input accepts only
`.pdf,.png,.jpg,.jpeg`, helper text names those formats, and a DOC/DOCX upload
is rejected before any Storage upload occurs.

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `npm run test:run -- src/queries/recruitment.test.ts src/components/recruitment/hr-application-list.test.tsx src/components/recruitment/hr-application-detail.test.tsx`

Expected: FAIL because the retry query/hook and new state UI do not exist.

- [ ] **Step 3: Implement client contracts and UI states**

Update `ApplicationAiScore`, `HrShortlistApplication`, and Zod status filters to
include `queued` and `processing`. Replace
`requestApplicationAnalysis(input: ApplicationAnalysisRequestInput)` with:

```ts
export async function retryApplicationAnalysis(applicationId: string): Promise<string> {
  const id = applicationStatusTransitionSchema.shape.applicationId.parse(applicationId);
  const { data, error } = await createBrowserSupabaseClient().rpc(
    "retry_application_analysis",
    { target_application_id: id },
  );
  throwIfError(error);
  return idSchema.parse(data);
}
```

Add `useRetryApplicationAnalysis` with the same invalidations as score updates.
Refactor the HR detail recommendation section into a small state renderer so it
contains no textarea, manual confirmation checkbox, or applicant-supplied AI
text. The retry control must be disabled while its mutation is pending and show
errors through the existing `ErrorState` pattern. Update shortlist labels and
filter option copy to `Analyzing`, `Completed`, `Failed`, and `Not analyzed`.
Update the applicant form, schema, client extension allowlist, and submission
migration validation together so DOC/DOCX cannot be selected, uploaded, or
accepted through a forged client request.

- [ ] **Step 4: Run targeted tests to verify they pass**

Run: `npm run test:run -- src/queries/recruitment.test.ts src/components/recruitment/hr-application-list.test.tsx src/components/recruitment/hr-application-detail.test.tsx`

Expected: PASS with all four states and retry behavior covered.

- [ ] **Step 5: Commit the HR workflow update**

```bash
git add src/lib/types/database.ts src/schemas/recruitment.ts src/queries/recruitment.ts src/queries/recruitment.test.ts src/hooks/use-recruitment.ts src/components/recruitment
git commit -m "feat: show automatic applicant analysis status"
```

## Task 5: Configure the worker schedule, document deployment, and verify end to end

**Files:**
- Modify: `supabase/migrations/<timestamp>_automatic_application_analysis.sql`
- Modify: `docs/DEPLOYMENT_RUNBOOK.md`
- Modify: `README.md` only if it already contains Edge Function environment setup.

**Interfaces:**
- Consumes: `ANALYSIS_WORKER_SECRET`, `GEMINI_API_KEY`, `SUPABASE_URL`, publishable key, and service-role key as hosted Edge Function secrets; private `application_analysis` queue.
- Produces: a hosted recurring call to `process-application-analysis` and a rollback procedure that pauses queue consumption without deleting audit records.

- [ ] **Step 1: Add a deployment checklist test/document assertion**

Add a runbook checklist requiring the worker secret, Gemini key, queue module,
cron module, Vault scheduler secret, Edge Function deployment, and a smoke-test
application. Include an explicit expected outcome: shortlist transitions from
**Analyzing** to **Completed** without an HR text paste.

- [ ] **Step 2: Verify the new runbook requirement is not yet documented**

Run: `rg -n "ANALYSIS_WORKER_SECRET|process-application-analysis|application_analysis" docs/DEPLOYMENT_RUNBOOK.md`

Expected: no complete automatic-analysis deployment procedure is present.

- [ ] **Step 3: Document and configure scheduler migration statements**

In the migration, create the recurring job only after the worker endpoint and
secrets are available. Use Vault values for the hosted project URL and worker
secret; never embed secrets in SQL or repository files. The scheduled request
must call `process-application-analysis` every minute with only
`x-analysis-worker-secret` and JSON `{}`. Add a named unschedule statement to
the runbook rollback procedure.

Document the exact hosted deployment sequence:

1. Enable `pgmq`, `pg_cron`, and `pg_net`/Vault support in the hosted project.
2. Set `GEMINI_API_KEY` and `ANALYSIS_WORKER_SECRET` as Edge Function secrets.
3. Store the scheduler URL and worker secret in Vault.
4. Deploy `process-application-analysis`.
5. Apply the migration that enables automatic queueing and cron consumption.
6. Submit a test application and verify the score state and audit log.

Document rollback as: unschedule the worker first, leave queued/completed/failed
records intact for audit, then disable new queueing only through a follow-up
migration after confirming no application submissions are in flight.

- [ ] **Step 4: Run the complete local verification suite**

Run:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npx --yes supabase db reset
npx --yes supabase test db --local supabase/tests/recruitment_and_applicant_portal.test.sql
npx --yes supabase db advisors --local --type security --level warn
deno test --allow-net supabase/functions/_shared/application-document-analysis.test.ts supabase/functions/_shared/application-scoring-provider.test.ts supabase/functions/process-application-analysis/index.test.ts supabase/functions/score-application/index.test.ts
```

Expected: all commands exit 0. Inspect worker logs and the queued/completed
state using local Supabase only; do not print credentials or document content.

- [ ] **Step 5: Perform browser verification**

Run the local app and verify at desktop and a narrow mobile viewport:

1. Submit an application with a CV and credential.
2. Confirm the applicant can finish normally without an AI consent field.
3. Confirm HR sees **Analyzing application…** rather than **Not analyzed**.
4. Seed or mock a completed score and verify score/rationale readability.
5. Seed or mock a failed score and verify **Retry analysis** is visible, usable,
   and has a pending state.
6. Verify keyboard focus, button names, contrast, and absence of the old manual
   textarea/checkbox flow.

- [ ] **Step 6: Commit deployment docs and final verification updates**

```bash
git add supabase/migrations docs/DEPLOYMENT_RUNBOOK.md README.md
git commit -m "docs: document applicant analysis worker deployment"
```

## Plan self-review

- Spec coverage: Task 1 implements transactional automatic queueing, durable
  state, RLS, auditability, and HR retry authorization. Task 2 implements
  Gemini text extraction/OCR for CVs and credentials. Task 3 implements
  scheduled worker consumption and retry-once behavior. Task 4 replaces the
  manual UI with explicit state and retry interactions. Task 5 covers scheduler
  deployment, rollback, automated checks, and browser verification.
- Placeholder scan: no `TODO`, `TBD`, or deferred implementation steps remain.
- Type consistency: `scoreId` is the queue payload field throughout; queued
  statuses are `queued | processing | completed | failed`; HR retries are
  `retry_application_analysis(target_application_id uuid)` in SQL and
  `retryApplicationAnalysis(applicationId: string)` in TypeScript.
