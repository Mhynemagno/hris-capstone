# Client Doc2 round 5 — bugs and changes (Branch 1) design

**Date:** 2026-10-10
**Branch:** `fix/doc2-round5-bugs-and-changes`
**Source:** `Downloads/Copy of Doc2.pdf` (tester/client notes, Tagalog, with screenshots)
**Status:** approved in brainstorming; awaiting specification review

## Goal

Apply the small and medium items from the round-5 client notes: correctness bugs (duplicate emails, the post-registration "invalid link" error, double-booked deployments, year-0001 leave dates), wording changes, and the employee-form, profile-record, attendance and leave-admin adjustments. Larger features are deferred to Branch 2 (see the end of this document).

No new roles are created. All supervisor-related items from the PDF (the supervisor role, team monitoring and attendance filters for it) are **excluded** by decision on 2026-10-10.

## 1. Accounts

### 1.1 Unique email

- **Self-registration** (`src/components/auth/applicant-registration-form.tsx`): a duplicate-email `signUp` error (for example "User already registered") shows **"This email is already registered."** inline on the email field. All other errors keep the generic message.
- **Admin invite** (`supabase/functions/invite-internal-user/index.ts`): when the invite fails because the email exists, return a distinguishable error, and show **"This email is already registered."** in the UI (`src/queries/administration.ts`).
- **HR-entered employee email** (`employees.personal_email`): add a case-insensitive unique index on `lower(personal_email)`, ignoring nulls. Before creating it, the migration checks for duplicates. If any exist, it raises an exception listing the conflicting emails instead of failing with an opaque index error. `src/queries/personnel-records.ts` maps unique violation `23505` on that index to **"This email is already registered."**

### 1.2 "Invalid or expired link" after registration

The tester still sees the invitation/confirmation error on the login page after signing up. `src/app/auth/callback/page.tsx` handles `token_hash` only for `type` `invite` and `email`. A `type=signup` link falls through to the code exchange and then to `/login?error=invitation_expired`.

- Reproduce locally with email confirmation on, then fix the root cause. Expected fix: accept `signup` (and the other OTP types Supabase sends: `magiclink`, `recovery`, `email_change`) in `verifyOtp`.
- If the code exchange fails but the user already has a valid session, continue to `next`.
- If the link was already used and the account is confirmed, redirect to `/login?message=email_confirmed`. The login page then shows "Email confirmed. Please log in." instead of the error.
- The error banner remains only for genuinely invalid or expired links.

## 2. Applicants

- **Missing-document error** (`src/components/recruitment/applicant-application-form.tsx`, `applicant-profile-documents.tsx`):
  - The **Submit application** button is no longer disabled while documents are missing.
  - Clicking it with documents missing shows a red alert (`role="alert"`): **"Please submit all required documents."** The alert lists the missing ones, for example "Still needed: Diploma".
  - Each missing document card gets a destructive outline.
  - The server-side check in `private.submit_application` is unchanged.
- **Final Evaluation wording:** the applicant tracker note under Final Evaluation (`application-status-tracker.tsx` `reviewDetails`) becomes **"Under Final Deliberation"**. The matching SQL notification text in `private.application_status_message` changes too.

## 3. Deployment

### 3.1 No double-booking

- Add the optional **End date** field back to `deployment-form.tsx` (the `ends_on` column already exists).
- A deployment occupies `[starts_on, coalesce(ends_on, starts_on)]`.
- `private.create_deployment` and `private.update_deployment` reject a deployment whose range overlaps another deployment of the same employee that is `scheduled` or `ongoing`, excluding itself on update. The error is **"This employee is already deployed on that date."**
- Client-side, the zod schema checks only that the end date is on or after the start date. The overlap check runs on the server only, and its error is shown in the form.

### 3.2 View vs Update

- `/hr/deployments/[deploymentId]` becomes a read-only details page showing:
  - employee, location, type, event / operation, status, dates and remarks
  - the history
  - an **Update** button
