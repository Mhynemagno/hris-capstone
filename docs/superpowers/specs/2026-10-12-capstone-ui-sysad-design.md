# Capstone UI: System Administrator Redesign (PR 4 of 4)

**Date:** 2026-10-12  
**Branch:** `codex/capstone-ui-sysad` from `origin/main` at `59d70cdd`  
**Sources:** `docs/design/capstone-ui/sysad.html`; `C:\Users\ASUS\Downloads\Final Changes (1).pdf`, page 49; prior Applicant, HR, and Employee Capstone design specifications.

## Intent

Finish the fourth and final Capstone UI PR by bringing the System Administrator experience into the established station dashboard design. The redesign must make the administrative information architecture clearer without creating a second administrative surface, changing authorization, weakening existing mutation safeguards, or displaying unreliable data states.

Success is a System Administrator who signs in through the existing email-and-Access-Level flow, receives the existing `StaffShell`, sees the page-49 three-card administrative dashboard, and can use every current `/admin/*` workflow with the same authorization and persistence behavior in the established Capstone visual language.

## Confirmed decisions

| Topic | Decision |
| --- | --- |
| Branch and integration | One PR from `codex/capstone-ui-sysad` directly into `main`; it is not stacked on the employee PR. |
| Shell and roles | Reuse `StaffShell`; do not add a shell or a role. The existing `requireRole("system_administrator")` guard remains authoritative. |
| Navigation scope | SysAd navigation exposes only system-administration items. HR recruitment, leave, deployment, and attendance-operation routes are not linked or granted to SysAd. |
| Font floor | SysAd uses the HR and Employee minimum of **9px**. |
| Admin Control justification | Do not add a global Admin Control modal or a non-persisted remarks input. Existing mutation audit behavior remains intact; no audit-log schema change or migration is needed. |
| Authentication | `/login?as=admin` remains the email-and-password Admin & HR Login with enforced `HR Admin` / `System Administrator` Access Level. `/login?as=employee` remains the badge-number login. |
| Visual language | Keep `.capstone-ui`, Lucide icons, `/san-juan-police-logo.png`, slate-500 captions on light surfaces, slate-400 inactive sidebar labels on dark surfaces, and dates written in words. Do not use stock photographs of real people. |
| Loading and errors | A query loading or error state never renders a definitive empty result or a `0 of 0` pager. Mutation errors remain visible to the user. |
| Local test config | Preserve the untracked `playwright.local.config.ts`; never stage it. It retains no webServer, one worker, and localhost base URL. |
| Production database | Do not push migrations to live Supabase. This scope adds no migration. |

## 1. Shared shell and information architecture

`ProtectedLayout` continues to select `StaffShell` from the current role configuration. The existing navy sidebar, station logo, responsive off-canvas navigation, white header, notification drawer, account menu, skip link, focus-on-route change behavior, and staff error toaster remain unchanged.

For the System Administrator configuration, navigation is ordered and grouped to mirror the SysAd mockup:

1. **Dashboard** → `/admin`
2. **People and Access:** **Manage Accounts** → `/admin/users`; **Review Approvals** → `/admin/profile-change-requests`
3. **Station Organization:** **Units and Sections** → `/admin/departments`; **Units and Stations** → `/admin/unit-stations`; **Ranks** → `/admin/ranks`
4. **System Oversight:** **Attendance Integration** → `/admin/integrations/attendance`; **Audit Log** → `/admin/audit-logs`; **System Settings** → `/admin/settings`

`/admin/roles` remains an authoritative redirect to `/admin/users`; it is not added as a duplicate navigation item. The header subtitle gains a System Administration and Station Controls label for SysAd routes, and every restyled admin path is registered as a Capstone redesigned route so it receives the standard canvas and spacing.

## 2. System Administration dashboard (`/admin`)

The dashboard follows `sysad.html` and PDF page 49 exactly in hierarchy: a `PageTitle` reading **System Administration** with its security-and-controls caption, then three responsive control cards (one column on narrow screens and three columns at desktop widths).

Each card has a tinted Lucide icon header, title, slate-500 descriptive caption, and directly navigable action rows. Rows use their existing paths; they do not open a synthetic configuration modal:

| Card | Action rows |
| --- | --- |
| People and Access | Manage Accounts; Review Approvals |
| Station Organization | Units and Sections; Units and Stations; Ranks |
| System Oversight | Attendance Integration; Audit Log; System Settings |

The dashboard may state that administrative activity is recorded in the existing audit trail, but cannot solicit or imply storage of an administrator justification that the database does not retain.

## 3. Authoritative administrative routes

All existing admin routes retain their current data hooks, server authorization, Zod validation, URLs, query filters, mutations, refetches, and audit behavior. This work is a visual and interaction redesign, not an administration feature rewrite.

### 3.1 People and Access

