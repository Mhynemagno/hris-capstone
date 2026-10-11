# Capstone UI: applicant portal redesign (PR 1 of 4)

**Date:** 2026-10-11
**Branch:** `feat/capstone-ui-applicant` (off `main` at `7fb7d12`)
**Sources:**
- **Mockups:** `C:\Users\ASUS\Downloads\drive-download-20261011T044128Z-1-001\` (Google Drive folder "Capstone UI"). The applicant files are `loginapp.html`, `notifapp.html`, `profile.html`, `documents.html` and `email.html`.
- **Client notes:** `C:\Users\ASUS\Downloads\Final Changes (1).pdf`, pages 2–14 (Applicant Side).

## Intent

The client's adviser produced finished mockups of every screen and a PDF of notes. The user wants the app to match those mockups **1:1: fonts, colours and content**, and wants the PDF notes applied. The work is split into four PRs, Applicant → HR → Employee → SysAd. This spec covers the applicant PR only. After it, the user receives a ready-to-paste prompt for the HR PR.

**Success** means each applicant screen looks the same as its mockup, with the station logo and real data in place of the samples, and the flow changes in the PDF work end to end:
- login by email
- an applicant number only after HR accepts the application
- no in-account "Apply now"
- a working confirmation link

HR, Employee and SysAd screens look exactly as before.

## Decisions

| Topic | Decision |
|---|---|
| Styling | Applicant-only components carry the mockups' literal Tailwind classes (`slate-900`, `blue-800`, `amber-400`, `emerald-*`, `rounded-xl` …) and Inter weights. Global tokens in `globals.css` are untouched. |
| Icons | Closest `lucide-react` equivalents to the mockups' Font Awesome icons; no Font Awesome dependency. |
| Logo | `public/san-juan-police-logo.png` wherever a mockup shows a shield or badge. |
| Login hero photo | The mockup's Unsplash photo (`photo-1541872703-74c5e44368f9`), downloaded into `public/` (Unsplash licence), not hot-linked. |
| Which posting an application is for | The posting chosen on the landing page or `/jobs` is remembered through registration (`applicants.preferred_job_opening_id`). If none was chosen, the newest open posting is used. |
| When the application is submitted | **Save** on the Documents page, once all 5 documents are on file. |
| Applicant number | Assigned only when HR marks **Application Submission** as passed, or moves the applicant on to the Physical Agility Test. Applicants who already have a number keep it. |
| Login identifier | Email for applicants. |
| Stage schedule | New optional `stage_scheduled_at` and `stage_venue` on applications, entered by HR when marking a stage **Scheduled**. |
| Notifications | A panel opens from the bell for applicants; it no longer navigates to `/notifications`. |
| Live Supabase | Migrations are committed, not pushed, until the user has merged and deployed. |

## 1. Flow and data changes

### 1.1 Remembered posting and submit-on-save

- **Migration:** `applicants.preferred_job_opening_id bigint null references public.job_openings(id) on delete set null`.
- **Registration:**
  - `applicant-registration-form.tsx` reads the job id from `next=/applicant/apply/{id}` and adds `preferred_job_opening_id` to the sign-up metadata.
  - `private.handle_new_user` stores it when the value is a published posting, and ignores it otherwise.
- **Signed-in applicant on a posting:** "Apply now" on `/jobs/[id]` calls an RPC, `set_my_preferred_job_opening(job_id)`, which accepts published postings only, then routes to `/applicant/documents`.
- **Old apply route:** `/applicant/apply/[jobId]` becomes a server redirect that does the same and lands on `/applicant/documents`. `ApplicantApplyWorkspace` and `ApplicantApplicationForm` are deleted once nothing uses them.
- **Save on the Documents page:**
  1. Fewer than 5 required documents on file → warning notice "Please upload required documents". Nothing is submitted.
  2. All 5 on file and the applicant has an active application (not Hired or Not Selected) → success notice "All Documents Saved!" with the body "Your files have been saved to your portal."
  3. All 5 on file, no active application, and a target posting exists → submit, then show "All Documents Saved!".
     - The target is `preferred_job_opening_id` if that posting is still published and open, else the newest published, open posting.
     - Submitting reuses the current `submitApplication` path: copy profile documents into the `applicant-documents` bucket and call the `submit_application` RPC.
  4. All 5 on file and no open posting → info notice "Your documents are saved. There is no open recruitment right now."
- **Before submission:** the applicant's status reads **Pending** on the dashboard and Application Status page.

### 1.2 Applicant number on acceptance

- **Migration (registration):** drop the BEFORE INSERT trigger `applicants_assign_applicant_number` from `applicants`, so registration no longer assigns a number. Keep `private.next_applicant_number(year)` and `private.applicant_number_counters`.
- **Migration (sign-up email):** drop the AFTER INSERT trigger `applicants_notify_applicant_number` and `private.notify_applicant_number` from `20261010110001_applicant_number_email.sql`, so no number email goes out at sign-up. In `private.enqueue_notification_email`, replace the `applicant_registered` → `applicant_welcome` mapping with `applicant_number_assigned` → `applicant_welcome`. The existing outbox template is reused for the acceptance email.
- **New AFTER UPDATE trigger on `applications`:**
  - **Fires when:**
    - `status` changes from `'Application Submission'` to any later stage (not `'Not Selected'`), **or**
    - the stage result for Application Submission becomes `passed` or `verified`,
    - **and** the applicant has no `applicant_number` yet.
  - **Assigns:** `next_applicant_number(extract(year from now() at time zone 'Asia/Manila'))`.
  - **Notification:** inserts type `applicant_number_assigned`, title "Your applicant number", body "Your application was accepted. Your applicant number is {formatted}.", link `/applicant`. The existing Brevo outbox maps this type to an email.
  - **Formatting:** uses `public.format_applicant_number`. The old `lpad(…, 6, '0')` truncation bug must not be reproduced: 2026100 formats as "2-026100", not "2-02610".
- **Existing applicants:** keep their numbers. No backfill or clearing.
- **UI:** the profile badge and every other spot that shows the number read **"Pending"**, with the helper text "Issued once HR accepts your application", when it is null.
- **Registration confirmation copy:** "We also emailed your applicant number" is removed. The new copy is "Check your email to confirm your account, then log in with your email address."

### 1.3 Stage schedule fields

- **Migration:** `applications.stage_scheduled_at timestamptz null` and `applications.stage_venue text null` (≤ 200 chars, trimmed).
- **HR result RPC:** the RPC that sets a stage result (`20261010100002_recruitment_stage_results.sql`) takes optional `target_scheduled_at` and `target_venue`. It stores them when the result is `scheduled` and clears both whenever `status` changes.
- **HR UI:** the existing stage-result form shows Date & time and Venue inputs when **Scheduled** is chosen. No other HR UI change.
- **Applicant notification:** for `scheduled`, appends " on {September 23, 2026, 6:00 AM} at {venue}" when the fields are set. Dates use `src/lib/format-date.ts` (words).
- **Remarks:** the applicant-visible remarks for the current stage are status-history rows where `previous_status = next_status = current status` with a note. This is the existing remark mechanism.

### 1.4 Notification delete

- **Migration:** RPCs `delete_my_notification(id uuid)` and `delete_my_notifications()`, both limited to `recipient_user_id = auth.uid()`. The table stays SELECT-only for clients.
- Mark read and mark all as read reuse the existing RPCs.

### 1.5 Login by email, Remember me, and the confirmation link

- **Applicant login field:** `login-form.tsx` in applicant mode labels the field **Email Address** (`type=email`, placeholder `juan.delacruz@email.com`). `/auth/login` accepts an email for `as=applicant`. A value that looks like an applicant number still goes through `resolve_login_identifier`, for old bookmarks and tests.
- **Remember me:**
  - **Form:** a checkbox, ticked by default, posts `remember=on`.
  - **Unticked:** the route sets a `hris-session-only=1` cookie, and the Supabase cookie writer (in the login route and in `src/proxy.ts`) drops `maxAge`/`expires`, so the auth cookies are session cookies.
  - **Ticked:** clears that cookie.
  - Logout clears it.
- **Confirmation link:**
  - `supabase/templates/confirmation.html` links to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&flow=signup`. The callback already calls `verifyOtp({ token_hash, type })`, so confirmation no longer depends on a PKCE code verifier in the same browser.
  - The link carries no `next`, because the remembered posting is stored at registration (§1.1). After a successful sign-up verification the callback goes to `/applicant`.
  - `config.toml` sets `[auth.email.template.confirmation]` with subject "Confirm Your Email Address" and the `content_path`.
