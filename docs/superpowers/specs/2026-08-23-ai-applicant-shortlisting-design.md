# AI Applicant Shortlisting Design

## Purpose and boundaries

Feature 10 adds HR-reviewed AI recommendations to the existing recruitment
workflow. It scores an approved, anonymized CV text submission against the
opening's required and preferred qualification criteria, produces an
explanation, and ranks the HR application queue.

The feature never reads or sends the private uploaded CV files to Gemini,
does not retain submitted CV text, and does not change an application status.
In particular, it cannot set an application to `Hired` or `Not Selected`.
Only an HR user can make those decisions through the existing review and
hiring workflows. Demonstrations must use dummy, consented, or anonymized
text only.

## Architecture and data flow

The browser continues to use the existing Supabase client, shared Zod schemas,
and TanStack Query hooks. An HR user opens an application, pastes approved and
anonymized CV text, confirms that it is safe to submit, and explicitly starts
the analysis.

The browser invokes a new `score-application` Supabase Edge Function with the
application ID, CV text, and confirmation. The function uses the request JWT
to verify an active `hr_personnel` caller, validates input with Zod, and loads
the application and its job criteria. It calls a provider interface whose
initial Gemini implementation is configured only by the server-side
`GEMINI_API_KEY` secret. The provider must return structured JSON containing a
0--100 score and a concise explanation; that response is validated before it
is stored.

The function records a completed or failed analysis in `application_ai_scores`
without storing raw CV text or provider request/response payloads. A failed
analysis reports a safe generic error to HR and stores only a non-sensitive
failure status. It must not expose the provider key, raw provider error, or
personal data in logs. The function writes an audit entry that records an AI
analysis was requested, by whom, and its outcome, but not the CV text.

## Data model and authorization

`application_ai_scores` is an append-only recommendation history with:

- a UUID primary key and the application foreign key;
- an integer score constrained to 0--100 when the analysis is complete;
- a bounded explanation;
- provider/model/version identifiers;
- `pending`, `completed`, or `failed` status;
- requester identity, input timestamp, completion timestamp, and a nullable
  safe failure code.

The table has a foreign-key index on `application_id` and an index aligned to
the HR ranked-queue query (`status`, score descending, most-recent completion).
It enables RLS, revokes default Data API privileges, and grants read access
only to HR Personnel. Browser clients receive no insert, update, or delete
permission; the Edge Function uses its server-only credential after verifying
the caller's role. Applicants, Employees, Management, anonymous users, and
non-HR authenticated users cannot read AI scores or trigger scoring.

The existing qualification-criteria editor already supports required and
preferred criteria. This feature preserves that configuration and uses it as
the sole scoring basis; it does not introduce automated weights, applicant
status changes, or document extraction.

## HR experience

`/hr/jobs/[jobId]` continues to expose the opening's criteria editor and adds
plain-language guidance explaining that required and preferred criteria are
used by the advisory analysis.

`/hr/applications` gains filters for application status, AI-analysis status,
and score range. Its default AI view orders each application's latest completed
recommendation from highest to lowest score while keeping unscored and failed
applications visible. Each row clearly distinguishes an AI recommendation
from the application's HR-managed status.

`/hr/applications/[applicationId]` adds an AI recommendation panel. It shows
the latest score, model/version, analysed time, explanation, and failed state
when relevant. Its controlled form accepts approved anonymized CV text, makes
the confirmation explicit, and offers a retry after a provider failure. A
prominent notice states that HR makes every final decision and that analysis
does not alter the application workflow. Existing status-transition and hiring
controls remain independent.

Successful analysis or retry invalidates the HR application queue and the
affected application detail query. The UI supplies loading, validation,
authorization, empty, and safe provider-failure states using existing shared
components.

## Validation, safety, and errors

Shared application schemas validate the application ID, boolean consent
confirmation, bounded plain-text CV submission, analysis filters, score range,
and the normalized provider result. The Edge Function repeats equivalent
validation and rejects malformed JSON, missing JWTs, non-HR roles, invalid or
inaccessible applications, missing criteria, misconfigured provider secrets,
and malformed provider responses.

Only generic error messages reach the browser. Runtime logs and audit metadata
contain request IDs, actor/application identifiers, status, provider/model
metadata, and safe error codes only. They exclude CV text, uploaded document
contents, prompts, API keys, and raw Gemini responses.

## Tests and verification

- Unit tests cover all new Zod schemas, especially invalid IDs, unconfirmed or
  oversized CV text, invalid filters, and malformed provider JSON.
- Edge Function tests cover request methods, JWT and HR-role enforcement,
  safe request construction, provider success/failure/malformed-response
  handling, no sensitive logging, and secret isolation.
- Query, hook, and component tests cover invoking an analysis, ranked and
  filtered queue output, latest-score detail display, retry behavior, cache
  invalidation, and the permanent HR-final-decision notice.
- pgTAP tests cover constraints, direct-write denial, HR read permission,
  non-HR and applicant denial, and indexes/RLS behavior for score access.
- Repository linting, typechecking, unit tests, production build, Supabase
  migration reset/tests, and relevant Edge Function tests verify the completed
  branch. Runtime Gemini testing additionally requires `GEMINI_API_KEY` to be
  configured as an Edge Function secret; automated tests use a mock provider.
