# Role-Based Application Shell Design

## Goal

Establish the protected application shell for the five HRIS roles: System Administrator, HR Personnel, Employee, Applicant, and Management. The shell must make the appropriate area discoverable while enforcing access on the server, not merely by hiding navigation.

## Scope

This branch adds the authenticated shell, role-aware navigation, breadcrumbs, loading and error presentation, unauthorized handling, five role landing pages, and the root TanStack Query provider plus shared query-key conventions. It does not add any later module pages, database migrations, or module-specific queries and mutations.

## Architecture

A shared protected route group owns the authenticated layout. Its server component obtains the verified user and application role using the established auth helpers. It renders a reusable authenticated shell and the root client-side TanStack Query provider.

Each role root has a small server layout that accepts exactly one role:

- `/admin` accepts `system_administrator`.
- `/hr` accepts `hr_personnel`.
- `/employee` accepts `employee`.
- `/applicant` accepts `applicant`.
- `/management` accepts `management`.

The role layout is the final authorization boundary. If the authenticated user's role does not match, it redirects to `/unauthorized`. The existing proxy continues to redirect unauthenticated visitors from protected routes to `/login`, preserving the requested path in `next`.

`/unauthorized` is accessible after the redirect and explains that the user does not have permission for the requested page. Missing or invalid role data is handled as unauthorized.

## User Interface

The reusable shell contains:

- A header showing the signed-in user's email and a sign-out control.
- Role-aware navigation derived from a typed configuration. At this stage it contains only the user's role landing page; later feature branches extend their own role's configuration.
- An active navigation state based on the current pathname.
- Breadcrumbs that identify the role area and current page.
- Reusable loading and error states using the project's existing UI components.

Each landing page provides a role-specific title, a concise statement of that role's purpose, and an explicit placeholder that its module summaries will arrive in later roadmap branches. The Management page is informational only and exposes no mutation controls.

## Client Data Foundation

The root layout mounts one client `QueryClientProvider`. The branch also establishes a typed query-key convention for future modules, but does not add query functions, mutations, or invalidation behavior. Future module branches own their query keys, query functions, mutation invalidations, and screens.

## Data and Error Flow

1. The proxy refreshes the Supabase session and directs unauthenticated protected requests to `/login`.
2. The protected layout verifies the current user and role on the server.
3. The role layout checks that role against the route's allowed role.
4. A matching role receives the shell, role navigation, breadcrumbs, provider, and landing page.
5. A mismatching, missing, or invalid role is redirected to `/unauthorized`.

The shell's shared loading and error components are presentational. Individual modules will provide their own async data boundaries and TanStack Query states when they are implemented.

## Testing and Acceptance Criteria

Tests will verify:

- Each role layout permits its own role and sends every other role to `/unauthorized`.
- Existing unauthenticated protection remains intact.
- Navigation exposes only links appropriate to the current role and marks the active page.
- Breadcrumbs and role landing-page copy render correctly.
- The query provider and query-key conventions are available to protected screens.
- Management's landing page contains no mutation control.

The branch is accepted when all five landing pages render in the shared shell, direct out-of-role URLs result in `/unauthorized`, and Management remains read-only. Linting, typechecking, unit tests, and a production build must pass.

## Out of Scope

- Administration, personnel, recruitment, notifications, leave, deployment, promotion, attendance, dashboards, and reports.
- New Supabase tables, migrations, RLS policies, Storage changes, or Edge Functions.
- Module-specific server actions, query functions, mutations, cache invalidation, dashboard summaries, and reports.
