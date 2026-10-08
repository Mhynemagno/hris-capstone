# Brevo Email Notifications Design

**Status:** Ready for user review
**Date:** 2026-10-08

## Purpose and success criteria

The HRIS already records secure in-app notifications in `public.notifications`, but does not deliver those workflow updates by email. The system will use the existing Brevo account to send a concise transactional email for selected notification records. Supabase Auth will continue to send invitations, account confirmations, password resets, and security emails through its already configured Brevo SMTP connection.

Success means that an eligible in-app notification creates at most one email-delivery job, the job is processed without exposing any Brevo credential to the browser, temporary provider failures are retried, and an email never exposes information that requires an authenticated HRIS session.

The existing Brevo sender address and sender name remain unchanged at the user's request. Brevo must continue to accept that sender when the function is deployed; a sender rejection is a deployment failure, not a condition to silently ignore.

## Scope

### Included

- A durable, private email outbox populated from new eligible `public.notifications` records.
- A recurring, service-only Supabase Edge Function that delivers pending outbox jobs through Brevo's transactional-email HTTPS API.
- Retry, stale-job recovery, and operational delivery states.
- SQL and Edge Function tests, deployment documentation, and a notification matrix.

### Excluded

- A second email provider, browser-side email delivery, direct SMTP delivery from an Edge Function, marketing email, bulk job-posting announcements, user-managed notification preferences, and UI for delivery-history administration.
- Emailing attendance, biometric activity, documents, audit events, notification reads/deletes, or detailed HR decisions.
- HR and administrator approval-queue digests; these are a later feature because the current system does not create notifications for these recipients.

## Notification matrix

| Event source / notification type | Recipient | Delivery | Email content |
| --- | --- | --- | --- |
| Supabase Auth invitation, confirmation, recovery, and password security templates | Account owner | Existing Auth + Brevo SMTP | Auth-managed template; no change in this feature. |
| `application_status_updated` | Applicant | Immediate | Exact in-app notification title and body, including status and HR note. |
| `application_remark_added` | Applicant | Immediate | Exact in-app notification title and body, including the remark. |
| `leave_request_decision` | Employee | Immediate | Exact in-app notification title and body, including decision and reason. |
| `profile_change_decision` | Employee | Immediate | Exact in-app notification title and body, including decision and reason. |
| `deployment_assigned`, `deployment_updated` | Employee | Immediate | Exact in-app notification title and body, including deployment details. |
| `password_changed` | Account owner | In-app only | Auth's password-changed template is the sole email channel, preventing duplicate messages. |
| All other notification types and non-notification events | — | In-app only | No email is created. |

The message contains a protected portal link built from `APP_URL` and `/auth/continue?next=<safe notification link>`. The current continuation route verifies both authentication and role access before opening the destination. No email contains status details, notes, reasons, deployment locations, medical/recruitment examination details, document names, or attachments.

## Approaches considered

1. **Recommended: private durable outbox plus one scheduled worker.** A trigger converts eligible in-app notifications into delivery jobs. The worker processes them each minute. This centralizes all current and future notification producers, retains failure state, and matches the repository's existing secure scheduled-worker pattern.
2. **Database webhook directly to Brevo.** This is shorter but cannot durably model retries or delivery state; a failed webhook may lose the email attempt.
3. **Add a Brevo request to every workflow function.** This duplicates delivery behavior across leave, profile, recruitment, and deployment flows and risks committing a business change even if the email provider is unavailable.

## Architecture and data flow

```text
Workflow SQL → public.notifications insert
             → private notification-email trigger
             → private.notification_email_outbox (pending)
             → every-minute pg_cron / pg_net tick
             → send-notification-email Edge Function
             → Brevo transactional email API
             → outbox status accepted or retry / failed
```

The new `private.notification_email_outbox` table is not exposed through the Data API. It snapshots the recipient user ID, notification type, title, body, and safe internal link at notification creation. The worker obtains the current Auth email only within a service-role database RPC, immediately before sending.

The notification trigger maps only the approved types in the matrix to a template key. A unique `notification_id` guarantees one job per notification even if a transaction or trigger is retried. Deleting an in-app notification does not cancel an already-created email job; the event was valid when created and the delivery record remains available for operations.

## Delivery states and retry policy

| State | Meaning | Next action |
| --- | --- | --- |
| `pending` | Eligible notification is waiting to be sent. | Worker atomically claims it. |
| `sending` | A worker owns the job. | On successful Brevo acceptance, mark `accepted`; stale claims return to `pending`. |
| `accepted` | Brevo accepted the request and returned a message ID. | Terminal state for version one; provider delivery webhooks are future scope. |
| `failed` | The recipient has no usable email, Brevo rejects the request, or all attempts are exhausted. | Keep diagnostics for operations; no automatic further send. |

The worker claims jobs using `FOR UPDATE SKIP LOCKED` so concurrent invocations cannot send the same job. It permits four total attempts. Transient failures return a job to `pending` after 5 minutes, 30 minutes, then 2 hours. Jobs left `sending` for more than 15 minutes become `pending` for retry. Invalid recipient addresses and non-rate-limited Brevo 4xx validation failures become `failed` immediately; network errors, provider 5xx responses, and rate limits are transient.

