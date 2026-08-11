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
