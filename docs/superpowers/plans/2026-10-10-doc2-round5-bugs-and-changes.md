# Client Doc2 round 5 — bugs and changes (Branch 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the round-5 client notes' bugs, wording changes, and form/record/leave adjustments (Branch 1) without touching supervisor features or the Branch 2 features.

**Architecture:**
- Next.js 16 app router. Client components call Supabase through the query modules in `src/queries/*`, wrapped by React Query hooks in `src/hooks/*`.
- Database rules live in Supabase migrations: SECURITY DEFINER RPCs in `private.*` with `public.*` wrappers, plus triggers. Each database change is one new migration file with a pgTAP test in `supabase/tests/`.
- UI changes follow the existing components. No new design language: keep the app theme (navy sidebar band, green `primary`, Inter).

**Tech Stack:** Next.js 16.3, React 19, TypeScript, Zod 4, @tanstack/react-query 5, Supabase (Postgres + Auth + Edge Functions), Vitest + Testing Library, Playwright, pgTAP.

**Spec:** `docs/superpowers/specs/2026-10-10-doc2-round5-bugs-and-changes-design.md`

## Global Constraints

- Work on branch `fix/doc2-round5-bugs-and-changes`. Never commit to `main`.
- Before writing Next.js-specific code (routes, `params`), read the relevant guide in `node_modules/next/dist/docs/`, as AGENTS.md requires. Route `params` are a `Promise` and must be awaited, as in the existing pages.
- Exact user-facing copy:
  - duplicate email: **"This email is already registered."**
  - missing documents: **"Please submit all required documents."**
  - Final Evaluation tracker note: **"Under Final Deliberation"**
  - Final Evaluation notification: **"Your application is under final deliberation."**
  - deployment overlap: **"This employee is already deployed on that date."**
  - login notice: **"Email confirmed. Please log in."**
  - labels: **"Date Entered Service"**, **"Inclusive Dates (To)"**, **"IV. Government Identification"**, **"Years of service"**, button **"Update"**
- Religion options, in order: Roman Catholic, Islam, Iglesia ni Cristo (INC), Christian, Seventh-Day Adventist, Baptist, Jehovah's Witnesses, Others.
- Gender options for employees: Female and Male only (`female`, `male`).
- Government IDs are stored as digits only and displayed with dashes:
  - PhilHealth: 12 digits, `12-345678901-2`
  - Pag-IBIG: 12 digits, `XXXX-XXXX-XXXX`
  - GSIS: 11 digits, `XXXXXXXXXXX`
  - SSS is removed from every screen. The column and its data stay in the database untouched.
- Dates are displayed in words through `src/lib/format-date.ts` (`formatDate`, `formatDateTime`, `formatDateRange`).
- No new roles. No supervisor features. No attendance date/status filters.
- Database changes:
  - Every new migration keeps existing data and RLS boundaries.
  - `private.*` functions are revoked from `public, anon, authenticated`.
  - `public.*` RPCs are granted to `authenticated` only.
  - Migration filenames use the prefix `202610100900NN_`, numbered in task order.
- Commit after every task with a message ending in:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
- Test commands:
  - unit: `npx vitest run <path>`
  - database: `npx supabase db reset --local`, then `npx supabase test db`
  - e2e: `npm run test:e2e -- <spec>` (needs `npx supabase start` and a dev server per `playwright.config.ts`)
  - also `npm run lint` and `npm run typecheck`

## Review Focus

1. **A pre-existing overlap or a remarks-only edit.** A deployment that already overlaps another, or an edit that changes only the remarks, must still save. The overlap check fires only when the employee, dates or status change. Pinned in Task 5's pgTAP test ("editing only the remarks of a legacy overlapping deployment still works").
2. **A cancelled or completed deployment on the same day.** It must not block a new deployment. Pinned in Task 5's pgTAP test.
3. **An employee whose gender is null** (including a former "prefer not to say") must not see Maternity or Paternity, and the server must reject them. HR must be able to set the gender even though it was "locked". Pinned in Task 8's form test and Task 11's pgTAP and unit tests.
4. **Typing or pasting government IDs with dashes, spaces or extra digits.** The input keeps at most the allowed digits and re-formats; saving an existing employee never erases their hidden SSS number. Pinned in Task 9's helper test and query payload test.
5. **A sign-up confirmation link opened in a different browser** (no PKCE verifier). The user must see "Email confirmed. Please log in." rather than the invalid-link error, while a genuinely expired link (`error_code=otp_expired`) still shows the error. Pinned in Task 2's callback tests.

---

### Task 1: Duplicate-email message on registration and admin invite

**Files:**
- Create: `src/lib/auth/duplicate-email.ts`
- Create: `src/lib/auth/duplicate-email.test.ts`
- Modify: `src/components/auth/applicant-registration-form.tsx`
- Modify: `src/components/auth/applicant-registration-form.test.tsx`
- Modify: `supabase/functions/invite-internal-user/index.ts:77-79`

**Interfaces:**
- Produces:
  - `DUPLICATE_EMAIL_MESSAGE: "This email is already registered."`
  - `isDuplicateEmailError(error: { code?: string | null; message?: string | null } | null | undefined): boolean`
  - `isObfuscatedExistingUser(user: { identities?: unknown[] | null } | null | undefined): boolean`
  - Tasks 2 and 3 use `DUPLICATE_EMAIL_MESSAGE`.
  - The registration confirmation redirect is now always `/auth/callback?next=<path>&flow=signup`, with `next` defaulting to `/jobs`. Task 2 reads `flow`.

- [ ] **Step 1: Write the failing helper test** in `src/lib/auth/duplicate-email.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { DUPLICATE_EMAIL_MESSAGE, isDuplicateEmailError, isObfuscatedExistingUser } from "./duplicate-email";

describe("duplicate email detection", () => {
  it("uses the client's wording", () => {
    expect(DUPLICATE_EMAIL_MESSAGE).toBe("This email is already registered.");
  });

  it("recognises Supabase Auth duplicate errors by code or message", () => {
    expect(isDuplicateEmailError({ code: "user_already_exists", message: "x" })).toBe(true);
    expect(isDuplicateEmailError({ code: "email_exists", message: "x" })).toBe(true);
    expect(isDuplicateEmailError({ message: "User already registered" })).toBe(true);
    expect(isDuplicateEmailError({ message: "A user with this email address has already been registered" })).toBe(true);
  });

  it("ignores other errors and empty values", () => {
    expect(isDuplicateEmailError({ code: "weak_password", message: "Password is too weak" })).toBe(false);
    expect(isDuplicateEmailError(null)).toBe(false);
    expect(isDuplicateEmailError(undefined)).toBe(false);
  });

  it("detects the identity-less user Supabase returns for an existing email when confirmation is on", () => {
    expect(isObfuscatedExistingUser({ identities: [] })).toBe(true);
    expect(isObfuscatedExistingUser({ identities: [{ id: "1" }] })).toBe(false);
    expect(isObfuscatedExistingUser({})).toBe(false);
    expect(isObfuscatedExistingUser(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/auth/duplicate-email.test.ts`
Expected: FAIL — cannot resolve `./duplicate-email`.

- [ ] **Step 3: Implement** `src/lib/auth/duplicate-email.ts`

```ts
export const DUPLICATE_EMAIL_MESSAGE = "This email is already registered.";

type EmailErrorLike = { code?: string | null; message?: string | null } | null | undefined;

/** True for the errors Supabase Auth returns when an email address is already in use. */
export function isDuplicateEmailError(error: EmailErrorLike) {
  if (!error) return false;
  if (error.code === "user_already_exists" || error.code === "email_exists") return true;
  return /already (been )?registered|already exists/i.test(error.message ?? "");
}

/** With email confirmation on, signing up an existing email "succeeds" with a user that has no identities. */
export function isObfuscatedExistingUser(user: { identities?: unknown[] | null } | null | undefined) {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length === 0);
}
```

- [ ] **Step 4: Run the helper test and confirm it passes**