- **Callback page:**
  - It also parses errors in the URL **hash** (`#error=…&error_code=otp_expired`).
  - For a sign-up flow (`flow=signup`, `type=signup` or `type=email`), an `otp_expired`/`access_denied` error redirects to `/login?as=applicant&message=email_confirmed_or_used`, which shows "Your email may already be confirmed. Try logging in." Email scanners often consume the one-time link first.
  - Invitation flows keep `invitation_expired`.
- **`/auth/continue` and the bare `/login` redirects:** keep `next` when redirecting to login. With `next` under `/applicant`, the redirect goes to `/login?as=applicant&next=…`, so the email link no longer lands on the employee login.

## 2. Applicant screens

Every screen copies its mockup's markup and classes. Sample data is replaced with real data; the copy text is the mockup's unless it states sample facts.

### 2.1 Shell (`src/components/app-shell/app-shell.tsx`, applicants and signed-in `/jobs`)

**Sidebar** (white, from `notifapp` `#sidebar`)
- Logo, "SAN JUAN CITY POLICE STATION", "Recruitment Division".
- "MENU" label, then items from `role-config.ts`: **Dashboard, Profile, Documents, Application Status**. The **Recruitment** entry is removed.
- The active item is the `bg-slate-900 text-white` pill.
- Footer: "PNP San Juan Recruitment Portal".
- The sidebar `SignOutButton` is removed.
- Mobile keeps the off-canvas behaviour with an overlay.

