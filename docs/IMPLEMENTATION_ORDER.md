# HRIS Capstone — Chronological Implementation Order

Use this document as the implementation sequence for `PROJECT_SCOPE.md`.

Create **one branch at a time** from the latest `main`, finish it, test it, open a PR, merge it, and only then create the next branch. This is important because the application has one shared Supabase database and Row Level Security (RLS) rules. Do not start all feature branches from the initial scaffold.

> **For agentic workers:** Read [AGENT_EXECUTION_PLAYBOOK.md](AGENT_EXECUTION_PLAYBOOK.md) before starting a task. That file defines the shared branch, test, commit, and pull-request routine. Do not repeat or reinterpret that routine here.

## Locked architecture and product decisions

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui.
- **Data/auth/storage:** Supabase PostgreSQL, Auth, Storage, RLS, Data API, and Edge Functions. Do not add Prisma; the browser uses the Supabase client protected by RLS.
- **Client data:** TanStack Query for browser-side queries, mutation invalidation, pagination, loading, and error states. Use the Supabase client as the query function.
- **Validation:** Zod schemas are the source of truth for every form, URL/query input, server request, and Edge Function payload.
- **AI:** Gemini through an Edge Function and server-only secret. The free tier may use submitted content for product improvement, so the capstone sends only dummy, anonymized, or explicitly consented CV data.
- **Notifications:** In-app only. No email delivery is in scope.
- **Accounts:** Applicants self-register. System Administrators invite/create internal accounts. HR marks an application `Hired`; an administrator performs the separate employee-account activation.
- **Leave:** Requests, decisions, attachments, and history only. Leave-balance/entitlement calculation is not in scope.
- **Attendance:** Use a vendor-neutral integration boundary. Prefer a documented cloud/API integration; secure CSV/XLSX import is the required fallback. The HRIS stores attendance logs only—never fingerprint templates, images, or raw biometric data. A USB fingerprint kiosk is deferred and requires a separate approved task after its SDK is proven.

## Branch dependency map

| Order | Branch | Must be merged before it starts |
| --- | --- | --- |
| 0 | `chore/00-project-baseline` | Current scaffold |
| 1 | `feat/01-supabase-auth-rbac-foundation` | 00 |
| 2 | `feat/02-authentication-pages` | 01 |
| 3 | `feat/03-role-based-app-shell` | 02 |
| 4 | `feat/04-administration-master-data` | 03 |
| 5 | `feat/05-personnel-records` | 04 |
| 6 | `feat/06-administration-ui-completion` | 05 |
| 7 | `feat/07-notifications` | 06 |
| 8 | `feat/08-profile-change-approval` | 07 |
| 9 | `feat/09-recruitment-and-applicant-portal` | 08 |
| 10 | `feat/10-ai-applicant-shortlisting` | 09 |
| 11 | `feat/11-leave-management` | 10 |
| 12 | `feat/12-deployment-tracking` | 11 |
| 13 | `feat/13-promotion-eligibility` | 12 |
| 14 | `feat/14-attendance-integration` | 13 |
| 15 | `feat/15-dashboards-and-reports` | 14 |
| 16 | `chore/16-quality-release-and-turnover` | 15 |

## Branch convention

- Use the branch names below (for example, `feat/03-role-based-app-shell`).
- Merge every branch into `main` before beginning the next branch.
- Every database change is a new Supabase migration committed with the branch that needs it.
- Every new exposed database table must have RLS enabled, least-privilege policies, and policy tests.
- Never put `service_role`, AI-provider, or biometric-vendor secrets in `NEXT_PUBLIC_*` variables or browser code.

## Global done checklist for every branch

- [ ] Rebase or branch from the latest merged `main`.
- [ ] For every feature that manages records, explicitly state the allowed create, read, update, deactivate/delete, approval, and export actions; a static route, navigation item, or empty-state card does not satisfy a CRUD requirement.
- [ ] Add/update unit, integration, or end-to-end tests for the branch's main journey.
- [ ] Run lint, typecheck, build, and relevant tests.
- [ ] Test the intended role can access the feature and an unintended role cannot.
- [ ] Commit only work belonging to that branch and merge the PR before the next branch.

---

## 0. `chore/00-project-baseline`

**Purpose:** Make the empty Next.js project ready for safe development.

**Create/configure**

- Supabase client/server helpers and a documented `.env.example` containing only public URL/key placeholders.
- Test tooling, lint/typecheck/build scripts, and a CI workflow that runs them.
- Shared UI setup: Tailwind, shadcn/ui conventions, base form/table/error/loading components.
- Install and configure `@tanstack/react-query`, `zod`, and the chosen test libraries; commit the lockfile.
- Define the shared application folders for Zod schemas, Supabase query functions, TanStack Query hooks, UI components, and tests.
- Deployment documentation for Vercel; configure production environment variables in Vercel manually, not in Git.