The state `accepted` means Brevo accepted the delivery request—not that the recipient opened or received it. Brevo delivery/bounce webhooks are deliberately deferred; the stored Brevo message ID keeps that extension possible without changing the notification contract.

## Database interfaces and security

The migration adds:

- the private outbox table, check constraints, indexes for due jobs, and the one-to-one notification uniqueness constraint;
- a private `AFTER INSERT` trigger function on `public.notifications` that enqueues only matrix-approved types;
- private claiming, completion, failure, and stale-claim recovery functions; and
- narrow public RPC wrappers used only by the Edge Function's service-role client. Every wrapper uses `SECURITY DEFINER`, an empty search path, revoked `PUBLIC` access, and an explicit `service_role` execute grant.

No authenticated browser role receives table access or execution permission. The trigger and worker are the only writers. Existing `notifications` RLS and its user-owned read/delete behavior stay unchanged.

The scheduled tick follows the established `process-application-analysis` model: `pg_cron` executes a private function every minute; that function reads `project_url` and `email_notification_worker_secret` from Vault, then calls the Edge Function using a dedicated header. The Edge Function has gateway JWT verification disabled only because it verifies that distinct shared secret itself.

## Edge Function and Brevo integration

`supabase/functions/send-notification-email/index.ts` will expose a POST-only, worker-secret-protected handler. It will:

1. validate its worker header and runtime configuration;
2. use a service-role Supabase client to claim a small batch of jobs;
3. resolve the recipient email and compose a text and HTML message from the queued notification title and body;
4. POST each message to Brevo's transactional endpoint with the server-only `BREVO_API_KEY` and a job-specific tag;
5. record Brevo's returned `messageId`, or classify and persist the failure; and
6. return aggregate counts without recipient or provider-secret data.

Brevo's documented transactional endpoint uses an API key in the request header and returns a message ID after acceptance. Templates are rendered in the function for this first release, avoiding external template-ID configuration and keeping the exact matrix content versioned and testable. See [Brevo's transactional email API](https://developers.brevo.com/docs/send-a-transactional-email).

## Required configuration and deployment

The deployment owner must create a Brevo transactional API key and keep it separate from the existing SMTP password. The following values never enter Git, migrations, browser variables, or test fixtures:

- `BREVO_API_KEY` — Supabase Edge Function secret.
- `BREVO_SENDER_EMAIL` and `BREVO_SENDER_NAME` — the existing Brevo-registered sender values, configured for the Edge Function without committing the personal address to source control.
- `EMAIL_NOTIFICATION_WORKER_SECRET` — Supabase Edge Function secret.
- `email_notification_worker_secret` — the same worker secret stored in Supabase Vault for the cron tick.
- `project_url` — existing Vault secret containing the Supabase project URL used by the cron tick to invoke Edge Functions. `APP_URL` is the deployed application origin used in links.

The function is deployed with `verify_jwt = false` and protects itself using `x-email-notification-worker-secret`, exactly like the existing scheduled analysis worker. Before production deployment, the owner must send one test to a controlled recipient and confirm Brevo accepts the configured existing sender.

## Testing and verification

### SQL tests

- Each allowed notification type creates exactly one pending job with the expected template key and safe link.
- Every excluded type, including `password_changed`, creates no job.
- A duplicate notification enqueue cannot create a duplicate delivery job.
- Browser roles cannot read or mutate the outbox and cannot execute worker RPCs.
- Claimed jobs cannot be claimed concurrently; stale `sending` jobs return to retryable state.

### Edge Function tests

- Missing/incorrect worker secret returns 401 and does not call Supabase or Brevo.
- Missing configuration returns 503.
- Each template snapshots the exact in-app notification title and body, plus a protected continuation URL.
- Brevo success records the provider message ID and accepts the job.
- Provider validation errors fail the job; transient failures schedule the appropriate retry.

### Deployment smoke test

Use a controlled account and an existing workflow that creates an allowed notification, then verify the in-app notification, one corresponding outbox job, a Brevo `accepted` job state with message ID, and receipt of an email with the same title and body. Inspect the cron and `pg_net` run records if the worker is not invoked.

## Documentation changes

Update `README.md` to distinguish Auth SMTP from HRIS notification delivery, add `docs/EMAIL_NOTIFICATIONS_SETUP.md` for Brevo/Vault deployment and troubleshooting, and add the worker to `docs/DEPLOYMENT_RUNBOOK.md`.

## Verification record for this design

| Claim | Evidence |
| --- | --- |
| In-app notifications are the current shared event boundary. | `supabase/migrations/20260823104039_notifications.sql` and current workflow migrations insert into `public.notifications`. |
| The secure continuation route validates user and role before redirecting. | `src/app/auth/continue/route.ts`. |
| The repository already schedules a secret-protected Edge Function through Vault, `pg_cron`, and `pg_net`. | `supabase/migrations/20260924112000_application_analysis_schedule.sql` and `docs/AI_SHORTLISTING_SETUP.md`. |
| Brevo API authentication, sending endpoint, message ID, and templates are available. | [Brevo transactional email documentation](https://developers.brevo.com/docs/send-a-transactional-email). |
| The current Auth SMTP connection uses Brevo. | User-provided Supabase Dashboard screenshots on 2026-10-08; live SMTP credentials were not read or copied. |
