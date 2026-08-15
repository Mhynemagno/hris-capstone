# Administration Reliability and San Juan City Police Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Repair paginated Administration account data, replace form cabinets with accessible modal dialogs, show readable audit history, and apply the San Juan City Police identity throughout the HRIS.

**Architecture:** Administration read functions perform page-bounded composition: retrieve at most one 20-row primary page, then retrieve only the related rows referenced by that page and merge them in TypeScript. A shared modal wrapper replaces the Administration sheet component. A pure audit-presenter module maps raw audit rows plus bounded lookup labels to display-safe fields. Global semantic CSS tokens drive the client rebrand without per-component hex colors.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/Base UI primitives, Supabase browser client protected by RLS, TanStack Query, React Hook Form, Zod, Vitest, Testing Library.

## Global Constraints

- Branch from the merged main branch: feat/06-administration-polish.
- Retain 20-row pagination for every Administration listing; never retrieve all profiles, roles, or audit logs in one browser request.
- Do not add a database migration, exposed view, RPC, or direct browser use of administrative secrets.
- Retain existing Supabase RLS and the protected invitation and managed-user mutation workflows.
- Every Administration create/edit workflow opens a centered, keyboard-accessible modal instead of a right-side cabinet.
- Use San Juan City Police across metadata, public identity, authentication, and authenticated shell; do not invent an official police logo.
- Use navy structural tokens, blue interaction tokens, and red destructive/error tokens with WCAG AA contrast.

---

## File structure

- Modify: src/queries/administration.ts — split managed-user and audit display lookups into bounded Supabase queries and return composed display data.
- Modify: src/queries/administration.test.ts — assert absence of relationship embeds, bounded ranges, lookup constraints, and composed results.
- Modify: src/lib/types/database.ts — define the display-ready audit record and minimal lookup row types.
- Create: src/lib/administration/audit-presentation.ts — pure mapping from audit data to human-readable labels and structured details.
- Create: src/lib/administration/audit-presentation.test.ts — deterministic coverage of audit phrasing and fallback behavior.
- Modify: src/components/administration/administration-form-panel.tsx — use the shared centered Dialog primitive and retain the existing component interface.
- Modify: src/components/administration/administration-workspaces.tsx — use the modal wrapper for every form; make Settings read-only until its edit modal opens; render formatted audit rows and a Details modal.
- Modify: src/components/administration/administration-workspaces.test.tsx — cover dialog roles, settings modal, human-readable audits, and structured-detail opening.
- Modify: src/app/globals.css — replace the blue-only theme tokens with San Juan City Police navy, blue, red, light, and dark semantic tokens.
- Modify: src/app/layout.tsx — update browser title and description.
- Modify: src/app/page.tsx — update the public identity copy and semantic token classes.
- Modify: src/components/auth/auth-card.tsx and src/components/auth/auth-card.test.tsx — update authentication identity copy.
- Modify: src/components/app-shell/app-shell.tsx and src/components/app-shell/app-shell.test.tsx — update authenticated-shell identity copy.

### Task 1: Repair bounded Administration account composition

**Files:**
- Modify: src/queries/administration.ts
- Modify: src/queries/administration.test.ts

**Interfaces:**
- Consumes: ManagedUserFilters, Profile, UserRole, and PaginatedResult from existing schemas/types.
- Produces: listManagedUsers(filters): Promise<PaginatedResult<ManagedUser, ManagedUserFilters>> without a PostgREST relationship embed.

- [ ] **Step 1: Write the failing query tests**

~~~ts
it("composes a managed-user page from a 20-row profile range and role rows constrained to those IDs", async () => {
  const page = await listManagedUsers({ page: 2, pageSize: 20 });

  expect(profileChain.range).toHaveBeenCalledWith(20, 39);
  expect(roleChain.in).toHaveBeenCalledWith("user_id", [testUserId]);
  expect(profileChain.select).not.toHaveBeenCalledWith(expect.stringContaining("user_roles!"));
  expect(page.rows[0]).toMatchObject({ id: testUserId, role: "employee" });
});
~~~

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: npm run test:run -- src/queries/administration.test.ts

Expected: FAIL because listManagedUsers still requests user_roles as a nested relationship.

- [ ] **Step 3: Implement the smallest bounded composition**

~~~ts
const profiles = await client
  .from("profiles")
  .select("id, email, full_name, is_active, created_at, updated_at", { count: "exact" })
  .order("full_name")
  .order("email")
  .range(from, to);

const ids = (profiles.data ?? []).map((profile) => profile.id);
const roles = ids.length
  ? await client.from("user_roles").select("user_id, role, assigned_at").in("user_id", ids)
  : { data: [], error: null };
