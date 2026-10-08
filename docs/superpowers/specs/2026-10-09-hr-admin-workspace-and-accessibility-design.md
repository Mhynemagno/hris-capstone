# HR/Admin Workspace and Access Improvements

## Purpose

Make the HR and administrator experience easier to scan and operate without changing role-based access or the existing operational workflows. The changes address the client feedback on long lists, plain form backgrounds, dashboard attention items, badge-number sign-in, promotion minimums, and restrained icon use.

## Scope and success criteria

The work applies to HR and administration workspaces that render operational lists or forms. Recruitment and applicant flows are not redesigned by this work; the supplied 20-page client PDF is audited against the current code so previously delivered recruitment changes stay intact.

Success means:

- Leave requests and leave types are separate, shareable tabs instead of one long page.
- Employee, leave, and applicable HR/admin lists show a bounded result page with an exact count and accessible pagination controls.
- Forms and data regions use the existing white card surface rather than blending into the muted page canvas.
- The HR dashboard lets users inspect pending leave requests and attendance exceptions in place.
- HR and system administrators can sign in with an active employee badge number or their existing email address.
- New promotion criteria accept only 1, 2, or 3 years of service; the UI has no `No minimum` choice.
- New UI icons carry useful meaning and have accessible text or labels.

## Workspace structure

Existing URLs, route authorization, and Supabase tables remain in place. The change introduces reusable client-side workspace elements built from the existing card, tabs, and pagination primitives:

- A consistent white, bordered card encloses forms, filters, lists, and their loading/error/empty states.
- Tab selection and list state are URL-backed. A copied URL, page refresh, or browser navigation restores the active tab, filters, and page.
- Pagination is server-backed. List queries retain their range/count contract, use a bounded page size, and reset to page 1 when a filter changes.

`/hr/leave-requests` becomes a two-tab workspace:

1. **Requests** contains the leave-request queue and its status filter.
2. **Leave types** contains leave-type management.

The employee directory and all other HR/admin list views that currently request or render their full result set adopt the same bounded-list controls. Existing tables that already use a server query and the administration pagination control retain their query contract and are normalized to the same URL-state behavior where feasible.

## Dashboard attention

The HR dashboard keeps its summary metrics but replaces the outbound-only "Needs attention" list with two inline tabs:

- **Leave requests for approval** shows a compact, paginated pending-request table.
- **Attendance exceptions** shows a compact, paginated exception table.

Each tab includes a link to the full operational workspace for actions that require more context. This lets HR inspect urgent work directly from the dashboard while preserving the dedicated pages as the full management surface.

## Authentication and access control

Applicant login remains applicant-number-only. Employee login remains badge-number-only. The generic internal login used by HR and administrators accepts either email or badge number:

1. The route validates the password and recognizes an email locally.
2. A non-email identifier is passed only from the server to the existing service-role identifier resolver.
3. The resolver returns an email only for an active employee record. The route then uses normal Supabase password sign-in and existing active-profile checks.
4. Post-login role routing remains the authoritative source for the user destination and permissions.

No privileged lookup function is exposed to the browser. Invalid credentials produce the existing generic error, so the feature does not reveal whether a badge number exists.

## Promotion criteria rule

The creation schema, select input, RPC validation, and database constraint will limit new and changed criteria to 1, 2, or 3 years.

Historical criteria above three years are not silently changed. They remain visible and receive a clear correction state so HR can replace or correct them deliberately. The database migration uses a non-validating check constraint or equivalent guarded RPC validation so legacy rows stay readable while future writes cannot violate the new rule.

## Visual language and accessibility

Cards use the current `bg-card`, border, radius, and spacing tokens rather than introducing a second design system. Colored Lucide icons are limited to places where they increase recognition:

- blue for contextual navigation or neutral actions;
- amber or red for attention and destructive actions;
- green for confirmation and success states.

Icons do not replace wording. Icon-only controls keep their accessible names, and tabs, pagination, status updates, and empty/error states remain keyboard and screen-reader usable.

## PDF feedback reconciliation

The supplied PDF is a historical 20-page change log. Its recruitment/applicant requests are verified against current source and tests but are not reimplemented when already complete. The overlapping or remaining items for this scope are:

- generic HR/admin badge-number login;
- the promotion-criteria 1–3-year limit with no `No minimum` option;
- dashboard attention placement and visibility;
- consistent card, tab, and pagination treatment for HR/admin lists.

The implementation notes will identify any unrelated PDF item found incomplete rather than silently broadening the approved work.

## Error handling and verification

Every card-contained list must render useful loading, empty, and error states. URL parameters are parsed defensively and fall back to a valid tab/page. The test suite will cover identifier parsing and login behavior, promotion validation, URL tab/page state, pagination bounds, and dashboard attention panels. Final verification runs targeted unit tests, type checking, linting, production build, and relevant existing browser tests.

## Verified repository facts and implementation prerequisites

The following facts were checked against `origin/main` at commit `d9f4e8e` on 2026-10-09:

- The repository already provides shared card, tabs, and pagination components.
- The Leave page currently stacks leave-type management above a leave-request queue, and the queue is fixed to its first 25 records.
- The employee directory renders query results without pagination controls.
- The current generic login accepts email only; applicant and employee modes already resolve applicant number and badge number respectively.
- `resolve_login_identifier` is a `SECURITY DEFINER` function whose execution is revoked from browser-facing roles and granted only to `service_role`.
- The current promotion schema accepts 0 through 100 years, and the UI exposes a `No minimum` option.
- The existing role user guide describes attention items as links to separate lists; it must be updated in the implementation change.

The implementation requires no new package. It depends on the existing server-only `SUPABASE_SERVICE_ROLE_KEY`, the existing identifier resolver, and the project migration/test workflow. The exact current production database state, including whether any promotion criteria exceed three years, has not yet been inspected; the migration and UI must therefore preserve legacy rows and test the new-write rule locally before deployment.

## State census

| Mechanism | States and response |
| --- | --- |
| Workspace URL state | Valid tab/page restores the matching view; missing or invalid tab/page falls back to the default tab and page 1. |
| Paginated list | Loading, populated, empty, filtered-empty, error, first page, middle page, and final page all remain within the card surface. |
| Internal login identifier | Valid email signs in normally; valid active badge resolves server-side then signs in; unknown/inactive badge and invalid password use the same generic credential error. |
| Promotion criteria | New values 1–3 are accepted; zero, negatives, and values above 3 are rejected; existing out-of-range rows remain visible with a correction state. |
| Dashboard attention | Each tab has loading, populated, empty, and error states and retains a link to the full workspace. |
