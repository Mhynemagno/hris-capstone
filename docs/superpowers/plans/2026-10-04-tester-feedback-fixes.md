# Tester Feedback Fixes (Branch 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give face-attendance rejections their real cause, make the four non-photo applicant documents PDF-only with an explicit Save per document, and let an applicant apply from one page that blocks Submit until all five required documents are saved, while HR sees those documents.

**Architecture:**
- Two additive SQL migrations redefine existing `private`/`public` functions and add one `NOT VALID` constraint.
- The client keeps the existing layers: zod schemas → `src/queries/*` → React Query hooks in `src/hooks/*` → components.
- A new route, `/applicant/apply/[jobId]`, composes the existing documents component and a slimmed application form. The old `?jobId` URL redirects to it.
- The saved profile CV is downloaded and re-uploaded as the application's `cv` document, so `submit_application` and the AI scoring function stay unchanged.

**Tech Stack:** Next.js 16.3 (App Router, `params`/`searchParams` are Promises), React 19, @tanstack/react-query 5, zod 4, Supabase (Postgres, Storage, pgTAP), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-04-tester-feedback-applicant-flow-and-public-landing-design.md` (Parts A–C).

## Global Constraints

- Branch: `fix/tester-feedback-oct` (already created from `main`; the spec is committed there).
- **Before writing route code, read `node_modules/next/dist/docs/`** for the App Router `redirect`, `notFound`, and dynamic `params` guides (AGENTS.md). Existing pages in this repo already use `params: Promise<…>`. Follow them.
- **New migrations sort after `20261001120000_force_delete.sql`:**
  - `20261004100000_face_ambiguity_and_messages.sql`
  - `20261004110000_applicant_documents_pdf_only.sql`
- **Copy, verbatim:**
  - Duplicate-face message: `This face is already registered to another employee. Each employee can register only their own face.`
  - Ambiguous kiosk message: `More than one employee matches this face. Please see HR.`
  - Kiosk title for an ambiguous match: `Multiple possible matches`
  - PDF-only message: `Upload the {label} as a PDF file.`, where `{label}` is one of `CV / Resume`, `PSA birth certificate`, `Eligibility`, or `Diploma`.
  - Submit hint: `Save all 5 required documents to submit.`
  - CV copy failure: `We could not attach your saved CV. Try again.`
- 2x2 picture (`photo`) stays PNG/JPEG. `resume`, `psa`, `eligibility`, and `diploma` are PDF only, enforced in the client, the RPC, and a table constraint added `NOT VALID`.
- Existing PNG/JPEG rows stay valid and usable.
- Never expose match distances or employee identities on rejected scans.
- Touch targets ≥ 44px (`min-h-11`). Errors use `role="alert"`. Success notices use `role="status"`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Commands:**
  - `npm run test:run -- <path>`
  - `npm run typecheck`
  - `npm run lint`
  - `npx supabase test db` (local Supabase must be running: `npx supabase start`). After adding a migration, run `npx supabase db reset` before the pgTAP run.

## Review Focus

1. **Re-registering an employee whose own previous face is the closest match.** It must still succeed, because the margin check excludes the same employee. Pinned in Task 1: re-registering alpha with `alpha_retake` stays `re_registered`.
2. **An applicant whose saved CV is a legacy PNG/JPEG.** Applying must still work: the saved file is copied as the `cv` whatever its type. Pinned in Task 5 (the `loadMyProfileDocumentFile` test with an image MIME type).
3. **An applicant who picks a file and leaves without saving.** The browser must warn them, and nothing may be uploaded. Pinned in Task 4 (the `beforeunload` test and "no save on pick").
4. **A stale `?jobId=` link (bookmark, email, login `next`).** It must land on the new apply page. Pinned in Task 5 (the redirect test).
5. **A kiosk scan replayed with the same scan ID after an ambiguous result.** It must return the stored `ambiguous` outcome, not re-match. `previous_face_scan` replays the stored row, so this holds; it is pinned in Task 2 with a replay assertion.

---

### Task 1: Block enrollment of faces the kiosk can't separate, with a clear message

**Files:**
- Create: `supabase/migrations/20261004100000_face_ambiguity_and_messages.sql`
- Modify: `supabase/tests/face_recognition_attendance.test.sql`

**Interfaces:**
- Consumes: `private.face_recognition_settings.match_threshold` / `.ambiguity_margin` and `private.face_descriptor_distance(real[], real[])` (from `20260925090000_face_recognition_attendance.sql`).
- Produces: a redefined `private.enroll_employee_face(uuid, real[], integer, boolean)` with the same signature and grants. It raises SQLSTATE `23505` with the new message when any **other** employee's enrollment is within `match_threshold + ambiguity_margin`.

- [ ] **Step 1: Write the failing pgTAP test**

In `supabase/tests/face_recognition_attendance.test.sql`:

(a) Change `select extensions.plan(55);` to `select extensions.plan(56);`.

(b) Add a fixture row to the `insert into face_fixture values` list, after `('alpha_lookalike', …),`:
```sql
  ('alpha_margin', array_fill(0.156::real, array[128])),
```
`alpha_margin` is 0.52 from `alpha_retake` (0.11 everywhere). That is outside the 0.5 threshold but inside the 0.54 margin.

(c) Directly after the line ending `'Re-registration keeps one enrollment per employee');`, add:
```sql
select extensions.throws_ok(
  $$ select public.enroll_employee_face('00000000-0000-4000-8000-000000000b02', (select descriptor from face_fixture where key = 'alpha_margin'), 5, true) $$,
  '23505',
  'This face is already registered to another employee. Each employee can register only their own face.',
  'A face the kiosk could not tell apart from another employee cannot be enrolled'
);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx supabase db reset && npx supabase test db`
Expected: FAIL in `face_recognition_attendance.test.sql`. The new assertion reports "no exception thrown", because 0.52 > 0.5 passes the old check.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261004100000_face_ambiguity_and_messages.sql`:
```sql
-- Tester feedback (2026-10-04): a duplicate face must say so plainly, and enrollment must refuse
-- faces the kiosk could never tell apart (within match_threshold + ambiguity_margin of another
-- employee). Existing enrollments are not re-checked.

create or replace function private.enroll_employee_face(target_employee_id uuid, target_descriptor real[], target_sample_count integer, target_consent_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  settings_row private.face_recognition_settings%rowtype;
  conflicting_employee uuid;
  was_enrolled boolean;
  account_active boolean;
begin
  if target_consent_confirmed is not true then
    raise exception 'Confirm the employee consented to face registration.' using errcode = '22023';
  end if;
  if not private.is_valid_face_descriptor(target_descriptor) or target_sample_count is null or target_sample_count not between 3 and 10 then
    raise exception 'The face sample is invalid. Capture the face again.' using errcode = '22023';
  end if;
  select * into settings_row from private.face_recognition_settings where id;

  perform 1 from public.employees where id = target_employee_id for share;
  if not found then
    raise exception 'Employee was not found.' using errcode = 'P0001';
  end if;
  select profile.is_active into account_active
  from public.employees employee
  join public.profiles profile on profile.id = employee.profile_id
  where employee.id = target_employee_id
  for share of profile;
  if account_active is not true then
    raise exception 'Only employees with an active linked account can be registered for face attendance.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('face_enrollment'));

  -- The kiosk rejects a scan whose two best matches are within ambiguity_margin, so a face this
  -- close to another employee could never be identified reliably.
  select enrollment.employee_id into conflicting_employee
  from private.employee_face_enrollments enrollment
  where enrollment.employee_id <> target_employee_id
    and private.face_descriptor_distance(enrollment.descriptor, target_descriptor) <= settings_row.match_threshold + settings_row.ambiguity_margin
  limit 1;
  if found then
    raise exception 'This face is already registered to another employee. Each employee can register only their own face.' using errcode = '23505';
  end if;

  select exists (select 1 from private.employee_face_enrollments where employee_id = target_employee_id) into was_enrolled;

  insert into private.employee_face_enrollments (employee_id, descriptor, sample_count, consent_confirmed_at, enrolled_by_user_id)
  values (target_employee_id, target_descriptor, target_sample_count, now(), caller_id)
  on conflict (employee_id) do update
    set descriptor = excluded.descriptor,
        sample_count = excluded.sample_count,
        consent_confirmed_at = excluded.consent_confirmed_at,
        enrolled_by_user_id = excluded.enrolled_by_user_id,
        updated_at = now();

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'employee_face_enrollments', target_employee_id::text, case when was_enrolled then 're_registered' else 'enrolled' end, jsonb_build_object('sample_count', target_sample_count));

  return jsonb_build_object('employeeId', target_employee_id, 'status', case when was_enrolled then 're_registered' else 'enrolled' end);
end;
$$;
```
(`create or replace` keeps the original grants and the revoke from `public, anon, authenticated`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx supabase db reset && npx supabase test db`
Expected: `face_recognition_attendance.test.sql .. ok`. All other files still ok. The existing `alpha_lookalike` (23505) and `charlie` (0.566 from alpha, outside 0.54) assertions still pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261004100000_face_ambiguity_and_messages.sql supabase/tests/face_recognition_attendance.test.sql
git commit -m "fix: block face enrollments the kiosk cannot tell apart, with a plain duplicate message

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Report an ambiguous kiosk match as `ambiguous`, end to end

**Files:**
- Modify: `supabase/migrations/20261004100000_face_ambiguity_and_messages.sql` (append)
- Modify: `supabase/tests/face_recognition_attendance.test.sql`
- Modify: `src/schemas/face-recognition.ts:19`
- Modify: `src/lib/face-recognition/scanner-machine.ts` (types at top; `resultState`)
- Modify: `src/components/face-recognition/face-attendance-kiosk.tsx:69`
- Test: `src/lib/face-recognition/scanner-machine.test.ts` (create if missing; otherwise append), `src/components/face-recognition/face-recognition.test.tsx`

**Interfaces:**
- Consumes: Task 1's migration file.
- Produces:
  - SQL: `private.reject_face_scan(uuid, double precision, uuid, jsonb, text default 'not_recognized')`; outcome `ambiguous` in `private.face_attendance_scans`.
  - TS: `faceAttendanceOutcomeSchema` includes `"ambiguous"`; `ScanErrorKind` includes `"ambiguous"`.

- [ ] **Step 1: Confirm the auto-generated constraint names**

Run: `npx supabase db reset` and then
`npx supabase db query "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'private.face_attendance_scans'::regclass and contype = 'c'"`. If `db query` is unavailable, use `psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -c "<same SQL>"`.

Expected: `face_attendance_scans_outcome_check` (the outcome list) and `face_attendance_scans_check` (`(outcome = 'not_recognized') = (employee_id IS NULL)`), plus the distance/message checks. If the names differ, use the printed names in Step 4.

- [ ] **Step 2: Write the failing pgTAP assertions**

In `supabase/tests/face_recognition_attendance.test.sql`:

(a) Change `select extensions.plan(56);` to `select extensions.plan(59);`. Edit (b) replaces 1 assertion with 3, and edit (c) adds 1.

(b) Replace the line
```sql
select extensions.is(public.record_face_attendance('00000000-0000-4000-8000-000000000c02', (select descriptor from face_fixture where key = 'between_alpha_charlie')) ->> 'outcome', 'not_recognized', 'An ambiguous match between two employees is rejected');
```
with:
```sql
select set_config('test.ambiguous_scan', public.record_face_attendance('00000000-0000-4000-8000-000000000c02', (select descriptor from face_fixture where key = 'between_alpha_charlie'))::text, true);
select extensions.is(current_setting('test.ambiguous_scan')::jsonb ->> 'outcome', 'ambiguous', 'An ambiguous match between two employees is reported as ambiguous');
select extensions.is(current_setting('test.ambiguous_scan')::jsonb ->> 'message', 'More than one employee matches this face. Please see HR.', 'An ambiguous match tells the person to see HR');
select extensions.ok((current_setting('test.ambiguous_scan')::jsonb -> 'employee') = 'null'::jsonb, 'An ambiguous match reveals no employee');
```

(c) Directly after the existing `'A retried scan ID returns its original outcome'` line, add:
```sql
select extensions.is(public.record_face_attendance('00000000-0000-4000-8000-000000000c02', (select descriptor from face_fixture where key = 'alpha_probe')) ->> 'outcome', 'ambiguous', 'Replaying an ambiguous scan ID returns the stored outcome');
```
Count check: 56 − 1 + 3 + 1 = 59.

- [ ] **Step 3: Run it to verify it fails**

Run: `npx supabase test db`
Expected: FAIL. The outcome is `not_recognized`, not `ambiguous`.

- [ ] **Step 4: Append to the migration**

Append to `supabase/migrations/20261004100000_face_ambiguity_and_messages.sql`:
```sql
-- A kiosk scan whose two best matches are too close is now its own outcome, so the person is told
-- to see HR instead of "Face not recognized.". It still writes no attendance and names no employee.
alter table private.face_attendance_scans
  drop constraint face_attendance_scans_outcome_check,
  add constraint face_attendance_scans_outcome_check
    check (outcome in ('time_in', 'time_out', 'already_recorded', 'rejected', 'not_recognized', 'ambiguous')),
  drop constraint face_attendance_scans_check,
  add constraint face_attendance_scans_no_employee_check
    check ((outcome in ('not_recognized', 'ambiguous')) = (employee_id is null));

drop function private.reject_face_scan(uuid, double precision, uuid, jsonb);

create function private.reject_face_scan(target_scan_id uuid, target_distance double precision, caller_id uuid, target_metadata jsonb, target_outcome text default 'not_recognized')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare scan_row private.face_attendance_scans%rowtype;
begin
  if target_outcome not in ('not_recognized', 'ambiguous') then
    raise exception 'Unsupported rejected scan outcome.' using errcode = '22023';
  end if;
  insert into private.face_attendance_scans (id, outcome, match_distance, message, recorded_by_user_id)
  values (
    target_scan_id,
    target_outcome,
    target_distance,
    case target_outcome when 'ambiguous' then 'More than one employee matches this face. Please see HR.' else 'Face not recognized.' end,
    caller_id
  )
  returning * into scan_row;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'face_attendance_scans', target_scan_id::text, target_outcome, target_metadata);
  return private.face_scan_result(scan_row);
