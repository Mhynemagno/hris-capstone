# Applicant Onboarding and Portal UX Design

## Purpose

Remove the false distinction between a signed-in applicant account and the
separate applicant profile required to submit an application. Applicant
registration must create a usable account immediately, without an email
confirmation step, and the application portal must make the next action clear
at every stage.

This work also addresses the shared visual and interaction issues evident in
the applicant portal: low readability, a sign-out control whose label is hard
to see, unclear form feedback, and inconsistent control presentation.

## Account and profile provisioning

Applicant registration remains password-based and requires first name, last
name, email address, and password. The Supabase Auth configuration must keep
email confirmation disabled in every deployed environment. When Auth creates a
user, the existing user-provisioning trigger will also create that user's
`applicants` row from trusted Auth metadata. This is intentionally performed in
the database rather than in the browser so it occurs even if the user closes
the page immediately after registration.

The initial applicant row contains the first and last names collected during
registration. Phone number and address remain optional profile fields. The
user is signed in and sent directly to the applicant portal after successful
registration; no confirmation-email state or callback URL is needed for this
flow.

The application submission RPC continues to treat the applicant profile as a
required database invariant. The browser will check for a profile before it
uploads a document. For a pre-existing account without an applicant row, it
will show an actionable recovery card that explains the situation and links
directly to the profile page. It must not upload any document before this
check succeeds. Existing users can save their profile once to recover, after
which normal submission resumes.

## Applicant journey

The applicant portal presents a task-led journey:

1. Complete or review profile.
2. Browse published job openings.
3. Apply with a cover note and required CV.
4. Track submitted applications and status.

The applications page provides an explanatory empty state when no job has been
selected, and the missing-profile recovery state when appropriate. Application
form errors are placed next to the affected control or provide a direct action
to recover. The form preserves inputs when a recoverable error occurs. File
selection clearly shows the selected files and keeps the CV requirement
explicit before submission.

## Shared UI system

Use Atkinson Hyperlegible as the application sans-serif font. It is a clear,
accessible typeface suited to a public-service HR system. Retain the existing
professional blue palette, but use semantic tokens consistently and ensure
foreground/background contrast meets WCAG AA for normal text.

Shared controls use a minimum 44px interactive target, a visible keyboard
focus treatment, and clear loading feedback. Labels remain visible above form
fields; placeholders never provide the only label. Body text is at least 16px
with comfortable line-height. Components use the established Button, Input,
FormField, ErrorState, LoadingState, and Lucide icon patterns rather than
introducing a second control system.

The sidebar account area keeps the user identity and role visible. Its Sign out
button displays a visible label and a LogOut icon with a high-contrast outline
style in the sidebar context. It remains keyboard-accessible and usable on
narrow viewports. Navigation uses Next.js links, follows the visual order when
tabbing, and maintains the existing skip link.

The shared shell, authentication pages, public job pages, and applicant pages
will be reviewed against these requirements at desktop and narrow viewport
widths. Scope does not include unrelated HR, administration, or management
workflows beyond the shared shell and primitive styling they consume.

## Error handling and security

The production deployment must explicitly have Supabase email confirmation
disabled; changing local `supabase/config.toml` alone does not change a hosted
project. Password validation, auth rate limits, RLS, and document bucket
privacy remain in force. The profile trigger only trusts metadata supplied as
part of account creation for display data; roles continue to be assigned by
the server-controlled trigger, never browser metadata.

The automatic profile insert uses the authenticated user's ID as the profile
owner and preserves the existing ownership-based RLS model. It is idempotent
for existing accounts. The submission preflight is an experience safeguard;
the database RPC remains the authorization boundary.

## Verification

- Unit and component tests prove registration sends the expected metadata and
  directs an immediately authenticated applicant to the portal.
- Migration tests prove new Auth users receive a matching applicant profile,
  with correct ownership and no duplicate profile row.
- Query and component tests prove missing profiles block uploads and show a
  direct profile-recovery action, while a provisioned applicant can submit.
- App-shell tests prove Sign out has a discernible label and remains usable.
- Lint, typecheck, unit tests, migration/database tests where available, and a
  production build must pass.
- The applicant registration, profile, application, and sign-out journeys are
  checked at narrow and desktop viewport sizes with keyboard navigation.