~~~

Merge with a Map keyed by user_id. Apply a role predicate only to returned role rows, retain page range limits, and return no missing relationship select string.

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: npm run test:run -- src/queries/administration.test.ts

Expected: PASS; tests prove a 20-row range and user-ID-constrained role lookup.

- [ ] **Step 5: Commit the query repair**

~~~powershell
git add src/queries/administration.ts src/queries/administration.test.ts
git commit -m "fix: compose paginated administration accounts"
~~~

### Task 2: Add deterministic audit presentation and bounded display lookups

**Files:**
- Modify: src/lib/types/database.ts
- Create: src/lib/administration/audit-presentation.ts
- Create: src/lib/administration/audit-presentation.test.ts
- Modify: src/queries/administration.ts
- Modify: src/queries/administration.test.ts

**Interfaces:**
- Produces: AuditLogDisplay with when, actorLabel, recordLabel, actionLabel, summary, and details fields.
- Produces: presentAuditLog(log, lookups): AuditLogDisplay.
- Produces: listAuditLogs(filters): Promise<PaginatedResult<AuditLogDisplay, AuditLogFilters>>.

- [ ] **Step 1: Write the failing formatter tests**

~~~ts
expect(presentAuditLog(departmentInsert, lookups)).toMatchObject({
  actorLabel: "Ada Lovelace",
  recordLabel: "Department “Employees”",
  actionLabel: "Created",
  summary: "Department “Employees” created",
});

expect(presentAuditLog(roleChange, lookups).summary)
  .toBe("Account role changed to System Administrator");
~~~

Include tests for profile activation, system actor, unknown references, position labels, settings updates, and preserved structured details.

- [ ] **Step 2: Run formatter tests to verify they fail**

Run: npm run test:run -- src/lib/administration/audit-presentation.test.ts

Expected: FAIL because the presentation module does not exist.

- [ ] **Step 3: Implement the pure presenter and bounded query lookups**

~~~ts
const actorIds = uniqueNonNull(rows.map((row) => row.actor_user_id));
const profileIds = uniqueNonNull([
  ...actorIds,
  ...rows.filter(isUserRecord).map((row) => row.entity_id),
]);

const profiles = profileIds.length
  ? await client.from("profiles").select("id, full_name, email").in("id", profileIds)
  : { data: [], error: null };
~~~

Use metadata name/title as the historical record label first. Query departments and positions only for referenced IDs with missing labels. Never query an unbounded lookup table. Build lookup maps, then call presentAuditLog for each of the at-most-20 audit rows.

- [ ] **Step 4: Run formatter and query tests to verify they pass**

Run: npm run test:run -- src/lib/administration/audit-presentation.test.ts src/queries/administration.test.ts

Expected: PASS; readable text is deterministic and every supplemental lookup is ID-bounded.

- [ ] **Step 5: Commit readable audit history**

~~~powershell
git add src/lib/types/database.ts src/lib/administration/audit-presentation.ts src/lib/administration/audit-presentation.test.ts src/queries/administration.ts src/queries/administration.test.ts
git commit -m "feat: humanize administration audit history"
~~~

### Task 3: Replace Administration cabinets with accessible centered modals

**Files:**
- Modify: src/components/administration/administration-form-panel.tsx
- Modify: src/components/administration/administration-workspaces.tsx
- Modify: src/components/administration/administration-workspaces.test.tsx

**Interfaces:**
- Preserves: AdministrationFormPanelProps.
- Produces: an accessible dialog named by title, described by description, and closed through the existing onOpenChange callback.

- [ ] **Step 1: Write failing modal interaction tests**

~~~tsx
await user.click(screen.getByRole("button", { name: "Invite account" }));
expect(screen.getByRole("dialog", { name: "Invite account" })).toBeInTheDocument();

await user.click(screen.getByRole("button", { name: /edit organization settings/i }));
expect(screen.getByRole("dialog", { name: /organization settings/i })).toBeInTheDocument();
~~~

Assert that the dialog has a close button, that audit Details opens a dialog containing structured values, and that the settings page has no always-visible editable form.

- [ ] **Step 2: Run workspace tests to verify they fail**

Run: npm run test:run -- src/components/administration/administration-workspaces.test.tsx

Expected: FAIL because AdministrationFormPanel currently renders a right-side Sheet and Settings renders fields inline.

- [ ] **Step 3: Implement the Dialog-based shared panel and workspace wiring**

~~~tsx
<Dialog onOpenChange={onOpenChange} open={open}>
  <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
    {children}
  </DialogContent>
</Dialog>
~~~

