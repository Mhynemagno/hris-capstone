# Automatic applicant analysis design

## Purpose

Automatically create an AI recommendation when an applicant submits a job
application. The recommendation helps HR prioritize review; it never changes an
application status or makes a hiring decision.

The present process is manual: HR must copy anonymized CV text, confirm a
checkbox, and press an analysis button. This design replaces that repetitive
step with reliable background processing of the submitted CV and credentials.

## Confirmed product decisions

- Start analysis automatically after every successful application submission.
- Include the CV and uploaded credentials in the analysis.
- Accept PDF, PNG, and JPEG documents only. Support both text-based and scanned
  PDFs through OCR; reject legacy Word documents before submission.
- Reuse the existing Gemini integration for extraction/OCR and scoring; do not
  introduce a second OCR vendor in this release.
- Do not add an applicant consent checkbox or applicant-facing AI notice.
- Retry transient extraction or provider failures once automatically.
- After the automatic retry, expose a clear HR-only **Retry analysis** action.
- HR remains the final decision-maker.

## Recommended architecture

Use a durable Supabase queue, not a browser request, to decouple submission
from document processing. Browser-driven analysis can be interrupted when an
applicant navigates away. A queued worker survives that interruption and makes
retries, status reporting, and audit history explicit.

### Submission path

1. The existing `submit_application` database function persists the application
   and the submitted document records.
2. In the same transaction, it creates an `application_ai_scores` record with a
   `queued` status and immutable references to the application, its job criteria,
   and submitted documents.
3. It enqueues only the score-record identifier on a private `application_analysis`
   queue. The browser never reads from or writes to that queue.
4. The applicant sees a normal submission success state. The HR shortlist shows
   **Analyzing** as soon as the queued score record is visible.

Putting the score record and queue message in the submission transaction means a
successfully submitted application cannot silently be left with no analysis job.

### Worker path

1. A scheduled, server-authenticated Edge Function reads a bounded batch from
   the queue. It is invoked regularly through the supported Supabase scheduler;
   it is not invoked by an applicant browser.
2. The worker uses a service-role client only inside the Edge Function to read
   the referenced private Storage objects. No signed document URLs are stored in
   the queue or exposed to clients.
3. It sends each accepted PDF, PNG, or JPEG document to the existing Gemini provider for text
   extraction. Native text is used where available and Gemini OCR is used for
   scanned pages. The worker combines CV and credential text, with size and
   page limits to keep processing bounded.
4. The provider evaluates the extracted evidence against the job's stored
   qualification criteria and returns the existing structured score,
   explanation, provider, model, and model-version fields.
5. The worker atomically records either `completed` with the recommendation, or
   `failed` with a safe failure code. It archives/deletes the completed queue
   message only after the database result is durable.

### Retries and recovery

- A first transient processing failure requeues the same job after a short
  delay and increments an attempt counter.
- A second failure records `failed`; it does not retry indefinitely.
- The HR application detail page shows the failure state and a **Retry
  analysis** button. That action creates a new score attempt and queues it; it
  does not mutate the failed audit record.
- More than one worker may run. Job claiming/processing uses the queue's
  visibility controls and short database transactions so workers never block
  each other or score the same attempt twice.

## Data model and access control

Extend `application_ai_scores` rather than creating a parallel recommendation
model. Add states needed by automation (`queued` and `processing`), an attempt
counter, and processing timestamps. Preserve completed and failed records as
the audit history. The HR shortlist continues to select the newest score record
for each application.

Database work will:

- retain an indexed `application_id` foreign key and add only targeted indexes
  for the current-status/retry queries;
- enforce valid state transitions and bounded attempts with database
  constraints or privileged functions;
- keep queue tables/functions unexposed to browser roles;
- grant the browser only the HR reads and explicit retry RPC already required
  for the workflow;
- keep service-role credentials and Gemini keys in Edge Function secrets, never
  in the web client or migration files.

## HR user experience

The manual textarea, anonymization checkbox, and **Analyze application** button
are removed from the HR application detail page.

The recommendation panel instead has four clear states:

| State | HR display |
| --- | --- |
| `queued` or `processing` | **Analyzing application…** with a non-blocking progress explanation |
| `completed` | Score, concise rationale, provider/model metadata, and a reminder that HR decides |
| `failed` | **Analysis failed** with a plain-language reason and **Retry analysis** |
| no record (legacy applications) | **Not analyzed** and an HR-only **Analyze existing application** action |

The shortlist uses the same language, replacing the ambiguous `Not analyzed`
display for new submissions with `Analyzing` while work is queued.

## Error handling and observability

- Keep provider and OCR failures out of user-facing error text; display a
  clear, safe status instead.
- Record audit-log events for queued, retried, completed, and failed analysis.
- Store no extracted document text in browser-visible tables. Retain only the
  structured recommendation and metadata currently needed for review.
- Surface worker errors through Edge Function logs and database audit data.
- Rate-limit batch processing and enforce file/page/text limits to prevent one
  application from exhausting worker capacity.

## Testing and verification

- Database tests: application submission produces exactly one queued score/job;
  RLS prevents applicants from reading scores or queue data; HR may read the
  recommendation and request a retry.
- Edge Function tests: text-PDF extraction, scanned-PDF OCR, credential
  aggregation, completed persistence, retry scheduling, final failure, and
  safe error responses.
- UI tests: each recommendation state, removal of the manual entry flow, and
  the HR retry action.
- Integration checks: local migration reset, pgTAP recruitment suite, TypeScript
  tests, lint, typecheck, and production build.

## Deployment prerequisites

- Enable the hosted Supabase queue and scheduling modules used by the worker.
- Store scheduler authentication and Gemini credentials as hosted Supabase
  secrets/Vault values.
- Deploy the updated analysis worker Edge Function before enabling the
  submission-time queueing migration.
- Monitor initial queue depth and failures after release.
