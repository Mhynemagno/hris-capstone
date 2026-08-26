# Applicant Onboarding and Portal UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a new applicant create an immediately usable account and submit an application without email confirmation, while making the applicant portal more readable, recoverable, and accessible.

**Architecture:** Extend the existing trusted `auth.users` provisioning trigger with a guarded applicant-row insert that runs only when the app supplied valid applicant name metadata. Keep the submission RPC as the authorization boundary, but add a browser preflight that prevents document uploads for legacy accounts that lack an applicant row. Upgrade the current shared typography and controls rather than introducing a second visual system.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Base UI, Lucide, TanStack Query, Supabase Auth/Postgres/Storage, Vitest, pgTAP.

**Spec:** `docs/superpowers/specs/2026-08-27-applicant-onboarding-ui-ux-design.md`

## Global Constraints

- Supabase Auth email confirmation is disabled locally with `[auth.email] enable_confirmations = false`; the deployed Supabase project must use the same setting.
- The browser must never receive a Supabase service-role key or decide a user's role.
- Applicant-profile ownership stays `profile_id = auth.uid()` and all new public-table writes remain RLS protected.
- Do not upload a CV or credential before confirming that the signed-in account has an applicant profile.
- Use Atkinson Hyperlegible as the application sans-serif font, 16px minimum body text, visible keyboard focus, WCAG AA contrast, and 44px minimum interactive controls.
- Use existing `Button`, `Input`, `FormField`, `ErrorState`, `LoadingState`, and Lucide patterns; do not add a duplicate component library.

---

## File structure

- `supabase/migrations/<timestamp>_provision_applicant_accounts.sql` — safely extends Auth-user provisioning to create applicant rows from valid registration metadata.
- `supabase/tests/recruitment_and_applicant_portal.test.sql` — proves an Auth-created applicant receives exactly one owned applicant row while a metadata-free internal user does not break provisioning.
- `src/components/auth/applicant-registration-form.tsx` — removes email-confirmation handling and redirects a session-backed applicant to `/applicant`.
- `src/components/auth/applicant-registration-form.test.tsx` — proves immediate portal navigation and no email redirect option.
- `src/queries/recruitment.ts` — adds a typed profile preflight before Storage uploads.
- `src/queries/recruitment.test.ts` — proves a missing profile rejects before `storage.upload`; preserves the existing submission path for valid profiles.
- `src/components/recruitment/applicant-application-form.tsx` — renders a direct recovery card when the preflight reports a missing profile and improves file guidance.
- `src/components/recruitment/applicant-application-form.test.tsx` — proves recovery UI links to `/applicant/profile` and normal CV validation still blocks submission.
- `src/components/auth/sign-out-button.tsx` — adds a named `LogOut` icon and sidebar-safe visible contrast.
- `src/components/auth/sign-out-button.test.tsx` — asserts the accessible name, label, and icon are present.
- `src/components/app-shell/app-shell.test.tsx` — stops mocking sign-out so its accessible control is exercised in the sidebar.
- `src/app/layout.tsx` and `src/app/globals.css` — install Atkinson Hyperlegible and apply the shared readable base typography.

### Task 1: Provision an applicant profile in the trusted Auth trigger

**Files:**
- Create: `supabase/migrations/<timestamp>_provision_applicant_accounts.sql`
- Modify: `supabase/tests/recruitment_and_applicant_portal.test.sql`

**Interfaces:**
- Consumes: `auth.users.raw_user_meta_data` keys `first_name` and `last_name` sent by the existing registration form.
- Produces: one `public.applicants` record whose `profile_id` equals the new Auth user ID when both trimmed names are present.

- [ ] **Step 1: Add the failing pgTAP assertions before the existing fixture setup.**

  Insert a new Auth user with unique UUID `00000000-0000-4000-8000-000000009100` and metadata `{"first_name":"Auto","last_name":"Applicant","full_name":"Auto Applicant"}`. Increase `extensions.plan(41)` to include three new assertions:

  ```sql
  select extensions.is(
    (select first_name from public.applicants where profile_id = '00000000-0000-4000-8000-000000009100'::uuid),
    'Auto',
    'Auth registration provisions the applicant first name'
  );
  select extensions.is(
    (select last_name from public.applicants where profile_id = '00000000-0000-4000-8000-000000009100'::uuid),
    'Applicant',
    'Auth registration provisions the applicant last name'
  );
  select extensions.is(
    (select count(*) from public.applicants where profile_id = '00000000-0000-4000-8000-000000009100'::uuid),
    1::bigint,
    'Auth registration provisions only one applicant row'
  );
  ```

