# Dashboards and Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the HR and Management landing pages with secure live dashboards and add browser-exportable, role-safe reports.

**Architecture:** A non-exposed `reporting` Postgres schema owns the read models. Four narrow public RPCs call private, role-checking reporting functions and return fixed JSON contracts for HR/Management dashboard and report requests. Typed Zod schemas, query functions, TanStack hooks, and reusable components consume those contracts; the browser produces bounded CSV and print-to-PDF output.

**Tech Stack:** Next.js App Router, TypeScript, React 19, Tailwind CSS, shadcn/ui, TanStack Query, Zod 4, Supabase PostgreSQL/RLS/pgTAP, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-dashboards-and-reports-design.md`

## Global Constraints

- Keep all source-of-truth data in existing module tables; do not add report storage, scheduled jobs, external BI services, chart libraries, server-generated PDFs, or email delivery.
- Browser exports are CSV plus print-friendly pages for browser Save as PDF; never upload or retain a generated report file.
- HR has authorized row detail; Management receives read-only aggregate/de-identified results and never sees PII, notes, documents, or operational mutation controls.
- Default every reporting date range to the last 30 calendar days; current-state workforce and active-deployment metrics remain date-independent.
- Use Zod for report keys, filters, pagination, and export bounds on the client; private database functions repeat role and range validation.
- Keep reporting objects out of exposed schemas. Every public RPC uses a fixed whitelist, `security definer`, `set search_path = ''`, explicit active-role checks, revoked `PUBLIC`/`anon` execution, and a grant only to `authenticated`.
- Use TanStack Query for all browser reporting requests and invalidate the `reporting` key after successful recruitment, leave, deployment, promotion, and attendance mutations.
- Retain semantic tables/text values for every visual; do not rely on color alone. Make all controls keyboard accessible, use visible focus states, and preserve responsive table access.

---

## File structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/<timestamp>_dashboards_and_reports.sql` | `reporting` schema, private reporting views/functions, public fixed RPC wrappers, privileges, and query-specific indexes. |
| `supabase/tests/dashboards_and_reports.test.sql` | pgTAP object, role, denied-access, sensitive-field, and report-result coverage. |
| `src/schemas/reporting.ts` | Report key, shared filters, typed dashboard/report response schemas, and CSV export limits. |
| `src/schemas/reporting.test.ts` | Normalization and rejection tests for all reporting inputs and response contracts. |
| `src/lib/types/database.ts` | Reusable typed dashboard/report data structures. |
| `src/lib/query-keys.ts` | `reporting` cache-key family. |
| `src/lib/reporting/csv.ts` | Role-safe RFC 4180 CSV serialization and spreadsheet-formula escaping. |
| `src/lib/reporting/csv.test.ts` | CSV header, quote/newline, null, and formula-prefix tests. |
| `src/queries/reporting.ts` | Validated Supabase RPC calls and response parsing. |
| `src/queries/reporting.test.ts` | Filter-to-RPC argument and malformed response tests. |
| `src/hooks/use-reporting.ts` | Query hooks for the two dashboards and report detail. |
| `src/hooks/use-reporting.test.tsx` | Query-key and enabled-state/invalidation tests. |
| `src/components/reporting/dashboard.tsx` | Accessible KPI and labelled status-breakdown dashboard presentation. |
| `src/components/reporting/report-catalog.tsx` | Role-aware report catalogue. |
| `src/components/reporting/report-detail.tsx` | Filter form, semantic result table, CSV, and print controls. |
| `src/components/reporting/reporting.test.tsx` | Dashboard, catalogue, detail, export, and Management read-only tests. |
| `src/app/(app)/hr/page.tsx`, `src/app/(app)/management/page.tsx` | Render their appropriate live dashboard. |
| `src/app/(app)/hr/page.test.tsx`, `src/app/(app)/management/page.test.tsx` | Assert each landing page delegates to the correct reporting dashboard role. |
| `src/app/(app)/reports/layout.tsx`, `src/app/(app)/reports/page.tsx`, `src/app/(app)/reports/[reportKey]/page.tsx` | HR-or-Management route guard, catalogue, and report detail page. |
| `src/app/(app)/reports/reports.test.tsx` | Route guard, unknown-key, and route rendering tests. |
| `src/lib/auth/require-role.ts` and test | Add multi-role guard without weakening existing single-role behavior. |
| `src/lib/app/role-config.ts` and test | Add the Reports navigation item for HR and Management only. |
| Existing module hooks | Invalidate the reporting cache after data-changing operations. |

