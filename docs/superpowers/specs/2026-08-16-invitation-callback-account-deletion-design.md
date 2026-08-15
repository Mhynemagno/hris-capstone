# Invitation Callback and Account Deletion Design

## Goal

Make internal invitations return to the HRIS application reliably, give invitees a clear recovery message when a link is invalid or expired, and let a System Administrator permanently remove an account without removing associated employee records.

## Root Cause

`invite-internal-user` currently derives `redirectTo` from `request.url`. In a hosted Edge Function that value is the Supabase Function origin, not the HRIS application's origin. It is not an allowed Supabase Auth redirect URL, so Auth falls back to the configured Site URL, which is currently `http://localhost:3000`. The browser then receives `otp_expired` or another Auth failure in a URL fragment, rather than an application-level recovery message.

The existing callback route only processes a `code` query parameter. An Auth error returned in a fragment cannot be read by a server route; when the configured callback receives that request without a code, the route must turn it into a predictable application-level recovery state instead of a generic error.

## Invitation Flow

### Configured application URL

The Edge Function will read a required `APP_URL` secret. It must be an absolute HTTP(S) HRIS application origin without a path or query string. The function will construct `${APP_URL}/auth/callback`; it will never derive a redirect URL from the Function request URL or a client-supplied Origin header.

If `APP_URL` is absent or invalid, the Function will fail the invitation with a safe configuration message rather than issuing an unusable email link. The function's deployment documentation will require:

- setting `APP_URL` to the public application origin (or `http://localhost:3000` only for local development);
- setting Supabase Auth Site URL to the public application origin; and
- allow-listing the exact `${APP_URL}/auth/callback` URL in Supabase Auth Redirect URLs.

The invitation email must use Supabase's redirect-aware template value (`{{ .RedirectTo }}` where a custom template is configured) so the requested callback URL is retained.

### Callback failure recovery

`/auth/callback` will retain its code-exchange behavior for valid links. A request without a code, or a failed code exchange, will redirect to `/login?error=invitation_expired`. This gives fragment-based Auth failures such as `otp_expired`, `access_denied`, and invalid links a predictable recovery state without exposing their raw fragment in the application UI.

The login screen will render a concise recovery message: “This invitation link is invalid or has expired. Ask an administrator to send a new invitation.” It will not echo authentication tokens, raw provider text, or internal URLs.

## Permanent Account Deletion

### Server-side capability

A dedicated `delete-managed-user` Edge Function will accept `DELETE` with a target user UUID. It will:

1. Handle CORS preflight and reject every non-DELETE method.
2. Require and verify the caller's bearer token.
3. Confirm the caller has the `system_administrator` role.
4. Reject an attempt to delete the caller's own account.
5. Load the target account label before deletion and delete the target through `auth.admin.deleteUser` using only the Function's server-side secret credential.
6. Add an explicit audit row with the preserved name and email, action `delete`, and the deleting administrator as actor.

The browser never receives an admin or service-role credential and never deletes `auth.users`, `profiles`, or `user_roles` directly.

### Personnel-record retention

No migration is required. `public.employees.profile_id` already references `public.profiles(id) ON DELETE SET NULL`. Deleting the Auth user removes the linked login/profile/role data and detaches the employee record, leaving the employee, service history, qualifications, certifications, training records, and personnel-history records intact.

## Administration UI

Each managed-account row will expose a clearly labelled destructive `Delete account` action in addition to `Edit`.

Selecting the action opens a centered, mobile-first confirmation dialog that names the account and says the login will be permanently removed while employee records are kept. The dialog has a visible close control, an outline `Cancel` action, and a red `Delete account` action. The destructive control has a minimum 44px touch target, stays disabled while the request is pending, and shows an inline recoverable error if deletion fails.

On success the dialog closes and refreshes the Users, Roles, and Audit Logs query families. The user stays on the current page; normal pagination can naturally reveal an empty page if the final item is deleted, in which case the existing empty state is shown.

## Deployment

The existing GitHub Actions workflow will deploy both invitation-related Functions. It will trigger for changes below either Function directory on `main`, validate `SUPABASE_ACCESS_TOKEN`, and deploy `invite-internal-user` and `delete-managed-user` to project `wcjpyzulbiexvwtmyudq`.

Before deployment, set the runtime secret with the Supabase CLI:

```powershell
npx supabase@latest secrets set APP_URL=https://your-hris-domain.example --project-ref wcjpyzulbiexvwtmyudq
```

## Testing and Acceptance

- Unit tests prove that an invalid or absent `APP_URL` cannot produce an invitation request, and that valid configured URLs create the expected callback URL.
- Callback tests cover an Auth error fragment being converted to the friendly invitation-expired state, while existing code-query callback behavior continues to work.
- Query and hook tests prove the browser calls only `delete-managed-user` and invalidates Users, Roles, and Audit Logs after success.
- Workspace tests cover opening the destructive confirmation, cancelling it without a request, and confirming deletion for the named account.
- Edge Function tests cover OPTIONS, unauthenticated, non-administrator, self-deletion, deletion failure, and successful deletion/audit behavior.
- A database retention test confirms employee records are detached rather than deleted when the linked profile is removed.
- Linting, typechecking, the complete unit suite, database tests, and production build pass.

## External Configuration Required

The production HRIS public URL is not stored in the repository. Before the invitation flow can be verified in production, an administrator must set the `APP_URL` Function secret and matching Supabase Auth Site URL/Redirect URL values described above. Existing invitation links that are expired, already used, or were generated with the old callback configuration cannot be repaired; send a new invitation after deployment.
