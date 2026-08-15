# Invitation Reliability and Mobile-First Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Restore reliable browser invitations, collect separate first and last names for account creation, and make all role-facing workspaces mobile-first with a visible San Juan City Police red-and-blue identity.

**Architecture:** Account-creation schemas validate name parts and derive the existing fullName compatibility value without a database change. The browser sends name parts to the Edge Function; it handles CORS preflight and sets structured Auth metadata while retaining the existing full_name profile contract. Shared controls, AppShell, and RoleLanding establish mobile-first behavior across roles, with responsive administration and HR data surfaces.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod 4, React Hook Form, Vitest, Tailwind CSS 4, Supabase Auth, Supabase Edge Functions, supabase-js 2.

## Global Constraints

- Keep profiles.full_name as the persisted profile field; do not add or apply a database migration.
- Collect firstName and lastName separately, derive one trimmed fullName, and store all three values in Auth metadata.
- Keep server-side role assignment and the system_administrator check before service-role use.
- Use the supabase-js CORS helper in 2.112.3 and handle OPTIONS before every POST branch.
- Use mobile as the base layout; expand only at breakpoints and give touch controls a 44px target.
- Use navy and blue for navigation and primary actions, with visible command-red accent; retain red semantics for destructive/errors.
- Preserve centered administration modals.
- Follow TDD: observe every new behavioral test fail before matching implementation.

---

## File structure

- Create: src/schemas/name.ts and src/schemas/name.test.ts — shared name contract and tests.
- Modify: src/schemas/auth.ts, src/schemas/administration.ts, and matching schema tests — account schemas use name parts and derive fullName.
- Modify: src/queries/administration.ts and its test — map name parts to the Edge Function and surface response error bodies.
- Modify: supabase/functions/invite-internal-user/index.ts — OPTIONS, CORS response headers, and structured metadata.
- Modify: src/components/administration/administration-workspaces.tsx and its test — invitation form and responsive admin controls.
- Modify: src/components/auth/applicant-registration-form.tsx; create applicant-registration-form.test.tsx — structured signup form and metadata verification.
- Modify: shared UI, shell, role landing, auth card, public home, CSS, personnel records components, and matching tests — touch targets, responsive layouts, branding.

### Task 1: Establish the account name contract

**Files:**
- Create: src/schemas/name.ts
- Create: src/schemas/name.test.ts
- Modify: src/schemas/auth.ts
- Modify: src/schemas/administration.ts
- Modify: src/schemas/auth.test.ts
- Modify: src/schemas/administration.test.ts

**Interfaces:**
- Produces namePartsSchema accepting firstName and lastName strings.
- Produces withFullName(values) returning the values plus fullName.
- Produces parsed ApplicantRegistrationInput and InternalInvitationInput containing firstName, lastName, and fullName.

- [ ] **Step 1: Write the failing helper tests**

    import { describe, expect, it } from "vitest";
    import { namePartsSchema, withFullName } from "./name";

    it("trims names before composing fullName", () => {
      const names = namePartsSchema.parse({ firstName: " Ada ", lastName: " Lovelace " });
      expect(withFullName(names)).toEqual({ firstName: "Ada", lastName: "Lovelace", fullName: "Ada Lovelace" });
    });

    it("rejects a blank first or last name", () => {
      expect(namePartsSchema.safeParse({ firstName: "", lastName: "Lovelace" }).success).toBe(false);
      expect(namePartsSchema.safeParse({ firstName: "Ada", lastName: " " }).success).toBe(false);
    });

- [ ] **Step 2: Verify the test is red**

Run: npm run test:run -- src/schemas/name.test.ts

Expected: FAIL because the name module does not exist.

- [ ] **Step 3: Implement the smallest reusable contract**

    import { z } from "zod";

    export const namePartsSchema = z.object({
      firstName: z.string().trim().min(1, "First name is required.").max(60),
      lastName: z.string().trim().min(1, "Last name is required.").max(60),
    });

    export function withFullName<T extends z.output<typeof namePartsSchema>>(values: T) {
      return { ...values, fullName: values.firstName + " " + values.lastName };
    }

- [ ] **Step 4: Verify helper tests are green**

Run: npm run test:run -- src/schemas/name.test.ts

Expected: PASS with two tests.

- [ ] **Step 5: Write failing schema tests**

    expect(applicantRegistrationSchema.parse({
      email: "applicant@example.com", password: "secret1", firstName: "Applicant", lastName: "One",
    })).toMatchObject({ firstName: "Applicant", lastName: "One", fullName: "Applicant One" });

    expect(internalInvitationSchema.parse({
      email: "new.hr@example.com", firstName: "New", lastName: "HR", role: "hr_personnel",
    })).toMatchObject({ fullName: "New HR", role: "hr_personnel" });

- [ ] **Step 6: Verify the account schema tests are red**