**Top bar** (`bg-slate-900`): mobile toggle, breadcrumb "Applicant › {page}", bell, account menu.

**Notification panel** (new `NotificationDrawer`, replacing the link in `notification-bell.tsx` for applicants)
- Bell with a red count badge.
- Floating panel: navy header "NOTIFICATIONS" with an "{n} Unread" pill and a close button; **All** / **Unread** tabs.
- Each item: coloured dot (unread = blue, read = slate), title, relative time, body, action link to the notification's `link` (label "View details"), mark-read ✓ and delete 🗑 icons.
- Footer: "Mark all as read" and a red "Clear all". Empty state: "No notifications available".
- Closes on outside click and on Escape. It is a focus-managed popover (keyboard and screen-reader accessible).

**Account menu**: initials avatar (from the full name), name and email, chevron. The dropdown holds **Profile** (→ `/applicant/profile`) and **Logout** (red; signs out as `SignOutButton` does today, then goes to `/`).

**Notices**: mount sonner `<Toaster position="top-right">` in `AppShell`, styled like the mockup's toast:
- dark `slate-900` card, rounded-xl, ring
- an emerald check icon for success, amber for warning, red for error
- a bold title and a small body line

### 2.2 Dashboard (`applicant-dashboard.tsx`, `notifapp` dashboard tab)

- "Welcome, {first name}!" and "Monitor your application progress and manage your documentary requirements for CY {year} Recruitment."

**Three summary cards**
1. **Latest application:**
   - "{POSTING TITLE} – CY {year}" eyebrow, the current stage name, and an emerald "n / 8" badge, linking to "View application status →".
   - Before submission: **Pending** and "0 / 8".
2. **Documents:** "{x} of 5", "Required documents uploaded and verified.", linking to "Manage documents →".
3. **Next Action Required** (amber border):
   - The stage title, then "Scheduled on **{date} ({time})** at {venue}." when set, otherwise the stage's standard message.
   - Links to "View Schedule Details →" (→ Application Status).
   - Before submission: "Upload your required documents", linking to Documents.

**Below the cards**
- **RECRUITMENT PROCESS** card with the 8 stages in two columns of four, from `PIPELINE_STAGES`.
- **LATEST APPLICATION PROGRESS** timeline:
  - each stage reached shows a green check and its completion date
  - the current stage is amber, with its message
  - upcoming stages are grey
- The Job openings card and the qualifications card are removed.

### 2.3 Profile (`applicant-profile-form.tsx`, `profile.html`)

**Header card**
- Dark gradient background.
- 2×2 photo ring with a camera upload button. The existing photo control is restyled; JPG/PNG only, max 5 MB.
- Full name.
- Red pill "Required: 2×2 ID Picture (Format: JPG or PNG only, Max 5 MB)" while no photo is set.
- **APPLICANT NUMBER** box: the formatted number, or "Pending".

