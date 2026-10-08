# PDF recruitment feedback implementation design

**Date:** 2026-10-08  
**Branch:** `codex/pdf-request-changes`  
**Status:** approved in brainstorming; awaiting specification review

## Goal

Make the applicant portal and recruitment workflow follow the supplied review notes exactly. Applicants must see the prescribed eight-step PNP recruitment process, upload and submit the five required documents through a simpler flow, register with the requested field order, and sign in using their applicant number. Personnel must sign in with their badge number. HR remains the only party that can move an application through the process or make the final shortlisting decision.

## Scope and decisions

### Recruitment workflow

The current application statuses are replaced with the following ordered stages:

1. Application Submission
2. Physical Agility Test
3. Physical & Medical Examination
4. Neuro-Psychiatric Examination
5. Drug Test
6. Character & Background Investigation
7. Panel Interview
8. Final Evaluation

`Shortlisted`, `Not Selected`, and `Hired` are terminal outcomes, not progress stages. Only an application at **Final Evaluation** can become `Shortlisted` or `Not Selected`. A shortlisted applicant can be hired through the existing employee-provisioning process. The applicant-facing tracker always displays the eight stages; it marks all eight complete before presenting a final outcome.

The migration will update existing application and history rows to safe equivalent stages before enforcing the new allowed transitions. It will not discard applications, history, documents, or hiring records. The migration will preserve the existing owner/HR access boundaries and keep all write functions explicitly granted only to authenticated callers.

### Applicant experience

- The applicant sidebar contains Dashboard, Profile, Recruitment (job openings), Documents, and Application Status.
- The dashboard shows the eight-stage progress for the latest application, PNP minimum qualifications, the current recruitment pipeline, and an application-progress count out of eight. It refreshes when HR advances the application.
- Application-status pages show the same pipeline and a clear terminal `SHORTLISTED` or `NOT SELECTED` result when applicable.
- Job-opening **Apply Now** links go to applicant registration when the visitor is not signed in. Authenticated applicants continue to the relevant application page.
- Document cards use **Choose file** for both an initial upload and a replacement. The file picker only stages the selection. One **Save documents** action appears after the complete document list and is disabled with an actionable explanation until every required file is selected or already saved. The optional credentials and cover-note portion of the application form is removed; the form retains only the required-document validation and Submit action.
- Submitted application documents are listed on the Documents area and on the application detail. Their status badge reads `SUBMITTED` with a green treatment.
- Applicant notifications use the requested copy: “Your application is now under review.”

### Registration and authentication

The applicant registration form is ordered as Last Name, First Name, Middle Name (optional), Qualifier, Email, Phone Number, Birthdate, Password, and Confirm Password. The Philippine mobile-number validation remains server-validated and is reflected in the input constraints and help text.

Applicant login accepts exactly six numeric digits after accepting the existing display separator form (`0-00000`) and resolves that identifier on the server before calling Supabase password authentication. Employee login accepts the existing badge-number rules and resolves it server-side in the same way. The browser never receives a user directory, mapped email address, service-role key, or an unrestricted lookup query. Error responses remain generic to avoid exposing whether an identifier exists.

Email confirmation uses the application callback endpoint and handles both code and token-hash confirmation links. A successful confirmation redirects to the vetted next path; only an actual failed confirmation produces the invalid-or-expired message. Deployment configuration must include the exact production callback URL and applicable local/preview callback URLs in Supabase Auth redirect settings.

## Architecture

### Database and authorization

1. Add a migration that updates the application-status constraints/types, `applications`, status history, transition RPC, hiring guard, notifications, and any reporting views/RPCs that enumerate statuses.
2. Implement the strict sequential stage transition matrix in the existing HR-only transition RPC. Each valid stage movement locks the application row, records status history, updates the timestamp, and creates the applicant notification atomically.
3. Permit Final Evaluation to resolve only to Shortlisted or Not Selected. Permit the existing hire path only for Shortlisted applications.
4. Add a narrowly scoped server-side identifier lookup for login. It has no public table select policy, validates canonical identifiers, returns only the authentication email required by the server route, and exposes no user data to client code. Its policy/function body verifies only the requested account class (applicant or active employee).
5. Retain RLS on all exposed tables. New or changed security-definer functions use an empty search path, verify the caller/role where appropriate, revoke default public execution, and grant only the minimal authenticated role access.

### Application code

- Update the shared application-status schema, TypeScript database types, pipeline helpers, HR filters, badges, status tracker, dashboard, and HR application controls to use the eight stages and final outcomes.
- Update the applicant navigation configuration and public job links.
- Refactor `ApplicantProfileDocuments` to collect pending file selections across cards and save them together without weakening the database's required-document gate.
- Simplify `ApplicantApplicationForm` to submit the required documents only. The database remains the authority that rejects missing required documents.
- Update login form labels, input modes, request fields, route validation, and server route authentication. Use mode-specific labels: Applicant Number for applicants and Badge Number for employees.
- Update registration form layout and optional-middle-name schema.
- Harden the auth callback to read valid confirmation parameters and only surface a failure after the Supabase verification attempt fails.

## Error handling and accessibility

- Invalid identifiers, passwords, and inactive accounts continue to use a generic sign-in failure where disclosure would reveal account existence.
- File and workflow validation appears adjacent to the affected control and is also enforced in the database/RPC layer.
- The progress tracker remains an ordered list with announced completed/current/pending state; final outcomes have text in addition to color.
- All actions keep accessible labels, keyboard focus styles, and disabled-state explanations.

## Testing and verification

### Database (pgTAP)

- The eight allowed stage transitions succeed in order and invalid skips fail.
- Only Final Evaluation can shortlist or reject.
- Hiring accepts Shortlisted only.
- Each status change records history and produces the specified notification.
- Existing records migrate without loss and legacy terminal outcomes remain terminal.
- The identifier-login lookup rejects malformed input, never leaks unrelated profile data, and distinguishes applicant and active employee identifiers only inside server-authorized code.

### Unit and component tests (Vitest)

- Stage helper ordering, tracker position, final outcomes, and HR action matrix.
- Applicant dashboard progress count and full eight-stage rendering.
- Sidebar labels/routes and Apply Now registration routing.
- Document selection, batch save, missing-document block, `Choose file` copy, and submitted-document presentation.
- Registration field order, optional middle name, phone validation, and login identifier validation.
- Login route behavior with identifier resolution and generic failures.
- Auth callback handling for successful code/token confirmation and genuine failure.

### End-to-end and quality checks

- Applicant registration, confirmation, identifier sign-in, document save, application submission, and the full HR-managed eight-stage workflow.
- Existing role-access, visual, responsive, and accessibility coverage updated for the new labels and stages.
- Final evidence: database tests, `npm run typecheck`, `npm run lint`, `npm run test:run`, and the relevant Playwright suite.

## Out of scope

- New authentication providers, passwordless login, or a public account-directory endpoint.
- Scheduling, calendar management, or detailed scoring for recruitment tests.
- New document categories beyond the five required documents.
- Unrelated redesign of employee, administration, or public-information pages.
