# Civic UI and Public Careers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver a polished, accessible San Juan City Police public careers experience and a unified authenticated workspace whose account actions remain visible.

**Architecture:** Add reusable presentation components instead of restyling every route independently. The public root retains its server authentication gate and renders a query-backed client careers landing. The protected shell gains a header account menu; shared headers, status panels, and metric cards unify high-traffic role pages without changing data access or workflows.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Base UI, Lucide, TanStack Query, Vitest, Testing Library.

**Spec:** docs/superpowers/specs/2026-08-24-civic-ui-and-public-careers-design.md

## Global Constraints

- Keep semantic colour tokens and existing navy/red civic identity. Do not use page-specific hard-coded colours, stock police imagery, or invented seals.
- Public pages may query only published job openings. Do not change RLS, permissions, role redirects, validation, or application URLs.
- Every interaction is keyboard reachable, visibly focused, and at least 44px high/wide where appropriate. No essential action depends on hover.
- Verify 375px, 768px, 1024px, and 1440px without horizontal page overflow; honor prefers-reduced-motion.
- Preserve existing server/client component boundaries and business routes.

---

## File structure

| File | Responsibility |
|---|---|
| src/components/ui/page-header.tsx | Eyebrow, h1, description, metadata, and optional action. |
| src/components/ui/status-panel.tsx | Consistent loading, empty, and error surface. |
| src/components/ui/metric-card.tsx | Accessible numeric dashboard metric card. |
| src/components/recruitment/public-site-header.tsx | Public Careers / Sign in navigation. |
| src/components/recruitment/public-careers-landing.tsx | Query-backed public home page and featured openings. |
| src/components/auth/account-menu.tsx | Always-accessible header account and sign-out menu. |
| src/components/app-shell/app-shell.tsx | Protected shared navigation and header. |
| src/components/reporting/dashboard.tsx | Dashboard adoption of shared UI. |

### Task 1: Establish shared civic presentation primitives

**Files:**
- Create: src/components/ui/page-header.tsx
- Create: src/components/ui/status-panel.tsx
- Create: src/components/ui/metric-card.tsx
- Create: src/components/ui/page-header.test.tsx
- Create: src/components/ui/status-panel.test.tsx
- Create: src/components/ui/metric-card.test.tsx
- Modify: src/app/globals.css

**Interfaces:**
- Produces PageHeader({ eyebrow?, title, description?, action?, meta? }).
- Produces StatusPanel({ kind, title, description, action? }), where kind is loading, empty, or error.
- Produces MetricCard({ label, value, description? }).

- [ ] **Step 1: Write the failing primitive tests**

~~~tsx
render(<PageHeader eyebrow="Careers" title="Current openings" description="Apply securely." action={<a href="/jobs">Browse all</a>} />)
expect(screen.getByRole("heading", { level: 1, name: "Current openings" })).toBeVisible()
expect(screen.getByRole("link", { name: "Browse all" })).toHaveAttribute("href", "/jobs")

render(<StatusPanel kind="empty" title="No openings today" description="Please check again soon." />)
expect(screen.getByText("No openings today")).toBeVisible()

render(<MetricCard label="Active personnel" value={120} description="As of today" />)
expect(screen.getByText("120")).toHaveClass("tabular-nums")
~~~

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: npm run test:run -- src/components/ui/page-header.test.tsx src/components/ui/status-panel.test.tsx src/components/ui/metric-card.test.tsx

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Write the minimal implementation**

~~~tsx
export function PageHeader({ eyebrow, title, description, action, meta }: PageHeaderProps) {
  return <header className="flex flex-col gap-4 border-b border-border/80 pb-6 sm:flex-row sm:items-end sm:justify-between"><div className="max-w-3xl space-y-2">{eyebrow ? <p className="text-sm font-semibold tracking-[0.16em] text-primary uppercase">{eyebrow}</p> : null}<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>{description ? <p className="text-base leading-7 text-muted-foreground sm:text-lg">{description}</p> : null}{meta}</div>{action ? <div className="shrink-0">{action}</div> : null}</header>
}
~~~

