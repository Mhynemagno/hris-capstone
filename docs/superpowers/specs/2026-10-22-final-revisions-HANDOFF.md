# HANDOFF: Final Revisions audit fixes (for Codex)

- **Repo:** `C:\Users\ASUS\hris-capstone`
- **Branch:** `fix/final-revisions-audit`, off `main` at 1ecda59, which is after PR #96.
- **State:** everything is uncommitted. Read
  `docs/superpowers/specs/2026-10-22-final-revisions-audit-fixes.md` first. It
  has the client requirements, ground rules and decisions.
- **Source of truth:** `C:\Users\ASUS\Downloads\Final Revisions .pdf` plus the
  client chat. The chat says HR must not create promotion criteria. The system
  auto-evaluates every rank against the next rank, eligibility (with % rating)
  is required, and HR only approves or rejects.

## Status per workstream

| WS | Area | Status |
|---|---|---|
| A | Deployment | DONE and verified (pgTAP, vitest, eslint) |
| C | Leave | DONE and verified |
| B | Personnel, profile, eligibility, NUP | STOPPED mid-way, before typecheck and tests |
| D | Promotion auto-evaluation | STOPPED mid-way; was updating `employee-dashboard` and `hr-dashboard-overview` |
| E | Recruitment and attendance | STOPPED mid-way |
| F | Reports | NOT STARTED |

### A. Deployment (done)
- Migration: `supabase/migrations/20261022100000_deployment_status_approval_and_task.sql`.
- Data: `deployments.task`, `proposed_status`, `deployment_group_id`.
- RPCs: `update_deployment_details`, `cancel_deployment`,
  `propose_deployment_status` and `review_deployment_status`. The old
  `create_deployment` and `update_deployment` are revoked.
- Event/type rule is partitioned.
- UI:
  - HR list: Rank, Name, Badge Number, Task, Location, Status, Actions.
  - "Deployment Types" filter.
  - Picker filters for rank, unit and on-leave.
  - Remarks removed; HR can only cancel.
  - The employee proposes a status, HR approves or rejects.

### C. Leave (done)
- Migration: `20261022115000_leave_excess_confirmation.sql`.
  `submit_leave_request` gains a 7th argument, `target_accept_deduction`.
- Employee sees the "Not Enough Leave Credits … Would you like to proceed?"
  Yes/No dialog.
- HR queue columns: Rank, Name, Leave Type, Status, Actions.
- Details modal: Badge Number, day-count pill, Close, Remarks.
- Follow-up: the `excess_deducted_from_retirement` leave-type setting and its
  label are now misleading. Consider removing them.

### B. Personnel / Profile (verify and finish)
Migrations already written:
- `20261022110000_nup_rank_first.sql` (NUP `sort_order` 0)
- `20261022110100_qualification_rating.sql` (`qualifications.rating` 0–100)
- `20261022110200_profile_change_personal_fields_hr_review.sql`
- `20261022110300_employee_time_in_grade.sql`

New files: `src/app/(app)/hr/profile-requests/`,
`src/lib/personnel/eligibility.ts`,
`supabase/tests/final_revisions_personnel.test.sql`.

Check each requirement:
1. Directory filter label is "Status", with options All / Active / Retired.
2. The Delete icon is removed from personnel rows.
3. NUP is listed first in every rank dropdown.
4. All "This cannot be changed once saved" notes are removed
   (`grep -r "cannot be changed" src`).
5. The employee can request edits to ALL HR-entered fields: ID/badge number,
   names, qualifier, birth place and date, gender, civil status, religion,
   address, emergency relationship, SSS/PhilHealth/GSIS/Pag-IBIG, date entered
   service.
   - HR reviews the request (new HR route plus nav item), and HR is notified
     on submit.
6. Eligibility rating % is shown in the HR form, both profiles, and the change
   request and its review.
7. Time-In-Grade appears in the HR record header and the employee profile.

### D. Promotion (verify and finish)
- Migration: `20261022120000_promotion_auto_evaluation.sql`. Check it applies.
  It is meant to add:
  - `promotion_rank_requirements`, seeded and read-only
  - `promotion_decisions`
  - an automatic evaluation function
  - `list_promotion_candidates_page`, `decide_promotion` and the employee
    status RPC
  - HR IPER and PFT recording
  - revoked criteria-creation RPCs
- Criteria manager, review modal, docket modal and the performance rubric
  were deleted. New components: `promotion-checklist`,
  `promotion-decision-dialog`, `promotion-details-modal` and
  `record-iper-pft-dialog`. The last one had tsc errors when stopped.