**Pages:** Replace the default starter page with a small public landing page at `/` linking to sign in and job openings (the openings page is built later).

**Done when:** A clean clone can install dependencies, start locally, pass CI checks, and deploy a harmless placeholder site.

## 1. `feat/01-supabase-auth-rbac-foundation`

**Purpose:** Establish identity, authorization, and the shared database rules every later branch uses.

**Database**

- Create `profiles`, `user_roles`, `departments`, `positions`, and `audit_logs` migrations.
- Define the five application roles: System Administrator, HR Personnel, Applicant, Employee/Personnel, and Management.
- Add indexes for foreign keys and common lookups.
- Enable RLS on every table and write policies for own-record access, HR access, administrator access, and management read-only access.
- Add storage bucket conventions and policies for private documents; do not add module-specific upload UI yet.

**App work**

- Configure Supabase Auth session handling and server-side role lookup.
- Add shared TypeScript types for roles and database records.
- Add test fixtures for one account per role.
- Add shared Zod primitives for UUIDs, dates, pagination, role values, and employee numbers.

**Pages:** None beyond the baseline page.

**Done when:** A browser client cannot read or mutate another role's protected rows, even if it bypasses the UI.

## 2. `feat/02-authentication-pages`

**Purpose:** Let users securely sign in and out.

**Create**

- Sign-in, sign-out, forgotten-password, and password-reset flows using Supabase Auth.
- Session refresh/error handling and an authenticated-user helper.
- Applicant self-registration. System Administrator invitation/creation for Employee, HR Personnel, Management, and Administrator accounts.

**Pages**

- `/login`
- `/forgot-password`
- `/reset-password`

**Done when:** Each test role can sign in, sign out, recover a password, and an unauthenticated visitor cannot reach a protected route.

## 3. `feat/03-role-based-app-shell`

**Purpose:** Give each user an appropriate, protected application shell.

**Create**

- Authenticated layout, role-aware navigation, breadcrumbs, loading/error states, and unauthorized handling.
- Route guards that enforce the five roles on the server as well as hiding inappropriate navigation links.
- Role landing pages that will later display real module summaries.
- Install the root TanStack Query provider and define query-key conventions; individual modules own their query functions and invalidation rules.

**Pages**

- `/admin`
- `/hr`
- `/employee`
- `/applicant`
- `/management`
- `/unauthorized`

**Done when:** Directly entering an out-of-role URL redirects or shows `/unauthorized`; Management has no mutation controls.

## 4. `feat/04-administration-master-data`

**Purpose:** Establish the secure administration database and server workflows that the later Admin interface uses.

**Database**

- Add migrations only if needed for user invitation/status, position details, system settings, and audit metadata.
- Add audited server-side workflows for role assignment and user activation/deactivation.

**Pages**

- `/admin/users`
- `/admin/roles`
- `/admin/departments`
- `/admin/positions`
- `/admin/settings`
- `/admin/audit-logs`

**Scope boundary:** This branch creates the protected data model, policies, and server-side invitation/role workflow. The actual usable Admin CRUD interface is completed in `feat/06-administration-ui-completion` after personnel records.

**Done when:** The administration data model and server-side workflows enforce administrator-only access, and every role or activation change is audited. The UI does not count as complete until the next Administration UI branch is finished.

## 5. `feat/05-personnel-records`

**Purpose:** Build the official employee record managed by HR.

**Database**

- Add `employees`, `service_history`, `qualifications`, `certifications`, `training_records`, and employee-record history tables.
- Add foreign keys, date/range validation, indexes for HR search/filtering, and RLS policies.

**Pages**

- `/hr/employees`
- `/hr/employees/new`
- `/hr/employees/[employeeId]`
- `/hr/employees/[employeeId]/service-history`
- `/hr/employees/[employeeId]/qualifications`

**Done when:** HR can create, search, filter, and maintain personnel records; employees can view but cannot edit official fields.

## 6. `feat/06-administration-ui-completion`

**Purpose:** Make the System Administrator area usable by connecting every existing Admin page to its protected Supabase workflows.

**Required CRUD and workflows**