Run: `npx vitest run src/lib/auth/duplicate-email.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write failing registration tests.** Append to `src/components/auth/applicant-registration-form.test.tsx`, inside the `describe` block:

```tsx
  it("shows the duplicate-email message on the email field when the address is taken", async () => {
    const user = userEvent.setup();
    mocks.signUp.mockResolvedValue({ data: { user: null, session: null }, error: { code: "user_already_exists", message: "User already registered" } });
    render(<ApplicantRegistrationForm />);
    fillValidForm();
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(await screen.findByText("This email is already registered.")).toBeVisible();
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute("aria-invalid", "true");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("treats an identity-less sign-up result as an existing email", async () => {
    const user = userEvent.setup();
    mocks.signUp.mockResolvedValue({ data: { user: { id: "u", identities: [] }, session: null }, error: null });
    render(<ApplicantRegistrationForm />);
    fillValidForm();
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(await screen.findByText("This email is already registered.")).toBeVisible();
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
  });
```

Then change the existing test "normalizes the mobile number, sends structured account metadata, and opens job openings". Replace the line

```tsx
    expect(mocks.signUp.mock.calls[0]?.[0].options).not.toHaveProperty("emailRedirectTo");
```

with

```tsx
    const redirect = new URL(mocks.signUp.mock.calls[0]?.[0].options.emailRedirectTo);
    expect(redirect.pathname).toBe("/auth/callback");
    expect(redirect.searchParams.get("next")).toBe("/jobs");
    expect(redirect.searchParams.get("flow")).toBe("signup");
```

In the test "carries a safe next destination through confirmation and sign-in", add after the `next` assertion:

```tsx
    expect(redirect.searchParams.get("flow")).toBe("signup");
```

- [ ] **Step 6: Run the registration tests and confirm the new and changed ones fail**

Run: `npx vitest run src/components/auth/applicant-registration-form.test.tsx`
Expected: FAIL. The two new tests can't find "This email is already registered.". The redirect test fails because `emailRedirectTo` is undefined.

- [ ] **Step 7: Implement it in `src/components/auth/applicant-registration-form.tsx`**

Add the import:

```tsx
import { DUPLICATE_EMAIL_MESSAGE, isDuplicateEmailError, isObfuscatedExistingUser } from "@/lib/auth/duplicate-email";
```

Replace `confirmationRedirect`:

```tsx
/** Confirmation links return through the callback, which knows a sign-up link may be opened in another browser. */
function confirmationRedirect(nextPath: string) {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", nextPath);
  callback.searchParams.set("flow", "signup");
  return callback.toString();
}
```

In `signUp` options, replace

```tsx
          ...(nextPath ? { emailRedirectTo: confirmationRedirect(nextPath) } : {}),
```

with

```tsx
          emailRedirectTo: confirmationRedirect(nextPath ?? "/jobs"),
```

Replace the error/session handling block

```tsx
      if (authError) {
        setError("We could not create your account. Please try again.");
        return;
      }
```

with

```tsx
      if (authError) {
        if (isDuplicateEmailError(authError)) setFieldErrors({ email: DUPLICATE_EMAIL_MESSAGE });
        else setError("We could not create your account. Please try again.");
        return;
      }
      if (isObfuscatedExistingUser(data.user)) {
        setFieldErrors({ email: DUPLICATE_EMAIL_MESSAGE });
        return;
      }
```

Check the email `<input>`: it must get `aria-invalid` and the field error the way the other fields do. `FormField` renders the `error` text, but the input itself needs it too. If the email input lacks `aria-invalid`, add these props to it:

```tsx
aria-describedby={fieldErrors.email ? "registration-email-error" : undefined} aria-invalid={fieldErrors.email ? true : undefined}
```

To find the id that FormField gives its error element, open `src/components/ui/form-field.tsx` and use the same `${htmlFor}-error` convention that `PasswordField` uses.

- [ ] **Step 8: Run the registration tests and confirm they pass**

Run: `npx vitest run src/components/auth/applicant-registration-form.test.tsx src/lib/auth/duplicate-email.test.ts`
Expected: PASS.

- [ ] **Step 9: Make the admin invite return the duplicate message.** In `supabase/functions/invite-internal-user/index.ts`, replace

```ts
  if (inviteError || !invited.user) {
    return json(409, { error: "Unable to invite this account." });
  }
```

with

```ts
  if (inviteError || !invited.user) {
    // Mirrors isDuplicateEmailError in src/lib/auth/duplicate-email.ts (edge functions cannot import app code).
    const duplicate = Boolean(inviteError) && (
      inviteError?.code === "email_exists" || inviteError?.code === "user_already_exists"
      || /already (been )?registered|already exists/i.test(inviteError?.message ?? "")
    );
    return json(409, { error: duplicate ? "This email is already registered." : "Unable to invite this account." });
  }
```

`src/queries/administration.ts` already shows `payload.error`, so it needs no change.

- [ ] **Step 10: Check the edge function syntax**

Run: `npx deno check supabase/functions/invite-internal-user/index.ts`. If deno isn't installed, run `npx supabase functions serve invite-internal-user --no-verify-jwt` for a few seconds and confirm it boots without errors, then stop it.
Expected: no type errors.

- [ ] **Step 11: Commit**

```bash
git add src/lib/auth/duplicate-email.ts src/lib/auth/duplicate-email.test.ts src/components/auth/applicant-registration-form.tsx src/components/auth/applicant-registration-form.test.tsx supabase/functions/invite-internal-user/index.ts
git commit -m "fix: show 'This email is already registered.' on sign-up and invite

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Fix the "invalid or expired link" after registration

**Files:**
- Modify: `src/app/auth/callback/page.tsx`
- Modify: `src/app/auth/callback/page.test.tsx`
- Modify: `src/app/(auth)/login/page.tsx:58-85`
- Modify: `src/app/(auth)/login/page.test.tsx`
- Modify: `src/components/auth/login-form.tsx`

**Interfaces:**
- Consumes: `flow=signup` on the confirmation redirect (Task 1).
- Produces:
  - `/login?message=email_confirmed` shows "Email confirmed. Please log in.".
  - `LoginForm` gains an optional `notice?: string` prop.

- [ ] **Step 1: Write failing callback tests.** Append inside the `describe` in `src/app/auth/callback/page.test.tsx`:

```tsx
  it("verifies a sign-up token hash", async () => {
    mocks.searchParams = new URLSearchParams("token_hash=signup-token&type=signup&next=/jobs");
    mocks.verifyOtp.mockResolvedValue({ error: null });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "signup-token", type: "signup" }));
    expect(mocks.replace).toHaveBeenCalledWith("/jobs");
  });

  it("shows the invalid-link error straight away when Supabase reports an expired link", async () => {
    mocks.searchParams = new URLSearchParams("error=access_denied&error_code=otp_expired&flow=signup&next=/jobs");
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?error=invitation_expired"));
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("tells a new applicant their email is confirmed when the code cannot be exchanged in this browser", async () => {
    mocks.searchParams = new URLSearchParams("code=auth-code&flow=signup&next=/jobs");
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("code verifier missing") });
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?message=email_confirmed"));
  });

  it("keeps the invalid-link error for a failed non-sign-up code", async () => {
    mocks.searchParams = new URLSearchParams("code=auth-code&next=/reset-password");
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?error=invitation_expired"));
  });

  it("continues when the exchange fails but this browser is already signed in", async () => {
    mocks.searchParams = new URLSearchParams("code=used-code&flow=signup&next=/jobs");
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("already used") });
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    render(<AuthCallbackPage />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/jobs"));
  });
```

- [ ] **Step 2: Run the callback tests and confirm the new ones fail**

Run: `npx vitest run src/app/auth/callback/page.test.tsx`
Expected: the 5 new tests FAIL (signup isn't verified; error_code is ignored; failures always go to `invitation_expired`).

- [ ] **Step 3: Implement it.** Replace the body of `src/app/auth/callback/page.tsx` above `export default` with:

```tsx
"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getSafeNextPath } from "@/lib/auth/safe-redirect";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;
type OtpType = (typeof OTP_TYPES)[number];

function isOtpType(value: string | null): value is OtpType {
  return OTP_TYPES.includes(value as OtpType);
}

function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  // Supabase sends error / error_code back when the link itself was expired or already used.
  const linkError = searchParams.get("error_code") ?? searchParams.get("error");
  const signupFlow = searchParams.get("flow") === "signup";
  const nextPath = getSafeNextPath(searchParams.get("next"));

  useEffect(() => {
    let active = true;

    async function complete() {
      if (linkError) {
        if (active) router.replace("/login?error=invitation_expired");
        return;
      }
      const supabase = createBrowserSupabaseClient();
      let error: Error | null = null;

      if (tokenHash && isOtpType(type)) {
        ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
      } else if (code) {
        ({ error } = await supabase.auth.exchangeCodeForSession(code));
      } else {
        const result = await supabase.auth.getSession();
        error = result.error ?? (result.data.session ? null : new Error("Invitation session is missing."));
      }

      // A link that was already used may still have left this browser signed in.
      if (error && (code || tokenHash)) {
        const { data } = await supabase.auth.getSession();
        if (data.session) error = null;
      }

      if (!active) return;
      if (!error) router.replace(nextPath);
      // Supabase only redirects with a code after it confirmed the email, so a sign-up code that cannot be
      // exchanged here (opened in another browser) still means the account is confirmed.
      else router.replace(signupFlow && code ? "/login?message=email_confirmed" : "/login?error=invitation_expired");
    }

    void complete();
    return () => { active = false; };
  }, [code, linkError, nextPath, router, signupFlow, tokenHash, type]);

  return <p aria-live="polite">Completing sign-in…</p>;
}
```

Leave the `export default function AuthCallbackPage` at the bottom as it is.

- [ ] **Step 4: Run the callback tests and confirm they pass**

Run: `npx vitest run src/app/auth/callback/page.test.tsx`
Expected: PASS (all 8).

- [ ] **Step 5: Write a failing login-page test.** Append to `src/app/(auth)/login/page.test.tsx`, using the file's existing `render(await LoginPage({ searchParams: Promise.resolve(params) }))` helper pattern:

```tsx
  it("confirms a verified email instead of showing an error", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ message: "email_confirmed" }) }));
    expect(screen.getByRole("status")).toHaveTextContent("Email confirmed. Please log in.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
```

Make sure `screen` is imported from `@testing-library/react` at the top of the file. Add it if missing.

- [ ] **Step 6: Run it and confirm it fails**

Run: `npx vitest run "src/app/(auth)/login/page.test.tsx"`
Expected: FAIL — no status element.

- [ ] **Step 7: Implement it**

In `src/components/auth/login-form.tsx`:
- Add `notice?: string;` to `LoginFormProps`.
- Destructure it: `export function LoginForm({ error, mode, nextPath, notice }: LoginFormProps)`.
- Immediately before `{error ? <ErrorState message={error} /> : null}`, add:

```tsx
      {notice ? <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">{notice}</p> : null}
```

In `src/app/(auth)/login/page.tsx`:
- Change the `searchParams` type to `Promise<{ as?: string; error?: string; message?: string; next?: string }>`.
- Destructure `message`.
- Below `errorMessage`, add:

```tsx
  const notice = message === "email_confirmed" ? "Email confirmed. Please log in." : undefined;
```

- Pass it on: `<LoginForm error={errorMessage} mode={mode} nextPath={nextPath} notice={notice} />`.

- [ ] **Step 8: Run the auth tests and confirm they pass**

Run: `npx vitest run "src/app/(auth)/login" src/app/auth src/components/auth`
Expected: PASS.

- [ ] **Step 9: Manually verify locally with confirmation on**
  1. In `supabase/config.toml`, temporarily set `[auth.email] enable_confirmations = true` (line 226). Run `npx supabase stop && npx supabase start`, then `npm run dev`.
  2. Register at `/applicant/register`.
  3. Open the confirmation link from Inbucket/Mailpit (`npx supabase status` shows its URL) in a **private window**. Expect `/login` with "Email confirmed. Please log in.". Log in.
  4. Revert `config.toml` (`git checkout supabase/config.toml`) and restart Supabase.
  5. Note for the PR description: the production Supabase **Redirect URLs** allow-list must include `https://<prod-domain>/auth/callback**`.

- [ ] **Step 10: Commit**

```bash
git add src/app/auth/callback src/app/\(auth\)/login src/components/auth/login-form.tsx
git commit -m "fix: confirm sign-up links opened in another browser instead of showing an invalid-link error

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Unique employee personal email

**Files:**
- Create: `supabase/migrations/20261010090001_unique_employee_personal_email.sql`
- Create: `supabase/tests/employee_personal_email_unique.test.sql`
- Modify: `src/queries/personnel-records.ts` (`saveEmployee`)
- Modify: `src/queries/personnel-records.test.ts`

**Interfaces:**
- Consumes: `DUPLICATE_EMAIL_MESSAGE` from `src/lib/auth/duplicate-email.ts` (Task 1).
- Produces: unique index `employees_personal_email_unique_idx` on `lower(personal_email)`. `saveEmployee` throws `Error("This email is already registered.")` when that index is violated.

- [ ] **Step 1: Write the failing pgTAP test** in `supabase/tests/employee_personal_email_unique.test.sql`

```sql
begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(3);

select extensions.has_index('public', 'employees', 'employees_personal_email_unique_idx', 'Employee personal emails have a unique index');

insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on)
values ('00000000-0000-4000-8000-000000002101', 'UNQ-001', 'Unique', 'One', 'same.person@example.test', '2024-01-01');

select extensions.throws_ok(
  $$insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on)
    values ('00000000-0000-4000-8000-000000002102', 'UNQ-002', 'Unique', 'Two', 'Same.Person@EXAMPLE.test', '2024-01-01')$$,
  '23505', null, 'A second employee cannot reuse an email, even in a different letter case'
);
select extensions.lives_ok(
  $$insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on)
    values ('00000000-0000-4000-8000-000000002103', 'UNQ-003', 'Unique', 'Three', 'other.person@example.test', '2024-01-01')$$,
  'A different email is accepted'
);

select * from extensions.finish();

rollback;
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx supabase db reset --local && npx supabase test db`
Expected: `employee_personal_email_unique.test.sql` FAILS on `has_index` and `throws_ok`.

- [ ] **Step 3: Write the migration** `supabase/migrations/20261010090001_unique_employee_personal_email.sql`

```sql
-- Client round 5 (2026-10-10): an email can belong to only one personnel record.
-- Existing duplicates are reported by name instead of failing on an opaque index error.

do $$
declare
  duplicates text;
begin
  select string_agg(email, ', ' order by email) into duplicates
  from (
    select lower(personal_email) as email
    from public.employees
    where personal_email is not null
    group by lower(personal_email)
    having count(*) > 1
  ) as repeated;

  if duplicates is not null then
    raise exception 'Fix duplicate employee personal emails before applying this migration: %', duplicates;
  end if;
end;
$$;

create unique index employees_personal_email_unique_idx
  on public.employees (lower(personal_email))
  where personal_email is not null;
```

- [ ] **Step 4: Run the database tests and confirm they pass**

Run: `npx supabase db reset --local && npx supabase test db`
Expected: every file passes, including the new one. If `seed.sql` contains duplicate personal emails, the reset fails with the migration's message. In that case fix the duplicate rows in `supabase/seed.sql`, giving each employee a distinct email, and re-run.

- [ ] **Step 5: Write the failing query test.** Append inside `describe("saveEmployee", …)` in `src/queries/personnel-records.test.ts`:

```ts
    it("explains a duplicate personal email in the client's words", async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "employees_personal_email_unique_idx"' } });
      const select = vi.fn(() => ({ single }));
      from.mockReturnValue({ insert: vi.fn(() => ({ select })) });

      await expect(saveEmployee({ ...baseInput, departmentId: 3, rankId: 7 })).rejects.toThrow("This email is already registered.");
    });
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `npx vitest run src/queries/personnel-records.test.ts`
Expected: FAIL — the thrown message is the raw Postgres text.

- [ ] **Step 7: Implement it.** In `src/queries/personnel-records.ts`, add the import:

```ts
import { DUPLICATE_EMAIL_MESSAGE } from "@/lib/auth/duplicate-email";
```

In `saveEmployee`, replace `throwIfError(result.error);` with:

```ts
  if (result.error?.code === "23505" && result.error.message.includes("employees_personal_email_unique_idx")) {
    throw new Error(DUPLICATE_EMAIL_MESSAGE);
  }
  throwIfError(result.error);
```

- [ ] **Step 8: Run the query tests and confirm they pass**

