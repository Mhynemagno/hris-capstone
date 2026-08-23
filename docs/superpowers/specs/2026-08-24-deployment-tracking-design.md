# Deployment Tracking Design

## Purpose

Deliver personnel deployment tracking on `feat/12-deployment-tracking`. HR Personnel can create and correct deployments without deleting or overwriting the record of prior activity. Employees can view only their own assignments and their history.

This branch intentionally excludes notifications, deployment destination master-data tables, attendance integration, management reporting, and promotion workflows.

## Scope and roles

A deployment assigns one employee to an operational location, unit, project, or a combination of those destinations. It has an assignment role, inclusive start and optional end dates, a lifecycle status, and optional notes. Employees may hold concurrent deployments, so overlapping planned or active date ranges are valid.

The lifecycle is `planned`, `active`, `completed`, or `cancelled`. A completed deployment must include an end date; planned, active, and cancelled deployments may have an end date when it is operationally meaningful. HR changes status rather than deleting a record.

HR Personnel can browse, filter, create, and update all deployments, including status transitions. Employees can view only deployments linked to their employee record. System Administrators, Applicants, and Management receive neither deployment routes nor deployment data access in this branch.

## Data model and security

The migration adds two tables:

- `deployments`: employee ID, nullable location/unit/project destination text fields (with at least one required), assignment role, inclusive dates, status, notes, HR creator/updater IDs, and timestamps.
- `deployment_history`: append-only deployment event entries with the HR actor, event type, timestamp, and JSON metadata capturing the changed fields and prior values.

Indexes support current-deployment lookup by employee and status, plus date-range reporting. Constraints reject blank text, a missing destination, an end date before the start date, and status/date combinations that violate the lifecycle.

RLS is enabled for both tables. Employees can select deployments and history only when the deployment is linked to their own employee record. Active HR Personnel can select all deployment data. Tables grant no direct client writes; security-definer RPCs enforce HR access, validate payloads, write the deployment, append history, and create an audit-log record atomically. The public RPC wrappers are executable only by authenticated users.

## Workflows

The create workflow validates an active HR caller, target employee, destination, assignment role, dates, status, and notes. It inserts the deployment, emits a `created` history entry containing the initial snapshot, and creates an audit-log entry in one transaction.

The update workflow locks the target deployment, compares a client-supplied `expected_updated_at` value with the stored timestamp, validates the current HR caller and replacement values, updates the record, records an `updated` and/or `status_changed` history event with field-level old/new values, and appends the audit event atomically. It does not expose delete or bulk-replacement operations. Retried stale updates fail safely rather than silently erasing another HR user's change.

## Application experience

`/hr/deployments` is the operational directory. It provides status and date-range filters, presents employee, destination, role, dates, and status, and links to creation and detail views.

`/hr/deployments/new` uses a validated deployment editor to create an assignment. `/hr/deployments/[deploymentId]` uses the same editor for permitted corrections and status transitions, and shows a chronological immutable history panel.

`/employee/deployments` is a read-only chronological assignment list for the signed-in employee. Each entry presents status, destination, assignment role, dates, and notes. HR and employee navigation each receive a Deployments entry.

The frontend follows existing layers: shared Zod schemas, generated-style database types, Supabase query/RPC functions, TanStack Query hooks, and focused route components using existing loading, empty, error, form, and table patterns. Successful mutations invalidate the deployment directory/detail data and related audit data.

## Validation, failures, and testing

Shared Zod contracts validate create/update payloads, filters, and route IDs before browser calls. Database RPCs repeat every authorization, ownership, lifecycle, and field-validation rule. The UI presents clear validation, permission, stale-update, not-found, and database-failure states.

Tests cover schema validation; query and mutation contracts; hook invalidation; HR directory, editor, detail/history, and employee list states; route protection; SQL/RLS allowed and denied journeys; audit/history entries; concurrent-assignment acceptance; and lifecycle/date constraints. Before handoff, run migration/RLS tests, lint, typecheck, relevant unit/component tests, the full test suite, and a production build.
