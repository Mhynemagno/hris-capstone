# Capstone objectives verification

**Date:** 2026-09-25 · **Branch:** `test/capstone-objectives-e2e`

Each specific objective was checked against the implementation and exercised end to end in a browser against the local Supabase stack. The tests are `e2e/capstone-objectives.spec.ts` (objectives 1–8) and `e2e/iso25010-quality.spec.ts` (automated evidence for objective 9). Face-camera attendance is covered by `e2e/face-attendance.spec.ts` (run headed) and the database tests in `supabase/tests/face_recognition_attendance.test.sql`.

Run them with the local stack up and the Edge Functions served (`npx supabase functions serve`, needed for the attendance import):

```bash
npx playwright test e2e/capstone-objectives.spec.ts e2e/iso25010-quality.spec.ts
```

## Summary

| # | Objective | Status | End-to-end evidence |
| --- | --- | --- | --- |
| 1 | Centralized personnel records | Working | HR creates a profile, updates department/rank, adds service history, qualification, certification, and training, and finds it in the directory. |
| 2 | Recruitment management | Working (fixed) | HR publishes an opening; a new applicant registers, uploads documents, and applies; HR moves the application Under Review → Shortlisted and hires; a personnel record is created; the applicant is notified. |
| 3 | Deployment tracking | Working (fixed) | HR is told a location/unit/project is required, assigns a deployment, updates it with history, sees it in the directory; the employee sees it in their portal. |
| 4 | Promotion eligibility tracker | Working (improved) | HR adds a training credential, defines criteria (years of service, minimum rating, required training), records a rating, and saves an advisory review. |
| 5 | Self-service portal | Working | Unauthenticated access is refused; the employee views their record and profile, applies for leave, HR rejects it with a note, and the employee sees the decision and notification and marks it read. |
| 6 | Attendance monitoring and reporting (biometric) | Working | A device CSV is imported through the Edge Function, the unknown device ID is mapped to personnel, the log shows 08:30/17:00 as *late* from an *Import*, and the attendance report lists it. Face-recognition login/logout: kiosk and employee self-scan. |
| 7 | Analytics dashboard | Working, with a gap | HR and management dashboards show numeric metrics (active personnel/deployments, applications, attendance exceptions, pending leave, promotion ready, training needs) and breakdown tables. |
| 8 | Automated reports | Working | All six reports are listed; the deployments report includes new data, downloads as CSV with that data, and respects date filters; management can read reports. |
| 9 | ISO/IEC 25010:2023 evaluation | Instrument ready; the evaluation itself is a study with users | Automated checks for security, performance, accessibility, and reliability all pass (below). |

## Defects found and fixed during verification

1. **Deployments could not be saved** unless every optional field was filled. The form parsed blank Unit/Project/Notes to `null` and the save query re-validated and rejected them, showing raw validation JSON. The schema now accepts its own output (`src/schemas/deployment-tracking.ts`).
2. **Editing a deployment always failed** ("Could not find the function public.update_deployment… in the schema cache"): the client sent `target_employee_id`, which `update_deployment` does not take. Only creation sends it now (`src/queries/deployment-tracking.ts`).
3. **Hiring rejected real badge numbers.** It required `EMP-YYYY-###` while personnel records use badges like `PAT-0001`, and the error was raw JSON. Hiring now uses the personnel-record rule (3–32 characters, uppercase) and shows a readable message (`src/schemas/common.ts`, `hr-application-detail.tsx`).
4. **No way to open a promotion review** for an employee who had not been evaluated yet (HR had to type the URL). The personnel record now links to **Promotion review**.

Each fix has a unit test.

## Remaining gaps (not fixed here)

- **Objective 7 — no charts.** Dashboards present metric cards and tables; there is no chart visualization. Prescriptive analytics are limited to promotion-readiness and training-need counts and the promotion/training report.
- **Objective 8 — reports are generated on demand** from live data (view, filter, CSV, print). There is no scheduled or emailed report.
- **Objective 3 — unit/station catalogue is empty** after the demo reset and has no admin screen, so "Unit assignment" cannot be used; deployments use Location or Project. The end date cannot be edited, and the directory has no status filter.
- **Objective 2/5 — queues show no names.** The HR application queue lists `Application {id}` and the HR leave queue has no employee column, so HR must open each item to see who it is.
- **Objective 6 — the import needs the `import-attendance` Edge Function** running (deployed in production; `npx supabase functions serve` locally). The face-recognition path has not yet been tested with a real person on a real camera.
- **Validation wording.** Some record forms show library messages such as "Invalid ISO date" or "Too small: expected string to have >=2 characters".

## Objective 9: ISO/IEC 25010:2023 evaluation

Objective 9 is an evaluation with the San Juan City Police Station's HR staff, employees, and management. Software cannot perform it; these automated checks supply supporting evidence for the characteristics that can be measured:

| ISO/IEC 25010:2023 characteristic | Automated evidence | Result |
| --- | --- | --- |
| Functional suitability (completeness, correctness) | Objective journeys 1–8, 422 unit tests, database (pgTAP) tests | Pass |
| Security (confidentiality, integrity, authenticity) | Every protected page redirects to login; each role is refused other roles' workspaces; RLS tests in `supabase/tests` | Pass |
| Performance efficiency (time behaviour) | Six key HR pages render in under 5 s (local production build) | Pass |
| Interaction capability (usability, accessibility, inclusivity) | axe-core WCAG 2.1 AA scan of 13 pages, no serious or critical violations; phone-width layout checks (`e2e/responsive-layout.spec.ts`) | Pass |
| Reliability (fault tolerance) | Unknown pages return 404; a missing record renders without an application error | Pass |
| Compatibility, flexibility | Runs in Chromium/Edge; responsive from 390 px | Pass |
| Maintainability | Lint, type checking, and CI on every pull request | Pass |

### Evaluation instrument

Have each respondent (HR personnel, employees, management, and IT/administrator) complete the role's tasks, then rate each statement from 1 (strongly disagree) to 5 (strongly agree).

| Characteristic | Statements |
| --- | --- |
| Functional suitability | The system provides the functions I need for my HR tasks. · The system produces correct results. · The functions help me complete my tasks. |
| Performance efficiency | Pages and reports load quickly. · The system responds promptly while several people use it. |
| Compatibility | The system works in the browsers and devices I use. · It works alongside the attendance device/camera. |
| Interaction capability | The system is easy to learn. · Screens are clear and consistent. · Error messages help me recover. · The system is usable on a phone. |
| Reliability | The system is available when I need it. · It recovers from errors without losing my work. |
| Security | Only authorized people can see personnel data. · My actions are recorded and traceable. |
| Maintainability | (IT/administrator) The system is easy to update and configure. |
| Flexibility | The system can adapt to changes in our HR procedures. |
| Safety | The system protects personal and biometric data from misuse. |

Compute the weighted mean for each characteristic and overall, and interpret it with the scale below.

| Mean | Interpretation |
| --- | --- |
| 4.21–5.00 | Excellent (strongly agree) |
| 3.41–4.20 | Very good (agree) |
| 2.61–3.40 | Good (neutral) |
| 1.81–2.60 | Fair (disagree) |
| 1.00–1.80 | Poor (strongly disagree) |
