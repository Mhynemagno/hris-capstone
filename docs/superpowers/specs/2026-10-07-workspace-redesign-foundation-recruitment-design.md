# Workspace redesign — Foundation + Recruitment

Date: 2026-10-07
Branch: `feat/workspace-redesign-foundation-recruitment`
Status: approved in brainstorming, awaiting spec review

## 1. Goal

Rebuild the internal ("workspace") side of the HRIS — System Administrator, HR Personnel, Employee and Management — into a calm, professional, ATS-grade interface that HR staff can use all day. Keep every existing feature. Keep the San Juan CPS logo and the police-navy brand. The **Applicant side and the public pages must look exactly as they do today.**

This spec covers sub-project 1+2 of a five-part programme:

| # | Sub-project | Spec |
|---|---|---|
| 1 | Foundation: tokens, type, component kit, workspace shell + navigation | **this spec** |
| 2 | Recruitment: HR dashboard, job postings, applications list, applicant detail | **this spec** |
| 3 | Personnel: employees, deployments, leave, promotions | later |
| 4 | Attendance, reports, public site | later |
| 5 | Admin console (incl. merging the three organization pages into one tabbed page) | later |

### Decisions made in brainstorming

- Brand colour is police navy `#0F3467`. The current green `--primary` (`#00755A`) is dropped inside the workspace only.
- Employee and Management inherit the new shell, tokens and type automatically; their pages are not restructured.
- Density: balanced — 14px body/table text, 13px labels/helper text, 24px page titles, ~44px table rows. Inter is the only typeface.
- Interview scheduling is **out of scope**. "Interview" stays a stage; the dashboard counts applicants in it.
- Approach: a scoped `.workspace` theme plus a new `WorkspaceShell`; one component kit; the Applicant side keeps today's `AppShell` and values.
- Dark mode is out of scope (no toggle exists today).

### Non-goals

- No database migrations, no new RPCs, no changes to business rules or status transitions.
- No interview scheduling, no bulk stage changes, no previous/next stepping between applications, no HR editing of applicant data.
- No visual change to `/applicant/**`, `/jobs/**`, `(public)/**`, `(auth)/**`, `/unauthorized`.

## 2. Architecture: scoping the new look

Today every role renders inside one `AppShell` (`src/components/app-shell/app-shell.tsx`) with one token set (`src/app/globals.css`). Several sizes are fixed in component classes (e.g. `Button` uses `min-h-11`), and the type scale is declared in `@theme inline`, which inlines values so they cannot be overridden per scope.

### 2.1 Token scoping

