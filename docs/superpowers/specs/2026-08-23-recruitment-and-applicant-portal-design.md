# Recruitment and Applicant Portal Design

## Purpose and boundaries

Feature 09 delivers recruitment from a public, published opening through an
HR-recorded hiring decision. It includes applicant profiles, applications,
private CV and credential storage, HR opening and application management, and
the handoff from a hired applicant to an employee record awaiting administrator
account activation.

This feature does not implement AI scoring or ranking, employee-role grants,
or automatic account activation. Those remain feature 10 and the existing
administrator account-management workflow respectively.

## Architecture

The browser uses the Supabase client for ordinary RLS-protected reads and
writes, with shared Zod schemas at every browser and RPC boundary. TanStack
Query provides all browser server-state reads and mutations. A database RPC
implements the multi-record hiring decision, so an employee record, activation
request, status history, and audit entry either all commit or all roll back.

All authorization is enforced in RLS and private database functions; route
guards and hidden controls improve the experience but are not authorization.
No service key is exposed to the browser.

## Data model

- `job_openings` stores title, department and position references, description,
  location, application close date, publication state, and lifecycle timestamps.
  An opening may be drafted, published, or closed/deactivated without deleting
  recruitment history.
- `job_qualification_criteria` stores ordered required or preferred criteria for
  an opening, with a criterion type, human-readable requirement, and optional
  detail. It intentionally contains no AI score or matching data.
- `applicants` has one row per applicant account and stores the application
  profile information needed by recruitment. Its `profile_id` uniquely links to
  `profiles.id`.
- `applications` links an applicant and opening and stores the current status,
  cover note, submitted/reviewed timestamps, final-decision metadata, and the
  linked employee after a successful hire. A unique constraint allows one
  application per applicant and opening.
- `application_status_history` records each immutable status transition with
  actor, old status, new status, note, and timestamp.
- `applicant_documents` stores only file metadata and the private object path.
  The object itself remains in Storage.
- `employee_activation_requests` records the employee, applicant profile,
  source application, `pending` or `activated` status, HR requester,
  administrator decision metadata, and timestamps. It is the explicit
  administrator handoff after hiring.

The migration uses foreign keys, check constraints, `timestamptz` timestamps,
and indexes for every RLS ownership key, foreign key, opening/public-list
filter, HR application queue filter, and status-history lookup. Public tables
enable RLS and revoke default client privileges before granting only the
necessary operations.

## Authorization and Storage

Anonymous visitors may read only published, open job openings and their
criteria. Applicants may create and update only their own applicant profile,
read published openings, submit and view only their own applications and
documents, and never select other applicants' data. Applicants cannot directly
change an application status after submission.

HR Personnel may create, update, publish, close, and list openings and their
criteria; list and review applications and documents; and run controlled status
and hiring workflows. System Administrators see pending employee activations
within the existing `/admin/users` account-management workflow. That workflow
is extended to complete a matching pending activation request only when it
assigns the Employee role through its existing protected server-side operation.
Employees and Management have no recruitment access.

The private `applicant-documents` Storage bucket is not public. Applicant
uploads use a path containing the authenticated user ID and application ID.
Storage policies let an applicant insert and read only objects belonging to
their own application path; HR may read documents that belong to an existing
application. The application never uses Storage upsert, broad bucket listing,
or client-side service keys.

## Application state and hiring workflow

The valid lifecycle is `Submitted`, `Under Review`, `Shortlisted`,
`Interview`, `Hired`, and `Not Selected`.

An HR-only transition RPC validates both the caller and the current status. It
allows `Submitted` to `Under Review`; `Under Review` to `Shortlisted`,
`Interview`, or `Not Selected`; `Shortlisted` and `Interview` to each other,
`Hired`, or `Not Selected`. `Hired` and `Not Selected` are terminal. Every
successful transition appends immutable history. Direct updates that bypass the
workflow are denied.

The `Hired` transition additionally requires employee number, department,
position, and employment start date. In one transaction it validates an active
HR caller and the opening/applicant relationship; locks the application;
creates the official employee record linked to the applicant's existing
profile; creates a pending activation request; writes status history and an
audit event; and marks the application hired. It does not grant the Employee
role, change the applicant role, or independently activate the account. The
administrator subsequently assigns Employee through the existing protected
account-management workflow, which atomically marks the matching request
`activated` and audits that decision.

## Routes and components

Public routes:

- `/jobs` lists published openings with search/filter and clear empty, loading,
  and error states.
- `/jobs/[jobId]` shows an opening and criteria. An unauthenticated visitor is
  directed to applicant registration; an applicant can start an application.

Applicant routes:

- `/applicant/register` continues to use the existing Auth registration flow.
- `/applicant/profile` manages the applicant's own recruitment profile.
- `/applicant/applications` lists only the applicant's applications and their
  current status.
- `/applicant/applications/[applicationId]` displays application details,
  history, and the applicant's private documents.

HR routes:

- `/hr/jobs` lists, searches, filters, publishes, and closes job openings.
- `/hr/jobs/new` creates an opening and its criteria.
- `/hr/jobs/[jobId]` edits an opening and its qualification criteria.
- `/hr/applications` is a searchable, filterable HR application queue.
- `/hr/applications/[applicationId]` shows the applicant profile, submitted
  documents, status history, controlled review controls, and the final hiring
  form.

The existing `/admin/users` route adds a pending employee-activation indicator
and uses its existing protected role/activation action; it does not introduce a
second account-management endpoint.

Components follow existing patterns: React Hook Form with Zod resolver for
interactive forms, query functions isolated in `src/queries`, hooks isolated
in `src/hooks`, existing loading/error/empty components for async states, and
signed URLs generated only after Storage RLS permits access. Successful
mutations invalidate the corresponding public jobs, applicant details/lists,
HR queues/openings, personnel records, administrator user/activation data, and
audit logs.

## Validation and error handling

Schemas validate UUID route parameters, pagination and queue filters, opening
and criteria forms, applicant profile and application payloads, files and
metadata, status-transition requests, and hiring payloads. File validation
limits accepted type, count, and size before upload; database metadata checks
repeat the essential constraints.

The UI presents authorization failures as unauthorized access, preserves form
input for recoverable validation errors, and explains when an opening has
closed, an application is already submitted, a document upload fails, or a
concurrent HR action has made the requested transition invalid. A failed hiring
operation leaves no employee record or activation request behind.

## Tests and verification

- Unit tests cover all Zod schemas and invalid route, filter, file, transition,
  and hiring inputs.
- Query/hook tests cover mapping, Supabase failures, and required cache
  invalidation after every mutation.
- Component and route tests cover public browsing, applicant profile and
  application submission/tracking, HR opening management, review, and hiring
  controls.
- pgTAP tests cover table constraints, RLS permitted and denied paths, Storage
  policies, status transition rules, terminal-state denial, document isolation,
  and atomic employee plus pending activation-request creation.
- The branch must pass database migration application, lint, typecheck, unit
  tests, relevant SQL tests, and production build. The intended applicant and
  HR journeys and an unauthorized role must be exercised before handoff.
