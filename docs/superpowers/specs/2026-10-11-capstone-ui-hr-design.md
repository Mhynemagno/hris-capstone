# Capstone UI: HR side redesign (PR 2 of 4)

**Date:** 2026-10-11
**Branch:** `feat/capstone-ui-hr` (off `main` at `2656ccd`, after PR #78 merged)
**Sources:**
- **Mockups:** `docs/design/capstone-ui/`. The HR files are `sample.html`, `dashboard.html`, `jobpost.html`, `roster.html`, `dep.html`, `leave.html`, `promotions.html`, `attendance.html`, `reports.html` and `announcements.html`.
- **Client notes:** `C:\Users\ASUS\Downloads\Final Changes (1).pdf`, pages 16–37 (HR Side, in Tagalog).
- **Previous PR:** `docs/superpowers/specs/2026-10-11-capstone-ui-applicant-design.md` (#78). Its conventions carry over unchanged.

## Intent

The client's adviser produced finished mockups of every screen and a PDF of notes. The user wants the HR screens to match those mockups **1:1: fonts, colours and content**, and wants the PDF notes for HR applied.

**Success** means:
- Every HR screen looks the same as its mockup, with the station logo and real data in place of the samples.
- The panels the PDF asks for open in place instead of on new pages.
- Logout lives in the profile menu, and the bell opens a notification panel.
- Employee entries for Eligibility and Certification / Training accept uploaded documents.
- The Kiosk page is gone.
- Employee, Management and SysAd screens look exactly as before. SysAd only moves to the new login.

## Decisions

| Topic | Decision |
|---|---|
| SysAd on the login (PDF p. 16) | **Keep** the "Access Level: HR Admin / System Administrator" design. |
| Admin login URL | A new login mode, `/login?as=admin`, signing in by **email**. `/login?as=employee` stays the badge-number login (PR 3 restyles it from `emplogin.html`). |
| Access Level | **Enforced.** HR Admin accepts only `hr_personnel`, and System Administrator only `system_administrator`. A mismatch is rejected. |
| Font floor | HR screens: **9px**, the same as the applicant portal. The 12px rule stays for other staff roles. |
| Shell | A new `StaffShell` from the HR mockups, used by HR only. `WorkspaceShell` stays for Employee, Management and SysAd until PRs 3 and 4. |
| In-place panels | State lives in the URL (`?create=1`, `?review=<id>` …). The old routes redirect to those URLs. |
| Uploads (PDF p. 23) | **One document per entry**, for Eligibility and for Certification / Training. |
| Promotion review | Mockup layout, keeping the Round 5 performance rubric and the recommendation inside the modal. |
| Dashboard | **Mockup only**, on real data (one new read-only RPC for rank, gender and today's attendance). The Needs attention tab, period picker, Quick actions, Station pulse and Create menu are removed. |
| Announcement toolbar | Safe lightweight markup in the existing plain-text body. HTML is never rendered. |
| Leave remarks | Required for both Approve and Decline. |
| Roster actions | View and Edit open the application review. Delete disqualifies the application (Not Selected). |
| Styling | Mockup Tailwind classes copied literally inside `.capstone-ui`, lucide icons, `/san-juan-police-logo.png`, slate-500 for grey captions on light backgrounds, no stock photos of real people. |
| Dates | In words via `src/lib/format-date.ts`. Clock times in the attendance screens are 24-hour, as in the mockup. |
| Roles | No new roles. |
| Live Supabase | Migrations are committed, not pushed, until the user has merged and deployed. |

## 1. Login

### 1.1 `/login?as=admin` (`sample.html`)

**Frame:** the split card and hero of the applicant login (`ApplicantAuthFrame`, 5/7 columns). It needs a variant prop so the hero copy can change.

*Left (form):*
- "ADMINISTRATIVE ACCESS" pill (amber), heading "Admin & HR Login", and "Authorized management portal for HR Personnel Officers and System Administrators."
- **Access Level** select (lucide `ShieldUser` icon): "HR Admin" (value `hr`, default) and "System Administrator" (value `sysad`).
- **Email Address** (`type=email`, placeholder `juan.delacruz@gmail.com`).
- **Password**, with show/hide.
- "Forgot password?"
- "Remember me on this device", ticked by default. It reuses the #78 `remember` / `hris-session-only` cookie logic.
- **Login** button (`bg-slate-900 hover:bg-blue-900`).
- Below the form: "Station personnel? **Login as Employee**" (→ `/login?as=employee`).

*Right (hero):*
- Logo, "SAN JUAN CITY POLICE STATION", "EASTERN POLICE DISTRICT • NCRPO", and a pulsing "MANAGEMENT PORTAL" pill.
- "SERVICE • HONOR • JUSTICE" chip, "System Management & Administration", and "Authorized portal for managing personnel records, reviewing promotion applications, auditing DTR logs, and configuring station system settings."
- Footer: "© {year} San Juan City Police Station", **Privacy Policy** (the #78 dialog) and **Help Desk** (`/#contact`).
- No background photo.

*Behaviour:* the applicant login's mobile layout and error/notice rendering.

### 1.2 Route and redirects

- **`/auth/login` with `as=admin`:**
  - Validates an email and an `access_level` of `hr` or `sysad`.
  - Signs in, then runs the existing banned-user and `is_active` checks.
  - Reads the role with the same lookup `getCurrentRole` uses.
- **Role check:**
  - `hr` requires `hr_personnel`, and `sysad` requires `system_administrator`.
  - On a mismatch, the route signs out and redirects to `/login?as=admin&error=wrong_access_level&level=<hr|sysad>`.
  - The page shows "This account does not have {HR Admin | System Administrator} access."
  - Unknown values are treated as `hr`.
- **Login page:**
  - `LoginMode` becomes `"employee" | "applicant" | "admin"`.
  - The default-mode logic sends a `next` under `/hr` or `/admin` to `as=admin`.
  - `/auth/continue` and the bare `/login` redirect do the same.
- **`/login?as=employee`:** keeps its current look and badge login. It gains "HR / Admin? **Admin & HR Login**" (→ `/login?as=admin`). HR and SysAd accounts can still sign in here; PR 3 decides whether to restrict it.

## 2. Staff shell (`src/components/staff-shell/staff-shell.tsx`)

**Where it's used:** `src/app/(app)/layout.tsx` renders `StaffShell` for `hr_personnel` and keeps `WorkspaceShell` for the other staff roles. The shell is written role-neutral (nav comes from `role-config.ts`), so PRs 3 and 4 can switch their roles over.

**Sidebar** (`dashboard.html` `<aside>`, 1:1)
- Container: `w-64 bg-[#0B132B]`, with the logo tile replaced by the logo image and the text "San Juan City PS".
- Group labels `text-[10px] font-extrabold text-slate-500 uppercase`.
- Inactive items `text-xs font-semibold text-slate-400`; the active item is `bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-900/40`.
- Nav badges use the mockup's `bg-blue-600 text-[10px]` pill.
- **HR nav** (in `role-config.ts`):

| Group | Label | Route | Icon (lucide) | Badge |
|---|---|---|---|---|
| — | Dashboard | /hr | ChartPie | |
| RECRUITMENT | Plantilla Openings | /hr/jobs | Briefcase | |
| RECRUITMENT | Applicant Roster | /hr/applications | IdCard | applicationsAwaitingReview |
| PERSONNEL 201 | Active Personnel | /hr/employees | Users | |
| PERSONNEL 201 | Duty Deployments | /hr/deployments | MapPinned | |
| PERSONNEL 201 | Leave Applications | /hr/leave-requests | CalendarCheck | leaveForApproval |
| PERSONNEL 201 | Promotion Records | /hr/promotions | Award | |
| ATTENDANCE & DTR | Daily Attendance Logs | /hr/attendance | Clock | |
| REPORTS | HR Audit & Reports | /reports | FileText | |
| PUBLIC SITE | Announcements | /hr/public-site | Megaphone | |

- The **Kiosk** item is removed (PDF p. 33). Announcements has no mockup entry; it gets its own group.
- No Sign out in the sidebar.
- Below `lg`, the sidebar is off-canvas with an overlay, opened by a menu button in the top bar.

**Top bar** (`jobpost.html` header)
- `h-16 bg-white border-b`.
- Left: logo, "SAN JUAN CITY POLICE STATION", "HRDD Portal" chip, and a per-page subtitle (`text-[10px]`, slate-500).

| Route | Subtitle |
|---|---|
| /hr | Dashboard • Manpower, Attendance & Deployment Overview |
| /hr/jobs | Recruitment Module • Plantilla & Job Openings |
| /hr/applications | Recruitment Module • Applicant Tracking & Roster |
| /hr/employees | Personnel Management • Personnel 201 Records |
| /hr/deployments | Personnel Management • Duty Deployments & Field Assignments |
| /hr/leave-requests | Leave Management & Personnel Entitlements |
| /hr/promotions | Personnel Management • Promotion Board & Criteria |
| /hr/attendance | Personnel Management • Face Biometrics & Attendance Logs |
| /reports | Personnel Management • Official Analytics & Station Reports |
| /hr/public-site | Public Site • Announcements & Station Contacts |
| /notifications | Notifications |

  Sub-routes use the subtitle of their section.
- Right:
  - **Bell:** the #78 `NotificationDrawer`, made role-neutral by passing its error notifier as a prop. It has a red count badge, and notification links go to their HR routes.
  - **Account menu** (the #78 `ApplicantAccountMenu` generalised into `AccountMenu` with optional `profileHref` and a notifier prop):
    - 36px avatar (`bg-slate-900 text-amber-400`) with initials.
    - Name: "{RANK CODE} {first initial}. {middle initial}. {last name}" when the user is linked to an employee with a rank, else the full name, else the email. The email sits under it.
    - Chevron. The menu holds **Logout** only (red), because HR has no profile page.
    - The accessible name stays `Account menu for <email>`, which the e2e tests rely on.

**Content area:** `bg-slate-50`, `main` `p-6 space-y-6`. The #78 dark toaster mounts at top-right, and every mockup `alert()` becomes a toast.

**Styling scope:**
- The shell and the redesigned screens carry `.capstone-ui`.
- Pages without a mockup keep their current look by rendering inside a `.workspace` wrapper with today's tokens:
  - `/hr/jobs/new` and `/hr/jobs/[id]`
  - `/hr/applications/[id]`
  - `/hr/employees/**`, apart from the new upload dialog
  - `/hr/deployments/[id]`
  - `/hr/attendance/import`, `/face-enrollment` and `/unmatched`
  - `/notifications`
- Each redesigned page's h1 uses the mockup class `text-2xl font-black text-slate-900 tracking-tight`, with a subtitle `text-xs text-slate-500 font-medium`.

**Shared mockup primitives** (`src/components/staff-shell/ui/`), so screens don't repeat class strings:
- `StaffCard`
- `StaffTableCard` (header bar with title, count chip, search, select; footer with "Showing a–b of n …" and Previous/Next)
- `StatusPill` (amber/emerald/rose/blue/slate)
- `StaffModal` (centred: overlay, icon tile, title, subtitle, close, footer)
- `StaffSlideOver` (right panel, `max-w-lg` / `max-w-xl`)
- `StaffInput` / `StaffSelect` / `StaffTextarea` (the mockup input classes)
- `InitialsAvatar`

Modals and slide-overs:
- They are focus-trapped dialogs with `aria-modal`.
- They close on Escape, the close button and overlay click.
- They return focus to their trigger.
- Pagination is 10 rows per page and works (the mockups' disabled buttons are sample state).

## 3. Screens

Every screen copies its mockup's markup and classes, replaces sample data with real data, and keeps the mockup's copy unless that copy states a sample fact.

### 3.1 Dashboard `/hr` (`dashboard.html`, PDF pp. 17–19)

**Title**
- "Dashboard Overview".
- "Real-time manpower analytics, daily attendance, and deployment status for **{today in words}**."
- A static "Last 30 days" chip. The dashboard data covers the last 30 days.

**KPI tiles** (5, mockup classes)

| Label | Value | Caption |
|---|---|---|
| Total Active 201 | active employees | "Active personnel" (the mockup's "✓ 100% Verified Roster" is a sample fact) |
| Present On Duty | present today "/ {active}" | "{pct}% Operational Strength" |
| Absent / Leave | absent + approved leave today | "Approved Leave Status" |
| Partial / Late | incomplete + late today | "Half-day / Late Check-in" |
| Plantilla Vacancies | published, open postings | "Open for Recruitment" |

**Left column (8/12)**
- **Personnel Distribution:**
  - Rank and gender counts come from `get_hr_dashboard_overview` (§4.2).
  - The filter select has Units / "Ranks (Highest to Lowest)" / Gender.
  - Each view uses its mockup heading, subtitle, row layout, `font-mono` "N Personnel (pct)", bar colours and "Total: N Personnel" footer.
  - Gender shows the Male / Female cards; a "Not specified" row appears only when that count is above 0.
- **Recruitment Pipeline Overview:**
  - Real counts per stage, from `PIPELINE_STAGES` plus Not Selected, with a "{n} Total Applicants" pill.
  - Built as a column chart with the chart library in `reporting/charts.tsx`, not Chart.js.
  - Bars are `#cbd5e1` when empty, `#2563eb` for stages with candidates and `#f43f5e` for Not Selected.
  - The legend footer is the mockup's.

**Right column (4/12)**
- **Daily Attendance Overview:**
  - A "Live Log" badge.
  - A doughnut of Present / Absent-Leave / Partial-Late with "{n} Total Active" in the centre.
  - The three tinted rows below it.
  - "Go to Full Attendance Roster" → `/hr/attendance`.
- **Promotion Notice:**
  - "Q{quarter} Promotion Endorsement".
  - "{n} personnel meet the criteria for regular promotion evaluation.", where n is the number of candidates currently ready from the readiness data.
  - "Review Endorsements" → `/hr/promotions`.
  - The card is hidden when n = 0.

**Bottom row**
- **Recent Applications:** the 5 most recent, with initials, name, "{posting} • {date in words}" and a stage pill. "View All Applications →" goes to `/hr/applications`.
- **Recent Duty Deployments:** the 5 most recent, with an icon avatar, "{rank code} {initial}. {last name}", "{type} • {location}" and a status pill. "View Full Roster →" goes to `/hr/deployments`.

**Data:** `get_hr_dashboard_summary` (last 30 days), `get_hr_dashboard_overview` (§4.2) for the distribution and today's attendance, the readiness query, and a recent-deployments query (5 rows, newest `starts_on`).

**Removed:** Needs attention tab, period picker, Quick actions, Station pulse, Create menu, and the old metric cards and charts.

### 3.2 Job postings `/hr/jobs` (`jobpost.html`, PDF p. 21)

**Title and button**
- "RECRUITMENT OPENINGS" and "Manage recruitment openings and vacancies for San Juan City Police Station."
- **Create Recruitment** → `/hr/jobs/new` (the existing form, unchanged).

**Toolbar**
- Segmented tabs All / Published / Draft / Closed with live counts. They filter the list, held in `?status=`.
- Search "Search job postings..." by title.

**Columns:** Posting Title (with a location sub-line), Status, Applications, Deadline, Updated, Actions.
- **Sorting:** Posting Title, Deadline and Updated sort on click. Updated, newest first, is the default.
- **Deadline:** the date in words, then "Closes in N days" (emerald) or "Closed" (slate-500). It shows "Closes today" when the deadline is today.
- **Status:** Published is emerald, Draft slate and Closed slate.

**Actions:**
- **View** opens the public `/jobs/[id]`.
- **Edit** goes to `/hr/jobs/[id]`.
- **Delete** asks "Are you sure you want to delete this posting?", then calls `deleteRecord("job_opening", id)` (`src/queries/deletion.ts`). If the server refuses, its message shows as an error toast.

### 3.3 Applicant Roster `/hr/applications` (`roster.html`, PDF p. 22)

**Header and nav label:** "APPLICANT ROSTER" and "Review and track candidates for recruitment openings." The segmented tabs **Applications** / **Registered Applicants** map to the existing `?view=`.

**Filter bar**
- Search "Search name or applicant number...".
- "Recruitment Openings" select (real postings).
- "Status" select: Pending, then each `PIPELINE_STAGES` stage, then Hired and Not Selected.
- "More filters" opens the existing AI and quick-view filters in a popover.

**Columns**
- Applicant: initials avatar, name, and "ID: {formatted number}" or "ID: Pending".
- RECRUITMENT OPENING: posting title, with "{position}" as the sub-line.
- STATUS:
  - Application Submission → amber "PENDING / FOR EVALUATION"
  - later stages → blue, with the stage name
  - Hired → emerald
  - Not Selected → rose
- AI Match Score: a `w-24 h-2` bar, "n / 5", and a chip. The chip reads Excellent (5), Good (4), Fair (3) or Low (1–2) Match; "—" when there is no score.
- Submitted: the date in words.
- Actions.

**Pending rows**
- **Registered applicants with no application** show the amber status **"PENDING"** in both tabs. It replaces "Not yet applied" in the badge, the quick view and the Registered Applicants filter.
- Their opening and AI cells show "—", and they have **View** only (the existing `RegisteredApplicantDrawer`).

**Actions (application rows)**
- **View** → `/hr/applications/[id]`.
- **Edit** → `/hr/applications/[id]#stage-actions`, scrolling the review to its stage actions (the header's action group gets `id="stage-actions"`).
- **Delete** opens a `StaffModal` "Disqualify or remove applicant?" with a required Reason. It then calls `transition_application_status` to `Not Selected` with the reason as the note.
- Delete is hidden for Hired and Not Selected rows.

**Unchanged:** the application review page.

### 3.4 Employees: documents on Eligibility and Certification / Training (PDF p. 23)

**List entries** (`Records` in `employee-record-detail.tsx`, both tabs)
- A file row: PDF or image icon, file name, size, and an eye button opening a 60-second signed URL.
- No file: an **Upload document** button.
- A file on record: **Replace** and **Remove** (confirm "Remove the uploaded document for {entry name}?").

**Upload dialog** (`DocumentUploadDialog`, styled like the p. 23 screenshot)
- **Card:** white, `rounded-3xl`, over a blurred overlay.
- **Header:** a 48px outlined circle with `CloudUpload`, "Upload files", "Select and upload the file of your choice." and a `CircleX` close button.
- **Drop zone:** dashed, centred. It shows `CloudUpload`, "Choose a file or drag & drop it here" and "PDF, JPEG, PNG or WEBP formats, up to 10 MB", with a "Browse File" button. It accepts drop and keyboard activation.
- **File row:** a `slate-100` row with a file icon (red "PDF" tag for PDFs), the name, "{size} • Uploading…" with a spinner while it uploads, and a `CircleX` remove button.
- **Footer:** Cancel / **Save document**.
- **Validation:** client checks for type and size. The bucket enforces the same limits.

**Where it's used**
- The add and edit entry forms (`record-entry-form.tsx`) use this dialog in place of their file input.
- Eligibility still requires a document on new entries. Certification / Training documents are optional.

**Data**
- `savePersonnelEntry` handles both kinds: upload under `qualifications/<employeeId>/…` or `certifications/<employeeId>/…`, then insert or update, removing the upload if the save fails.
- Replace uploads the new file, updates the row, then removes the old object.
- Remove clears the four columns, then removes the object.

**Unchanged:** the rest of the employee record and its `.workspace` styling.

### 3.5 Deployments `/hr/deployments` (`dep.html`, PDF pp. 24–25)

**Header:** "DEPLOYMENTS", "Create and manage personnel deployments without losing their history." and a **New Deployment** button.

**Filters**
- Search "Search employee name or badge number...".
- Type: "All Deployment Types", then the four real `deployment_type` values (Public Assembly, Special Event, Election Security, Disaster Response).
- Status: All Statuses / Ongoing / Scheduled / Completed / Cancelled.

**Columns:** Employee (avatar, name, "Badge: X"), Location (`MapPin`), Type / Event, Dates ("{start} – {end}" or "{start} – No end date", in words), Status, Actions.
- Status pills: Ongoing blue, Scheduled slate, Completed emerald, Cancelled rose.

**Side panel** (`StaffSlideOver`, `max-w-lg`)
- **Opens:**
  - "New Deployment" → `?create=1`, titled "Create Deployment"
  - Edit → `?edit=<id>`, titled "Edit Deployment"
- **Copy:** subtitle "Assign an employee to a duty location and operation."
- **Fields:**
  - Employee: the existing employee search, placeholder "Type a name or badge number...", help "Search active station personnel by full name or badge ID."
  - Location and Deployment Type.
  - Event / Operation and Status.
  - Start Date and End Date (help "Optional. Leave blank for ongoing duty.").
  - Remarks / Instructions.
  - Required markers follow today's validation.
- **Footer:** Cancel and **Save**, both `text-xs`.
- **Saving:**
  - Reuses `DeploymentForm`'s schema and `create_deployment` / `update_deployment` (with `expectedUpdatedAt`).
  - On success: toast "Deployment saved", close, refresh.
  - On conflict or error: an error toast, and the panel stays open.

**Actions**
- **View** → `/hr/deployments/[id]` (unchanged, with reports).
- **Edit** opens the panel.
- **Delete** asks "Cancel or delete this deployment?", then sets the status to Cancelled via `update_deployment`. Deployments are not in `delete_record`'s list, and the page promises to keep their history. Delete is hidden on rows that are already cancelled.

**Redirects:** `/hr/deployments/new` → `?create=1`; `/hr/deployments/[id]/edit` → `?edit=[id]`.

### 3.6 Leave `/hr/leave-requests` (`leave.html`, PDF pp. 26–27)

**Header:** "Leave Management" and "Manage leave entitlement policies and process employee leave applications." There is no "File Leave Application" button; it is a "coming soon" stub in the mockup and no such HR feature exists.

**Annual Leave Entitlements**
- One card per active leave type, with the count "{n} Active Categories".
- Each card shows the mockup icon and colour by type name, falling back to a slate `CalendarCheck`.
- Value: "{days} Days / Year".
- Footnote: the leave type's description when it has one, otherwise the mockup's footnote for that type.
- The pen icon opens `StaffModal` "Update Policy: {type}" with "Allowed Days Per Year" first (blank = no limit; the card then reads "No limit"). Name and Description follow it, so today's rename and description edits aren't lost. It saves via the existing `update_leave_type` / `set_leave_type_allotment` path.
- `LeaveTypeManager` itself is no longer rendered on the page.

**Leave Request Queue**
- Subtitle: "Review pending and processed personnel leave applications".
- Search "Search employee or badge no...".
- Status filter: All / For Approval / Approved / Rejected / Cancelled.
- Columns: EMPLOYEE, LEAVE TYPE, INCLUSIVE DATES, SUBMITTED, STATUS, ACTIONS.
- Pending rows are tinted `bg-amber-50/20`.
- Pills: pending → FOR APPROVAL (amber), approved → APPROVED (emerald), rejected → REJECTED (rose), cancelled → CANCELLED (slate).

**Review modal** (`?review=<id>`, pending requests only)
- The mockup's "Review Leave Request" layout. The summary box adds:
  - "Balance: {remaining} of {allotment} days" (from `get_employee_leave_balances`)
  - attachment links (`getLeaveAttachmentUrl`), when present
- **HR Remarks / Notes \*:** required for both **Decline Request** and **Approve Request**. When empty, the error reads "HR Remarks are required to proceed."
- Calls `decide_leave_request`, then: toast "Leave request approved" or "Leave request declined", close, refresh.

**Other row actions**
- The eye opens "Leave Application Details" (`?view=<id>`).
- The pen is shown only on pending rows and opens the review. Decided requests cannot be re-decided today.

**Redirect:** `/hr/leave-requests/[requestId]` → `?review=<id>` when the request is pending, else `?view=<id>`.

### 3.7 Promotions `/hr/promotions` (`promotions.html`, PDF pp. 28–30)

**Header and banner**
- "Promotions Evaluation" and "Review rank readiness and eligibility without automatically changing employee records."
- A **Manage Criteria** button.
- The "Promotion Board Guidelines" banner.

**Candidates for Promotion** (from `list_promotion_readiness_page`)
- Search "Search employee or rank...", a count chip and a pager.
- **Columns:**
  - EMPLOYEE: avatar, "Last, First" and "Badge: X • {current rank code}".
  - TARGET RANK: chip "CODE — Full Name".
  - LAST REVIEWED: date in words, or "—".
  - STATUS: READY (emerald) or NOT READY (amber).
  - RECOMMENDATION: RECOMMENDED (blue), NOT RECOMMENDED (rose), DEFERRED (slate) or "—".
  - ACTION: **Open Review**.

**Manage Criteria** (`StaffSlideOver` `max-w-xl`, `?criteria=1`)
- "Promotion Criteria" / "Configure criteria requirements for rank progression."
- **Add Promotion Criteria:**
  - Today's fields: Target Rank, Years of Service, and Certification / Training requirement rows from `PNP_CERTIFICATIONS`.
  - "Add another certification / training" adds a row.
  - Rules: one criteria set per rank, and no duplicate certifications.
  - **Save Criteria**, via `create_promotion_criterion`.
- **Existing Criteria Policies:**
  - Hint: "Deactivate criteria to stop using them for new evaluations."
  - Each card shows the rank, an Active or Inactive chip, "At least N years of service" and the certification bullets.
  - Deactivate / Activate via `set_promotion_criterion_active`.
  - Delete asks "Delete criteria?", then uses the existing delete path.
- Footer: **Close**.

**Open Review** (`StaffModal` `max-w-xl`, `?review=<employeeId>`)
- "Promotion Eligibility Evaluation" / "Review candidate criteria checklist for {target rank code} rank".
- **Candidate box:** name, "Current Rank: {rank} • Badge {X}", and a pill "Ready for Board Review" (emerald) or "Not Yet Ready" (amber).
- **CRITERIA REQUIREMENTS CHECKLIST:** one row per requirement from the live readiness data:
  - Time-In-Grade, with "Actual: {n} Years"
  - each certification
  - performance rating, when the criterion uses it
  - Met rows are emerald with PASSED; unmet rows are rose with `CircleX` and NOT MET.
- **Performance evaluation:** a collapsible section, closed by default, holding the existing `PerformanceEvaluation` rubric.
- **Recommendation:** a select with Recommended / Not recommended / Deferred.
- **Remarks:** placeholder "Enter promotion board endorsement remarks...".
- **Footer:** Close / **Submit Endorsement**, via `create_promotion_evaluation` with the active criterion and today's date. On success: toast "Board endorsement submitted", close, refresh.

**Redirects:** `/hr/promotions/criteria` → `?criteria=1`; `/hr/promotions/[employeeId]` → `?review=[employeeId]`.

### 3.8 Attendance `/hr/attendance` (`attendance.html`, PDF pp. 31–33)

**Header:** "Attendance Logs" and "Review imported and face-scanned attendance records, resolve unmatched device IDs, or launch kiosk mode."

**Toolbar**
- **Import Attendance** → `/hr/attendance/import`.
- **Face Registration** → `/hr/attendance/face-enrollment`.
- **Unmatched IDs** → `/hr/attendance/unmatched`.
- **Launch Attendance Kiosk** opens the kiosk overlay.
- The three sub-pages are unchanged, rendered in `.workspace`.

**Kiosk overlay** (`?kiosk=1`, the mockup's `#kioskModal`)
- Full screen `bg-slate-950`.
- Header: logo, "San Juan City Police Station", "Biometric Face Recognition Attendance Kiosk", and **Exit Kiosk Mode**.
- Centre: the existing `FaceScanner` in kiosk mode, framed by the dashed border, with "Look at the Camera" and "Position face inside frame for instant scan".
- A live clock (`hh:mm:ss AM/PM`, Manila) and the date in words.
- Status bar: "Device Terminal Active" and "System Status: Operational".
- Escape and Exit both close it and stop the camera.

**Removed:** the Kiosk page (`/hr/attendance/kiosk` → redirect to `/hr/attendance?kiosk=1`), `FaceAttendanceKiosk`'s page wrapper, and the Kiosk nav item.

**Recent Attendance Logs**
- Search "Search name or external ID...".
- Status: All / Present / Partial / Late / Absent, where `incomplete` = Partial.
- Count chip and pager.
- **Columns:**
  - DATE: in words.
  - PERSONNEL NAME: avatar, a name link to `/hr/employees/[id]`, and the external ID.
  - EXTERNAL ID.
  - TIME IN / TIME OUT: 24-hour Manila time, or "—".
  - STATUS: PRESENT emerald, PARTIAL amber, LATE rose, ABSENT slate.
  - SOURCE: "Face scan" (`Camera`) or "Imported" (`FileUp`).
  - ACTION: eye.

**Employee Attendance Record** (`StaffModal`, `?view=<logId>`)
- **Profile box:** avatar, name, "Rank: {code} • Badge / ID: {X}", and "San Juan City Police Station — {employee's Unit / Section}". The unit line is omitted when the employee has none.
- **Grid:** LOG DATE, ATTENDANCE STATUS, TIME IN, TIME OUT.
- **Verification box:**
  - "Verification Source:" reads "Face Scan Biometrics" or "Imported File".
  - Face scans: "Scan Mode:" with the `sync_metadata.mode`.
  - Imports: "Import File:" with the import's `source_filename`.
  - **No Facial Match Score row**, because no score is stored.
- Footer: **Close Window**.

### 3.9 Reports `/reports` (`reports.html`, PDF p. 34)

The HR view only. Management keeps its current reports page in `WorkspaceShell`.

**Header:** "Reports & Analytics", "Filter, export, or print role-appropriate personnel and operational reports." and **Export Station Masterlist**. The masterlist is a CSV of active personnel: Badge No., Rank, Name, Unit / Section, Employment Status. It is built with `lib/reporting/csv.ts` and named `station-masterlist-{YYYY-MM-DD}.csv`.

**Report cards** (6, from `REPORT_KEYS`)

| Card | Report key | Footer label |
|---|---|---|
| Applicant Tracking | applicant-tracking | Live data |
| Hiring Decisions | hiring-decisions | Live data |
| Employee Performance | employee-performance | Monthly Audit |
| Duty Deployments | deployments | Real-time Data |
| Attendance & Leave | attendance-leave | Daily Logs |
| Promotion & Training Needs | promotion-training-needs | CY {year} Cycle |

Each card uses its mockup icon, colour, tag and description, with a **Generate** button.

**Generate modal** (`StaffModal` `max-w-2xl`)
- Title: the report name. Subtitle: "Configure parameters and print official PNP station document".
- **Letterhead box.**
- **Date Range From / To:** required; default the 1st of the current month through today; From must not be after To.
- **Station Sub-Unit / Sector:** "All Station Sections", then the real Units / Sections.
- **Export Format:**
  - "PDF Document (.pdf)" → `/reports/[key]?from&to&department&print=1`. The page opens the browser print dialog with the letterhead, so it can be saved as PDF.
  - "Excel Spreadsheet (.csv)" → downloads the existing CSV for those filters. The label is changed from ".xlsx" because the file is CSV.
  - "Direct Print View" → the same print URL.
- **Download Official Report** runs the chosen format.

**`/reports/[reportKey]`:** reads `from`, `to`, `department` and `print` from the URL. It gains the letterhead in print and calls `window.print()` once data has loaded when `print=1`. Otherwise it is unchanged.

### 3.10 Announcements `/hr/public-site` (`announcements.html`, PDF pp. 35–37)

**Header**
- `Megaphone`, "Announcements & Public Content", and "Manage public landing page notices, news, and official station emergency contacts."
- **New Announcement** (`bg-blue-950`).

**Tabs:** Announcements / Station Contacts (underline style), with live counts and "Showing {n} active entries" (published + draft).

**Announcement cards**
- `border-l-4` accent and category badge by category:

| Category | Accent / badge colour |
|---|---|
| News | navy accent, slate badge |
| Advisory | amber |
| Event | blue |
| Recruitment | emerald |

- Status badge: "● PUBLISHED" (emerald), "DRAFT" (slate, white card) or "ARCHIVED" (slate-200, with the card at `bg-slate-50/80 opacity-75`).
- Date line: "First published {date in words}", or "Draft saved {date in words}" for drafts.
- Title and a one-line summary.
- Buttons:
  - Published: **Edit** and **Archive**.
  - Draft and Archived: **Edit** and **Publish**.
  - Status changes go through `set_announcement_status`, followed by a toast.

**Create modal** (p. 36)
- Navy header with `Megaphone` and "CREATE NEW ANNOUNCEMENT".
- Fields: Title \*, Category \* (News / Advisory / Event / Recruitment), Summary \* with "Short summary for quick preview on the public dashboard.", and Announcement Text \* with the toolbar.
- "Publish immediately": ticked → published, unticked → draft.
- Buttons: Cancel and **Save Announcement**, via `save_announcement`.
- The existing schema limits apply.

**Edit modal** (p. 35)
- "EDIT ANNOUNCEMENT", pre-filled, with no publish checkbox; status is changed from the card.
- **Delete** asks "Delete this announcement?", then calls `delete_announcement`.
- Cancel and **Update Changes**.

**Toolbar markup** (`src/lib/public-site/announcement-markup.ts`)
- **Buttons:** **B** wraps the selection in `**…**`, *I* in `*…*`, and U in `++…++`. The list button prefixes the selected lines with `- `. The link button prompts for a URL and inserts `[selection](url)`. Each button has an accessible label.
- **Parser:** `parseAnnouncementMarkup(body)` returns paragraphs of inline nodes and bullet lists. `AnnouncementBody` renders them as React elements (`strong`, `em`, `u`, `ul/li`, `a`).
- **Safety:** links are allowed only for `http:` and `https:` and open in a new tab with `rel="noopener noreferrer"`. Anything else, including raw `<tags>` and `javascript:` URLs, renders as literal text.
- **Old posts:** they render exactly as before. Blank lines still separate paragraphs.
- **Where it's used:** the landing page cards strip markers from the summary and body excerpt.

**Station Contacts tab:** the existing `HrContactsPanel` and `HrContactForm`, restyled with `StaffCard` and `StaffModal`. Behaviour is unchanged.

## 4. Data changes

### 4.1 Certification documents (migration `…_certification_documents.sql`)

- **Columns:** `certifications` gets `document_path`, `document_name`, `document_mime_type` and `document_size_bytes`, with the same all-or-none check constraint as `qualifications` (`20261010100003_proof_uploads.sql`).
- **Trigger:** `private.check_certification_document` mirrors `check_qualification_document`. The path must be `certifications/<employee_id>/…` and the object must exist in `personnel-documents`.
- **Storage policies on `personnel-documents`** for the `certifications/` prefix: insert by active HR; select by HR or the employee whose folder it is; delete limited to HR.
- **Qualifications delete policy:** the existing one limits deletes to the uploader. It is widened to any active HR for both prefixes, so Replace and Remove work when a different HR user uploaded the file.
- **Deletes:** `delete_record` doesn't touch storage. After it succeeds for an entry with a document, the client removes the stored object (best effort; a failure is logged, not shown). This is the same cleanup `savePersonnelEntry` does on a failed save.

### 4.2 Dashboard overview (migration `…_hr_dashboard_overview.sql`)

`get_hr_dashboard_summary` is unchanged; it already provides `totalPersonnel`, `openJobs`, `workforceByDepartment` and `recruitmentPipeline`. A new HR-only RPC, `public.get_hr_dashboard_overview()` (security definer, `private.require_active_hr()`), returns:
- `personnelByRank`: `[{ code, name, count }]` for active employees, joined to `ranks` on `employees.rank_id` and ordered by `ranks.sort_order` (highest first). Employees without a rank are counted under `code: null, name: null`, which renders as "Non-Uniformed Personnel (NUP)". The bracketed category (Commissioned Officer (PCO) / Non-Commissioned (PNCO) / Civilian Staff) is derived in code from the rank code by a lookup in `src/lib/personnel/rank-category.ts`, because the ranks table has no category column.
- `personnelByGender`: `[{ label: 'male' | 'female' | 'unspecified', count }]`, from `employees.gender`.
- `attendanceToday`: `{ present, late, incomplete, absent, onLeave }` for the Manila date. `absent` counts active employees with no log and no approved leave today, using the same rule as the summary's `attendanceStatus` breakdown.

### 4.3 No other schema changes

The following are application code only:
- the admin login role check
- the roster's "Pending"
- the panels and redirects
- the report formats and masterlist
- the announcement markup

## 5. Testing

**TDD:** a failing test first for each behaviour.

**Unit tests (Vitest + Testing Library)**
- **Admin login:**
  - `login/page`: `as=admin` renders `sample.html` content; `next=/hr` defaults to admin; the wrong-access-level error renders.
  - `auth/login` route: email login for `as=admin`; mismatched Access Level → sign out and error redirect; Remember me cookie.
- **Shell:**
  - `staff-shell`: HR nav labels, order and groups; no Kiosk; no sidebar Sign out; the account menu has Logout and the accessible name `Account menu for <email>`; the bell opens the panel; mobile off-canvas.
  - `role-config`: HR items as in §2.
- **Redirect pages:** deployments new/edit, leave detail, promotions criteria/review, kiosk.
- **Screens:**
  - dashboard: KPI values, distribution filter switching, Promotion Notice hidden at 0
  - jobs: tabs, sort, delete confirm and refusal toast
  - roster: Pending for registered applicants; status pill mapping; Delete reason required
  - employee records: upload dialog (type and size rejection, upload progress, replace, remove), both kinds
  - deployments: panel create and edit, validation, toast
  - leave: entitlement modal; review refuses an empty note on both actions; approve and decline calls; the view modal
  - promotions: criteria add, deactivate and delete; review checklist met/unmet; endorsement submit
  - attendance: status mapping, view modal (no score row), kiosk overlay opens and closes and stops the camera
  - reports: format routing, date validation, masterlist CSV
  - announcements: create with and without publish, edit, delete, archive/publish
- **Markup:** `announcement-markup`: bold, italic, underline, bullets, links; `javascript:` and `<script>` stay inert text; old plain posts unchanged.

**Database (pgTAP in `supabase/tests/`, after `npx supabase db reset`)**
- certification document all-or-none
- trigger path and object checks
- storage policies: HR, the owning employee, and another employee
- the widened HR delete policy
- `get_hr_dashboard_overview`: rank order and counts, gender counts, today's attendance counts, and refusal for non-HR callers

**End-to-end (Playwright)**
- `demo-accounts`: HR and SysAd sign in at `/login?as=admin` by email with the right Access Level; `signOutFromShell` prefers the account menu.
- `responsive-layout`: HR minimum font 9px; the path list drops `/hr/promotions/criteria` and adds `/login?as=admin`.
- `role-access`: the new login, and access-level mismatch rejected.
- `iso25010-quality`: axe on the restyled HR routes, plus the deployment panel, leave review, criteria slide-over, promotion review and attendance view.
- `capstone-objectives`: dashboard expectations rewritten for the new widgets; deployments via the panel; promotions via the slide-over and modal; leave via the modal; attendance kiosk via the overlay; employee document upload.
- `business-journeys`: sign out via the account menu; the leave flow; the announcements create, publish and archive flow with the new labels.
- `face-attendance`: the kiosk via `/hr/attendance` → Launch Attendance Kiosk.
- `applicant-visual-baseline`:
  - `/login?as=admin`: Windows and Linux PNGs plus style JSON.
  - Style JSON for `/hr`, `/hr/jobs`, `/hr/applications`, `/hr/deployments`, `/hr/leave-requests`, `/hr/promotions`, `/hr/attendance`, `/reports` and `/hr/public-site`. The win32 files are copied to linux, since they are identical after rounding.
  - Procedure: the visual-baseline-regeneration memory.

**How to run:** build once, `next start --hostname 127.0.0.1`, one spec file at a time with a no-webServer config.

**Before the PR:** `npm run lint`, `npm run typecheck`, `npm run test:run`, `npx supabase test db` and every e2e spec all pass.

## 6. Delivery

- One PR from `feat/capstone-ui-hr` into `main`.
- **Manual steps in the PR description:**
  1. After merging and deploying, push the two migrations to live Supabase.
  2. Tell HR and SysAd users to sign in at **Admin & HR Login** (`/login?as=admin`) with their email address and the matching Access Level.
- **Unchanged:**
  - Employee, Management and SysAd screens.
  - The employee badge login's look.
  - The public landing page, apart from announcement formatting.
  - Every applicant screen.
- **After the PR:** hand the user a ready-to-paste prompt for **PR 3 (Employee)**. It names:
  - the mockups `empdash`, `empprof`, `empleave`, `empdeploy`, `empfacere`, `empromote` and `emplogin`
  - PDF pages 39–47
  - the decisions carried over from PRs #78 and 2 (including `StaffShell`, the 9px floor question for Employee screens, and the `?as=employee` badge login)
  - the branch, migration and visual-baseline rules