end;
$$;

revoke all on function private.reject_face_scan(uuid, double precision, uuid, jsonb, text) from public, anon, authenticated;

create or replace function private.record_face_attendance(target_scan_id uuid, target_descriptor real[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  previous jsonb := private.previous_face_scan(target_scan_id, caller_id);
  settings_row private.face_recognition_settings%rowtype;
  best_employee uuid;
  best_distance double precision;
  runner_up_distance double precision;
begin
  if previous is not null then
    return previous;
  end if;
  if not private.is_valid_face_descriptor(target_descriptor) then
    raise exception 'The face sample is invalid. Scan again.' using errcode = '22023';
  end if;
  settings_row := private.require_face_attendance_enabled();

  select ranked.employee_id, ranked.distance into best_employee, best_distance
  from (
    select enrollment.employee_id, private.face_descriptor_distance(enrollment.descriptor, target_descriptor) as distance
    from private.employee_face_enrollments enrollment
  ) ranked
  order by ranked.distance
  limit 1;

  select ranked.distance into runner_up_distance
  from (
    select private.face_descriptor_distance(enrollment.descriptor, target_descriptor) as distance
    from private.employee_face_enrollments enrollment
    where enrollment.employee_id <> best_employee
  ) ranked
  order by ranked.distance
  limit 1;

  if best_employee is null or best_distance > settings_row.match_threshold then
    return private.reject_face_scan(target_scan_id, best_distance, caller_id, jsonb_build_object('mode', 'kiosk'));
  end if;
  if runner_up_distance is not null and runner_up_distance - best_distance < settings_row.ambiguity_margin then
    return private.reject_face_scan(target_scan_id, best_distance, caller_id, jsonb_build_object('mode', 'kiosk'), 'ambiguous');
  end if;

  return private.write_face_attendance(target_scan_id, best_employee, best_distance, caller_id, 'kiosk');
end;
$$;
```
`private.record_my_face_attendance` calls `reject_face_scan` with four arguments. PL/pgSQL resolves the call at run time, and the default makes it `not_recognized`, so it needs no change.

- [ ] **Step 5: Run pgTAP to verify it passes**

Run: `npx supabase db reset && npx supabase test db`
Expected: all files ok, with `face_recognition_attendance.test.sql` running 59 tests.

- [ ] **Step 6: Write the failing client tests**

Find the reducer tests: `ls src/lib/face-recognition/`. If `scanner-machine.test.ts` exists, append inside its top-level `describe`; otherwise create it with this content:
```ts
import { describe, expect, it } from "vitest";

import { createScannerReducer } from "./scanner-machine";

const reducer = createScannerReducer({ stableFramesBeforeVerify: 1 });

describe("scanner reducer: ambiguous match", () => {
  it("shows the server's ambiguous message as its own error kind", () => {
    const next = reducer({ status: "recording", scanId: "00000000-0000-4000-8000-000000000001" }, {
      type: "RECORD_SUCCEEDED",
      result: {
        scanId: "00000000-0000-4000-8000-000000000001",
        outcome: "ambiguous",
        message: "More than one employee matches this face. Please see HR.",
        distance: null,
        employee: null,
        log: null,
        recordedAt: "2026-10-04T00:00:00Z",
      },
    });
    expect(next).toEqual({ status: "error", kind: "ambiguous", message: "More than one employee matches this face. Please see HR.", fatal: false });
  });
});
```
In `src/components/face-recognition/face-recognition.test.tsx`, after the test that starts `it("shows 'Face not recognized' and a retry for fatal camera errors"`, add a sibling test in the same `describe`. It uses the same `scanner` mock object that test uses:
```tsx
  it("titles an ambiguous match 'Multiple possible matches'", async () => {
    scanner.state = { status: "error", kind: "ambiguous", message: "More than one employee matches this face. Please see HR.", fatal: false };
    render(<FaceAttendanceKiosk />);
    expect(screen.getByRole("alert")).toHaveTextContent("Multiple possible matches");
    expect(screen.getByRole("alert")).toHaveTextContent("Please see HR.");
  });
```
(Copy the render call exactly as the neighbouring "Face not recognized" test does. If it renders with props or a wrapper, use the same.)

- [ ] **Step 7: Run them to verify they fail**

Run: `npm run test:run -- src/lib/face-recognition src/components/face-recognition`
Expected: FAIL. TypeScript/zod reject `"ambiguous"`, or `resultState` returns `undefined`.

- [ ] **Step 8: Implement the client changes**

`src/schemas/face-recognition.ts:19`:
```ts
export const faceAttendanceOutcomeSchema = z.enum(["time_in", "time_out", "already_recorded", "rejected", "not_recognized", "ambiguous"]);
```
`src/lib/face-recognition/scanner-machine.ts`:
```ts
export type ScanErrorKind = "not_recognized" | "ambiguous" | "rule_rejected" | "network" | "service";
```
and in `resultState`, add after the `not_recognized` case:
```ts
    case "ambiguous":
      return { status: "error", kind: "ambiguous", message: result.message ?? "More than one employee matches this face. Please see HR.", fatal: false };
```
`src/components/face-recognition/face-attendance-kiosk.tsx:69`: replace the title expression with:
```tsx
<p className="font-semibold">{state.fatal ? "Scanner unavailable" : state.kind === "not_recognized" ? "Face not recognized" : state.kind === "ambiguous" ? "Multiple possible matches" : state.kind === "network" ? "Connection problem" : state.kind === "service" ? "Attendance service rejected the scan" : "Attendance not recorded"}</p>
```
Then run `npm run typecheck`. Fix every exhaustive `switch` on `FaceAttendanceResult["outcome"]` or `ScanErrorKind` the compiler reports. Find candidates with `rg -n "not_recognized" src`; the self-scan page should treat `ambiguous` like `not_recognized` if it switches on kind.

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/face-recognition src/components/face-recognition src/hooks && npm run typecheck`
Expected: PASS, with no type errors.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20261004100000_face_ambiguity_and_messages.sql supabase/tests/face_recognition_attendance.test.sql src/schemas/face-recognition.ts src/lib/face-recognition src/components/face-recognition
git commit -m "fix: tell kiosk users to see HR when a face matches more than one employee

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: PDF-only rule for CV, PSA, Eligibility, and Diploma

**Files:**
- Create: `supabase/migrations/20261004110000_applicant_documents_pdf_only.sql`
- Create: `supabase/tests/applicant_documents_pdf_only.test.sql`
- Modify: `src/schemas/applicant-portal.ts:20-41`
- Modify: `src/queries/recruitment.ts` (`saveApplicantProfileDocuments`, around L230-256)
- Test: `src/schemas/applicant-portal.test.ts` (create if missing), `src/components/recruitment/applicant-profile-documents.test.tsx`

**Interfaces:**
- Consumes: `public.save_my_applicant_profile_document(text, text, text, text, integer)` (latest in `20260927160300_applicant_additional_required_documents.sql:14-73`).
- Produces:
  - TS:
    - `profileDocumentFileSchemaFor(kind: ApplicantProfileDocumentKind)`, a zod schema for `File`.
    - `APPLICANT_PROFILE_DOCUMENT_KINDS[n].accept` is `"application/pdf"` for the four PDF kinds.
  - SQL:
    - The redefined `save_my_applicant_profile_document` raises `22023` with `Upload the {label} as a PDF file.`
    - Constraint `applicant_profile_documents_non_photo_is_pdf` (NOT VALID).

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/applicant_documents_pdf_only.test.sql`:
```sql
begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(7);

insert into auth.users (id, aud, role, email, created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000016001', 'authenticated', 'authenticated', 'pdf-only-applicant@example.test', now(), now(),
  '{"first_name":"Pia","last_name":"Dokumento","phone":"+639171234500","date_of_birth":"1999-01-02","full_name":"Pia Dokumento"}'::jsonb);

-- Registration creates the applicant row (see applicant_portal_feedback.test.sql); every later assertion depends on it.
select extensions.is((select count(*) from public.applicants where profile_id = '00000000-0000-4000-8000-000000016001'), 1::bigint, 'The fixture applicant exists');

insert into storage.objects (bucket_id, name, owner_id)
values
  ('applicant-profile-documents', 'applicant-profiles/00000000-0000-4000-8000-000000016001/11111111-1111-4111-8111-111111111111.png', '00000000-0000-4000-8000-000000016001'),
  ('applicant-profile-documents', 'applicant-profiles/00000000-0000-4000-8000-000000016001/22222222-2222-4222-8222-222222222222.pdf', '00000000-0000-4000-8000-000000016001'),
  ('applicant-profile-documents', 'applicant-profiles/00000000-0000-4000-8000-000000016001/33333333-3333-4333-8333-333333333333.png', '00000000-0000-4000-8000-000000016001'),
  ('applicant-profile-documents', 'applicant-profiles/00000000-0000-4000-8000-000000016001/44444444-4444-4444-8444-444444444444.pdf', '00000000-0000-4000-8000-000000016001');

select extensions.is(
  (select convalidated from pg_constraint where conname = 'applicant_profile_documents_non_photo_is_pdf'),
  false,
  'The PDF-only constraint does not re-check documents uploaded before the rule'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000016001';

select extensions.throws_ok(
  $$ select public.save_my_applicant_profile_document('resume', 'applicant-profiles/00000000-0000-4000-8000-000000016001/11111111-1111-4111-8111-111111111111.png', 'cv.png', 'image/png', 100) $$,
  '22023', 'Upload the CV / Resume as a PDF file.', 'A CV image is rejected'
);
select extensions.lives_ok(
  $$ select public.save_my_applicant_profile_document('resume', 'applicant-profiles/00000000-0000-4000-8000-000000016001/22222222-2222-4222-8222-222222222222.pdf', 'cv.pdf', 'application/pdf', 100) $$,
  'A CV PDF is saved'
);
select extensions.lives_ok(
  $$ select public.save_my_applicant_profile_document('photo', 'applicant-profiles/00000000-0000-4000-8000-000000016001/33333333-3333-4333-8333-333333333333.png', 'photo.png', 'image/png', 100) $$,
  'The 2x2 picture is still saved as an image'
);
select extensions.throws_ok(
  $$ select public.save_my_applicant_profile_document('photo', 'applicant-profiles/00000000-0000-4000-8000-000000016001/44444444-4444-4444-8444-444444444444.pdf', 'photo.pdf', 'application/pdf', 100) $$,
  '22023', null, 'The 2x2 picture still cannot be a PDF'
);

set local role postgres;
select extensions.throws_ok(
  $$ insert into public.applicant_profile_documents (applicant_id, kind, object_path, file_name, mime_type, size_bytes)
     select id, 'psa', 'applicant-profiles/00000000-0000-4000-8000-000000016001/11111111-1111-4111-8111-111111111111.png', 'psa.png', 'image/png', 100
     from public.applicants where profile_id = '00000000-0000-4000-8000-000000016001' $$,
  '23514', null, 'New non-photo documents must be PDFs even when written directly'
);

select * from extensions.finish();
rollback;
```
If `storage.objects` rejects the insert because of a missing column (check `\d storage.objects`), add the required columns with defaults. `owner_id` is `text` in this Supabase version; the RPC compares it with `caller_id::text`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx supabase test db`
Expected: FAIL. The constraint lookup returns NULL and the CV PNG is accepted.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261004110000_applicant_documents_pdf_only.sql`. Start by copying the **entire** `create or replace function public.save_my_applicant_profile_document(…) … $$;` block from `20260927160300_applicant_additional_required_documents.sql` (lines 14-70), then make the two edits marked below:
```sql
-- Tester feedback (2026-10-04): only the 2x2 picture is an image; the CV / Resume, PSA birth
-- certificate, Eligibility, and Diploma must be PDFs. Rows uploaded before this rule stay valid
-- (NOT VALID) until the applicant replaces them.

alter table public.applicant_profile_documents
  add constraint applicant_profile_documents_non_photo_is_pdf
    check (kind = 'photo' or mime_type = 'application/pdf') not valid;

create or replace function public.save_my_applicant_profile_document(
  target_kind text,
  target_object_path text,
  target_file_name text,
  target_mime_type text,
  target_size_bytes integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_applicant_id uuid;
begin
  select applicant.id
  into caller_applicant_id
  from public.applicants applicant
  where applicant.profile_id = caller_id;

  if caller_applicant_id is null then
    raise exception 'Only an applicant can save profile documents.' using errcode = '42501';
  end if;

  -- EDIT 1: the PDF-only rule, with a message the applicant can act on.
  if target_kind in ('resume', 'psa', 'eligibility', 'diploma') and target_mime_type is distinct from 'application/pdf' then
    raise exception 'Upload the % as a PDF file.',
      case target_kind when 'resume' then 'CV / Resume' when 'psa' then 'PSA birth certificate' when 'eligibility' then 'Eligibility' else 'Diploma' end
      using errcode = '22023';
  end if;

  if target_kind is null
    or target_kind not in ('eligibility', 'diploma', 'resume', 'psa', 'photo')
    or target_object_path !~ (
      '^applicant-profiles/' || caller_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpe?g)$'
    )
    or target_file_name !~ '^[^\\/[:cntrl:]]{1,255}$'
    or target_mime_type not in ('application/pdf', 'image/png', 'image/jpeg')
    or (target_kind = 'photo' and target_mime_type not in ('image/png', 'image/jpeg'))
    or target_size_bytes not between 1 and 10485760
    or not exists (
      select 1
      from storage.objects object
      where object.bucket_id = 'applicant-profile-documents'
        and object.name = target_object_path
        and object.owner_id = caller_id::text
    ) then
    raise exception 'Invalid applicant profile document.' using errcode = '22023';
  end if;

  insert into public.applicant_profile_documents (
    applicant_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id
  ) values (
    caller_applicant_id, target_kind, target_object_path, target_file_name,
    target_mime_type, target_size_bytes, caller_id
  )
  on conflict (applicant_id, kind) do update
  set object_path = excluded.object_path,
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      size_bytes = excluded.size_bytes,
      uploaded_by_user_id = excluded.uploaded_by_user_id,
      updated_at = clock_timestamp();
end;
$$;
```
(EDIT 2 is only the header comment. The body is otherwise identical, and the existing grants survive `create or replace`.)

Before committing, diff the copied body against the source to make sure only EDIT 1 differs:
`git diff --no-index <(sed -n 14,70p supabase/migrations/20260927160300_applicant_additional_required_documents.sql) <(sed -n 9,80p supabase/migrations/20261004110000_applicant_documents_pdf_only.sql)`.

- [ ] **Step 4: Run pgTAP to verify it passes**

Run: `npx supabase db reset && npx supabase test db`
Expected: `applicant_documents_pdf_only.test.sql .. ok` (7 tests), and all other files ok.

- [ ] **Step 5: Write the failing client tests**

Create `src/schemas/applicant-portal.test.ts`. If it already exists, add this `describe` block to it:
```ts
import { describe, expect, it } from "vitest";

import { APPLICANT_PROFILE_DOCUMENT_KINDS, profileDocumentFileSchemaFor } from "./applicant-portal";

const file = (name: string, type: string) => new File(["x"], name, { type });

describe("profileDocumentFileSchemaFor", () => {
  it("accepts only PDFs for the CV / Resume, PSA, Eligibility, and Diploma", () => {
    for (const { kind, label } of APPLICANT_PROFILE_DOCUMENT_KINDS.filter(({ kind }) => kind !== "photo")) {
      expect(profileDocumentFileSchemaFor(kind).safeParse(file("doc.pdf", "application/pdf")).success).toBe(true);
      const image = profileDocumentFileSchemaFor(kind).safeParse(file("doc.png", "image/png"));
      expect(image.success).toBe(false);
      expect(image.error?.issues[0]?.message).toBe(`Upload the ${label} as a PDF file.`);
    }
  });

  it("keeps the 2x2 picture PNG or JPEG only", () => {
    expect(profileDocumentFileSchemaFor("photo").safeParse(file("p.jpg", "image/jpeg")).success).toBe(true);
    expect(profileDocumentFileSchemaFor("photo").safeParse(file("p.pdf", "application/pdf")).success).toBe(false);
  });

  it("tells the browser to offer only PDFs for the four document kinds", () => {
    expect(APPLICANT_PROFILE_DOCUMENT_KINDS.map(({ kind, accept }) => [kind, accept])).toEqual([
      ["resume", "application/pdf"],
      ["psa", "application/pdf"],
      ["photo", "image/png,image/jpeg"],
      ["eligibility", "application/pdf"],
      ["diploma", "application/pdf"],
    ]);
  });
});
```
In `src/components/recruitment/applicant-profile-documents.test.tsx`, change the expectation in `"accepts only PNG or JPEG images for the 2x2 picture"` to:
```tsx
    expect(screen.getByLabelText("Upload PSA birth certificate document")).toHaveAttribute("accept", "application/pdf");
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npm run test:run -- src/schemas/applicant-portal.test.ts src/components/recruitment/applicant-profile-documents.test.tsx`
Expected: FAIL. `profileDocumentFileSchemaFor` is not exported, and `accept` is still the three-type list.

- [ ] **Step 7: Implement**

In `src/schemas/applicant-portal.ts`, replace the `APPLICANT_PROFILE_DOCUMENT_KINDS` constant and add the schema helpers after `applicantPhotoDocumentFileSchema`:
```ts
/** The documents an applicant saves on the Documents page; all are required before applying. Only the 2x2 picture is an image. */
export const APPLICANT_PROFILE_DOCUMENT_KINDS = [
  { kind: "resume", label: "CV / Resume", accept: "application/pdf", formats: "PDF only" },
  { kind: "psa", label: "PSA birth certificate", accept: "application/pdf", formats: "PDF only" },
  { kind: "photo", label: "2x2 picture", accept: "image/png,image/jpeg", formats: "PNG or JPEG image" },
  { kind: "eligibility", label: "Eligibility", accept: "application/pdf", formats: "PDF only" },
  { kind: "diploma", label: "Diploma", accept: "application/pdf", formats: "PDF only" },
] as const;
```
```ts
function applicantPdfDocumentFileSchema(label: string) {
  return z.custom<File>(
    (value) => typeof File !== "undefined" && value instanceof File,
    "Choose a PDF file.",
  ).superRefine((file, context) => {
    if (file.type !== "application/pdf") {
      context.addIssue({ code: "custom", message: `Upload the ${label} as a PDF file.` });
    }
    if (file.size < 1 || file.size > 10 * 1024 * 1024) {
      context.addIssue({ code: "custom", message: "Use a document up to 10 MiB." });
    }
  });
}

/** The file rule for one required document: the 2x2 picture is PNG/JPEG, every other document is a PDF. */
export function profileDocumentFileSchemaFor(kind: ApplicantProfileDocumentKind) {
  if (kind === "photo") return applicantPhotoDocumentFileSchema;
  const { label } = APPLICANT_PROFILE_DOCUMENT_KINDS.find((item) => item.kind === kind)!;
  return applicantPdfDocumentFileSchema(label);
}
```
Add `import type { ApplicantProfileDocumentKind } from "@/lib/types/database";` to the imports.

In `src/queries/recruitment.ts`, inside `saveApplicantProfileDocuments`, replace
```ts
      const file = applicantProfileDocumentFileSchema.parse(document.file);
```
with
```ts
      const file = profileDocumentFileSchemaFor(document.kind).parse(document.file);
```
Add `import { profileDocumentFileSchemaFor } from "@/schemas/applicant-portal";`. Remove `applicantProfileDocumentFileSchema` from the `@/schemas/recruitment` import list only if nothing else in the file uses it (`rg -n applicantProfileDocumentFileSchema src/queries/recruitment.ts`).

In `src/components/recruitment/applicant-profile-documents.tsx`, replace the validation line in `uploadDocument`:
```ts
    const validated = profileDocumentFileSchemaFor(kind).safeParse(file);
```
Update the imports: drop `applicantPhotoDocumentFileSchema` and `applicantProfileDocumentFileSchema`, and import `profileDocumentFileSchemaFor`. Change the intro paragraph to:
```tsx
<p className="mt-1 text-sm text-muted-foreground">Save all five documents (up to 10 MiB each) before submitting an application. The 2x2 picture must be a PNG or JPEG image; the other documents must be PDF files.</p>
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test:run -- src/schemas src/components/recruitment src/queries && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20261004110000_applicant_documents_pdf_only.sql supabase/tests/applicant_documents_pdf_only.test.sql src/schemas/applicant-portal.ts src/schemas/applicant-portal.test.ts src/queries/recruitment.ts src/components/recruitment/applicant-profile-documents.tsx src/components/recruitment/applicant-profile-documents.test.tsx
git commit -m "fix: require PDFs for the CV, PSA, eligibility, and diploma; keep the 2x2 picture an image

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Explicit Save per required document, with a progress summary

**Files:**
- Create: `src/lib/recruitment/required-documents.ts`
- Create: `src/lib/recruitment/required-documents.test.ts`
- Modify: `src/components/recruitment/applicant-profile-documents.tsx` (full rewrite of the component body)
- Modify: `src/components/recruitment/applicant-profile-documents.test.tsx`

**Interfaces:**
- Consumes: `profileDocumentFileSchemaFor`, `APPLICANT_PROFILE_DOCUMENT_KINDS` (Task 3); `useApplicantProfileDocuments`, `useSaveApplicantProfileDocuments` (`src/hooks/use-recruitment.ts`); `useRemoveMyApplicantProfileDocument` (`src/hooks/use-applicant-portal.ts`).
- Produces:
  ```ts
  export function requiredDocumentStatus(documents: readonly Pick<ApplicantProfileDocument, "kind">[] | undefined): {
    saved: number; total: number; complete: boolean;
    missing: readonly { kind: ApplicantProfileDocumentKind; label: string }[];
  }
  ```
  Also produces `<ApplicantProfileDocuments />`, which takes no props, with these accessible names:
  - Inputs: `Upload {label} document`
  - Buttons: `Save {label} document`, `Cancel {label} upload`, `Remove {label} document`, `View {label} document`

- [ ] **Step 1: Write the failing helper test**

`src/lib/recruitment/required-documents.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { requiredDocumentStatus } from "./required-documents";

describe("requiredDocumentStatus", () => {
  it("counts saved kinds and names the missing ones in display order", () => {
    const status = requiredDocumentStatus([{ kind: "diploma" }, { kind: "resume" }, { kind: "diploma" }]);
    expect(status).toEqual({
      saved: 2,
      total: 5,
      complete: false,
      missing: [
        { kind: "psa", label: "PSA birth certificate" },
        { kind: "photo", label: "2x2 picture" },
        { kind: "eligibility", label: "Eligibility" },
      ],
    });
  });

  it("is complete when all five are saved, and empty for no data", () => {
    expect(requiredDocumentStatus(["resume", "psa", "photo", "eligibility", "diploma"].map((kind) => ({ kind: kind as never }))).complete).toBe(true);
    expect(requiredDocumentStatus(undefined)).toMatchObject({ saved: 0, total: 5, complete: false });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:run -- src/lib/recruitment/required-documents.test.ts`
Expected: FAIL. The module is not found.

- [ ] **Step 3: Implement the helper**

`src/lib/recruitment/required-documents.ts`:
```ts
import type { ApplicantProfileDocument } from "@/lib/types/database";
import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

/** How many of the five required profile documents are saved, and which are still missing. */
export function requiredDocumentStatus(documents: readonly Pick<ApplicantProfileDocument, "kind">[] | undefined) {
  const savedKinds = new Set((documents ?? []).map((document) => document.kind));
  const missing = APPLICANT_PROFILE_DOCUMENT_KINDS
    .filter(({ kind }) => !savedKinds.has(kind))
    .map(({ kind, label }) => ({ kind, label }));
  const total = APPLICANT_PROFILE_DOCUMENT_KINDS.length;
  return { saved: total - missing.length, total, complete: missing.length === 0, missing };
}
```
Run: `npm run test:run -- src/lib/recruitment/required-documents.test.ts`. Expected: PASS.

- [ ] **Step 4: Write the failing component tests**

Replace the body of `src/components/recruitment/applicant-profile-documents.test.tsx`, keeping its existing `vi.mock` header and imports, with:
```tsx
describe("ApplicantProfileDocuments", { timeout: 20_000 }, () => {
  afterEach(() => { vi.restoreAllMocks(); mocks.save.mockReset(); mocks.remove.mockReset(); });

  it("lists every required document, its saved state, and a progress summary", () => {
    mocks.documents = [{ id: "d1", kind: "diploma", file_name: "diploma.pdf", object_path: "applicant-profiles/x/y.pdf", updated_at: "2026-09-01T00:00:00Z" }];
    render(<ApplicantProfileDocuments />);
    for (const label of ["CV / Resume", "PSA birth certificate", "2x2 picture", "Eligibility", "Diploma"]) {
      expect(screen.getByLabelText(`Upload ${label} document`)).toBeInTheDocument();
    }
    expect(screen.getByText("1 of 5 required documents saved")).toBeVisible();
    expect(screen.getByText("Still needed: CV / Resume, PSA birth certificate, 2x2 picture, Eligibility")).toBeVisible();
    expect(screen.getByText("diploma.pdf")).toBeVisible();
    expect(screen.getByText("Saved September 1, 2026")).toBeVisible();
    expect(screen.getAllByText("Not saved yet")).toHaveLength(4);
  });

  it("accepts only PNG or JPEG images for the 2x2 picture and PDFs for the rest", () => {
    mocks.documents = [];
    render(<ApplicantProfileDocuments />);
    expect(screen.getByLabelText("Upload 2x2 picture document")).toHaveAttribute("accept", "image/png,image/jpeg");
    expect(screen.getByLabelText("Upload PSA birth certificate document")).toHaveAttribute("accept", "application/pdf");
  });

  it("does not upload on pick; shows the chosen file and saves only on Save", async () => {
    const user = userEvent.setup();
    mocks.documents = [];
    mocks.save.mockResolvedValue(undefined);
    render(<ApplicantProfileDocuments />);
    await user.upload(screen.getByLabelText("Upload Eligibility document"), new File(["pdf"], "eligibility.pdf", { type: "application/pdf" }));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByText(/Selected: eligibility\.pdf/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save Eligibility document" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith([expect.objectContaining({ kind: "eligibility" })]));
    expect(await screen.findByRole("status")).toHaveTextContent("Eligibility document saved.");
    expect(screen.queryByRole("button", { name: "Save Eligibility document" })).not.toBeInTheDocument();
  });

  it("shows a wrong format under the card and never offers Save for it", async () => {
    const user = userEvent.setup({ applyAccept: false });
    mocks.documents = [];
    render(<ApplicantProfileDocuments />);
    await user.upload(screen.getByLabelText("Upload CV / Resume document"), new File(["png"], "cv.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload the CV / Resume as a PDF file.");
    expect(screen.queryByRole("button", { name: "Save CV / Resume document" })).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("cancels a pending pick", async () => {
    const user = userEvent.setup();
    mocks.documents = [];
    render(<ApplicantProfileDocuments />);
    await user.upload(screen.getByLabelText("Upload Diploma document"), new File(["pdf"], "diploma.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Cancel Diploma upload" }));
    expect(screen.queryByText(/Selected: diploma\.pdf/)).not.toBeInTheDocument();
  });

  it("warns before leaving with an unsaved pick", async () => {
    const user = userEvent.setup();
    mocks.documents = [];
    render(<ApplicantProfileDocuments />);
    await user.upload(screen.getByLabelText("Upload Diploma document"), new File(["pdf"], "diploma.pdf", { type: "application/pdf" }));
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("removes a document after confirmation and shows database refusals", async () => {
    const user = userEvent.setup();
    mocks.documents = [{ id: "d1", kind: "eligibility", file_name: "eligibility.pdf", object_path: "applicant-profiles/x/y.pdf", updated_at: "2026-09-01T00:00:00Z" }];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.remove.mockResolvedValueOnce({ cleanupError: null }).mockRejectedValueOnce(new Error("This document is under review for an application in progress. Upload a replacement instead of removing it."));
    render(<ApplicantProfileDocuments />);
    await user.click(screen.getByRole("button", { name: "Remove Eligibility document" }));
    expect(mocks.remove).toHaveBeenCalledWith("eligibility");
    expect(await screen.findByRole("status")).toHaveTextContent("Eligibility document removed.");
    await user.click(screen.getByRole("button", { name: "Remove Eligibility document" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("under review");
  });
});
```

- [ ] **Step 5: Run them to verify they fail**

Run: `npm run test:run -- src/components/recruitment/applicant-profile-documents.test.tsx`
Expected: FAIL. There is no summary or Save button, and save is still called on pick.

- [ ] **Step 6: Rewrite the component**

Replace `src/components/recruitment/applicant-profile-documents.tsx` with:
```tsx
"use client";

import { CheckCircle2, CircleDashed, ExternalLink, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useRemoveMyApplicantProfileDocument } from "@/hooks/use-applicant-portal";
import { useApplicantProfileDocuments, useSaveApplicantProfileDocuments } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { requiredDocumentStatus } from "@/lib/recruitment/required-documents";
import type { ApplicantProfileDocumentKind } from "@/lib/types/database";
import { getApplicantProfileDocumentUrl } from "@/queries/recruitment";
import { APPLICANT_PROFILE_DOCUMENT_KINDS, profileDocumentFileSchemaFor } from "@/schemas/applicant-portal";

type DocumentKind = ApplicantProfileDocumentKind;

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ApplicantProfileDocuments() {
  const documents = useApplicantProfileDocuments();
  const save = useSaveApplicantProfileDocuments();
  const remove = useRemoveMyApplicantProfileDocument();
  const [pending, setPending] = useState<Partial<Record<DocumentKind, File>>>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DocumentKind, string>>>({});
  const [savingKind, setSavingKind] = useState<DocumentKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = save.isPending || remove.isPending;
  const hasPending = Object.keys(pending).length > 0;

  useEffect(() => {
    if (!hasPending) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasPending]);

  function pick(kind: DocumentKind, file: File | undefined) {
    setNotice(null);
    setFieldErrors((current) => ({ ...current, [kind]: undefined }));
    if (!file) return;
    const validated = profileDocumentFileSchemaFor(kind).safeParse(file);
    if (!validated.success) {
      setPending((current) => { const next = { ...current }; delete next[kind]; return next; });
      setFieldErrors((current) => ({ ...current, [kind]: validated.error.issues[0]?.message ?? "Choose a valid document." }));
      return;
    }
    setPending((current) => ({ ...current, [kind]: validated.data }));
  }

  function cancel(kind: DocumentKind) {
    setPending((current) => { const next = { ...current }; delete next[kind]; return next; });
  }

  async function saveDocument(kind: DocumentKind, label: string) {
    const file = pending[kind];
    if (!file) return;
    setError(null);
    setNotice(null);
    setSavingKind(kind);
    try {
      await save.mutateAsync([{ kind, file }]);
      cancel(kind);
      setNotice(`${label} document saved.`);
    } catch (caught) {
      setFieldErrors((current) => ({ ...current, [kind]: caught instanceof Error ? caught.message : "Unable to save the document." }));
    } finally {
      setSavingKind(null);
    }
  }

  async function removeDocument(kind: DocumentKind, label: string) {
    setError(null);
    setNotice(null);
    if (!window.confirm(`Remove your ${label} document?`)) return;
    try {
      await remove.mutateAsync(kind);
      setNotice(`${label} document removed.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove the document.");
    }
  }

  async function openDocument(objectPath: string) {
    setError(null);
    try {
      window.open(await getApplicantProfileDocumentUrl(objectPath), "_blank", "noopener,noreferrer");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open the document.");
    }
  }

  if (documents.isLoading) return <LoadingState label="Loading documents…" />;
  if (documents.error) return <p className="text-sm text-destructive" role="alert">{documents.error.message}</p>;

  const status = requiredDocumentStatus(documents.data);

  return <section aria-labelledby="applicant-documents" className="rounded-2xl border bg-card p-5 sm:p-6">
    <h2 className="text-lg font-semibold" id="applicant-documents">Required documents</h2>
    <p className="mt-1 text-sm text-muted-foreground">Save all five documents (up to 10 MiB each) before submitting an application. The 2x2 picture must be a PNG or JPEG image; the other documents must be PDF files.</p>
    <div className="mt-4 rounded-lg border bg-muted/50 p-3">
      <p className="font-medium">{status.saved} of {status.total} required documents saved</p>
      {status.missing.length ? <p className="mt-1 text-sm text-muted-foreground">Still needed: {status.missing.map(({ label }) => label).join(", ")}</p> : null}
    </div>
    <ul className="mt-4 grid gap-4 sm:grid-cols-2">
      {APPLICANT_PROFILE_DOCUMENT_KINDS.map(({ kind, label, accept, formats }) => {
        const document = documents.data?.find((item) => item.kind === kind);
        const chosen = pending[kind];
        const fieldError = fieldErrors[kind];
        return <li className="rounded-xl border p-4" key={kind}>
          <div className="flex items-center gap-2">
            {document ? <CheckCircle2 aria-hidden="true" className="size-5 text-emerald-600" /> : <CircleDashed aria-hidden="true" className="size-5 text-muted-foreground" />}
            <p className="font-medium">{label} <span aria-hidden="true" className="text-destructive">*</span><span className="sr-only">(required)</span></p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{formats}</p>
          {document ? <div className="mt-2 space-y-2">
            <p className="break-all text-sm">{document.file_name}</p>
            <p className="text-sm font-medium text-emerald-700">Saved {formatDate(document.updated_at)}</p>
            <div className="flex flex-wrap gap-2">
              <Button aria-label={`View ${label} document`} onClick={() => void openDocument(document.object_path)} size="sm" type="button" variant="outline"><ExternalLink aria-hidden="true" /> View</Button>
              <Button aria-label={`Remove ${label} document`} disabled={busy} onClick={() => void removeDocument(kind, label)} size="sm" type="button" variant="outline"><Trash2 aria-hidden="true" /> Remove</Button>
            </div>
          </div> : <p className="mt-2 text-sm text-muted-foreground">Not saved yet</p>}
          <p aria-hidden="true" className="mt-3 text-sm font-medium">{document ? "Replace file" : "Choose file"}</p>
          <Input accept={accept} aria-describedby={fieldError ? `upload-${kind}-error` : undefined} aria-invalid={fieldError ? true : undefined} aria-label={`Upload ${label} document`} className="mt-1" disabled={busy} id={`upload-${kind}`} onChange={(event) => { pick(kind, event.target.files?.[0]); event.target.value = ""; }} type="file" />
          {fieldError ? <p className="mt-2 text-sm text-destructive" id={`upload-${kind}-error`} role="alert">{fieldError}</p> : null}
          {chosen ? <div className="mt-3 space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="break-all text-sm">Selected: {chosen.name} ({formatSize(chosen.size)})</p>
            <div className="flex flex-wrap gap-2">
              <Button aria-label={`Save ${label} document`} className="min-h-11" disabled={busy} onClick={() => void saveDocument(kind, label)} type="button"><Save aria-hidden="true" /> {savingKind === kind ? "Saving…" : "Save"}</Button>
              <Button aria-label={`Cancel ${label} upload`} className="min-h-11" disabled={savingKind === kind} onClick={() => cancel(kind)} type="button" variant="outline"><X aria-hidden="true" /> Cancel</Button>
            </div>
          </div> : null}
        </li>;
      })}
    </ul>
    {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
    {notice ? <p className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p> : null}
  </section>;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:run -- src/components/recruitment src/lib/recruitment && npm run typecheck && npm run lint`
Expected: PASS. If `applicant-dashboard.test.tsx` asserts text that came from this component, update only those strings.

- [ ] **Step 8: Commit**

```bash
git add src/lib/recruitment/required-documents.ts src/lib/recruitment/required-documents.test.ts src/components/recruitment/applicant-profile-documents.tsx src/components/recruitment/applicant-profile-documents.test.tsx
git commit -m "feat: save each required document with an explicit Save button and show progress

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: One-page apply flow that reuses the saved CV and blocks Submit until all 5 are saved

**Files:**
- Modify: `src/queries/recruitment.ts` (add `loadMyProfileDocumentFile`)
- Modify: `src/queries/recruitment.test.ts` (storage mock + new test)
- Modify: `src/components/recruitment/applicant-application-form.tsx` (full rewrite)
- Modify: `src/components/recruitment/applicant-application-form.test.tsx` (full rewrite)
- Create: `src/components/recruitment/applicant-apply-workspace.tsx`
- Create: `src/components/recruitment/applicant-apply-workspace.test.tsx`
- Create: `src/app/(app)/applicant/apply/[jobId]/page.tsx`
- Modify: `src/app/(app)/applicant/applications/page.tsx`
- Create: `src/app/(app)/applicant/applications/page.test.tsx`
- Modify: `src/components/recruitment/public-job-detail.tsx:45`
- Modify: `src/components/recruitment/public-job-detail.test.tsx:47,70`

**Interfaces:**
- Consumes: `requiredDocumentStatus` (Task 4); `ApplicantProfileDocuments` (Task 4); `useApplicantProfileDocuments`, `useMyApplicationForJob`, `useSubmitApplication`, `usePublishedJob` (`src/hooks/use-recruitment.ts`); `submitApplication` (unchanged).
- Produces:
  - `loadMyProfileDocumentFile(document: Pick<ApplicantProfileDocument, "object_path" | "file_name" | "mime_type">): Promise<File>` in `@/queries/recruitment`.
  - `<ApplicantApplicationForm jobId={number} />`, now with no CV input.
  - `<ApplicantApplyWorkspace jobId={number} />`.
  - Route `/applicant/apply/[jobId]`.

- [ ] **Step 1: Write the failing query test**

In `src/queries/recruitment.test.ts`:
- Add `download: vi.fn(),` to the `vi.hoisted` mocks object.
- Change the storage mock to `storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove, download: mocks.download }) },`.
- Add `loadMyProfileDocumentFile` to the named import.
- Append:
```ts
describe("loadMyProfileDocumentFile", () => {
  beforeEach(() => vi.resetAllMocks());

  it("downloads the saved profile document as a File with its name and type", async () => {
    mocks.download.mockResolvedValue({ data: new Blob(["cv"], { type: "application/pdf" }), error: null });
    const file = await loadMyProfileDocumentFile({ object_path: `applicant-profiles/${userId}/a.pdf`, file_name: "resume.pdf", mime_type: "application/pdf" });
    expect(mocks.download).toHaveBeenCalledWith(`applicant-profiles/${userId}/a.pdf`);
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("resume.pdf");
    expect(file.type).toBe("application/pdf");
  });

  it("keeps a legacy image CV usable", async () => {
    mocks.download.mockResolvedValue({ data: new Blob(["img"], { type: "image/png" }), error: null });
    const file = await loadMyProfileDocumentFile({ object_path: `applicant-profiles/${userId}/a.png`, file_name: "resume.png", mime_type: "image/png" });
    expect(file.type).toBe("image/png");
  });

  it("explains a failed download in applicant terms", async () => {
    mocks.download.mockResolvedValue({ data: null, error: { message: "Object not found" } });
    await expect(loadMyProfileDocumentFile({ object_path: `applicant-profiles/${userId}/a.pdf`, file_name: "resume.pdf", mime_type: "application/pdf" })).rejects.toThrow("We could not attach your saved CV. Try again.");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:run -- src/queries/recruitment.test.ts`
Expected: FAIL. `loadMyProfileDocumentFile` is not exported.

- [ ] **Step 3: Implement the query**

In `src/queries/recruitment.ts`, after `getApplicantProfileDocumentUrl`:
```ts
/** The applicant's saved profile document as a File, so it can be attached to an application (the saved CV becomes the application's CV). */
export async function loadMyProfileDocumentFile(document: Pick<ApplicantProfileDocument, "object_path" | "file_name" | "mime_type">) {
  const { data, error } = await createBrowserSupabaseClient().storage.from(applicantProfileDocumentBucket).download(document.object_path);
  if (error || !data) throw new Error("We could not attach your saved CV. Try again.");
  return new File([data], document.file_name, { type: document.mime_type });
}
```
Run: `npm run test:run -- src/queries/recruitment.test.ts`. Expected: PASS.

- [ ] **Step 4: Write the failing form tests**

Replace `src/components/recruitment/applicant-application-form.test.tsx` with:
```tsx
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), existingApplication: vi.fn(), documents: vi.fn(), loadFile: vi.fn() }));
vi.mock("@/hooks/use-recruitment", () => ({
  useMyApplicationForJob: mocks.existingApplication,
  useSubmitApplication: () => ({ isPending: false, mutateAsync: mocks.submit }),
  useApplicantProfileDocuments: mocks.documents,
}));
vi.mock("@/queries/recruitment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/queries/recruitment")>()),
  loadMyProfileDocumentFile: mocks.loadFile,
}));

import { ApplicantProfileRequiredError } from "@/queries/recruitment";
import { ApplicantApplicationForm } from "./applicant-application-form";

const saved = (kind: string) => ({ id: kind, kind, object_path: `applicant-profiles/u/${kind}.pdf`, file_name: `${kind}.pdf`, mime_type: "application/pdf", updated_at: "2026-10-01T00:00:00Z" });
const allFive = ["resume", "psa", "photo", "eligibility", "diploma"].map(saved);

function stubFormData(coverNote: string, credentials: File[]) {
  vi.stubGlobal("FormData", class {
    get(name: string) { return name === "coverNote" ? coverNote : null; }
    getAll(name: string) { return name === "credentials" ? credentials : []; }
  });
}

describe("ApplicantApplicationForm", () => {
  beforeEach(() => {
    mocks.submit.mockReset();
    mocks.loadFile.mockReset();
    mocks.existingApplication.mockReturnValue({ data: null, error: null, isLoading: false });
    mocks.documents.mockReturnValue({ data: allFive, error: null, isLoading: false });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("has no CV upload; the saved CV is used", () => {
    render(<ApplicantApplicationForm jobId={7} />);
    expect(screen.queryByLabelText("CV (PDF)")).not.toBeInTheDocument();
    expect(screen.getByText("Your saved CV / Resume and required documents are included.")).toBeVisible();
  });

  it("disables Submit until all five required documents are saved", () => {
    mocks.documents.mockReturnValue({ data: allFive.slice(0, 4), error: null, isLoading: false });
    render(<ApplicantApplicationForm jobId={7} />);
    expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
    expect(screen.getByText("Save all 5 required documents to submit.")).toBeVisible();
  });

  it("attaches the saved CV, keeps optional credentials, and shows a tracking link", async () => {
    const user = userEvent.setup();
    const cv = new File(["CV"], "resume.pdf", { type: "application/pdf" });
    const credential = new File(["certificate"], "certificate.png", { type: "image/png" });
    mocks.loadFile.mockResolvedValue(cv);
    mocks.submit.mockResolvedValue("223e4567-e89b-42d3-a456-426614174000");
    render(<ApplicantApplicationForm jobId={7} />);
    stubFormData("Ready to serve.", [credential]);
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(mocks.loadFile).toHaveBeenCalledWith(expect.objectContaining({ object_path: "applicant-profiles/u/resume.pdf" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 7,
      coverNote: "Ready to serve.",
      documents: [{ kind: "cv", file: cv }, { kind: "credential", file: credential }],
    })));
    expect(await screen.findByRole("status")).toHaveTextContent("Application submitted");
    expect(screen.getByRole("link", { name: "Track application" })).toHaveAttribute("href", "/applicant/applications/223e4567-e89b-42d3-a456-426614174000");
  });

  it("shows the CV attach failure and does not submit", async () => {
    const user = userEvent.setup();
    mocks.loadFile.mockRejectedValue(new Error("We could not attach your saved CV. Try again."));
    render(<ApplicantApplicationForm jobId={7} />);
    stubFormData("", []);
    await user.click(screen.getByRole("button", { name: "Submit application" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not attach your saved CV. Try again.");
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("links legacy applicants to complete their profile before retrying", async () => {
    const user = userEvent.setup();
    mocks.loadFile.mockResolvedValue(new File(["CV"], "resume.pdf", { type: "application/pdf" }));
    mocks.submit.mockRejectedValue(new ApplicantProfileRequiredError());
    render(<ApplicantApplicationForm jobId={7} />);
    stubFormData("", []);
    await user.click(screen.getByRole("button", { name: "Submit application" }));
    expect(await screen.findByRole("link", { name: "Complete profile" })).toHaveAttribute("href", "/applicant/profile");
  });

  it("links to the existing application instead of offering a duplicate submission", () => {
    mocks.existingApplication.mockReturnValue({ data: { id: "223e4567-e89b-42d3-a456-426614174000", status: "Under Review" }, error: null, isLoading: false });
    render(<ApplicantApplicationForm jobId={7} />);
    expect(screen.getByRole("link", { name: "Open existing application" })).toHaveAttribute("href", "/applicant/applications/223e4567-e89b-42d3-a456-426614174000");
    expect(screen.queryByRole("button", { name: "Submit application" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run them to verify they fail**

Run: `npm run test:run -- src/components/recruitment/applicant-application-form.test.tsx`
Expected: FAIL. The CV input still exists, and Submit is never disabled.

- [ ] **Step 6: Rewrite the form**

Replace `src/components/recruitment/applicant-application-form.tsx` with:
```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useApplicantProfileDocuments, useMyApplicationForJob, useSubmitApplication } from "@/hooks/use-recruitment";
import { requiredDocumentStatus } from "@/lib/recruitment/required-documents";
import { ApplicantProfileRequiredError, loadMyProfileDocumentFile } from "@/queries/recruitment";

function isNonEmptyFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && "size" in value && value.size > 0;
}

export function ApplicantApplicationForm({ jobId }: { jobId: number }) {
  const existing = useMyApplicationForJob(jobId);
  const documents = useApplicantProfileDocuments();
  const submit = useSubmitApplication();
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [profileAction, setProfileAction] = useState<{ href: string; label: string } | null>(null);
  const [submittedApplicationId, setSubmittedApplicationId] = useState<string | null>(null);
  const status = requiredDocumentStatus(documents.data);
  const savedResume = documents.data?.find((document) => document.kind === "resume");

  async function onSubmit(form: HTMLFormElement) {
    setError(null);
    setProfileAction(null);
    setSubmittedApplicationId(null);
    if (!status.complete || !savedResume) {
      setError("Save all 5 required documents to submit.");
      return;
    }

    const data = new FormData(form);
    const credentials = Array.from(data.getAll("credentials")).filter(isNonEmptyFile);
    setPreparing(true);
    try {
      const cv = await loadMyProfileDocumentFile(savedResume);
      const applicationId = await submit.mutateAsync({
        applicationId: crypto.randomUUID(),
        jobId,
        coverNote: String(data.get("coverNote") ?? ""),
        documents: [
          { kind: "cv" as const, file: cv },
          ...credentials.map((file) => ({ kind: "credential" as const, file })),
        ],
      });
      form.reset();
      setSubmittedApplicationId(applicationId);
    } catch (cause) {
      if (cause instanceof ApplicantProfileRequiredError) {
        setProfileAction({ href: cause.actionHref, label: cause.actionLabel });
        setError(cause.message);
        return;
      }
      setError(cause instanceof Error ? cause.message : "We could not submit your application.");
    } finally {
      setPreparing(false);
    }
  }

  if (existing.isLoading || documents.isLoading) return <p className="text-sm text-muted-foreground">Checking for an existing application…</p>;
  if (existing.error) return <ErrorState message={existing.error.message} />;
  if (existing.data) return <section className="rounded-xl border bg-card p-5 shadow-sm"><h2 className="font-heading text-lg font-semibold">Application already submitted</h2><p className="mt-1 text-sm text-muted-foreground">Your current application status is {existing.data.status}.</p><Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`/applicant/applications/${existing.data.id}`}>Open existing application</Link></section>;

  const submitting = preparing || submit.isPending;

  return (
    <form
      className="space-y-4 rounded-xl border bg-card p-5 shadow-sm"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(event.currentTarget);
      }}
    >
      <div>
        <h2 className="font-heading text-lg font-semibold">Submit application</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your saved CV / Resume and required documents are included.</p>
      </div>
      <FormField htmlFor="application-credentials" label="Additional credentials (optional)">
        <Input accept=".pdf,.png,.jpg,.jpeg" aria-describedby="application-credentials-help" id="application-credentials" multiple name="credentials" type="file" />
      </FormField>
      <p className="text-sm text-muted-foreground" id="application-credentials-help">Add certificates or other supporting documents as PDF, PNG, or JPEG files up to 10 MB each.</p>
      <FormField htmlFor="application-cover-note" label="Cover note (optional)">
        <textarea className="min-h-28 w-full rounded-lg border bg-background p-3 text-base leading-6" id="application-cover-note" name="coverNote" />
      </FormField>
      {profileAction && error ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4" role="alert">
          <p className="text-sm font-medium text-foreground">{error}</p>
          <Link className="mt-2 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline" href={profileAction.href}>{profileAction.label}</Link>
        </div>
      ) : error ? <ErrorState message={error} /> : null}
      {submittedApplicationId ? <div aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950" role="status"><p className="font-semibold">Application submitted</p><p className="mt-1 text-sm">Your application and documents were received.</p><Link className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4" href={`/applicant/applications/${submittedApplicationId}`}>Track application</Link></div> : null}
      <div className="space-y-2">
        <button aria-describedby={status.complete ? undefined : "application-submit-help"} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" disabled={!status.complete || submitting} type="submit">{submitting ? "Submitting…" : "Submit application"}</button>
        {status.complete ? null : <p className="text-sm text-muted-foreground" id="application-submit-help">Save all 5 required documents to submit.</p>}
      </div>
    </form>
  );
}
```
The cover-note label changes from "Cover note" to "Cover note (optional)". Check for other users with `rg -n '"Cover note"' src e2e`; Task 8 updates the e2e test.

- [ ] **Step 7: Run the form tests to verify they pass**

Run: `npm run test:run -- src/components/recruitment/applicant-application-form.test.tsx`
Expected: PASS.

- [ ] **Step 8: Write the failing workspace, redirect, and job-detail tests**

`src/components/recruitment/applicant-apply-workspace.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ job: vi.fn() }));
vi.mock("@/hooks/use-recruitment", () => ({ usePublishedJob: mocks.job }));
vi.mock("./applicant-profile-documents", () => ({ ApplicantProfileDocuments: () => <section>documents-section</section> }));
vi.mock("./applicant-application-form", () => ({ ApplicantApplicationForm: ({ jobId }: { jobId: number }) => <form>form-for-{jobId}</form> }));

