# Project Baseline Design

## Goal

Make the Next.js scaffold safe and consistent for later HRIS modules without introducing authentication, database schema, or role-specific behavior.

## Architecture

Supabase access is isolated behind browser and server client factories in `src/lib/supabase`; both consume only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Shared code is organized by responsibility: Zod schemas in `src/schemas`, thin Supabase query functions in `src/queries`, browser query hooks in `src/hooks`, reusable UI components in `src/components`, and tests in `src/**/*.test.tsx`.

The root page is a server-rendered public placeholder. It links to the future login and jobs routes without creating those routes early. TanStack Query is installed for later browser data work; its root provider and query-key conventions are deferred to the authenticated app-shell branch.

## Components and Data Flow

- `src/lib/supabase/client.ts` and `src/lib/supabase/server.ts` create request-appropriate Supabase clients.
- `src/components/ui` contains accessible loading, error, form-field, and table-empty-state building blocks.
- The landing page makes no database request.
- `.env.example` documents public placeholders only; `.env.local` remains ignored.

## Error Handling and Security

Supabase helpers fail clearly if required public environment values are missing. No secret or service-role key is accepted or documented. Error and loading components provide consistent visible states for later TanStack Query screens. This branch creates no public tables, Storage buckets, migrations, or RLS policies.

## Testing and Verification

Vitest with Testing Library verifies the landing-page links and shared UI states. CI runs `npm ci`, linting, TypeScript validation, tests, and a production build. The README documents local setup and the manual Vercel environment-variable configuration.

## Out of Scope

Authentication pages, route guards, database migrations, RLS, form submissions, job listings, and Vercel dashboard mutations are deferred to later roadmap branches or manual deployment setup.
