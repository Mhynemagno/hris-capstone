# Capstone UI Employee Redesign

## 1. Goal

Redesign the employee-side HRIS experience as PR 3 of 4. The result must implement the employee mockups in `docs/design/capstone-ui/` and PDF pages 39-47 while preserving the existing employee capabilities, security boundaries, and data model where possible.

The redesign gives personnel a coherent self-service portal for their personnel record, leave, deployments, promotion readiness, attendance, and station notices. It also fixes the promotion-readiness flow: publishing an active HR criterion for a target rank automatically shows the criterion and live missing requirements to personnel whose current rank immediately precedes it.

## 2. Confirmed Decisions and Constraints

- Work starts from `main` on branch `codex/capstone-ui-employee`; it is not stacked on the merged HR PR.
- Employee routes reuse `StaffShell`; do not introduce another shell or a new role.
- The employee account menu includes **Profile** (`/employee/profile`) and **Logout**.
- Preserve `.capstone-ui`, Lucide icons, the police logo, `text-slate-500` captions on light surfaces, word-form dates, and slate-400 inactive sidebar labels on dark surfaces.
- Employee screens have the same **9px minimum font floor** as the HR redesign.
- Do not use stock photographs of real people. Existing real employee images are shown only if the live personnel record has one; otherwise use initials/avatar treatment.
- `/login?as=employee` remains the badge-number login, redesigned from `emplogin.html`, titled **Employee / HR**.
- `/login?as=admin` remains the separate email-and-Access-Level Admin & HR Login.
- HR and SysAd accounts may sign in with a badge number where their active personnel record resolves that badge; after authentication they still land in their normal role home.
- PDF page 44 removes the standalone employee scan page. Scanning stays available from the Attendance screen.
- The untracked `playwright.local.config.ts` remains local and unchanged: no webServer, one worker, localhost base URL.
- No migration is pushed to live Supabase. The final PR includes explicit manual production-migration steps.

## 3. Shell, Navigation, and Login

### 3.1 Employee `StaffShell`

`ProtectedLayout` renders `StaffShell` for the employee role as it does for HR. The shell takes the employee `ROLE_CONFIG`, current display name, and email. It uses the existing navy sidebar, police logo, white top bar, responsive off-canvas navigation, notification drawer, skip link, focus-on-route-change behavior, and staff toaster.

Employee page titles are treated as redesigned StaffShell routes so their content receives the Capstone canvas and spacing. The header subtitle identifies the Personnel Self-Service Dashboard and the current employee area.

The employee navigation is ordered as follows:

1. Dashboard
2. My Profile 201
3. My Leaves
4. My Deployments
5. Promotion Status
6. My Attendance

The old **Scan** sidebar item is removed. The account dropdown passes `profileHref="/employee/profile"` and therefore includes Profile before Logout.

### 3.2 Badge Login

The employee login receives the `emplogin.html` Capstone form treatment: station logo and employee-portal identity, a small Employee Portal chip, heading **Employee / HR**, badge-number and password fields, password visibility control, password recovery, and existing safe redirect behavior. It does not become an email/Access-Level form.

The server keeps `/login?as=admin` unchanged for explicit HR/SysAd email login. For the badge path, `resolve_login_identifier` accepts the active badge for employee, HR Personnel, or System Administrator staff accounts. The authentication route continues to derive the eventual landing route from the signed-in role; a badge does not confer a role. Invalid, disabled, or unmatched accounts retain the current generic and disabled-account errors.

## 4. Employee Screens

### 4.1 Dashboard (`/employee`, `empdash.html`, PDF page 39)

The dashboard is a live personnel overview, not a static mockup:

