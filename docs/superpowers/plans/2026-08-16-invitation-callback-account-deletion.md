# Invitation Callback and Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver reliable internal-invitation callbacks and permanent administrator-managed account deletion while retaining personnel records.

**Architecture:** The invitation Function receives its callback origin only from a required server-side `APP_URL` secret. The existing server callback converts missing/failed exchanges into a friendly login recovery state. A dedicated, administrator-authorized Edge Function deletes the Auth account; existing foreign keys detach the profile from employee records, and an explicit audit row preserves the deleted account's readable label.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, TanStack Query, Base UI Dialog, Supabase Auth, Supabase Edge Functions (Deno), Postgres/RLS, GitHub Actions.

## Global Constraints

- Keep all secret and service-role credentials in Supabase Edge Function runtime only; never add a secret to `NEXT_PUBLIC_*`, client code, Git, or test output.
- Do not create or apply a migration: `employees.profile_id` already uses `ON DELETE SET NULL`.
- `APP_URL` must be an absolute HTTP(S) origin and `APP_URL/auth/callback` must be allow-listed in Supabase Auth.
- Only `system_administrator` callers may invite or delete accounts; self-deletion must be rejected.
- Permanent account deletion removes Auth/profile/role data but preserves employee, personnel-history, and related employee records.
- Use mobile-first styles, a centered accessible dialog, a labelled close control, 44px-or-larger touch targets, visible focus, and a red destructive confirmation action.
- Update the deployment workflow so both Edge Functions deploy when either Function source directory changes on `main`.

---

### Task 1: Convert invalid invitation callbacks into a friendly recovery state

**Files:**
- Modify: `src/app/auth/callback/route.test.ts`
- Modify: `src/app/auth/callback/route.ts`
- Modify: `src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `GET(request: NextRequest): Promise<NextResponse>` and `createServerSupabaseClient().auth.exchangeCodeForSession(code)`.
- Produces: `/login?error=invitation_expired` for a missing callback code or failed exchange; valid code exchanges preserve the safe `next` redirect.

- [ ] **Step 1: Add the failing callback-route tests**

```ts
it("sends a callback without a code to the invitation recovery state", async () => {
  const response = await GET(new NextRequest("http://localhost/auth/callback"));
  expect(response.headers.get("location")).toBe(
    "http://localhost/login?error=invitation_expired",
  );
});

it("sends a rejected code exchange to the invitation recovery state", async () => {
  exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });
  const response = await GET(new NextRequest("http://localhost/auth/callback?code=expired"));
  expect(response.headers.get("location")).toBe(
    "http://localhost/login?error=invitation_expired",
  );
});
```

- [ ] **Step 2: Run the callback test to verify RED**

Run: `npm run test:run -- src/app/auth/callback/route.test.ts`

Expected: FAIL because the route returns `missing_code` and `callback` error states.

- [ ] **Step 3: Implement the two safe callback outcomes**

```ts
if (!code) {
  return NextResponse.redirect(new URL("/login?error=invitation_expired", request.url));
}

const { error } = await supabase.auth.exchangeCodeForSession(code);
return NextResponse.redirect(
  new URL(error ? "/login?error=invitation_expired" : nextPath, request.url),
);
```

In `src/app/(auth)/login/page.tsx`, map `invitation_expired` to exactly: `This invitation link is invalid or has expired. Ask an administrator to send a new invitation.` Keep the existing invalid-credentials message unchanged.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run: `npm run test:run -- src/app/auth/callback/route.test.ts src/components/auth/auth-forms.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the completed callback recovery work**

```powershell
git add src/app/auth/callback/route.ts src/app/auth/callback/route.test.ts src/app/(auth)/login/page.tsx
git commit -m "fix: recover from expired invitation links"
```

### Task 2: Require an explicit application URL for invitations

**Files:**
- Create: `supabase/functions/_shared/invitation-redirect.ts`
- Create: `supabase/functions/_shared/invitation-redirect.test.ts`
- Modify: `supabase/functions/invite-internal-user/index.ts`

**Interfaces:**
- Produces: `getInvitationRedirectUrl(appUrl: string | undefined): string | null`.
- Consumes: `Deno.env.get("APP_URL")` in the invitation Function.
- Behavior: only a pathless `http:` or `https:` origin returns `<origin>/auth/callback`; invalid, missing, pathful, query-bearing, or fragment-bearing values return `null`.

- [ ] **Step 1: Write the failing Deno unit tests**

