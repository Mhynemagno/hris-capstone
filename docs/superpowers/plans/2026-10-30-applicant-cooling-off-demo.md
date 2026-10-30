# Applicant Cooling-off and Presentation Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block a rejected applicant for six months, restore their login automatically afterwards, and let a System Administrator demonstrate that result safely for one chosen demo applicant in production.

**Architecture:** Keep permanent administrator deactivation in `profiles.is_active`; add a separate applicant cooling-off end timestamp and have the existing role/access guard enforce it. A singleton, System-Administrator-managed presentation-demo record supplies a temporary effective date for one selected applicant only; the same database decision is used by the login route and protected-role checks.

**Tech Stack:** Next.js 16.3.6 App Router, React 19, TypeScript, Supabase Postgres/RLS/Auth, TanStack Query 5, React Hook Form, Zod 4, Vitest/Testing Library, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-30-applicant-cooling-off-demo-design.md`

## Global Constraints

- A failed stage that becomes `Not Selected` blocks that applicant for exactly six calendar months from the recorded rejection time.
- Reaching the end date permits login automatically; HR must have no reactivation bypass.
- `profiles.is_active = false` remains a separate, permanent System Administrator account block and always wins.
- The presenter uses production as a System Administrator; the simulator must affect one selected, deliberately created demo applicant only.
- The simulator must never modify the server clock, job dates, reports, or any other account.
- Simulation start/reset must be obvious in the UI, expire after 30 minutes, and be audited.
- Keep login errors neutral to unauthenticated users.
- Do not push migrations to the remote production project during implementation.

## Review Focus

- A rejected applicant attempts a new password login before the six-month timestamp: task 2 verifies session sign-out and the neutral disabled result.
- The timestamp has passed naturally: task 1 verifies the role/access decision succeeds without a reactivation RPC, and task 2 verifies login continues.
- A System Administrator has genuinely disabled the same applicant: task 1 verifies `is_active = false` still denies access even after the cooling-off date or simulation.
- A non-administrator or a System Administrator attempting to target a non-applicant/invalid email: task 1 verifies the simulator RPC rejects it and writes no simulation state.
- An abandoned or expired presentation simulation: task 1 verifies its effective date is ignored after 30 minutes; task 3 makes the expired state visibly resettable.

---

### Task 1: Separate Cooling-off and Presentation State in Supabase

**Files:**
- Create: `supabase/migrations/20261030120000_applicant_cooling_off_and_presentation_demo.sql`
- Modify: `supabase/tests/recruitment_stage_results.test.sql`
- Modify: `supabase/tests/recruitment_cycles_and_resubmission.test.sql`

**Interfaces:**
- Produces `profiles.applicant_cooling_off_ends_at timestamptz null`; `is_active` remains the independent permanent-access switch.
- Produces singleton `public.applicant_login_presentation_demo` with the selected applicant, simulated effective time, expiry, and audit metadata.
- Produces `public.get_applicant_login_presentation_demo()` and `public.set_applicant_login_presentation_demo(target_email text, action text)` for System Administrator UI use.
- Produces one shared `private` access predicate used by `private.current_user_has_role()` and a safe `public.current_account_can_sign_in()` result used after password authentication.

- [ ] **Step 1: Write failing pgTAP coverage for normal six-month access, permanent deactivation precedence, System Administrator-only simulation, invalid targets, expired simulation, and audit rows**

In `recruitment_stage_results.test.sql`, replace assertions that a failed applicant becomes `is_active = false` and requires `reactivate_applicant_account`; assert instead that `is_active` stays true, the end timestamp is six months after the failure history, current applicant access is denied, and Supabase sessions are revoked. In `recruitment_cycles_and_resubmission.test.sql`, exercise Administrator, HR, applicant, and invalid-email calls to the new simulator RPC with `set local request.jwt.claim.sub`.

- [ ] **Step 2: Run the two pgTAP files to verify the old permanent-deactivation behaviour fails the new contract**

Run: `npx supabase test db --local supabase/tests/recruitment_stage_results.test.sql supabase/tests/recruitment_cycles_and_resubmission.test.sql`

Expected: FAIL because the cooling-off timestamp, simulator functions, and automatic-access predicate do not exist yet.

- [ ] **Step 3: Add the migration and shared database authorization decision**

Add `applicant_cooling_off_ends_at` to `profiles`, backfill it from failed `Not Selected` history without changing historical `is_active` values, and replace the rejection trigger so it writes `history.created_at + interval '6 months'`, revokes existing Auth sessions, and bans Auth only until that timestamp. Remove the HR reactivation route as an access mechanism.

Create the singleton presentation-demo table and `security definer` RPCs. `start` must accept only a current applicant with a future cooling-off date, record its simulated effective date at/after that end date, set a 30-minute expiry, temporarily lift only that target's Auth ban, and insert a dedicated audit event. `reset` clears the simulator, restores the target's actual Auth ban if necessary, and writes its audit event. Both paths must require `private.require_active_system_administrator()`; direct table writes remain unavailable to client roles.

Implement the one private predicate so it returns false for inactive profiles, and for applicant profiles returns true only when the real end date has passed or the singleton demo is active, unexpired, and targets that same profile. Use it in `private.current_user_has_role()` so RLS and protected pages reject an expired demo session. Expose a no-argument, authenticated-only `public.current_account_can_sign_in()` wrapper for the post-authentication login route.

- [ ] **Step 4: Re-run the pgTAP files and verify all new access and audit assertions pass**

Run: `npx supabase db reset --local --yes; npx supabase test db --local supabase/tests/recruitment_stage_results.test.sql supabase/tests/recruitment_cycles_and_resubmission.test.sql`

Expected: PASS, including denial before six months, automatic eligibility after the timestamp, and simulation isolation.

- [ ] **Step 5: Commit the database contract**

```powershell
git add supabase/migrations/20261030120000_applicant_cooling_off_and_presentation_demo.sql supabase/tests/recruitment_stage_results.test.sql supabase/tests/recruitment_cycles_and_resubmission.test.sql
git commit -m "feat: add applicant cooling-off access rule"
```

### Task 2: Enforce the Same Decision at Password Login

**Files:**
- Modify: `src/app/auth/login/route.ts`
- Modify: `src/app/auth/login/route.test.ts`
- Modify: `src/lib/auth/current-role.ts`
- Modify: `src/lib/auth/current-role.test.ts`

**Interfaces:**
- Consumes `public.current_account_can_sign_in()` from Task 1 after successful Supabase password authentication.
- Consumes the Task 1 private predicate through `private.current_user_has_role()` for all protected application roles.
- Produces a single neutral `account_disabled` outcome for permanently disabled and still-cooling-off accounts.

- [ ] **Step 1: Write failing route and role tests for a currently blocked applicant, a naturally eligible applicant, an active presentation simulation, an expired presentation simulation, and an inactive account**

Mock the post-login RPC/result in `login/route.test.ts`; assert denied results call `auth.signOut()` and redirect with `error=account_disabled`, while permitted results reach `/auth/continue`. In `current-role.test.ts`, retain disabled-account coverage and add the access predicate result to prove a cooling-off applicant cannot receive a role before expiry.

- [ ] **Step 2: Run the focused tests to verify the new assertions fail**

Run: `npm run test:run -- src/app/auth/login/route.test.ts src/lib/auth/current-role.test.ts`

Expected: FAIL because the login route only reads `profiles.is_active`.

- [ ] **Step 3: Replace the login route's profile-only post-auth check with the shared access result**

After Supabase authenticates the credentials, invoke the Task 1 no-argument access RPC as the newly authenticated user. If it returns false or errors, sign out and use the existing neutral disabled redirect. Keep the direct `user_banned` handling for the normal six-month Auth ban. Update `getCurrentRole()` only as required to use the same access decision without duplicating date logic.

- [ ] **Step 4: Run the focused tests and type check**

Run: `npm run test:run -- src/app/auth/login/route.test.ts src/lib/auth/current-role.test.ts; npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the login enforcement**