### Task 1: Secure database reporting contract

**Files:**
- Create: `supabase/migrations/<timestamp>_dashboards_and_reports.sql`
- Create: `supabase/tests/dashboards_and_reports.test.sql`
- Reference: `supabase/migrations/20260823205508_attendance_integration.sql`
- Reference: `supabase/tests/attendance_integration.test.sql`

**Interfaces:**
- Consumes: existing `employees`, `departments`, `positions`, `applications`, `job_openings`, `application_ai_scores`, `deployments`, `attendance_logs`, `leave_requests`, `performance_ratings`, `promotion_evaluations`, `promotion_criteria_requirements`, `qualifications`, `certifications`, and `training_records` tables.
- Produces: `public.get_hr_dashboard_summary(date, date) returns jsonb`, `public.get_management_dashboard_summary(date, date) returns jsonb`, `public.get_hr_report(text, date, date, bigint, text, integer, integer) returns jsonb`, and `public.get_management_report(text, date, date, bigint, text, integer, integer) returns jsonb`.
- Result contract: each dashboard returns `{ generatedAt, range, metrics, breakdowns }`; each report returns `{ reportKey, title, columns, rows, totalCount, page, pageSize }`, where every `columns[]` item is `{ key, label }` and `rows[]` uses only keys declared in `columns[]`.

- [ ] **Step 1: Write failing pgTAP expectations for objects, grants, and role-safe results**

```sql
select extensions.has_schema('reporting', 'Private reporting schema exists');
select extensions.has_function('public', 'get_hr_dashboard_summary', array['date', 'date'], 'HR dashboard RPC exists');
select extensions.has_function('public', 'get_management_report', array['text', 'date', 'date', 'bigint', 'text', 'integer', 'integer'], 'Management report RPC exists');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000801'; -- HR fixture
select extensions.ok((public.get_hr_dashboard_summary('2026-08-01', '2026-08-31') ? 'metrics'), 'HR receives dashboard metrics');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000804'; -- Management fixture
select extensions.ok(
  not (public.get_management_report('employee-performance', '2026-08-01', '2026-08-31', null, null, 1, 25)::text
       ~* 'personal_email|first_name|last_name|notes'),
  'Management result omits personnel identity and notes'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000802'; -- Employee fixture
select extensions.throws_ok(
  $$select public.get_management_dashboard_summary('2026-08-01', '2026-08-31')$$,
  '42501', null, 'Employee cannot call Management dashboard RPC'
);
```

- [ ] **Step 2: Run the new database test to verify the reporting objects do not exist yet**

Run: `npx supabase test db --test-file supabase/tests/dashboards_and_reports.test.sql`

Expected: FAIL with a missing `reporting` schema or missing reporting RPC assertion.

- [ ] **Step 3: Create the private schema, fixed read models, and narrow RPC wrappers**

```sql
create schema reporting;
revoke all on schema reporting from public, anon, authenticated;

create or replace function private.require_active_reporting_role(allowed_roles public.app_role[])
returns public.app_role
language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); caller_role public.app_role;
begin
  select role.role into caller_role
  from public.user_roles role join public.profiles profile on profile.id = role.user_id
  where role.user_id = caller_id and profile.is_active;
  if caller_role is null or not caller_role = any(allowed_roles) then
    raise exception 'Reporting access is required.' using errcode = '42501';
  end if;
  return caller_role;
end;
$$;

create or replace function public.get_management_dashboard_summary(target_starts_on date, target_ends_on date)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return private.get_management_dashboard_summary(target_starts_on, target_ends_on);
end;
$$;
```

Implement fixed reporting views/functions for the six approved keys. HR report rows may include authorized operational identifiers and names; Management versions must instead group by date, department, status, and category. Reject unknown keys, inverted/future-invalid ranges, non-positive page values, page sizes above `100`, and report responses above a fixed CSV maximum of `5,000` rows. Add only query-justified indexes after verifying the query predicates: date/status for applications and leave requests; department/status for current employees/deployments; date/status for attendance; and employee/evaluated date for promotion/performance joins.

