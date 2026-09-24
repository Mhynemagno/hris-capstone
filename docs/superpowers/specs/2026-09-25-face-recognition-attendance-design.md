# Face-recognition attendance design

**Branch:** `feat/face-recognition-attendance`
**Goal:** Let an employee record attendance at a supervised kiosk without choosing their name: the browser camera finds one face, runs a blink challenge, and the database matches the face against consenting enrolled employees and writes the attendance through the existing attendance log.

## Policy change

The project previously forbade storing biometric data (`PROJECT_SCOPE.md` §4.10, the [attendance integration design](2026-08-24-attendance-integration-design.md)). **This feature intentionally overrides that rule for the capstone demonstration.** The HRIS now stores exactly one kind of biometric data: a 128-value face descriptor per consenting employee. It still never stores face photos, video, or the probe descriptors captured at scan time.

Development and demonstrations must use only test subjects, people who have consented, or anonymized faces. Blink detection is a basic liveness cue for a supervised kiosk; it is **not** production-grade anti-spoofing (it does not stop a replayed video or a mask).

## Audit of the existing system (before this change)

1. **Employees, accounts, roles, attendance.** `auth.users` → `public.profiles` (1:1, `is_active`) → `public.user_roles` (one `app_role` per user). `public.employees` optionally links to a login through `employees.profile_id`. `public.attendance_logs.employee_id` references `employees`; an employee reads their own logs through `employees.profile_id = auth.uid()`.
2. **Attendance write path.** Only the `import-attendance` Edge Function writes attendance, calling `create_attendance_import` → `process_attendance_event` → `complete_attendance_import` with the caller's JWT. All are `security definer` wrappers around `private.*` functions gated by `private.require_active_hr()`. Deduplication is `unique (integration_id, source_event_id)`; unmapped device IDs go to `attendance_unmatched_events`. Every write adds an `audit_logs` row. Status: `present`, `late` (time-in after start + grace in the configured timezone), `incomplete` (no time-out), `absent` (explicit row only). HR reads all logs; employees read their own; nobody else reads attendance.
3. **Roles.** HR Personnel manage employee records and all attendance operations. The System Administrator only manages the non-secret import settings. Employees have self-read access. Management and Applicants have no attendance access.
4. **What had to change.** `attendance_logs.import_id` was `NOT NULL` and `attendance_integration_settings.adapter_key` allowed only `csv_xlsx`, so a face scan could not be represented. New objects: descriptor storage, match settings, a scan ledger, RPCs, a retention trigger, HR pages, hooks, and tests.
5. **Fit.** Face scans become a second capture method writing into the same `attendance_logs` table, under the same HR gate, audit trail, status rules, and employee self-read policy. No parallel attendance system is introduced.

## Decisions

- **Matching happens in the database.** The browser computes one probe descriptor and calls `record_face_attendance`. The database compares it with every enrollment by Euclidean distance, decides, and writes the attendance in one transaction. Stored descriptors never leave Postgres, so no client (HR included) can download the biometric gallery.
- **Two ways to scan.**
  - **Employee self-scan** (`/employee/attendance/scan`, added 2026-09-25): an employee signs in with their **own** account, with no HR login involved. The face is verified (1:1) against only that employee's registration, so an employee session can never search or probe anyone else's template.
  - **HR kiosk** (`/hr/attendance/kiosk`): a supervised device under an HR session identifies (1:N) among all registrations. The person scanning selects nothing.
