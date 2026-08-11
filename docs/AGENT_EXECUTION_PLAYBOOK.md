# HRIS Agent Execution Playbook

This is the shared delivery routine for every branch in [IMPLEMENTATION_ORDER.md](IMPLEMENTATION_ORDER.md). The roadmap contains the feature-specific work; this file prevents every task description from repeating the same Git and verification instructions.

## Before starting a task

1. Read `PROJECT_SCOPE.md`, this playbook, and the selected branch section in `IMPLEMENTATION_ORDER.md`.
2. Confirm every prerequisite branch in the dependency map is merged into `main`.
3. Create the specified branch from the latest `main`; do not reuse another feature branch.
4. Inspect the existing source and migrations. Follow the established folder and migration conventions.
5. State any missing external dependency immediately. Examples: Supabase project credentials, Gemini API key, supported biometric vendor documentation, or Vercel project access.

## Implementation rules

- Work only on the selected branch's objective, deliverables, and pages. Do not add future modules opportunistically.
- Write/adjust tests before implementation where practical, then make the minimal change that satisfies the acceptance criteria.
- Use Zod at every input boundary. A form validates with a shared schema before submission; server/Edge Function code validates the same payload again.
- Use TanStack Query only for browser data fetching/mutations. Keep Supabase server access in server-side helpers and use Edge Functions for secrets, third-party calls, or privileged multi-step work.
- Every exposed Supabase table and Storage bucket needs least-privilege RLS policies. Test permitted and denied cases. Never use `service_role` in browser code.
- Preserve the distinction between official records and user requests. In particular, employees do not directly update official personnel data; AI never makes final hiring decisions; Management is read-only.
- Do not send biometric templates/images to the HRIS or Gemini. Do not send real applicant documents to Gemini's free tier.

## Required verification

Run the commands configured by the repository for linting, types, unit/integration tests, and production build. Add an end-to-end test when a feature spans a role journey or approval workflow.

For every task, verify all of the following:

1. The intended role can complete the defined journey.
2. A non-authorized role is denied by both the UI route guard and RLS/data access rule.
3. Zod rejects malformed or unauthorized input.
4. TanStack Query invalidates/refetches affected screens after a successful mutation.
5. Database migrations apply cleanly to a fresh local/test database.
6. No secret, sensitive demo data, raw biometric data, or generated local environment file is included in the commit.

## Pull-request handoff

1. Keep commits focused and use a conventional message such as `feat: add leave request workflow`.
2. Push the branch and open a PR against `main`.
3. The PR description must name the completed roadmap branch, its acceptance criteria, database migrations, RLS/Storage policy changes, test commands/results, screenshots for UI work, and external configuration required.
4. Do not begin the next numbered branch until this PR is reviewed, merged, and `main` is current locally.

## External-device procedure

For the attendance task, do not purchase or promise compatibility from marketing claims alone. Obtain the exact model, licence, API/SDK documentation, authentication method, stable external employee-ID field, event-ID/idempotency field, and a vendor test account or live demo. CSV/XLSX export is the fallback. Any USB fingerprint reader requires a separate approved design because it adds a client-side kiosk application and local biometric-template handling.