- [ ] **Step 4: Lock down callable objects and add all test fixtures/cases**

```sql
revoke all on function private.require_active_reporting_role(public.app_role[]) from public, anon, authenticated;
revoke all on function public.get_hr_dashboard_summary(date, date), public.get_management_dashboard_summary(date, date),
  public.get_hr_report(text, date, date, bigint, text, integer, integer),
  public.get_management_report(text, date, date, bigint, text, integer, integer)
  from public, anon;
grant execute on function public.get_hr_dashboard_summary(date, date), public.get_management_dashboard_summary(date, date),
  public.get_hr_report(text, date, date, bigint, text, integer, integer),
  public.get_management_report(text, date, date, bigint, text, integer, integer)
  to authenticated;
```

Seed HR, Management, Employee, Applicant, Administrator, and anon contexts. Assert HR succeeds on every report key, Management succeeds only with de-identified/aggregate output, all other roles receive `42501`, no reporting object is in `public`, and every wrapper has the intended privilege. Include at least one row for each operational area and assert counts/status breakdowns use the requested date range.

- [ ] **Step 5: Run the reporting database test and inspect the migration**

Run: `npx supabase test db --test-file supabase/tests/dashboards_and_reports.test.sql`

Expected: PASS with every object, allowed role, denial, sensitive-field, and range assertion passing.

- [ ] **Step 6: Commit the database contract**

```bash
git add supabase/migrations/<timestamp>_dashboards_and_reports.sql supabase/tests/dashboards_and_reports.test.sql
git commit -m "feat: add secure reporting database contract"
```

### Task 2: Define typed reporting inputs, results, and CSV serialization

**Files:**
- Create: `src/schemas/reporting.ts`
- Create: `src/schemas/reporting.test.ts`
- Create: `src/lib/reporting/csv.ts`
- Create: `src/lib/reporting/csv.test.ts`
- Modify: `src/lib/types/database.ts`

**Interfaces:**
- Consumes: JSONB response from the four Task 1 RPCs.
- Produces: `REPORT_KEYS`, `reportKeySchema`, `reportFiltersSchema`, `reportingFilters(input)`, `dashboardSummarySchema`, `reportResponseSchema`, `type ReportFilters`, `type DashboardSummary`, `type ReportResponse`, and `toReportCsv(report: ReportResponse): string`.

- [ ] **Step 1: Write failing schema and CSV tests**

```ts
expect(reportFiltersSchema.parse({ reportKey: "attendance-leave", startsOn: "2026-08-01", endsOn: "2026-08-31", page: "2", pageSize: "25" }))
  .toMatchObject({ reportKey: "attendance-leave", page: 2, pageSize: 25 });
expect(reportFiltersSchema.safeParse({ reportKey: "other", startsOn: "2026-08-31", endsOn: "2026-08-01" }).success).toBe(false);

expect(toReportCsv({ reportKey: "deployments", title: "Deployments", generatedAt: "2026-08-24T00:00:00.000Z", columns: [{ key: "status", label: "Status" }], rows: [{ status: '=HYPERLINK("https://bad.test")' }], totalCount: 1, page: 1, pageSize: 25 }))
  .toBe('Status\\r\\n\'=HYPERLINK(""https://bad.test"")\\r\\n');
```

- [ ] **Step 2: Run the focused tests to verify they fail before the reporting contracts exist**

Run: `npm run test:run -- src/schemas/reporting.test.ts src/lib/reporting/csv.test.ts`

Expected: FAIL with unresolved reporting imports.

- [ ] **Step 3: Implement the Zod contracts and safe CSV utility**

```ts
export const REPORT_KEYS = [
  "applicant-tracking", "hiring-decisions", "employee-performance",
  "deployments", "attendance-leave", "promotion-training-needs",
] as const;

export const reportKeySchema = z.enum(REPORT_KEYS);
export const reportFiltersSchema = z.object({
  reportKey: reportKeySchema, startsOn: isoDateSchema.optional(), endsOn: isoDateSchema.optional(),
  departmentId: z.coerce.number().int().positive().optional(), status: z.string().trim().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).superRefine((value, context) => {
  if (value.startsOn && value.endsOn && value.startsOn > value.endsOn) context.addIssue({ code: "custom", path: ["endsOn"], message: "End date must not precede start date." });
});

export function escapeCsvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  const formulaSafe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(formulaSafe) ? `"${formulaSafe.replaceAll('"', '""')}"` : formulaSafe;
}

