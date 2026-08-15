# Administration UI Completion Design

**Branch:** `feat/06-administration-ui-completion`
**Date:** 2026-08-15

## Goal

Make every existing System Administrator route usable by connecting it to the protected Supabase workflows created in the Administration Master Data branch. Administrators can manage accounts, roles, departments, positions, organization settings, and audit-log review without exposing secrets or weakening database authorization.

## Scope

The feature completes these protected routes:

- `/admin/users`: paginated account directory; name/email search; role and active-status filters; internal-account invitation; role changes; activation/deactivation.
- `/admin/roles`: paginated managed-account list focused on eligible role assignments.
- `/admin/departments`: paginated directory with create, edit, search/filter, and non-destructive deactivation.
- `/admin/positions`: paginated directory with create, edit, search/filter, department assignment, and non-destructive deactivation.
- `/admin/settings`: view and update the single allowed organization-settings record.
- `/admin/audit-logs`: searchable, filterable, read-only, paginated audit history.

All lists fetch 20 rows per request. The branch deliberately excludes persisted table preferences and Zustand state because no shared, durable client state is needed.

## Architecture

Each route stays inside the existing server-side administrator layout, which enforces `system_administrator` access. Routes render focused client workspace components for their interactive controls.

The administration client layer has four responsibilities:

1. Shared Zod schemas validate filters and form values at the client boundary. An invitation schema is added alongside the existing administration schemas.
2. `src/queries/administration.ts` contains browser Supabase query functions and mutation functions. It validates inputs before creating a request.
3. `src/hooks/use-administration.ts` exposes TanStack Query hooks, query keys, stale-time settings, and targeted invalidation after mutations.
4. Reusable table/filter/pagination and form-panel components provide consistent user experience across the six workspaces.

React Hook Form, with the Zod resolver, is the standard form controller for all interactive administration forms. State that belongs to a single form or page remains component-local; no Zustand store is introduced.

## Protected Data Flows

Normal department, position, settings, and audit-log operations use the browser Supabase client with the public publishable key. RLS remains the authoritative access control.

User management uses existing protected workflows:

- An invitation issues an explicit `POST` request to the deployed `invite-internal-user` Edge Function with the current session token. The browser never receives a secret/service-role key.
- Role and activation changes call `public.update_managed_user`, the audited security-definer RPC. The UI does not directly update `user_roles` or `profiles`.
- The Roles workspace uses the same managed-user workflow, ensuring role assignment is consistently audited.

Successful mutations invalidate only the administration query keys that could now be stale, including users/roles and audit-log data after workflows that generate audit entries. Queries use a non-zero stale time to avoid refetching on every render.

## User Experience

Every list supports server-side pagination and a compact filter area. Search and filter changes are parsed with Zod, included in the query key, and passed to Supabase so a page never fetches the entire dataset.

Create and edit actions open a focused form panel. Each form shows field-level validation feedback, disables submit while a mutation is pending, and reports a recoverable mutation error without discarding user input.

Departments and positions are deactivated by setting `is_active` to false; they are not deleted. This preserves records referenced by personnel history. The settings workspace displays only organization name, support email, and default timezone. The audit-log workspace contains no edit, delete, or mutation action.

All workspaces provide loading, empty, validation, and query-error states. UI controls complement, but never replace, the route guard, Edge Function authorization, RPC authorization, or RLS.

## Testing and Verification

Component and hook tests cover Zod validation, paginated filter behavior, loading/empty/error states, and query invalidation after successful mutations. Workflow tests cover administrator success and non-administrator denial for invitation, managed-user role/status changes, and protected administration reads. Existing SQL RLS tests are extended where needed.

Before handoff, run:

```text
npm run lint
npm run typecheck
npm run test:run
npm run build
npx supabase@latest test db --linked supabase/tests/administration_master_data.test.sql
```

The database test is run when a linked Supabase environment is available. No Supabase secret, service-role key, real personnel data, or local environment file is committed.
