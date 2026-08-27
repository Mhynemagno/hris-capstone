# Employee Profile Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver a concise, private employee profile with optional photo, police rank and unit/station, prominent trainings, account self-service, and an account-to-profile view flow for administrators.

**Architecture:** Preserve employees and its official audit trail; add minimal rank, unit/station, and private-image-path data. Small shared profile components provide HR-editable, admin-read-only, and employee-self-service modes, with route layouts and Supabase RLS as the authorization boundary.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind, TanStack Query, Zod, Supabase Postgres/Auth/Storage, Vitest, pgTAP.

**Spec:** docs/superpowers/specs/2026-08-28-employee-profile-simplification-design.md

## Global Constraints

- Keep employees.employee_number and label it “Badge number” in UI.
- Use private Storage and signed URLs only; no public image URL or service-role credential.
- Employee change requests include only email, phone, emergency-contact name, and emergency-contact phone.
- System Administrators are profile/training read-only; only HR changes official personnel data.
- Maintain labels, 44px controls, focus states, accessible alerts, and responsive checks at 375/768/1024/1440px.
- Create a migration through npx supabase migration new employee_profile_simplification.

---

### Task 1: Secure the profile data and Storage boundary

**Files:**

- Create: migration emitted by npx supabase migration new employee_profile_simplification
- Modify: supabase/tests/personnel_records.test.sql
- Modify: supabase/tests/profile_change_approval.test.sql

**Interfaces:**

- Adds nullable employees.rank, unit_station, and profile_image_path.
- Adds private employee-profile-photos Storage paths: employees/<employee-id>/<uuid>.<png|jpg|jpeg|webp>.
- Lets System Administrators read employees/trainings, never mutate them.

- [ ] **Step 1: Write the failing database assertions.**

    select throws_ok(
      $$insert into public.employees (employee_number, first_name, last_name, personal_email, employment_started_on, rank)
        values ('PAT-001', 'Ana', 'Dela Cruz', 'ana@example.test', current_date, 'Commander')$$,
      '23514', null, 'only supplied police ranks are accepted'
    );
    select throws_ok(
      $$update public.employees set unit_station = 'Station 1' where id = employee_id$$,
      '42501', null, 'administrator cannot edit an official employee record'
    );

- [ ] **Step 2: Verify red.**

Run: npx supabase test db --tests supabase/tests/personnel_records.test.sql --tests supabase/tests/profile_change_approval.test.sql

Expected: rank/Storage/Admin read-only/address-exclusion coverage fails because the feature does not exist.

- [ ] **Step 3: Implement the smallest migration.**

Use the CLI-created migration. Add a check-limited rank catalogue, 160-character unit/station, controlled image path, a non-public 5MB PNG/JPEG/WebP bucket, least-privilege Storage policies, and per-operation employee/training policies. Change the protected profile-change procedure to reject address. Keep grants and RLS together.

- [ ] **Step 4: Verify green.**

Run: npx supabase test db --tests supabase/tests/personnel_records.test.sql --tests supabase/tests/profile_change_approval.test.sql

Expected: existing cases plus new rank, Storage, profile-change, and Admin allow/deny cases pass.

- [ ] **Step 5: Commit.**

    git add supabase/migrations supabase/tests/personnel_records.test.sql supabase/tests/profile_change_approval.test.sql
    git commit -m "feat: secure simplified employee profile data"

### Task 2: Add typed profile contracts, queries, and mutations

**Files:**

- Modify: src/lib/types/database.ts
- Modify: src/schemas/personnel-records.ts
- Modify: src/schemas/personnel-records.test.ts
- Modify: src/queries/personnel-records.ts
- Modify: src/queries/personnel-records.test.ts
- Modify: src/queries/administration.ts
- Modify: src/queries/administration.test.ts
- Modify: src/hooks/use-personnel-records.ts
- Modify: src/hooks/use-administration.ts

**Interfaces:**

- Exports POLICE_RANKS plus rank, unit_station, and profile_image_path on Employee.
- Maps a linked employee_id onto ManagedUser.
- Provides employee photo upload/replacement/delete and signed-URL query hooks.

- [ ] **Step 1: Write failing test-first contracts.**

    it("rejects a rank outside the police catalogue", () => {
      expect(() => employeeSchema.parse({ ...validEmployee, rank: "Commander" })).toThrow(/rank/i);
    });

    it("adds a profile link only for a linked managed account", async () => {
      await expect(getEmployeeForManagedUser(userId)).resolves.toMatchObject({ id: employeeId });
    });