export function reportingFilters(input: unknown) { return reportFiltersSchema.parse(input); }
```

Use a transform/default to create the 30-day range at parse time. Require `rows` to contain no keys outside declared columns. Keep `ReportResponse` serializable and string/number/boolean/null-only so CSV never receives nested personal data.

- [ ] **Step 4: Run focused tests and type checking**

Run: `npm run test:run -- src/schemas/reporting.test.ts src/lib/reporting/csv.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the contracts and export utility**

```bash
git add src/schemas/reporting.ts src/schemas/reporting.test.ts src/lib/reporting/csv.ts src/lib/reporting/csv.test.ts src/lib/types/database.ts
git commit -m "feat: add reporting schemas and csv export"
```

### Task 3: Add reporting query keys, RPC adapters, and hooks

**Files:**
- Create: `src/queries/reporting.ts`
- Create: `src/queries/reporting.test.ts`
- Create: `src/hooks/use-reporting.ts`
- Create: `src/hooks/use-reporting.test.tsx`
- Modify: `src/lib/query-keys.ts`
- Modify: `src/queries/index.ts`
- Modify: `src/hooks/index.ts`

**Interfaces:**
- Consumes: Task 1 RPCs and Task 2 schemas.
- Produces: `getHrDashboard(filters)`, `getManagementDashboard(filters)`, `getHrReport(filters)`, `getManagementReport(filters)`, `useHrDashboard(filters)`, `useManagementDashboard(filters)`, and `useReport(filters, role)`.

- [ ] **Step 1: Write failing adapter and hook tests**

```ts
expect(reportingFilters({ reportKey: "deployments", startsOn: "2026-08-01", endsOn: "2026-08-31" })).toMatchObject({ page: 1, pageSize: 25 });
expect(mockRpc).toHaveBeenCalledWith("get_hr_report", expect.objectContaining({ target_report_key: "deployments", target_page: 1 }));

renderHook(() => useReport({ reportKey: "deployments" }, "management"), { wrapper: queryWrapper });
expect(mockRpc).toHaveBeenCalledWith("get_management_report", expect.any(Object));
```

- [ ] **Step 2: Run focused tests to verify the query module is absent**

Run: `npm run test:run -- src/queries/reporting.test.ts src/hooks/use-reporting.test.tsx`

Expected: FAIL with unresolved reporting query/hook imports.

- [ ] **Step 3: Implement the validated RPC adapters and stable hooks**

```ts
export async function getHrReport(input: unknown) {
  const filters = reportingFilters(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("get_hr_report", toRpcArgs(filters));
  if (error) throw new Error(error.message);
  return reportResponseSchema.parse(data);
}

export function useReport(input: Partial<ReportFilters>, role: "hr_personnel" | "management") {
  const filters = reportingFilters(input);
  return useQuery({
    queryKey: queryKeys.reporting.report(role, filters),
    queryFn: () => role === "hr_personnel" ? getHrReport(filters) : getManagementReport(filters),
    staleTime: 60_000,
  });
}
```

Add `queryKeys.reporting.dashboard(role, filters)` and `queryKeys.reporting.report(role, filters)`. Use the existing `throwIfError` behavior consistently and parse every successful RPC payload before components receive it.

- [ ] **Step 4: Run focused adapter/hook tests**

Run: `npm run test:run -- src/queries/reporting.test.ts src/hooks/use-reporting.test.tsx`

Expected: PASS; each role calls only its matching fixed RPC and bad JSON is rejected.

- [ ] **Step 5: Commit the browser reporting data layer**

```bash
git add src/lib/query-keys.ts src/queries/reporting.ts src/queries/reporting.test.ts src/queries/index.ts src/hooks/use-reporting.ts src/hooks/use-reporting.test.tsx src/hooks/index.ts
git commit -m "feat: add reporting query hooks"
```

### Task 4: Guard report routes and expose reports in eligible navigation