- A navy profile banner shows the employee’s initials/photo, name, rank, active status, unit/section, badge number, years of service, and promotion readiness. **Show Biometric Pass** is shown only when supported by existing attendance data; it must not invent biometric credentials.
- **Current Field Assignment** shows the current ongoing or scheduled deployment, its location, date range in words, operation type, tactical unit, commanding officer, and status; an empty state explains when none is assigned.
- **Leave Entitlements** renders a concise subset of live balances with the existing leave-type colors and a link to file leave.
- **Today’s Attendance** shows the day’s time-in/time-out and source when a record exists, otherwise a clear not-yet-recorded state with a scan link.
- **Promotion Board Status** is derived from the automatic rank-matched readiness result and links to Promotion Status.
- **Station Announcements** shows published employee-safe announcements, with category styling and an empty state when none are available.

### 4.2 Profile (`/employee/profile`, `empprof.html`, PDF page 40)

The profile summary becomes a Capstone personnel card with name, rank, status, badge, years of service, unit/section, birth date and gender when present. It keeps Request Profile Change, Request History, and Change Password. Existing qualification, certification, and training data renders in separated cards with document View and permitted Update actions. The screens reuse real uploaded proof links; no stock portrait is introduced.

### 4.3 Leave (`/employee/leave`, `empleave.html`, PDF pages 41-42)

The leave portal adds a heading with the current calendar year and a **Request New Leave** action. Live leave balances are card-based, showing entitlement, used/remaining days, policy notes, and a progress bar only when there is a finite annual allotment.

The history becomes a responsive table/card view with tabs for All Requests, For Approval, and Approved, word-form inclusive dates, duration, reason/HR feedback, mapped status pills, pagination, and the current cancellation rules. Requesting leave opens the mockup-style modal rather than replacing the existing form behavior. It retains leave-type eligibility, range validation, document requirements, yearly excess handling, and user-visible submission errors/success.

### 4.4 Deployments (`/employee/deployments`, `empdeploy.html`, PDF page 43)

My Deployments receives a module label, title, status filter, and deployment cards. Each card maps ongoing/scheduled/completed state to its appropriate accent, renders its title/location/date range in words, notes, and the existing Report / Proof of Attendance action. Pagination remains available. There is a direct empty state and no ability for an employee to create or alter deployments.

### 4.5 Attendance (`/employee/attendance`, `empfacere.html`, PDF page 47)

Attendance starts with Personnel Monitoring, title, explanatory copy, and today’s date in words. The primary biometric panel links to the existing face-scanner logic from **Scan Attendance Now**. It displays only the existing capture/verification experience and its real status; camera lifecycle and enrollment requirements remain unchanged.

The inline Attendance Logs list uses the current employee-only data, mapped status pills, 24-hour local times, and pagination. `/employee/attendance/scan` is removed/redirected to `/employee/attendance`; direct scanning remains an interaction from that page. The scan route is removed from the nav and affected E2E route lists.

### 4.6 Promotion (`/employee/promotion-eligibility`, `empromote.html`, PDF pages 45-46)

Promotion Status is a live advisory view, never an automatic promotion decision. It displays the target rank, time in grade/service, status, a progress/compliance indicator, criterion cards, and a separate missing-requirements panel. Completed and unmet rows use accessible text and icon/color states; screen-reader labels never depend on color alone.

The active target rank is calculated from rank order: a criterion for a target rank applies only when that target is the immediate next active rank after the employee’s current rank. For example, a PCpl criterion applies to a PAT employee, not to unrelated personnel. When HR publishes, edits, activates, or deactivates criteria, normal query invalidation makes the employee view refresh with current data.

When the employee is ready, **Submit to Promotion Board** opens the docket modal. It identifies the target rank, uses the current authorized unit commander information where available, requires employee-provided remarks, and submits a new docket. It cannot bypass criterion checks, self-promote, or change an HR endorsement. On success it shows confirmation and creates a notification for the existing HR promotion workflow. An already submitted docket is shown as submitted instead of allowing duplicate submission. This PR does not add a new HR docket-approval workflow; HR continues to record its official decision in the existing promotion evaluation flow.

## 5. Promotion Data and Authorization

### 5.1 Rank-matched readiness

Add an imperative local migration that replaces `get_my_promotion_readiness()` with an employee-safe, `security definer` function using a fixed safe search path and an explicit authenticated employee check. It:

1. Resolves the caller’s employee record and current active rank.
2. Finds active promotion criteria whose target rank has the immediate next `sort_order` after the current rank. It never selects a distant target rank.
3. Computes existing time-in-grade/service, mandatory record requirements, optional performance rating requirements, completed/missing requirements, and readiness from current records.
4. Returns `null` when the caller lacks an employee record, rank, next rank, or active criterion, rather than leaking another employee’s data.

Existing HR read-model RPCs and historical promotion evaluations remain intact. The employee RPC becomes the one source of truth for the dashboard and employee promotion page.

### 5.2 Promotion dockets

The migration adds `public.employee_promotion_dockets` with employee ID, criterion ID, target rank ID, required remarks, submitted timestamp, status, and audit timestamps. A uniqueness rule permits one active/submitted docket per employee/criterion, preventing duplicate requests. The database validates that target rank and criterion match and that the employee is ready under the rank-matched criterion at submission time.

RLS and controlled RPCs ensure:

- authenticated employees can read and submit only their own dockets;
- an employee cannot choose another employee, a nonmatching criterion/rank, an unready criterion, or an arbitrary status;
- active HR personnel can read dockets for the existing promotion workflow; this PR does not grant docket status updates;
- SysAd access stays limited to its existing administrative authority, without a new application role.

The client adds typed query/mutation helpers and invalidates employee readiness, employee dashboard, HR promotion, notifications, and relevant reports after a successful submission. The migration grants execute only to intended authenticated callers and revokes public execution.

## 6. Tests and Error Handling

Every behavior is developed test-first (RED, then implementation GREEN).

### Unit and component tests

- Employee StaffShell selection, navigation ordering, slate-400 dark labels, no Scan link, and Profile in the account menu.
- Employee login heading, badge input, non-regression of Admin & HR email/Access-Level login, and badge-login routing for eligible HR/SysAd personnel.
- Dashboard live states and empty states; no mock stock imagery.
- Profile personnel/document cards and retained profile-change/password actions.
- Leave balance cards, filter tabs, modal validation, status mapping, cancellation, and HR feedback.
- Deployment status filter and proof/report action.
- Attendance CTA, recent log mapping, direct scan redirect, and camera stop behavior.
- Promotion rank matching, progress/missing requirement display, required docket remarks, successful submission, duplicate prevention display, and disabled/ineligible state.

### Database tests (pgTAP)

- The employee readiness RPC maps PAT to PCpl and does not map it to unrelated or distant ranks.
- Inactive/no-next-rank/no-criterion cases return no employee result.
- Live record changes recompute readiness without an HR review record.
- Docket submission requires readiness and remarks, has matching rank/criterion, prevents duplicates, and creates the intended notification.
- RLS rejects cross-employee reads/submissions and unauthorized status changes while allowing active HR review access.

### End-to-end and visual tests

- Extend employee login/account helpers and focused employee journeys.
- Run each affected Playwright spec independently with `playwright.local.config.ts` against one built `next start --hostname 127.0.0.1 --port 3000` process.
- Extend accessibility checks for all redesigned employee pages and their leave/promotion dialogs.
- Add focused employee visual style/PNG baselines for the employee login and redesigned routes only after reviewing actual diffs; never blindly accept snapshots.

## 7. Required Verification and Delivery

1. Run focused RED tests before each change, then their GREEN test after.
2. Run `npx supabase db reset` before `npx supabase test db`.
3. Run Vitest in memory-safe halves, then the relevant complete suite as capacity allows.
4. Run lint, typecheck, build, database tests, affected E2E specs one at a time, and visual checks after a production build.
5. Open exactly one PR from `codex/capstone-ui-employee` into `main`.
6. Do not push migration files to a live Supabase project. The PR description will list the exact post-merge production migration command and deployment ordering.
7. Include a ready-to-paste PR 4 prompt for the SysAd redesign (`sysad.html`, PDF page 49) in the final handoff.
