# PDF promotion scorecard design

**Branch:** `fix/final-revisions-audit`  
**Source:** `Final Revisions .pdf`, pages 17–20  
**Goal:** Make the official promotion matrices the system-owned source of
truth. For every active uniformed employee, calculate and display the complete
score for the employee's next rank, with a transparent per-criterion
breakdown. HR reviews the score and records the final approve/reject decision;
neither calculation nor approval changes an employee's rank.

## Decisions

- The three PDF matrices are fixed policy, not HR-managed criteria:
  `PCPL–PMSG`, `PSMS–PEMS`, and `PLT–PLTCOL`.
- There is **no inferred pass mark**. The PDF allocates points but does not
  define a total that qualifies an employee. Consequently, every active
  uniformed employee with a promotable next rank appears in the evaluation
  dashboard with a calculated score and rank; the dashboard does not label a
  score as passing, failing, or automatically recommended.
- The calculation uses the complete criteria of the employee's applicable
  band: seniority/time in grade, diversity of assignment, awards and
  recognition, IPER, interview/leadership, and service reputation. Eligibility
  and its rating remain visible as a separate PDF-requested profile attribute;
  they do not contribute points because the matrices allocate no eligibility
  score.
- Records unavailable in the present HRIS cannot be invented or silently
  awarded. Their score is zero until HR records verified evidence. This is
  necessary for assignment, award, interview/leadership, and
  service-reputation points, for which the current promotion evaluator has no
  structured source data.
- HR cannot edit policy values, point bands, or the score. HR may enter or
  correct documented evidence using narrowly scoped data-entry workflows, then
  the system recomputes the score. The existing approve/reject decision stays
  an HR decision and snapshots the evaluated scorecard.

## Official policy represented by the system

### Band selection and total allocation

| Current-rank band | Seniority | Assignment | Awards | IPER | Interview / leadership | Service reputation | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `PCPL–PMSG` | 30 | 20 | 10 | 5 | 15 | 20 | 100 |
| `PSMS–PEMS` | 25 | 25 | 10 | 5 | 10 | 25 | 100 |
| `PLT–PLTCOL` | 25 | 25 | 10 | 5 | 10 | 25 | 100 |

`PSSG`, `PCMS`, `PCPT`, and `PMAJ` use the matrix for their current rank's
band. `PAT`, `NUP`, and the highest rank with no next promotion rank are not
scored and are clearly reported as out of scope.

### Seniority

The calculation uses the earliest service-history date for the employee's
current rank, falling back to the employment start date only when rank history
is absent. `PCPL–PMSG` receives the page-20 scale from 15 points at 3 years
and 1 day through 30 points at 7 years, 6 months, and 1 day or more. The
`PSMS–PEMS` and `PLT–PLTCOL` scales use the page-18/19 scale from 15 points at
3 years and 1 day through 25 points at 7 years or more. Every PDF interval is
encoded exactly as an inclusive lower/exclusive upper bound, preventing a date
from matching two rows.

### Assignment, awards, and IPER

The scorecard encodes each printed PDF row and cap:

- Assignment: field/QUAD staff and administrative duty each earn one point per
  six months, capped per category; geographic assignment earns the PDF's
  Luzon/Visayas/Mindanao rate and respective maximum. Assignment periods are
  de-duplicated by date, so overlapping records never count twice.
- Awards: the full operational, administrative, and miscellaneous award lists
  and their printed point values are fixed lookup data. Only awards held at
  the employee's present rank count, and awards are capped at the band's
  10-point allocation.
- IPER: two consecutive rating periods are required by the PDF. Two
  consecutive Outstanding ratings receive five points, Outstanding plus Very
  Satisfactory receives 3.5, and Very Satisfactory plus Very Satisfactory
  receives two; all other pairs receive zero. The evaluator reports the two
  periods used so an HR reviewer can audit the result.

### Interview/leadership and service reputation

