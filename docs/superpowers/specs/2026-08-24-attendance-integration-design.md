# Attendance integration design

**Branch:** `feat/14-attendance-integration`
**Goal:** Import attendance events from a validated CSV/XLSX export without retaining biometric templates or images. The import boundary remains replaceable by a documented biometric-vendor API or webhook.

## Decisions

- The initial adapter accepts a documented CSV/XLSX template. A future vendor adapter must produce the same normalized event contract; it may not bypass matching, validation, idempotency, or audit rules.
- The only identity used for matching is a normalized, stable external employee ID. The existing `employees.employee_number` remains the HRIS employee identifier; a separate mapping is required because a device/vendor ID need not be the same value.
- The demo schedule is organization-wide and configurable: Asia/Ulaanbaatar timezone, 08:00 start, and a 15-minute late grace period. It is an operational default, not a payroll or shift-management system.
- `absent` is recorded only from an explicit imported absence row. The system never infers an absence merely because a person has no event, which could otherwise conflict with leave, device outages, or partial imports.
- Files are parsed in the Edge Function within a bounded request and are not retained. Import metadata, normalized timestamps, safe row diagnostics, and file checksum are retained; biometric data is not.

## Data model

The migration adds the following public tables, all with RLS enabled, explicit grants, and least-privilege policies.

| Table | Purpose |
| --- | --- |
| `attendance_integration_settings` | Single CSV/XLSX adapter configuration: enabled state, timezone, scheduled start time, late grace minutes, and expected template version. It contains no vendor credential or biometric data. |
| `attendance_identity_mappings` | The HR-approved mapping from a unique normalized external employee ID to one employee. It records creation/resolution audit fields and prevents a device identity from being assigned to two employees. |
| `attendance_imports` | One submitted import run, including source filename, MIME type, SHA-256 checksum, adapter/version, importer, lifecycle state, row counts, and non-sensitive error summary. |
| `attendance_logs` | The canonical, employee-linked daily attendance records: source event ID, external employee ID snapshot, attendance date, time-in/out, calculated status, import reference, and safe sync metadata. A unique integration/source-event key makes replays idempotent. |
| `attendance_unmatched_events` | Valid normalized events whose external employee ID has no approved mapping. They remain reviewable by HR and can be resolved into a mapping and canonical log without matching on names. |

`attendance_logs` is indexed for employee history, HR date/status filtering, import review, and its unique provider-event lookup. Mapping and unmatched-event lookups are indexed by normalized external employee ID. Constraints validate non-empty trimmed IDs, valid time ranges, bounded metadata, status values, and a positive grace period. The only JSON metadata allowed is safe transport context such as template version, source row number, checksum, and adapter version; it must not contain fingerprints, templates, face images, or raw biometric payloads.

## Authorization and lifecycle

- **System Administrator:** reads and updates the integration configuration at `/admin/integrations/attendance`; the page never displays or accepts vendor secrets. Administrators do not receive attendance-history access through this module.
- **HR Personnel:** submits imports, reads import outcomes and failure summaries, reads/filter all attendance logs, reviews unmatched events, creates/corrects identity mappings, and resolves unmatched events. Each operational action writes an `audit_logs` entry.
- **Employee:** selects only attendance logs attached to their own employee record and has no import, mapping, configuration, or unmatched-event access.
- **Applicant and Management:** receive no access in this branch. Management reporting belongs to branch 15.

Employee logs and mapping records are retained. Corrections create an audited replacement/update workflow; the implementation never silently repoints an old log to another employee. A duplicate provider event is reported as a skipped duplicate rather than creating a second log. Invalid rows do not abort valid independent rows, but an import with no accepted rows is marked failed and audited.

## Import boundary and data flow

The browser submits a small CSV/XLSX file to the JWT-protected `import-attendance` Edge Function. The function verifies the calling user and `hr_personnel` role with the caller token before it creates a privileged database client. It limits content type, size, rows, columns, and string lengths, and uses a pinned XLSX parser version for workbook handling.

