# Authentication Pages Design

## Goal

Deliver secure, accessible self-service authentication for the HRIS: sign-in, applicant registration, password recovery and reset, session-aware sign-out, and a protected server-side workflow for internal-account invitations.

## Scope

This branch adds the public authentication pages at `/login`, `/forgot-password`, `/reset-password`, and `/applicant/register`, plus the supporting `/auth/callback` route. It also makes the public landing page session-aware so a signed-in user can sign out.

The branch reserves `/admin`, `/hr`, `/employee`, `/management`, and protected applicant paths as authentication-protected route prefixes. It deliberately does not implement role-specific authorization, authenticated layouts, navigation, role landing pages, or an internal account-management page; those belong to later roadmap branches.

## Components and Boundaries

- Shared Zod schemas validate the login, registration, recovery-email, reset-password, and internal-invitation payloads. Password reset requires matching new-password and confirmation values.
- Client form components use the existing browser Supabase client for Supabase Auth's standard, public-key-safe operations: `signInWithPassword`, `signUp`, `resetPasswordForEmail`, `updateUser`, and `signOut`.
- A server callback route exchanges email-link codes for the session. It accepts only a safe, local next path to prevent open redirects.
- The existing cookie/session refresh proxy adds authentication-only protection for reserved application roots. It redirects unauthenticated requests to `/login?next=...`; role enforcement remains deferred to `feat/03-role-based-app-shell`.
- A small authenticated-user helper extends the existing verified-claims primitive so server components can determine whether a valid session exists without relying on unverified browser state.
- A Supabase Edge Function provides internal-account invitation or creation. It validates input, verifies that the JWT caller holds `system_administrator`, uses server-only Supabase admin credentials, updates the Auth-trigger-created default applicant role to the requested internal role, and writes an audit entry naming the administrator. It accepts only `employee`, `hr_personnel`, `management`, and `system_administrator` roles. It is a backend capability for the future `/admin/users` page, not a new user interface in this branch.

## User Flows

1. **Sign-in:** validate email and password, sign in with Supabase Auth, then navigate to the safe local `next` value or `/`.
2. **Applicant registration:** validate full name, email, and password; sign up with Supabase Auth; then show either a confirmation-email state or a signed-in state, based on the project Auth configuration.
3. **Password recovery:** request a recovery email using the callback URL. Always display a neutral check-email confirmation rather than revealing whether an account exists.
4. **Password reset:** the email link reaches `/auth/callback`, which exchanges its code and sends the user to `/reset-password`. The page validates and saves the new password, then returns the user to `/`.
5. **Sign-out:** the session-aware landing page calls `signOut`, clears the browser session, and returns the user to `/login`.
6. **Internal invitation:** a System Administrator invokes the Edge Function with a valid internal role. The function rejects unauthenticated callers, non-administrators, malformed payloads, invalid roles, and Auth duplicate-account failures without exposing privileged details.

## Error Handling and Security

- Form-level validation errors are specific and accessible; Supabase Auth errors are presented in a clear but non-sensitive form.
- Password-recovery responses do not disclose account existence.
- Redirect handling is restricted to internal paths; no untrusted external URL is followed.
- Browser code uses only the existing public Supabase URL and publishable key. Admin credentials remain available only in the Edge Function runtime.
- The invitation function validates authorization independently of any future UI and appends an audit record after a successful role assignment.
- Existing RLS policies continue to protect profiles, roles, and audit records. This branch adds no exposed database table, migration, or RLS policy.

## External Configuration

Supabase Auth redirect settings must include the local and deployed `/auth/callback` URLs. Registration confirmation and recovery email templates should use that callback URL. Edge Function runtime configuration must provide its server-only admin credential; it must not be added to `NEXT_PUBLIC_*` variables or committed to the repository.

## Tests and Verification

- Unit tests cover every Zod schema, form success/error state, safe redirect handling, session-aware sign-out, proxy redirects, and authenticated-user helper results for valid, absent, and failed claims.
- Edge Function tests cover validation, administrator authorization, allowed internal roles, failure handling, role assignment, and audit logging.
- Manual/integration verification covers sign-in, sign-out, registration, recovery, reset, and authenticated versus unauthenticated access for each role fixture.
- The branch runs lint, typecheck, Vitest, and production build. It also confirms that a non-admin cannot invoke the invitation workflow and an unauthenticated visitor is redirected away from a protected route.
