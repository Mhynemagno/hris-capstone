# HRIS Capstone

Human Resource Information System (HRIS) capstone built with Next.js, Supabase, Tailwind CSS, shadcn/ui conventions, TanStack Query, and Zod.

## Local setup

1. Install Node.js 22 or later.
2. Install dependencies:

   ```bash
   npm ci
   ```

3. Copy `.env.example` to `.env.local` and add the two public Supabase values from the project Connect dialog:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
   ```

   Do not add a `service_role`, `sb_secret_*`, or other secret key to a `NEXT_PUBLIC_*` value or commit it to Git.

4. Start the development server and open [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

## Project folders

- `src/lib/supabase`: browser and server Supabase client factories.
- `src/lib/auth`: verified server-side user and role lookup helpers.
- `src/lib/types`: shared application-role and database record types.
- `src/schemas`: shared Zod schemas.
- `src/queries`: Supabase query functions.
- `src/hooks`: browser TanStack Query hooks.
- `src/components`: shared providers and UI components.
- `src/test`: shared test setup; colocated `*.test.tsx` files cover component behavior.

## Quality checks

Run the same checks enforced by CI before opening a pull request:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## Vercel deployment

1. Import the GitHub repository into Vercel and use the default Next.js build settings.
2. In **Project Settings → Environment Variables**, add these variables for Production, Preview, and Development:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Deploy the project. Do not put Supabase secret or service-role keys in Vercel public variables.

This baseline deploys a harmless public landing page. Authentication, role guards, database migrations, and job-opening data arrive in later roadmap branches.

## Authentication setup

Add every deployed `https://<vercel-domain>/auth/callback` URL to Supabase Auth Redirect URLs. Deploy the internal invitation function with `npx supabase@latest functions deploy invite-internal-user`; its secret API key stays in the Supabase Edge Function runtime and must never be a `NEXT_PUBLIC_*` value.

## Supabase database workflow

The repository is linked to its Supabase project locally, but the link metadata is ignored. Authenticate and link your own local CLI before applying migrations:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref your-project-ref
npx supabase@latest db push --linked
npx supabase@latest test db --linked supabase/tests/auth_rbac_foundation.test.sql
```

The `private-documents` Storage bucket is private. RLS governs all application tables and Storage objects, so browser code must use the public publishable key only. Keep `service_role` and all other secret keys out of browser code, `NEXT_PUBLIC_*` variables, and Git.

After an initial administrator signs up through Supabase Auth, use the Supabase dashboard Table Editor to change that user’s one `user_roles.role` value from `applicant` to `system_administrator`. Do this once, confirm the matching `audit_logs` entry, and use the later administration workflow for all subsequent role changes. Do not store the administrator’s email or a bootstrap SQL command in the repository.
