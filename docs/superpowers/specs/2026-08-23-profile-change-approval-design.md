# Profile Change Approval Design

## Purpose

Enable an employee to propose contact-detail and qualification changes without changing the official personnel record directly. A System Administrator reviews the complete request and either approves it transactionally or rejects it. Approval updates the official record, records immutable history and audit data, and creates the employee's in-app notification.

## Scope

The employee may request changes to these contact fields:

- personal email;
- phone;
- address;
- emergency-contact name; and
- emergency-contact phone.

The employee may also propose qualification additions, edits, and removals. A request may contain multiple contact and qualification changes plus multiple optional supporting documents. The decision applies to the whole request: an administrator cannot partially approve it.

This branch does not add email delivery, real-time subscriptions, HR or Management approval rights, or direct employee editing of any official personnel record.

## Data model

Add the following public tables, all with RLS enabled.

### `profile_change_requests`

The request header stores the linked `employee_id`, submitting `user_id`, lifecycle `status` (`pending`, `approved`, `rejected`, `cancelled`), optional employee note, optional decision reason, decision actor and timestamp, plus created and updated timestamps. A check constraint limits state values and keeps decision fields internally consistent.

### `profile_change_request_changes`

Each immutable child row stores exactly one proposed change:

- a contact field update, identified by an allowed field key; or
- a qualification `add`, `edit`, or `remove`, with an optional target qualification ID for edit/removal.

Every row records the original JSON snapshot and requested JSON snapshot. Contact snapshots contain the individual scalar value; qualification snapshots contain the validated qualification record shape. This provides a clear review comparison and lets approval detect stale records instead of overwriting an intervening official update.

### `profile_change_request_documents`

Document metadata contains the request ID, bucket object path, original filename, MIME type, byte size, uploader, and timestamp. The file remains in the existing private `private-documents` bucket. Object paths use a request-specific prefix under the submitting user ID, so Storage policies can establish ownership without trusting client metadata.

### `profile_change_request_history`

An append-only history table records submission, cancellation, approval, and rejection with the actor, timestamp, and safe event metadata. It supplements the existing global `audit_logs` entry, which records approved official-record mutations.

Indexes cover the employee's chronological request history, the administrator review queue by status and creation time, request child lookup, and history retrieval.

## Authorization and transactional workflow

Employees receive read access only to their own linked requests, children, document metadata, and history. They cannot directly mutate `employees` or `qualifications`. They can submit a valid request and cancel it only while it remains pending.

System Administrators can read all requests and their attached private documents. Neither employees nor administrators receive a direct update policy for decision fields. The only decision path is a protected transactional database workflow, matching the repository's existing public-RPC/private-procedure pattern.

The workflow:

1. validates that the caller is an active System Administrator;
2. locks the target request and requires its pending state;
3. verifies that each affected official contact field or qualification still matches its recorded original snapshot;
4. applies all contact and qualification changes, including qualification inserts, updates, and removals;
5. changes the request status, records request history, and inserts an audit-log entry;
6. creates a profile-change decision notification linked to the employee request; and
7. commits every step together.

Any validation conflict, stale data, authorization failure, or database error rolls back all steps. Rejection similarly locks and finalizes the request, records its reason and history, creates a notification, and never changes official personnel data.

The submission workflow validates the linked employee, request payload, allowed field keys, JSON shapes, attachment ownership, and pending state before atomically creating the header, changes, metadata, and submission history. Storage policies permit an employee to upload only into their own profile-change request path and permit administrators to read request files. The implementation will constrain accepted file types and sizes in the shared validation contract and database metadata checks.

## Application experience

### Employee routes

- `/employee/profile` extends the official personnel summary with a request-profile-change action and recent request state.
- `/employee/profile/change-request` presents a validated form for contact proposals, qualification add/edit/remove proposals, an optional note, and optional multiple supporting documents.
- `/employee/profile/change-requests` shows the employee's requests with the proposed values, documents, history, and decision reason. A cancel action appears only for pending requests.

### Administrator routes

- `/admin/profile-change-requests` provides a searchable, filterable queue with status and submission information.
- `/admin/profile-change-requests/[requestId]` compares original, current, and proposed values; exposes authorised document downloads; shows history; and provides confirmation-protected approve and reject actions. A rejection may include a reason.

Existing server-side role layouts protect the route groups. The role navigation gains the employee request entry points and the administrator review queue.

## Validation and error handling

Shared Zod schemas validate form data, route parameters, filters, contact field values, qualification snapshots, attachment metadata, and approval/rejection/cancellation payloads. The browser query functions parse every boundary before making a Supabase call. The database workflows independently validate caller identity, ownership, allowed change types, state transitions, target-record matching, and value constraints so direct Data API/RPC calls cannot bypass browser checks.

The UI uses the existing loading, empty, validation, and error states. It reports stale-request conflicts without changing official data and directs the employee to submit a fresh request. Successful submission, cancellation, and decision mutations invalidate the affected request list/detail, official-profile, qualification, administrator queue, audit, and notification cache keys.

## Testing and verification

- Unit tests cover every shared Zod schema and invalid field/change/document input.
- Query and TanStack Query hook tests cover validation and relevant invalidation.
- Component and route tests cover employee submission/history/cancellation and administrator queue/detail/decision states.
- pgTAP tests prove RLS allows only the intended employee and administrator access, blocks direct official-record writes and non-administrator decisions, validates cancellation and state transitions, and verifies the full approval/rejection transaction effects.
- The end-to-end role journey proves that submission leaves official data unchanged, approval applies all valid contact and qualification changes, and both decision paths create the required audit entry and employee notification.

Before handoff, migrations will be applied to a clean test database; relevant database tests, linting, typechecking, all unit/integration tests, and the production build will run. The final security review will verify that no service-role credential appears in browser code and that private attachments remain inaccessible to unrelated users.
