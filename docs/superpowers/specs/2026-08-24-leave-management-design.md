# Leave Management Design

## Purpose

Deliver the employee leave-request and HR-decision workflow on `feat/11-leave-management`. Employees can submit, view, and cancel their own pending full-day leave requests. HR Personnel manage the usable leave-type catalogue and make the single final approval or rejection decision. Every decision notifies the affected employee.

This branch deliberately excludes leave allocations, accruals, remaining balances, payroll deductions, retroactive requests, partial-day requests, and multi-level manager approval.

## Scope and roles

Employees can create a request for today or a later date, view their own request history and attachments, and cancel only their own pending request. They cannot modify a submitted request or its decision.

HR Personnel can view and filter the operational request queue, open request details and private attachments, approve or reject pending requests, and manage the leave-type catalogue. HR creates, edits, activates, and deactivates leave types; it never hard-deletes a type that has been used by a request. Rejections require a reason. Approvals allow an optional decision note.

System Administrators, Applicants, and Management do not receive leave routes or data access. Management remains read-only and is not granted operational leave visibility in this branch.

## Data model and security

The migration adds four tables:

- `leave_types`: name, optional description, `requires_attachment`, `is_active`, lifecycle timestamps, and the HR actor responsible for the latest change.
- `leave_requests`: linked employee and type, inclusive `starts_on` and `ends_on` dates, employee reason, `pending`/`approved`/`rejected`/`cancelled` status, decision note, deciding HR user, and timestamps.
- `leave_request_attachments`: request-linked private Storage object metadata, including object path, original name, MIME type, size, uploader, and timestamp.
- `leave_request_history`: immutable event records for submission, cancellation, approval, and rejection, with the actor and safe event metadata.

Indexes support the employee history, HR status/type/date filtering, and request history/detail lookups. Check constraints prevent blank values, invalid dates, malformed attachment metadata, and invalid status-dependent decision fields.

RLS is enabled for every new exposed table and the private leave attachment bucket. Employees can select their own request graph and upload/read objects only inside their own request path. HR can select the operational request graph and read attachments. Only the database workflows may create final request/history/notification/audit records or change request status; direct client writes are denied. Leave-type access permits all authenticated users to read active types needed by the request form, while only HR can create, update, activate, or deactivate them.

## Workflows

The submission database workflow validates caller identity, the employee link, active leave type, required attachments, each attachment's owned Storage path, supported metadata, today-or-later inclusive dates, and a valid reason. It then creates the request and its submitted history event atomically.

The cancellation workflow permits the request's employee to cancel only a pending request. It records the cancellation event and cannot be replayed after any final state.

The HR decision workflow locks a pending request, validates the HR role and decision payload, records the decision and history, inserts an audit-log event, and creates an in-app notification for the employee in one transaction. It rejects blank rejection reasons and does not permit a cancelled or already-decided request to transition again. A failure rolls back the full operation.

## Application experience

`/employee/leave` presents the employee's leave history with status, type, inclusive dates, decision note, and a pending-only cancellation action. It provides the route to `/employee/leave/new`.

`/employee/leave/new` contains a shared-Zod-validated form for leave type, start date, end date, reason, and optional attachment uploads. Selecting a type that requires evidence makes attachments mandatory. The date inputs prevent dates before today; the database repeats this validation.

`/hr/leave-requests` provides a searchable, filterable HR queue and a leave-type management workspace. The workspace supports create, edit, activation, and deactivation; deactivated types remain visible on historical requests and cannot be chosen for new requests.

`/hr/leave-requests/[requestId]` shows all request information, authorised private attachment links, chronological history, and HR decision controls. Approve accepts an optional note; reject requires a reason.

Employee and HR navigation gain their respective leave entries. The feature uses the existing loading, empty, error, form, and notification patterns. Each successful mutation invalidates the impacted leave, notification, and audit data.

## Validation, failures, and testing

Shared Zod contracts cover leave-type mutation input, submission input, attachments, filters, route IDs, cancellation, and decisions. Browser query functions validate before making Supabase calls; the database independently checks ownership, role, dates, type activity, attachment requirements, and transitions.

The UI must clearly report validation errors, insufficient permission, stale/final request conflicts, unavailable attachments, and database failures without duplicating records or notifications.

Tests cover Zod schemas; query and TanStack Query invalidation behavior; employee and HR components/routes; RLS permitted and denied access; attachment privacy; required-attachment enforcement; the full submission-to-decision-to-notification journey; cancellation; and audit/history effects. Before handoff, run clean migration application plus repository lint, typecheck, test, and production-build commands.