**Files:**
- Modify: `src/lib/auth/require-role.ts`
- Modify: `src/lib/auth/require-role.test.ts`
- Modify: `src/lib/app/role-config.ts`
- Modify: `src/lib/app/role-config.test.ts`
- Create: `src/app/(app)/reports/layout.tsx`
- Create: `src/app/(app)/reports/page.tsx`
- Create: `src/app/(app)/reports/[reportKey]/page.tsx`
- Create: `src/app/(app)/reports/reports.test.tsx`

**Interfaces:**
- Consumes: `requireAnyRole(["hr_personnel", "management"])` and `REPORT_KEYS` from Task 2.
- Produces: a protected `/reports` route and HR/Management-only navigation item linking to it.

- [ ] **Step 1: Write failing role-guard and route tests**

```ts
await expect(requireAnyRole(["hr_personnel", "management"])).resolves.toMatchObject({ role: "management" });
await expect(requireAnyRole(["hr_personnel", "management"])).rejects.toThrow("NEXT_REDIRECT:/unauthorized");
await ReportsLayout({ children: <p>Reports</p> });
expect(requireAnyRole).toHaveBeenCalledWith(["hr_personnel", "management"]);
```

- [ ] **Step 2: Run the focused route tests to verify the shared Reports route does not yet exist**

Run: `npm run test:run -- src/lib/auth/require-role.test.ts src/app/\(app\)/reports/reports.test.tsx src/lib/app/role-config.test.ts`

Expected: FAIL with unresolved reports route or multi-role guard imports.

- [ ] **Step 3: Add the narrow multi-role guard, navigation, and server routes**

```ts
export async function requireAnyRole(expectedRoles: readonly AppRole[]): Promise<AuthenticatedRole> {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const role = await getCurrentRole();
  if (!role || !expectedRoles.includes(role)) redirect("/unauthorized");
  return { user, role };
}
```

Use `requireAnyRole(["hr_personnel", "management"])` in the Reports layout. Validate `params.reportKey` with `reportKeySchema.safeParse`; call `notFound()` for an unknown key. Add `{ href: "/reports", label: "Reports", icon: "ScrollText" }` only to HR and Management navigation; leave every other role unchanged.

- [ ] **Step 4: Run focused route/role tests**

Run: `npm run test:run -- src/lib/auth/require-role.test.ts src/app/\(app\)/reports/reports.test.tsx src/lib/app/role-config.test.ts`

Expected: PASS; HR and Management are allowed, all other roles redirect, and only the eligible configs show Reports.

- [ ] **Step 5: Commit routing and navigation**

```bash
git add src/lib/auth/require-role.ts src/lib/auth/require-role.test.ts src/lib/app/role-config.ts src/lib/app/role-config.test.ts src/app/\(app\)/reports
git commit -m "feat: add protected reports routes"
```

### Task 5: Build the accessible HR and Management dashboards

**Files:**
- Create: `src/components/reporting/dashboard.tsx`
- Modify: `src/components/reporting/reporting.test.tsx`
- Modify: `src/app/(app)/hr/page.tsx`
- Modify: `src/app/(app)/management/page.tsx`
- Create: `src/app/(app)/hr/page.test.tsx`
- Create: `src/app/(app)/management/page.test.tsx`

**Interfaces:**
- Consumes: `useHrDashboard`, `useManagementDashboard`, and `DashboardSummary` from Tasks 2–3.
- Produces: `ReportingDashboard({ role }: { role: "hr_personnel" | "management" })` with real metric links and no mutation UI.

- [ ] **Step 1: Write failing dashboard presentation tests**

```tsx
render(<ReportingDashboard role="management" />);
expect(await screen.findByRole("heading", { name: "Workforce analytics" })).toBeVisible();
expect(screen.getByText("Active workforce")).toBeVisible();
expect(screen.queryByRole("button", { name: /new|approve|import|edit/i })).not.toBeInTheDocument();
expect(screen.getByRole("table", { name: /recruitment pipeline/i })).toBeVisible();
```

- [ ] **Step 2: Run the dashboard tests to verify the landing pages still use the placeholder component**

Run: `npm run test:run -- src/components/reporting/reporting.test.tsx src/app/\(app\)/role-layouts.test.tsx`

Expected: FAIL with missing reporting dashboard export or expected dashboard content absent.

- [ ] **Step 3: Implement real dashboard presentation and replace both landing pages**