- **Enrollment is HR-only** (`/hr/attendance/face-enrollment`), matching HR's ownership of personnel and attendance records. HR selects an employee, confirms that person's informed consent, and captures samples. The descriptor is always stored against the employee HR selected.
- **Library.** [`@vladmandic/face-api`](https://github.com/vladmandic/face-api) 1.7.15 (MIT) is the maintained fork of `face-api.js` with the same API. The original `face-api.js` 0.22.2 has been unmaintained since 2020 and pins TensorFlow.js 1.7. The fork's bundled browser ESM build (`dist/face-api.esm.js`) works in the Next 16 production build. Three models run: `tiny_face_detector`, `face_landmark_68`, and `face_recognition` (128-D ResNet-34). `scripts/copy-face-models.mjs` copies them from the pinned package into `public/models/face-api/` on `predev` and `prebuild`, so they are served from the same origin and are not committed.
- **No paid APIs and no images leave the device.** Everything runs in the browser except the final RPC.

## Data model (`20260925090000_face_recognition_attendance.sql`)

| Object | Purpose |
| --- | --- |
| `attendance_integration_settings` row `face_recognition` | The integration identity for face-scan logs. The adapter-key check now allows `csv_xlsx` and `face_recognition`. The schedule (timezone, start, grace) is still read from the `csv_xlsx` row, so there is one organisation-wide schedule. |
| `attendance_logs.capture_method` | `import` (default, existing rows) or `face_recognition`. `import_id` is nullable, and a check requires it for imports and forbids it for face scans. |
| `attendance_logs_face_employee_day_key` | Partial unique index: one face log per employee per day. This is the last line of defence against duplicates. |
| `private.employee_face_enrollments` | One row per employee: `descriptor real[128]` (validated finite, \|v\| ≤ 2), model label, sample count, consent timestamp, enrolling HR user (`on delete set null`, so HR accounts stay deletable), and timestamps. `on delete cascade` from `employees`. |
| `private.face_recognition_settings` | Single row: `is_enabled`, `match_threshold` (**0.5**), `ambiguity_margin` (**0.04**), `min_time_out_minutes` (**2**), and `return_match_distance` (**false**; turn on only for local threshold tuning, because returned distances would let a caller hill-climb a synthetic descriptor). Change these with SQL; each is range-checked. |
| `private.face_attendance_scans` | Idempotency and audit ledger keyed by the client scan UUID: outcome, matched employee, log, distance, message, and operator (`on delete set null`). It stores **no descriptor**. |
| `private.process_attendance_event`, `private.resolve_attendance_unmatched_event` | Redefined unchanged except for one check: they take the same employee + day lock, and a day already recorded by a face scan is a `duplicate` (import) or rejected (unmatched resolution). Together with the kiosk's check against imported days, one employee-day is never counted twice. |

The `private` schema is not exposed through the Data API. RLS is on for all three private tables, with no policies and no grants to `anon` or `authenticated`. Only the `security definer` functions below can touch them.

### RPCs (all require an active HR Personnel account)

| RPC | Behaviour |
| --- | --- |
| `list_face_enrollments()` | Employee ID, sample count, and timestamps. Never the descriptor. |
| `enroll_employee_face(employee, descriptor, sample_count, consent)` | Rejects missing consent, an invalid descriptor, a sample count outside 3–10, an unknown employee, or an employee without an active linked account. It share-locks the profile so a concurrent deactivation cannot miss the new row. It then takes an advisory lock and rejects a face within the match threshold of **another** employee's enrollment (which would make recognition ambiguous). Finally it upserts, so re-registration replaces the old descriptor only when the new one commits. Audited as `enrolled` or `re_registered`. |
| `delete_employee_face_enrollment(employee)` | Hard delete. Audited as `deleted` with reason `hr_request`. |
| `record_face_attendance(scan_id, descriptor)` | HR kiosk: identify among all registrations. See below. |
| `record_my_face_attendance(scan_id, descriptor)` | Employee self-scan. Requires an active `employee` account linked to a personnel record. Compares only with that employee's registration against `match_threshold` (no ambiguity check is needed for 1:1), then applies the same attendance rules. It raises "Ask HR to register it" when there is no registration. |
| `get_my_face_registration()` | For the signed-in employee: `{ registered, updatedAt }`. No descriptor. |

## Recognition and attendance write

`record_face_attendance` (kiosk). Self-scan shares steps 1, 3, 4, and 5 through `private.write_face_attendance`, and replaces step 2 with a 1:1 comparison.

1. Takes an advisory lock on the scan ID. If the scan ID already exists, it returns the stored result, so a client retry after a network failure cannot record twice. Only the account that created a scan ID can replay it.
2. Finds the nearest and second-nearest enrollment by Euclidean distance. **Not recognized** when there is no enrollment, the best distance is above `match_threshold`, or the runner-up is within `ambiguity_margin` of the best. Nothing is written except the scan ledger row and an audit entry.
3. Takes an advisory lock on employee + local date, which serializes concurrent kiosks and retries for one person.
4. Applies the attendance rules:
   - An imported log already exists that day → `rejected` ("Attendance for today was already imported…"), so the two sources never double-count a day.
   - No face log today → insert `time_in = now()` with status `incomplete`. `source_event_id` is `face:<employee>:<date>`, the external ID is the employee number, and the import is null.
   - Time-in exists, no time-out, and it is at least `min_time_out_minutes` later → set `time_out`. The status becomes `late` or `present` from the time-in, using the same rule as imports.
   - Time-in only and too soon, or both times already set → `already_recorded` with an explanatory message.
5. Writes the scan ledger row and one audit entry (`face_time_in`, `face_time_out`, `face_already_recorded`, `face_rejected`, or `not_recognized`).

The result returns the outcome, message, matched employee (ID, number, name), and the log times and status. The distance is `null` unless `return_match_distance` is on; the UI shows it only in development builds.

Verified on the local database: 8 concurrent distinct scans plus 6 concurrent retries of one scan ID for the same face produced exactly one log and one `time_in`, and every retry of the shared scan ID received the same stored result.

## Retention and deletion

- Only employees with an active linked login can be registered, so every descriptor has an automatic end of life. HR can delete it at any time on request.
- Deactivating the employee's linked account (`profiles.is_active` → false, the offboarding path) deletes the descriptor through a trigger, audited as reason `account_deactivated`. Deleting the employee record cascades.
- Re-registration overwrites; no history of old descriptors is kept.
- Probe descriptors from scans are never stored; the browser discards the descriptor after the request. Enrollment samples live only in memory until the averaged descriptor is submitted.
- The scan ledger and attendance logs are attendance records (not biometric) and follow the existing attendance retention.

## Browser flow

Tunables live in `src/lib/face-recognition/config.ts`. The server-side thresholds are listed above.

**Enrollment.** HR selects an employee and ticks the consent checkbox; the selection locks during capture. Camera + models start (front camera preferred, no audio). A sample is taken every 500 ms, only when exactly one face is adequately sized (20–70 % of the frame width) and centred (within 20 %). After 5 samples they are averaged, and any sample more than 0.4 from the mean rejects the set. The descriptor is then submitted. Cancel stops the camera and discards samples. Handled errors: camera denied, no camera, busy or insecure camera, models failing to load, no face, several faces, poor framing, inconsistent samples, a face already registered to someone else, and a deactivated account.

**Kiosk state machine** (`scanner-machine.ts`, one state at a time; events that do not belong to the current state are ignored, so late async results cannot overlap phases):

```text
INITIALIZING → READY → SEARCHING → LIVENESS → VERIFYING → RECORDING → SUCCESS | ERROR → COOLDOWN → SEARCHING
```

- **SEARCHING:** landmark detection every 250 ms, never overlapping. Three consecutive well-framed single-face frames are needed.
- **LIVENESS:** landmark-only detection every 60 ms. Eye aspect ratio (EAR) from the 68-point eye landmarks must show at least 3 open frames (EAR ≥ 0.24), then at least 1 closed frame (EAR ≤ max(0.19, 0.72 × the person's open baseline); detection runs at about 6–10 fps, so a normal blink is often a single frame), then at least 2 open frames, all within 8 s. A watchdog timer ends the challenge at 8 s even if no frame can be analysed. Eyes closed at the start never satisfy the first phase, half-closed frames count as neither open nor closed, and zero or several faces returns to SEARCHING.
- **VERIFYING:** only now is one descriptor computed, and exactly one face is required.
- **RECORDING:** one scan UUID per attempt. Transport failures retry twice with the same UUID and are shown as a connection problem; database rejections are not retried and are shown as a service rejection.
- **SUCCESS** (4 s) shows the employee, the action, and the time. **ERROR** (3.5 s) shows "Face not recognized.", the rule message, a blink timeout, or a connection problem. **COOLDOWN** (2.5 s) runs no recognition.
- Camera denial, a missing camera, model failure, or a camera that stops (page hidden, device unplugged, track ended) is fatal until the user selects Try again. Closing the scanner, navigating away, hiding the page, or unmounting stops every track and clears every timer.

## Testing

- **pgTAP** (`supabase/tests/face_recognition_attendance.test.sql`, 43 assertions): no table privileges for `anon`/`authenticated`; HR-account deletion is not blocked; employee and administrator denied every RPC; consent, descriptor, and duplicate-face validation; re-registration keeps one row; audit rows; threshold acceptance and rejection; ambiguity rejection; no log for rejected scans; time-in/time-out and status; retry idempotency; already-recorded rules; the unique-index guard; an import on a face-scanned day is a duplicate; the distance is withheld; unlinked employees cannot enroll; employee self-read isolation; deactivation purge; deletion.
- **Vitest:** geometry (EAR, framing, aggregation), the blink sequence (initially closed, noise, ambiguous frames, baseline, timeout), the state machine, schemas, queries (no table reads, retryable errors), camera hook (constraints, cleanup on unmount/hidden page, late streams, the play race, error mapping), scanner hook with mocked detection (full flow, same-scan-ID retry, unknown face, several faces, closed eyes, denied camera, model failure, track end, unmount), enrollment capture, and components.
- **Playwright** (`e2e/face-attendance.spec.ts`) with Chromium's fake camera: models load from the production bundle, the camera starts, detection reports "No face detected", consent is required, and the scanner closes. The fake feed contains no face, so a real match needs a consenting person at a real camera. Headless Edge ends fake camera tracks after about a second, so the spec skips there; run it with `--headed`.

## Known limitations

- Self-scan has no location or device check: an employee who is signed in and present in front of any camera can record attendance from anywhere. A geofence or trusted-network check could be added later.

- Blink liveness is defeatable by a video replay; the kiosk must be supervised.
- Matching is a linear scan in PL/pgSQL, fine for a station-sized roster (hundreds of employees). A larger deployment should use `pgvector` with an index.
- Thresholds are tuned from library guidance, not measured on the client's population, so tune `match_threshold` with consenting test subjects.
- Face scans and CSV imports are separate capture methods; whichever records an employee-day first wins, and the other is reported as a duplicate or rejection.
- There is no rate limit on `record_face_attendance` beyond the HR session. Withholding distances removes the obvious hill-climbing signal.
- HR and employee attendance views show times in the fixed attendance timezone (Asia/Ulaanbaatar, UTC+8).