- Must end with:
  - No HR criteria UI anywhere.
  - Dashboard columns: Rank, Name, Target Rank, Status (For approval /
    Approved / Rejected), Actions (View / Approve / Reject).
  - Every active uniformed employee (not NUP) is evaluated against their next
    rank automatically.
  - Eligibility is a requirement.
  - The decision shows on the employee Promotion page and is sent as a
    notification.
  - The official policy matrix stays as a read-only reference, with an
    Eligibility row added.
- Check that the `employee-dashboard` and `hr-dashboard-overview` references to
  the removed promotion hooks compile.
- Update the e2e specs `capstone-objectives.spec.ts` (~377-411, criteria flow)
  and `iso25010-quality.spec.ts:32`.

### E. Recruitment / Attendance (verify and finish)
Migrations:
- `20261022140000_recruitment_cycles_and_applicant_resubmission.sql`
- `20261022140100_attendance_late_recompute_and_face_window.sql`

New files: `applicant-account-actions.tsx`, `src/lib/recruitment/recruitment-cycle.ts`.

Check each requirement:
1. HR can reactivate an applicant account, send new credentials (password
   reset email), and reopen a Not Selected application for resubmission.
2. There are two recruitment cycles per year: Cycle 1 (Jan–Jun) and
   Cycle 2 (Jul–Dec). The cycle shows in the HR job form and list and on the
   public careers pages, and `closes_on` must fall within the cycle.
3. Stored "late" attendance rows from the 05:00-start period are recomputed
   with the 08:00 rule, so 07:38 is not late.
4. Face scans before 05:00 are rejected.
5. Times show as "07:38 AM" (24-hour digits plus AM/PM) in the HR table,
   employee list, modal and kiosk.
6. An open late log shows Late, consistent with the dashboard.

**Review these unexpected changes from agent E before keeping them:**
`supabase/config.toml`, `supabase/templates/confirmation.html`, new
`supabase/templates/recovery.html`, and
`supabase/tests/badge_login_personnel_roles.test.sql`.

### F. Reports (not started; do after B, D and E)
Files: `src/lib/reporting/pdf.ts`, `src/app/api/reports/[reportKey]/route.ts`,
`src/components/reporting/*`, `src/schemas/reporting.ts`. The `get_hr_report`
and `get_management_report` functions were last defined in
`20260924110000_ranks_catalogue.sql`; add a new migration, `20261022150000_*`.

PDF output:
- Header on three lines: "Republic of the Philippines" / "Philippine National
  Police" / "San Juan City Police Station", then the report TITLE.
- Portrait, with a real table layout instead of "Label: value" lines.
- Fix `ascii()`, which turns "•", "—" and U+202F into "?".
- Remove "Direct Print View" (`window.print`); the downloadable PDF replaces it.
- Pass the status, leave-type and other filters through `route.ts`.

Split and reshape the reports:

| Report | Columns and filters |
|---|---|
| Deployments | Rank, Name, Badge Number, Task (`deployments.task`) |
| Employee Performance | Rank, Name, Badge Number, IPER Status (adjectival only, no numeric rating), PFT (Passed/Failed). Uses WS-D tables. |
| Training Needs | Employees missing the required training for their CURRENT rank, naming the course (PAT→PSBRC, PCPL/PSSG→PSJLC, PMSG–PEMS→PSSLC, PLT→PSOBC, PCPT/PMAJ→PSOAC, PLTCOL/PCOL→PSOSEC) |
| Promotion Evaluation | The dashboard rows (Rank, Name, Target Rank, Status) with a status filter |
| Attendance | Separate report, with filters |
| Leave | Separate report, with a leave-type filter (e.g. Mandatory Leave only) and status |

Keep the other existing reports (applicant tracking, hiring decisions,
masterlist). Personnel agent B left the "Employment status" label in
`report-detail.tsx`; rename it to "Status" and add the Retired option.

## Finish checklist
1. `npx supabase db reset`, then `npx supabase test db`. Fix any failures; all
   new migrations must apply in timestamp order.
2. Run `npx tsc --noEmit`, `npm run lint`, `npx vitest run` and `npm run build`.
3. Run the e2e specs affected by the changed UI. See
   `~/.claude/projects/C--Users-ASUS-hris-capstone/memory/visual-baseline-regeneration.md`
   for the local e2e setup.
4. Commit per area (deployment, leave, personnel, promotion,
   recruitment/attendance, reports), push, and open a PR to `main`.
   - Do NOT push migrations to live Supabase until the user has merged and
     deployed.
