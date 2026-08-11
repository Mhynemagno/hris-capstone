# Administration Master Data Design

## Goal

Deliver the System Administrator workspace for managing accounts, roles, organization reference data, organization settings, and audit history. It also corrects the post-sign-in journey: an authenticated user must arrive at the landing page for their assigned role instead of the public home page.

## Scope

This branch implements the protected pages at `/admin/users`, `/admin/roles`, `/admin/departments`, `/admin/positions`, `/admin/settings`, and `/admin/audit-logs`, and extends `/admin` into a useful administration overview. The existing role landing page becomes the entry point for these administrative modules.

The Users page includes every account, including Applicants. Administrators can search by name or email and filter by role and active status. An administrator may directly change an Applicant to an internal role and may activate or deactivate accounts. Every change is protected by a server-side database workflow and has an audit record. To avoid accidental lockout, an administrator cannot deactivate or remove their own administrator role, and the last active system administrator cannot be demoted or deactivated.

This branch does not create employee records, applications, leave requests, notifications, or any later HR workflow. Direct Applicant-to-Employee assignment is explicitly permitted here; the later recruitment workflow may add a more guided activation path without invalidating this administrative override.

## User Experience

The administration area uses a light, data-dense enterprise dashboard instead of the dark marketing-style public landing page. It retains the existing semantic Tailwind/shadcn tokens and uses a restrained blue primary palette, amber only for attention states, and text/icon labels in addition to color. Lucide is the only icon family.

The admin sidebar exposes Dashboard, Users, Roles, Departments, Positions, Settings, and Audit Logs. The current section is visible through background, icon, and text weight. Desktop has an inset sidebar; mobile uses the existing accessible off-canvas navigation. A persistent top bar carries contextual breadcrumbs. All tables have readable headers, keyboard-focusable controls, loading/error/empty states, and adapt to small screens without horizontal viewport overflow; table overflow remains contained in its own scroll region when necessary.

`/admin/users` is the primary operational page. It has a title and account count, an Invite internal user action, a search field, and role/status filters. The table shows person, email, role badge, status badge, assignment date, and a labelled action menu. A dialog validates role or status changes before submission and explains the effect. Applicant accounts remain visible and can be selected with the Applicant filter.

`/admin/roles` is a focused role-management view over the same account data and workflow. It filters by role by default, provides role descriptions and counts, and opens the same role-assignment dialog. There is one role-change implementation path, not a duplicate role editor.

`/admin/departments` and `/admin/positions` provide searchable reference-data tables and create/edit dialogs. A department has a unique name and active state. A position has a department (optional for organization-wide positions), title, optional unique position code, optional description, and active state. Deactivation preserves history; these master data records are never hard-deleted by the UI.

`/admin/settings` edits one organization-settings record: organization name, support email, and default time zone. It exposes no secret configuration. `/admin/audit-logs` is a read-only, paginated history with action/entity/date filtering and a details drawer for safe metadata.

## Authentication and Routing

The sign-in form submits normally to Supabase, then navigates to a server-side post-auth route. That route gets the verified session role and redirects to the corresponding configured role home (`/admin`, `/hr`, `/employee`, `/applicant`, or `/management`), unless a safe, authorized `next` URL was requested. An unknown or missing role resolves to `/unauthorized`.

The public root page performs the same role-home redirect when a session exists. Therefore an administrator who signs in or returns to `/` sees the app shell and Administration workspace, not the public marketing page with only a Sign out button. Unauthenticated visitors retain the public landing page and its sign-in link.

All `/admin` routes continue to use the server `requireRole("system_administrator")` boundary. The proxy continues to send unauthenticated visitors to `/login` with their requested path preserved.

## Data and Security

Existing `profiles`, `user_roles`, `departments`, `positions`, and `audit_logs` remain the source of truth. A new migration adds only the missing administration data:

- `organization_settings`, constrained to one row, with organization name, support email, default time zone, `updated_by`, and timestamps.
- Optional `positions.code` and `positions.description`, with a unique code where present.
- Audit coverage for profile activation changes and organization-settings changes, alongside the existing department, position, and role audit triggers.

A private, transactional database function owns role and activation changes. It derives the caller from `auth.uid()`, verifies the caller is a system administrator, validates the target role/status transition, applies the profile and role updates together, and relies on audit triggers to record the actor, target entity, action, and safe change metadata. The migration removes direct browser update policies for `profiles.is_active` and `user_roles.role`; only the workflow can change them. It blocks self lockout and the removal of the final active administrator. The client validates the exact payload with shared Zod schemas before calling the workflow, but database checks remain authoritative.

RLS permits only a system administrator to read the complete account directory, organization settings, and audit logs; no other role can invoke the privileged function or mutate reference data. Existing authenticated read access for active departments and positions remains for later personnel and recruitment features. Every newly exposed table has RLS enabled, least-privilege policies, indexes for its access patterns, and permitted/denied policy tests.

The invitation Edge Function remains the only account-creation path for internal accounts. It is updated to use the same audited role-assignment rules and returns safe, actionable errors. Browser code uses only the public Supabase key and the authenticated user session.

## Components and Data Flow

Shared, focused units keep screen and security responsibilities separate:

- Administration query functions load typed, RLS-protected lists; TanStack Query hooks own their query keys, loading/error states, and mutation invalidation.
- Shared Zod schemas define URL filters, invitation details, reference-data forms, settings, and role/status workflow payloads.
- Reusable admin table, filter bar, status/role badge, form dialog, and audit-detail components provide consistent interactions without forcing unrelated pages into one large component.
- Server-rendered route pages provide their initial frame; client components own interactive filters, dialogs, mutations, and refetches.

After a successful mutation, related queries are invalidated: user updates refresh Users, Roles, and Audit Logs; department/position changes refresh their list and dependent position selectors; settings refresh their page; invitations refresh Users, Roles, and Audit Logs.

## Error Handling

Zod displays field-local validation messages before a request. The privileged workflow returns clear authorization, conflict, and self-lockout errors without exposing protected account details. Mutations show disabled/pending controls and a recoverable error message. Query failures retain the page structure and offer retry. Empty lists distinguish no records from a filter with no matches. Audit metadata is rendered as labelled safe fields rather than raw, unstructured JSON where possible.

## Testing and Acceptance Criteria

Tests will verify:

- Post-login and authenticated-root navigation send each valid role to its configured workspace; missing roles reach `/unauthorized`.
- Admin navigation, breadcrumbs, labels, keyboard focus, and responsive layout expose all six administration areas only to administrators.
- Users includes Applicant accounts and correctly applies search, role, and active-status filters.
- An administrator can invite an internal account, assign any valid role including from Applicant, and toggle another user's activation; attempts to self-lock out or remove the last active administrator fail safely.
- Department and position forms validate malformed input, edit existing records, and deactivate rather than delete records.
- Organization settings validate and persist only the supported non-secret fields.
- Role, activation, reference-data, and settings changes create auditable records; audit logs are read-only and filterable.
- RLS and the database workflow permit administrators but deny HR Personnel, Employees, Applicants, Management, unauthenticated users, and direct client role/status writes.
- TanStack Query invalidates affected lists after each successful mutation.

The branch is accepted when a System Administrator can manage departments, positions, roles, all account statuses, and organization settings through the protected UI; all role changes are audited; the screenshots' post-login dead end is eliminated; and every other role is denied by both the UI route guard and RLS/workflow checks. Linting, typechecking, unit tests, RLS tests, and a production build must pass.

## Out of Scope

- Employee records, recruitment applications, profile-change approvals, notifications, leave, attendance, deployments, promotion evaluation, dashboards, reports, and Storage UI.
- Secret management, third-party integration settings, email delivery, password management, and hard deletion of master data.
- Theme switching, dark-mode redesign, custom animation systems, and broad changes to the public landing page beyond authenticated-user routing.
