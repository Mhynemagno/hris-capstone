# Authentication Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ('- [ ]') syntax for tracking.

**Goal:** Build secure Supabase-backed sign-in, applicant registration, password recovery/reset, sign-out, protected-route authentication, and internal-account invitation capability.

**Architecture:** Public client forms use the browser Supabase client and shared Zod schemas. The Next proxy refreshes sessions and sends unauthenticated requests to reserved application roots through /login; /auth/callback safely exchanges email-link codes. A Supabase Edge Function uses a service-role credential only for Auth invitations, while the requesting administrator's JWT performs the RLS-checked role assignment and creates the audit entry.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Zod 4, Supabase Auth, @supabase/ssr, Supabase Edge Functions (Deno), Vitest, Testing Library.

## Global Constraints

- Use Supabase Auth and existing Supabase client helpers; do not add Prisma or a separate backend.
- Validate each browser form, callback parameter, and Edge Function payload with Zod.
- Browser code may use only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; never expose service-role credentials.
- Preserve the five-role model. Invitations allow only employee, hr_personnel, management, and system_administrator.
- Keep /admin, /hr, /employee, /management, and protected applicant paths authentication-protected only. Role authorization, navigation, and role landing pages remain feat/03 work.
- Keep account-management UI out of this branch. The Edge Function is consumed by the future /admin/users page.
- Do not add a migration or change RLS policies; use user_roles_update_admin and the user_roles_write_audit_log trigger.
- Keep account-existence information private in password-recovery responses and reject unsafe external redirect URLs.

---

## File Structure

