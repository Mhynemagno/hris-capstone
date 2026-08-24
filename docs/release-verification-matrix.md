# Release verification matrix

This file records executed evidence, not hoped-for behavior. `blocked-external` means the project owner must complete the listed action before production turnover.

| ID | Intended behavior | Authorized / denied roles | Evidence | Status |
| --- | --- | --- | --- | --- |
| REL-01 | HR dashboard loads the reporting summary RPC. | HR / all other roles by role check | Remote migration history reconciled; `20260823220009_dashboards_and_reports` applied; remote function inventory shows the four public reporting RPCs with date arguments. | passed-schema |
| REL-02 | Management can read reports but cannot mutate operations. | Management / Applicant, Employee, Admin | `supabase/tests/dashboards_and_reports.test.sql` passed after clean local reset; route guards and reporting RPC tests. | passed-automated |
| REL-03 | HR can create the first personnel record from an active unlinked Employee account, with identity fields prefilled. | HR / Admin, Management, Applicant, Employee, anon | `supabase/tests/quality_release_employee_account_linking.test.sql`; component and query tests; remote `list_unlinked_employee_accounts()` grant only to `authenticated`. | passed-local-and-deployed |
| REL-04 | Employee requests profile change; Administrator decides; audit and notification are created. | Employee + Administrator / other roles | `supabase/tests/profile_change_approval.test.sql` passed after clean local reset; manual local journey remains to record. | passed-automated |
| REL-05 | Applicant applies; HR reviews AI guidance and makes final decision. | Applicant + HR / AI never decides | `supabase/tests/recruitment_and_applicant_portal.test.sql` and score-function tests passed; manual local journey remains to record. | passed-automated |
| REL-06 | Employee submits leave; HR decides; employee receives notification. | Employee + HR / others | `supabase/tests/leave_management.test.sql` passed after clean local reset; manual local journey remains to record. | passed-automated |
| REL-07 | HR imports normalized attendance without raw biometrics; unknown IDs queue for review. | HR / other roles | `supabase/tests/attendance_integration.test.sql` and adapter/function tests passed; manual local import remains to record. | passed-automated |
| REL-08 | All sensitive tables and private Storage objects have regression coverage. | least privilege | All 11 `supabase/tests/*.test.sql` suites passed after `db reset --local --no-seed`. | passed-automated |
| REL-09 | Production Vercel deployment serves the current commit with Supabase public variables and auth redirect URL. | project owner | Follow [deployment runbook](DEPLOYMENT_RUNBOOK.md). | blocked-external |
| REL-10 | Signed-out visitors see only public SJCP recruitment content, including published job openings and application entry points. | public / unpublished jobs and all HR data denied | Component tests cover landing, featured opening, empty state, and existing job-detail routes; signed-in visual journey remains to record. | passed-automated / pending-manual |
| REL-11 | Every authenticated workspace exposes a header account control and explicit Sign out action, independent of sidebar state. | all authenticated roles / anonymous | Account-menu keyboard interaction and shared-shell tests pass; narrow/desktop visual check remains to record. | passed-automated / pending-manual |

## Findings register

| Finding | Reproduction / root cause | Resolution / evidence | State |
| --- | --- | --- | --- |
| REL-F01 Dashboard RPC missing from PostgREST schema cache | Remote project had module tables but no reporting migration/RPCs; its three prior migrations used timestamp-drifted yet content-equivalent history entries. | Verified SQL fingerprints, repaired only those history entries, dry-ran then applied dashboards migration. Remote inventory now lists all four private/public reporting functions. | resolved |
| REL-F02 HR could not create a personnel record from an existing Employee account | Directory queried only `public.employees`, excluding accounts with no official record; form had no account binding/prefill path. | Added protected candidate RPC, HR picker, prefilled form, and query invalidation. Local pgTAP and component tests pass; migration deployed. | resolved |

## Manual certification procedure

1. Reset the local database with `npx supabase@latest db reset --local --sql-paths ./seed.sql` and start the application with `npm run dev`. Automated pgTAP checks instead use `--no-seed` so their isolated row-count assertions remain valid.
2. Sign in using the fictitious `demo.*@example.test` accounts and the local-only seed password documented in `supabase/seed.sql`.
3. Execute REL-03 first: as HR, open `/hr/employees`, choose **Create record** for **Awaiting Record**, complete the remaining official fields, save, and confirm the account leaves the candidate list.
4. Execute REL-04 through REL-07 with their feature-specific test fixture data. For every role, also enter one prohibited route directly and confirm `/unauthorized` or an RLS failure.
5. At desktop and narrow widths, check every table/form for visible labels, keyboard focus, error/empty states, and horizontal table scrolling rather than viewport overflow.
6. Enter outcome, date, tested commit, and any failure in this matrix before calling the release ready.
7. As a signed-out visitor, check `/` and `/jobs`: only published openings are visible, an opening reaches `/jobs/:id`, and account creation/application routes remain clear. At 375px, 768px, 1024px, and 1440px, confirm there is no viewport overflow.
8. As each signed-in role, collapse/open the sidebar, use Tab to reach the top-right **Account menu**, open it with Enter, and confirm **Sign out** remains visible and usable. Enable reduced motion and confirm the same actions remain available.
