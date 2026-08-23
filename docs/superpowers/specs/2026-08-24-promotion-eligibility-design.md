# Promotion eligibility design

**Branch:** `feat/13-promotion-eligibility`
**Goal:** Let HR define position-specific promotion requirements and review each employee's evidence and readiness. The system provides recommendations only; it never changes an employee's position, rank, role, or employment record automatically.

## Decisions

- Criteria are attached to a target `positions` record, rather than using one organization-wide rubric.
- HR records one overall performance rating from 1 through 5 for a bounded review period, with HR-private notes.
- Employees can see only their own current readiness, target position, derived years of service, and unmet requirements. Ratings, HR notes, recommendations, evidence links, and other employees' data are private to HR.
- Each saved evaluation snapshots its governing criteria and calculated result so later criteria edits do not rewrite the rationale for an earlier review.

## Data model

The migration adds the following public tables, all with RLS enabled and least-privilege grants.

| Table | Purpose |
| --- | --- |
| `promotion_criteria` | One HR-managed, active/inactive criteria set for a target position. It contains the target position, minimum completed years of service, optional minimum overall rating, audit fields, and optimistic-concurrency timestamp. |
| `promotion_criteria_requirements` | Ordered requirement rows under a criteria set. A row identifies the existing-record kind (`qualification`, `certification`, or `training`), a normalized required name, display label, and whether it is mandatory. |
| `performance_ratings` | An HR-entered overall rating (1–5), review-period start/end dates, and private notes for an employee. |
| `promotion_evaluations` | The HR review for an employee and target position: selected criteria, immutable criteria snapshot, derived years of service, readiness, missing-requirements snapshot, manual recommendation (`recommended`, `not_recommended`, or `deferred`), and HR-private notes. |
| `promotion_evaluation_evidence` | Evidence links from an evaluation requirement to the matching existing qualification, certification, or training record. Exactly one typed foreign-key column is populated, preventing arbitrary record IDs from being attached. |
| `employee_promotion_eligibility_summaries` | A deliberately restricted employee-facing projection maintained with the evaluation. It contains no rating, HR notes, recommendation, or evidence links, and supplies the employee page without granting access to HR-private rows. |

Foreign keys use `restrict` for personnel and position records that are part of a historical review. Foreign-key columns and HR-list filters receive indexes; the HR directory uses deterministic pagination ordered by `updated_at` and ID. Checks enforce valid rating and date ranges, non-negative service requirements, valid requirement kinds, one evidence link per row, and non-empty trimmed text. The criteria and evaluation write paths lock only the row being changed, validate the caller and input, update the summary atomically, append the audit entry, then finish promptly.

## Authorization and lifecycle

HR Personnel is the sole operational role for the module.

- **Criteria:** HR can create, read, update, and deactivate criteria. A criteria set referenced by an evaluation is not hard-deleted. No employee, Applicant, Management, or Administrator may manage it in this branch.
- **Performance ratings:** HR can create, read, and correct ratings; they are not hard-deleted. Employees receive no direct table access.
- **Evaluations:** HR can create, read, and update their reviews and evidence links; the manual recommendation remains a review outcome only. Evaluations are retained rather than deleted, and there is no approval or export workflow in scope.
- **Employee summaries:** An Employee can select only their own restricted summary row. They have no insert, update, delete, or evaluation-evidence access. Other employees and all unauthorised roles receive no rows.

Public RPC wrappers validate active HR authorization and call private database functions for each mutation. These functions create audit-log entries for criteria, ratings, and evaluation changes. The browser never receives a service-role key, and neither UI nor database code writes `employees.position_id`, roles, or rank as a promotion side effect.

## Readiness calculation

When HR creates or refreshes an evaluation, the server derives completed service from `employees.employment_started_on` as of the evaluation date. It loads the selected target-position criteria and the employee's active personnel records, then compares each named requirement against the corresponding qualification, certification, or non-expired training record. It also checks the latest performance rating against the configured minimum when one exists.

The evaluation stores the criteria and result at that point in time. HR can refresh or edit the review after personnel evidence or ratings change; this recalculates the snapshot and employee-safe summary. A ready result means every mandatory requirement is met and any configured service/rating threshold passes. It does not mean the employee has been promoted.

## Application architecture

Zod schemas are the contracts for criteria, requirement rows, performance ratings, evaluations, evidence links, UUID route input, and paginated/filterable lists. Query functions parse input before constructing Supabase queries; TanStack Query hooks own server cache and mutation invalidation. Shared TypeScript database types and promotion query keys cover criteria, HR reviews, employee detail, and the current employee summary.

### HR pages

- `/hr/promotions` lists evaluation rows with employee, target position, readiness, recommendation, and updated date. It supports bounded employee, position, readiness, and recommendation filters, loading/error/empty states, and a link to that employee's review.
- `/hr/promotions/criteria` lists, creates, edits, and deactivates target-position criteria and their requirement rows.
- `/hr/promotions/[employeeId]` validates the route UUID, shows the relevant personnel evidence and derived service years, records the latest rating, and creates or edits an evaluation. It clearly labels the recommendation as advisory and provides no promotion action.

### Employee page

- `/employee/promotion-eligibility` renders only the calling employee's restricted summary: target position, calculation date, years of service, readiness, and missing requirements. It explains that this is not an automatic promotion decision and hides the entire HR-private assessment when no summary is available.

Role layouts continue to enforce HR and Employee routes on the server. Invalid route IDs return `notFound`; unavailable criteria, missing employee records, stale writes, malformed payloads, and RLS denials return clear but non-sensitive errors.

## Testing and verification

- Unit tests cover all Zod contracts, including invalid ratings, inverted periods, invalid requirement types, untrimmed/empty values, invalid UUIDs, and filter bounds.
- Query and hook tests assert parsed requests, safe RPC payload mapping, expected Supabase filters, and invalidation of criteria, HR listings/detail, employee summaries, and audit logs after mutations.
- Component tests cover criteria maintenance, the HR evidence/missing-requirement view, employee-safe rendering, and loading, empty, validation, and error states. Employee tests specifically prove HR notes, ratings, recommendations, and evidence links do not render.
- pgTAP/RLS tests verify HR's permitted criteria/rating/evaluation paths, audit entries and summary updates, Employee access to only their own restricted summary, and denied cross-employee/non-HR access and writes.
- Final verification runs migration tests against a fresh local/test database plus `npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build`.
