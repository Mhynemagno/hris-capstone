# Project Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a clean clone of the HRIS scaffold install, validate, test, build, and display a harmless public landing page.

**Architecture:** Keep Supabase client construction in `src/lib/supabase`, reserve the browser query folders for module-owned hooks, and provide reusable UI state components. The root query provider and query-key conventions are deferred to the authenticated app-shell branch. The landing page contains no data access and only points users toward future routes.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS 4, Supabase SSR, TanStack Query, Zod, Vitest, React Testing Library, GitHub Actions.

## Global Constraints

- Browser code uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Do not commit `.env.local`, secret keys, service-role keys, database migrations, or future HRIS modules.
- Use Zod as the source of truth for input validation in later forms and request boundaries.
- Use TanStack Query only for browser data fetching and mutations.
- The public landing page must link to `/login` and `/jobs` without implementing either route.

---

## File Structure

- `src/lib/supabase/*`: request-appropriate Supabase client factories.
- `src/components/ui/*`: shared presentational state components.
- `src/schemas`, `src/queries`, `src/hooks`: extension points for later branches.
- `src/test/*` and `src/**/*.test.tsx`: Vitest setup and behavior tests.
- `.env.example`, `README.md`, `.github/workflows/ci.yml`: setup, deployment, and verification documentation.

### Task 1: Establish dependencies, scripts, and test harness

**Files:** Modify `package.json`, `package-lock.json`, `tsconfig.json`, `.github/workflows/ci.yml`; create `vitest.config.ts`, `src/test/setup.ts`.

**Produces:** `npm run typecheck` and `npm test` commands.

- [ ] Write `src/app/page.test.tsx` asserting that a Sign in link targets `/login`.
- [ ] Run `npm test -- --run src/app/page.test.tsx` and observe failure because no test script exists.
- [ ] Install Vitest and Testing Library; add `test`, `test:run`, and `typecheck` scripts.
- [ ] Configure jsdom setup and re-run the landing test, observing failure because the starter page lacks the link.

### Task 2: Add Supabase and application extension points

**Files:** Create `.env.example`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/schemas/index.ts`, `src/queries/index.ts`, `src/hooks/index.ts`.

**Produces:** `createBrowserSupabaseClient()` and `createServerSupabaseClient()`.

- [ ] Write `src/lib/supabase/env.test.ts` that exercises supplied and missing public configuration.
- [ ] Run it and observe the missing-module failure.
- [ ] Implement the minimum public-key-only client factories and environment validation.
- [ ] Re-run the configuration test and observe a passing result.

### Task 3: Build and test the public placeholder UI

**Files:** Modify `src/app/page.tsx`, `src/app/globals.css`; create shared state components and tests under `src/components/ui`.

**Produces:** `ErrorState`, `LoadingState`, `FormField`, and `EmptyTableState`.

- [ ] Re-run the failing landing-page test.
- [ ] Implement the accessible landing page with links to `/login` and `/jobs` plus the minimal state components.
- [ ] Add state-component tests and run `npm run test:run`.

### Task 4: Document deployment and verify the baseline

**Files:** Modify `README.md`, `.github/workflows/ci.yml`; include the design and plan documents.

- [ ] Document local setup and manual Vercel configuration for the two public variables.
- [ ] Configure CI to run `npm ci`, lint, typecheck, tests, and build.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build`.
- [ ] Commit focused changes and create a PR against `main`.