- `/admin/users`: list, search, filter, invite, activate/deactivate, and manage internal accounts. The interface must use the existing protected invitation workflow; it must not expose Supabase secret keys in the browser.
- `/admin/roles`: list and change eligible user roles through the audited server-side role-assignment workflow.
- `/admin/departments`: list, create, edit, and deactivate departments. Do not hard-delete departments that are referenced by employee history.
- `/admin/positions`: list, create, edit, and deactivate positions, including department assignment. Do not hard-delete positions that are referenced by employee history.
- `/admin/settings`: view and update the allowed organization settings without displaying application secrets.
- `/admin/audit-logs`: show searchable, filterable, read-only audit entries; no UI action may modify or delete audit records.

**Implementation requirements**

- Add Zod schemas, Supabase query functions, TanStack Query hooks, forms/dialogs, and loading, empty, validation, and error states for each workflow.
- Standardize the Administration UI's interactive forms on React Hook Form with the existing Zod schemas as the validation source of truth. Preserve explicit server-side `POST` handling for credential or other sensitive submissions so those flows remain safe when browser JavaScript is unavailable.
- Add Zustand only for shared client/UI state that must outlive a single component (for example, persisted table preferences or multi-step form drafts). TanStack Query remains the cache and source of truth for Supabase server data; configure its stale-time and invalidation rules instead of duplicating records in Zustand or refetching on every render.
- Connect each route to real data. A route containing only a static description or empty-state card is not complete.
- Validate authorization at the database/server layer as well as the UI; hiding a button is not authorization.
- Add UI and RLS/workflow tests for successful Administrator actions and denied non-Administrator actions.

**Done when:** A System Administrator can complete every listed create, read, update, and permitted deactivate action in the HRIS UI; changes persist in Supabase; role and account-status changes create audit entries; and every other role is denied both in the UI and at the data layer.

## 7. `feat/07-notifications`

**Purpose:** Build the reusable notification system before approval workflows need it.

**Database**

- Add `notifications` with recipient, type, title/body, link, read timestamp, and created timestamp.
- RLS: users can read/update only their own notifications; privileged server workflows create notifications.

**Pages**

- Notification bell and unread count in the authenticated layout.
- `/notifications`

**Done when:** A user can see and mark only their own notifications as read.

## 8. `feat/08-profile-change-approval`

**Purpose:** Implement the required employee profile-change request and administrator approval workflow.

**Database and backend**

- Add `profile_change_requests`, requested-field values, supporting-document metadata, decision reason, statuses, and approval history.
- Add a secure transactional Edge Function or database workflow that validates an administrator, updates the official employee record only on approval, writes an audit event, and sends a notification.
- Allow employee cancellation only while status is `Pending`.

**Pages**

- `/employee/profile`
- `/employee/profile/change-request`
- `/employee/profile/change-requests`
- `/admin/profile-change-requests`
- `/admin/profile-change-requests/[requestId]`

**Done when:** The complete journey works: employee submits, official profile remains unchanged, administrator approves/rejects, audit entry and notification are created.

## 9. `feat/09-recruitment-and-applicant-portal`

**Purpose:** Build recruitment from published opening through HR hiring decision.

**Database**

- Add `job_openings`, qualification criteria, `applicants`, `applications`, and applicant-document metadata.
- Create private Storage policies for CVs and credentials.
- Add strict application status transitions: `Submitted`, `Under Review`, `Shortlisted`, `Interview`, `Hired`, `Not Selected`.
- When HR records `Hired`, create a pending employee-activation request. Do not grant the Employee role in this branch; only an administrator activates the account in the approved activation workflow.

**Pages**

- `/jobs` and `/jobs/[jobId]` for published openings.
- `/applicant/register`, `/applicant/profile`, `/applicant/applications`, `/applicant/applications/[applicationId]`.
- `/hr/jobs`, `/hr/jobs/new`, `/hr/jobs/[jobId]`, `/hr/applications`, `/hr/applications/[applicationId]`.

**Done when:** An applicant can submit and track only their own application, HR can review it and record the final decision, and hiring can create/activate the linked employee record.

## 10. `feat/10-ai-applicant-shortlisting`

**Purpose:** Add HR-reviewed AI recommendations to recruitment without automating hiring.

**Backend**

- Add an Edge Function that sends only approved/anonymized CV text and job criteria to the configured AI provider.
- Store `application_ai_scores` with score, explanation, model/version, input timestamp, and status.
- Use Gemini behind a provider interface; validate requests with Zod, redact/log safely, handle provider failures, and keep API keys server-side.

**Pages**

- Extend `/hr/jobs/[jobId]` with criteria configuration.
- Extend `/hr/applications` with ranked shortlist and filters.
- Extend `/hr/applications/[applicationId]` with score explanation and a clear “HR makes final decision” notice.

**Done when:** AI can recommend/rank applicants, but it cannot automatically change an application to Hired or Not Selected.