- [ ] **Step 2: Run the recruitment database test and verify the new assertions fail.**

  Run the project's documented local pgTAP command after confirming it with `supabase test db --help`. Expected result: the three applicant-profile assertions fail because `private.handle_new_user` currently inserts only `profiles` and `user_roles`.

- [ ] **Step 3: Generate an imperative migration and add the guarded profile insert.**

  Run `supabase migration new provision_applicant_accounts` and edit only the generated migration. Replace `private.handle_new_user()` with its current profile/user-role behavior plus this idempotent block after `user_roles` is inserted:

  ```sql
  if coalesce(nullif(btrim(new.raw_user_meta_data ->> 'first_name'), ''), '') <> ''
     and coalesce(nullif(btrim(new.raw_user_meta_data ->> 'last_name'), ''), '') <> '' then
    insert into public.applicants (profile_id, first_name, last_name)
    values (
      new.id,
      btrim(new.raw_user_meta_data ->> 'first_name'),
      btrim(new.raw_user_meta_data ->> 'last_name')
    )
    on conflict (profile_id) do nothing;
  end if;
  ```

  Preserve `security definer`, `set search_path = ''`, the original `public.profiles` insert, and the server-controlled `user_roles` insert. Do not insert blank-name rows: invitation and internal Auth users may not have applicant metadata.

- [ ] **Step 4: Add the non-regression pgTAP assertion for metadata-free Auth users.**

  Leave the existing fixture users with empty metadata and add this assertion after their creation:

  ```sql
  select extensions.is(
    (select count(*) from public.applicants where profile_id = '00000000-0000-4000-8000-000000009101'::uuid),
    0::bigint,
    'Metadata-free internal Auth users are not forced into applicant profiles'
  );
  ```

  Increase the plan count by one more assertion.

- [ ] **Step 5: Run the migration and the full recruitment database test.**

  Run `supabase db reset` for the local environment, then the discovered pgTAP command. Expected result: the migration applies and every assertion in `recruitment_and_applicant_portal.test.sql` passes.

- [ ] **Step 6: Commit the isolated database deliverable.**

  ```powershell
  git add supabase/migrations supabase/tests/recruitment_and_applicant_portal.test.sql
  git commit -m "feat: provision applicant profiles at signup"
  ```

### Task 2: Make registration immediately enter the applicant portal

**Files:**
- Modify: `src/components/auth/applicant-registration-form.tsx`
- Modify: `src/components/auth/applicant-registration-form.test.tsx`

**Interfaces:**
- Consumes: `supabase.auth.signUp({ email, password, options: { data } })`.
- Produces: `router.replace("/applicant")` and `router.refresh()` after `data.session` is present; an actionable configuration error if an environment unexpectedly returns no session.

- [ ] **Step 1: Extend the registration component test with the immediate-session path.**

  Mock `signUp` with `{ data: { session: { access_token: "test" } }, error: null }`, submit valid details, and assert:

  ```ts
  expect(mocks.replace).toHaveBeenCalledWith("/applicant");
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
    options: {
      data: {
        first_name: "Applicant",
        last_name: "One",
        full_name: "Applicant One",
      },
    },
  }));
  ```

  Add `expect(mocks.signUp.mock.calls[0][0].options).not.toHaveProperty("emailRedirectTo")`.

- [ ] **Step 2: Run the focused registration test and verify it fails.**

  Run `npm run test:run -- src/components/auth/applicant-registration-form.test.tsx`. Expected result: the current component does not redirect to `/applicant` and still supplies `emailRedirectTo`.

- [ ] **Step 3: Simplify the registration form to the immediate-account flow.**

  Remove the `confirmation` state, `/auth/callback` URL creation, `emailRedirectTo`, and “Check your email” render branch. Keep Zod validation and metadata. After an Auth error, retain the generic safe error. When `data.session` is absent, set this exact recovery error instead of showing confirmation UI:

  ```ts
  setError("Your account was created, but this environment requires email confirmation. Ask an administrator to disable email confirmation.");
  return;
  ```

  Otherwise run:

  ```ts
  router.replace("/applicant");
  router.refresh();
  ```

- [ ] **Step 4: Run the focused registration test and then all auth-form tests.**

  Run `npm run test:run -- src/components/auth/applicant-registration-form.test.tsx src/components/auth/auth-forms.test.tsx`. Expected result: all selected tests pass.

- [ ] **Step 5: Commit the immediate-registration deliverable.**

  ```powershell
  git add src/components/auth/applicant-registration-form.tsx src/components/auth/applicant-registration-form.test.tsx
  git commit -m "feat: enter applicant portal after signup"
  ```