**I. PERSONAL INFORMATION** (navy header with an icon chip and "* Required fields")
- The current fields, in the mockup's 3-column grid.
- Religion becomes a `<select>`: Roman Catholic, Islam, Iglesia ni Cristo (INC), Christian, Seventh-Day Adventist, Baptist, Jehovah's Witnesses, Others.
  - An existing value outside that list is rendered as an extra option and kept.
  - The schema accepts any trimmed text up to its current limit.

**II. EDUCATIONAL BACKGROUND**: four sub-cards with coloured icons:
- PRIMARY EDUCATION
- SECONDARY EDUCATION
- TERTIARY / BACHELOR'S DEGREE
- GRADUATE STUDIES / POST-GRADUATE DEGREE ("OPTIONAL" tag)

These map to the existing education fields.

**Save**: blue `bg-blue-600` button "Save Changes & Update Profile". On success, the notice "Profile Updated Successfully!" with "Your personal and academic details have been saved."

### 2.4 Documents (`applicant-profile-documents.tsx`, `documents.html`)

**Header**: dark header with the "REQUIREMENTS VERIFICATION" pill, "Required Documents" and the copy "Upload all required documents (up to 10 MB each). The 2×2 picture must be PNG or JPEG; all other documents must be PDF files." A **Status** box shows "{x} of 5" and an emerald progress bar.

**Cards**: 5 cards in two columns:
- CV / RESUME
- PSA BIRTH CERTIFICATE
- 2×2 ID PICTURE
- ELIGIBILITY CERTIFICATE
- COLLEGE DIPLOMA & TOR

Each card has:
- the title with a red *, and an emerald "✓ Saved" pill when on file
- the format line
- a file row: PDF or image icon, file name, "Saved {Month D, YYYY} • {size}", eye button opening a signed URL
- **Upload Document** / **Upload Photo** and red **Delete** buttons

**Delete**
- Uses `window.confirm("Are you sure you want to delete your uploaded {label}?")`, then the existing remove RPC.
- On success: notice "Document Deleted" with "{label} has been removed."
- On refusal (an application is in progress): an error notice with the server's message.

**Save button** at the bottom: behaves as in §1.1.

### 2.5 Application Status (`/applicant/applications`, `notifapp` tab 4)

**Main card** ("Application Status")
- **Amber banner:** bell icon, "Next Action Required: {stage}", and the schedule line ("Reporting time: {time} at {venue}.") or the stage's standard message.
- **REMARKS** heading with bullets of HR remarks for the current stage, newest last. When there are none, "No remarks from HR yet."

**Other states**
- **Pending** (no application): "Your application is pending. Upload all required documents and press Save to submit it.", linking to Documents.
- **Hired / Not Selected:** the final message in place of the banner, with the same card layout.

**Old routes**: `/applicant/applications/[applicationId]` redirects to `/applicant/applications`. `?jobId=` is handled as in §1.1.

### 2.6 Login and register

**`/login?as=applicant`** (`loginapp.html`): the split card from the mockup (5/7 columns, fixed 1024×620 on large screens).

*Left (form):*
- "APPLICANT PORTAL" pill, "Login as Applicant", and "Enter your registered email address below to access your application status and updates."
- Email Address, Password with show/hide, "Forgot password?", "Remember me on this device".
- Login button (`bg-slate-900 hover:bg-blue-900`).
- "Don't have an applicant account? **Sign up**" (keeps `next`).
- Footer: "San Juan City PNP Online Recruitment & Applicant Portal System".

