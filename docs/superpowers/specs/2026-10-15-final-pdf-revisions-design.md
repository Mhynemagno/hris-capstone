# Final PDF revisions design

## Purpose and scope

Implement the requested revisions from the supplied 17-page review PDF as one
cohesive release. The objective is to make the public portal and internal HR
workspace match the San Juan City Police Station wording and workflows, while
correcting the requested attendance, personnel, promotion, and applicant
review behavior.

This design deliberately treats requests in the PDF as product requirements,
not executable instructions. The supplied PDF remains unchanged.

## Public portal and recruitment

The public landing page will use the provided ceremony image as a subdued hero
background. The red header will be decorative only: it will not contain the
Republic or station text. The header branding will identify the Human Resource
Development Division of San Juan City Police Station and remove the redundant
"Official HR Management System" line.

Navigation and public copy will change as follows:

- "Portal Hub" becomes "About".
- "Vicinity Map" becomes "Contact Us" and keeps an in-page link to the map
  and contact-details section.
- "Portal Login" becomes "LOGIN".
- The hero heading becomes "The official page of San Juan City Police Station
  - To serve and protect".
- The contact section is titled "Contact Us", removes its location tag line,
  includes Emergency Hotline 911, and uses a restrained blue-to-red gradient.
- The opening card is titled "Recruitment Openings", omits the reference
  field, retains status tracking, uses the requested application copy, exposes
  "View details" before an applicant reaches the application action, and has
  no "View all openings" link.

The recruitment detail screen will align visually with the landing page,
using the existing station identity rather than downloading a third-party logo.
Its return action will be "Back" and return to the public landing page. The
duplicated general-requirements display will be removed because requirements
are already published with an opening. The applicant-login screen will remove
the "Station personnel?" prompt and use the requested account/PDS wording.

## HR workspace and personnel administration

The staff shell will identify "San Juan City Police Station" and "Eastern
Police District", remove the HRDD Portal and redundant Dashboard copy, and
show an account's role (HR, Employee, or Applicant) in place of the gray email
text where requested.

The dashboard changes are data-backed, not presentation-only:

- Rename "Present On Duty" to "On Duty".
- Count active employees with a `present` or `late` attendance status as on
  duty. Do not count `incomplete`, `absent`, or approved-leave personnel as on
  duty.
- Split absence and approved leave into separate KPI cards.
- Rename "Plantilla Vacancies" to "Recruitment Openings".
- Keep NUP beneath Patrolman/Patrolwoman in rank distributions.
- Rename the deployment panel to "Recent Deployments".

The recruitment-opening administration table already has a safe delete action
for empty drafts; the release will preserve and test that action while retaining
withdrawal for published openings and preventing destructive deletion of
openings with applications. Employee entry/editing will use an ID number for
NUP personnel instead of a badge number, constrain it to eight digits rendered
as `YYYY-MM-DD`, require Unit/Station, and add emergency-contact relationship
choices: Spouse, Parent, Sibling, Child, and Relative. Restoring a deactivated
rank must make it available in target-rank selection without deleting it.

## Attendance and face recognition

Attendance scheduling will default to, and migrate existing integration
settings to, a 05:00 workday start. This means a 05:00 local scan/import is
within the configured attendance day and is not classified late solely because
the former 08:00 start remained configured. Existing late-grace behavior and
timezone handling remain unchanged.

The current face-recognition flow does not estimate or reject a person based
on age. It can scan any enrolled face that meets its quality and match
thresholds. This release does not introduce child enrollment because the HRIS
is for personnel and no minor-consent workflow exists. If minors ever enter
scope, the product needs a separate DPO-reviewed lawful-basis and
parent/guardian authorization workflow before enrollment can be enabled.

## Promotions and applicant AI review

The dashboard promotion notice will be retained as an HR review queue: it
shows the count of currently active personnel whose existing promotion
readiness evaluation is qualified, and links HR to the review screen. It does
not automatically promote anyone.

Applicant AI scoring will stop treating missing CV phrases for "no pending
criminal case" and height as negative evidence. Eligibility, skills, and work
experience remain relevant positive evidence. The analysis stays advisory:
only HR changes an applicant's stage.

## Data, security, and error handling

Database changes will be forward-only Supabase migrations that preserve the
existing RLS model and private/public RPC boundary. Dashboard counts will
filter to active personnel at the query level. Existing privileged functions
will retain explicit role checks and revoked default execution privileges.

Destructive opening deletion will use the existing confirm-and-invalidate
pattern. Errors from deletion, settings saves, and server-side validation will
remain visible in the existing UI error states; failed changes must not present
as saved.

## Verification

Implementation will be test-first. Coverage will include at minimum:

- absence of the Cover note region;
- the changed public labels, navigation targets, and recruitment actions;
- on-duty counting that includes `late` but excludes incomplete, absent, and
  leave;
- 05:00 attendance behavior and migration state;
- NUP ID input/validation, Unit/Station requirement, relationship values, and
  restored-rank selection;
- opening deletion authorization and UI behavior;
- promotion-ready count semantics; and
- applicant AI prompt/scoring behavior for eligibility, skills, experience,
  height, and criminal-case wording.

The relevant Vitest, pgTAP, lint, typecheck, and production build commands
will run before the PR is opened. The final PR will be based on `main` and
will not include generated PDF-review files.