Run: `npx vitest run src/queries/personnel-records.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20261010090001_unique_employee_personal_email.sql supabase/tests/employee_personal_email_unique.test.sql src/queries/personnel-records.ts src/queries/personnel-records.test.ts supabase/seed.sql
git commit -m "fix: reject a personnel email that is already registered

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Applicant missing-document error and "Under Final Deliberation"

**Files:**
- Modify: `src/components/recruitment/applicant-application-form.tsx`
- Modify: `src/components/recruitment/applicant-application-form.test.tsx`
- Modify: `src/components/recruitment/applicant-apply-workspace.tsx`
- Modify: `src/components/recruitment/applicant-profile-documents.tsx` (props and the card `<li>` at ~line 117)
- Modify: `src/components/recruitment/application-status-tracker.tsx` (`reviewDetails`)
- Modify: `src/components/recruitment/application-status-tracker.test.tsx`
- Create: `supabase/migrations/20261010090002_final_deliberation_message.sql`
- Modify: `supabase/tests/applicant_pdf_recruitment_workflow.test.sql`. Only if it asserts the old "Final Evaluation" message text: `grep -n "in Final Evaluation" supabase/tests/*.sql`.

**Interfaces:**
- Produces:
  - `ApplicantApplicationForm` prop `onMissingDocuments?: () => void`
  - `ApplicantProfileDocuments` prop `highlightMissing?: boolean`

- [ ] **Step 1: Rewrite the two blocking tests.** In `src/components/recruitment/applicant-application-form.test.tsx`, replace the test "disables Submit until all five required documents are saved" with:

```tsx
  it("shows a red error naming the missing documents when Submit is clicked too early", async () => {
    const user = userEvent.setup();
    const onMissingDocuments = vi.fn();
    mocks.documents.mockReturnValue({ data: allFive.slice(0, 4), error: null, isLoading: false });
    render(<ApplicantApplicationForm jobId={7} onMissingDocuments={onMissingDocuments} />);

    const button = screen.getByRole("button", { name: "Submit application" });
    expect(button).toBeEnabled();
    await user.click(button);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Please submit all required documents.");
    expect(alert).toHaveTextContent("Still needed: Diploma");
    expect(onMissingDocuments).toHaveBeenCalledOnce();
    expect(mocks.submit).not.toHaveBeenCalled();
  });
```

Replace "blocks Submit while a chosen replacement document is not saved yet" with:

```tsx
  it("explains that a chosen replacement must be saved first", async () => {
    const user = userEvent.setup();
    render(<ApplicantApplicationForm hasUnsavedDocuments jobId={7} />);
    await user.click(screen.getByRole("button", { name: "Submit application" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Save or cancel the file you chose above before submitting.");
    expect(mocks.submit).not.toHaveBeenCalled();
  });
```

The labels come from `APPLICANT_PROFILE_DOCUMENT_KINDS` in `src/schemas/applicant-portal.ts`. Check that the diploma label is exactly "Diploma" and adjust the expectation to match if it differs.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/components/recruitment/applicant-application-form.test.tsx`
Expected: FAIL — the button is disabled.

- [ ] **Step 3: Implement the form change** in `src/components/recruitment/applicant-application-form.tsx`

Change the signature:

```tsx
export function ApplicantApplicationForm({ jobId, hasUnsavedDocuments = false, onMissingDocuments }: { jobId: number; hasUnsavedDocuments?: boolean; onMissingDocuments?: () => void }) {
```

Replace the first guard in `onSubmit`:

```tsx
    if (!status.complete || !savedResume) {
      setError(`Please submit all required documents. Still needed: ${status.missing.map(({ label }) => label).join(", ")}.`);
      onMissingDocuments?.();
      return;
    }
```

Delete the `blockedReason` constant. Replace the `<div className="space-y-2">…</div>` button block with:

```tsx
      <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting} type="submit">{submitting ? "Submitting…" : "Submit application"}</button>
```

The error is already rendered through `<ErrorState message={error} />`, which has `role="alert"` and the destructive (red) styling.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/components/recruitment/applicant-application-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Outline the missing cards.** In `src/components/recruitment/applicant-profile-documents.tsx`:
- Change the signature to:
  ```tsx
  export function ApplicantProfileDocuments({ onPendingChange, highlightMissing = false }: { onPendingChange?: (pending: boolean) => void; highlightMissing?: boolean } = {}) {
  ```
- Import `cn` from `@/lib/utils` if it isn't imported yet.
- Replace `return <li className="rounded-xl border p-4" key={kind}>` with:
  ```tsx
  const flagged = highlightMissing && !document && !chosen;
  return <li className={cn("rounded-xl border p-4", flagged && "border-destructive ring-1 ring-destructive/30")} key={kind}>
  ```
- Directly under the `<p className="mt-1 text-xs text-muted-foreground">{formats}</p>` line, add:
  ```tsx
  {flagged ? <p className="mt-1 text-xs font-medium text-destructive">Required — not saved yet</p> : null}
  ```

In `src/components/recruitment/applicant-apply-workspace.tsx`, add `const [highlightMissing, setHighlightMissing] = useState(false);` and pass the new props:

```tsx
    <ApplicantProfileDocuments highlightMissing={highlightMissing} onPendingChange={setHasUnsavedDocuments} />
    <ApplicantApplicationForm hasUnsavedDocuments={hasUnsavedDocuments} jobId={job.data.id} onMissingDocuments={() => setHighlightMissing(true)} />
```

- [ ] **Step 6: Write a failing tracker test.** Append to `src/components/recruitment/application-status-tracker.test.tsx`:

```tsx
  it("tells the applicant their application is under final deliberation", () => {
    const finalStep = applicationStatusSteps("Final Evaluation").find((step) => step.label === "Final Evaluation");
    expect(finalStep?.detail).toBe("Under Final Deliberation");
  });
```

Import `applicationStatusSteps` from `./application-status-tracker` if the file doesn't already.

- [ ] **Step 7: Run it and confirm it fails, then implement and re-run**

Run: `npx vitest run src/components/recruitment/application-status-tracker.test.tsx`
Expected: FAIL.

In `reviewDetails`, change the `"Final Evaluation"` entry to `"Under Final Deliberation"`. Re-run.
Expected: PASS.

- [ ] **Step 8: Write the notification-text migration** `supabase/migrations/20261010090002_final_deliberation_message.sql`

```sql
-- Client round 5 (2026-10-10): the Final Evaluation note reads "Under Final Deliberation".
create or replace function private.application_status_message(target_status text)
returns text language sql immutable set search_path = '' as $$
  select case target_status
    when 'Application Submission' then 'Your application is now under review.'
    when 'Physical Agility Test' then 'You are scheduled for the Physical Agility Test.'
    when 'Physical & Medical Examination' then 'You are proceeding to the Physical & Medical Examination.'
    when 'Neuro-Psychiatric Examination' then 'You are proceeding to the Neuro-Psychiatric Examination.'
    when 'Drug Test' then 'You are proceeding to the Drug Test.'
    when 'Character & Background Investigation' then 'Your character and background investigation is in progress.'
    when 'Panel Interview' then 'You are proceeding to the Panel Interview.'
    when 'Final Evaluation' then 'Your application is under final deliberation.'
    when 'Shortlisted' then 'You have been shortlisted.'
    when 'Not Selected' then 'You were not selected for this opening.'
    else 'Your application status is now ' || target_status || '.'
  end;
$$;

revoke all on function private.application_status_message(text) from public, anon, authenticated;
```

- [ ] **Step 9: Run the database tests**

Run: `grep -rn "in Final Evaluation" supabase/tests src e2e`. Update any hit to "Your application is under final deliberation.". Then run `npx supabase db reset --local && npx supabase test db`.
Expected: PASS.

- [ ] **Step 10: Run the recruitment unit tests**

Run: `npx vitest run src/components/recruitment`
Expected: PASS. If `applicant-profile-documents` or workspace tests assert the old disabled button, update them to the new behaviour (button enabled; alert on click).

- [ ] **Step 11: Commit**

```bash
git add src/components/recruitment supabase/migrations/20261010090002_final_deliberation_message.sql supabase/tests
git commit -m "fix: red missing-documents error on submit and 'Under Final Deliberation' wording

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Block double-booked deployments and restore the End date field

**Files:**
- Create: `supabase/migrations/20261010090003_prevent_overlapping_deployments.sql`
- Create: `supabase/tests/deployment_overlap.test.sql`
- Modify: `src/components/deployment-tracking/deployment-form.tsx` (lines 40-46 and 116-118)
- Modify: `src/components/deployment-tracking/deployment-form.test.tsx`
- Modify: `e2e/capstone-objectives.spec.ts` (`createDeployment` helper ~line 85, plus the validation block ~line 308)

**Interfaces:**
- Produces:
  - The trigger `deployments_prevent_overlap` raises SQLSTATE `23P01` with the message "This employee is already deployed on that date.".
  - The form now submits `endsOn` from a visible optional "End date" input.

- [ ] **Step 1: Write the failing pgTAP test** `supabase/tests/deployment_overlap.test.sql`

```sql
begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(8);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-000000002201', 'authenticated', 'authenticated', 'overlap-hr@example.test', now(), now());
update public.user_roles set role = 'hr_personnel'::public.app_role where user_id = '00000000-0000-4000-8000-000000002201'::uuid;

insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on)
values
  ('00000000-0000-4000-8000-000000002211', 'OVL-001', 'Overlap', 'One', 'overlap-one@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000002212', 'OVL-002', 'Overlap', 'Two', 'overlap-two@example.test', '2024-01-01');

-- A legacy overlap that existed before the rule (inserted with the trigger not yet relevant: same employee, same day).
alter table public.deployments disable trigger deployments_prevent_overlap;
insert into public.deployments (id, employee_id, location, assignment_role, starts_on, status, notes, created_by_user_id, updated_by_user_id)
values
  ('00000000-0000-4000-8000-000000002291', '00000000-0000-4000-8000-000000002212', 'Legacy A', 'Legacy A', '2099-05-01', 'scheduled', 'a', '00000000-0000-4000-8000-000000002201', '00000000-0000-4000-8000-000000002201'),
  ('00000000-0000-4000-8000-000000002292', '00000000-0000-4000-8000-000000002212', 'Legacy B', 'Legacy B', '2099-05-01', 'scheduled', 'b', '00000000-0000-4000-8000-000000002201', '00000000-0000-4000-8000-000000002201');
alter table public.deployments enable trigger deployments_prevent_overlap;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002201';

select extensions.lives_ok(
  $$select public.create_deployment('00000000-0000-4000-8000-000000002211'::uuid, 'Plaza', null, null, 'Plaza', '2099-01-10', '2099-01-12', 'scheduled', 'Fiesta', 'Special Event', 'Fiesta / Major Event')$$,
  'HR deploys an employee for three days'
);
select extensions.throws_ok(
  $$select public.create_deployment('00000000-0000-4000-8000-000000002211'::uuid, 'Market', null, null, 'Market', '2099-01-12', null, 'scheduled', 'Rally', 'Public Assembly', 'Rally')$$,
  '23P01', 'This employee is already deployed on that date.', 'A one-day deployment inside an active range is rejected'
);
select extensions.throws_ok(
  $$select public.create_deployment('00000000-0000-4000-8000-000000002211'::uuid, 'Market', null, null, 'Market', '2099-01-08', '2099-01-10', 'ongoing', 'Rally', 'Public Assembly', 'Rally')$$,
  '23P01', 'This employee is already deployed on that date.', 'A range touching the first day is rejected'
);
select extensions.lives_ok(
  $$select public.create_deployment('00000000-0000-4000-8000-000000002211'::uuid, 'Market', null, null, 'Market', '2099-01-13', null, 'scheduled', 'Rally', 'Public Assembly', 'Rally')$$,
  'The day after the range is free'
);
select extensions.lives_ok(
  $$select public.create_deployment('00000000-0000-4000-8000-000000002211'::uuid, 'Hall', null, null, 'Hall', '2099-01-11', null, 'cancelled', 'Called off', 'Public Assembly', 'Rally')$$,
  'A cancelled deployment on a busy day is allowed'
);
select extensions.lives_ok(
  $$select public.create_deployment('00000000-0000-4000-8000-000000002212'::uuid, 'Plaza', null, null, 'Plaza', '2099-01-11', null, 'scheduled', 'Other person', 'Special Event', 'Fiesta / Major Event')$$,
  'Another employee can be deployed on the same day'
);
select extensions.lives_ok(
  $$select public.update_deployment('00000000-0000-4000-8000-000000002291'::uuid,
      (select updated_at from public.deployments where id = '00000000-0000-4000-8000-000000002291'),
      'Legacy A', null, null, 'Legacy A', '2099-05-01', null, 'scheduled', 'remarks changed', null, null)$$,
  'Editing only the remarks of a legacy overlapping deployment still works'
);
select extensions.throws_ok(
  $$select public.update_deployment(
      (select id from public.deployments where location = 'Market' and starts_on = '2099-01-13'),
      (select updated_at from public.deployments where location = 'Market' and starts_on = '2099-01-13'),
      'Market', null, null, 'Market', '2099-01-11', null, 'scheduled', 'moved', 'Public Assembly', 'Rally')$$,
  '23P01', 'This employee is already deployed on that date.', 'Moving a deployment onto a busy day is rejected'
);

select * from extensions.finish();

rollback;
```

The legacy rows insert directly with `deployment_type`/`event_operation` null. If a check constraint rejects null there, add `'Special Event', 'Fiesta / Major Event'` to those inserts and the update call. Check with `grep -n "deployment_type" supabase/migrations/20261002100000_deployment_type_event_and_statuses.sql`.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx supabase db reset --local && npx supabase test db`
Expected: FAIL — `trigger "deployments_prevent_overlap" … does not exist`.

- [ ] **Step 3: Write the migration** `supabase/migrations/20261010090003_prevent_overlapping_deployments.sql`

```sql
-- Client round 5 (2026-10-10): an employee cannot be deployed twice on the same date.
-- A deployment occupies [starts_on, coalesce(ends_on, starts_on)]. Only scheduled and ongoing
-- deployments block each other. The check runs only when the employee, dates, or status change, so
-- editing the remarks of an older overlapping record still works.

create function private.prevent_overlapping_deployments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('scheduled', 'ongoing') then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and (new.employee_id, new.starts_on, new.ends_on, new.status) is not distinct from (old.employee_id, old.starts_on, old.ends_on, old.status) then
    return new;
  end if;

  -- Serialise checks per employee so two simultaneous saves cannot both pass.
  perform pg_advisory_xact_lock(hashtext('deployment:' || new.employee_id::text));

  if exists (
    select 1
    from public.deployments as other
    where other.employee_id = new.employee_id
      and other.id <> new.id
      and other.status in ('scheduled', 'ongoing')
      and daterange(other.starts_on, coalesce(other.ends_on, other.starts_on), '[]')
        && daterange(new.starts_on, coalesce(new.ends_on, new.starts_on), '[]')
  ) then
    raise exception 'This employee is already deployed on that date.' using errcode = '23P01';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_overlapping_deployments() from public, anon, authenticated;

create trigger deployments_prevent_overlap
  before insert or update on public.deployments
  for each row execute function private.prevent_overlapping_deployments();
```

- [ ] **Step 4: Run the database tests and confirm they pass**

Run: `npx supabase db reset --local && npx supabase test db`
Expected: PASS. If `deployment_tracking.test.sql` or `seed.sql` now fail because they create two active deployments for one employee on overlapping dates, change those dates so they don't overlap. Never weaken the trigger.

- [ ] **Step 5: Write a failing form test.** Append to `src/components/deployment-tracking/deployment-form.test.tsx`, reusing that file's render/mocking setup and its existing submit helper. If it has no helper, follow the pattern of its first submit test:

```tsx
  it("lets HR set an optional end date and sends it", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<DeploymentForm deployment={existingDeployment} onSaved={onSaved} />);
    await user.clear(screen.getByLabelText(/^End date/));
    await user.type(screen.getByLabelText(/^End date/), "2099-01-12");
    await user.click(screen.getByRole("button", { name: "Save deployment" }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ endsOn: "2099-01-12" }));
  });
```

`existingDeployment` must be the fixture this test file already uses for an existing deployment, with `starts_on` before 2099-01-12. If its name differs, use that name. If the fixture has a later start, set the typed date to the day after `starts_on`.

- [ ] **Step 6: Run it and confirm it fails**

Run: `npx vitest run src/components/deployment-tracking/deployment-form.test.tsx`
Expected: FAIL — no "End date" field.

- [ ] **Step 7: Implement it** in `src/components/deployment-tracking/deployment-form.tsx`

In `submit`, replace

```tsx
      // Existing end dates are preserved; they are not edited from this form.
      endsOn: deployment?.ends_on || null,
```

with

```tsx
      endsOn: typeof values.endsOn === "string" && values.endsOn ? values.endsOn : null,
```

Directly after the "Start date" `FormField`, add:

```tsx
      <FormField description="Optional. Leave blank for a one-day deployment." error={e.endsOn} htmlFor="ends-on" label="End date">
        <Input defaultValue={deployment?.ends_on ?? ""} id="ends-on" name="endsOn" type="date" />
      </FormField>
```

Change `if (errors.form || errors.endsOn) setError(errors.form ?? errors.endsOn ?? null);` to `if (errors.form) setError(errors.form);`, because the end-date error now shows under its own field.

- [ ] **Step 8: Run the form tests and confirm they pass**

Run: `npx vitest run src/components/deployment-tracking`
Expected: PASS.

- [ ] **Step 9: Keep the e2e tests from colliding with the new rule.** In `e2e/capstone-objectives.spec.ts`, above `createDeployment`, add:

```ts
/** A distinct far-future start day per created deployment, so repeated runs never double-book the demo employee. */
let deploymentDayCounter = 0;
function uniqueDeploymentDay() {
  deploymentDayCounter += 1;
  const seed = Number.parseInt(runId.replace(/\D/g, "").slice(-6) || "0", 10);
  return 3650 + ((seed * 7 + deploymentDayCounter) % 20000);
}
```

In `createDeployment`, change `.fill(isoDate(0))` to `.fill(isoDate(uniqueDeploymentDay()))`. In the validation block around line 308, the `Start date` fill used before `createDeployment` stays `isoDate(0)`, because that form is never saved.

`runId` and `isoDate` already exist in this file. If `runId` has no digits, the `|| "0"` fallback keeps the result valid.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20261010090003_prevent_overlapping_deployments.sql supabase/tests src/components/deployment-tracking e2e/capstone-objectives.spec.ts supabase/seed.sql
git commit -m "fix: block deploying the same employee twice on one date

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Read-only deployment details, separate Update page, readable history

**Files:**
- Create: `src/lib/deployment-tracking/history-labels.ts`
- Create: `src/lib/deployment-tracking/history-labels.test.ts`
- Create: `src/components/deployment-tracking/hr-deployment-details.tsx`
- Create: `src/components/deployment-tracking/hr-deployment-details.test.tsx`
- Create: `src/app/(app)/hr/deployments/[deploymentId]/edit/page.tsx`
- Modify: `src/app/(app)/hr/deployments/[deploymentId]/page.tsx`
- Modify: `src/components/deployment-tracking/hr-deployment-editor.tsx`
- Modify: `src/queries/deployment-tracking.ts` (`DeploymentWithHistory`, `getDeployment`)
- Modify: `e2e/capstone-objectives.spec.ts` (deployment block ~lines 315-321)

**Interfaces:**
- Produces:
  - `describeDeploymentEvent(event: { event_type: DeploymentHistory["event_type"]; metadata: Record<string, unknown> }, actorName: string | null): string`
  - `DeploymentWithHistory = Deployment & { deployment_history: (DeploymentHistory & { actor: { full_name: string | null } | null })[]; employee: { id: string; employee_number: string; first_name: string; middle_name: string | null; last_name: string } | null }`
  - Route `/hr/deployments/[id]/edit`.

- [ ] **Step 1: Write the failing label test** `src/lib/deployment-tracking/history-labels.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { describeDeploymentEvent } from "./history-labels";

