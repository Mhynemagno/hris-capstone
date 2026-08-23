# Dashboards and reports design

**Branch:** `feat/15-dashboards-and-reports`
**Goal:** Deliver live, role-appropriate HR and Management analytics plus filtered, exportable reports without granting Management direct access to operational data.

## Decisions

- HR receives operational summaries and authorized row-level report detail. Management receives strictly read-only workforce analytics and role-safe report detail; it never receives mutation controls.
- Reports are generated in the browser: users download CSV or use a print-optimized report page and their browser's Save as PDF capability. The application does not generate, store, or email PDF files.
- Dashboards and reports default to the last 30 calendar days. Current-state workforce and active-deployment KPIs are not constrained by that period.
- The feature uses compact KPI cards, accessible text-labelled status bars, and semantic tables. It does not add a charting dependency; every visual has a textual value and label.
- Reporting has no create, update, deactivate, approval, or delete action. Its only actions are read, filter, export CSV, and print.

## Reporting boundary and data flow

Existing module tables remain the source of truth. A new non-exposed `reporting` schema contains the shared read models used by dashboards and report detail queries. The migration provides narrow, fixed-shape RPCs in `public` that call private reporting functions. Each callable wrapper:

1. Requires an authenticated, active caller.
2. Validates the caller role in the private function: HR or Management, with per-report restrictions.
3. Accepts typed date and optional filter values only; callers cannot supply arbitrary table names, SQL, sort clauses, or columns.
4. Returns only the aggregate or report fields authorized for that role.
5. Is `stable`, uses `security definer` only for the deliberately bounded reporting boundary, sets `search_path = ''`, and has `PUBLIC`/`anon` execution revoked before `authenticated` is granted execution.

Underlying reporting views are never exposed through the Data API. If a public view is required for a non-privileged query, it must be declared with `security_invoker = true`; the preferred design is the non-exposed schema because Management must not be granted direct SELECT access to operational tables.

The browser's typed query functions call these RPCs through the established Supabase client. TanStack Query hooks render each result and share a `reporting` query-key family. Successful recruitment, leave, deployment, promotion, and attendance mutations also invalidate that family so open dashboards and reports refetch. Reporting adds no mutation hook.

## Pages and components

### Dashboards

- `/hr` replaces its current landing content with an operational dashboard: recruitment pipeline counts; active workforce; active deployments; attendance exceptions; pending leave; promotion-ready and training-needs totals. Each card links to the relevant operational route or filtered report.
- `/management` replaces its current landing content with read-only workforce analytics: active workforce and department distribution; recruitment and hiring trend totals; deployment status; attendance/leave exception totals; promotion and training-needs totals. It offers no create, edit, decision, upload, import, or delete controls.

Dashboard widgets use responsive card grids and labelled horizontal status bars, with tables as the accessible fallback. Loading, empty, and error states reserve the same layout area to reduce layout shift. On narrow screens, cards reflow to one column and report tables retain labelled horizontal scrolling rather than overflowing the viewport.

### Reports

- `/reports` is an authenticated, HR-or-Management route and role-aware report catalogue.
- `/reports/[reportKey]` is a validated detail page for: `applicant-tracking`, `hiring-decisions`, `employee-performance`, `deployments`, `attendance-leave`, or `promotion-training-needs`.
- Detail pages include a date-range filter, only the report-specific filters relevant to the selected report, filter summary text, semantic result table, pagination where needed, a CSV action, and print styles that retain the report title, applied filters, generation date, and visible columns.

HR can request authorized operational rows in the applicant tracking, hiring-decision, employee/performance, deployment, attendance/leave, and promotion/training reports. Management receives aggregate or de-identified rows for the same analytics categories; personally identifying applicant, employee, document, note, and sensitive operational fields are not returned unless its reporting contract explicitly permits them. The RPC result, not the UI, is the enforcement point for this distinction. CSV serialization exports exactly the rendered role-safe result set and escapes spreadsheet formula prefixes.

The HR and Management navigations receive a Reports entry. Existing role layouts guard their respective dashboards; the `/reports` layout accepts precisely `hr_personnel` and `management` and redirects every other role to `/unauthorized`.

## Validation, errors, and performance

Zod is the source of truth for report keys, ISO date range, optional department/status filters, pagination, and CSV export bounds. The client rejects an end date before a start date, unknown keys, malformed IDs/statuses, and oversized exports before invoking an RPC; private SQL repeats the range and role validation.

The reporting queries use indexed date, status, employee, department, and join columns already present where possible. The implementation adds only indexes justified by each fixed reporting query, including partial indexes for recurrent exception/pending filters when query plans warrant them. Aggregation stays in Postgres, avoiding broad browser downloads of operational tables. All list queries have explicit ordering and bounded pagination; CSV exports use a documented bounded maximum.

Unauthorized roles are rejected by both server route guards and RPC role checks. RPC errors are converted to concise, non-sensitive messages. Empty results explain that no authorized records match the applied filters. CSV and browser-print failures retain the current filtered report and offer a retry rather than silently producing partial output.

## Tests and verification

- Unit tests cover reporting schemas, route-key validation, date-range rules, CSV headers/escaping, and filter serialization.
- Query and hook tests cover each RPC argument mapping, role-safe result mapping, loading/empty/error rendering, and reporting cache invalidation from all affected module mutation hooks.
- Component and page tests cover both dashboards, the report catalogue, each report detail path, filter changes, print/export controls, responsive table wrappers, and the absence of Management mutation controls.
- pgTAP tests seed representative records and verify allowed HR and Management RPC results; denials for Applicant, Employee, Administrator, and anon; Management omission of restricted fields; lack of write grants; and reporting-query index/object security configuration.
- Verification runs the new migration and database test on a fresh local database, followed by lint, typecheck, Vitest, and production build. It includes a manual browser check that Management cannot navigate to operational mutation routes or export non-authorized columns.

## Out of scope

- Scheduled, emailed, saved, or server-generated reports.
- New data capture, mutation workflows, or changes to prior module ownership rules.
- A charting library, advanced BI tool, materialized-report refresh job, or external analytics service.
