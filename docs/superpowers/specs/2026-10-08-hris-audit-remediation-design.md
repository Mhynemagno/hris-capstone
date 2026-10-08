# HRIS audit remediation design

## Purpose

Implement the complete October 2026 usability audit in one pull request while preserving the established HRIS identity, role separation, and database audit history. The result must make operational records reachable, metrics and exports trustworthy, record subjects identifiable, routine lifecycle work safe, and essential workflows usable on narrow screens.

## Scope and success criteria

The change covers all four audit phases: operational correctness, shared interaction consistency, workflow efficiency, and targeted visual polish. It does not introduce a new visual brand or replace the current role-based information architecture.

Success means that an authorized user can reach older matching records; reports export exactly the advertised data; every consequential queue and detail view identifies its subject; role-specific drill-downs remain authorized; destructive work is replaced by auditable lifecycle actions; and the audited desktop and mobile routes retain essential context, actions, and keyboard-accessible feedback.

## Architecture

### List and report contracts

Operational lists will use shared URL-backed parameters for filters, page, and return context. Query functions and database RPCs will apply filters before pagination and return `totalCount`, current range, and page metadata. Client-side slicing of capped data is not an acceptable substitute.

Reports keep an interactive paged table but request an unpaged, bounded export result using the same validated filters. CSV files will identify the report title, filter scope, and generation time, and the UI will label the scope accurately. Print uses a non-clipped content layout and preserves visible headings and applied filters.

### Dashboard semantics and authorization

Dashboard RPCs will use one organization date boundary. Labels will express the evidence actually available: attendance scans are not proof of current duty, and missing scans are not confirmed absence without a duty roster. Hire measures will use hiring events. Drill-down destinations will encode matching filters and management routes will only target management-readable reports.

### Identity and lifecycle workflows

Approval queues/details, attendance records, and deployment details will display employee name and badge as primary context, retaining device or record IDs as secondary information. Personnel and catalog maintenance will use clear correction, retirement, reactivation, and deactivation actions that retain history. Exceptional deletion stays restricted and is never the routine offboarding path. Promotion criteria will support safe edits where unused and replacement/versioning where historical evaluations depend on the original criteria.

### Shared workspace experience

Shared page headers, tables, dialogs, status presentation, form feedback, and empty/error/loading states will be used for equivalent workspace tasks. Applicant/public reading comfort remains larger, but primary actions align with the existing blue identity. Tables will retain compact, task-relevant columns on small screens; richer two-dimensional tables remain horizontally scrollable with an accessible cue. Forms provide labels, inline errors, an error summary or first-invalid focus, pending feedback, cancel/back behavior, and unsaved-work protection where users can lose entered data.

### Role workflows

Applicant registration supports the absence of a middle name, and applicant/employee dashboards foreground readiness and pending work. HR leave places the approval queue before occasional configuration. Attendance import supplies a template, clear invalid-row feedback, and direct next destinations. Promotion exposes a direct employee-review start. Notifications become a compact, filterable list. Navigation labels and breadcrumbs state the actual user task, and the mobile menu closes after selection.

## Data and security

Database changes are additive migrations. Each affected RPC validates caller role and inputs, filters before pagination, and only exposes data already permitted by the current role model. New or changed views/functions retain secure search paths, explicit execution grants, and existing audit-log behavior. No service-role credential is introduced to the browser, and any schema objects exposed to the data API remain RLS-protected.

## Error handling

The UI translates expected errors into actionable recovery copy while retaining user input. Query failures offer retry where safe. Mutation controls expose pending state and prevent duplicate submission. Dialogs retain usable scroll behavior when messages expand. No changed route treats an empty dataset as a successful completion unless that is the actual state.

## Test and verification strategy

Tests will cover list/filter/pagination and return-state behavior; report export scope and CSV metadata; dashboard label/calculation contracts; identity context; lifecycle and criteria revision rules; no-middle-name validation; import template/recovery; and accessibility behavior such as error focus and mobile table cues. The final branch will run lint, typecheck, unit tests, build, focused end-to-end/accessibility checks where supported, and manual responsive checks at the audited widths.

## Deliberate constraints

This pull request is intentionally broad because the user requested every audit phase in one delivery. Shared primitives are preferred over parallel page-specific implementations, but unrelated refactors and cosmetic redesign are excluded. Any audit finding that requires production data or device hardware to validate will be implemented and covered at the contract/UI level, then explicitly recorded as requiring live-environment validation.