```ts
import { assertEquals } from "jsr:@std/assert@1";
import { getInvitationRedirectUrl } from "./invitation-redirect.ts";

Deno.test("creates the configured application callback URL", () => {
  assertEquals(
    getInvitationRedirectUrl("https://hris.example"),
    "https://hris.example/auth/callback",
  );
});

Deno.test("rejects an absent, pathful, or non-HTTP application URL", () => {
  assertEquals(getInvitationRedirectUrl(undefined), null);
  assertEquals(getInvitationRedirectUrl("https://hris.example/admin"), null);
  assertEquals(getInvitationRedirectUrl("ftp://hris.example"), null);
});
```

- [ ] **Step 2: Run the redirect helper test to verify RED**

Run: `deno test supabase/functions/_shared/invitation-redirect.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the URL helper and wire it into invitations**

```ts
export function getInvitationRedirectUrl(appUrl: string | undefined) {
  if (!appUrl) return null;
  const url = new URL(appUrl);
  if (!/^(http|https):$/.test(url.protocol) || url.pathname !== "/" || url.search || url.hash) return null;
  return new URL("/auth/callback", url).toString();
}
```

Call the helper before `inviteUserByEmail`. If it returns `null`, respond with a CORS-protected `500` JSON error: `Invitation redirects are not configured.` Replace `redirectTo: ${new URL(request.url).origin}/auth/callback` with the returned configured URL.

- [ ] **Step 4: Run the helper test and Edge Function static check to verify GREEN**

Run: `deno test supabase/functions/_shared/invitation-redirect.test.ts`

Run: `npx supabase@latest functions serve invite-internal-user --no-verify-jwt`

Expected: the unit test passes; the Function starts without syntax/import errors. Stop the local server after the startup check.

- [ ] **Step 5: Commit the configured invitation redirect work**

```powershell
git add supabase/functions/_shared/invitation-redirect.ts supabase/functions/_shared/invitation-redirect.test.ts supabase/functions/invite-internal-user/index.ts
git commit -m "fix: configure invitation callback URL"
```

### Task 3: Add the protected account-deletion Edge Function and retention test

**Files:**
- Create: `supabase/functions/delete-managed-user/index.ts`
- Create: `supabase/functions/delete-managed-user/index.test.ts`
- Modify: `supabase/tests/personnel_records.test.sql`

**Interfaces:**
- Consumes: a `DELETE` request body `{ userId: string }`, the caller bearer token, `SUPABASE_URL`, public key, and secret/service-role key.
- Produces: HTTP `204` after permanent Auth deletion, `400` for invalid input/self deletion, `401` without a valid caller, `403` for a non-administrator, and `500` for an unsuccessful deletion.
- Side effects: deletes through `auth.admin.deleteUser(targetUserId)` and inserts one `audit_logs` row with `entity_type: "profiles"`, `action: "delete"`, and preserved `full_name`/`email` metadata.

- [ ] **Step 1: Write failing handler tests with injected Supabase client stubs**

Create the handler as an exported factory so the Deno test can supply fake caller/admin clients. Cover all of these assertions:

```ts
Deno.test("rejects self deletion before calling the admin client", async () => {
  const response = await handler(deleteRequest(actorId));
  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "You cannot delete your own account." });
  assertEquals(deleteUserCalls, 0);
});