Both fields remain evidence-based HR inputs because the policy explicitly
assigns their rating to the Promotion Board or to documented administrative,
criminal, and derogatory records. An authorized HR user enters a bounded score
from zero through the policy maximum, along with the assessment date, evidence
summary, and optional document reference. The UI calls these **Promotion Board
assessments**, never automatic facts. A score of zero is shown as "Not yet
assessed" until an assessment exists, so zero points are not misrepresented as
a negative finding.

## Data model and security

A forward-only migration creates policy-owned lookup data and evidence tables
with RLS, explicit grants, constraints, foreign keys, and indexes for
employee/date lookups:

| Data | Purpose |
| --- | --- |
| `private.promotion_scorecard_policy` and rows | Immutable PDF transcription: rank bands, seniority intervals, assignment rates/caps, award values, IPER combinations, and criterion maxima. Only migrations write it. |
| `public.promotion_assignment_records` | Verified employee assignment type, geographic region where applicable, and non-overlapping start/end dates. |
| `public.promotion_award_records` | Verified policy award, award date, present-rank reference, and supporting document metadata. |
| `public.promotion_board_assessments` | HR-entered interview/leadership and service-reputation assessment scores, source/evidence, evaluator, and date. |

The existing `performance_ratings` IPER entries and `service_history` remain
the source for those respective criteria. HR Personnel may read and write the
new evidence through authenticated RPCs that validate role, ownership, dates,
policy lookups, point bounds, and document metadata. Employees, Applicants,
Management, and anonymous callers receive no direct evidence-table access.
Private scoring functions are not executable by public roles; a role-checked
public read RPC returns only HR-safe dashboard data. Each approval/rejection
stores an immutable evaluation snapshot containing band, policy version,
individual point results, evidence IDs, total, and evaluated timestamp.

## Evaluation and dashboard

`private.evaluate_promotion_scorecard(employee_id, as_of_date)` becomes the
single calculation authority. It chooses the employee's current-rank band,
collects valid evidence as of the requested date, applies the fixed policy,
and returns total points, criterion subtotals, explanatory rows, missing or
unassessed evidence, eligibility details, current rank, and next rank. It
performs no inserts or rank updates.

The HR list RPC evaluates every active uniformed employee with a next rank,
including employees with zero or incomplete evidence, and orders them by total
score descending then name/ID for deterministic pagination. The dashboard
shows Rank, Name, Target Rank, Score `/100`, Eligibility/rating, evaluation
state, and Actions. Expanding a row shows every criterion, evidence, cap, and
point result. The official policy matrix remains read-only and links each
employee's band to its exact rows. Approve/reject is disabled until any policy
required Promotion Board assessment is recorded, but scoring and review remain
available for all rows.

Existing rank-training, PFT, and eligibility indicators can remain useful
supporting readiness information, but they must not alter the official
100-point score unless they are explicitly added to a future approved policy.

## Errors and lifecycle

- Invalid/overlapping assignment intervals, award records outside the present
  rank, unknown policy award codes, score values outside their criterion cap,
  or missing HR authorization fail atomically with a clear error.
- Correction creates an audit entry and recomputes subsequent live views. It
  never rewrites a stored approval/rejection snapshot.
- Deleted or expired supporting records are retained as audit history where a
  decision references them; they are excluded from new live calculations only
  if policy says they are no longer valid.
- The UI distinguishes unavailable data, zero awarded points, and failed RPC
  loading states. It never presents a missing record as a score of zero without
  that explanation.

## Testing and verification

- pgTAP covers every PDF seniority boundary, all assignment rates/caps,
  each award value/cap, IPER pairs, every band allocation, zero/unassessed
  assessment behavior, deterministic ordering, and no rank mutation.
- RLS/RPC tests prove that only HR can create or correct evidence, public roles
  cannot execute private scoring, and snapshots remain unchanged after later
  evidence corrections.
- Query/schema/component tests cover dashboard scores, detailed breakdowns,
  policy-reference display, validation errors, zero/missing distinctions,
  pagination, and approve/reject snapshot behavior.
- A fresh local database reset, database tests, TypeScript, lint, Vitest,
  production build, and the project E2E suite run before updating the PR.
