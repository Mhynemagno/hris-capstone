# Supabase Auth and RBAC Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the shared Supabase identity, single-role RLS, private-document-storage, and server authorization foundation for the HRIS.

**Architecture:** A single imperative Supabase migration creates public tables, RLS policies, private role helpers, a profile trigger, the private document bucket, and least-privilege Storage policies. Next.js gets a cookie-refreshing proxy plus verified server identity/role helpers; shared Zod and TypeScript declarations keep later modules consistent.

**Tech Stack:** Next.js 16, TypeScript, Supabase CLI, Supabase Postgres 17, `@supabase/ssr`, Zod 4, Vitest, pgTAP.

## Global Constraints

- Every exposed `public` table and Storage bucket has RLS enabled and permitted/denied tests.
- `user_roles.user_id` is the primary key, so every account has exactly one role.
- Use only `(select auth.uid())` for identity predicates and never authorize from `user_metadata`, `getSession()`, or client-supplied role input.
- No `service_role`, database password, personal access token, initial administrator email, or bootstrap SQL is committed.
- No sign-in pages, protected UI, application shell, role landing pages, or module-specific uploads are added in this branch.

---

## File Structure

- `supabase/config.toml`: linked-project and local development configuration.
- `supabase/migrations/<timestamp>_auth_rbac_foundation.sql`: schema, roles, indexes, RLS, trigger, and Storage policies.
- `supabase/tests/auth_rbac_foundation.test.sql`: pgTAP permitted and denied database tests.
- `src/lib/supabase/proxy.ts` and `src/proxy.ts`: authenticated-cookie refresh only.
- `src/lib/auth/*`: verified identity and server role lookup.
- `src/lib/types/database.ts`, `src/lib/types/roles.ts`, `src/schemas/common.ts`: shared types and Zod primitives.
- `src/lib/auth/*.test.ts`, `src/schemas/common.test.ts`: behavior and validation tests.
- `README.md`: local linking, migration, test, and bootstrap instructions without sensitive values.

### Task 1: Initialize and link Supabase project metadata

**Files:** Create `supabase/config.toml`; modify `.gitignore` only if generated local state needs exclusion.

**Produces:** An imperative Supabase migration project linked to `wcjpyzulbiexvwtmyudq`.

- [ ] Run `npx supabase@latest init` and inspect the generated configuration.
- [ ] Run `npx supabase@latest link --project-ref wcjpyzulbiexvwtmyudq`; the project owner enters the database password only at the CLI prompt.
- [ ] Run `npx supabase@latest migration list --linked` and record the clean baseline.
- [ ] Commit the non-secret configuration with `git commit -m "chore: initialize Supabase project"`.

### Task 2: Write failing database security tests

**Files:** Create `supabase/tests/auth_rbac_foundation.test.sql`.

**Consumes:** The empty linked project from Task 1.

**Produces:** A pgTAP suite that asserts five role fixtures and unauthenticated access are denied or allowed as required.

- [ ] Test that each user sees only their own profile and role; test that cross-user reads and writes return no rows.
- [ ] Test that only a System Administrator changes roles, departments, and positions; test that Management cannot mutate any foundation table.
- [ ] Test that HR can read approved personnel identity data but cannot assign roles or alter audit history.
- [ ] Test that the private Storage bucket rejects anonymous object reads and writes.
- [ ] Run `npx supabase@latest test db` and confirm the suite fails because the schema does not exist.

### Task 3: Create and apply the auth/RBAC migration

**Files:** Create `supabase/migrations/<CLI-generated>_auth_rbac_foundation.sql`.

**Consumes:** Task 2 role fixtures and policy expectations.

**Produces:** `profiles`, `user_roles`, `departments`, `positions`, `audit_logs`, `private-documents`, indexes, RLS policies, profile trigger, and private authorization helper.

- [ ] Run `npx supabase@latest migration new auth_rbac_foundation` to generate the migration filename.
- [ ] Define the five role values, tables, constraints, UTC timestamps, foreign keys, and indexes for all foreign-key/RLS lookup columns.
- [ ] Create a locked-down private role helper with explicit caller identity checks; revoke direct execution from `PUBLIC`, `anon`, `authenticated`, and `service_role`.
- [ ] Enable RLS and create least-privilege permitted/denied policies for each table and `storage.objects` bucket path.
- [ ] Create the Auth-user profile trigger and append-only audit workflow; ensure browser roles cannot update or delete audit logs.
- [ ] Apply with `npx supabase@latest db push --linked` and confirm the migration appears in `npx supabase@latest migration list --linked`.

### Task 4: Prove database behavior and security

**Files:** Modify `supabase/tests/auth_rbac_foundation.test.sql` only if test setup needs fixture corrections.

**Consumes:** Task 3 database objects.

**Produces:** Passing permitted and denied pgTAP coverage plus a clean database advisor report.

- [ ] Run `npx supabase@latest test db` and confirm all role/RLS/Storage tests pass.
- [ ] Run `npx supabase@latest db advisors --linked` when supported; otherwise use the dashboard advisor and resolve any high-severity security finding.
- [ ] Use a publishable-key test client for one permitted request and one cross-user denied request against the linked project.
- [ ] Commit with `git commit -m "feat: add Supabase auth and RBAC foundation"`.

### Task 5: Add server authorization helpers and shared validation

**Files:** Create `src/lib/supabase/proxy.ts`, `src/proxy.ts`, `src/lib/auth/current-user.ts`, `src/lib/auth/current-role.ts`, `src/lib/types/database.ts`, `src/lib/types/roles.ts`, `src/schemas/common.ts`; create matching test files.

**Consumes:** Database role type and policy semantics from Task 3.

**Produces:** `updateSession(request)`, `getVerifiedUser()`, `getCurrentRole()`, `APP_ROLES`, `appRoleSchema`, `uuidSchema`, `isoDateSchema`, `paginationSchema`, and `employeeNumberSchema`.

- [ ] Write failing tests for malformed role values, UUIDs, dates, pagination limits, and employee numbers.
- [ ] Write failing helper tests for a missing verified user and a missing role row.
- [ ] Implement the smallest helpers using `getClaims()` for identity and the server Supabase client for role lookup; do not add route authorization yet.
- [ ] Add a refresh-only proxy matcher that excludes static assets and keeps `/` public.
- [ ] Run `npm run test:run` and confirm all tests pass.
- [ ] Commit with `git commit -m "feat: add shared auth authorization helpers"`.

### Task 6: Document bootstrap and execute final verification

**Files:** Modify `README.md`.

**Consumes:** Linked CLI workflow and migrations from Tasks 1-5.

**Produces:** Reproducible non-secret setup instructions, including manual initial-administrator bootstrap.

- [ ] Document CLI login/linking, migration apply, database tests, and how the project owner assigns the initial administrator after creating an Auth user.
- [ ] Confirm no email, password, token, database credential, or service key appears in `git diff --check`, tracked files, or `.env.example`.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npx supabase@latest test db`, and `npx supabase@latest migration list --linked`.
- [ ] Commit documentation with `git commit -m "docs: document Supabase foundation setup"`.