Deno.test("deletes an administrator-selected account and writes a readable audit row", async () => {
  const response = await handler(deleteRequest(targetId));
  assertEquals(response.status, 204);
  assertEquals(deleteUserCalls, 1);
  assertEquals(auditInsert, {
    actor_user_id: actorId,
    entity_type: "profiles",
    entity_id: targetId,
    action: "delete",
    metadata: { full_name: "Officer Ada Lovelace", email: "ada@example.com" },
  });
});
```

Also cover OPTIONS CORS response, POST method rejection, missing/malformed authorization, non-administrator, missing target, unknown target, and Auth deletion error.

- [ ] **Step 2: Run the Edge Function test to verify RED**

Run: `deno test supabase/functions/delete-managed-user/index.test.ts`

Expected: FAIL because the Function and exported handler factory do not exist.

- [ ] **Step 3: Implement only the authorized permanent deletion path**

Use the established invitation Function CORS headers and caller verification pattern. Validate `{ userId }` with Zod UUID parsing. Fetch target profile data before deletion, reject absent target users, then call `adminClient.auth.admin.deleteUser(userId)`. Insert the readable audit row only after a successful delete. Never accept a role, actor, or target identity from unverified client data.

- [ ] **Step 4: Add the database retention assertion**

Append one pgTAP assertion to `supabase/tests/personnel_records.test.sql` using the existing employee/profile fixture. Delete the fixture `public.profiles` row within the test transaction, then assert the existing employee still exists and its `profile_id` is null. Update the test plan count from `24` to `25`.

```sql
select extensions.is(
  (select profile_id from public.employees where id = '00000000-0000-0000-0000-000000000010'::uuid),
  null::uuid,
  'Deleting a linked profile detaches, but does not delete, the employee record'
);
```

- [ ] **Step 5: Verify the handler and retention behavior**

Run: `deno test supabase/functions/delete-managed-user/index.test.ts`

Run: `npx supabase@latest test db --linked supabase/tests/personnel_records.test.sql`

Expected: the Deno suite passes and the database test reports all 25 pgTAP assertions passing.

- [ ] **Step 6: Commit the secure deletion capability**

```powershell
git add supabase/functions/delete-managed-user/index.ts supabase/functions/delete-managed-user/index.test.ts supabase/tests/personnel_records.test.sql
git commit -m "feat: delete managed accounts securely"
```

### Task 4: Expose deletion through administration queries, hooks, and audit presentation

**Files:**
- Modify: `src/schemas/administration.ts`
- Modify: `src/queries/administration.ts`
- Modify: `src/queries/administration.test.ts`
- Modify: `src/hooks/use-administration.ts`
- Modify: `src/hooks/use-administration.test.tsx`
- Modify: `src/lib/administration/audit-presentation.ts`
- Modify: `src/lib/administration/audit-presentation.test.ts`

**Interfaces:**
- Produces: `managedUserDeleteSchema`, `ManagedUserDeleteInput`, `deleteManagedUser(input)`, and `useDeleteManagedUser()`.
- Consumes: `{ userId: string }`; the query invokes only `delete-managed-user` with `method: "DELETE"` and body `{ userId }`.
- Side effects: successful mutation invalidates `administration/users`, `administration/roles`, and `administration/audit-logs`.

- [ ] **Step 1: Add failing query, hook, and presentation tests**

```ts
await deleteManagedUser({ userId: testUserId });
expect(mocks.invoke).toHaveBeenCalledWith("delete-managed-user", {
  method: "DELETE",
  body: { userId: testUserId },
});

expect(presentAuditLog(deletedAccountLog, emptyLookups)).toMatchObject({
  recordLabel: "Account “Officer Ada Lovelace”",
  actionLabel: "Deleted",
});
```

Add a hook test mirroring `useUpdateManagedUser` that proves all three administration cache families are invalidated after a successful delete.

- [ ] **Step 2: Run the focused tests to verify RED**

Run: `npm run test:run -- src/queries/administration.test.ts src/hooks/use-administration.test.tsx src/lib/administration/audit-presentation.test.ts`

Expected: FAIL because the deletion schema, query, hook, and metadata label handling do not exist.

- [ ] **Step 3: Add minimal browser-facing deletion behavior**

Validate the UUID before calling `createBrowserSupabaseClient().functions.invoke`. Reuse `invitationErrorMessage` only if it is renamed to a generic Function-error extractor without changing current invitation messages. For a deleted profile audit event, use `metadata.full_name` first, then `metadata.email`, before profile lookups so deletion history remains readable after the lookup target is gone.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run: `npm run test:run -- src/queries/administration.test.ts src/hooks/use-administration.test.tsx src/lib/administration/audit-presentation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the browser deletion integration**

```powershell
git add src/schemas/administration.ts src/queries/administration.ts src/queries/administration.test.ts src/hooks/use-administration.ts src/hooks/use-administration.test.tsx src/lib/administration/audit-presentation.ts src/lib/administration/audit-presentation.test.ts
git commit -m "feat: expose managed account deletion"
```

### Task 5: Add the mobile-first account-deletion confirmation dialog

**Files:**
- Modify: `src/components/administration/administration-workspaces.tsx`
- Modify: `src/components/administration/administration-workspaces.test.tsx`

**Interfaces:**
- Consumes: `useDeleteManagedUser()` and `ManagedUser` selected from the managed-account table.
- Produces: a labelled `Delete account` action, centered dialog named `Delete account`, cancel behaviour with no request, and confirmed deletion calling `mutateAsync({ userId })`.

- [ ] **Step 1: Extend the administration workspace mocks and add failing interaction tests**

```tsx
it("requires confirmation before permanently deleting an account", async () => {
  hooks.useManagedUsers.mockReturnValue({ data: { rows: [managedUser], count: 1 }, error: null, isLoading: false, refetch: vi.fn() });
  const mutateAsync = vi.fn().mockResolvedValue(undefined);
  hooks.useDeleteManagedUser.mockReturnValue({ isPending: false, mutateAsync });

  render(<UsersWorkspace />);
  await user.click(screen.getByRole("button", { name: /delete officer ada lovelace/i }));
  expect(screen.getByRole("dialog", { name: "Delete account" })).toHaveTextContent("employee records will be kept");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(mutateAsync).not.toHaveBeenCalled();
});
```

