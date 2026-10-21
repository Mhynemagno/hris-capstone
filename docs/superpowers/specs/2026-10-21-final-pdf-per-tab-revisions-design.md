# Final PDF per-tab revisions design

## Purpose

Implement every functional correction in the supplied final-revisions PDF as
separate, role-appropriate modules in the existing HRIS tabs. The result must
preserve personnel, applicant, deployment, and audit history; no requested
workflow may depend on a destructive record deletion.

The PDF is a requirements artifact, not executable code. Its final three
pages are the governing source for promotion scoring policies by rank band:
PLT-PLTCOL, PSMS-PEMS, and PCPL-PMSG.

## Cross-cutting decisions

- Keep existing English product copy and station visual system. Translate the
  intent of Filipino feedback; do not expose mixed-language UI.
- Use additive, forward-only Supabase migrations and keep the existing RLS,
  explicit role checks, audit logging, and revoked default function privileges.
- Keep each concern in its existing tab. Shared data is exposed through typed
  queries/RPCs rather than duplicated client-side business rules.
- Employees may submit evidence and proposed changes only for their own
  records. HR reviews and approves those submissions; the system never
  automatically changes rank or payroll.

## Deployment tab

Replace the one-employee deployment shape with a deployment header plus
per-employee assignments. The header owns the location, dates, deployment
type, and the event/operation selection. The assignment owns employee,
task, status, evidence, and review state. A person may not be selected twice
for one header or while on approved leave or an overlapping assignment.

The creation picker supports multiple choices. Selected employees move into a
visible assignment list and no longer appear as available options. Available
people can be filtered by rank, department/unit, and an on-leave option.
Task is required per assignment and is one of `Deployed` or
`Reserve/Standby`; the legacy remarks/instructions input is removed. Selecting
the `Public Assembly` deployment type restricts event/operation choices to
applicable public-assembly events.

The HR list is renamed and reshaped around Rank, Name, Badge Number, Task,
and individual status; its type filter reads `Deployment Types`. Employees
upload their own report or photo evidence and propose completion state. HR can
review and approve that proposal and can cancel an assignment, but does not
upload employee proof or directly mark an assignment completed. Deployment
history is removed from the on-screen detail experience.

## Employee, profile, and leave tabs

Personnel employment status has only Active and Retired values. Employee
records are archived/deactivated under the existing safe retention workflow;
there is no delete icon for personnel data. Rank ordering places NUP directly
above PAT wherever the personnel list presents this sequence.

All HR-entered profile values become reviewable through the existing
employee-request/HR-approval flow. The employee can submit corrections with
supporting evidence; HR applies approved values. Permanent-warning text such
as "cannot be changed once saved" is removed and system-managed values stay
visibly read-only instead. Eligibility supports zero or more records, each
with its own name and percentage rating for promotion assessment.

When a leave request exceeds available credits, the employee sees the actual
excess days and an explicit Proceed/Cancel confirmation before submission.
Proceeding records the excess as deduction-eligible for HR review; it does not
claim to complete an external payroll deduction. Leave tables show Rank,
Name, Leave Type, Status, and Actions. Details use Badge Number, show inclusive
dates and total days together, use `Close`, remove historical-record content,
and rename HR Processing Notes to Remarks.

## Promotion tab

The dashboard is a system-generated readiness queue with Rank, Name, Target
Rank, Status (For Approval, Approved, Rejected), and Actions. It derives
candidates from active employees' approved personnel, training/seminar,
eligibility, IPER, and PFT evidence. HR can approve/reject evidence and record
the supervisor-provided individual performance result; it cannot manually
post an ad-hoc candidate criterion or automatically promote a person.

Persist official rank-band policies from the PDF, including time-in-grade,
assignment diversity, awards/recognition, IPER, interview/competence, and
service reputation. The evaluator calculates points and missing requirements
per target rank, then queues qualifying employees for HR action. Existing
criteria are migrated compatibly where possible; policy/evaluation changes
remain HR-only and auditable.

## Audit and reports tab

Reports become downloadable, formal portrait PDFs rather than browser-print
views. Each document carries the Republic of the Philippines, Philippine
National Police, and San Juan City Police Station heading, followed by its
report title and a readable, portrait table.

Keep the existing audit/report scope but split outputs and filters for:

- Deployments (Rank, Name, Badge Number, Task);
- Employee Performance (IPER status and PFT pass/fail, not raw ratings);
- Training Needs (specific missing training/seminar for current rank);
- Promotion Evaluation (the dashboard outcome, with filters);
- Attendance; and
- Leave (including mandatory-leave filtering).

## Recruitment and attendance tabs

Every applicant receives and retains a unique applicant number whether or not
documents are submitted or the applicant is qualified. Disqualified records
remain recoverable. HR can reactivate an applicant account or issue new
credentials when a resubmission is needed. Recruitment is represented as two
opening windows per calendar year while preserving the applications and
openings belonging to prior windows.

Attendance records show worked duration, AM/PM context where useful, and
24-hour timestamps. The attendance window opens at 05:00, while the scheduled
duty start remains 08:00. A scan before 08:00 is not late; the 05:00 window
does not redefine the shift start. Late calculation stays server-side and
timezone-safe.

## Error handling, security, and verification

All mutations retain pending, success, validation, and recoverable-error
states. Server-side checks repeat client restrictions for leave excess,
deployment availability, employee ownership, status review, promotion policy,
and recruitment-cycle limits. PDF download routes require the same authorized
data access as their source tab and do not expose signed storage URLs broadly.

Tests cover at least multiple deployment assignments and exclusion filters,
employee evidence/review permissions, profile correction approval, excess
leave confirmation, NUP ordering, multi-eligibility ratings, rank-band
promotion calculation and HR-only outcomes, report PDF headings/portrait
output, applicant-number retention/reactivation, and early-scan/late-time
separation. Run targeted Vitest and pgTAP tests, followed by lint, typecheck,
production build, and focused Playwright checks before opening the PR.