```powershell
git add src/app/auth/login/route.ts src/app/auth/login/route.test.ts src/lib/auth/current-role.ts src/lib/auth/current-role.test.ts
git commit -m "feat: enforce applicant cooling-off at login"
```

### Task 3: Add the System Administrator Presentation Simulator

**Files:**
- Modify: `src/lib/types/database.ts`
- Modify: `src/lib/query-keys.ts`
- Modify: `src/schemas/administration.ts`
- Modify: `src/queries/administration.ts`
- Modify: `src/queries/administration.test.ts`
- Modify: `src/hooks/use-administration.ts`
- Modify: `src/components/administration/administration-workspaces.tsx`
- Modify: `src/components/administration/administration-workspaces.test.tsx`
- Modify: `src/components/recruitment/applicant-account-actions.tsx`
- Modify: `src/components/recruitment/applicant-account-actions.test.tsx`

**Interfaces:**
- Consumes the Task 1 presentation-demo read/start/reset RPCs.
- Produces `ApplicantLoginPresentationDemo` and typed `startApplicantLoginPresentationDemo(email)` / `resetApplicantLoginPresentationDemo()` query functions and mutation hooks.
- Produces a System Settings card labelled `Applicant login presentation demo` with only the designated demo account affected.

- [ ] **Step 1: Write failing query, hook, and component tests for loading simulator status, starting with a valid applicant email, resetting it, pending/error feedback, and the active warning banner**