`CsvXlsxAttendanceAdapter` validates required template columns: `external_employee_id`, `source_event_id`, `attendance_date`, `time_in`, `time_out`, and `event_type`. It normalizes identifiers, parses timestamps in the configured timezone, and emits only a `NormalizedAttendanceEvent`. `event_type` must be `attendance` or `absence`; an absence has no times, while an attendance event has a time-in and optional time-out. The adapter never accepts a name as an identity field.

For each normalized event, the server records the import result, looks up the identity mapping, calculates status, and calls a narrow database RPC. The RPC locks only the affected rows, enforces the unique source-event key, writes the canonical log or unmatched event, and appends an audit entry. Status is `absent` for an explicit absence event, `late` when time-in is after 08:15 under the default configuration, `present` otherwise, and `incomplete` when a valid attendance event has no time-out. The import response provides accepted, duplicate, unmatched, invalid, and failed counts without exposing other employees' records.

Future API/webhook adapters implement the same normalization interface. A webhook additionally validates a vendor signature before parsing and must use the vendor event ID as `source_event_id`; vendor credentials stay only in Edge Function secrets. No vendor-specific code is part of this branch.

## Application architecture

Zod schemas define the settings, mapping, import request/result, normalized client-safe row diagnostics, UUID route input, and bounded HR/employee filters. Supabase query functions parse their input, TanStack Query hooks own cache/invalidation, and shared TypeScript types add the attendance records.

- `/hr/attendance` provides paginated, date/status/employee-filtered attendance history with safe loading, empty, and error states.
- `/hr/attendance/import` submits the template, shows validation/import results, and links to unmatched rows; it does not expose file contents after submission.
- `/hr/attendance/unmatched` lists unresolved IDs with safe timestamps and lets HR select an existing employee to create the mapping and resolve the event. Names may be shown as HR context after HR selects a record, but are never used to match automatically.
- `/employee/attendance` shows only the current employee’s date-filtered history and calculated statuses.
- `/admin/integrations/attendance` manages the non-secret CSV/XLSX configuration and presents the required template/download guidance plus the deferred-vendor readiness checklist.

Role layouts enforce the routes server-side. Invalid route IDs, stale changes, incorrect role, malformed file, unsupported spreadsheet, missing mapping, duplicate event, and Edge Function errors result in clear, non-sensitive messages.

## Testing and verification

- Unit tests cover schemas, ID normalization, time/status calculation around the 08:15 threshold, explicit absences, invalid timestamp ranges, malformed spreadsheets, missing headers, and identifier/name safety.
- Edge Function tests cover JWT/HR authorization, MIME/size/row limits, adapter output, absent-data rejection, safe diagnostics, idempotent duplicate replay, unmatched routing, and failure audit records.
- Query, hook, and component tests cover filter construction, cache invalidation, import outcomes, HR mapping resolution, employee-safe rendering, loading/empty/error states, and absence of admin/HR controls for employees.
- pgTAP/RLS tests prove HR’s allowed operations; employee self-only reads; denied cross-employee, Applicant, Management, and Administrator access to attendance logs; admin-only configuration; duplicate-event uniqueness; audit trail creation; and no biometric-named columns or metadata keys in the accepted contracts.
- Final verification runs the new migration and RLS tests against a fresh database, deploys the Edge Function with its secret only in the function runtime, validates a sample CSV and XLSX import exactly once, and runs lint, typecheck, tests, and production build.

## Deferred vendor replacement

A future branch may implement a documented vendor cloud API or webhook only after it has vendor documentation, a test credential/demo, stable employee-ID semantics, event-ID replay semantics, and a security review. It must retain this module’s normalized adapter interface and forbidden-biometric-data policy; it cannot add a direct browser-to-vendor path or store raw templates.
