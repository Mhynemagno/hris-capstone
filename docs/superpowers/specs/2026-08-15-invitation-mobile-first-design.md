# Invitation reliability and mobile-first design

## Goal

Make account invitations reliable in the browser, collect first and last names for every account-creation flow, and make the San Juan City Police HRIS consistently mobile-first with an intentional red-and-blue visual identity.

## Scope

This work covers administrator account invitations, applicant self-registration, the shared application shell, and the role-facing workspaces for administrator, HR, employee, management, and applicant users.

It does not change the database schema. Existing profile records continue to use the single full_name value.

## Name contract

The administrator invitation form and applicant registration form will each collect:

- First name
- Last name
- Email
- Role, for administrator invitations only

The client validation schemas will validate both name parts individually and create the existing fullName value by joining the trimmed parts with one space. The fullName value remains the value written to profiles.full_name.

Auth metadata for newly invited or registered users will include first_name, last_name, and full_name. This preserves the current database contract while making the structured information available to downstream account lifecycle work.

## Invitation reliability

The invite-internal-user Edge Function will handle OPTIONS preflight requests before the POST-only application flow. Every JSON and success response will include the same CORS headers, allowing the authenticated browser client to call the function without the generic failed-to-send error shown in the report.

The POST endpoint will continue to require an authenticated system administrator, validate its input, create the Auth invitation, and assign the requested role. It will retain its compensating deletion when assigning the role fails. It will return a safe, actionable error body for expected failures; the browser client will surface that body where available and use a clear retry message for unreachable services.

No migration is needed. The updated Edge Function must be deployed after the pull request is merged before the production invite form will receive the CORS fix.

## Mobile-first interaction model

The smallest viewport is the default layout. Larger layouts are introduced only at responsive breakpoints.

- Forms use a single column by default, with first and last name fields side by side only when space permits.
- Inputs, selects, checkboxes, and primary actions have at least a 44px interactive target on mobile.
- Filter and action bars stack with full-width primary actions on narrow screens, then become compact horizontal controls on larger screens.
- Data-heavy workspace tables retain their existing complete information in a horizontally scrollable container, with clear column labels and accessible action controls. Important management actions remain reachable without depending on hover.
- Dialogs use an inset, full-width mobile presentation and retain the centered modal treatment on larger screens.
- The navigation shell exposes a clear mobile trigger and prevents the desktop sidebar from consuming the small-screen viewport.

The same rules will be applied to the role-facing routes rather than limiting the work to the administration area.

## San Juan City Police color system

The existing navy and blue remain the foundation for trust, navigation, and primary actions. A dedicated command-red accent will become visibly present in the brand treatment: a slim red identifier in the application shell and public/auth entry surfaces. Red continues to communicate destructive and error states, while blue remains the primary interactive color.

The palette will meet accessible contrast expectations and will not rely on color alone for status or validation feedback.

## Verification

- Extend schema and query tests for the first-name/last-name contract and the normalized full name sent to the invitation function.
- Add component coverage for both name fields and rendered invitation failures.
- Verify the Edge Function source includes an OPTIONS response and CORS headers on successful and failure paths; exercise its preflight response locally when the Supabase function runtime is available.
- Run the focused tests, lint, type-check, production build, and the UI accessibility and mobile-first review required by the design workflow.
- Open a pull request from a branch based on current main. Production deployment remains a post-merge action unless separately requested.