Implement StatusPanel as a semantic card: loading uses role=status, error uses role=alert, and all kinds include icon and explanatory copy. Implement MetricCard as an article with muted label and tabular-nums value. Add smooth scrolling and a reduced-motion media query in globals.css; retain existing tokens.

- [ ] **Step 4: Run focused tests and static checks**

Run: npm run test:run -- src/components/ui/page-header.test.tsx src/components/ui/status-panel.test.tsx src/components/ui/metric-card.test.tsx && npm run typecheck && npm run lint

Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add src/components/ui/page-header.tsx src/components/ui/status-panel.tsx src/components/ui/metric-card.tsx src/components/ui/page-header.test.tsx src/components/ui/status-panel.test.tsx src/components/ui/metric-card.test.tsx src/app/globals.css
git commit -m "feat: add civic workspace presentation primitives"
~~~

### Task 2: Build the public SJCP landing and careers discovery flow

**Files:**
- Create: src/components/recruitment/public-site-header.tsx
- Create: src/components/recruitment/public-careers-landing.tsx
- Create: src/components/recruitment/public-careers-landing.test.tsx
- Modify: src/app/page.tsx and src/app/page.test.tsx
- Modify: src/app/jobs/page.tsx and src/app/jobs/[jobId]/page.tsx
- Modify: src/components/recruitment/public-job-list.tsx and public-job-detail.tsx
- Create: src/components/recruitment/public-job-list.test.tsx

**Interfaces:**
- PublicCareersLanding is a client component consuming usePublishedJobs({ page: 1, pageSize: 3 }).
- PublicJobList accepts optional pageSize and featured; the directory default remains 50.
- PublicSiteHeader renders links to /jobs and /login.
- Home retains role-home redirect behavior; unauthenticated output wraps the landing in QueryProvider.

- [ ] **Step 1: Write failing public-journey tests**

~~~tsx
vi.mock("@/hooks/use-recruitment", () => ({ usePublishedJobs: vi.fn(() => ({ isLoading: false, error: null, data: { rows: [{ id: 7, title: "Patrol Officer", location: "San Juan", description: "Serve the community.", closes_on: "2026-10-31" }] } })) }))
render(<PublicCareersLanding />)
expect(screen.getByRole("heading", { level: 1, name: /serve san juan/i })).toBeVisible()
expect(screen.getByRole("link", { name: /patrol officer/i })).toHaveAttribute("href", "/jobs/7")
expect(screen.getByRole("link", { name: /explore open positions/i })).toHaveAttribute("href", "/jobs")
~~~

Update the home test to assert a public Careers link and retain authenticated administrator redirect coverage.

- [ ] **Step 2: Run tests to verify they fail**

Run: npm run test:run -- src/components/recruitment/public-careers-landing.test.tsx src/components/recruitment/public-job-list.test.tsx src/app/page.test.tsx

Expected: FAIL because landing and featured listing do not exist.

- [ ] **Step 3: Implement public navigation, landing, directory, and detail**

~~~tsx
export function PublicSiteHeader() {
  return <header className="border-b bg-background/95"><nav aria-label="Public navigation" className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link className="font-semibold" href="/">San Juan City Police</Link><div className="flex items-center gap-2"><Link className="inline-flex min-h-11 items-center px-3 font-medium" href="/jobs">Careers</Link><Link className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground" href="/login">Sign in</Link></div></nav></header>
}
~~~

Build the landing with a navy hero and one primary Explore open positions CTA; live published roles; three cards containing title, location, deadline, excerpt, and View opening; StatusPanel loading/error/empty states; a three-step How to apply section; and public footer. Update directory/detail to shared width and PageHeader; retain all existing back, closing/status, application, and account routes.

- [ ] **Step 4: Run public tests and production checks**

Run: npm run test:run -- src/components/recruitment/public-careers-landing.test.tsx src/components/recruitment/public-job-list.test.tsx src/app/page.test.tsx && npm run typecheck && npm run lint && npm run build

Expected: PASS, with /, /jobs, and /jobs/[jobId] built.

- [ ] **Step 5: Commit**