describe("describeDeploymentEvent", () => {
  it("names who created the deployment", () => {
    expect(describeDeploymentEvent({ event_type: "created", metadata: {} }, "Juan Dela Cruz")).toBe("Deployment created by Juan Dela Cruz");
  });

  it("spells out a status change with readable labels", () => {
    expect(describeDeploymentEvent({ event_type: "status_changed", metadata: { before: { status: "scheduled" }, after: { status: "ongoing" } } }, "Ana Reyes"))
      .toBe("Status changed from Scheduled to Ongoing by Ana Reyes");
  });

  it("describes other edits and copes with a missing actor or metadata", () => {
    expect(describeDeploymentEvent({ event_type: "updated", metadata: {} }, null)).toBe("Details updated");
    expect(describeDeploymentEvent({ event_type: "status_changed", metadata: {} }, null)).toBe("Status changed");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/deployment-tracking/history-labels.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `src/lib/deployment-tracking/history-labels.ts`

```ts
import { deploymentStatusLabels } from "@/components/deployment-tracking/deployment-status-badge";
import type { DeploymentHistory, DeploymentStatus } from "@/lib/types/database";

function statusLabel(metadata: Record<string, unknown>, side: "before" | "after") {
  const snapshot = metadata[side];
  const status = snapshot && typeof snapshot === "object" ? (snapshot as { status?: unknown }).status : undefined;
  return typeof status === "string" && status in deploymentStatusLabels ? deploymentStatusLabels[status as DeploymentStatus] : null;
}

/** "Deployment created by …", "Status changed from Scheduled to Ongoing by …", or "Details updated by …". */
export function describeDeploymentEvent(event: Pick<DeploymentHistory, "event_type" | "metadata">, actorName: string | null) {
  const by = actorName ? ` by ${actorName}` : "";
  if (event.event_type === "created") return `Deployment created${by}`;
  if (event.event_type === "status_changed") {
    const before = statusLabel(event.metadata, "before");
    const after = statusLabel(event.metadata, "after");
    return before && after ? `Status changed from ${before} to ${after}${by}` : `Status changed${by}`;
  }
  return `Details updated${by}`;
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run src/lib/deployment-tracking/history-labels.test.ts`
Expected: PASS.

- [ ] **Step 5: Load the employee and the history actor with the deployment.** In `src/queries/deployment-tracking.ts`, replace the `DeploymentWithHistory` type and the select inside `getDeployment`:

```ts
export type DeploymentHistoryEntry = DeploymentHistory & { actor: { full_name: string | null } | null };
export type DeploymentEmployee = { id: string; employee_number: string; first_name: string; middle_name: string | null; last_name: string };
export type DeploymentWithHistory = Deployment & { deployment_history: DeploymentHistoryEntry[]; employee: DeploymentEmployee | null };
```

```ts
  const { data, error } = await createBrowserSupabaseClient()
    .from("deployments")
    .select("*, employee:employees(id, employee_number, first_name, middle_name, last_name), deployment_history(*, actor:profiles(full_name))")
    .eq("id", id)
    .maybeSingle();
```

Run `npx vitest run src/queries/deployment-tracking.test.ts`. If a test asserts the old select string, update it to the new one.

- [ ] **Step 6: Write the failing details test** `src/components/deployment-tracking/hr-deployment-details.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const deployment = {
  id: "00000000-0000-4000-8000-000000000901", employee_id: "e1", location: "Whiteplains, EDSA", unit: null, unit_station_id: null, project: null,
  assignment_role: "Whiteplains, EDSA", starts_on: "2026-10-10", ends_on: null, status: "scheduled", notes: "Fiesta",
  deployment_type: "Special Event", event_operation: "Fiesta / Major Event", created_by_user_id: null, updated_by_user_id: null,
  created_at: "2026-10-09T10:12:00Z", updated_at: "2026-10-09T10:12:00Z",
  employee: { id: "e1", employee_number: "1-60482", first_name: "Maria", middle_name: null, last_name: "Balneg" },
  deployment_history: [{ id: 1, deployment_id: "00000000-0000-4000-8000-000000000901", actor_user_id: "u1", event_type: "created", metadata: {}, created_at: "2026-10-09T10:12:00Z", actor: { full_name: "Juan Dela Cruz" } }],
};

vi.mock("@/hooks/use-deployment-tracking", () => ({ useDeployment: () => ({ data: deployment, isLoading: false, error: null }) }));

import { HrDeploymentDetails } from "./hr-deployment-details";

describe("HrDeploymentDetails", () => {
  it("shows the assignment read-only with an Update link and readable history", () => {
    render(<HrDeploymentDetails deploymentId={deployment.id} />);
    expect(screen.getByText("Maria Balneg")).toBeVisible();
    expect(screen.getByText("Whiteplains, EDSA")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Update" })).toHaveAttribute("href", `/hr/deployments/${deployment.id}/edit`);
    expect(screen.getByText("Deployment created by Juan Dela Cruz")).toBeVisible();
    expect(screen.queryByText(/^created$/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run it and confirm it fails**

Run: `npx vitest run src/components/deployment-tracking/hr-deployment-details.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 8: Implement** `src/components/deployment-tracking/hr-deployment-details.tsx`

```tsx
"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useDeployment } from "@/hooks/use-deployment-tracking";
import { describeDeploymentEvent } from "@/lib/deployment-tracking/history-labels";
import { formatDate, formatDateTime } from "@/lib/format-date";

import { DeploymentStatusBadge } from "./deployment-status-badge";

function Detail({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-medium break-words">{children || <span className="font-normal text-muted-foreground">Not provided</span>}</dd>
    </div>
  );
}

/** Read-only view of one deployment; changes happen on the separate Update page. */
export function HrDeploymentDetails({ deploymentId }: { deploymentId: string }) {
  const detail = useDeployment(deploymentId);
  if (detail.isLoading) return <LoadingState label="Loading deployment…" />;
  if (detail.error || !detail.data) return <ErrorState message={detail.error?.message ?? "Deployment not found."} />;
  const deployment = detail.data;
  const employee = deployment.employee;
  const employeeName = employee ? [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(" ") : null;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">Current status <DeploymentStatusBadge deployment={deployment} /></p>
        <Link className={buttonVariants()} href={`/hr/deployments/${deployment.id}/edit`}>Update</Link>
      </div>
      <dl className="grid gap-x-6 gap-y-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <Detail label="Employee">{employeeName ? <>{employeeName}<span className="block text-sm font-normal text-muted-foreground tabular-nums">Badge no. {employee?.employee_number}</span></> : null}</Detail>
        <Detail label="Location">{deployment.location}</Detail>
        <Detail label="Deployment type">{deployment.deployment_type}</Detail>
        <Detail label="Event / Operation">{deployment.event_operation}</Detail>
        <Detail label="Start date">{formatDate(deployment.starts_on)}</Detail>
        <Detail label="End date">{formatDate(deployment.ends_on) ?? "One-day deployment"}</Detail>
        <Detail label="Remarks" wide>{deployment.notes}</Detail>
      </dl>
      <section>
        <h2 className="mb-3 text-xl font-bold">History</h2>
        <ol className="space-y-2">
          {deployment.deployment_history.map((event) => (
            <li className="rounded-lg border p-3 text-sm" key={event.id}>
              <p className="font-medium">{describeDeploymentEvent(event, event.actor?.full_name ?? null)}</p>
              <p className="text-muted-foreground">{formatDateTime(event.created_at)}</p>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
```

`useDeployment` is typed through `getDeployment`, so `deployment.employee` and `event.actor` type-check after Step 5.

- [ ] **Step 9: Run it and confirm it passes**

Run: `npx vitest run src/components/deployment-tracking/hr-deployment-details.test.tsx`
Expected: PASS.

- [ ] **Step 10: Wire up the routes and slim the editor.** Read `node_modules/next/dist/docs/` on dynamic route segments first, to confirm the `params: Promise<…>` signature.

Replace `src/app/(app)/hr/deployments/[deploymentId]/page.tsx` with:

```tsx
import { HrDeploymentDetails } from "@/components/deployment-tracking/hr-deployment-details";
import { PageHeader } from "@/components/ui/page-header";

export default async function DeploymentDetailPage({ params }: { params: Promise<{ deploymentId: string }> }) {
  const { deploymentId } = await params;
  return <section className="space-y-4"><PageHeader description="Assignment details and every change made to it." title="Deployment details" /><HrDeploymentDetails deploymentId={deploymentId} /></section>;
}
```

Create `src/app/(app)/hr/deployments/[deploymentId]/edit/page.tsx`:

```tsx
import { HrDeploymentEditor } from "@/components/deployment-tracking/hr-deployment-editor";
import { PageHeader } from "@/components/ui/page-header";

export default async function UpdateDeploymentPage({ params }: { params: Promise<{ deploymentId: string }> }) {
  const { deploymentId } = await params;
  return <section className="space-y-4"><PageHeader description="Change this assignment. Every change is kept in its history." title="Update deployment" /><HrDeploymentEditor deploymentId={deploymentId} /></section>;
}
```

Replace `src/components/deployment-tracking/hr-deployment-editor.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useCreateDeployment, useDeployment, useUpdateDeployment } from "@/hooks/use-deployment-tracking";

import { DeploymentForm } from "./deployment-form";

/** New-deployment and Update pages. Saving returns to the read-only details page. */
export function HrDeploymentEditor({ deploymentId }: { deploymentId?: string }) {
  const router = useRouter();
  const detail = useDeployment(deploymentId ?? "");
  const create = useCreateDeployment();
  const update = useUpdateDeployment();
  if (deploymentId && detail.isLoading) return <LoadingState label="Loading deployment…" />;
  if (deploymentId && (detail.error || !detail.data)) return <ErrorState message={detail.error?.message ?? "Deployment not found."} />;
  const deployment = detail.data;

  return (
    <section className="space-y-6">
      {deployment ? <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/hr/deployments/${deployment.id}`}>Back to deployment details</Link> : null}
      <DeploymentForm
        deployment={deployment ?? undefined}
        pending={create.isPending || update.isPending}
        onSaved={async (input) => {
          if (deployment) {
            await update.mutateAsync({ ...input, id: deployment.id, expectedUpdatedAt: deployment.updated_at });
            router.push(`/hr/deployments/${deployment.id}`);
          } else {
            const id = await create.mutateAsync(input);
            router.push(`/hr/deployments/${id}`);
          }
        }}
      />
    </section>
  );
}
```

- [ ] **Step 11: Run the deployment unit tests**

Run: `npx vitest run src/components/deployment-tracking src/queries/deployment-tracking.test.ts`
Expected: PASS. If `deployment-tracking.test.tsx` rendered `HrDeploymentEditor` expecting a "History" heading or raw event names, move those assertions to the details component, or delete them if the new details test already covers them.

- [ ] **Step 12: Update the e2e deployment block.** In `e2e/capstone-objectives.spec.ts`, replace the lines from `await createDeployment(page, role);` through `await expect(page.getByText(/History/).first()).toBeVisible();` with:

```ts
    await createDeployment(page, role);
    await expect(page.getByText("Deployment created by").first()).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await page.getByRole("link", { name: "Update" }).click();
    await expect(page).toHaveURL(/\/hr\/deployments\/[0-9a-f-]{36}\/edit$/);
    await page.getByLabel(/^Remarks/).fill(`Oplan Ligtas ${runId}`);
    await page.getByRole("button", { name: "Save deployment" }).click();
    await expect(page).toHaveURL(/\/hr\/deployments\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByText(`Oplan Ligtas ${runId}`)).toBeVisible();
    await expect(page.getByText("Details updated by").first()).toBeVisible();
```

- [ ] **Step 13: Commit**

```bash
git add src/lib/deployment-tracking src/components/deployment-tracking src/app/\(app\)/hr/deployments src/queries/deployment-tracking.ts src/queries/deployment-tracking.test.ts e2e/capstone-objectives.spec.ts
git commit -m "feat: read-only deployment details with a separate Update page and readable history

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: HR attendance — Name column and View link

**Files:**
- Modify: `src/queries/attendance-integration.ts` (`listHrAttendanceLogs` return type)
- Modify: `src/components/attendance-integration/hr-attendance-directory.tsx`
- Modify: `src/components/attendance-integration/attendance-integration.test.tsx`. This is the test that renders `HrAttendanceDirectory`; confirm with `grep -ln HrAttendanceDirectory src/components/attendance-integration/*.test.tsx`.

**Interfaces:**
- Produces: `AttendanceLogWithEmployee = AttendanceLog & { employee: { id: string; employee_number: string; first_name: string; last_name: string } | null }`. `listHrAttendanceLogs` returns `PaginatedResult<AttendanceLogWithEmployee, AttendanceFilters>`.

- [ ] **Step 1: Write the failing test.** In the test file that renders `HrAttendanceDirectory`, add a row fixture with `employee: { id: "00000000-0000-4000-8000-000000000111", employee_number: "1-60482", first_name: "Maria", last_name: "Balneg" }` to the mocked `useHrAttendanceLogs` data, and add:

```tsx
  it("names each employee and links to their details", () => {
    render(<HrAttendanceDirectory />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeVisible();
    expect(screen.getByText("Maria Balneg")).toBeVisible();
    expect(screen.getByRole("link", { name: "View Maria Balneg" })).toHaveAttribute("href", "/hr/employees/00000000-0000-4000-8000-000000000111");
  });
```