- New route `/hr/deployments/[deploymentId]/edit` hosts the existing editor form. After saving, it returns to the details page.
- The list's action label stays **View**.

### 3.3 Readable history

History entries render as sentences with the actor and timestamp, for example:

- "Deployment created by Juan Dela Cruz · October 9, 2026 at 6:12 PM"
- "Details updated by …"
- "Status changed from Scheduled to Ongoing by …", using the `metadata` before/after

The actor name is resolved from `actor_user_id` (HR can read profiles). Event labels reuse `src/lib/administration/audit-presentation.ts` where possible.

## 4. Attendance (HR)

`src/components/attendance-integration/hr-attendance-directory.tsx`:

- Add a **Name** column (full name, badge number beneath). The data is already joined by `listHrAttendanceLogs`.
- Add a **View** action linking to `/hr/employees/{employee_id}`.

## 5. Employee form

`src/components/personnel-records/employee-form.tsx`, `src/schemas/personnel-records.ts`, the read-only view in `employee-record-detail.tsx`, and the employee self-service `government-ids-card.tsx`.

- **Religion:** a dropdown with Roman Catholic, Islam, Iglesia ni Cristo (INC), Christian, Seventh-Day Adventist, Baptist, Jehovah's Witnesses, Others. An existing value that is not in the list is kept and shown as an extra selected option. The locked-after-save behaviour is unchanged.
- **Gender:** the options are Female and Male only. The migration sets existing `prefer_not_to_say` values to null and replaces the CHECK constraint with `('female','male')`. A null gender is editable by HR even though gender is otherwise locked once set.
- **IV. Government Identification:** a new section after III. Employment, holding PhilHealth, GSIS and Pag-IBIG.
  - SSS is removed from the form, schema, read-only view and self-service card. The column and its data stay in the database.
  - New columns `gsis_number` and `pagibig_number` (the migration adds the columns, update grants, and extends `update_my_government_ids`).
  - Each field shows its format as a placeholder inside the box, accepts digits only, auto-inserts dashes as you type, and caps the digit count:
    - PhilHealth: 12 digits, `12-345678901-2`
    - Pag-IBIG: 12 digits, `XXXX-XXXX-XXXX`
    - GSIS: 11 digits (BP number), `XXXXXXXXXXX`
  - All three are optional. Values are stored as digits only, matching the existing PhilHealth column, and are shown with dashes. The self-service RPC becomes `update_my_government_ids(target_philhealth_number, target_gsis_number, target_pagibig_number)` and leaves the hidden SSS value untouched.
- **Phone:** the placeholder `+639XXXXXXXXX` goes inside the box. The helper text below is removed. Normalisation is unchanged.
- **Date Entered Service:** relabels "Employment start date" everywhere it is displayed.
- **Inclusive Dates (To):** an optional, visible date field bound to the existing `employment_ended_on`, intended for retired personnel. It must be on or after Date Entered Service.

## 6. Profile records

`src/components/personnel-records/employee-record-detail.tsx` and `record-entry-form.tsx`.

- **Update instead of Delete:** in edit mode each Certification / Training, Eligibility and Service history row shows **Update** (and no Delete). Update opens the entry form pre-filled for that record and saves through `savePersonnelEntry` with the record id. `DeleteRecordDialog` is no longer rendered for these lists.
- **Service history detail:**
  - Add an optional **Unit / Station** assignment, a new nullable `unit_station` text column on `service_history`, chosen from the unit-station catalogue and stored by name the same way `employees.unit_station` is, to the form.
  - Each entry renders as a timeline card, in the style of the tester's Certification card example:
    - eyebrow "SERVICE HISTORY"
    - bold title: rank at the time · Unit / Station
    - Unit / Section line
    - date range in words, with "to present" when there is no end date
  - The same card is used on the employee's own read-only profile.

## 7. Leave