| File | Responsibility |
| --- | --- |
| src/schemas/auth.ts | Typed Zod schemas for every authentication input boundary. |
| src/lib/auth/safe-redirect.ts | Validates internal-only post-auth paths. |
| src/lib/auth/current-user.ts | Exposes verified authenticated-user data from JWT claims. |
| src/lib/supabase/proxy.ts and src/proxy.ts | Refreshes cookies and redirects anonymous users from reserved roots. |
| src/components/auth/* | Focused, client-side forms and a shared auth-card layout. |
| src/app/(auth)/*/page.tsx | Thin public page wrappers. |
| src/app/auth/callback/route.ts | Exchanges email-link codes and redirects safely. |
| src/app/page.tsx | Shows Sign in to visitors and Sign out to verified users. |
| supabase/functions/invite-internal-user/* | Privileged invitation handler and Deno tests. |
| supabase/config.toml and README.md | Local redirect URL and remote configuration instructions. |

### Task 1: Define auth input contracts

**Files:**
- Create: src/schemas/auth.ts
- Create: src/schemas/auth.test.ts
- Modify: src/schemas/index.ts

**Interfaces:**
- Produces loginSchema, applicantRegistrationSchema, forgotPasswordSchema, resetPasswordSchema, and inviteInternalUserSchema.
- Produces inferred LoginInput, ApplicantRegistrationInput, ForgotPasswordInput, ResetPasswordInput, and InviteInternalUserInput types.

- [ ] **Step 1: Write the failing schema tests**

~~~ts
expect(loginSchema.safeParse({ email: "not-an-email", password: "short" }).success).toBe(false);
expect(
  resetPasswordSchema.safeParse({ password: "secret1", passwordConfirmation: "secret2" }).success,
).toBe(false);
expect(
  inviteInternalUserSchema.safeParse({
    email: "person@example.com", fullName: "Person", role: "applicant",
  }).success,
).toBe(false);
~~~

- [ ] **Step 2: Run the focused test to verify it fails**

Run: npm run test:run -- src/schemas/auth.test.ts

Expected: FAIL because the auth schema module does not exist.

- [ ] **Step 3: Write the minimal schema implementation**

~~~ts
export const passwordSchema = z.string().min(6, "Password must be at least 6 characters.");
export const loginSchema = z.object({ email: z.email(), password: passwordSchema });
export const forgotPasswordSchema = z.object({ email: z.email() });
export const applicantRegistrationSchema = loginSchema.extend({
  fullName: z.string().trim().min(2).max(120),
});
export const resetPasswordSchema = z.object({
  password: passwordSchema,
  passwordConfirmation: passwordSchema,
}).refine(({ password, passwordConfirmation }) => password === passwordConfirmation, {
  path: ["passwordConfirmation"], message: "Passwords do not match.",
});
export const inviteInternalUserSchema = applicantRegistrationSchema
  .pick({ email: true, fullName: true })
  .extend({ role: z.enum(["system_administrator", "hr_personnel", "employee", "management"]) });
~~~

Add the standalone email-only forgotPasswordSchema and export every schema and inferred type from src/schemas/index.ts.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: npm run test:run -- src/schemas/auth.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/schemas/auth.ts src/schemas/auth.test.ts src/schemas/index.ts
git commit -m "feat: add auth validation schemas"
~~~

### Task 2: Add verified identity and safe redirect helpers

**Files:**
- Create: src/lib/auth/safe-redirect.ts
- Create: src/lib/auth/safe-redirect.test.ts
- Modify: src/lib/auth/current-user.ts
- Modify: src/lib/auth/current-user.test.ts

**Interfaces:**
- Produces getAuthenticatedUser(): Promise<{ id: string; email: string | null } | null>.
- Produces getSafeNextPath(value: string | null | undefined, fallback?: string): string.
- Retains getVerifiedUserId(): Promise<string | null> for current role lookup.

- [ ] **Step 1: Write failing helper tests**

~~~ts
expect(getSafeNextPath("/hr?tab=people")).toBe("/hr?tab=people");
expect(getSafeNextPath("https://attacker.example")).toBe("/");
expect(getSafeNextPath("//attacker.example")).toBe("/");
await expect(getAuthenticatedUser()).resolves.toEqual({
  id: "00000000-0000-4000-8000-000000000001", email: "admin@example.com",
});
~~~

- [ ] **Step 2: Run focused tests to verify they fail**

Run: npm run test:run -- src/lib/auth/safe-redirect.test.ts src/lib/auth/current-user.test.ts

Expected: FAIL because the new helpers are absent.

- [ ] **Step 3: Implement only verified claims and local redirects**

~~~ts
export function getSafeNextPath(value: string | null | undefined, fallback = "/") {
  if (!value?.startsWith("/")) return fallback;
  const candidate = new URL(value, "http://hris.local");
  return candidate.origin === "http://hris.local"
    ? candidate.pathname + candidate.search + candidate.hash
    : fallback;
}

export async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  if (error || typeof subject !== "string") return null;
  return { id: subject, email: typeof data.claims.email === "string" ? data.claims.email : null };
}
~~~

Implement getVerifiedUserId by calling getAuthenticatedUser so existing current-role behavior remains unchanged.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: npm run test:run -- src/lib/auth/safe-redirect.test.ts src/lib/auth/current-user.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/lib/auth/current-user.ts src/lib/auth/current-user.test.ts src/lib/auth/safe-redirect.ts src/lib/auth/safe-redirect.test.ts
git commit -m "feat: add verified auth helpers"
~~~

### Task 3: Enforce authentication at reserved route roots

**Files:**
- Modify: src/lib/supabase/proxy.ts
- Modify: src/proxy.ts
- Create: src/proxy.test.ts

**Interfaces:**
- Produces updateSession(request): Promise<{ response: NextResponse; userId: string | null }>.
- Produces isAuthenticationProtectedPath(pathname: string): boolean.
- Consumes the session result to redirect anonymous visitors while preserving any refreshed cookies.

- [ ] **Step 1: Write failing proxy tests**

~~~ts
expect(isAuthenticationProtectedPath("/applicant/register")).toBe(false);
expect(isAuthenticationProtectedPath("/applicant/profile")).toBe(true);
await expect(proxy(new NextRequest("http://localhost/hr?tab=people"))).resolves.toMatchObject({
  status: 307,
  headers: expect.objectContaining({
    location: "http://localhost/login?next=%2Fhr%3Ftab%3Dpeople",
  }),
});
~~~

Mock updateSession for both { userId: null } and a verified userId. Assert that only an anonymous protected request redirects.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: npm run test:run -- src/proxy.test.ts

Expected: FAIL because protected-path classification and redirect behavior are absent.

- [ ] **Step 3: Implement session-result and redirect behavior**

~~~ts
const protectedRoots = ["/admin", "/hr", "/employee", "/management"];

export function isAuthenticationProtectedPath(pathname: string) {
  return protectedRoots.some((root) => pathname === root || pathname.startsWith(root + "/"))
    || (pathname.startsWith("/applicant") && pathname !== "/applicant/register");
}

const { response, userId } = await updateSession(request);
if (!userId && isAuthenticationProtectedPath(request.nextUrl.pathname)) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  const redirect = NextResponse.redirect(loginUrl);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
return response;
~~~

Derive userId only from auth.getClaims() after the existing cookie refresh work.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: npm run test:run -- src/proxy.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/lib/supabase/proxy.ts src/proxy.ts src/proxy.test.ts
git commit -m "feat: protect reserved routes"
~~~

### Task 4: Build reusable client authentication forms

**Files:**
- Create: src/components/auth/auth-card.tsx
- Create: src/components/auth/login-form.tsx
- Create: src/components/auth/applicant-registration-form.tsx
- Create: src/components/auth/forgot-password-form.tsx
- Create: src/components/auth/reset-password-form.tsx
- Create: src/components/auth/sign-out-button.tsx
- Create: src/components/auth/auth-forms.test.tsx

**Interfaces:**
- Consumes schemas from @/schemas/auth, createBrowserSupabaseClient(), ErrorState, LoadingState, and getSafeNextPath().
- Produces LoginForm, ApplicantRegistrationForm, ForgotPasswordForm, ResetPasswordForm, and SignOutButton client components.

- [ ] **Step 1: Write failing client-component tests**

~~~tsx
render(<LoginForm nextPath="/hr" />);
await user.click(screen.getByRole("button", { name: /sign in/i }));
expect(await screen.findByText(/valid email/i)).toBeInTheDocument();

render(<ForgotPasswordForm />);
await user.type(screen.getByLabelText(/email/i), "person@example.com");
await user.click(screen.getByRole("button", { name: /send reset link/i }));
expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
~~~

Mock the browser Supabase client and next/navigation. Assert exact Auth calls, loading state, service-error alert, neutral recovery text, and router destinations for every form action.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: npm run test:run -- src/components/auth/auth-forms.test.tsx

Expected: FAIL because the auth form components are absent.

- [ ] **Step 3: Implement focused form components**

~~~tsx
const result = loginSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
if (!result.success) return setFieldErrors(result.error.flatten().fieldErrors);
setPending(true);
const { error } = await createBrowserSupabaseClient().auth.signInWithPassword(result.data);
if (error) return setError("We could not sign you in. Check your details and try again.");
router.replace(getSafeNextPath(nextPath));
~~~

Use FormField for labels and field errors, ErrorState for service failures, and LoadingState or disabled submit buttons while pending. Registration calls signUp with full_name metadata and a callback URL based on window.location.origin. Recovery calls resetPasswordForEmail with /auth/callback?next=/reset-password. Reset calls updateUser({ password }). Sign-out calls signOut(), router.replace("/login"), and router.refresh().

- [ ] **Step 4: Run the focused test to verify it passes**

Run: npm run test:run -- src/components/auth/auth-forms.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/components/auth
git commit -m "feat: add auth form components"
~~~

### Task 5: Add public auth pages and secure email callback

**Files:**
- Create: src/app/(auth)/login/page.tsx
- Create: src/app/(auth)/forgot-password/page.tsx
- Create: src/app/(auth)/reset-password/page.tsx
- Create: src/app/(auth)/applicant/register/page.tsx
- Create: src/app/auth/callback/route.ts
- Create: src/app/auth/callback/route.test.ts

**Interfaces:**
- Consumes the client form components, getSafeNextPath(), and createServerSupabaseClient().
- Produces the four requested public pages and GET(request: NextRequest).

- [ ] **Step 1: Write failing page and callback tests**

~~~ts
await expect(GET(new NextRequest(
  "http://localhost/auth/callback?code=abc&next=https://attacker.example",
))).resolves.toMatchObject({
  status: 307,
  headers: expect.objectContaining({ location: "http://localhost/" }),
});
expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
~~~

Mock the server client for missing code, exchange failure, and success. Add page assertions: login links to registration/recovery, recovery links to login, reset has both password inputs, and registration links to login.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: npm run test:run -- src/app/auth/callback/route.test.ts "src/app/(auth)"

Expected: FAIL because the routes and page wrappers do not exist.

- [ ] **Step 3: Implement pages and callback route**

~~~ts
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? "/login?error=callback" : nextPath, request.url));
}
~~~

Pages must use AuthCard for an accessible heading and explanatory text. The login page validates its next query value with getSafeNextPath before passing it to LoginForm.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: npm run test:run -- src/app/auth/callback/route.test.ts "src/app/(auth)"

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add -- "src/app/(auth)" src/app/auth/callback
git commit -m "feat: add authentication pages"
~~~

### Task 6: Make the landing page session-aware

**Files:**
- Modify: src/app/page.tsx
- Modify: src/app/page.test.tsx

**Interfaces:**
- Consumes getAuthenticatedUser() and SignOutButton.
- Produces a landing page with a Sign in link for visitors and Sign out button for verified users.

- [ ] **Step 1: Write failing server-component tests**

~~~tsx
getAuthenticatedUser.mockResolvedValue({ id: "id", email: "person@example.com" });
render(await Home());
expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
expect(screen.queryByRole("link", { name: /^sign in$/i })).not.toBeInTheDocument();
~~~

Mock getAuthenticatedUser and SignOutButton to cover anonymous and signed-in output without making Auth calls.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: npm run test:run -- src/app/page.test.tsx

Expected: FAIL because the page is not session-aware.

- [ ] **Step 3: Implement session-aware calls to action**

~~~tsx
export default async function Home() {
  const user = await getAuthenticatedUser();
  return user ? <SignOutButton /> : <Link href="/login">Sign in</Link>;
}
~~~

Retain the job-openings link and existing visual language; include the signed-in email only when it is non-null.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: npm run test:run -- src/app/page.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/app/page.tsx src/app/page.test.tsx
git commit -m "feat: add landing page sign out"
~~~

### Task 7: Implement and test the administrator invitation Edge Function

**Files:**
- Create: supabase/functions/invite-internal-user/index.ts
- Create: supabase/functions/invite-internal-user/index.test.ts
- Create: supabase/functions/invite-internal-user/deno.json

**Interfaces:**
- Consumes an Authorization JWT and Supabase runtime variables SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.
- Produces createInviteInternalUserHandler(dependencies): (request: Request) => Promise<Response>, with the production entrypoint passing that handler to Deno.serve. It returns { userId: string } with HTTP 201 or { error: string } with 400, 401, 403, 409, or 500.

- [ ] **Step 1: Write failing Deno handler tests**

~~~ts
Deno.test("rejects an applicant caller before inviting", async () => {
  const response = await handler(requestWith({ role: "employee" }));
  assertEquals(response.status, 403);
  assertEquals(invitationCount, 0);
});

Deno.test("assigns an invited account using the caller JWT", async () => {
  const response = await handler(requestWith({ role: "hr_personnel" }));
  assertEquals(response.status, 201);
  assertEquals(assignedRole, {
    role: "hr_personnel", assigned_by: ADMIN_ID,
  });
});
~~~

Set ADMIN_ID to "00000000-0000-4000-8000-000000000001". Define requestWith(body) as a POST Request with JSON content and `Authorization: Bearer test-token`; initialize handler with createInviteInternalUserHandler({ createCallerClient, createServiceClient, origin: "http://127.0.0.1:3000" }). The service fake increments invitationCount inside inviteUserByEmail; the caller fake assigns its update payload to assignedRole. Add cases for malformed JSON, missing bearer token, invalid JWT, non-admin role, invalid role, invite error, and role-update error with compensating deleteUser.

- [ ] **Step 2: Run the focused Deno test to verify it fails**

Run: deno test --allow-env supabase/functions/invite-internal-user/index.test.ts

Expected: FAIL because the handler does not exist.

- [ ] **Step 3: Implement the handler**

~~~ts
const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
  data: { full_name: fullName }, redirectTo: origin + "/auth/callback",
});
if (inviteError || !invited.user) return json(409, { error: "Unable to invite this account." });

const { error: roleError } = await callerClient
  .from("user_roles")
  .update({ role, assigned_by: caller.id })
  .eq("user_id", invited.user.id);
if (roleError) {
  await serviceClient.auth.admin.deleteUser(invited.user.id);
  return json(500, { error: "Unable to assign the account role." });
}
return json(201, { userId: invited.user.id });
~~~

Validate JSON before clients are called. Use callerClient.auth.getUser(token) then callerClient.from("user_roles").select("role") to require system_administrator. The caller JWT performs the role update under the existing admin RLS policy, so user_roles_write_audit_log records the administrator. Use the service client only for invite/delete Auth operations.

- [ ] **Step 4: Run the focused Deno test to verify it passes**

Run: deno test --allow-env supabase/functions/invite-internal-user/index.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add supabase/functions/invite-internal-user
git commit -m "feat: add internal account invitation function"
~~~

### Task 8: Configure redirects, document remote setup, and verify

**Files:**
- Modify: supabase/config.toml
- Modify: README.md

**Interfaces:**
- Consumes /auth/callback and the Edge Function runtime requirements.
- Produces local redirect configuration and exact hosted setup instructions.

- [ ] **Step 1: Write the configuration verification checklist**

~~~text
Local Supabase accepts http://127.0.0.1:3000/auth/callback.
Hosted Supabase includes https://<vercel-domain>/auth/callback in Auth Redirect URLs.
The Edge Function has SUPABASE_SERVICE_ROLE_KEY only in its server runtime.
No NEXT_PUBLIC_* variable contains a secret or service-role key.
~~~

- [ ] **Step 2: Verify current configuration fails the checklist**

Run: rg -n "additional_redirect_urls|auth/callback" supabase/config.toml README.md

Expected: /auth/callback is absent from the local additional_redirect_urls list and hosted setup is undocumented.

- [ ] **Step 3: Make the configuration and documentation changes**

~~~toml
[auth]
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = [
  "http://127.0.0.1:3000/auth/callback",
  "http://localhost:3000/auth/callback",
]
~~~

In README.md, require the project owner to add each Vercel Preview/Production callback URL in Supabase Auth Redirect URLs and deploy with npx supabase@latest functions deploy invite-internal-user. Document runtime-only Edge Function secrets without adding their values to source control.

- [ ] **Step 4: Run automated checks**

Run:

~~~bash
npm run lint
npm run typecheck
npm run test:run
npm run build
deno test --allow-env supabase/functions/invite-internal-user/index.test.ts
~~~

Expected: every command exits 0.

- [ ] **Step 5: Run the manual role and Auth verification**

Run: npx supabase@latest functions serve invite-internal-user --env-file supabase/.env.local

Verify: each fixture role signs in and signs out; an applicant self-registers; recovery reaches callback then reset page; anonymous /hr redirects to login; authenticated /hr no longer redirects (its page remains future feat/03 work); non-admin function callers get 403; System Administrators can invite every allowed role and each user_roles update has an audit record naming that administrator.

- [ ] **Step 6: Commit**

~~~bash
git add supabase/config.toml README.md
git commit -m "docs: configure authentication redirects"
~~~

## Final Branch Verification

- [ ] Confirm git status --short contains no credentials and no migration was added.
- [ ] Run npm run lint, npm run typecheck, npm run test:run, npm run build, and deno test --allow-env supabase/functions/invite-internal-user/index.test.ts after the final commit.
- [ ] Confirm anonymous visitors redirect from /admin, /hr, /employee, /management, and protected applicant paths, while /applicant/register is public.
- [ ] Inspect source and .env.example with rg -n "service_role|SUPABASE_SERVICE_ROLE_KEY" src .env.example and confirm no secret is exposed.
- [ ] Open a PR against main that names roadmap branch feat/02-authentication-pages, test results, the no-migration/RLS decision, required hosted redirect URLs, Edge Function deployment, and screenshots of all four public pages.