If that file mocks `useHrAttendanceLogs` with a shared fixture, add the `employee` field to the fixture instead of creating a new one.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/components/attendance-integration`
Expected: FAIL — no "Name" column header.

- [ ] **Step 3: Implement it**

In `src/queries/attendance-integration.ts`, add:

```ts
export type AttendanceLogWithEmployee = AttendanceLog & { employee: Pick<Employee, "id" | "employee_number" | "first_name" | "last_name"> | null };
```

Change `listHrAttendanceLogs`'s return type to `Promise<PaginatedResult<AttendanceLogWithEmployee, AttendanceFilters>>` and its `rows` cast to `as AttendanceLogWithEmployee[]`.

In `hr-attendance-directory.tsx`:
- Add a `Name` header after `Date`.
- Add an Actions header at the end: `<th className="px-4 py-3 font-semibold text-muted-foreground" scope="col"><span className="sr-only">Actions</span></th>`.
- Change the empty-row `colSpan={6}` to `colSpan={8}`.
- Build each row as:

```tsx
            {rows.length ? rows.map((row) => {
              const name = row.employee ? `${row.employee.first_name} ${row.employee.last_name}` : null;
              return (
                <tr className="border-t" key={row.id}>
                  <td className="px-4 py-3 align-top whitespace-nowrap">{formatDate(row.attendance_date)}</td>
                  <td className="px-4 py-3 align-top">{name ? <><span className="block font-medium">{name}</span><span className="block text-muted-foreground tabular-nums">{row.employee?.employee_number}</span></> : <span className="text-muted-foreground">Unknown employee</span>}</td>
                  <td className="px-4 py-3 align-top">{row.external_employee_id}</td>
                  <td className="px-4 py-3 align-top tabular-nums">{formatAttendanceTime(row.time_in)}</td>
                  <td className="px-4 py-3 align-top tabular-nums">{formatAttendanceTime(row.time_out)}</td>
                  <td className="px-4 py-3 align-top"><AttendanceStatusBadge status={row.status} /></td>
                  <td className="px-4 py-3 align-top">{row.capture_method === "face_recognition" ? "Face scan" : "Import"}</td>
                  <td className="px-4 py-3 align-top text-right">
                    <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/hr/employees/${row.employee_id}`}>View<span className="sr-only"> {name ?? "employee"}</span></Link>
                  </td>
                </tr>
              );
            }) : (
```

Change the table's `min-w-[640px]` to `min-w-[820px]`.

Note: the accessible name is "View" plus the sr-only text, giving "View Maria Balneg". If Testing Library normalises it as "View Maria Balneg", the test passes as written.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/components/attendance-integration src/queries/attendance-integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/queries/attendance-integration.ts src/components/attendance-integration
git commit -m "feat: show employee names on HR attendance with a View link to their details

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Employee form — religion dropdown, gender, phone placeholder, service dates

**Files:**
- Create: `supabase/migrations/20261010090004_employee_gender_female_male.sql`
- Modify: `supabase/tests/personnel_records.test.sql`. Append the constraint assertions; also update the `plan(n)` count.
- Modify: `src/schemas/personnel-records.ts`
- Modify: `src/components/personnel-records/employee-form.tsx`
- Modify: `src/components/personnel-records/employee-form.test.tsx`
- Modify: `src/components/personnel-records/employee-record-detail.tsx` (`genderLabels`, `OfficialDetails`)
- Modify: `src/lib/types/database.ts:134` (`Employee.gender`)
- Modify: `e2e/capstone-objectives.spec.ts:66,70`

**Interfaces:**
- Produces:
  - `RELIGIONS` (readonly tuple, in the Global Constraints order), exported from `src/schemas/personnel-records.ts`
  - `Employee["gender"]` is `"female" | "male" | null`
  - Form field names are unchanged: `religion`, `gender`, `employmentStartedOn`, `employmentEndedOn`

- [ ] **Step 1: Write the failing form tests.** Append to `src/components/personnel-records/employee-form.test.tsx`, reusing its existing render helper and providers. Use its existing `employee` fixture name; the snippet below calls it `savedEmployee`.

```tsx
  it("offers the client's religion list as a dropdown", () => {
    renderForm();
    const religion = screen.getByLabelText(/^Religion/);
    expect(religion.tagName).toBe("SELECT");
    expect(within(religion).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Select a religion", "Roman Catholic", "Islam", "Iglesia ni Cristo (INC)", "Christian", "Seventh-Day Adventist", "Baptist", "Jehovah's Witnesses", "Others",
    ]);
  });

  it("offers only Female and Male", () => {
    renderForm();
    expect(within(screen.getByLabelText(/^Gender/)).queryByRole("option", { name: "Prefer not to say" })).not.toBeInTheDocument();
  });

  it("lets HR set a gender that was cleared even on a saved record", () => {
    renderForm({ employee: { ...savedEmployee, gender: null } });
    expect(screen.getByLabelText(/^Gender/)).toBeEnabled();
  });

  it("puts the phone format inside the box and renames the service dates", () => {
    renderForm();
    expect(screen.getByLabelText(/^Phone number/, { selector: "#phone" })).toHaveAttribute("placeholder", "+639XXXXXXXXX");
    expect(screen.queryByText("Format: +639XXXXXXXXX")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Date Entered Service/)).toHaveAttribute("type", "date");
    expect(screen.getByLabelText(/^Inclusive Dates \(To\)/)).not.toBeRequired();
    expect(screen.queryByText("Employment start date")).not.toBeInTheDocument();
  });
```

If the file has no `renderForm` helper, define one at the top of the `describe` that renders `<EmployeeForm onSaved={vi.fn()} {...props} />` inside whatever wrapper the existing tests use. Import `within` from `@testing-library/react`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/components/personnel-records/employee-form.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update the schema** in `src/schemas/personnel-records.ts`
- Change `const genders = ["female", "male", "prefer_not_to_say"] as const;` to `const genders = ["female", "male"] as const;`.
- Add, after `civilStatuses`:

```ts
/** Religion choices requested by the adviser (2026-10-10). Older free-text values stay valid and are shown as-is. */
export const RELIGIONS = [
  "Roman Catholic",
  "Islam",
  "Iglesia ni Cristo (INC)",
  "Christian",
  "Seventh-Day Adventist",
  "Baptist",
  "Jehovah's Witnesses",
  "Others",
] as const;
```

- Change the religion message to `religion: requiredText(120, "Choose a religion."),`.
- Change the `employmentStartedOn` messages to `"Enter the date entered service."` and `"Enter a valid date."`.
- Change the `employmentEndedOn` comment to `// Inclusive Dates (To): optional, for retired personnel.`.
- Change the refine message to `"Inclusive Dates (To) cannot be before the Date Entered Service."`.

- [ ] **Step 4: Update the form** in `src/components/personnel-records/employee-form.tsx`
- Import `RELIGIONS` with `employeeSchema`.
- Delete the hidden `employmentEndedOn` input and its comment (lines 100-101).
- Replace the Gender `NativeSelect` options with just the placeholder, Female and Male, removing the `prefer_not_to_say` option. `locked.gender` is already `Boolean(employee?.gender)`, so a null gender stays editable.
- Replace the Religion field with:

```tsx
        <FormField description={locked.religion ? lockedNote : undefined} error={e.religion} htmlFor="religion" label="Religion" required>
          <NativeSelect className={cn(locked.religion && lockedClassName)} defaultValue={employee?.religion ?? ""} disabled={locked.religion} id="religion" name={locked.religion ? undefined : "religion"} required>
            <option value="">Select a religion</option>
            {RELIGIONS.map((religion) => <option key={religion} value={religion}>{religion}</option>)}
            {employee?.religion && !(RELIGIONS as readonly string[]).includes(employee.religion) ? <option value={employee.religion}>{employee.religion}</option> : null}
          </NativeSelect>
        </FormField>
        {locked.religion && employee?.religion ? <input name="religion" type="hidden" value={employee.religion} /> : null}
```

- On both phone `FormField`s, remove `description="Format: +639XXXXXXXXX"`. `PhoneInput` already sets `placeholder="+639XXXXXXXXX"`.
- Replace the employment start `FormField` with:

```tsx
        <FormField
          description={locked.employmentStartedOn ? lockedNote : undefined}
          error={e.employmentStartedOn}
          htmlFor="employment-started-on"
          label="Date Entered Service"
          required
        >
          <Input className={cn("h-11", locked.employmentStartedOn && lockedClassName)} defaultValue={employee?.employment_started_on ?? ""} id="employment-started-on" name="employmentStartedOn" readOnly={locked.employmentStartedOn} required type="date" />
        </FormField>
        <FormField description="Optional. For retired personnel." error={e.employmentEndedOn} htmlFor="employment-ended-on" label="Inclusive Dates (To)">
          <Input className="h-11" defaultValue={employee?.employment_ended_on ?? ""} id="employment-ended-on" name="employmentEndedOn" type="date" />
        </FormField>
```

`submit` already maps `employmentEndedOn: form.employmentEndedOn || undefined`.

- [ ] **Step 5: Update the types and read-only view**
- In `src/lib/types/database.ts`, change the `Employee` `gender` (line 134) to `gender: "female" | "male" | null;`. Leave the applicant type at line 252 alone.
- In `employee-record-detail.tsx`:
  - Change `genderLabels` to `const genderLabels: Record<NonNullable<Employee["gender"]>, string> = { female: "Female", male: "Male" };`.
  - In `OfficialDetails` "III. Employment", replace `{ label: "Employment start date", … }` with:

```tsx
        { label: "Date Entered Service", value: formatDate(record.employment_started_on) },
        { label: "Inclusive Dates (To)", value: formatDate(record.employment_ended_on) },
```

Run `grep -rn "prefer_not_to_say\|Prefer not to say\|Employment start date" src --include=*.tsx --include=*.ts | grep -v applicant`. Fix any remaining employee-side hits the same way. Leave applicant files alone.

- [ ] **Step 6: Write the migration** `supabase/migrations/20261010090004_employee_gender_female_male.sql`

```sql
-- Client round 5 (2026-10-10): personnel gender is Female or Male only. Records that said
-- "prefer not to say" are cleared so HR can set them (the form unlocks an empty gender).
update public.employees set gender = null where gender = 'prefer_not_to_say';

alter table public.employees
  drop constraint employees_gender_check,
  add constraint employees_gender_check check (gender is null or gender in ('female', 'male'));
```

Append to `supabase/tests/personnel_records.test.sql`, before `finish()`, and raise `plan(n)` by 1:

```sql
select extensions.throws_ok(
  $$insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on, gender)
    values ('00000000-0000-4000-8000-000000002301', 'GEN-001', 'Gender', 'Check', 'gender-check@example.test', '2024-01-01', 'prefer_not_to_say')$$,
  '23514', null, 'Personnel gender no longer accepts prefer not to say'
);
```

If that test file switches to `authenticated` before its end, place this assertion while the role is still `postgres`, or add `set local role postgres;` immediately before it.

- [ ] **Step 7: Run the unit and database tests**

Run: `npx vitest run src/components/personnel-records src/schemas` and then `npx supabase db reset --local && npx supabase test db`.
Expected: PASS. Fix existing tests and fixtures that use `gender: "prefer_not_to_say"` for employees or type into Religion. Change them to `"female"`/`"male"` and use `selectOption`. Fix the same in `supabase/seed.sql` if the reset fails.

- [ ] **Step 8: Update the e2e form helper.** In `e2e/capstone-objectives.spec.ts`, change `await page.getByLabel(/^Religion/).fill("Roman Catholic");` to `await page.getByLabel(/^Religion/).selectOption("Roman Catholic");`, and `getByLabel(/^Employment start date/)` to `getByLabel(/^Date Entered Service/)`.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20261010090004_employee_gender_female_male.sql supabase/tests/personnel_records.test.sql supabase/seed.sql src/schemas/personnel-records.ts src/components/personnel-records src/lib/types/database.ts e2e/capstone-objectives.spec.ts
git commit -m "feat: religion dropdown, Female/Male gender, Date Entered Service and Inclusive Dates (To)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: IV. Government Identification — PhilHealth, GSIS, Pag-IBIG (SSS hidden)

**Files:**
- Create: `supabase/migrations/20261010090005_gsis_pagibig_numbers.sql`
- Modify: `supabase/tests/employee_government_ids.test.sql`
- Modify: `src/lib/government-ids.ts`, `src/lib/government-ids.test.ts`
- Create: `src/components/ui/government-id-input.tsx`
- Modify: `src/schemas/personnel-records.ts`
- Modify: `src/queries/personnel-records.ts` (`employeePayload`, `updateMyGovernmentIds`), `src/queries/personnel-records.test.ts`
- Modify: `src/components/personnel-records/employee-form.tsx`, `employee-form.test.tsx`
- Modify: `src/components/personnel-records/employee-record-detail.tsx` (`OfficialDetails`)
- Modify: `src/components/personnel-records/government-ids-card.tsx`, `government-ids-card.test.tsx`
- Modify: `src/components/personnel-records/employee-profile.tsx` (the `GovernmentIdsCard` props it passes)
- Modify: `src/lib/types/database.ts` (`Employee`: add `gsis_number`, `pagibig_number`)

**Interfaces:**
- Produces:
  - `GOVERNMENT_ID_FORMATS: { philhealth: { digits: 12; groups: [2, 9, 1]; placeholder: "12-345678901-2" }; gsis: { digits: 11; groups: [11]; placeholder: "XXXXXXXXXXX" }; pagibig: { digits: 12; groups: [4, 4, 4]; placeholder: "XXXX-XXXX-XXXX" } }`
  - `type GovernmentIdKind = "philhealth" | "gsis" | "pagibig"`
  - `formatGovernmentId(kind: GovernmentIdKind, value: string | null | undefined): string`
  - `<GovernmentIdInput kind={…} defaultValue={…} id name />`
  - Schemas: `gsisNumberSchema`, `pagibigNumberSchema`, and `governmentIdsSchema = { philhealthNumber, gsisNumber, pagibigNumber }`
  - The `employeeSchema` field `sssNumber` is removed; `gsisNumber` and `pagibigNumber` are added.
  - RPC `public.update_my_government_ids(target_philhealth_number text, target_gsis_number text, target_pagibig_number text)`

- [ ] **Step 1: Write failing helper tests.** Append to `src/lib/government-ids.test.ts`:

```ts
import { formatGovernmentId, GOVERNMENT_ID_FORMATS } from "./government-ids";

describe("formatGovernmentId", () => {
  it("formats each ID with the client's dashes while typing", () => {
    expect(formatGovernmentId("philhealth", "123456789012")).toBe("12-345678901-2");
    expect(formatGovernmentId("philhealth", "123")).toBe("12-3");
    expect(formatGovernmentId("pagibig", "123456789012")).toBe("1234-5678-9012");
    expect(formatGovernmentId("gsis", "12345678901")).toBe("12345678901");
  });

  it("drops non-digits and anything past the allowed length", () => {
    expect(formatGovernmentId("pagibig", "1234-5678-9012-999")).toBe("1234-5678-9012");
    expect(formatGovernmentId("gsis", "12 345 678 901 23")).toBe("12345678901");
    expect(formatGovernmentId("philhealth", null)).toBe("");
  });

  it("publishes the placeholders shown inside each box", () => {
    expect(GOVERNMENT_ID_FORMATS.philhealth.placeholder).toBe("12-345678901-2");
    expect(GOVERNMENT_ID_FORMATS.pagibig.placeholder).toBe("XXXX-XXXX-XXXX");
    expect(GOVERNMENT_ID_FORMATS.gsis.placeholder).toBe("XXXXXXXXXXX");
  });
});
```

Merge the import into the file's existing import line from `./government-ids`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/lib/government-ids.test.ts`
Expected: FAIL — `formatGovernmentId` is not exported.

- [ ] **Step 3: Implement the helper.** Append to `src/lib/government-ids.ts`:

```ts
/** Digit counts, dash grouping and the in-box placeholder for each government ID on the personnel record. */
export const GOVERNMENT_ID_FORMATS = {
  philhealth: { digits: 12, groups: [2, 9, 1], placeholder: "12-345678901-2" },
  gsis: { digits: 11, groups: [11], placeholder: "XXXXXXXXXXX" },
  pagibig: { digits: 12, groups: [4, 4, 4], placeholder: "XXXX-XXXX-XXXX" },
} as const;

export type GovernmentIdKind = keyof typeof GOVERNMENT_ID_FORMATS;

/** Keeps only the allowed number of digits and inserts the dashes, so it works for saved values and while typing. */
export function formatGovernmentId(kind: GovernmentIdKind, value: string | null | undefined) {
  const { digits, groups } = GOVERNMENT_ID_FORMATS[kind];
  const clean = (value ?? "").replace(/\D/g, "").slice(0, digits);
  const parts: string[] = [];
  let index = 0;
  for (const size of groups) {
    if (index >= clean.length) break;
    parts.push(clean.slice(index, index + size));
    index += size;
  }
  return parts.join("-");
}
```

- [ ] **Step 4: Run them and confirm they pass**

Run: `npx vitest run src/lib/government-ids.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the input** `src/components/ui/government-id-input.tsx`

```tsx
"use client";

import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { formatGovernmentId, GOVERNMENT_ID_FORMATS, type GovernmentIdKind } from "@/lib/government-ids";

type GovernmentIdInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "defaultValue" | "placeholder"> & {
  kind: GovernmentIdKind;
  defaultValue?: string | null;
};

/** Digits-only government ID box: the format is shown inside it and dashes are added as you type. */
export function GovernmentIdInput({ kind, defaultValue, ...props }: GovernmentIdInputProps) {
  const format = GOVERNMENT_ID_FORMATS[kind];
  const [value, setValue] = useState(() => formatGovernmentId(kind, defaultValue));
  return (
    <Input
      autoComplete="off"
      className="h-11 tabular-nums"
      inputMode="numeric"
      maxLength={format.digits + format.groups.length - 1}
      placeholder={format.placeholder}
      {...props}
      onChange={(event) => setValue(formatGovernmentId(kind, event.target.value))}
      value={value}
    />
  );
}
```

- [ ] **Step 6: Update the schemas** in `src/schemas/personnel-records.ts`
- Below `philhealthNumberSchema`, add:

```ts
export const gsisNumberSchema = governmentIdNumber(11, "Enter an 11-digit GSIS number.");
export const pagibigNumberSchema = governmentIdNumber(12, "Enter a 12-digit Pag-IBIG number.");
```

- Replace `governmentIdsSchema` with:

```ts
export const governmentIdsSchema = z.object({ philhealthNumber: philhealthNumberSchema, gsisNumber: gsisNumberSchema, pagibigNumber: pagibigNumberSchema });
```

- In `employeeSchema`, replace `sssNumber: sssNumberSchema,` with `gsisNumber: gsisNumberSchema,` and `pagibigNumber: pagibigNumberSchema,`, keeping `philhealthNumber`.
- Keep the exported `sssNumberSchema`, which other code or tests may import, but nothing in the forms uses it any more.

- [ ] **Step 7: Write failing query tests.** In `src/queries/personnel-records.test.ts`, inside `describe("saveEmployee", …)`:

```ts
    it("saves GSIS and Pag-IBIG as digits and never touches the hidden SSS number", async () => {
      const table = mockTable();
      await saveEmployee({ ...baseInput, departmentId: 3, rankId: 7, gsisNumber: "12345678901", pagibigNumber: "1234-5678-9012", philhealthNumber: "12-345678901-2" }, employeeId);
      const values = table.update.mock.calls[0]![0];
      expect(values).toMatchObject({ gsis_number: "12345678901", pagibig_number: "123456789012", philhealth_number: "123456789012" });
      expect(values).not.toHaveProperty("sss_number");
    });
```

Add a new test at the top level of the file's `describe`:

```ts
  it("saves the employee's own PhilHealth, GSIS and Pag-IBIG numbers", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await updateMyGovernmentIds({ philhealthNumber: "12-345678901-2", gsisNumber: "12345678901", pagibigNumber: "1234-5678-9012" });
    expect(rpc).toHaveBeenCalledWith("update_my_government_ids", {
      target_philhealth_number: "123456789012",
      target_gsis_number: "12345678901",
      target_pagibig_number: "123456789012",
    });
  });
```

Add `updateMyGovernmentIds` to the import from `./personnel-records`.

- [ ] **Step 8: Run them and confirm they fail, then implement**

Run: `npx vitest run src/queries/personnel-records.test.ts`
Expected: FAIL.

In `employeePayload`, replace

```ts
    sss_number: input.sssNumber ?? null, philhealth_number: input.philhealthNumber ?? null, department_id: input.departmentId ?? null,
```

with

```ts
    philhealth_number: input.philhealthNumber ?? null, gsis_number: input.gsisNumber ?? null, pagibig_number: input.pagibigNumber ?? null,
    department_id: input.departmentId ?? null,
```

Replace the body of `updateMyGovernmentIds`, and update its doc comment to "PhilHealth, GSIS and Pag-IBIG":

```ts
  const parsed = governmentIdsSchema.parse(input);
  const { error } = await createBrowserSupabaseClient().rpc("update_my_government_ids", {
    target_philhealth_number: parsed.philhealthNumber ?? "",
    target_gsis_number: parsed.gsisNumber ?? "",
    target_pagibig_number: parsed.pagibigNumber ?? "",
  });
  throwIfError(error);
```

Re-run.
Expected: PASS.

- [ ] **Step 9: Write the migration** `supabase/migrations/20261010090005_gsis_pagibig_numbers.sql`

```sql
-- Client round 5 (2026-10-10): "IV. Government Identification" holds PhilHealth, GSIS and Pag-IBIG.
-- SSS is no longer shown or edited; sss_number and its data are kept untouched.
-- GSIS is the 11-digit BP number; Pag-IBIG is 12 digits (XXXX-XXXX-XXXX). Both are stored as digits only.

alter table public.employees
  add column gsis_number text check (gsis_number is null or gsis_number ~ '^[0-9]{11}$'),
  add column pagibig_number text check (pagibig_number is null or pagibig_number ~ '^[0-9]{12}$');

drop function public.update_my_government_ids(text, text);

create function public.update_my_government_ids(target_philhealth_number text, target_gsis_number text, target_pagibig_number text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  own_employee uuid := private.require_active_employee_self();
  clean_philhealth text := nullif(regexp_replace(coalesce(target_philhealth_number, ''), '[\s-]', '', 'g'), '');
  clean_gsis text := nullif(regexp_replace(coalesce(target_gsis_number, ''), '[\s-]', '', 'g'), '');
  clean_pagibig text := nullif(regexp_replace(coalesce(target_pagibig_number, ''), '[\s-]', '', 'g'), '');
begin
  if clean_philhealth is not null and clean_philhealth !~ '^[0-9]{12}$' then
    raise exception 'Enter a 12-digit PhilHealth number.' using errcode = '22023';
  end if;
  if clean_gsis is not null and clean_gsis !~ '^[0-9]{11}$' then
    raise exception 'Enter an 11-digit GSIS number.' using errcode = '22023';
  end if;
  if clean_pagibig is not null and clean_pagibig !~ '^[0-9]{12}$' then
    raise exception 'Enter a 12-digit Pag-IBIG number.' using errcode = '22023';
  end if;

  update public.employees
  set philhealth_number = clean_philhealth, gsis_number = clean_gsis, pagibig_number = clean_pagibig
  where id = own_employee;

  -- The numbers themselves stay out of the audit log.
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values ((select auth.uid()), 'employees', own_employee::text, 'government_ids_updated', jsonb_build_object(
    'philhealth_number_set', clean_philhealth is not null,
    'gsis_number_set', clean_gsis is not null,
    'pagibig_number_set', clean_pagibig is not null
  ));
end;
$$;

revoke all on function public.update_my_government_ids(text, text, text) from public, anon;
grant execute on function public.update_my_government_ids(text, text, text) to authenticated, service_role;
```

- [ ] **Step 10: Update the database test** `supabase/tests/employee_government_ids.test.sql`
- Change `has_function(... array['text', 'text'] ...)` to `array['text', 'text', 'text']`.
- Add `has_column` checks for `gsis_number` and `pagibig_number`.
- Replace every `public.update_my_government_ids('34-1234567-8', '12-345678901-2')`-style call with the new 3-argument order, `(philhealth, gsis, pagibig)`.
- Replace the SSS assertions with GSIS/Pag-IBIG ones. Keep one assertion that `sss_number` is unchanged after the employee saves:

```sql
update public.employees set sss_number = '3412345678' where id = '00000000-0000-4000-8000-000000001711';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001702';
select public.update_my_government_ids('12-345678901-2', '12345678901', '1234-5678-9012');
select extensions.is(
  (select array[philhealth_number, gsis_number, pagibig_number, sss_number] from public.employees where id = '00000000-0000-4000-8000-000000001711'),
  array['123456789012', '12345678901', '123456789012', '3412345678'],
  'The employee saves PhilHealth, GSIS and Pag-IBIG as digits and the hidden SSS number is untouched'
);
select extensions.throws_ok($$select public.update_my_government_ids(null, '123', null)$$, '22023', null, 'A short GSIS number is rejected');
select extensions.throws_ok($$select public.update_my_government_ids(null, null, '1234')$$, '22023', null, 'A short Pag-IBIG number is rejected');
```

Recount the assertions and set `plan(n)` to match.

Run: `npx supabase db reset --local && npx supabase test db`
Expected: PASS.

- [ ] **Step 11: Write a failing form test.** Append to `employee-form.test.tsx`:

```tsx
  it("groups PhilHealth, GSIS and Pag-IBIG under IV. Government Identification with in-box formats", () => {
    renderForm();
    const section = screen.getByRole("group", { name: "IV. Government Identification" });
    expect(within(section).getByLabelText(/^PhilHealth number/)).toHaveAttribute("placeholder", "12-345678901-2");
    expect(within(section).getByLabelText(/^GSIS number/)).toHaveAttribute("placeholder", "XXXXXXXXXXX");
    expect(within(section).getByLabelText(/^Pag-IBIG number/)).toHaveAttribute("placeholder", "XXXX-XXXX-XXXX");
    expect(screen.queryByLabelText(/^SSS number/)).not.toBeInTheDocument();
  });
```

`<fieldset>` with a `<legend>` gives the `group` role, named after the legend.

- [ ] **Step 12: Run it and confirm it fails, then implement the form section**

Run: `npx vitest run src/components/personnel-records/employee-form.test.tsx`
Expected: FAIL.

In `employee-form.tsx`:
- Remove the SSS and PhilHealth `FormField`s from section I.
- Swap the `formatPhilHealthNumber, formatSssNumber` import for `import { GovernmentIdInput } from "@/components/ui/government-id-input";`.
- After the `III. Employment` `FormSection`, add:

```tsx
      <FormSection title="IV. Government Identification">
        <FormField description="Optional." error={e.philhealthNumber} htmlFor="philhealth-number" label="PhilHealth number">
          <GovernmentIdInput defaultValue={employee?.philhealth_number} id="philhealth-number" kind="philhealth" name="philhealthNumber" />
        </FormField>
        <FormField description="Optional." error={e.gsisNumber} htmlFor="gsis-number" label="GSIS number">
          <GovernmentIdInput defaultValue={employee?.gsis_number} id="gsis-number" kind="gsis" name="gsisNumber" />
        </FormField>
        <FormField description="Optional." error={e.pagibigNumber} htmlFor="pagibig-number" label="Pag-IBIG number">
          <GovernmentIdInput defaultValue={employee?.pagibig_number} id="pagibig-number" kind="pagibig" name="pagibigNumber" />
        </FormField>
      </FormSection>
```

In `src/lib/types/database.ts`, add `gsis_number: string | null;` and `pagibig_number: string | null;` next to `philhealth_number` in `Employee`.

In `employee-record-detail.tsx` `OfficialDetails`, after "III. Employment" add the following, and import `formatGovernmentId` from `@/lib/government-ids`:

```tsx
      <DetailSection title="IV. Government Identification" rows={[
        { label: "PhilHealth number", value: <span className="tabular-nums">{formatGovernmentId("philhealth", record.philhealth_number)}</span> },
        { label: "GSIS number", value: <span className="tabular-nums">{formatGovernmentId("gsis", record.gsis_number)}</span> },
        { label: "Pag-IBIG number", value: <span className="tabular-nums">{formatGovernmentId("pagibig", record.pagibig_number)}</span> },
      ]} />
```

`DetailSection` shows "Not provided" for an empty value. An empty `<span>` is truthy, though, so pass `record.x ? <span…>…</span> : null` for each row.

- [ ] **Step 13: Update the self-service card** in `government-ids-card.tsx`
- Change the prop type to `Pick<Employee, "philhealth_number" | "gsis_number" | "pagibig_number">`.
- Change `FieldErrors` keys to `"philhealthNumber" | "gsisNumber" | "pagibigNumber"`.
- Replace the two form fields with three `GovernmentIdInput` fields (ids `self-philhealth-number`, `self-gsis-number`, `self-pagibig-number`; names `philhealthNumber`, `gsisNumber`, `pagibigNumber`; no descriptions, since the placeholders carry the format).
- Replace the `InfoList` rows with PhilHealth (`HeartPulse` icon), GSIS (`IdCard`) and Pag-IBIG (`IdCard`), each using `formatGovernmentId(kind, value) || "Not provided"`.

Update `employee-profile.tsx`, wherever it renders `<GovernmentIdsCard employee={…}>`, so the props satisfy the new `Pick`; passing the whole `employee` object works.

Update `government-ids-card.test.tsx`: replace SSS expectations with GSIS/Pag-IBIG ones, and change the expected mutation payload to `{ philhealthNumber, gsisNumber, pagibigNumber }`.

- [ ] **Step 14: Run every affected test**

Run: `npx vitest run src/components/personnel-records src/lib/government-ids.test.ts src/queries/personnel-records.test.ts src/schemas` then `npm run typecheck`.
Expected: PASS with no type errors. Any remaining `sssNumber`/`sss_number` reference in app code should be gone, except the `Employee` type field and `formatSssNumber`, which stay. Check with `grep -rn "sssNumber\|formatSssNumber\|SSS number" src --include=*.tsx | grep -v test`; the expected result is no hits.

- [ ] **Step 15: Commit**

```bash
git add supabase/migrations/20261010090005_gsis_pagibig_numbers.sql supabase/tests/employee_government_ids.test.sql src/lib/government-ids.ts src/lib/government-ids.test.ts src/components/ui/government-id-input.tsx src/schemas/personnel-records.ts src/queries/personnel-records.ts src/queries/personnel-records.test.ts src/components/personnel-records src/lib/types/database.ts
git commit -m "feat: IV. Government Identification with PhilHealth, GSIS and Pag-IBIG; SSS hidden

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Profile records — Update instead of Delete; service history assignment and rank

**Files:**
- Create: `supabase/migrations/20261010090006_service_history_unit_station.sql`
- Modify: `supabase/tests/personnel_records.test.sql` (`has_column` for `service_history.unit_station`)
- Modify: `src/schemas/personnel-records.ts` (`serviceHistorySchema`)
- Modify: `src/queries/personnel-records.ts` (`childConfig.serviceHistory.payload`)
- Modify: `src/lib/types/database.ts` (`ServiceHistory`: add `unit_station: string | null`)
- Modify: `src/components/personnel-records/record-entry-form.tsx`
- Modify: `src/components/personnel-records/employee-record-detail.tsx` (`Records`, `entryTitle`/`entryDetail`, `useRecordActivity`)
- Modify: `src/components/personnel-records/employee-record-detail.test.tsx`
- Modify: `src/components/personnel-records/employee-profile.tsx:114-119`

**Interfaces:**
- Produces:
  - New `RecordEntryForm` props: `certification?: Certification` and `serviceHistory?: ServiceHistory`. When one of them is given, the form pre-fills and saves with `onSaved(input, entry.id)`.
  - Exported `serviceHistoryTitle(entry: Pick<ServiceHistory, "rank_id" | "unit_station" | "employment_title">, rankTitles: Map<number, string>): string` from `employee-record-detail.tsx`. It returns rank and Unit/Station joined by " · ", falling back to `employment_title`, then "Service entry".

- [ ] **Step 1: Write failing detail tests.** In `employee-record-detail.test.tsx`, replace the two tests that click "Delete certification / training Leadership and Management Course" (lines ~66-95) with:

```tsx
  it("updates a certification / training instead of deleting it", async () => {
    const user = userEvent.setup();
    renderDetail("?tab=certifications&mode=edit");
    expect(screen.queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Update certification / training Leadership and Management Course" }));
    expect(screen.getByLabelText(/^Certification \/ Training/, { selector: "select" })).toHaveValue("Leadership and Management Course");
    await user.click(screen.getByRole("button", { name: "Save certification / training" }));
    await waitFor(() => expect(mocks.saveEntry).toHaveBeenCalledWith(expect.objectContaining({ id: "00000000-0000-4000-8000-000000000020" })));
  });
```

Add a service history display test:

```tsx
  it("shows the rank and assignment of each service history entry", async () => {
    renderDetail("?tab=service-history");
    expect(await screen.findByText("PCPL — Police Corporal · San Juan Police Station")).toBeVisible();
  });
```

Adapt to the file's helpers:
- `renderDetail` is whatever helper the file uses to render with a URL query.
- `mocks.saveEntry` is the mock behind `useSavePersonnelEntry().mutateAsync`; add it to the mock if missing.
- The service-history fixture needs `rank_id` matching a mocked rank with label "PCPL — Police Corporal" and `unit_station: "San Juan Police Station"`. Use the rank-label format `rankLabel` produces in this codebase (check `src/lib/ranks.ts`).

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/components/personnel-records/employee-record-detail.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write the migration** `supabase/migrations/20261010090006_service_history_unit_station.sql`

```sql
-- Client round 5 (2026-10-10): each service history entry records where the officer was assigned
-- (Unit / Station, chosen from the catalogue and stored by name like employees.unit_station).
alter table public.service_history
  add column unit_station text check (unit_station is null or (unit_station = btrim(unit_station) and char_length(unit_station) between 1 and 160));
```

Append `select extensions.has_column('public', 'service_history', 'unit_station', 'Service history records the Unit / Station');` to `supabase/tests/personnel_records.test.sql` and bump `plan(n)`.

- [ ] **Step 4: Update the schema, payload and types**
- `serviceHistorySchema`: add `unitStation: optionalText(160),` after `rankId`.
- `childConfig.serviceHistory.payload`: add `unit_station: v.unitStation ?? null,`.
- `ServiceHistory` type: add `unit_station: string | null;`.

- [ ] **Step 5: Generalise `RecordEntryForm` for editing** (`record-entry-form.tsx`)
- Import `Certification, ServiceHistory` types and `useUnitStations` from `@/hooks/use-personnel-records`.
- Add props `certification?: Certification;` and `serviceHistory?: ServiceHistory;` to `RecordEntryFormProps`, and destructure them.
- Replace the state and edit-detection lines with:

```tsx
  const [departmentId, setDepartmentId] = useState(serviceHistory?.department_id ? String(serviceHistory.department_id) : "");
  const [rankId, setRankId] = useState(serviceHistory?.rank_id ? String(serviceHistory.rank_id) : "");
  const [startDate, setStartDate] = useState(training?.completed_on ?? qualification?.awarded_on ?? certification?.issued_on ?? serviceHistory?.started_on ?? "");
  const unitStations = useUnitStations();
  const config = fields[kind];
  const kindChoices = choices[kind];
  const savedPrimary = training?.course_name ?? qualification?.name ?? certification?.name;
  const savedSecondary = training?.provider;
  const editing = kind === "training" ? training : kind === "qualification" ? qualification : kind === "certification" ? certification : serviceHistory;
  const editId = editing?.id;
```

- In `submit`, add `unitStation: text(form.unitStation)` to the serviceHistory `base` object.
- Pass `savedDepartmentId={serviceHistory?.department_id}` and `savedRankId={serviceHistory?.rank_id}` to `DepartmentRankFields`.
- After the `DepartmentRankFields` block, inside the `isServiceHistory` branch (wrap both in a fragment), add:

```tsx
          <FormField error={e.unitStation} htmlFor={`${kind}-unit-station`} label="Unit / Station">
            <NativeSelect key={unitStations.data ? "catalogue" : "loading"} defaultValue={serviceHistory?.unit_station ?? ""} id={`${kind}-unit-station`} name="unitStation">
              <option value="">Select a unit / station</option>
              {serviceHistory?.unit_station && !unitStations.data?.some((unit) => unit.name === serviceHistory.unit_station) ? <option value={serviceHistory.unit_station}>{serviceHistory.unit_station}</option> : null}
              {unitStations.data?.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
            </NativeSelect>
          </FormField>
```

- Add `unitStation: "unitStation",` to `errorFieldFor`.
- On the expiry input, change `defaultValue={training?.expires_on ?? ""}` to `defaultValue={training?.expires_on ?? serviceHistory?.ended_on ?? ""}`.
- On the notes textarea, change `defaultValue` to `training?.notes ?? qualification?.notes ?? certification?.notes ?? serviceHistory?.notes ?? ""`.

- [ ] **Step 6: Replace Delete with Update in `Records`** (`employee-record-detail.tsx`)
- Remove `nouns`-based delete state, `deletionTypes`, `DeleteRecordDialog` and the `deleting` state from `Records`. Keep the `DeleteRecordDialog` import only if `TrainingRecords` still uses it; it does, so keep the import.
- Add `const [editing, setEditing] = useState<string | null>(null);`.
- Add `const rankTitles = useRankTitles();` and `const departmentNames = useDepartmentNames();`, using these two small local hooks above `Records`:

```tsx
function useRankTitles() {
  const ranks = useRankOptions();
  return useMemo(() => new Map((ranks.data ?? []).map((rank) => [rank.id, rankLabel(rank)])), [ranks.data]);
}
function useDepartmentNames() {
  const departments = useDepartmentOptions();
  return useMemo(() => new Map((departments.data ?? []).map((department) => [department.id, department.name])), [departments.data]);
}
```

- Add the exported helper:

```tsx
/** "PCPL — Police Corporal · San Juan Police Station": the rank held and where the officer was assigned. */
export function serviceHistoryTitle(entry: Pick<ServiceHistory, "rank_id" | "unit_station" | "employment_title">, rankTitles: Map<number, string>) {
  const title = [entry.rank_id ? rankTitles.get(entry.rank_id) : null, entry.unit_station].filter(Boolean).join(" · ");
  return title || entry.employment_title || "Service entry";
}
```

- In the row map:
  - For `kind === "serviceHistory"`, use `serviceHistoryTitle(entry as ServiceHistory, rankTitles)` as the title.
  - Use `[departmentNames.get((entry as ServiceHistory).department_id ?? -1), formatDateRange(...)].filter(Boolean).join(" · ")` as the detail.
  - Render the eyebrow `<p className="text-xs font-semibold tracking-wide text-primary uppercase">Service history</p>` above the title.
- Replace the Delete button with:

```tsx
              {editable ? (
                <Button aria-label={`Update ${noun} ${title}`} onClick={() => { setNotice(null); setEditing(entry.id); }} size="sm" type="button" variant="outline">Update</Button>
              ) : null}
```

- Replace the trailing add form with an edit-or-add switch:

```tsx
      {!editable ? null : editingEntry ? (
        <div className="mt-4">
          <div className="flex items-center justify-between"><h3 className="font-bold">Update {noun}</h3><Button onClick={() => setEditing(null)} size="sm" type="button" variant="ghost">Cancel</Button></div>
          <RecordEntryForm
            certification={kind === "certification" ? editingEntry as Certification : undefined}
            employeeId={employeeId}
            key={editingEntry.id}
            kind={kind}
            onSaved={async (input, id) => { await save.mutateAsync({ id, input: input as never }); setEditing(null); setNotice(`The ${noun} was updated.`); }}
            pending={save.isPending}
            qualification={kind === "qualification" ? editingEntry as Qualification : undefined}
            serviceHistory={kind === "serviceHistory" ? editingEntry as ServiceHistory : undefined}
          />
        </div>
      ) : (
        <RecordEntryForm employeeId={employeeId} kind={kind} onSaved={async (input) => { await save.mutateAsync({ input: input as never }); }} pending={save.isPending} />
      )}
```

  Define `const editingEntry = entries.data?.find((entry) => entry.id === editing);` after the loading/error guards.

- In `useRecordActivity`, change the service item title to `serviceHistoryTitle(entry, rankTitles)`.

- [ ] **Step 7: Update the employee's own profile.** In `employee-profile.tsx` (~line 118), set the service history row title to `[entryRank ? rankLabel(entryRank) : null, row.unit_station].filter(Boolean).join(" · ") || row.employment_title || "Service entry"`. Keep the detail (department · date range) as it is.

- [ ] **Step 8: Run the tests and database tests**

Run: `npx vitest run src/components/personnel-records src/queries/personnel-records.test.ts` and `npx supabase db reset --local && npx supabase test db`.
Expected: PASS. Also check that `useSavePersonnelEntry`'s mutation accepts `{ id, input }`; `TrainingRecords` already calls it that way.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20261010090006_service_history_unit_station.sql supabase/tests/personnel_records.test.sql src/schemas/personnel-records.ts src/queries/personnel-records.ts src/lib/types/database.ts src/components/personnel-records
git commit -m "feat: update profile records instead of deleting them; service history shows rank and assignment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Maternity for female employees, Paternity for male employees

**Files:**
- Create: `supabase/migrations/20261010090007_leave_type_eligible_gender.sql`
- Create: `supabase/tests/leave_type_gender.test.sql`
- Create: `src/lib/leave/requestable-types.ts`, `src/lib/leave/requestable-types.test.ts`
- Modify: `src/lib/types/database.ts` (`LeaveType`: `eligible_gender: "female" | "male" | null`)
- Modify: `src/components/leave-management/employee-leave.tsx` (`EmployeeLeaveRequestForm`)
- Modify: `src/components/leave-management/employee-leave.test.tsx`

**Interfaces:**
- Produces: `requestableLeaveTypes<T extends Pick<LeaveType, "is_active" | "eligible_gender">>(types: readonly T[], gender: "female" | "male" | null | undefined): T[]`

- [ ] **Step 1: Write the failing helper test** `src/lib/leave/requestable-types.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { requestableLeaveTypes } from "./requestable-types";

const types = [
  { name: "Sick Leave", is_active: true, eligible_gender: null },
  { name: "Maternity Leave", is_active: true, eligible_gender: "female" },
  { name: "Paternity Leave", is_active: true, eligible_gender: "male" },
  { name: "Vacation Leave", is_active: false, eligible_gender: null },
] as const;

const names = (list: readonly { name: string }[]) => list.map((type) => type.name);

describe("requestableLeaveTypes", () => {
  it("offers Maternity only to female employees", () => {
    expect(names(requestableLeaveTypes(types, "female"))).toEqual(["Sick Leave", "Maternity Leave"]);
  });

  it("offers Paternity only to male employees", () => {
    expect(names(requestableLeaveTypes(types, "male"))).toEqual(["Sick Leave", "Paternity Leave"]);
  });

  it("hides gender-specific types until a gender is recorded", () => {
    expect(names(requestableLeaveTypes(types, null))).toEqual(["Sick Leave"]);
    expect(names(requestableLeaveTypes(types, undefined))).toEqual(["Sick Leave"]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails, then implement** `src/lib/leave/requestable-types.ts`

Run: `npx vitest run src/lib/leave/requestable-types.test.ts`
Expected: FAIL.

```ts
import type { LeaveType } from "@/lib/types/database";

/** Active leave types an employee may request: gender-specific types (Maternity, Paternity) only for a matching gender. */
export function requestableLeaveTypes<T extends Pick<LeaveType, "is_active" | "eligible_gender">>(types: readonly T[], gender: "female" | "male" | null | undefined) {
  return types.filter((type) => type.is_active && (type.eligible_gender === null || type.eligible_gender === gender));
}
```

Add `eligible_gender: "female" | "male" | null;` to the `LeaveType` type, after `excess_deducted_from_retirement`. Re-run.
Expected: PASS.

- [ ] **Step 3: Write the failing pgTAP test** `supabase/tests/leave_type_gender.test.sql`

```sql
begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(5);

select extensions.is((select eligible_gender from public.leave_types where lower(name) = 'maternity leave'), 'female', 'Maternity Leave is for female employees');
select extensions.is((select eligible_gender from public.leave_types where lower(name) = 'paternity leave'), 'male', 'Paternity Leave is for male employees');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000002401', 'authenticated', 'authenticated', 'leave-gender-male@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000002402', 'authenticated', 'authenticated', 'leave-gender-unset@example.test', now(), now());
update public.user_roles set role = 'employee'::public.app_role
where user_id in ('00000000-0000-4000-8000-000000002401'::uuid, '00000000-0000-4000-8000-000000002402'::uuid);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on, gender)
values
  ('00000000-0000-4000-8000-000000002411', '00000000-0000-4000-8000-000000002401', 'LVG-001', 'Male', 'Officer', 'leave-gender-male@example.test', '2024-01-01', 'male'),
  ('00000000-0000-4000-8000-000000002412', '00000000-0000-4000-8000-000000002402', 'LVG-002', 'Unset', 'Officer', 'leave-gender-unset@example.test', '2024-01-01', null);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002401';

select extensions.throws_ok(
  $$select public.submit_leave_request('00000000-0000-4000-8000-000000002441'::uuid,
      (select id from public.leave_types where lower(name) = 'maternity leave'), '2099-02-01', '2099-02-02', 'Request', '[]'::jsonb)$$,
  '22023', 'Maternity Leave is only available to female employees.', 'A male employee cannot request Maternity Leave'
);
select extensions.lives_ok(
  $$select public.submit_leave_request('00000000-0000-4000-8000-000000002442'::uuid,
      (select id from public.leave_types where lower(name) = 'paternity leave'), '2099-02-01', '2099-02-02', 'Newborn', '[]'::jsonb)$$,
  'A male employee can request Paternity Leave'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002402';
select extensions.throws_ok(
  $$select public.submit_leave_request('00000000-0000-4000-8000-000000002443'::uuid,
      (select id from public.leave_types where lower(name) = 'paternity leave'), '2099-02-01', '2099-02-02', 'Newborn', '[]'::jsonb)$$,
  '22023', 'Paternity Leave is only available to male employees.', 'An employee without a recorded gender cannot request a gender-specific type'
);

select * from extensions.finish();

rollback;
```

If `submit_leave_request` requires a non-empty reason or a different argument order, follow the call shape in `supabase/tests/leave_management.test.sql:54-62`.

Run: `npx supabase db reset --local && npx supabase test db`
Expected: FAIL — column `eligible_gender` does not exist.

- [ ] **Step 4: Write the migration** `supabase/migrations/20261010090007_leave_type_eligible_gender.sql`

```sql
-- Client round 5 (2026-10-10): Maternity Leave is offered to female employees and Paternity Leave to
-- male employees. Enforced for every insert path with a trigger, so submit_leave_request stays unchanged.

alter table public.leave_types
  add column eligible_gender text check (eligible_gender is null or eligible_gender in ('female', 'male'));

update public.leave_types set eligible_gender = 'female' where lower(name) = 'maternity leave';
update public.leave_types set eligible_gender = 'male' where lower(name) = 'paternity leave';

create function private.enforce_leave_type_gender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  type_name text;
  required_gender text;
  employee_gender text;
begin
  select name, eligible_gender into type_name, required_gender from public.leave_types where id = new.leave_type_id;
  if required_gender is null then
    return new;
  end if;
  select gender into employee_gender from public.employees where id = new.employee_id;
  if employee_gender is distinct from required_gender then
    raise exception '% is only available to % employees.', type_name, required_gender using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_leave_type_gender() from public, anon, authenticated;

create trigger leave_requests_enforce_gender
  before insert on public.leave_requests
  for each row execute function private.enforce_leave_type_gender();
```

Run: `npx supabase db reset --local && npx supabase test db`
Expected: PASS. If `leave_management.test.sql` submits Paternity/Maternity for an employee with no gender, give that employee a matching gender in its insert.

- [ ] **Step 5: Write a failing form test.** In `employee-leave.test.tsx`:
- Mock `useEmployeeForCurrentUser` from `@/hooks/use-personnel-records` to return `{ data: { gender: "male" }, isLoading: false, error: null }`.
- Make the mocked requestable types include Maternity (`eligible_gender: "female"`) and Paternity (`"male"`).
- Add:

```tsx
  it("lists Paternity but not Maternity for a male employee", () => {
    render(<EmployeeLeaveRequestForm />);
    const select = screen.getByLabelText(/^Leave type/);
    expect(within(select).getByRole("option", { name: "Paternity Leave" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "Maternity Leave" })).not.toBeInTheDocument();
  });
```

Run: `npx vitest run src/components/leave-management/employee-leave.test.tsx`
Expected: FAIL.

- [ ] **Step 6: Implement it in `EmployeeLeaveRequestForm`**
- Import `useEmployeeForCurrentUser` from `@/hooks/use-personnel-records` and `requestableLeaveTypes` from `@/lib/leave/requestable-types`.
- Add `const employee = useEmployeeForCurrentUser();` next to `types`.
- Change the loading guard to `if (types.isLoading || employee.isLoading) return <LoadingState label="Loading leave types…" />;`.
- Change the error guard to `if (types.error || employee.error) return <ErrorState message={(types.error ?? employee.error)!.message} />;`.
- Replace `const activeTypes = (types.data ?? []).filter((type) => type.is_active);` with `const activeTypes = requestableLeaveTypes(types.data ?? [], employee.data?.gender);`.

Run: `npx vitest run src/components/leave-management src/lib/leave`
Expected: PASS. Every other test in `employee-leave.test.tsx` that renders the form now needs the `useEmployeeForCurrentUser` mock; add it to the file-level `vi.mock`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261010090007_leave_type_eligible_gender.sql supabase/tests src/lib/leave src/lib/types/database.ts src/components/leave-management
git commit -m "feat: offer Maternity Leave to female and Paternity Leave to male employees

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Leave types are Update-only; leave dates stay in range

**Files:**
- Modify: `src/components/leave-management/leave-type-manager.tsx`
- Modify: `src/components/leave-management/leave-management.test.tsx`. This is the test that renders `LeaveTypeManager`; confirm with `grep -ln LeaveTypeManager src/components/leave-management/*.test.tsx`.
- Modify: `src/schemas/leave-management.ts`
- Modify: `src/components/leave-management/employee-leave.tsx` (`EmployeeLeaveRequestForm` dates and year)
- Modify: `src/components/leave-management/employee-leave.test.tsx`
- Modify: `e2e/business-journeys.spec.ts:84-100` (leave type lifecycle test)

**Interfaces:**
- Produces:
  - `maxLeaveDate(): string`, an ISO date two years from today, exported from `src/schemas/leave-management.ts`
  - `leaveDateError(value: string, min: string, max: string): string | undefined`, exported from `employee-leave.tsx`

- [ ] **Step 1: Write failing manager tests.** In the test that renders `LeaveTypeManager`, replace any tests for adding, deactivating or deleting types with:

```tsx
  it("only lets HR update the existing leave types", async () => {
    const user = userEvent.setup();
    render(<LeaveTypeManager />);
    expect(screen.queryByRole("button", { name: "Add leave type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Deactivate|^Activate|^Delete/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Update Sick Leave" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
  });
```

Use a type name that exists in the file's mocked `useLeaveTypes` data.

Run: `npx vitest run src/components/leave-management`
Expected: FAIL.

- [ ] **Step 2: Implement the manager**

In `leave-type-manager.tsx`:
- Delete `submit`, `setActive`, the create `<form>`, the toggle and Delete buttons, `DeleteRecordDialog`, and the `create`, `update`, `deleting` and `togglingId` state, along with their now-unused imports (`useCreateLeaveType`, `DeleteRecordDialog`, `Input` if unused).
- Add `const [editingId, setEditingId] = useState<string | null>(null);`.
- Change the intro paragraph to: `Update a leave type's name, description, or yearly days. Leave types cannot be added or removed.`
- Replace each list item's action area and `<details>` with:

```tsx
                <Button aria-expanded={editingId === type.id} aria-label={`Update ${type.name}`} onClick={() => setEditingId(editingId === type.id ? null : type.id)} size="sm" type="button" variant="outline">Update</Button>
```

  and, after the description:

```tsx
              {editingId === type.id ? <EditLeaveTypeForm onDone={(message) => { setNotice(message); setEditingId(null); }} type={type} /> : null}
```

- Keep the Active/Inactive badge.
- Change the empty state to `No leave types are set up.`.

Run: `npx vitest run src/components/leave-management`
Expected: PASS for the manager test.

- [ ] **Step 3: Write failing date tests.** Append to `employee-leave.test.tsx`:

```tsx
  it("explains an impossible start date immediately instead of accepting year 0001", async () => {
    render(<EmployeeLeaveRequestForm />);
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: "0001-01-10" } });
    expect(await screen.findByText("Choose today or a future date.")).toBeVisible();
  });

  it("caps leave dates two years ahead", () => {
    render(<EmployeeLeaveRequestForm />);
    expect(screen.getByLabelText(/^Start date/)).toHaveAttribute("max", maxLeaveDate());
    expect(screen.getByLabelText(/^End date/)).toHaveAttribute("max", maxLeaveDate());
  });

  it("never asks for a year-1 balance", () => {
    render(<EmployeeLeaveRequestForm />);
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: "0001-01-10" } });
    expect(mocks.useMyLeaveBalances).not.toHaveBeenCalledWith(1);
  });
```

Import `fireEvent` from `@testing-library/react` and `maxLeaveDate` from `@/schemas/leave-management`. `mocks.useMyLeaveBalances` must be the `vi.fn` behind the mocked `useMyLeaveBalances`; convert the existing mock to a `vi.fn` if it's a plain function.

Run: `npx vitest run src/components/leave-management/employee-leave.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implement the date limits**

In `src/schemas/leave-management.ts`, add:

```ts
/** Latest date a leave request may start or end: two years from today (local date). */
export function maxLeaveDate() {
  const now = new Date();
  const limit = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
  return new Date(limit.getTime() - limit.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
```

Then add `.refine((value) => value <= maxLeaveDate(), "Choose a date within the next two years.")` after the existing refine on both `startsOn` and `endsOn` in `leaveRequestDraftSchema`.

In `employee-leave.tsx`, import `maxLeaveDate` and add:

```tsx
/** Inline message for a typed leave date outside today … two years ahead, or a partial value. */
export function leaveDateError(value: string, min: string, max: string) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < min) return "Choose today or a future date.";
  if (value > max) return "Choose a date within the next two years.";
  return undefined;
}
```

In `EmployeeLeaveRequestForm`:
- Compute `const minDate = today();` and `const maxDate = maxLeaveDate();` before the hooks that need them. Move `minDate` above `year`.
- Replace the year line with:

```tsx
  const validStart = startsOn && !leaveDateError(startsOn, minDate, maxDate) ? startsOn : null;
  const year = Number((validStart ?? minDate).slice(0, 4));
```

- Change the start input's `onChange` to:

```tsx
            onChange={(event) => { setStartsOn(event.target.value); setFieldErrors((current) => ({ ...current, startsOn: leaveDateError(event.target.value, minDate, maxDate) })); }}
```

- Add `max={maxDate}` to the start input.
- Do the same for the end input, using `endsOn`, its own `min`, and `max={maxDate}`.
- Delete the later duplicate `const minDate = today();` line.

Run: `npx vitest run src/components/leave-management src/schemas`
Expected: PASS.

- [ ] **Step 5: Update the e2e leave test.** In `e2e/business-journeys.spec.ts`, replace the test "HR manages a leave type lifecycle: create, deactivate, then delete while unused" with:

```ts
  test("HR can only update the fixed leave types", async ({ page }) => {
    await signIn(page, "demo.hr@example.test", "/hr");
    await page.goto("/hr/leave-requests");
    await page.getByRole("tab", { name: "Leave types" }).click();
    await expect(page.getByRole("button", { name: "Add leave type" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Deactivate|Activate|Delete) / })).toHaveCount(0);
    await page.getByRole("button", { name: "Update Mandatory Leave" }).click();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  });
```

Remove the rest of the old test body, including any trailing steps after `page.reload()` that belonged to it.

- [ ] **Step 6: Commit**

```bash
git add src/components/leave-management src/schemas/leave-management.ts e2e/business-journeys.spec.ts
git commit -m "fix: leave types are update-only and leave dates must fall within the next two years

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: "Years of service" label, e2e and visual baselines, full verification

**Files:**
- Modify: `src/components/promotion-eligibility/promotion-criteria-manager.tsx:114-116`, plus any other file found by the grep below
- Modify: `e2e/capstone-objectives.spec.ts:358`
- Modify: `e2e/applicant-visual-baseline.spec.ts-snapshots/*` (regenerated)

- [ ] **Step 1: Rename the label**

Run: `grep -rn "Minimum years of service" src e2e`
Replace every user-facing occurrence with "Years of service". In `e2e/capstone-objectives.spec.ts:358`, change `getByLabel(/^Minimum years of service/)` to `getByLabel(/^Years of service/)`. Update matching unit tests from the grep.

Run: `npx vitest run src/components/promotion-eligibility`
Expected: PASS.

- [ ] **Step 2: Run the whole static and unit suite**

Run: `npm run lint && npm run typecheck && npx vitest run`
Expected: everything passes. Fix any failure at its source rather than skipping it.

- [ ] **Step 3: Run the database suite from a clean reset**

Run: `npx supabase db reset --local && npx supabase test db`
Expected: all files pass.

- [ ] **Step 4: Run the e2e suite**

Run: `npm run test:e2e`
Expected: everything passes except visual-baseline diffs on pages this branch changed. Those are the applicant apply page, where the button is now enabled and the helper text is gone, and possibly the employee form.

- [ ] **Step 5: Regenerate the baselines that changed on purpose and review them**

Run: `npm run test:e2e -- e2e/applicant-visual-baseline.spec.ts --update-snapshots`
Open each changed PNG under `e2e/applicant-visual-baseline.spec.ts-snapshots/` (`git status` lists them). Confirm the only differences are the intended ones, then re-run `npm run test:e2e` until it passes.

- [ ] **Step 6: Smoke-test in the browser**

With `npm run dev`, use the demo HR and employee accounts from `supabase/seed.sql` to walk through:
1. Create an employee: Religion dropdown, Female/Male, section IV with in-box formats, Date Entered Service and Inclusive Dates (To).
2. Re-use that employee's email for a second employee and get "This email is already registered.".
3. Deploy the same employee twice on one date and get the overlap message. Open the deployment and see read-only details, an Update button and readable history.
4. Open Attendance: Name column and View link work.
5. Certification / Training rows show Update with no Delete. Service history shows rank · Unit / Station.
6. Leave types tab: Update only. As a male employee, Paternity is listed and Maternity isn't. Typing year 0001 shows the inline error.
7. Applicant apply page: Submit with a missing document shows the red error and outlines the missing card.

- [ ] **Step 7: Commit**

```bash
git add -A src e2e
git commit -m "chore: rename to 'Years of service' and refresh changed visual baselines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Hand off**

Use `superpowers:finishing-a-development-branch` to choose between a PR and a merge. The PR description must mention:
- the production Supabase Redirect URLs allow-list entry (`/auth/callback**`)
- that the personal-email migration stops if production has duplicate personal emails, and that they must be fixed first