import { ApplicantApplyWorkspace } from "./applicant-apply-workspace";

describe("ApplicantApplyWorkspace", () => {
  it("shows the job, then the required documents, then the application form", () => {
    mocks.job.mockReturnValue({ data: { id: 7, title: "Patrolman", location: "San Juan City", closes_on: "2026-12-01" }, error: null, isLoading: false });
    const { container } = render(<ApplicantApplyWorkspace jobId={7} />);
    expect(screen.getByRole("heading", { name: "Patrolman" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View job details" })).toHaveAttribute("href", "/jobs/7");
    expect(container.textContent).toMatch(/Patrolman[\s\S]*documents-section[\s\S]*form-for-7/);
  });

  it("does not offer the form for a closed or unpublished job", () => {
    mocks.job.mockReturnValue({ data: null, error: null, isLoading: false });
    render(<ApplicantApplyWorkspace jobId={7} />);
    expect(screen.getByText("This job opening is unavailable or has closed.")).toBeVisible();
    expect(screen.queryByText("form-for-7")).not.toBeInTheDocument();
  });
});
```
`src/app/(app)/applicant/applications/page.test.tsx`:
```tsx
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/recruitment/applicant-application-status", () => ({ ApplicantApplicationStatus: () => null }));

import ApplicantApplicationsPage from "./page";

describe("ApplicantApplicationsPage", () => {
  it("sends old ?jobId links to the one-page apply flow", async () => {
    await expect(ApplicantApplicationsPage({ searchParams: Promise.resolve({ jobId: "5" }) })).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/applicant/apply/5");
  });

  it("shows the status list without a jobId", async () => {
    mocks.redirect.mockClear();
    await expect(ApplicantApplicationsPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
```
In `src/components/recruitment/public-job-detail.test.tsx`, change both expected paths:
- line 47: `` `/login?as=applicant&next=${encodeURIComponent("/applicant/apply/9")}` ``
- line 70: `"/applicant/apply/9"`

- [ ] **Step 9: Run them to verify they fail**

Run: `npm run test:run -- src/components/recruitment/applicant-apply-workspace.test.tsx "src/app/(app)/applicant/applications/page.test.tsx" src/components/recruitment/public-job-detail.test.tsx`
Expected: FAIL. The workspace module is missing, there is no redirect, and the old apply path is still used.

- [ ] **Step 10: Implement the workspace, route, redirect, and apply link**

`src/components/recruitment/applicant-apply-workspace.tsx`:
```tsx
"use client";

import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { usePublishedJob } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";

import { ApplicantApplicationForm } from "./applicant-application-form";
import { ApplicantProfileDocuments } from "./applicant-profile-documents";

/** Everything needed to apply for one job on one page: the job, the five required documents, and the submit form. */
export function ApplicantApplyWorkspace({ jobId }: { jobId: number }) {
  const job = usePublishedJob(jobId);
  if (job.isLoading) return <LoadingState label="Loading job opening…" />;
  if (job.error) return <ErrorState message={job.error.message} />;
  if (!job.data) return <ErrorState message="This job opening is unavailable or has closed." />;
  return <div className="space-y-6">
    <section aria-labelledby="apply-job-title" className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">Applying for</p>
      <h2 className="mt-1 text-xl font-semibold" id="apply-job-title">{job.data.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{[job.data.location, job.data.closes_on ? `Deadline of Application: ${formatDate(job.data.closes_on)}` : "Open until filled"].filter(Boolean).join(" · ")}</p>
      <Link className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`/jobs/${job.data.id}`}>View job details</Link>
    </section>
    <ApplicantProfileDocuments />
    <ApplicantApplicationForm jobId={job.data.id} />
  </div>;
}
```
`src/app/(app)/applicant/apply/[jobId]/page.tsx`:
```tsx
import { notFound } from "next/navigation";

import { ApplicantApplyWorkspace } from "@/components/recruitment/applicant-apply-workspace";
import { PageHeader } from "@/components/ui/page-header";

export default async function ApplicantApplyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const parsed = Number(jobId);
  if (!Number.isInteger(parsed) || parsed < 1) notFound();
  return <div className="max-w-3xl space-y-6"><PageHeader description="Save your required documents, then submit your application." title="Apply" /><ApplicantApplyWorkspace jobId={parsed} /></div>;
}
```
Replace `src/app/(app)/applicant/applications/page.tsx` with:
```tsx
import { redirect } from "next/navigation";

import { ApplicantApplicationStatus } from "@/components/recruitment/applicant-application-status";
import { PageHeader } from "@/components/ui/page-header";

export default async function ApplicantApplicationsPage({ searchParams }: { searchParams: Promise<{ jobId?: string }> }) {
  const { jobId } = await searchParams;
  const parsedJobId = Number(jobId);
  // Links made before the one-page apply flow (bookmarks, login `next` paths) still land on the form.
  if (Number.isInteger(parsedJobId) && parsedJobId > 0) redirect(`/applicant/apply/${parsedJobId}`);
  return <div className="space-y-8"><PageHeader title="Application Status" /><ApplicantApplicationStatus /></div>;
}
```
`src/components/recruitment/public-job-detail.tsx:45`:
```tsx
  const applyPath = `/applicant/apply/${job.data.id}`;
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `npm run test:run -- src/components/recruitment src/app src/queries && npm run typecheck && npm run lint`
Expected: PASS. The register and login page tests still use the `?jobId=` string as an opaque `next` value, so they need no change.

- [ ] **Step 12: Commit**

```bash
git add src/queries/recruitment.ts src/queries/recruitment.test.ts src/components/recruitment/applicant-application-form.tsx src/components/recruitment/applicant-application-form.test.tsx src/components/recruitment/applicant-apply-workspace.tsx src/components/recruitment/applicant-apply-workspace.test.tsx "src/app/(app)/applicant/apply" "src/app/(app)/applicant/applications/page.tsx" "src/app/(app)/applicant/applications/page.test.tsx" src/components/recruitment/public-job-detail.tsx src/components/recruitment/public-job-detail.test.tsx
git commit -m "feat: apply from one page that reuses the saved CV and waits for all required documents

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Applicant navigation: Job Openings in the sidebar, dashboard call to action, register lands on jobs

**Files:**
- Modify: `src/lib/app/role-config.ts` (applicant `navigation`)
- Modify: `src/lib/app/role-config.test.ts`
- Modify: `src/components/recruitment/applicant-dashboard.tsx` (latest-application card link)
- Modify: `src/components/recruitment/applicant-dashboard.test.tsx`
- Modify: `src/components/auth/applicant-registration-form.tsx:86`
- Modify: `src/components/auth/applicant-registration-form.test.tsx:69`

**Interfaces:**
- Consumes: nothing new.
- Produces: the applicant navigation order `/applicant`, `/jobs`, `/applicant/profile`, `/applicant/documents`, `/applicant/applications`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/app/role-config.test.ts`, inside the `describe`:
```ts
  it("puts Job Openings in the applicant sidebar", () => {
    expect(getRoleConfig("applicant").navigation.map(({ href, label, icon }) => ({ href, label, icon }))).toEqual([
      { href: "/applicant", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/jobs", label: "Job Openings", icon: "BriefcaseBusiness" },
      { href: "/applicant/profile", label: "Profile", icon: "ContactRound" },
      { href: "/applicant/documents", label: "Documents", icon: "FileText" },
      { href: "/applicant/applications", label: "Application Status", icon: "Clock" },
    ]);
  });
```
In `src/components/recruitment/applicant-dashboard.test.tsx`, add a test that follows the file's existing mock setup for "no applications" (rows `[]`):
```tsx
  it("points a new applicant to job openings from the latest-application card", () => {
    // arrange the same way the file's other tests do, with applications rows = []
    render(<ApplicantDashboard />);
    expect(screen.getByRole("link", { name: "Start an application" })).toHaveAttribute("href", "/jobs");
    expect(screen.queryByRole("link", { name: "View application status" })).not.toBeInTheDocument();
  });
```
Open the file first and copy how it sets `useMyApplicationStatuses` / `useApplicantProfile` / `useApplicantProfileDocuments`. Replace the comment with those exact mock assignments. Also add the opposite case (one application row, so the link is "View application status" to `/applicant/applications`) if no existing test already pins it.

In `src/components/auth/applicant-registration-form.test.tsx:69`, change `expect(mocks.replace).toHaveBeenCalledWith("/applicant");` to `expect(mocks.replace).toHaveBeenCalledWith("/jobs");`. Also rename that test's title so it mentions job openings.

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test:run -- src/lib/app src/components/recruitment/applicant-dashboard.test.tsx src/components/auth/applicant-registration-form.test.tsx`
Expected: FAIL on all three.

- [ ] **Step 3: Implement**

`src/lib/app/role-config.ts`, applicant `navigation`:
```ts
    navigation: [
      { href: "/applicant", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/jobs", label: "Job Openings", icon: "BriefcaseBusiness" },
      { href: "/applicant/profile", label: "Profile", icon: "ContactRound" },
      { href: "/applicant/documents", label: "Documents", icon: "FileText" },
      { href: "/applicant/applications", label: "Application Status", icon: "Clock" },
    ],
```
`src/components/recruitment/applicant-dashboard.tsx`, the latest-application card link:
```tsx
        {latest
          ? <Link className={linkClassName} href="/applicant/applications">View application status</Link>
          : <Link className={linkClassName} href="/jobs">Start an application</Link>}
```
(The third card keeps its own "Browse job openings" link. The new label avoids two identical link names on one page.)

`src/components/auth/applicant-registration-form.tsx:86`:
```ts
      router.replace(nextPath ?? "/jobs");
```

Then check that the sidebar highlights "Job Openings" on `/jobs` inside the applicant shell (`src/app/jobs/layout.tsx`). Run `rg -n "isActive|pathname" src/components/app` to find the active-link logic. If it matches by `startsWith(href)`, `/jobs/12` also highlights it, which is fine.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/app src/components/recruitment src/components/auth "src/app/(app)/role-layouts.test.tsx" && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/app/role-config.ts src/lib/app/role-config.test.ts src/components/recruitment/applicant-dashboard.tsx src/components/recruitment/applicant-dashboard.test.tsx src/components/auth/applicant-registration-form.tsx src/components/auth/applicant-registration-form.test.tsx
git commit -m "feat: add Job Openings to the applicant sidebar and send new applicants to jobs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: HR sees the applicant's five required documents on the application

**Files:**
- Modify: `src/queries/recruitment.ts` (add `listApplicantProfileDocumentsFor`)
- Modify: `src/lib/query-keys.ts` (recruitment keys)
- Modify: `src/hooks/use-recruitment.ts` (add `useApplicantProfileDocumentsFor`)
- Create: `src/components/recruitment/hr-required-documents.tsx`
- Create: `src/components/recruitment/hr-required-documents.test.tsx`
- Modify: `src/components/recruitment/hr-application-detail.tsx` (render the section before "Documents", around L160)

**Interfaces:**
- Consumes: `getApplicantProfileDocumentUrl(objectPath)` and `APPLICANT_PROFILE_DOCUMENT_KINDS`. The RLS policy `applicant_profile_documents_select_own_or_hr` (table) and the storage policy of the same name already let HR read these.
- Produces:
  - `listApplicantProfileDocumentsFor(applicantId: string): Promise<ApplicantProfileDocument[]>`
  - `queryKeys.recruitment.applicantProfileDocuments(applicantId: string)`
  - `useApplicantProfileDocumentsFor(applicantId: string | undefined)`
  - `<HrRequiredDocuments applicantId={string} />`

- [ ] **Step 1: Write the failing component test**

`src/components/recruitment/hr-required-documents.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ documents: vi.fn(), url: vi.fn() }));
vi.mock("@/hooks/use-recruitment", () => ({ useApplicantProfileDocumentsFor: mocks.documents }));
vi.mock("@/queries/recruitment", () => ({ getApplicantProfileDocumentUrl: mocks.url }));

import { HrRequiredDocuments } from "./hr-required-documents";

describe("HrRequiredDocuments", () => {
  it("lists all five required documents and marks missing ones", () => {
    mocks.documents.mockReturnValue({ data: [{ id: "d1", kind: "resume", file_name: "resume.pdf", object_path: "applicant-profiles/u/r.pdf", updated_at: "2026-10-01T00:00:00Z" }], error: null, isLoading: false });
    render(<HrRequiredDocuments applicantId="a1" />);
    expect(screen.getByRole("heading", { name: "Required documents" })).toBeVisible();
    for (const label of ["CV / Resume", "PSA birth certificate", "2x2 picture", "Eligibility", "Diploma"]) expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByRole("button", { name: "Open CV / Resume: resume.pdf" })).toBeVisible();
    expect(screen.getAllByText("Not uploaded")).toHaveLength(4);
  });

  it("opens a document through a signed URL", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.url.mockResolvedValue("https://signed.example/r.pdf");
    mocks.documents.mockReturnValue({ data: [{ id: "d1", kind: "resume", file_name: "resume.pdf", object_path: "applicant-profiles/u/r.pdf", updated_at: "2026-10-01T00:00:00Z" }], error: null, isLoading: false });
    render(<HrRequiredDocuments applicantId="a1" />);
    await user.click(screen.getByRole("button", { name: "Open CV / Resume: resume.pdf" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://signed.example/r.pdf", "_blank", "noopener,noreferrer"));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:run -- src/components/recruitment/hr-required-documents.test.tsx`
Expected: FAIL. The module is not found.

- [ ] **Step 3: Implement the query, key, hook, and component**

`src/queries/recruitment.ts`, after `listApplicantProfileDocuments`:
```ts
/** HR: one applicant's saved required documents (RLS allows HR to read every applicant's). */
export async function listApplicantProfileDocumentsFor(applicantId: string) {
  const { data, error } = await createBrowserSupabaseClient().from("applicant_profile_documents").select("*").eq("applicant_id", applicantId).order("kind");
  throwIfError(error);
  return (data ?? []) as ApplicantProfileDocument[];
}
```
`src/lib/query-keys.ts`, in `recruitment`, after `profileDocuments`:
```ts
    applicantProfileDocuments: (applicantId: string) => ["recruitment", "applicant-profile-documents", applicantId] as const,
```
`src/hooks/use-recruitment.ts`: add `listApplicantProfileDocumentsFor` to the import, and after `useApplicantProfileDocuments`:
```ts
export function useApplicantProfileDocumentsFor(applicantId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.recruitment.applicantProfileDocuments(applicantId ?? ""),
    queryFn: () => listApplicantProfileDocumentsFor(applicantId as string),
    enabled: Boolean(applicantId),
  });
}
```
`src/components/recruitment/hr-required-documents.tsx`:
```tsx
"use client";

import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useApplicantProfileDocumentsFor } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { getApplicantProfileDocumentUrl } from "@/queries/recruitment";
import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

/** The five documents the applicant saved before applying, for HR to open while reviewing. */
export function HrRequiredDocuments({ applicantId }: { applicantId: string }) {
  const documents = useApplicantProfileDocumentsFor(applicantId);
  const [error, setError] = useState<string | null>(null);

  async function open(objectPath: string) {
    setError(null);
    try {
      window.open(await getApplicantProfileDocumentUrl(objectPath), "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not open this document.");
    }
  }

  return <section aria-labelledby="hr-required-documents" className="rounded-xl border p-5">
    <h2 className="font-semibold" id="hr-required-documents">Required documents</h2>
    {documents.isLoading ? <LoadingState label="Loading required documents…" /> : documents.error ? <ErrorState message={documents.error.message} /> : (
      <ul className="mt-3 divide-y text-sm">
        {APPLICANT_PROFILE_DOCUMENT_KINDS.map(({ kind, label }) => {
          const document = documents.data?.find((item) => item.kind === kind);
          return <li className="flex flex-wrap items-center justify-between gap-2 py-2" key={kind}>
            <span className="font-medium">{label}</span>
            {document
              ? <span className="flex items-center gap-3"><span className="text-muted-foreground">{formatDate(document.updated_at)}</span><button aria-label={`Open ${label}: ${document.file_name}`} className="inline-flex min-h-11 items-center text-primary underline" onClick={() => void open(document.object_path)} type="button">{document.file_name}</button></span>
              : <span className="text-muted-foreground">Not uploaded</span>}
          </li>;
        })}
      </ul>
    )}
    {error ? <p className="mt-2 text-sm text-destructive" role="alert">{error}</p> : null}
  </section>;
}
```
In `src/components/recruitment/hr-application-detail.tsx`, import `HrRequiredDocuments` and render it directly before `<section className="rounded-xl border p-5">` (the "Documents" section):
```tsx
      <HrRequiredDocuments applicantId={application.applicant_id} />
```
Rename that following section's heading from `Documents` to `Submitted with this application`, so HR can tell the two lists apart. First check `rg -n '"Documents"' e2e src/components/recruitment/*hr*` for assertions on the old heading, and update them.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/components/recruitment src/hooks src/queries && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/queries/recruitment.ts src/lib/query-keys.ts src/hooks/use-recruitment.ts src/components/recruitment/hr-required-documents.tsx src/components/recruitment/hr-required-documents.test.tsx src/components/recruitment/hr-application-detail.tsx
git commit -m "feat: show HR the applicant's required documents on each application

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: End-to-end journey update and full verification

**Files:**
- Modify: `e2e/capstone-objectives.spec.ts` (around L186-240)

**Interfaces:**
- Consumes: every earlier task's UI names.
- Produces: a green full suite.

- [ ] **Step 1: Update the applicant journey**

In `e2e/capstone-objectives.spec.ts`:

(a) After registration, replace `await expect(page).toHaveURL(/\/applicant$/, { timeout: 30_000 });` with:
```ts
    await expect(page).toHaveURL(/\/jobs$/, { timeout: 30_000 });
```

(b) Replace the documents loop with:
```ts
    for (const [label, file] of [["CV / Resume", pdf("resume.pdf")], ["PSA birth certificate", pdf("psa.pdf")], ["2x2 picture", png], ["Eligibility", pdf("eligibility.pdf")], ["Diploma", pdf("diploma.pdf")]] as const) {
      await page.getByLabel(`Upload ${label} document`).setInputFiles(file);
      await page.getByRole("button", { name: `Save ${label} document` }).click();
      await expect(page.getByRole("status").filter({ hasText: `${label} document saved.` })).toBeVisible();
    }
    await expect(page.getByText("5 of 5 required documents saved")).toBeVisible();
```

(c) Replace the apply block with:
```ts
    await page.goto("/jobs");
    await page.getByRole("link", { name: `View details for ${title}` }).click();
    await page.getByRole("button", { name: "Apply now" }).click();
    await page.getByRole("checkbox", { name: /I have read and agree/ }).check();
    await page.getByRole("button", { name: "I Agree & Continue" }).click();
    await expect(page).toHaveURL(/\/applicant\/apply\/\d+$/);
    await expect(page.getByLabel("CV (PDF)")).toHaveCount(0);
    await page.getByLabel("Cover note (optional)").fill("I am applying through the capstone objective tests.");
    await page.getByRole("button", { name: "Submit application" }).click();
```
The rest is unchanged ("Application submitted", "Track application").

(d) In the HR part, after `await page.goto(`/hr/applications/${applicationId}`);`, add:
```ts
    await expect(page.getByRole("heading", { name: "Required documents" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open CV \/ Resume: / })).toBeVisible();
```

Then `rg -n "Cover note\"|CV \(PDF\)|/applicant\$|document saved" e2e` and update any other spec that uses the old flow the same way.

- [ ] **Step 2: Run the full verification**

Run each command and read its output:
```bash
npm run lint
npm run typecheck
npm run test:run
npx supabase db reset && npx supabase test db
npm run build
npm run test:e2e -- e2e/capstone-objectives.spec.ts e2e/face-attendance.spec.ts
```
Expected: every command exits 0. `test:run` reports 0 failed, pgTAP reports `All tests successful`, and Playwright passes. If Playwright needs the dev server or seeded users, follow `playwright.config.ts` / the e2e README exactly as earlier branches did. If any step fails, fix the cause in the task that owns it; do not weaken the test.

- [ ] **Step 3: Manual check (375px and desktop)**

Run `npm run dev` and check:
- As a new applicant: register → lands on `/jobs` → Apply now on a job → `/applicant/apply/{id}`.
- Pick a PNG for the CV: the PDF-only error shows under that card.
- Pick PDFs and Save each one: the counter reaches 5/5 and Submit enables.
- Submit: confirmation shows.
- Open `/applicant/applications?jobId={id}` in the address bar: it redirects to the apply page.
- As HR, open the application: "Required documents" lists all five and each one opens.

- [ ] **Step 4: Commit**

```bash
git add e2e
git commit -m "test(e2e): apply through the one-page flow with saved required documents

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