Run: npm run test:run -- src/schemas/auth.test.ts src/schemas/administration.test.ts

Expected: FAIL because the schemas only accept fullName.

- [ ] **Step 7: Compose shared name fields into both schemas**

    export const applicantRegistrationSchema = loginSchema
      .extend(namePartsSchema.shape)
      .transform(withFullName);

    export const internalInvitationSchema = z.object({
      email: z.email(),
      ...namePartsSchema.shape,
      role: z.enum(["system_administrator", "hr_personnel", "employee", "management"]),
    }).transform(withFullName);

Use z.input<typeof schema> for React Hook Form values and the exported input type for parsed values.

- [ ] **Step 8: Verify schema tests are green**

Run: npm run test:run -- src/schemas/auth.test.ts src/schemas/administration.test.ts

Expected: PASS, including applicant-role and blank-name rejection.

- [ ] **Step 9: Commit**

Run: git add src/schemas/name.ts src/schemas/name.test.ts src/schemas/auth.ts src/schemas/auth.test.ts src/schemas/administration.ts src/schemas/administration.test.ts

Run: git commit -m "feat: collect first and last names for accounts"

### Task 2: Make Edge Function invitations callable and explain failures

**Files:**
- Modify: src/queries/administration.ts
- Modify: src/queries/administration.test.ts
- Modify: supabase/functions/invite-internal-user/index.ts

**Interfaces:**
- Consumes the Task 1 InternalInvitationInput.
- Produces inviteInternalUser(input): Promise<{ userId: string }> sending email, firstName, lastName, and role.
- Produces OPTIONS and all JSON responses with corsHeaders.

- [ ] **Step 1: Write a failing payload test**

    await inviteInternalUser({
      email: "new@example.com", firstName: "New", lastName: "User", fullName: "New User", role: "employee",
    });

    expect(mocks.invoke).toHaveBeenCalledWith("invite-internal-user", {
      body: { email: "new@example.com", firstName: "New", lastName: "User", role: "employee" },
    });

- [ ] **Step 2: Write a failing readable error test**

    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Failed to send a request to the Edge Function",
        context: { json: vi.fn().mockResolvedValue({ error: "Administrator access is required." }) },
      },
    });

    await expect(inviteInternalUser(validInvitation)).rejects.toThrow("Administrator access is required.");

- [ ] **Step 3: Verify query tests are red**

Run: npm run test:run -- src/queries/administration.test.ts

Expected: FAIL because fullName is sent and the server error body is ignored.

- [ ] **Step 4: Implement exact browser request and error mapping**

    async function invitationErrorMessage(error: unknown) {
      const context = typeof error === "object" && error !== null && "context" in error
        ? (error as { context?: { json?: () => Promise<unknown> } }).context
        : undefined;
      const payload = await context?.json?.().catch(() => undefined);
      if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string") return payload.error;
      return error instanceof Error ? error.message : "The invitation service could not be reached. Please try again.";
    }

    export async function inviteInternalUser(input: InternalInvitationInput) {
      const values = internalInvitationSchema.parse(input);
      const { data, error } = await createBrowserSupabaseClient().functions.invoke("invite-internal-user", {
        body: { email: values.email, firstName: values.firstName, lastName: values.lastName, role: values.role },
      });
      if (error) throw new Error(await invitationErrorMessage(error));
      return data as { userId: string };
    }

- [ ] **Step 5: Verify query tests are green**

Run: npm run test:run -- src/queries/administration.test.ts

Expected: PASS with exact request mapping and readable server errors.

