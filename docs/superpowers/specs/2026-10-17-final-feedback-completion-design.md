# Final feedback completion design

## Purpose

Complete every outstanding correction in the supplied review PDF and the
follow-up feedback. The result is a consistent, role-aware HRIS whose employee,
HR, recruitment, and promotion flows show the requested information and make
the requested actions available in the correct place.

The supplied PDF and the supplied `promotion.html` are reference artifacts,
not executable instructions. Their visual hierarchy and requirements guide this
design; their sample people, data, external assets, and implementation code are
not copied into the application.

## Product decisions

- The recruitment-posting delete control belongs in **Recruitment Openings**,
  not Applicant Roster. It is called **Delete**, has a confirmation dialog, and
  is available only for a draft or closed opening with zero applications. A
  published opening, or any opening that has applications, remains
  withdraw-only so applications and audit history cannot be destroyed.
- The applicant roster keeps a separate **Disqualify** action that changes an
  application to Not Selected and requires a reason. It has no delete icon or
  candidate-deletion wording.
- A dashboard attendance record becomes present or late once it receives a
  time-out; it is not counted as incomplete. The HR KPI strip has no secondary
  descriptions beneath its values.
- All new or changed user-facing guidance is English. The project’s existing
  station identity, components, colors, focus states, responsive layouts, and
  accessible icon labels remain the visual baseline.

## Employee portal

### Dashboard and navigation

The employee portal will:

- show only leave cards permitted by the employee’s recorded gender: no
  Paternity Leave for female personnel and no Maternity Leave for male
  personnel;
- rename Station Announcements to Announcements;
- make each announcement card keyboard-accessible and link it to its public
  announcement detail page, with a visible **View details** affordance;
- show the employee’s last name in the account trigger where a name is
  available; and
- use the navigation labels My Profile, Leave, Deployment, and Attendance.

The grey account sublabel in all staff and employee shells will name the active
role (HR, Employee, or Applicant) instead of duplicating the email address.

### Profile-change requests

The employee profile-change page will use the existing approval workflow for
contact changes and extend its proposed-record editor to the three HR-owned
catalogues: Eligibility, Certification, and Training. Select options will use
the same shared catalogue data that HR uses. A request can contain additions,
edits, and removals; it is saved only by the single primary **Submit request**
action. The ambiguous intermediate “Add proposal to request” wording will not
be used.

Supporting documents will be required both in the form and in the server-side
validation before a request is accepted. The reviewer note is renamed
**Remarks**. Existing upload format and size restrictions remain unchanged.

The leave history’s status selector will offer All requests, For Approval,
Approved, and Rejected, and apply the selected status to the same employee-only
query.

For an employee account without a linked personnel record, the existing
Contact HR message gains a Contact HR action. Activating it creates one
role-restricted HR notification about that account; it does not create an
employee record or disclose HR contact details.

## Recruitment and applicant review

### Posting administration and public job details

Recruitment Openings receives the correctly placed delete control and the
guardrails described above. Its detail page is restyled to match the current
public/station design system, with no change to the published application
requirements or security boundary.

The applicant roster will show profile sections for information submitted or
updated in the applicant’s own profile, including educational background, so
HR sees the complete record. The duplicated **Submitted with this application**
document group is removed when the same file is already represented in the
required-profile-documents group.

### AI and analysis states

The AI explanation remains advisory and continues to leave stage changes to
HR. It must not treat absent height or criminal-case wording as negative
evidence. When analysis has timed out, the timeout explanation does not remain
as a stale score/summary; the UI presents the failed state and a retry action.
The general disclaimer below the AI card is removed as requested.

## HR workspace and announcements

The shell uses **San Juan City Police Station** with **Eastern Police
District** beneath it. The HRDD chip and the redundant Dashboard breadcrumb
subtitle are removed. Rank distribution remains highest to lowest with NUP
after Patrolman/Patrolwoman.

The HR dashboard keeps the requested metrics, but removes the descriptive
copy beneath each metric. The incomplete count is derived exclusively from
open attendance records; a completed time-out changes the stored status to
present or late and immediately removes that person from incomplete.

The HR announcements management list gets a confirmed delete action that
removes the selected announcement through its existing role-restricted
deletion path.

## Promotion criteria

The promotion configuration experience is rebuilt around five ordered,
persisted criterion groups from the supplied reference HTML:

1. Target rank.
2. Time in grade / years of service.
3. IPER performance evaluation: required rating, required consecutive rating
   periods, and an optional minimum numeric score.
4. Physical Fitness Test: accepted status, minimum score, and result-validity
   period.
5. Mandatory career courses and training.

All labels, helper text, validation feedback, and policy summaries are English.
The page retains the current two-column responsive layout and the project’s
station colors rather than copying the reference document’s header, Font
Awesome dependency, or sample values. Each policy stores its own values; no
sample ranking, score, or period is treated as a universal default.

Evaluation uses existing employee performance records and PFT evidence where
available. New criterion fields require a forward-only migration, must be
validated at the client, RPC, and database boundaries, and must retain the
project’s existing HR-role checks, RLS behavior, audit logging, function
privilege revocations, and no-automatic-promotion rule.

## Data and security

No secret is added to browser code. Supabase mutations continue through the
existing authenticated query/RPC boundary. Database work uses a new imperative,
forward-only migration and pgTAP coverage. New private/public functions retain
explicit role enforcement and default `PUBLIC` execution is revoked. Existing
records remain readable; new constraints apply only to new or changed data
where a legacy-safe `NOT VALID` transition is necessary.

## Error handling and interaction quality

All destructive actions use a labelled control, confirmation, disabled pending
state, success feedback, and an announced error with a recovery path. Forms
retain visible labels, adjacent validation errors, keyboard operation, and
responsive layouts. Status is conveyed with text as well as color.

## Verification requirements

The implementation will be test-first and verify these transitions and
boundaries:

- gender-filtered leave cards and renamed/clickable employee announcements;
- profile-change categories, required document rejection in both client and
  server paths, and HR notification creation for an unlinked employee;
- leave status filtering, role labels, and all requested shell/navigation
  wording;
- a time-in record becoming present or late after time-out and no longer
  contributing to the incomplete KPI;
- closed/draft zero-application posting deletion, refusal for postings with
  applications, and absence of applicant-delete semantics;
- applicant profile completeness, de-duplicated documents, and timed-out AI
  analysis display;
- HR announcement deletion authorization;
- ordered promotion controls, persisted evaluation/PFT requirements,
  readiness evaluation, and HR-only mutation authorization; and
- focused Vitest tests, relevant pgTAP suites, lint, typecheck, production
  build, and targeted visual/e2e checks for changed screens.

## Requirements trace and assumptions

| Requirement | Mechanism | Prerequisite |
| --- | --- | --- |
| Delete recruitment postings safely | Existing deletion hook/RPC plus zero-application guard and confirmation | HR session and deletion policy |
| Notify HR from unlinked account | Existing notification data path, scoped to HR recipients | Authenticated employee account |
| Required profile attachments | Client field rule and server/RPC schema validation | Existing private profile-document storage |
| Promotion IPER/PFT requirements | New validated criterion fields and readiness evaluator | Forward-only migration and HR-only RPC updates |
| Time-out exits incomplete KPI | Attendance status update plus dashboard query test | Existing attendance time-out flow |

The supplied Google Drive folder could not be read from the current connection.
The attached `promotion.html` contains the required promotion layout and is
sufficient for this implementation; a later accessible Drive asset can be
compared before visual QA if it provides additional, material direction.