*Right (dark hero):*
- Logo, "SAN JUAN CITY POLICE STATION", "EASTERN POLICE DISTRICT • NCRPO", and a pulsing "APPLICANT PORTAL" pill.
- "SERVICE • HONOR • JUSTICE" badge, "To Serve and Protect." and the welcome copy.
- **Recruitment Notice:** "Current Hiring Pool for **{newest published open posting title}** is now open for verified candidates.", or "There is no active recruitment at the moment. Please check back for new openings." Data comes from `listPublishedJobs`, fetched on the server.
- Footer: "© {year} San Juan City Police Station", **Privacy Policy** (opens the existing privacy notice dialog) and **Help Desk** (links to the public landing page's contact or footer section; an anchor id is added if missing).

*Behaviour:*
- Below `lg`, the card goes full width: the form first, then a shortened hero; the mockup's mobile logo header shows.
- Error and status messages (invalid credentials, email confirmed, `email_confirmed_or_used`, inactive account) render above the form in the mockup's input style.
- The employee login (`?as=employee`) is unchanged; the Employee PR redoes it from `emplogin.html`.

**`/applicant/register`**: no mockup. It gets the same split-card frame and hero with "Create Applicant Account", keeps its current fields and validation, and uses the mockup's input and button classes.

### 2.7 Confirmation email (`supabase/templates/confirmation.html`)

A copy of `email.html`:
- navy header with the logo (absolute URL `{{ .SiteURL }}/san-juan-police-logo.png`), "San Juan City Police Station" and "Online Recruitment & Applicant Portal"
- the greeting and body copy
- a "Your Registration Details" box with **Registered Email: {{ .Email }}** only; the applicant number line is removed
- the "Confirm Email & Activate Account" button, the fallback URL text and the ignore note
- the footer with the support address from the mockup

Inline styles only, as email clients require.

### 2.8 Unchanged

- Forgot and reset password.
- Public landing page and `/jobs` styling, except the "Apply now" routing in §1.1.
- Every HR, Employee and SysAd screen, except the two schedule inputs in §1.3.

## 3. Testing

- **TDD:** a failing test first for each behaviour.
- **Unit tests (Vitest + Testing Library):**
  - app-shell: four nav items; no sidebar sign-out; account menu with Profile and Logout
  - notification drawer: tabs, mark read, delete, mark all, clear all, empty state, Escape
  - dashboard: pending vs active vs scheduled cards
  - profile: Pending number; religion select keeping an unknown value; success notice
  - documents: the four Save outcomes; delete confirm and notice; refusal notice
  - application status: banner, remarks, pending, final states
  - login form: email field; Remember me
  - auth login route: email login; `remember` cookie
  - callback: hash errors; signup otp_expired → `email_confirmed_or_used`
  - continue route and login page: `next` preserved for `/applicant`
  - registration form: preferred job metadata; new copy
  - apply redirect route
- **Database (pgTAP in `supabase/tests/`):**
  - no number on registration
  - number assigned on passing Application Submission, and on moving to the Physical Agility Test
  - no reassignment for applicants who already have a number
  - formatting correct for sequence ≥ 100
  - `applicant_number_assigned` notification created
  - schedule fields stored with `scheduled` and cleared on status change
  - `delete_my_notification(s)` limited to the owner
  - `handle_new_user` stores a valid preferred job and ignores an invalid one
  - `set_my_preferred_job_opening` rejects unpublished postings
- **End-to-end (Playwright):**
  - update `capstone-objectives` (email login, submit via Documents Save, number appears after HR passes the first stage), `role-access` and `responsive-layout`
  - add `/login?as=applicant` to the visual baseline
  - regenerate the affected Linux PNGs with the Playwright container per the established procedure; commit the style JSON only for routes whose styles really changed
- **Before the PR:** `npm run lint`, `npm run typecheck`, `npm run test:run`, `npx supabase test db` and `npm run test:e2e` all pass.

## 4. Delivery

- One PR from `feat/capstone-ui-applicant` into `main`.
- **Manual steps in the PR description:**
  1. After merging and deploying, push the migrations to live Supabase.
  2. Paste `supabase/templates/confirmation.html` into Supabase Dashboard → Authentication → Email Templates → **Confirm signup**, with subject "Confirm Your Email Address".
  3. Confirm that the Site URL and redirect allow-list include `https://<prod-domain>/auth/callback**`.
- **After the PR:** hand the user a ready-to-paste prompt for **PR 2 (HR)**. It names:
  - the mockups (`sample.html`/`emplogin.html` HR login variants, `dashboard`, `jobpost`, `roster`, `dep`, `leave`, `promotions`, `attendance`, `reports`, `announcements`, `documents` where relevant)
  - PDF pages 16–37
  - the decisions already made, carried over from this PR
  - the open question on PDF p. 16 (keep the System Administrator login or relabel it "HR Admin Portal")
  - the branch, migration and visual-baseline rules