```tsx
if (query.isLoading) return <LoadingState label="Loading workforce analytics…" />;
if (query.error) return <ErrorState message={query.error.message} />;
return <section aria-labelledby="page-title" className="space-y-6">
  <h1 id="page-title">{role === "management" ? "Workforce analytics" : "HR operations dashboard"}</h1>
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(renderMetricCard)}</div>
  <section aria-labelledby="breakdown-title"><h2 id="breakdown-title">Operational breakdown</h2><table aria-label="Operational breakdown">…</table></section>
</section>;
```

Use links only to permitted routes/report URLs. Render each status bar with a visible label, count, and percentage; retain a semantic table for screen readers. Implement the empty state when all metrics/breakdowns are zero and keep `LoadingState`/`ErrorState` inside the dashboard region.

- [ ] **Step 4: Run presentation and page tests**

Run: `npm run test:run -- src/components/reporting/reporting.test.tsx src/app/\(app\)/hr/page.test.tsx src/app/\(app\)/management/page.test.tsx`

Expected: PASS; both pages show live dashboard UI and Management has no mutation control.

- [ ] **Step 5: Commit the dashboards**

```bash
git add src/components/reporting/dashboard.tsx src/components/reporting/reporting.test.tsx src/app/\(app\)/hr/page.tsx src/app/\(app\)/management/page.tsx
git commit -m "feat: add role-specific dashboards"
```

### Task 6: Build the report catalogue, filtered detail view, CSV, and print experience

