# HRIS Feedback and Applicant Profiles Design

**Branch:** `codex/hris-feedback-applicant-profiles`
**Date:** 2026-09-07

## Goal

Implement the HRIS feedback in the supplied review: complete applicant and employee profile details, provide private profile photos with a shared default avatar, add permanent applicant numbers, refine recruitment/hiring and application-revision workflows, and simplify personnel and deployment entry.

## Identity and profile data

- `applicants` receives a unique, immutable, system-generated applicant number. The displayed form is `0-12345`: six digits with a hyphen after the first digit. It is assigned when the applicant account/profile is created and never reused.
- Applicant Number and Badge Number are separate. HR enters the required Badge Number at hire time; it remains the employee record's existing `employee_number` value internally and is labelled **Badge Number** in the UI.
- The supplied neutral silhouette is committed as a shared default avatar. It appears whenever an employee or applicant has no configured custom photo, or when a signed image URL cannot be generated.
- Applicants gain `qualifier`, `place_of_birth`, `date_of_birth`, `sex`, `civil_status`, `religion`, and `profile_image_path`. Employee records gain the same missing demographic fields. Name, address, and the new fields are self-service applicant profile data; employee official personnel data remains HR-managed.
- Profile photos are optional private files. Employees and applicants can only upload, replace, and remove their own image. Browser validation permits PNG, JPEG, and WebP images up to 5 MiB. Object paths and database updates are scoped to the authenticated owner's linked profile; clients use short-lived signed URLs only.
- Applicant profile documents include Eligibility and Diploma. They are required before an application can be submitted, accessible only to the owner and authorised HR users, and are separate from per-application CV/supporting files.

## Recruitment and applications

- Job qualification criterion kinds add `eligibility` alongside the existing values.
- A job can be hard-deleted only while it is a draft and has no applications. Published or applied-to openings use a withdrawal/close action that removes them from public listings and preserves history.
- The database's existing unique applicant/job constraint remains the final duplicate-application protection. The public job UI detects an existing application and replaces the submit form with its status/link.
- Public account creation remains reachable to signed-out visitors only. Authenticated applicants see their existing portal actions rather than registration prompts.
- Add `Needs Revision` to the application status model. HR can set this state with optional Notes. The transition writes an in-app notification for the applicant and an application-history entry.
- Only an application in Needs Revision can be edited and resubmitted by its applicant. The resubmission updates the same application and attached documents, records the action, notifies/queues HR as appropriate, and returns it to Under Review. Other statuses are read-only.
- The applicant application list shows the job title, current status, and unread/revision state. The existing notification bell remains the general notification destination.
- The hire panel displays Applicant Number as read-only, requires HR-entered Badge Number, has optional Notes, defaults Position to Patrolman/Patrolwoman, and omits Department and Employment Start Date. The server preserves the eligible-only rule: Shortlisted or Interview applications may be hired. The new employee's start date is set by the trusted server on the hire date.

## Personnel and deployments

- Create a managed Unit/Station catalogue. Employee record forms use it as a dropdown. The same catalogue backs deployment Unit Assignment.
- Display client-side validation at the failing control, so a Badge Number validation issue cannot appear to be a Unit/Station problem.
- Replace user-facing Employee ID/Employee Number text with Badge Number; retain database names and integrations for compatibility.
- New and edit deployment forms include employee selection by Badge Number, Unit Assignment, Active/Rejected status, Start Date, and optional Notes. End Date is hidden from future edits. Existing `ends_on` values remain stored for history and backwards compatibility.

## Security and data integrity

- All new exposed tables and columns use RLS. Applicant photos and profile documents use distinct private storage buckets/prefixes and owner/HR policies.
- Privileged RPCs pin `search_path`, schema-qualify referenced objects, authenticate callers, enforce role/ownership predicates, validate files and object paths, and keep notes optional.
- Database migrations preserve existing rows. Historic deployment end dates and job/application history are never destructively removed.

## Testing and verification

- Add schema, query, component, and SQL tests for generated Applicant Numbers, Badge Number hire requirements, photo ownership and signed URLs, required documents, duplicate-form suppression, Needs Revision/resubmission, application notifications, safe job deletion/withdrawal, Unit/Station selection, and deployment states.
- Final verification runs linting, TypeScript checking, the full Vitest suite, Supabase database tests, a production build, and a browser smoke test of all affected role flows.

## Non-goals

- No public profile-image or document URLs.
- No hard deletion of job openings that have applications.
- No applicant edits to an application outside Needs Revision.
- No deletion of historic deployment end dates.
