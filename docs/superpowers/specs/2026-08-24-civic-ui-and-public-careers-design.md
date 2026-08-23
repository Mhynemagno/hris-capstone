# Civic UI and Public Careers Design

**Date:** 2026-08-24  
**Status:** Proposed

## Goal

Make the San Juan City Police HRIS feel like a clear, credible civic service for
the public and a capable, modern workplace for staff.  The unauthenticated
default route becomes a public recruitment destination; authenticated routes
share a consistent, accessible application frame.

## Experience principles

- **Official, not ornate.** Retain the existing police navy and command-red
  identity, with bright neutral content surfaces. Avoid gradients, oversized
  decoration, and marketing language that is not backed by a real service.
- **Actions remain visible.** Navigation labels stay visible at normal desktop
  widths; critical actions never require hover. Every control is keyboard
  reachable with a visible focus ring and a 44px minimum target.
- **Content explains the next step.** Job seekers immediately see open roles
  and application routes. Staff pages lead with the purpose, current status,
  and one primary action.
- **One visual language.** The same spacing, typography, surface, table,
  form, loading, empty, and error patterns appear in every role workspace.

## Design system

### Tokens and typography

- Keep semantic theme tokens; do not introduce page-specific hex colours.
- Evolve the existing navy/red palette with slate background and white
  surfaces. Navy is structural; command red only marks priority/primary civic
  accents and never conveys status alone.
- Use the existing font delivery unless a bundled font integration is already
  present. Establish a stable scale: 12, 14, 16, 18, 24, 32, 40px; headings use
  600--700 weight, body text 400--500, and body line-height at least 1.5.
- Use 4px/8px rhythm, 12px control radius, 16px cards, and a small consistent
  shadow scale. Motion is opacity/transform only, 150--250ms, and suppressed
  for `prefers-reduced-motion`.

### Reusable patterns

- `PageHeader`: eyebrow/section label, h1, explanatory sentence, optional
  primary action, and optional supporting metadata. It replaces isolated
  title/action layouts on authenticated and public pages.
- `SectionCard`: clear surface boundary, predictable 20--24px padding,
  meaningful title, and an optional header action.
- `DataToolbar`: search/filter/status summary plus a single primary CTA;
  collapses cleanly on narrow screens.
- `StatusNotice`: matched loading, empty, error, and success presentations
  that describe recovery or the next action.
- `ProfileMenu`: visible header trigger showing initials and role/email at
  desktop widths; its menu contains profile context and explicit "Sign out".
  The sidebar footer remains an additional, never sole, sign-out route.

## Public recruitment journey

### Default route (`/`)

Unauthenticated visitors see a public landing page. Authenticated users retain
their existing role-home redirect.

1. A slim public header identifies San Juan City Police and provides `Careers`
   and `Sign in` actions.
2. The hero explains the civic recruitment purpose and gives one primary CTA,
   `Explore open positions`, plus a secondary `Sign in` action.
3. A live **Open positions** section renders published jobs from the existing
   recruitment query. It uses compact, scannable cards (title, location,
   closing date, excerpt) and shows loading, error, and empty states without
   layout shifts.
4. A concise "How to apply" three-step section sets expectations: find a
   position, create an applicant account, submit securely.
5. A final recruitment CTA and a restrained footer provide careers, sign-in,
   and official-system context.

The existing `/jobs` index becomes the full, searchable/scannable careers
directory. Its detail page preserves a clear back-to-careers path, opening
details, deadline/status, and application CTA. Public availability is limited
to already-published openings; no new public data access is introduced.

## Authenticated workspace journey

### Shared app shell

- Retain the role-aware sidebar on desktop and the mobile drawer pattern.
- Replace the title-only header with a header that has the sidebar control,
  contextual breadcrumb/title, notification bell, and permanent account menu.
- The account trigger is visible without hover/collapsing, is at least 44px,
  uses an accessible label, and exposes a plainly worded Sign out item.
- When the sidebar is collapsed or off-canvas, its footer does not become the
  only way to find account actions.
- Use active navigation states with both label and colour/shape indicator;
  preserve deep links and role-specific navigation.

### Role dashboard and operational screens

- Dashboard pages use `PageHeader`, a responsive key-metric grid, and clear
  task/attention sections. Charts and metrics retain textual summaries and
  loading/error states.
- Directory, jobs, applications, attendance, leave, deployment, promotion,
  administration, reporting, and profile screens use the same header, toolbar,
  table/card, and empty-state patterns. Existing business actions and routes
  remain unchanged.
- Forms group related fields under concise headings, maintain visible labels,
  reserve helper/error space, and keep save/cancel actions easy to find.
- Dense data tables stay scroll-safe on mobile and elevate the most important
  fields/actions rather than forcing a horizontal-only workflow.

## Responsive and accessibility requirements

- Verify layouts at 375, 768, 1024, and 1440px; no horizontal page scroll.
- Use sequential heading levels, landmark regions, visible focus, meaningful
  icon labels, and text/icon support for status colour.
- Body text maintains WCAG AA contrast; all interactions have pointer, hover,
  focus, disabled, loading, and error states.
- No primary action depends on hover. The page remains operable with keyboard
  and touch; navigation and sign-out stay discoverable.

## Scope boundaries

- This is a presentational and interaction-system pass. It must not relax RLS,
  alter permissions, expose unpublished jobs, or change recruitment workflow
  rules.
- Do not add stock police imagery or invent official seals. Use the existing
  wordmark/icon treatment until approved brand assets are supplied.
- Preserve current role redirects, route ownership, form validation, and
  server/client data boundaries.

## Acceptance criteria

1. Signed-out visitors land on an attractive public SJCP careers page and can
   see current published openings without signing in.
2. An opening can be reached from the landing page and careers directory, and
   clearly leads to the existing application path.
3. Every signed-in page has an account/sign-out route that remains visible
   regardless of sidebar state.
4. The shared shell and operational pages use consistent headers, surfaces,
   spacing, form/table states, and responsive behavior without breaking
   existing roles or functionality.
5. Automated tests, type checking, linting, production build, and targeted
   responsive/accessibility inspection pass before release.