~~~powershell
git add src/app/page.tsx src/app/page.test.tsx src/app/jobs/page.tsx src/app/jobs/[jobId]/page.tsx src/components/recruitment/public-site-header.tsx src/components/recruitment/public-careers-landing.tsx src/components/recruitment/public-careers-landing.test.tsx src/components/recruitment/public-job-list.tsx src/components/recruitment/public-job-list.test.tsx src/components/recruitment/public-job-detail.tsx
git commit -m "feat: add public SJCP careers landing"
~~~

### Task 3: Make account and sign-out permanently discoverable

**Files:**
- Create: src/components/auth/account-menu.tsx and account-menu.test.tsx
- Modify: src/components/auth/sign-out-button.tsx
- Modify: src/components/app-shell/app-shell.tsx and app-shell.test.tsx

**Interfaces:**
- AccountMenu({ email, roleLabel }) renders named, 44px-minimum header trigger, identity context, and SignOutButton.
- SignOutButton accepts optional className and button variant; existing sign-out behavior remains.
- AppShell adds AccountMenu without changing its public props.

- [ ] **Step 1: Write failing visibility tests**

~~~tsx
render(<AccountMenu email="hr@example.com" roleLabel="HR Personnel" />)
const trigger = screen.getByRole("button", { name: /account menu for hr@example.com/i })
expect(trigger).toHaveClass("min-h-11")
await userEvent.setup().click(trigger)
expect(screen.getByText("HR Personnel")).toBeVisible()
expect(screen.getByRole("button", { name: /^sign out$/i })).toBeVisible()

render(<AppShell config={ROLE_CONFIG.hr_personnel} email="hr@example.com"><p>Content</p></AppShell>)
expect(screen.getByRole("button", { name: /account menu for hr@example.com/i })).toBeVisible()
~~~

- [ ] **Step 2: Run tests to verify they fail**

Run: npm run test:run -- src/components/auth/account-menu.test.tsx src/components/app-shell/app-shell.test.tsx

Expected: FAIL because no header account menu exists.

- [ ] **Step 3: Implement menu and shell integration**

Use existing Base UI dropdown wrappers, Avatar, and literal Sign out menu item. The trigger uses avatar plus email on desktop, accessible account label on all sizes, and min-h/min-w 11. Put it beside NotificationBell in the sticky header. Retain expanded-sidebar SignOutButton as redundancy. Make thrown auth sign-out errors reset pending state and expose accessible error feedback instead of trapping the user in a disabled control.

- [ ] **Step 4: Run tests and static checks**

Run: npm run test:run -- src/components/auth/account-menu.test.tsx src/components/app-shell/app-shell.test.tsx && npm run typecheck && npm run lint

Expected: PASS. Header sign-out is reachable when sidebar content is hidden.

- [ ] **Step 5: Commit**

~~~powershell
git add src/components/auth/account-menu.tsx src/components/auth/account-menu.test.tsx src/components/auth/sign-out-button.tsx src/components/app-shell/app-shell.tsx src/components/app-shell/app-shell.test.tsx
git commit -m "fix: keep account sign-out actions visible"
~~~

### Task 4: Apply the shared system across dashboards and high-traffic workspaces

**Files:**
- Modify: src/components/reporting/dashboard.tsx
- Create: src/components/reporting/dashboard.test.tsx
- Modify: src/components/app-shell/role-landing.tsx and role-landing.test.tsx
- Modify: src/components/ui/loading-state.tsx, error-state.tsx, empty-table-state.tsx
- Create: src/components/ui/status-states.test.tsx
- Modify: src/components/personnel-records/employee-directory.tsx
- Modify: src/components/recruitment/hr-job-list.tsx
- Modify: src/components/administration/admin-page.tsx

**Interfaces:**
- ReportingDashboard retains role: hr_personnel | management and uses PageHeader, MetricCard, StatusPanel.
- RoleLanding retains config: RoleConfig and uses PageHeader and StatusPanel.
- Existing loading/error/table state prop signatures remain compatible.

- [ ] **Step 1: Write failing adoption tests**

~~~tsx
render(<ReportingDashboard role="hr_personnel" />)
expect(screen.getByRole("heading", { level: 1, name: /HR operations dashboard/i })).toBeVisible()
expect(screen.getByText("42")).toHaveClass("tabular-nums")

