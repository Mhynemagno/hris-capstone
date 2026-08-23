# Quality release and turnover design

**Branch:** `chore/16-quality-release-and-turnover`  
**Goal:** Make the finished HRIS demonstrably safe and handover-ready by fixing verified release blockers, validating intended role journeys, and documenting a repeatable demonstration and deployment process.

## Scope decisions

- This branch uses the current Vitest, pgTAP, Supabase CLI, and manual browser verification workflows. Playwright is explicitly deferred; no new browser-automation dependency is added.
- The branch fixes defects found while certifying the release when they directly prevent an approved core workflow from working. It does not add new HRIS modules or redesign existing workflows.
- All demonstration records are fictitious, anonymized, or explicitly consented. No raw biometric data, real CV, private document, API secret, or `service_role` key appears in the repository or demo procedure.
- A Vercel production check remains a documented, manual deployment/smoke-test step. CI does not receive a Vercel token in this branch.

## Release blockers

### Dashboard RPC deployment mismatch

The browser calls `public.get_hr_dashboard_summary(target_starts_on date, target_ends_on date)`. The local migration and query contract match, but the connected Supabase project does not expose that function, so PostgREST reports a schema-cache lookup failure. Its remote migration history also differs from the repository history.

Before any remote write, the release process must inventory the connected project's migration history and database objects. It must then use an idempotent, reviewed migration or an explicitly documented migration-history repair to make the required reporting RPCs live. The result is accepted only after the live function signature, `authenticated` execution grant, actual HR dashboard request, and schema-cache visibility are verified. It must not blindly replay timestamped migrations that the remote project may already contain under different history entries.

### Employee account to personnel-record workflow

An administrator-created internal account with the `employee` role can exist before an official `employees` row exists. HR must be able to find those unlinked active Employee accounts, create the first official personnel record for a selected account, and bind it by `employees.profile_id`.

The personnel directory gains a distinct, HR-only list of unlinked Employee accounts. Selecting an account opens the existing new-record form with `profileId`, first name, last name, and email supplied from the account. HR still enters the official, HR-owned fields: employee number, employment status, start/end dates, department, position, and any missing legacy name value. After saving, the account disappears from the unlinked list and appears in the personnel directory. Existing employee records remain editable through the existing route.

The account lookup is a narrow public RPC backed by private, security-definer SQL because HR must not receive a general browser-readable `user_roles` table. It requires an active HR caller and returns only an active account whose role is exactly `employee` and whose profile is not already linked to an `employees` record. It returns profile ID, names from the account metadata when present, fallback display name, and email—never credentials or other Auth metadata. `PUBLIC` and `anon` execution are revoked, execution is granted only to `authenticated`, and pgTAP verifies HR allow, non-HR deny, role filtering, inactive filtering, and exclusion of linked accounts.

## Release certification

### Functional audit matrix

A versioned verification matrix maps each intended capability in `PROJECT_SCOPE.md` and branch 16's five mandatory journeys to: authorized role, prohibited role, route/API/RLS boundary, fixture prerequisites, manual procedure, automated evidence, and pass/fail status. It includes the two release blockers above and an explicit external-dependency column.

The matrix covers all five roles and at minimum verifies:

1. Employee profile-change request followed by administrator approval/rejection, audit event, and notification.
2. Applicant job application followed by HR AI-review visibility and a human final decision.
3. Employee leave submission followed by HR decision and employee notification.
4. HR attendance import that uses only normalized logs and rejects/queues unknown identities without storing biometric templates.
5. Management reporting visibility with no operational mutation route, RPC, or UI control.
6. Administrator invitation of an Employee account followed by HR account selection and creation of the linked personnel record.

The audit includes route guards, empty states, validation failures, mobile-width table behavior, visible labels/focus handling, and the exact recovery action when an external system is unavailable. A failed check becomes a separately numbered finding with reproduction, evidence, severity, owner, and proposed next action; it is not silently marked passed.

### Automated regression and demo setup

Existing unit and pgTAP tests are extended for the new employee-account workflow and live reporting contract. RLS/Storage regression coverage is inventoried against every sensitive table and both private document buckets, with permitted and denied cases recorded in the matrix. The local Supabase reset uses a committed seed script that creates only demo accounts/data and no production secrets.

The branch does not claim external Vercel or biometric-vendor success without access. The verification record distinguishes locally executed checks from environment-owned checks that the project owner must perform.

## Documentation and handover

The handover package contains:

- a deployment runbook that covers Supabase migration reconciliation, Edge Function deployment, Vercel environment variables, auth redirect URLs, rollback/verification, and the manual production smoke test;
- an environment-variable checklist that names owner, platform, environment, sensitivity, and whether a value may be public;
- a biometric-provider readiness checklist requiring vendor documentation, test credential/demo, stable external employee ID, idempotent event ID, and an explicit confirmation that raw biometrics are never sent or stored;
- a Mermaid architecture diagram showing browser, Next.js, Supabase Auth/Data API/RLS/Storage/Edge Functions, Gemini, attendance import boundary, and Vercel;
- concise user and administrator guides for the approved workflows, including employee-account-to-personnel-record handoff.

## Error handling and acceptance criteria

- The reporting UI presents a concise retryable error when its RPC is unavailable; the completed release verifies that the live RPC succeeds rather than treating the error state as resolution.
- The unlinked-account workflow presents loading, empty, and retryable error states. It never allows HR to bind an account that is inactive, non-Employee, or already linked; the database enforces the same rules as the UI.
- Lint, typecheck, unit tests, relevant pgTAP tests, production build, Supabase migration verification, manual role matrix, and production smoke-test checklist all have recorded results.
- Branch completion requires no unresolved blocker in the five mandatory journeys and no unacknowledged external dependency.

## Out of scope

- Playwright, Cypress, new CI browser infrastructure, automated Vercel deployments, or a new monitoring service.
- New HRIS business modules, payroll, leave-balance calculations, biometric kiosk support, or storage of biometric templates/images.
- Changing final-decision ownership: HR still makes hiring decisions, Administrators still approve profile changes and manage accounts, and Management remains read-only.