**Files:**
- Create: `src/components/reporting/report-catalog.tsx`
- Create: `src/components/reporting/report-detail.tsx`
- Modify: `src/components/reporting/reporting.test.tsx`
- Modify: `src/app/(app)/reports/page.tsx`
- Modify: `src/app/(app)/reports/[reportKey]/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `REPORT_KEYS`, `useReport`, `toReportCsv`, and route role from Tasks 2–4.
- Produces: `ReportCatalog({ role })` and `ReportDetail({ role, reportKey })` with fully client-side export and print.

- [ ] **Step 1: Write failing report catalogue/detail tests**

```tsx
render(<ReportDetail role="management" reportKey="attendance-leave" />);
await user.type(screen.getByLabelText("Start date"), "2026-08-01");
await user.click(screen.getByRole("button", { name: "Apply filters" }));
expect(mockUseReport).toHaveBeenLastCalledWith(expect.objectContaining({ reportKey: "attendance-leave", startsOn: "2026-08-01" }), "management");
expect(screen.getByRole("button", { name: "Download CSV" })).toBeEnabled();
expect(screen.getByRole("button", { name: "Print report" })).toBeVisible();
expect(screen.queryByText("Alice Applicant")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run report UI tests to verify catalogue/detail components are absent**

Run: `npm run test:run -- src/components/reporting/reporting.test.tsx src/app/\(app\)/reports/reports.test.tsx`

Expected: FAIL with unresolved catalogue/detail imports.

- [ ] **Step 3: Implement the role-aware catalogue and detail interface**

```tsx
function downloadCsv(report: ReportResponse) {
  const blob = new Blob([toReportCsv(report)], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href; anchor.download = `${report.reportKey}-${report.generatedAt.slice(0, 10)}.csv`; anchor.click();
  URL.revokeObjectURL(href);
}

<button type="button" onClick={() => window.print()}>Print report</button>
```

Build inputs with visible labels, inline schema errors, and the applied-filter summary. Render report table headings from `report.columns`, values only from matching row keys, and `overflow-x-auto` around a table with a role/accessible name. Disable CSV until a successful result exists. Put error and empty states in the table region. Add `@media print` CSS to remove application chrome/controls and retain title, applied-filter summary, generation time, table headings, and table content.

- [ ] **Step 4: Run report UI tests**

Run: `npm run test:run -- src/components/reporting/reporting.test.tsx src/app/\(app\)/reports/reports.test.tsx`

Expected: PASS; filtering reloads the fixed report, CSV uses rendered columns, printing invokes the browser, and Management cannot render restricted row values.

- [ ] **Step 5: Commit reports UI**

```bash
git add src/components/reporting/report-catalog.tsx src/components/reporting/report-detail.tsx src/components/reporting/reporting.test.tsx src/app/\(app\)/reports src/app/globals.css
git commit -m "feat: add filterable browser reports"
```

### Task 7: Refresh reporting caches after operational changes

**Files:**
- Modify: `src/hooks/use-recruitment.ts`
- Modify: `src/hooks/use-leave-management.ts`
- Modify: `src/hooks/use-deployment-tracking.ts`
- Modify: `src/hooks/use-promotion-eligibility.ts`
- Modify: `src/hooks/use-attendance-integration.ts`
- Modify: corresponding existing hook tests or create `src/hooks/reporting-invalidation.test.tsx`

**Interfaces:**
- Consumes: `queryKeys.reporting` from Task 3.
- Produces: all successful operational reporting-affecting mutations call `queryClient.invalidateQueries({ queryKey: ["reporting"] })` once in addition to their established invalidations.

- [ ] **Step 1: Write failing invalidation tests for each module**

```ts
await act(async () => { result.current.mutate(validDeployment); });
expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["deployment-tracking"] });
expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reporting"] });
```

Cover job save/application status/hire/AI scoring; leave submit/cancel/decision; deployment create/update; promotion criteria/rating/evaluation writes; and attendance import/mapping resolution. Do not invalidate reporting for presentation-only settings changes.

- [ ] **Step 2: Run the selected hook tests to verify reporting invalidation is missing**

Run: `npm run test:run -- src/hooks/reporting-invalidation.test.tsx`

Expected: FAIL on missing `["reporting"]` invalidation assertions.

- [ ] **Step 3: Extend successful mutation invalidation only where the report data changes**

```ts
function useInvalidateReporting() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["reporting"] });
}
```

Use the helper inside each affected success callback without removing existing module-specific invalidations. Keep `useSaveAttendanceSettings` unchanged because changing adapter configuration does not change report rows or current metrics.

- [ ] **Step 4: Run reporting-invalidation and affected hook tests**

Run: `npm run test:run -- src/hooks/reporting-invalidation.test.tsx`

Expected: PASS; every scoped operational mutation invalidates reporting and all existing invalidations still occur.

- [ ] **Step 5: Commit cache freshness changes**

```bash
git add src/hooks/use-recruitment.ts src/hooks/use-leave-management.ts src/hooks/use-deployment-tracking.ts src/hooks/use-promotion-eligibility.ts src/hooks/use-attendance-integration.ts src/hooks/reporting-invalidation.test.tsx
git commit -m "fix: refresh reports after hr data changes"
```

### Task 8: Run branch-wide verification and record the evidence

**Files:**
- Modify only if verification reveals a defect: files owned by Tasks 1–7.

**Interfaces:**
- Consumes: completed migration, database test, UI/data layer, route guards, cache invalidation, and package scripts.
- Produces: verified branch that satisfies `feat/15-dashboards-and-reports` acceptance criteria.

- [ ] **Step 1: Apply the migration to a clean local database and run the focused pgTAP suite**

Run: `npx supabase db reset && npx supabase test db --test-file supabase/tests/dashboards_and_reports.test.sql`

Expected: PASS; the migration applies cleanly and allowed/denied reporting calls behave as specified.

- [ ] **Step 2: Run the focused JavaScript tests**

Run: `npm run test:run -- src/schemas/reporting.test.ts src/lib/reporting/csv.test.ts src/queries/reporting.test.ts src/hooks/use-reporting.test.tsx src/hooks/reporting-invalidation.test.tsx src/components/reporting/reporting.test.tsx src/app/\(app\)/reports/reports.test.tsx`

Expected: PASS.

- [ ] **Step 3: Run the repository quality gates**

Run: `npm run lint && npm run typecheck && npm run test:run && npm run build`

Expected: all commands exit `0`.

- [ ] **Step 4: Perform the required manual role and browser checks**

Use the local app with HR and Management fixtures. Confirm HR sees real operational report detail, Management sees no mutation controls or restricted fields, Employee/Applicant/Administrator receive `/unauthorized` at `/reports`, the CSV file contains only displayed role-safe columns, and print preview excludes app shell/navigation while retaining title/filters/table.

- [ ] **Step 5: Commit any verification-only corrections and inspect the final branch state**

```bash
git status --short
git log --oneline main..HEAD
git diff --check main...HEAD
```

Expected: no uncommitted work and no whitespace errors. If a correction was necessary, commit it with a focused conventional message before this inspection.