### Task 3: Prevent missing-profile uploads and show a recovery path

**Files:**
- Modify: `src/queries/recruitment.ts`
- Create: `src/queries/recruitment.test.ts`
- Modify: `src/components/recruitment/applicant-application-form.tsx`
- Modify: `src/components/recruitment/applicant-application-form.test.tsx`

**Interfaces:**
- Consumes: `getApplicantProfile(): Promise<Applicant | null>` and the existing `SubmitApplicationInput`.
- Produces: an `ApplicantProfileRequiredError` with `code === "APPLICANT_PROFILE_REQUIRED"`, caught by the form to show a profile-completion link.

- [ ] **Step 1: Write the failing query tests around the upload boundary.**

  Mock the browser Supabase client so `from("applicants").select("*").maybeSingle()` returns `{ data: null, error: null }`; mock `storage.from().upload`. Call `submitApplication` with one valid PDF File and assert:

  ```ts
  await expect(submitApplication(input)).rejects.toMatchObject({
    code: "APPLICANT_PROFILE_REQUIRED",
  });
  expect(upload).not.toHaveBeenCalled();
  ```

  Add a second test with a valid applicant response that verifies the existing upload/RPC sequence remains callable.

- [ ] **Step 2: Run the focused query test and verify it fails.**

  Run `npm run test:run -- src/queries/recruitment.test.ts`. Expected result: the missing-profile test fails because `submitApplication` currently starts the Storage loop without a profile lookup.

- [ ] **Step 3: Add a small typed domain error and preflight in `submitApplication`.**

  Export this class from `src/queries/recruitment.ts`:

  ```ts
  export class ApplicantProfileRequiredError extends Error {
    readonly code = "APPLICANT_PROFILE_REQUIRED" as const;
    constructor() {
      super("Complete your applicant profile before applying.");
      this.name = "ApplicantProfileRequiredError";
    }
  }
  ```

  Immediately after `requireCurrentUser()`/`getUser()` succeeds and before `const uploadedDocuments = []`, perform an owned `applicants` `maybeSingle()` lookup. Call `throwIfError(profileError)` and throw `new ApplicantProfileRequiredError()` when no profile exists. Reuse the same `client` instance; do not create a separate service client.

- [ ] **Step 4: Add the failing component test for the recovery state.**

  Mock `useSubmitApplication().mutateAsync` to reject `new ApplicantProfileRequiredError()`. Submit with a CV, then assert:

  ```ts
  expect(await screen.findByText("Complete your applicant profile before applying.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /complete profile/i })).toHaveAttribute("href", "/applicant/profile");
  ```

- [ ] **Step 5: Render recovery guidance and clearer file feedback in the application form.**

  In the catch block, distinguish `cause instanceof ApplicantProfileRequiredError` from general failures. Store a boolean `profileRequired` and render a bordered `role="alert"` block with the error text and a `next/link` control labeled `Complete profile` to `/applicant/profile`. Clear this state at the start of every submit attempt.

  Replace the bare file input with the shared `Input` component inside `FormField`, retaining `accept` and `multiple`; change helper copy to `Upload your CV first. You can add certificates or other supporting documents. Files must be 10 MB or smaller.` Add `aria-describedby` pointing to this helper text.

- [ ] **Step 6: Run the query and component regression tests.**

  Run `npm run test:run -- src/queries/recruitment.test.ts src/components/recruitment/applicant-application-form.test.tsx`. Expected result: profile-missing submissions make no upload call, show the recovery link, and CV-less submissions still show the original inline error.

- [ ] **Step 7: Commit the protected submission deliverable.**

  ```powershell
  git add src/queries/recruitment.ts src/queries/recruitment.test.ts src/components/recruitment/applicant-application-form.tsx src/components/recruitment/applicant-application-form.test.tsx
  git commit -m "fix: guide applicants to complete required profiles"
  ```