render(<RoleLanding config={ROLE_CONFIG.employee} />)
expect(screen.getByRole("heading", { level: 1, name: ROLE_CONFIG.employee.landingTitle })).toBeVisible()
expect(screen.getByRole("status")).toHaveTextContent(/ready/i)
~~~

Mock the reporting hook with deterministic metrics. Add state tests for loading aria-live, error role=alert, and an empty table message that gives a next action.

- [ ] **Step 2: Run tests to verify they fail**

Run: npm run test:run -- src/components/reporting/dashboard.test.tsx src/components/app-shell/role-landing.test.tsx src/components/ui/status-states.test.tsx

Expected: FAIL because the pages do not use the shared components.

- [ ] **Step 3: Adopt the patterns**

Replace duplicated title blocks in reporting, role landing, employee directory, HR job list, and administration page with PageHeader, keeping all existing actions and query logic. Replace raw no-data paragraphs with StatusPanel where applicable; update existing loading/error/table-state markup without changing props. Render dashboard metrics through MetricCard; retain responsive grid and textual table alternatives.

- [ ] **Step 4: Run affected and full suites**

Run: npm run test:run -- src/components/reporting/dashboard.test.tsx src/components/app-shell/role-landing.test.tsx src/components/ui/status-states.test.tsx && npm run test:run && npm run typecheck && npm run lint

Expected: PASS, including existing role, recruitment, personnel, and administration tests.

- [ ] **Step 5: Commit**

~~~powershell
git add src/components/reporting/dashboard.tsx src/components/reporting/dashboard.test.tsx src/components/app-shell/role-landing.tsx src/components/app-shell/role-landing.test.tsx src/components/ui/loading-state.tsx src/components/ui/error-state.tsx src/components/ui/empty-table-state.tsx src/components/ui/status-states.test.tsx src/components/personnel-records/employee-directory.tsx src/components/recruitment/hr-job-list.tsx src/components/administration/admin-page.tsx
git commit -m "feat: unify HRIS workspace presentation"
~~~

### Task 5: Verify responsive behavior, accessibility, and release safety

**Files:**
- Modify: docs/release-verification-matrix.md
- Modify: docs/USER_GUIDE.md

- [ ] **Step 1: Add explicit verification rows**

Add rows for signed-out / showing only published careers; featured card to /jobs/:id; detail back and apply routes; header account trigger visible with sidebar open and closed; keyboard Tab reaches public nav, account, and Sign out; 375/768/1024/1440 no-overflow; and reduced-motion usability.

- [ ] **Step 2: Run the required UI validation query**

Run: python 'C:\Users\ASUS\.agents\skills\ui-ux-pro-max\scripts\search.py' 'animation accessibility z-index loading' --domain ux

Expected: Use the output to check focus, non-hover actions, status recovery, and layered menu/header behavior. Manual cases remain unchecked until observed.

- [ ] **Step 3: Run release checks and inspect non-destructively**

Run: npm run test:run && npm run typecheck && npm run lint && npm run build

Start local app and inspect /, /jobs, a valid /jobs/:id, /login, and one authenticated role route at 375, 768, 1024, and 1440px. Use keyboard-only navigation to open header account menu and reach Sign out. Record only observed results; unavailable accounts/data stay pending.

- [ ] **Step 4: Update user guidance**

Document that visitors browse published openings at / or /jobs, read details, then create an applicant account or sign in to apply. Document that staff open top-right account control and select Sign out; sidebar sign-out remains when expanded.

- [ ] **Step 5: Commit**

~~~powershell
git add docs/release-verification-matrix.md docs/USER_GUIDE.md
git commit -m "docs: verify civic careers interface"
~~~

## Self-review

| Requirement | Plan task |
|---|---|
| Public landing with live published jobs | Task 2 |
| Careers directory, detail, and existing application flow | Task 2 |
| Permanent sign-out independent of sidebar state | Task 3 |
| Consistent shell and high-traffic workspace patterns | Tasks 1, 3, 4 |
| Civic tokens/no invented branding | Global constraints, Task 1 |
| Accessibility, responsiveness, reduced motion, evidence | Global constraints, Task 5 |
| Preserve permissions, routes, business rules | Global constraints, Tasks 2-4 |

No deferred-work markers remain. Task interfaces are produced before later consumers use them.