- [ ] **Step 2: Verify red.**

Run: npm run test:run -- src/schemas/personnel-records.test.ts src/queries/personnel-records.test.ts src/queries/administration.test.ts

Expected: the rank contract and linked employee lookup are missing.

- [ ] **Step 3: Implement the minimal typed surface.**

Centralize supplied rank display values. Validate photo MIME/size before Storage interaction. Never accept arbitrary object paths. Scope the linked-account lookup through RLS, issue signed URLs only for a persisted controlled path, and invalidate directory/profile/photo queries after successful mutations.

- [ ] **Step 4: Verify green.**

Run: npm run test:run -- src/schemas/personnel-records.test.ts src/queries/personnel-records.test.ts src/queries/administration.test.ts src/hooks/use-personnel-records.test.tsx

Expected: contracts, errors, mappings, and invalidation pass.

- [ ] **Step 5: Commit.**

    git add src/lib/types/database.ts src/schemas src/queries src/hooks
    git commit -m "feat: add employee profile data contracts"

### Task 3: Create the shared concise profile interface

**Files:**

- Create: src/components/personnel-records/employee-profile-header.tsx
- Create: src/components/personnel-records/employee-profile-details.tsx
- Create: src/components/personnel-records/employee-training-list.tsx
- Create: src/components/personnel-records/employee-profile.tsx
- Create: src/components/personnel-records/employee-profile.test.tsx
- Modify: src/components/personnel-records/employee-form.tsx
- Modify: src/components/personnel-records/employee-record-detail.tsx
- Modify: src/components/personnel-records/employee-record-summary.tsx

**Interfaces:**

- EmployeeProfile({ employee, trainings, mode, actions }) supports hr, admin-readonly, and employee modes.
- EmployeeTrainingList({ trainings, editable, onEdit, onDelete }) shows entries or the explicit empty state.

- [ ] **Step 1: Write failing UI behavior tests.**

    it("labels the identifier as badge number and falls back to initials", () => {
      render(<EmployeeProfile employee={employeeWithoutPhoto} trainings={[]} mode="admin-readonly" actions={null} />);
      expect(screen.getByText("Badge number")).toBeInTheDocument();
      expect(screen.getByText("AD")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /edit profile/i })).not.toBeInTheDocument();
    });

- [ ] **Step 2: Verify red.**

Run: npm run test:run -- src/components/personnel-records/employee-profile.test.tsx src/components/personnel-records/personnel-records.test.tsx

Expected: the shared profile and Badge-number interface are absent.

- [ ] **Step 3: Implement the minimal responsive composition.**

Use existing Avatar, Badge, Button, Card, ErrorState, and LoadingState primitives. Build a semantic identity header, facts grid, contact/emergency cards, and training list. Render absent optional fields as “Not provided”. Reduce the HR form to identity, rank, assignment, contact, and emergency data; preserve uncollected legacy values during updates.

- [ ] **Step 4: Verify green.**

Run: npm run test:run -- src/components/personnel-records/employee-profile.test.tsx src/components/personnel-records/personnel-records.test.tsx src/components/personnel-records/employee-form.test.tsx

Expected: modes, fallbacks, labels, reduced form, and training states pass.

- [ ] **Step 5: Commit.**

    git add src/components/personnel-records
    git commit -m "feat: present concise employee profiles"

### Task 4: Add employee self-service and password security

**Files:**

- Create: src/components/personnel-records/employee-profile-photo-control.tsx
- Create: src/components/auth/change-password-form.tsx
- Create: src/components/auth/change-password-form.test.tsx
- Create: src/app/(app)/employee/profile/security/page.tsx
- Modify: src/app/(app)/employee/profile/page.tsx
- Modify: src/components/profile-change-requests/profile-change-request-form.tsx
- Modify: src/components/profile-change-requests/profile-change-request-form.test.tsx

**Interfaces:**

- ChangePasswordForm({ onChangePassword }) validates confirmation before supabase.auth.updateUser({ password }).
- EmployeeProfilePhotoControl accepts only PNG/JPEG/WebP no larger than 5MB.