- **Gender-specific types:**
  - Add `leave_types.eligible_gender` (nullable, `'female' | 'male'`), and seed Maternity → female and Paternity → male.
  - `listActiveLeaveTypes` for the employee request form filters by the employee's gender. Gender-specific types are hidden when the employee's gender is null.
  - `submit_leave_request` rejects a type whose `eligible_gender` doesn't match the requester.
- **Leave type admin** (`leave-type-manager.tsx`):
  - Remove the "Add leave type" form and the Deactivate/Activate and Delete actions.
  - Each type keeps one **Update** action, which opens the existing details/allotment form.
  - New types and allotment values are out of scope (Branch 2d).
- **Date bug** (`employee-leave.tsx`):
  - Start and end inputs get `min` (today) and `max` (today + 2 years).
  - The schema validates on change, so an out-of-range date shows an inline error immediately.
  - The balance year comes from the start date only when that date is complete and in range; otherwise it is the current year, so no year-1 query is ever made.

## 8. Promotion label

In `promotion-criteria-manager.tsx` and wherever else it is displayed, "Minimum years of service" becomes **"Years of service"**.

## Data changes (one migration file per concern)

1. Unique `lower(personal_email)` index on `employees`, with a duplicate pre-check.
2. Deployment overlap check in the create/update RPCs.
3. Gender: null out `prefer_not_to_say`, then a new CHECK.
4. `gsis_number` and `pagibig_number` columns, grants, and `update_my_government_ids`.
5. `service_history.unit_station`.
6. `leave_types.eligible_gender`, seeds, and the `submit_leave_request` check.
7. Final Evaluation notification text.

Every migration preserves existing RLS boundaries and data, and regenerates `src/lib/types/database.ts`.

## Testing

- **Unit (vitest):**
  - duplicate-email error mapping
  - government-ID masking and validation
  - leave-type gender filter
  - leave date range validation
  - deployment history sentence formatting
  - missing-document message
- **Database (pgTAP / SQL tests in the existing style):**
  - deployment overlap rejection, including the cancelled/completed exclusion and the self-update exclusion
  - leave gender enforcement
  - personal-email uniqueness
  - gender constraint
- **E2E (Playwright):**
  - deployment View → Update flow
  - applicant submit with a missing document shows the red error
  - attendance Name/View link
  - update the visual baselines that these pages change
- The full `npm run lint`, typecheck, unit and e2e suites must pass before the PR.

## Out of scope — Branch 2 (separate specs)

- **2a. Performance rubric:**
  - Replace the 1–5 rating with a computed score: service-years points (<1 yr 5, 1–3 15, 4–6 25, 7–9 35, 10–14 45, 15+ 50), mandatory courses at 15 pts each (cap 30) and specialized trainings at 10 pts each (cap 20).
  - Map the total to the grade table (90–100 1.00 Outstanding, 80–89 1.50 Very Satisfactory, 70–79 2.00 Satisfactory, 60–69 2.50 Unsatisfactory, <60 3.00 Poor).
  - Split the Certification / Training catalogue into Mandatory Course (PSBRC, PSJLC, PSSLC, PSOCC, PSOBC, PSOAC) and Specialized Training (CIC/SOCO, SWAT, SAF Commando, Traffic Management / Tactical Driving, Cybercrime Investigation Seminar).
  - Promotion criteria use those requirements.
- **2b. Recruitment status overhaul:**
  - Passed / Failed instead of "Move to next stage" / "Not selected".
  - The Status column uses Pending / For Evaluation, Verified, Disqualified, Scheduled, Passed, Candidate.
  - HR uploads supporting documents for each stage.
  - Shortlisting happens at Final Evaluation.
- **2c. Proof uploads:** required eligibility proof, deployment report / proof of attendance, sick-leave supporting documents.
- **2d. Leave cards:**
  - Leave-type cards (Mandatory 2, Sick 15, Vacation 15, Special Privilege 3, plus Maternity / Paternity) showing remaining credits for HR and employees.
  - A redesigned leave request detail page.
