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

The reusable shell uses a modern, restrained enterprise-dashboard presentation rather than a default page-and-links layout. It follows the existing Tailwind CSS v4 and shadcn/ui setup, using semantic design tokens instead of per-component raw colors. The visual direction is balanced and professional: clear type hierarchy, white or neutral surfaces, restrained cyan primary accents, emerald success/status accents, soft borders, and subtle elevation. Status colors must never be the sole indicator of meaning.

The reusable shell contains:

- A responsive `SidebarProvider` shell with an inset sidebar on desktop and an off-canvas, keyboard-accessible navigation drawer on small screens. A compact sidebar trigger remains in the header.
- A branded sidebar header and role badge, role-aware navigation derived from a typed configuration, and a footer user menu containing the signed-in email and sign-out control. At this stage navigation contains only the user's role landing page; later feature branches extend their own role's configuration.
- Active navigation states that are visible by shape, background, and text weight rather than color alone.
- A slim, sticky top bar with the sidebar trigger and responsive breadcrumbs. The role badge, signed-in email, and sign-out control remain together in the sidebar footer so account controls have one predictable location. Breadcrumbs collapse gracefully on narrow screens.
- A responsive content frame with adaptive gutters, a maximum readable content width, consistent 4/8px spacing rhythm, and unhurried section spacing.
- A polished landing-page hero made from a page title, role-specific purpose statement, and a compact "What you can do here" placeholder card. These placeholder cards are informational and contain no non-functional controls.
- Reusable `Skeleton` loading patterns and existing accessible loading/error states. Error states use an icon, clear recovery message, and a retry affordance only where a later module can actually retry.

The implementation adds required shadcn/ui primitives through the current CLI rather than hand-copying component code: Sidebar, Breadcrumb, Avatar, Badge, Button, Card, Dropdown Menu, Separator, Sheet, Skeleton, and Tooltip. Lucide is the sole icon family; emoji are not used as structural icons.

Each landing page provides a role-specific title, a concise statement of that role's purpose, and an explicit placeholder that its module summaries will arrive in later roadmap branches. The Management page is informational only and exposes no mutation controls.

## Interaction, Responsiveness, and Accessibility

The app shell is responsive from a 375px viewport upward, avoids horizontal scrolling, and preserves usable content at common tablet and desktop widths. The sidebar is persistent only when sufficient horizontal space exists; mobile navigation opens as an off-canvas drawer and returns focus correctly after close.

Every interactive control is keyboard reachable, has a visible focus ring, and has an accessible name. A skip link targets the main-content landmark so keyboard users can bypass repeated navigation. Native links and buttons retain their semantic behavior; custom `div` controls are not used. Icon-only controls use a tooltip and explicit accessible label.

The default color mode is light, with WCAG AA contrast for normal text (at least 4.5:1). The implementation does not add a theme switch in this branch; components must still use semantic tokens so a later dark-mode decision does not require a visual rewrite. Hover, focus, selected, disabled, and pending states are visually distinct. Motion is limited to brief 150–300ms opacity/color transitions and honors `prefers-reduced-motion`.

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
- The responsive navigation trigger, skip link, semantic landmarks, accessible labels, and visible keyboard focus behavior are present.
- Loading, error, active-navigation, and unauthorized states are understandable without relying only on color.
- The query provider and query-key conventions are available to protected screens.
- Management's landing page contains no mutation control.

The branch is accepted when all five landing pages render in the polished shared shell, direct out-of-role URLs result in `/unauthorized`, the shell is usable with keyboard and at small/mobile through desktop widths, and Management remains read-only. Linting, typechecking, unit tests, and a production build must pass.

## Out of Scope

- Administration, personnel, recruitment, notifications, leave, deployment, promotion, attendance, dashboards, and reports.
- New Supabase tables, migrations, RLS policies, Storage changes, or Edge Functions.
- Module-specific server actions, query functions, mutations, cache invalidation, dashboard summaries, and reports.