- [ ] **Step 1: Write failing self-service tests.**

    it("does not submit a password until confirmation matches", async () => {
      const onChangePassword = vi.fn();
      render(<ChangePasswordForm onChangePassword={onChangePassword} />);
      await user.type(screen.getByLabelText(/^new password/i), "long-enough-password");
      await user.type(screen.getByLabelText(/confirm new password/i), "different-password");
      await user.click(screen.getByRole("button", { name: /change password/i }));
      expect(onChangePassword).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(/match/i);
    });

- [ ] **Step 2: Verify red.**

Run: npm run test:run -- src/components/auth/change-password-form.test.tsx src/components/profile-change-requests/profile-change-request-form.test.tsx

Expected: password form and reduced employee change form fail.

- [ ] **Step 3: Implement employee-only actions.**

Use the shared profile for the employee route, photo control, read-only trainings, request links/history, and a security route. Add autocomplete="new-password", accessible inline feedback, pending state, and field clearing on password success. Remove address from new profile-change UI. Do not render password controls for HR/Admin.

- [ ] **Step 4: Verify green.**

Run: npm run test:run -- src/components/auth/change-password-form.test.tsx src/components/profile-change-requests/profile-change-request-form.test.tsx

Expected: password validation and approved request-field limits pass.

- [ ] **Step 5: Commit.**

    git add src/components/auth src/components/personnel-records src/components/profile-change-requests src/app/(app)/employee/profile
    git commit -m "feat: add employee profile self-service"

### Task 5: Link Users to an Admin-safe profile and clarify Roles

**Files:**

- Create: src/app/(app)/admin/users/[userId]/profile/page.tsx
- Create: src/app/(app)/admin/users/[userId]/profile/page.test.tsx
- Modify: src/components/administration/administration-workspaces.tsx
- Modify: src/components/administration/administration-workspaces.test.tsx

**Interfaces:**

- Users render /admin/users/<profile-id>/profile only when ManagedUser.employee_id exists.
- Roles render role-management actions and never an employee-profile action.
- The Admin route resolves the account link and renders EmployeeProfile in admin-readonly mode.

- [ ] **Step 1: Write failing Users/Roles tests.**

    it("links a linked account to its read-only employee profile", () => {
      render(<UsersWorkspace />);
      expect(screen.getByRole("link", { name: /view profile for officer ada/i }))
        .toHaveAttribute("href", "/admin/users/" + managedUser.id + "/profile");
    });

    it("never exposes a personal profile action in Roles", () => {
      render(<RolesWorkspace />);
      expect(screen.queryByRole("link", { name: /view profile/i })).not.toBeInTheDocument();
    });

- [ ] **Step 2: Verify red.**

Run: npm run test:run -- src/components/administration/administration-workspaces.test.tsx

Expected: managed users lack an employee link and Roles duplicates user actions.

- [ ] **Step 3: Implement the smallest safe linkage.**

Add the conditional Users link, parameterize the shared accounts workspace so Roles has no invite/profile action, and add the server-protected Admin route. Resolve the user ID to the one linked employee with RLS, return the existing safe missing/unauthorized state, and render no mutation/password controls.

- [ ] **Step 4: Verify green.**

Run: npm run test:run -- src/components/administration/administration-workspaces.test.tsx src/app/(app)/admin/users/[userId]/profile/page.test.tsx

Expected: Users links only valid profiles and Roles exposes no personnel data.

- [ ] **Step 5: Commit.**

    git add src/app/(app)/admin/users src/components/administration
    git commit -m "feat: let administrators view linked employee profiles"

### Task 6: Verify the completed feature

**Files:**

- Modify only files required to correct an evidenced test, database, lint, type, build, or visual regression.

- [ ] **Step 1: Run all automated checks.**

    npx supabase test db
    npm run lint
    npm run typecheck
    npm run test:run
    npm run build

- [ ] **Step 2: Perform visual QA.**

Inspect HR profile, employee profile/security, Users, linked Admin profile, and Roles at 375/768/1024/1440px. Confirm no horizontal overflow; image alternatives, focus rings, empty states, and feedback are visible; and Admin never sees edit or password actions.

- [ ] **Step 3: Correct only verified defects using the TDD cycle.**

Add a focused failing assertion, observe the expected failure, implement the smallest correction, rerun its focused test, then repeat the full suite.

- [ ] **Step 4: Commit final verified fixes.**

    git add -A
    git commit -m "fix: verify employee profile experience"