Use this wrapper for invitation, account management, department, position, and settings forms. Display settings as labelled values with an Edit organization settings trigger. Render AuditLogDisplay values in the table and provide a named Details button for each row.

- [ ] **Step 4: Run workspace tests to verify they pass**

Run: npm run test:run -- src/components/administration/administration-workspaces.test.tsx

Expected: PASS; modal forms are discoverable through dialog roles and audit rows show readable values.

- [ ] **Step 5: Commit modal Administration workflows**

~~~powershell
git add src/components/administration/administration-form-panel.tsx src/components/administration/administration-workspaces.tsx src/components/administration/administration-workspaces.test.tsx
git commit -m "feat: use modals for administration workflows"
~~~

### Task 4: Apply the San Juan City Police identity and semantic theme

**Files:**
- Modify: src/app/globals.css
- Modify: src/app/layout.tsx
- Modify: src/app/page.tsx
- Modify: src/components/auth/auth-card.tsx
- Modify: src/components/auth/auth-card.test.tsx
- Modify: src/components/app-shell/app-shell.tsx
- Modify: src/components/app-shell/app-shell.test.tsx

**Interfaces:**
- Produces: CSS custom properties for semantic navy, blue, red, surface, text, border, focus, and sidebar colors in light and dark themes.
- Produces: the San Juan City Police name in metadata, public page, authentication card, and application shell.

- [ ] **Step 1: Write failing identity tests**

~~~tsx
expect(screen.getByRole("main")).toHaveTextContent("San Juan City Police");
expect(screen.getByText("San Juan City Police")).toBeInTheDocument();
~~~

Update the existing auth-card and app-shell tests to require the client name. Add a layout metadata assertion if the project test setup supports server metadata imports.

- [ ] **Step 2: Run the identity tests to verify they fail**

Run: npm run test:run -- src/components/auth/auth-card.test.tsx src/components/app-shell/app-shell.test.tsx

Expected: FAIL because existing copy says HRIS Capstone.

- [ ] **Step 3: Implement global identity and token changes**

~~~css
:root {
  --primary: oklch(0.39 0.12 258);
  --accent: oklch(0.48 0.17 258);
  --destructive: oklch(0.46 0.18 27);
  --sidebar: oklch(0.21 0.06 258);
  --ring: oklch(0.48 0.17 258);
}
~~~

Use the new semantic tokens in the public page and shell. Set metadata title to San Juan City Police HRIS and use a precise human-resources description. Keep Lucide icons and text branding; do not add an unofficial logo asset.

- [ ] **Step 4: Run identity and UI tests to verify they pass**

Run: npm run test:run -- src/components/auth/auth-card.test.tsx src/components/app-shell/app-shell.test.tsx src/components/administration/administration-workspaces.test.tsx

Expected: PASS; all tested client surfaces use the approved identity and Administration interaction behavior remains intact.

- [ ] **Step 5: Commit global branding**

~~~powershell
git add src/app/globals.css src/app/layout.tsx src/app/page.tsx src/components/auth/auth-card.tsx src/components/auth/auth-card.test.tsx src/components/app-shell/app-shell.tsx src/components/app-shell/app-shell.test.tsx
git commit -m "feat: brand HRIS for San Juan City Police"
~~~

### Task 5: Verify the integrated change

**Files:**
- Modify only when a verification failure identifies a defect in the files from Tasks 1 through 4.

**Interfaces:**
- Confirms every exported query, modal, presentation helper, and global shell still compiles and behaves as documented.

- [ ] **Step 1: Run focused tests**

Run: npm run test:run -- src/queries/administration.test.ts src/lib/administration/audit-presentation.test.ts src/components/administration/administration-workspaces.test.tsx src/components/auth/auth-card.test.tsx src/components/app-shell/app-shell.test.tsx

Expected: PASS.

- [ ] **Step 2: Run repository verification**

Run: npm run lint

Expected: PASS.

Run: npm run typecheck

Expected: PASS.

Run: npm run test:run

Expected: PASS.

Run: npm run build

Expected: PASS.

- [ ] **Step 3: Run a visual and accessibility review**

Open each Administration route at 375px, 768px, 1024px, and 1440px. Confirm there is no viewport overflow outside the data-table wrapper; modals remain centered, close with Escape, show a visible focus ring, and do not trap a user outside their close action. Confirm blue is the primary interaction color and red is reserved for destructive/error states.

- [ ] **Step 4: Commit any verification-only corrections**

If every verification command passes without a defect, create no additional commit. If a defect is found and corrected, stage the exact changed paths reported by git status and commit with:

~~~powershell
git commit -m "fix: verify administration polish"
~~~