1. Move the type scale (`--text-*`) out of `@theme inline` into a plain `@theme` block, so utilities compile to `var(--text-sm)` and a scope can redefine them. Values outside `.workspace` stay exactly as today.
2. Introduce component variables with today's values as defaults on `:root`:
   - `--control-h` (default `2.75rem`, today's `min-h-11`), `--control-h-sm`, `--control-h-lg`
   - `--control-radius`, `--card-radius`
   - `--table-row-h`
3. Shared components (`button`, `input`, `textarea`, `native-select`, `combobox`, `badge`, `card`, `page-header`, `form-field`) read those variables instead of fixed classes. Rendered output outside `.workspace` must be identical to today.
4. Add a `.workspace` block that redefines colour, type, and component variables (sections 3.1–3.3).

### 2.2 Shell selection

`src/app/(app)/layout.tsx` picks the shell by role:

- `applicant` → existing `AppShell`, untouched.
- `system_administrator`, `hr_personnel`, `employee`, `management` → new `WorkspaceShell`, whose root element carries `class="workspace"`.

`/notifications` renders inside whichever shell the role uses.

Overlays (dialogs, drawers, menus, toasts) render in portals. The portal container must sit inside `.workspace`, or overlays must be given the class, so they pick up workspace tokens. The kit wraps the base-ui `Portal` so this happens automatically.

### 2.3 Navigation config

`src/lib/app/role-config.ts` keeps the per-role `navigation` array and gains:

- an optional `badge` key per item (`"applicationsAwaitingReview" | "leaveForApproval" | "profileChangesPending"`), resolved by a small client hook;
- labels updated as in section 4.2.

## 3. Visual system (inside `.workspace`)

### 3.1 Colour tokens

| Token | Value | Use |
|---|---|---|
| `--primary` | `#0F3467` | Primary buttons, links, active nav, focus, selected tab |
| `--primary-hover` | `#0B2A55` | Primary hover/pressed |
| `--primary-subtle` | `#EBF0F8` | Active nav background, selected rows, info badges |
| `--background` (canvas) | `#F6F7F9` | Page background |
| `--card` / `--popover` (surface) | `#FFFFFF` | Cards, tables, panels, overlays |
| `--muted` (surface muted) | `#F2F4F7` | Table header, row hover, read-only fields |
| `--border` | `#E4E7EC` | Dividers, card edges |
| `--input` | `#D0D5DD` | Control outlines |
| `--foreground` | `#101828` | Primary text |
| `--secondary-foreground` | `#475467` | Secondary text |
| `--muted-foreground` | `#667085` | Muted text (AA on white) |
| `--ring` | `#0F3467` | Focus ring |
| `--success` / `--success-subtle` | `#067647` / `#ECFDF3` | Success badges and alerts |
| `--warning` / `--warning-subtle` | `#B54708` / `#FFFAEB` | Warning badges and alerts |
| `--destructive` / `--destructive-subtle` | `#B42318` / `#FEF3F2` | Errors, destructive actions |
| `--brand-command-red` | unchanged | Only the 2px line under the top bar |

Rules:

- Status colour is always paired with a text label.
- No gradients.
- Shadows only on floating layers (menus, popovers, dialogs, drawers, toasts). Cards and tables use borders.

### 3.2 Typography (Inter only)

| Role | Size / line height · weight |
|---|---|
| Page title (h1) | 24/32 · 700 |
| Section heading (h2) | 16/24 · 600 |
| Card / panel title (h3) | 14/20 · 600 |
| Body, table cells, inputs | 14/20 · 400 |
| Buttons | 14/20 · 500 |
| Form labels | 13/20 · 500 |
| Helper text, meta, timestamps | 13/18 · 400, muted |
| Table headers, badges | 12/16 · 500, sentence case |
| Metric figures | 28/36 · 600, tabular numbers |

- Tabular numbers in tables, dates and metrics (already set globally for `table`, `time`, `[data-numeric]`).
- Dates display in words via `src/lib/format-date.ts` (e.g. "September 23, 2026").

### 3.3 Spacing, shape, motion, icons

- 4px grid. Page gutter 24px, 32px at ≥1440px. Section gap 24px. Card padding 20px. Form field gap 16px.
- Control height 36px; small 32px; large 40px. Below 768px the minimum is 40px.
- Table rows 44px.
- Radius 6px on controls and badges, 8px on cards, dialogs and drawers.
- Motion:
  - 150ms ease-out for hover and colour changes.
  - Dialogs fade and scale in from 0.98 over 180ms.
  - Drawers slide in over 200ms.
  - No entrance animation on page load.
  - Existing `prefers-reduced-motion` rule kept.
- Icons: Lucide, 16px in controls and 18px in nav, one stroke weight.

### 3.4 Component kit (`src/components/ui`)

New primitives come from the existing shadcn `base-nova` registry (base-ui based) and are restyled to the tokens. New dependency: `sonner`. Nothing else.

| Component | Notes |
|---|---|
| `Button` | Variants: primary, secondary, ghost, destructive (solid), link. Sizes sm/default/lg/icon. `loading` prop shows a spinner and disables the button. Existing variant names keep working. |
| `Input`, `Textarea`, `NativeSelect`, `Combobox` | Restyled via variables. |
| `SearchInput` | Input with a search icon, a clear button, and a 300ms debounce. |
| `Select` | base-ui select, for short option lists in toolbars. |
| `Checkbox`, `Switch` | Replace raw `<input type=checkbox>` in redesigned pages. |
| `FormField` | Label, control, helper text and error; the error is linked with `aria-describedby`. |
| `Badge` | Adds variants `success`, `warning`, `info`, `neutral`, `danger`. |
| `StatusBadge` | Maps a domain status to a badge variant and label (application stages first; extended by later sub-projects). |
| `Card` | Header, title, action and content; border only. |
| `DataTable` | Typed columns. Props cover sortable headers (`aria-sort`), row click (keyboard-accessible: the row's primary cell is a link), optional row selection, a sticky header, skeleton loading rows, empty and error rows, and responsive column hiding (`hideBelow: "md" \| "lg"`). |
| `Pagination` | "1–25 of 132" with Previous/Next; buttons keep the names "Previous page" and "Next page". |
| `Tabs` | base-ui tabs. Optional URL sync via a search parameter (`?tab=`). |
| `Breadcrumbs` | Driven by the shell (section 4.1). |
| `Dialog`, `AlertDialog`, `Drawer` | `role="dialog"` / `role="alertdialog"`; a focus trap; a close button named "Close". |
| `DropdownMenu` | Existing component, restyled. Used for row ⋯ menus and "More" actions. |
| `Popover` | For the "More filters" pop-over. |
| `Toaster` | sonner, bottom-right. Success toasts use `role="status"` and do not steal focus. Errors stay inline. |
| `PageHeader` | Title, optional description, one primary action, and an optional "More" menu. |
| `FilterBar` | Search, selects, a More filters pop-over, active-filter chips and "Clear all". |
| `EmptyState` | Icon, title, one sentence and an optional action. Variants: first-use and no-results. |
| `ErrorState` | Message and a Retry button. |
| `Skeleton` and `LoadingState` | Skeleton visuals; keeps a screen-reader "Loading…" text. |
| `StatTile` / `StatStrip` | Replaces the unused `MetricCard`. |

## 4. Shell and navigation

### 4.1 `WorkspaceShell`

Sidebar:

- White and full height. Width 248px at ≥1280px.
- At 1024–1279px it collapses to a 64px icon rail; the user's choice is remembered in the shadcn sidebar cookie.
- Below 1024px it becomes an off-canvas drawer.
- Header: a 32px logo, then "San Juan CPS" with "HRIS" in muted text below.
- Group headings are 12px, muted, sentence case.
- Active item: `--primary-subtle` background, navy text, and a 2px navy bar on the left.
- Count badges only on items with a `badge` key.

Top bar:

- Navy (`--topbar`), 56px tall, with the 2px `brand-command-red` line along the bottom.
- Left: the sidebar toggle, then the breadcrumbs.
- Right: the notification bell, then the account menu. Sign out stays in the menu, separated by a divider.

Breadcrumbs:

- Built from the active nav item plus an optional page-provided trail, for example *Applications › Juan Dela Cruz*.
- Pages set the trail through a small context hook (`useBreadcrumb`).
- Every level except the last is a link.

Content:

- Redesigned pages use `<PageContainer width="wide">`, with a 1440px maximum.
- Forms and reading content use `width="narrow"`, with a 960px maximum.
- Pages not yet redesigned default to `width="default"`, today's 1152px.

Accessibility:

- The skip link stays.
- Navigation links carry `aria-current="page"`.
- On route change, focus moves to the page h1.

### 4.2 Navigation per role

HR Personnel:

| Group | Label → route |
|---|---|
| — | Dashboard → `/hr` |
| Recruitment | Job postings → `/hr/jobs` · Applications → `/hr/applications` (badge: Submitted count) |
| Personnel | Employees → `/hr/employees` · Deployments → `/hr/deployments` · Leave → `/hr/leave-requests` (badge: For Approval count) · Promotions → `/hr/promotions` |
| Attendance | Attendance → `/hr/attendance` · Kiosk → `/hr/attendance/kiosk` |
| Insights | Reports → `/reports` |
| Public site | Announcements → `/hr/public-site` |

"Attendance Report" (`/reports/attendance-leave`) leaves the sidebar. It stays reachable from Reports.

System Administrator:

| Group | Label → route |
|---|---|
| — | Dashboard → `/admin` |
| People | Accounts → `/admin/users` · Approvals → `/admin/profile-change-requests` (badge: pending count) |
| Organization | Units / Sections → `/admin/departments` · Units / Stations → `/admin/unit-stations` · Ranks → `/admin/ranks` |
| System | Settings → `/admin/settings` · Attendance integration → `/admin/integrations/attendance` · Audit log → `/admin/audit-logs` |

Employee keeps its items, with tidied labels: Dashboard, My profile, Leave, Deployments, Promotion, Attendance, Scan.

Management keeps its items: Dashboard, Reports. "Management workspace" becomes "Dashboard".

Page titles must match nav labels; mismatched titles on pages outside this spec's scope are updated as a copy-only change.

Badge counts:

- Read with `count: "exact", head: true` queries through React Query, refreshed when the window regains focus and every 60s.
- On error, no badge is shown, and nothing else is shown in its place.

## 5. HR dashboard (`/hr`; layout shared with `/management`)

Replaces the current one-long-scroll `src/components/reporting/dashboard.tsx` layout.

**Header**

- Title "Dashboard".
- Period picker: Last 7 days, Last 30 days (default), This month, Custom range. Stored in the URL as `?from=&to=`, and passed to the existing `get_hr_dashboard_summary` / `get_management_dashboard_summary` date parameters.
- HR also gets a **Create ▾** menu: New job posting, New employee, New deployment.

**1. Needs attention** (HR only), full width. One row per item, in this order:

| Row | Count source | Link |
|---|---|---|
| Applications awaiting review | Applications in `submitted` status, regardless of period (count query) | `/hr/applications?stage=submitted` |
| Leave requests for approval | `pendingLeave` | `/hr/leave-requests?status=pending` |
| Unmatched attendance IDs | Unresolved unmatched events (count query) | `/hr/attendance/unmatched` |
| Attendance exceptions | `attendanceExceptions` (period) | `/hr/attendance` |
| Missing promotion requirements | `trainingNeeds` (period) | `/hr/promotions` |

- The leave queue today keeps its status filter in component state only. As the one change to that page in this spec, it reads an initial `?status=` from the URL, so the link above lands on For Approval.
- Each row shows an icon, a label, the count and a chevron, and the whole row is a link.
- Zero-count rows are merged into one muted line: "All clear: unmatched IDs, promotion requirements".
- If every count is zero, the block shows one line: "You're all caught up."

**2. Today strip.** One bordered container with five cells, each a link:

- Personnel (`totalPersonnel`)
- On duty today (`attendanceToday / activeWorkforce`, shown with a percentage)
- On leave today (`onLeave`)
- Active deployments (`activeDeployments`)
- Open job postings (`openJobs`, currently returned but not shown)

**3. Two columns** (stacked below 1024px)

- **Recruitment pipeline**
  - Horizontal bars per stage in workflow order: Submitted, Under review, Shortlisted, Interview, Endorsed to Crame, Neuro exam, For training, Hired.
  - Each bar links to `/hr/applications?stage=<status>`.
  - Not selected sits separately below a divider, in muted text.
  - A footer shows "N hired in this period" (`hiredApplicants`).
- **Attendance**
  - Stacked daily columns (present / late / absent) for the period.
  - Today's split is listed underneath.

**4. Bottom row**

- HR: **Recent applications** — the five newest, with name, job posting, stage badge and submitted date, plus "View all →".
- Management: **Workforce** — personnel by unit/section and by rank, as horizontal bars.

**Removed from the dashboard**

- The personnel by unit and by rank charts (they stay for Management only).
- The leave, deployment and promotion donuts.
- The exceptions chart.
- The attendance pulse gauge, which is replaced by the "On duty today" cell.
- The six "Detailed reports" link cards.

Every removed chart's data remains available in Reports.

**Management view**

- No Needs attention block and no Create menu.
- Otherwise identical, with Workforce in the bottom row.

**States**

- Each block has a skeleton shaped like its content.
- Each block fails on its own, with ErrorState and Retry.
- A period with no data shows a text message inside the chart frame, never empty axes.

**Charts**

- Keep the hand-built bars in `src/components/reporting/charts.tsx`, restyled to the tokens.
- Each chart has a tooltip with the exact value and an `aria-label` summary.

## 6. Job postings

### 6.1 List (`/hr/jobs`)

**Data and URL**

- `listHrJobs` fetches all postings. Its page size is raised from 100 to 1000, with a code comment noting that the list moves to server-side paging if volumes grow.
- Search, status filter, sort and pagination run on the client.
- URL state: `?status=&q=&sort=&page=`.

**Page structure**

- PageHeader: "Job postings" with a primary **New job posting** button.
- Toolbar: status tabs with counts (All · Published · Draft · Closed) and a SearchInput ("Search job postings").

**DataTable columns**

| Column | Content |
|---|---|
| Posting | Title, with location in muted text below. Sortable. |
| Status | StatusBadge |
| Applications | Count, linking to `/hr/applications?job=<id>` |
| Deadline | Date in words, with muted text "Closes in N days", "Closes today" or "Closed". Sortable. |
| Updated | Date. Sortable; the default sort is newest first. |

**Row actions**

- Clicking a row opens `/hr/jobs/<id>`.
- The ⋯ menu ("Actions for <title>") contains:
  - Edit.
  - View applications.
  - View on public site (published only; opens `/jobs/<id>`).
  - Withdraw (anything not closed and not deletable): an AlertDialog, then the existing `withdraw_job_opening`.
  - Delete draft (drafts with 0 applications): the existing `DeleteRecordDialog`.

**States**

- Skeleton rows while loading.
- First use: "No job postings yet", with a New job posting button.
- No results: "No job postings match", with Clear filters.
- Errors: ErrorState with Retry.

### 6.2 Editor (`/hr/jobs/new`, `/hr/jobs/[jobId]`)

**Data**

- Add `getHrJob(id)` to `src/queries/recruitment.ts`, using the same select as `listHrJobs`, filtered by ID.
- `hr-job-editor.tsx` uses it instead of loading the list.

**Layout:** narrow-plus-rail.

Left column — the form, in three titled sections:

1. **Details:** Title, Location, Deadline, Position (read-only), Description.
2. **Requirements:** Education, Eligibility, Other requirements.
3. **Image:** upload, preview, Remove.

Right sticky panel:

- Status badge, application count, deadline.
- Actions: **Save draft** and **Publish** (or **Save changes** once there are applications).
- More ▾ › Withdraw.
- For published postings, "View on public site".

**Behaviour**

- All current fields, validation and RPCs (`save_job_opening`, `set_job_opening_image`) are unchanged.
- Success shows a toast ("Draft saved", "Posting published"); publishing still redirects to `/hr/jobs`.
- The amber notice about existing applications stays, as a `warning` alert.

## 7. Applications list (`/hr/applications`)

**Tabs (URL `?view=`):** Applications (default) and Registered applicants.

### 7.1 Applications tab

**Data and URL**

- `listHrApplicationShortlist` is called without a page cap; its range is raised to 0–999, with the same comment as `listHrJobs`.
- The AI-status and minimum-score filters keep going to the RPC.
- Job, stage, quick view, search, sort and pagination run on the client.
- The registered-but-not-applied rows come from `list_hr_registered_applicants`, as today.

**URL state**

`?quick=&stage=&job=&q=&ai=&minScore=&sort=&page=`

**Quick views** (segmented control)

| Quick view | Rows |
|---|---|
| Active (default) | `submitted`, `under_review`, `shortlisted`, `interview`, `needs_revision`, `endorsed_to_crame`, `neuro_exam`, `for_training` |
| Hired | Hired applications |
| Not selected | Not selected applications |
| Not yet applied | Registered applicants with no application, rendered as rows with a "Not yet applied" badge |
| All | Every application, plus the not-yet-applied rows |

The "Not yet applied" rows are a deliberate change from commit `efe08dc`: they are excluded from the default Active view but stay one click away.

**FilterBar**

- SearchInput ("Search applications": name or applicant number).
- Job posting Select.
- Stage Select.
- **More filters** popover: AI analysis status, minimum AI score.
- Active filter chips, and "Clear all".

**DataTable columns**

| Column | Content |
|---|---|
| Applicant | Initials avatar, name, applicant number (muted). Sortable by name. |
| Job posting | Job title. Hidden below the md breakpoint. |
| Stage | StatusBadge |
| AI match | Score with a thin bar, or muted "Analyzing", "Queued", "Failed" or "Not analyzed". Sortable. |
| Submitted | Date. Sortable. |
| ⋯ | Row menu |

**Sort:** the default is "Best AI match", the RPC's existing order. "Newest" and "Name" are also available.

**Row actions**

- Clicking a row opens `/hr/applications/<id>`. For not-yet-applied rows it opens the registered-applicant drawer (7.2).
- The ⋯ menu contains "Open in new tab" and **Move to stage ▸**, which lists only the allowed next stages from `allowedNextStatuses`. Choosing one opens the Move-stage dialog shared with the detail page (section 8).

**No bulk selection.**

**Pagination:** 25 per page.

**States**

- Skeleton rows while loading.
- First use: "No applications yet. Applicants appear here once they apply to a published posting.", with a link to Job postings.
- No results: "No applications match these filters", with Clear filters.
- Errors: ErrorState with Retry.

### 7.2 Registered applicants tab

**Toolbar**

- SearchInput (name, email, mobile).
- Filter: All · Applied · Not yet applied.

**DataTable columns**

| Column | Content |
|---|---|
| Applicant | Name and number |
| Email | Plus an "Unconfirmed" warning badge where needed |
| Mobile | Hidden below lg |
| Registered | Date |
| Latest stage | StatusBadge, or muted "Not yet applied" |

**Row click**

- Opens the latest application.
- With no application, it opens a **Drawer** showing name, applicant number, email (with its confirmation state), mobile and registered date. The drawer has no actions.

## 8. Applicant detail (`/hr/applications/[applicationId]`)

Rewrites `hr-application-detail.tsx` and `hr-required-documents.tsx` into smaller units under `src/components/recruitment/application-detail/`:

- `application-header.tsx`
- `stage-tracker.tsx`
- `move-stage-dialog.tsx`
- `not-selected-dialog.tsx`
- `hire-dialog.tsx`
- `overview-tab.tsx`
- `profile-tab.tsx`
- `documents-tab.tsx`
- `activity-tab.tsx`
- `details-panel.tsx`

Data and RPCs are unchanged:

- Reads: `getMyApplication` with `applicants(*)` and `job_openings`, AI scores, history, required documents.
- RPCs: `transition_application_status`, `hire_application`, `add_application_remark`, `retry_application_analysis`.

### 8.1 Header band

**Identity**

- Photo or initials avatar.
- **h1 = applicant full name.**
- Applicant number.
- Job posting title, linking to `/hr/jobs/<id>`.
- "Submitted <date in words>".

The breadcrumb trail is *Applications › <name>*.

**Stage and timing**

- StatusBadge for the current stage.
- "in <stage> for N days", computed from the latest status-history entry.

**Actions**

| Current stage | Primary | Secondary |
|---|---|---|
| submitted … neuro_exam (has allowed next stages) | **Move to next stage** → Move-stage dialog | **Not selected** → Not-selected dialog (when allowed) |
| endorsed_to_crame without `bmi_proof` | **Move to next stage**, disabled, with the reason inline: "Waiting for the applicant's BMI proof" | Not selected |
| for_training | **Hire applicant** → Hire dialog | Not selected |
| needs_revision | none — inline note "Waiting for the applicant to resubmit" | none |
| hired / not_selected | none — outcome shown with its date | none |

### 8.2 Dialogs

**Move-stage dialog**

- Radio list of the allowed next stages, excluding `not_selected`.
- Optional "Note to applicant" textarea, with helper text "Included in the applicant's notification".
- Confirm button: "Move to <stage>".
- Errors are shown inside the dialog.
- On success: toast "Moved to <stage> · applicant notified".

**Not-selected dialog** (AlertDialog)

- Body: "This ends the application. The applicant will be notified."
- Optional note.
- Confirm button: destructive "Mark as not selected".

**Hire dialog**

- Fields: Applicant number (read-only), Badge number (required, `BadgeNumberInput`), Notes.
- Explanatory line: "Creates the employee record, sends an account activation email, and notifies the applicant."
- Confirm button: "Hire applicant".
- Errors are shown inside the dialog.

### 8.3 Stage tracker

- A horizontal stepper below the header: Submitted → Under review → Shortlisted → Interview → Endorsed to Crame → Neuro exam → For training → Hired.
- Completed stages show a check, the current stage is highlighted in navy, and future stages are muted.
- `not_selected` shows as a red terminal marker at the stage where it occurred.
- `needs_revision` shows as a warning marker at the current position.
- Below 768px it collapses to "Stage N of 8 · <stage>".
- It is an ordered list with `aria-current="step"` on the current stage.

### 8.4 Tabs (URL `?tab=`) with a details panel

| Tab | Contents |
|---|---|
| **Overview** (default) | AI match card (score/100, explanation, and **Retry analysis** when failed or timed out; "Analyzing…" otherwise). Cover note. Document checklist: "4 of 5 required documents uploaded", naming what is missing and linking to Documents. Latest remark. |
| **Profile** | Read-only definition lists of every field `applicants(*)` provides, grouped as Personal, Contact, Address, Education & eligibility. Empty values show "Not provided". |
| **Documents (n)** | One list with two groups: *Required profile documents* (the 5 profile documents) and *Submitted with this application* (CV, credential, BMI proof). Each row shows type, file name, uploaded date and a **View** button. View opens the file in one click: it opens a new tab synchronously, then sets its location once the signed URL resolves, which avoids popup blockers. Missing files show "Not uploaded". |
| **Activity (n)** | An "Add remark" composer at the top (textarea; button "Add remark"; helper "The applicant is notified"). Below it, a single timeline of stage changes and remarks, newest first, each with actor and timestamp. |

**Details panel** (sticky, 300px, right):

- Email, mobile, applicant number, job posting, submitted date, last stage change.
- Below 1024px it renders above the tabs as a compact two-column strip.

### 8.5 States

- Skeleton header and tab while loading.
- Unknown ID: an h1 "Application not found", with a link back to Applications.
- Tab sections fail on their own, with ErrorState and Retry.

## 9. Pages outside this spec's redesign

These pages get the new shell, tokens and controls automatically and are otherwise unchanged: Personnel, Attendance, Reports, Public site, Admin, the Employee pages, and the Management pages other than the dashboard.

- `.workspace` adds `:where()`-scoped default styles for raw `table`, `th`, `td` and `tr:hover`, so the hand-built tables match the new look until the later sub-projects replace them with `DataTable`.
- They keep `PageContainer width="default"` (1152px).
- Inline success messages stay until their sub-project.

## 10. Testing and verification

**Applicant side unchanged**

- Before any styling change, add `e2e/applicant-visual-baseline.spec.ts`, using Playwright `toHaveScreenshot`, run against local Supabase.
- Cover the applicant dashboard, profile, documents, applications list and detail, and the apply page, plus `/`, `/jobs`, `/jobs/[id]`, `/login` and `/applicant/register`.
- Generate the baselines on the untouched branch head; they must pass after every later commit.

**Unit tests (vitest)**

- New kit components:
  - DataTable: sort and `aria-sort`, empty/error/loading rows, row link.
  - Pagination: labels and totals.
  - AlertDialog: confirm and cancel.
  - Tabs: URL sync.
  - FilterBar: chips and clear.
  - StatusBadge: mapping.
- Navigation: role-config labels; badge hook hides on error.
- Dashboard: attention rows collapse at zero; "all caught up" state; period goes into the URL.
- Job postings: filtering, sorting, row-menu visibility rules.
- Applications: quick-view membership (including "Not yet applied"), URL round-trip.
- Applicant detail:
  - The action matrix in 8.1, one case per stage.
  - The BMI-proof disabled state.
  - The Hire dialog's required badge number.
  - Documents grouping.
- Existing tests whose copy or structure changes are updated in the same commit:
  - `app-shell.test.tsx` and `role-layouts.test.tsx`.
  - The recruitment component tests.
  - The `ui/*` tests.

**End-to-end**

- Update selectors in `business-journeys.spec.ts`, `capstone-objectives.spec.ts` and `role-access.spec.ts` where nav labels or copy change.
- Kept stable on purpose:
  - Dialog and alertdialog roles.
  - "Close", "Next page" and "Previous page".
  - `role="status"` success text.
  - "Loading…" screen-reader text.
  - One h1 per page.
  - `aria-current` navigation links.
- Extend `iso25010-quality.spec.ts` axe scans to `/hr/jobs`, `/hr/applications`, `/hr/applications/[id]` and the dashboard.
- Extend `responsive-layout.spec.ts` to check no horizontal overflow at 1366, 1024 and 390px for those pages.

**Done means:** `npm run typecheck`, `npm run lint`, `npm run test:run` and `npm run test:e2e` all pass, and the applicant visual baseline is unchanged.

## 11. Delivery order (one PR)

Each step leaves the app working.

1. Applicant visual baseline (section 10).
2. Token scoping (section 2.1) and the `.workspace` theme (section 3).
3. Component kit (section 3.4) and `sonner`.
4. `WorkspaceShell`, navigation config and badges (section 4); shell selection in `(app)/layout.tsx`; default table styles (section 9).
5. HR and Management dashboard (section 5).
6. Job postings list and editor (section 6).
7. Applications list (section 7).
8. Applicant detail (section 8).
9. Update the navigation labels in the user guide (`docs/user-guides/hris-role-user-guide.md`); final verification.