## 11. `feat/11-leave-management`

**Purpose:** Deliver employee leave requests and HR decisions.

**Database**

- Add `leave_requests`, leave types, optional attachment metadata, decision reason, and status history.
- Add RLS so employees access their own requests and HR handles operational review.
- Do not add leave allocations, accruals, balances, payroll deductions, or multi-level manager approvals.

**Pages**

- `/employee/leave`
- `/employee/leave/new`
- `/hr/leave-requests`
- `/hr/leave-requests/[requestId]`

**Done when:** Employees submit and view their history; HR approves/rejects with a reason; the employee is notified.

## 12. `feat/12-deployment-tracking`

**Purpose:** Track personnel deployments and retain their history.

**Database**

- Add `deployments` with employee, location/unit/project, assignment role, start/end dates, status, and notes.
- Add indexes for active deployment and date-range reporting.

**Pages**

- `/hr/deployments`
- `/hr/deployments/new`
- `/hr/deployments/[deploymentId]`
- `/employee/deployments`

**Done when:** HR can create/update assignments without erasing history; employees see their own assignments.

## 13. `feat/13-promotion-eligibility`

**Purpose:** Show promotion readiness for HR review, never automatic promotion.

**Database**

- Add promotion criteria, performance ratings, promotion evaluations, required-record links, and recommendation notes.
- Derive/display years of service and missing qualifications/certifications/training from existing personnel data.

**Pages**

- `/hr/promotions`
- `/hr/promotions/criteria`
- `/hr/promotions/[employeeId]`
- `/employee/promotion-eligibility`

**Done when:** HR can define criteria and review evidence/missing requirements; the system never changes an employee’s rank automatically.

## 14. `feat/14-attendance-integration`

**Purpose:** Synchronize attendance logs from a supported biometric vendor without storing biometric templates.

**Database and backend**

- Add `attendance_logs` with employee, source-event ID, time-in, time-out, calculated status, and sync metadata.
- Add a vendor-adapter interface plus a secure webhook, scheduled API sync, or CSV/XLSX import Edge Function.
- Make sync idempotent using the provider event identifier; audit sync failures.
- Store no fingerprint, face template, or other raw biometric data.
- Implement an attendance-identity mapping workflow using a stable external employee ID. Unknown IDs must enter a review queue; do not match on a name alone.

**Pages**

- `/hr/attendance`
- `/hr/attendance/import`
- `/hr/attendance/unmatched`
- `/employee/attendance`
- `/admin/integrations/attendance`

**Done when:** Demo logs from a documented API or validated CSV/XLSX export import once, calculate late/absence status, and are visible only to the correct roles. A real device is selected only after the vendor supplies the integration documentation and a test credential/demo.

## 15. `feat/15-dashboards-and-reports`

**Purpose:** Turn operational data into role-appropriate analytics and reports.

**Backend**

- Create read-only reporting queries/views with `security_invoker` where views are used, or keep privileged reporting objects in a non-exposed schema.
- Add date filters, report/export generation, and indexes informed by real report queries.

**Pages**

- Extend `/hr` with recruitment, employee, deployment, attendance, leave, and promotion summaries.
- Extend `/management` with read-only workforce analytics and management reports.
- `/reports` plus report detail/export pages for applicant tracking, hiring decisions, employee/performance, deployments, attendance/leave, and promotion/training needs.

**Done when:** Dashboards use real data, management cannot mutate anything, and exports contain only records the requesting role is authorized to see.

## 16. `chore/16-quality-release-and-turnover`

**Purpose:** Make the finished capstone safe to demonstrate and ready to hand over.

**Create**

- End-to-end tests for every role journey.
- RLS regression tests for every sensitive table and Storage bucket.
- Seed scripts using dummy, consented, or anonymized demo data only.
- Accessibility checks, error states, empty states, and mobile/table usability pass.
- Deployment runbook, environment-variable checklist, biometric-provider readiness checklist, architecture diagram, and final user/admin documentation.

**Verification journeys**

1. Employee submits a profile change; administrator approves/rejects it; audit and notification exist.
2. Applicant applies; HR reviews AI recommendation and records the final hiring decision.
3. Employee submits leave; HR decides; employee receives the decision.
4. Attendance sync imports logs without raw biometric data.
5. Management sees reports but cannot alter operational records.

**Done when:** CI, lint, typecheck, build, automated tests, RLS tests, and a Vercel production deployment all pass.

---

## What to do next

Start with branch `chore/00-project-baseline`. Do not create a feature branch until the prior branch is merged into `main`. If you later want agents to help, give one agent the current numbered branch only, plus this file; have it open a PR and wait for review before the next agent starts.
