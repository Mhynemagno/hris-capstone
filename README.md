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

Run the browser role and session checks against the local Supabase stack with
the fictional accounts from `supabase/seed.sql`:

```bash
npm run test:e2e
```

Playwright obtains its URL and publishable key from `supabase status` and
refuses to run against a hosted Supabase URL. On a fresh local database, the
demo accounts can be loaded with `npx supabase db reset --local`; this resets
the local database, so preserve any local data you need first. CI uses its own
disposable Supabase database for these tests.

## Vercel deployment

1. Import the GitHub repository into Vercel and use the default Next.js build settings.
2. In **Project Settings → Environment Variables**, add these variables for Production, Preview, and Development:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Deploy the project. Do not put Supabase secret or service-role keys in Vercel public variables.

This baseline deploys a harmless public landing page. Authentication, role guards, database migrations, and job-opening data arrive in later roadmap branches.

## Authentication setup

For each deployed application URL, add `https://<vercel-domain>/auth/callback` to Supabase Auth Redirect URLs. Set the `APP_URL` secret for the `invite-internal-user` Edge Function to the application's origin, for example `https://hris.example`.

Internal invitations work with Supabase's default automated invitation email. After Supabase validates the email link, the browser completes the session and opens password setup; no email-template customization or custom SMTP is required. Deploy the internal invitation function with `npx supabase@latest functions deploy invite-internal-user`; its secret API key stays in the Supabase Edge Function runtime and must never be a `NEXT_PUBLIC_*` value.

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

## Attendance CSV/XLSX import

HR Personnel can import a CSV or XLSX file at `/hr/attendance/import`. The first worksheet (or CSV) must contain these exact columns in order:

```text
external_employee_id,source_event_id,attendance_date,time_in,time_out,event_type
```

Use only a stable vendor/device employee ID in `external_employee_id`; the HRIS never matches a person by name. `event_type` is either `attendance` (requires `time_in`) or `absence` (both time values blank). Missing rows never mean an absence. Files are limited to 2 MiB and 5,000 data rows.

```csv
external_employee_id,source_event_id,attendance_date,time_in,time_out,event_type
DEV-001,EVT-001,2026-08-24,08:16,17:00,attendance
DEV-002,EVT-002,2026-08-24,,,absence
UNKNOWN-003,EVT-003,2026-08-24,08:00,17:00,attendance
```

Deploy the authenticated function after applying migrations:

```bash
npx supabase@latest functions deploy import-attendance --no-verify-jwt=false
```

The function uses the caller’s JWT and the project URL plus publishable/anon key supplied by the Supabase runtime. Do not configure a service-role key or any biometric vendor credential in browser variables. Never upload or persist fingerprint templates, face images, raw vendor biometric payloads, or vendor credentials. The only biometric data the HRIS stores is the face descriptor described below.

## Face-recognition attendance (capstone demonstration)

HR Personnel register a consenting employee's face at `/hr/attendance/face-enrollment`. Employees then record attendance themselves at `/employee/attendance/scan`: they sign in with their own account, look at the camera, and blink once. The face is verified against only their own registration, and no HR login is needed. HR can also run a shared supervised kiosk at `/hr/attendance/kiosk` that identifies the person among all registrations. The first scan of the day records time-in and a later scan records time-out, using the same status rules as imports. Details, thresholds, and security model: [`docs/superpowers/specs/2026-09-25-face-recognition-attendance-design.md`](docs/superpowers/specs/2026-09-25-face-recognition-attendance-design.md).

- **What is stored:** one 128-value face descriptor per registered employee in the non-exposed `private` schema. No photos or video are stored, and scan-time descriptors are discarded. Descriptors never return to the browser because matching runs inside the database.
- **Retention:** HR can delete a registration at any time; deactivating the employee's account deletes it automatically; re-registration replaces it.
- **Models:** `npm run dev` and `npm run build` copy the pinned `@vladmandic/face-api` model weights into `public/models/face-api/` (git-ignored). No paid recognition API is used.
- **Tuning:** browser values (framing, blink EAR thresholds, intervals, display times) are in `src/lib/face-recognition/config.ts`. The match threshold (0.5), ambiguity margin, and minimum time-in→time-out interval are in `private.face_recognition_settings`.
- **Camera:** browsers only allow the camera on HTTPS or `localhost`. The front camera is preferred on phones and tablets.
- **Safety:** use only test subjects or people who have consented. Blink detection is a basic liveness cue for a supervised kiosk, not production-grade anti-spoofing.

The face e2e journey uses Chromium's fake camera. Headless Edge ends fake camera tracks, so run it headed: `npx playwright test e2e/face-attendance.spec.ts --headed`.

When a biometric vendor is selected later, replace or extend the CSV/XLSX adapter only after receiving its API/webhook documentation, test credentials, stable employee identifier, and idempotent event-ID semantics. Preserve the normalized-event contract and its tests before enabling production sync.