### Task 4: Apply the readable, accessible portal visual system

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/auth/sign-out-button.tsx`
- Create: `src/components/auth/sign-out-button.test.tsx`
- Modify: `src/components/app-shell/app-shell.test.tsx`

**Interfaces:**
- Consumes: Next.js `next/font/google`, CSS `--font-sans`, existing Button variants, and `lucide-react` `LogOut`.
- Produces: Atkinson Hyperlegible body typography and a sidebar Sign out button with an accessible visible label.

- [ ] **Step 1: Write the failing sign-out component test.**

  Mock `next/navigation` and `createBrowserSupabaseClient().auth.signOut`, render `<SignOutButton />`, and assert:

  ```ts
  const button = screen.getByRole("button", { name: "Sign out" });
  expect(button).toHaveTextContent("Sign out");
  expect(button.querySelector("svg")).toBeInTheDocument();
  expect(button).toHaveClass("text-sidebar-foreground");
  ```

- [ ] **Step 2: Run the focused sign-out test and verify it fails.**

  Run `npm run test:run -- src/components/auth/sign-out-button.test.tsx`. Expected result: it fails because the existing control has no LogOut icon or sidebar foreground styling.

- [ ] **Step 3: Install readable typography without adding a network stylesheet.**

  In `src/app/layout.tsx`, replace the `Geist` import and `geistSans` definition with `Atkinson_Hyperlegible` configured with `weight: ["400", "700"]`, `subsets: ["latin"]`, and `variable: "--font-atkinson-hyperlegible"`. Keep Geist Mono for code. Set `--font-sans: var(--font-atkinson-hyperlegible)` in `globals.css`; keep `--font-heading: var(--font-sans)`.

  In the `@layer base` body rule, use `@apply bg-background text-base leading-6 text-foreground;`. Do not reduce the existing Input visual focus ring or 44px `min-h-11` controls.

- [ ] **Step 4: Make Sign out visibly distinct in the sidebar.**

  Import `LogOut` from `lucide-react`. Render it before the text with `aria-hidden="true"`. Give the existing outline button these additional classes:

  ```tsx
  className="w-full justify-center border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
  ```

  Retain the exact visible labels `Sign out` and `Signing out...`, plus the existing disabled state and route refresh behavior.

- [ ] **Step 5: Exercise the real control in the shell test.**

  Remove the `@/components/auth/sign-out-button` mock from `app-shell.test.tsx`. Add an assertion in the landmarks test:

  ```ts
  expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  ```

  Extend the app-shell test's Supabase mock if the real sign-out component requires it.

- [ ] **Step 6: Run the focused UI tests.**

  Run `npm run test:run -- src/components/auth/sign-out-button.test.tsx src/components/app-shell/app-shell.test.tsx`. Expected result: the sign-out action is named, icon-supported, and rendered inside the actual sidebar.

- [ ] **Step 7: Commit the visual-system deliverable.**

  ```powershell
  git add src/app/layout.tsx src/app/globals.css src/components/auth/sign-out-button.tsx src/components/auth/sign-out-button.test.tsx src/components/app-shell/app-shell.test.tsx
  git commit -m "feat: improve portal readability and sign out visibility"
  ```

### Task 5: Run full verification and production-readiness checks

**Files:**
- Modify only if a verification failure identifies a focused defect in a file above.

**Interfaces:**
- Consumes: all previous tasks and the configured local Supabase environment.
- Produces: fresh evidence that the application passes the code, database, and UI acceptance checks.

- [ ] **Step 1: Verify linting and TypeScript.**

  Run:

  ```powershell
  npm run lint
  npm run typecheck
  ```

  Expected result: both commands exit with code 0.

- [ ] **Step 2: Verify the full unit/component suite.**

  Run `npm run test:run`. Expected result: all Vitest tests pass, including registration, submission recovery, sign-out, and shell tests.

- [ ] **Step 3: Verify the database migration and recruitment pgTAP test.**

  Run `supabase db reset`, then the discovered local pgTAP command for `supabase/tests/recruitment_and_applicant_portal.test.sql`. Expected result: migration applies cleanly and all pgTAP assertions pass.

- [ ] **Step 4: Verify the production build.**

  Run `npm run build`. Expected result: Next.js production compilation exits with code 0.

- [ ] **Step 5: Perform browser acceptance checks.**

  Start the local app using `npm run dev`. At 375px and 1440px widths, verify via keyboard and pointer:

  1. Applicant registration immediately enters `/applicant` when Auth returns a session.
  2. A newly provisioned account can choose a job, select a CV, and reach the submission RPC.
  3. A legacy account with no applicant profile sees the `Complete profile` recovery link before any upload.
  4. The visible Sign out button remains readable, tabbable, and signs out.
  5. Labels, focus rings, alert messages, and page hierarchy remain clear on public jobs, registration, profile, and applications pages.

- [ ] **Step 6: Set the deployed Supabase email-confirmation policy.**

  In the deployed Supabase project's Auth email-provider settings, set **Confirm email** to disabled, matching `supabase/config.toml`. Do not treat the local config as a production change. Record the configured project/environment in the deployment handoff without including credentials.

- [ ] **Step 7: Review the final diff and commit any verification corrections.**

  Run `git diff --check` and `git status --short`. If verification required focused corrections, rerun the affected tests and commit them with a descriptive message. Otherwise, leave the task commits intact and report the exact verification results.
