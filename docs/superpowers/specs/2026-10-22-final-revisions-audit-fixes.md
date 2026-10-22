# Final Revisions PDF — audit fixes (2026-10-22)

PR #96 shipped only part of `Final Revisions .pdf`. An audit of `main` (1ecda59)
found most items missing or partial. This branch (`fix/final-revisions-audit`)
closes every gap. It also covers the client chat clarification about promotion.

## Client chat clarification (promotion)

- HR must no longer create or post promotion criteria. Remove the
  "Add Promotion Criteria" form entirely.
- The system automatically evaluates every active uniformed employee of any
  rank against the requirements for their **next** rank (e.g. PAT → PCPL).
  Qualified employees appear on the dashboard. HR only approves or rejects.
- Eligibility (e.g. NAPOLCOM, with its % rating) is still a required part of
  the criteria.
- Check every other tab too.

## Ground rules for all agents

- Forward-only migrations. PR #96 migrations are merged and may be live, so
  never edit an existing migration. Each workstream owns its own timestamp
  (below).
- Keep RLS, `security definer set search_path = ''`, revoke from
  public/anon, and audit_logs inserts, following the existing style.
- Dates display in words via `src/lib/format-date.ts`. English UI copy.
- Never create new roles.
- `src/lib/types/database.ts` is shared. Change it with small, targeted
  Edit calls. If an Edit fails because the file changed, re-read and retry.
- Do not run `supabase db reset`, `supabase test db` or Playwright; the
  lead runs them at the end. To check SQL, apply the migration inside a
  rolled-back transaction:
  `docker exec -i supabase_db_hris-capstone psql -U postgres -v ON_ERROR_STOP=1 -1 < file`
  wrapped in `begin; … rollback;`. Write or adjust pgTAP tests in
  `supabase/tests`.
- Run targeted `npx vitest run <files>`, `npx tsc --noEmit` and
  `npx eslint <files>` for the files you touch.
- Do not commit. The lead commits per workstream.

## Workstreams and migration timestamps

| WS | Area | Migration prefix |
|---|---|---|
| A | Deployment | `20261022100000` |
| B | Personnel, profile, eligibility, NUP | `20261022110000`–`20261022110900` |
| C | Leave | `20261022115000` |
| D | Promotion | `20261022120000`–`20261022120900` |
| E | Recruitment and attendance | `20261022140000`–`20261022140900` |
| F | Reports (after A and D) | `20261022150000` |

## Decisions (reasonable calls, listed for the user)

- Deployment task is stored on `deployments.task`. Each `deployments` row
  stays the per-employee assignment, and the group table is the shared
  header.
- HR cannot set Ongoing or Completed. The employee proposes the status with
  proof, HR approves or rejects it, and HR can only cancel.
- Event / operation is partitioned by type:
  - Public Assembly → Rally
  - Special Event → Fiesta / Major Event, Government Event
  - Election Security → Election Period
  - Disaster Response → Flood / Emergency
- NUP is the most junior rank (`sort_order` 0) and is listed first. NUP is
  non-uniformed, so it is not on the uniformed promotion ladder.
- Promotion approval records the decision and notifies the employee. It
  does not change the rank automatically (unchanged principle); HR updates
  the rank in the record.
- Required training per rank is used both for the next-rank promotion
  requirement and for the current-rank Training Needs report:
  - PAT → PSBRC
  - PCPL, PSSG → PSJLC
  - PMSG, PSMS, PCMS, PEMS → PSSLC
  - PLT → PSOBC
  - PCPT, PMAJ → PSOAC
  - PLTCOL, PCOL → PSOSEC
- Eligibility required for promotion: any recorded eligibility. Its rating is
  shown, not scored.
- Profile change requests are reviewed by HR. HR is notified when a request
  is submitted.
- Leave over the available credits: always allowed after the employee
  confirms "Would you like to proceed?". The excess days are recorded as
  deduction days.
- Attendance: 08:00 duty start, scans accepted from 05:00, and the existing
  grace setting is kept. Rows stored as late during the 05:00-start period
  are recomputed.
- Recruitment runs in two cycles per year: Cycle 1 (January–June) and
  Cycle 2 (July–December). Each opening belongs to the cycle of its opening
  date.