In the Settings workspace test, mock the status and mutations; assert no application controls are available until the System Administrator enters an email and starts the simulation, the UI displays the selected account and its normal eligibility date, and active state shows a clear banner plus Reset. In the query test, assert the exact RPC argument names and schema-rejected blank/invalid email. Update applicant-account-action tests so HR no longer sees a manual Reactivate account path; retained reopen-for-resubmission copy must not promise a cooling-off bypass.

- [ ] **Step 2: Run focused client tests to verify they fail**

Run: `npm run test:run -- src/queries/administration.test.ts src/components/administration/administration-workspaces.test.tsx src/components/recruitment/applicant-account-actions.test.tsx`

Expected: FAIL because presentation-demo data, hooks, and UI do not exist and HR still has reactivation controls.

- [ ] **Step 3: Implement typed admin data access and the System Settings card**

Add the database type, query key, Zod email/action schema, React Query read/mutation hooks, and cache invalidation for settings/audit data. Add a compact card below organization settings: it explains that the feature is for one deliberately created demo applicant, shows the real rejection/eligibility details returned by the server, requires the presenter to enter that applicant's email to start, and offers Reset. Use the project's dialog pattern for the destructive/temporary start confirmation and show a high-visibility active-simulation banner with the expiry time.

Remove the obsolete HR `Reactivate account` query, hook, button, and corresponding copy. Keep `Reopen for resubmission` independent, but clearly state that it does not end the six-month login block.

- [ ] **Step 4: Run focused client tests and lint**

Run: `npm run test:run -- src/queries/administration.test.ts src/components/administration/administration-workspaces.test.tsx src/components/recruitment/applicant-account-actions.test.tsx; npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit the administrator interface**

```powershell
git add src/lib/types/database.ts src/lib/query-keys.ts src/schemas/administration.ts src/queries/administration.ts src/queries/administration.test.ts src/hooks/use-administration.ts src/components/administration/administration-workspaces.tsx src/components/administration/administration-workspaces.test.tsx src/components/recruitment/applicant-account-actions.tsx src/components/recruitment/applicant-account-actions.test.tsx
git commit -m "feat: add applicant login presentation simulator"
```

### Task 4: Verify the Demonstrable End-to-end Journey and Handover

**Files:**
- Modify: `e2e/business-journeys.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes the Task 1 database contract, Task 2 login enforcement, and Task 3 System Administrator settings card.
- Produces a repeatable presenter procedure and a Playwright journey that covers block → simulation → successful login → reset.

- [ ] **Step 1: Write a failing Playwright journey using a rejected demo applicant and System Administrator session**

Add a test that verifies the rejected applicant sees the neutral login refusal, signs in as the System Administrator, opens System Settings, starts the named account's six-month-passed simulation, opens a fresh browser context to log in as the same applicant successfully, then resets and confirms the simulator banner disappears. Use local seeded credentials only; do not add production credentials or secret values to source control.

- [ ] **Step 2: Run the single Playwright test and verify it fails before the UI/data contract is wired**

Run: `npm run test:e2e -- e2e/business-journeys.spec.ts`

Expected: FAIL until the settings card and test fixture reflect the new journey.

- [ ] **Step 3: Add the presenter runbook and any minimal local-only fixture necessary for the repeatable test**

Document the production preparation: create a deliberately fictitious applicant, move its application to Not Selected, record its credentials securely outside the repository, log in as System Administrator, start the simulator, demonstrate applicant login in a private window, and press Reset. State that only a System Administrator can start/reset the simulation and that normal applications regain login automatically after six months.

- [ ] **Step 4: Run the complete relevant verification set**

Run: `npm run lint; npm run typecheck; npm run test:run; npx supabase db reset --local --yes; npx supabase test db --local; npm run test:e2e -- e2e/business-journeys.spec.ts; npm run build`

Expected: PASS; if a locally required service is unavailable, report that dependency and the completed checks rather than claiming it passed.

- [ ] **Step 5: Commit the journey and documentation**

```powershell
git add e2e/business-journeys.spec.ts README.md
git commit -m "test: cover applicant cooling-off presentation demo"
```

## Self-review

- **Spec coverage:** Tasks 1–2 implement immediate blocking and automatic return; Task 3 implements the System Administrator-only, account-specific, visible, audited simulator; Task 4 supplies the presentation procedure and full journey. No production-wide clock is introduced.
- **Step scan:** Each task begins with an observable failing test and ends with focused verification. The migration names the shared contract consumed by later tasks.
- **Type consistency:** The simulator's state is named `ApplicantLoginPresentationDemo` in client types and is backed by `applicant_login_presentation_demo` in Postgres; start/reset hooks call the singular RPC names defined by Task 1.
- **Review focus:** All five high-risk cases have an owning Task 1, 2, or 3 test.
- **Proportion:** The plan specifies boundaries and interfaces rather than SQL/React implementations; test coverage is concentrated on the changed authorization rule and the presenter journey.