Add a separate test that confirms deletion and expects `mutateAsync({ userId: managedUser.id })`.

- [ ] **Step 2: Run the workspace test to verify RED**

Run: `npm run test:run -- src/components/administration/administration-workspaces.test.tsx`

Expected: FAIL because the delete action, hook mock, and confirmation dialog are absent.

- [ ] **Step 3: Implement the centered destructive modal and retry-safe state**

Add `deleting` state beside `selected`, pass `onDelete` into `ManagedUsersTable`, and render an `AdministrationFormPanel` with title `Delete account`. State that deletion permanently removes the sign-in account and preserves employee records. Use `Button variant="destructive"`, `className="min-h-11 w-full sm:w-auto"`, and an outline `Cancel` control. Keep the dialog open and display `ErrorState` if the mutation rejects; close it only after success.

- [ ] **Step 4: Run the workspace test to verify GREEN**

Run: `npm run test:run -- src/components/administration/administration-workspaces.test.tsx`

Expected: PASS, including existing invitation, modal, deactivation, and audit-history tests.

- [ ] **Step 5: Commit the confirmation UX**

```powershell
git add src/components/administration/administration-workspaces.tsx src/components/administration/administration-workspaces.test.tsx
git commit -m "feat: confirm managed account deletion"
```

### Task 6: Automate both Function deployments and document production configuration

**Files:**
- Modify: `.github/workflows/deploy-invite-internal-user.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: GitHub secret `SUPABASE_ACCESS_TOKEN` and Supabase Function secret `APP_URL`.
- Produces: automatic `main` deployment of `invite-internal-user` and `delete-managed-user` when either source directory changes.

- [ ] **Step 1: Add a failing workflow-contract check**

```powershell
$workflow = Get-Content -Raw '.github/workflows/deploy-invite-internal-user.yml'
if ($workflow -notmatch 'supabase/functions/invite-internal-user/\*\*') { throw 'Missing invitation path filter.' }
if ($workflow -notmatch 'supabase/functions/delete-managed-user/\*\*') { throw 'Missing deletion path filter.' }
if ($workflow -notmatch 'functions deploy delete-managed-user') { throw 'Missing deletion deployment.' }
```

- [ ] **Step 2: Run the workflow-contract check to verify RED**

Run the PowerShell snippet above.

Expected: FAIL because the workflow currently deploys only `invite-internal-user`.

- [ ] **Step 3: Deploy both Functions and document the required dashboard settings**

Keep `workflow_dispatch`, the `main` branch restriction, the existing project ref, and secret presence check. Add the delete-function path filter and a second explicit deployment step:

```yaml
- name: Deploy managed-account deletion function
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
  run: supabase functions deploy delete-managed-user --project-ref wcjpyzulbiexvwtmyudq --use-api
```

Update README Authentication setup with the `APP_URL` secret command, Site URL, exact Redirect URL, custom email-template `{{ .RedirectTo }}` requirement, and reminder that expired/used links require a new invitation.

- [ ] **Step 4: Verify workflow syntax and contract**

Run: `npx prettier@3.5.3 --check .github/workflows/deploy-invite-internal-user.yml README.md`

Run the PowerShell workflow-contract check from Step 1.

Expected: both commands pass.

- [ ] **Step 5: Run the full required verification suite**

Run: `npm run test:run`

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm run build`

Run: `git diff origin/main...HEAD --check`

Expected: every command exits with code 0.

- [ ] **Step 6: Commit deployment/documentation work**

```powershell
git add .github/workflows/deploy-invite-internal-user.yml README.md
git commit -m "ci: deploy managed account functions"
```

## Post-Merge Production Verification

1. Set `APP_URL` with the real deployed HRIS origin and configure the matching Supabase Auth Site URL and exact Redirect URL.
2. Merge the pull request and run the deployment workflow manually once, since its own workflow-file merge does not match a Function-source path filter.
3. Invite a new non-administrator internal account and open the email immediately. Confirm it reaches the configured `/auth/callback` URL and gains a session.
4. Verify an old or used invitation reaches the friendly login recovery message rather than displaying a raw `#error` fragment.
5. Delete a test managed account. Confirm it is absent from Supabase Auth and Users/Roles, remains visible as a readable deletion audit event, and leaves its linked employee record with `profile_id = null`.