`/admin/users` remains the account listing, invitation, edit, deletion, and linked read-only employee-profile entry point. The restyle uses Capstone table cards, state pills, word-form dates, toolbar controls, staff modal fields, and shared staff buttons. It retains the existing error feedback for failed invitations or edits and the existing deletion confirmation. It never shows an empty account table until the query has succeeded.

`/admin/profile-change-requests` remains the existing approval queue and detail flow. Its actions retain their protected decision paths and errors; the redesign changes presentation only.

### 3.2 Station Organization

`/admin/departments`, `/admin/unit-stations`, and `/admin/ranks` retain their respective paginated catalogue, filtering, add/edit modal, mutation, and deletion behavior. Each receives the shared `PageTitle`, `StaffTableCard`, `StaffPager`, `StaffModal`, `staffButton`, and `ui/staff-fields` treatment wherever those building blocks fit the existing behavior.

Queries preserve their search/filter toolbar while loading subsequent data. A first load uses a localized table loading state; an error uses an actionable retry state; only a successful empty response shows the existing empty state. A pager is omitted for loading and errored collections and for a known-zero collection, avoiding `0 of 0`.

### 3.3 System Oversight

`/admin/integrations/attendance` adopts the same `PageTitle` and Capstone controls around the existing attendance-adapter configuration. It remains limited to the SysAd non-secret configuration authority already enforced by the existing implementation.

`/admin/audit-logs` remains read-only. Its search/filter table, word-form timestamps, details modal, and error/empty states are restyled; it never gains a mutation control or an editable audit justification.

`/admin/settings` remains a read-only summary until the user explicitly opens the existing edit dialog. Its configuration form preserves validation and user-visible mutation errors. It does not expose secrets and does not introduce a database-backed justification requirement.

## 4. Reusable presentation components

The implementation prioritizes existing building blocks rather than inventing parallel primitives:

- `PageTitle` supplies all restyled admin page headings and captions.
- `StatusPill` maps active/inactive and workflow states accessibly, with text in addition to color.
- `StaffTableCard` and `StaffPager` own Capstone table chrome and safe pager visibility.
- `StaffModal`, `staffButton`, and `ui/staff-fields` carry existing create/edit/detail interactions.
- `staff-shell/page-meta.ts` holds SysAd route subtitle and redesigned-route classification.

If a legacy administration primitive must remain during incremental conversion, it must use the same `.capstone-ui` classes and state semantics rather than visually diverging.

## 5. Accessibility, responsiveness, and error handling

- Use real links for navigation, keyboard-accessible buttons for actions, visible focus rings, and accessible labels for icon-only controls.
- Maintain readable contrast: slate-500 captions on light backgrounds and slate-400 labels on the navy sidebar. Status does not rely on color alone.
- Preserve the `StaffShell` mobile drawer and make card grids, toolbars, tables, and dialogs usable at 375px, 768px, 1024px, and 1440px without horizontal page overflow. Tables may scroll within their card.
- Use short transitions only for interaction feedback and respect the existing reduced-motion styles.
- Bubble query and mutation failures into the page or dialog’s established error presentation. Never replace an error with a successful-looking empty state.

## 6. Tests and verification

Every behavior change follows RED → GREEN: write a focused failing Vitest/Testing Library assertion, observe the intended failure, implement the smallest change, and rerun the focused test before proceeding.

### Unit and component tests

- `ROLE_CONFIG` and `StaffShell`: SysAd navigation order and groups, no HR operational navigation, slate-400 dark sidebar labels, correct active route, and System Administration header metadata.
- `/admin`: exact three-card hierarchy, all nine correct links, card labels and captions, and absence of a fake justification modal.
- Restyled route pages: `PageTitle` titles/captions and reuse of staff layout primitives while retaining existing user, approval, organization, settings, audit, and integration actions.
- State boundaries: loading shows a localized loading indicator and preserves usable controls; error shows retry/error feedback; a successful empty collection has no pager; a populated collection has the correct word-form range pager.
- Mutations: an existing failed account, organization, settings, or integration action stays visibly failed rather than being dismissed as success.

### Deferred commands

At the user’s current instruction, do **not** run `npx supabase db reset`, `npx supabase test db`, `npm run start -- --hostname 127.0.0.1 --port 3000`, or any Playwright command. Once explicitly approved, run the mandated sequence: database reset before database tests; build once; a single localhost production server; then each affected Playwright spec one file at a time with the preserved local config and reviewed visual diffs only.

Vitest will run in memory-safe halves. Before PR delivery, run the relevant lint, typecheck, production build, Vitest halves, and then the user-authorized database/E2E/visual verification. Report any pre-existing failures distinctly.

## 7. Delivery

- Create one PR from `codex/capstone-ui-sysad` into `main`.
- The PR confirms no migration was added and no live Supabase database was touched.
- The final handoff summarizes all four Capstone UI PRs—Applicant, HR, Employee, and SysAd—and lists any remaining follow-ups.
