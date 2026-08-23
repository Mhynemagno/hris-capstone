# Deployment runbook

## Preconditions

- The workspace is clean and the branch has passed lint, typecheck, Vitest, build, and local pgTAP checks.
- A project owner has access to the linked Supabase project and Vercel project. Never paste credentials into Git, browser code, or this document.

## Supabase

1. Inspect history before writing: `npx supabase@latest migration list --project-ref <project-ref>`.
2. If history differs, compare actual object definitions and normalized migration SQL first. Repair only verified equivalent history entries; otherwise create a new idempotent repair migration. Do not replay timestamp-drifted migrations blindly.
3. Preview: `npx supabase@latest db push --linked --project-ref <project-ref> --dry-run --skip-vault`.
4. Apply: `npx supabase@latest db push --linked --project-ref <project-ref> --skip-vault`.
5. Verify public RPC identity arguments, grants, RLS, and PostgREST visibility with `npx supabase@latest db query --linked --project-ref <project-ref> ...`.
6. Deploy changed Edge Functions with `npx supabase@latest functions deploy <name> --project-ref <project-ref> --use-api`; preserve JWT verification and configure function secrets only in Supabase.

## Vercel

1. Confirm the GitHub integration deploys the intended `main` commit; no Vercel CLI token is needed for this project workflow.
2. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Development, Preview, and Production. These are public client configuration values, never service-role/secret values.
3. Add `https://<production-domain>/auth/callback` to Supabase Auth Redirect URLs and set the `APP_URL` secret for `invite-internal-user` to that same origin.
4. Deploy, then smoke-test `/`, `/login`, HR dashboard, Management dashboard, Reports, and one authorized/one denied role route. Record the deployed URL and commit in the release matrix.

## Rollback

Revert the application commit through the normal Git/Vercel deployment path. Do not remove database migrations casually: first assess whether data written by the migration exists, then prepare a reviewed forward migration that preserves required history and RLS.