- [ ] **Step 6: Implement current official CORS handling in the Edge Function**

    import { createClient } from "npm:@supabase/supabase-js@2";
    import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

    const json = (status: number, body: Record<string, string>) =>
      Response.json(body, { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    Deno.serve(async (request) => {
      if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
      if (request.method !== "POST") return json(405, { error: "Method not allowed." });
    });

Change the input schema to require firstName and lastName, derive the full name, and set invitation metadata to first_name, last_name, and full_name. Use the json helper for the successful user ID response too. Retain all authentication, administrator authorization, and compensating deletion logic.

- [ ] **Step 7: Verify Edge preflight locally**

Deno is unavailable in this checkout, so start the Supabase local runtime if Docker is available:

    npx supabase@latest start
    npx supabase@latest functions serve invite-internal-user --no-verify-jwt

In a second terminal run:

    Invoke-WebRequest -Method Options -Uri 'http://127.0.0.1:54321/functions/v1/invite-internal-user' -Headers @{
      Origin = 'http://127.0.0.1:3000'
      'Access-Control-Request-Method' = 'POST'
      'Access-Control-Request-Headers' = 'authorization,apikey,content-type'
    }

Expected: success and Access-Control-Allow-Origin plus required allowed headers. If Docker is unavailable, do the post-deploy OPTIONS check in Task 5.

- [ ] **Step 8: Commit**

Run: git add src/queries/administration.ts src/queries/administration.test.ts supabase/functions/invite-internal-user/index.ts

Run: git commit -m "fix: allow browser account invitations"

### Task 3: Replace account-creation forms with accessible name parts

**Files:**
- Modify: src/components/administration/administration-workspaces.tsx
- Modify: src/components/administration/administration-workspaces.test.tsx
- Modify: src/components/auth/applicant-registration-form.tsx
- Create: src/components/auth/applicant-registration-form.test.tsx

**Interfaces:**
- Consumes Task 1 schemas and Task 2 invitation contract.
- Produces labelled firstName/lastName form fields, individual errors, and structured applicant metadata.

- [ ] **Step 1: Write failing administrator and applicant form tests**

    await user.click(screen.getByRole("button", { name: /invite account/i }));
    expect(screen.getByRole("textbox", { name: "First name" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Last name" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Full name" })).not.toBeInTheDocument();

    render(<ApplicantRegistrationForm />);
    expect(screen.getByRole("textbox", { name: "First name" })).toHaveAttribute("autocomplete", "given-name");
    expect(screen.getByRole("textbox", { name: "Last name" })).toHaveAttribute("autocomplete", "family-name");

Mock next/navigation and createBrowserSupabaseClient, submit valid values, and assert auth.signUp receives first_name, last_name, and full_name.

- [ ] **Step 2: Verify form tests are red**

Run: npm run test:run -- src/components/administration/administration-workspaces.test.tsx src/components/auth/applicant-registration-form.test.tsx

Expected: FAIL because only full-name inputs exist.

- [ ] **Step 3: Implement administrator invitation name fields**

Use this exact form signature:

    const form = useForm<z.input<typeof internalInvitationSchema>, unknown, InternalInvitationInput>({
      resolver: zodResolver(internalInvitationSchema),
      defaultValues: { email: "", firstName: "", lastName: "", role: "employee" },
    });

Render first and last name in grid gap-4 sm:grid-cols-2 with IDs invite-first-name/invite-last-name, given-name/family-name autocomplete, individual errors, h-11 role select, and h-11 w-full submit. Keep AdministrationFormPanel and data-side=center.

- [ ] **Step 4: Implement applicant registration name fields**

Replace the full-name field with the same grid. Parse applicantRegistrationSchema and call signUp with first_name, last_name, and full_name metadata. Use h-11 raw inputs, the correct autocomplete attributes, and aria-invalid when a field error is shown.

- [ ] **Step 5: Verify form tests are green**

Run: npm run test:run -- src/components/administration/administration-workspaces.test.tsx src/components/auth/applicant-registration-form.test.tsx

Expected: PASS; both forms use name parts and applicant metadata is structured.

- [ ] **Step 6: Commit**

Run: git add src/components/administration/administration-workspaces.tsx src/components/administration/administration-workspaces.test.tsx src/components/auth/applicant-registration-form.tsx src/components/auth/applicant-registration-form.test.tsx

Run: git commit -m "feat: collect structured names in account forms"

### Task 4: Apply the mobile-first red-and-blue system across roles

**Files:**
- Modify: src/components/ui/input.tsx, src/components/ui/button.tsx, src/components/ui/sheet.tsx
- Modify: src/components/administration/administration-workspaces.tsx and paginated-table-controls.tsx
- Modify: src/components/app-shell/app-shell.tsx, app-shell.test.tsx, role-landing.tsx
- Modify: src/components/auth/auth-card.tsx, auth-card.test.tsx
- Modify: src/components/personnel-records/employee-directory.tsx, employee-form.tsx, employee-record-summary.tsx, record-entry-form.tsx, and matching tests
- Modify: src/app/page.tsx and src/app/globals.css

**Interfaces:**
- Produces 44px shared Input and default Button touch targets.
- Produces mobile-stacked RoleLanding layouts for Employee, Management, and Applicant.
- Produces mobile-stacked action areas while tables remain complete, labelled, and horizontally scrollable.

- [ ] **Step 1: Write failing branding and responsive structure tests**

    expect(screen.getByTestId("brand-command-accent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /toggle sidebar/i })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: /save employee/i })).toHaveClass("w-full");

In the administration test, assert Invite account includes w-full and sm:w-auto while the modal retains data-side=center.

- [ ] **Step 2: Verify UI tests are red**

Run: npm run test:run -- src/components/app-shell/app-shell.test.tsx src/components/auth/auth-card.test.tsx src/components/personnel-records/employee-form.test.tsx src/components/personnel-records/personnel-records.test.tsx src/components/administration/administration-workspaces.test.tsx

Expected: FAIL because no command-red marker or mobile action contracts exist.

- [ ] **Step 3: Set shared mobile defaults**

Change default Input and Button height from h-8 to min-h-11. Keep xs and sm variants for deliberate dense controls. Change default icon buttons to size-11. Centered SheetContent remains centered but uses w-[calc(100%-1.5rem)], max-h-[calc(100dvh-1.5rem)], and sm:max-w-lg.

- [ ] **Step 4: Refine all-role workspaces**

For administration action bars use flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between. Primary actions use h-11 w-full sm:w-auto; selects use h-11; checkbox labels min-h-11; row actions flex-col then sm:flex-row. Pagination stacks first and reverts at sm.

Retain every current overflow-x-auto table, semantic header, and minimum width. For HR personnel records retain current one-column-first forms and h-11 controls, make action links w-full sm:w-auto, and do not hide record data on mobile. Make RoleLanding CardHeader flex-col sm:flex-row to cover Employee, Management, and Applicant routes.

- [ ] **Step 5: Apply the red-and-blue police identity**

In globals.css register --brand-command-red through @theme inline with a contrast-safe red distinct from --destructive. Add the decorative data-testid="brand-command-accent" to the AppShell brand block and matching short red rules to AuthCard and the public identity surface. Keep sidebar navy and primary blue; do not turn primary actions red. Give public landing actions min-h-11 w-full sm:w-auto.

- [ ] **Step 6: Verify UI tests are green**

Run: npm run test:run -- src/components/app-shell/app-shell.test.tsx src/components/auth/auth-card.test.tsx src/components/personnel-records/employee-form.test.tsx src/components/personnel-records/personnel-records.test.tsx src/components/administration/administration-workspaces.test.tsx

Expected: PASS with brand marker, touch controls, centered modal, and responsive action contracts.

- [ ] **Step 7: Run the required UI accessibility review**

Run: py -3 C:\Users\ASUS\.agents\skills\ui-ux-pro-max\scripts\search.py --domain ux "animation accessibility z-index loading" -p "San Juan City Police HRIS mobile-first administration" -f markdown

Apply findings in scope: visible focus, non-color error text, touch targets, contained table scrolling, reduced-motion-safe transitions, and correct dialog/sidebar layering.

- [ ] **Step 8: Commit**

Run: git add src/components/ui/input.tsx src/components/ui/button.tsx src/components/ui/sheet.tsx src/components/administration/administration-workspaces.tsx src/components/administration/paginated-table-controls.tsx src/components/app-shell/app-shell.tsx src/components/app-shell/app-shell.test.tsx src/components/app-shell/role-landing.tsx src/components/auth/auth-card.tsx src/components/auth/auth-card.test.tsx src/components/personnel-records/employee-directory.tsx src/components/personnel-records/employee-form.tsx src/components/personnel-records/employee-record-summary.tsx src/components/personnel-records/record-entry-form.tsx src/components/personnel-records/employee-form.test.tsx src/components/personnel-records/personnel-records.test.tsx src/app/page.tsx src/app/globals.css

Run: git commit -m "feat: make role workspaces mobile-first"

### Task 5: Validate the branch and create the pull request

**Files:**
- Verify all files from Tasks 1 through 4.

**Interfaces:**
- Consumes branch codex/fix-invitation-mobile-first based on origin/main at e57ef93.
- Produces verified commits, a pushed branch, and a PR documenting post-merge function deployment.

- [ ] **Step 1: Run complete tests**

Run: npm run test:run

Expected: PASS with no failing Vitest files.

- [ ] **Step 2: Run static and production verification**

Run: npm run lint; npm run typecheck; npm run build; git diff --check

Expected: every command exits 0 and git diff --check prints nothing.

- [ ] **Step 3: Inspect scope and ancestry**

Run: git diff origin/main...HEAD --check; git log --oneline origin/main..HEAD; git status --short

Expected: no whitespace errors, only task commits after origin/main, and a clean worktree.

- [ ] **Step 4: Push and create the PR**

Run: git push -u origin codex/fix-invitation-mobile-first

Run: gh pr create --base main --head codex/fix-invitation-mobile-first --title "Fix invitations and mobile-first account flows"

Use a PR body that lists CORS handling, first/last-name compatibility, red-and-blue mobile-first UI, complete test/lint/typecheck/build verification, and the post-merge invite-internal-user Edge Function deployment. State explicitly that no database migration is required.

- [ ] **Step 5: Verify remote PR and post-merge handoff**

Run: gh pr view --json url,state,baseRefName,headRefName

Expected: an open PR from codex/fix-invitation-mobile-first to main.

After merge deploy invite-internal-user with the approved Supabase command, then run the Task 2 OPTIONS request against https://wcjpyzulbiexvwtmyudq.supabase.co/functions/v1/invite-internal-user. Expected: successful CORS preflight before testing a signed-in administrator invitation.
