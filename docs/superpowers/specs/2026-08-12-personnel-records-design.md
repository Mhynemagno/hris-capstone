# Personnel records and authentication experience design

**Branch:** `feat/05-personnel-records`  
**Date:** 2026-08-12

## Scope

This branch gives HR Personnel a searchable official employee-record workspace. HR can create and maintain employee profiles, service history, qualifications, certifications, and training records. Employees can read only their own official record. System Administrators, Applicants, and Management do not receive employee-record access in this branch.

It also refreshes every existing authentication page (`/login`, `/forgot-password`, `/reset-password`, and `/applicant/register`) without changing Supabase authentication behavior, redirects, or validation rules.

## User experience

### HR personnel records

- `/hr/employees` is an HR-only directory with a prominent “Add employee” action, debounced text search, department, position, and employment-status filters, and an accessible responsive table.
- `/hr/employees/new` collects the official profile and initial employment assignment. An optional link to a `profiles` row connects an employee account when one already exists; creating an employee does not create or activate an Auth user.
- `/hr/employees/[employeeId]` is the record overview. It shows identity, employment assignment, contact/emergency details, an HR-only edit action, and tabs for service history, qualifications, certifications, and training.
- `/hr/employees/[employeeId]/service-history` and `/hr/employees/[employeeId]/qualifications` remain direct deep links, as required by the roadmap. Certifications and training are managed from the overview tabs in this branch rather than adding unrequested top-level routes.
- Each record collection supports adding, editing, and removing an entry with an adjacent success/error state. Mutations invalidate the employee detail and directory queries.
- The employee landing page adds a read-only “My personnel record” summary/link for the signed-in employee. No employee-facing edit controls or official-field mutation endpoint is introduced.

### Authentication refresh

- One shared auth shell replaces the dark, undersized centered card. On desktop it pairs a quiet HRIS identity/assurance panel with a focused form panel; on mobile it collapses to a spacious single-column form.
- The visual system is professional and restrained: light slate background, white surfaces, high-contrast slate text, blue primary actions, green success feedback, consistent 8px-based spacing, and the existing Geist typeface.
- Forms retain visible labels, descriptive copy, field-level focus rings, 44px-or-taller controls, keyboard-friendly links, meaningful disabled states, and inline `aria-live` feedback. No decorative animation is required.

## Data model and access control

The migration adds the following exposed `public` tables, each with RLS enabled and explicit grants/policies:

| Table | Core columns and constraints | Access model |
| --- | --- | --- |
| `employees` | UUID primary key; optional unique `profile_id`; unique, normalized `employee_number`; names; contact and emergency details; `department_id`, `position_id`; official start/end dates; constrained employment status; timestamps | HR creates, reads, and updates. Employment status retires a record; this branch does not hard-delete an official employee record. An employee can select only the row whose `profile_id` equals their authenticated user id. |
| `service_history` | UUID primary key; employee FK; department/position references; start/end dates; employment details and notes; range check; timestamps | HR full CRUD; linked employee select-only. |
| `qualifications` | UUID primary key; employee FK; qualification name, institution, awarded date, optional field/level and notes; timestamps | HR full CRUD; linked employee select-only. |
| `certifications` | UUID primary key; employee FK; credential name, issuer, credential ID, issued/expiry dates, notes; expiry must not precede issue date | HR full CRUD; linked employee select-only. |
| `training_records` | UUID primary key; employee FK; course/provider, completion date, optional expiry date, hours and notes; valid date range/non-negative hours | HR full CRUD; linked employee select-only. |
| `employee_record_history` | UUID primary key; employee FK protected from deletion; actor user FK; record type/action; previous and next JSON snapshots; timestamp | HR can select. Inserts are trigger-owned; no browser role can update or delete history. |

All child rows use `on delete cascade` from `employees`, while official employee records are retained by status and their history foreign key prevents deletion. Department, position, and profile references preserve referential integrity. Indexes support the directory’s normalized employee-number/name search, department/position/status filtering, child-record employee lookups, and date ordering. Employee-owned select policies join through `employees.profile_id` and use `(select auth.uid())`; they never derive authorization from user metadata. HR policies use the existing `private.current_user_has_role('hr_personnel')` helper. Each `UPDATE` policy contains both `USING` and `WITH CHECK`.

`employee_record_history` is written by narrowly scoped, schema-qualified trigger functions for the employee and each child table. The history payload records the old/new values and authenticated actor without granting clients a way to forge history. No service-role credential is exposed to the browser.

## Application boundaries

- Shared Zod schemas validate employee, service history, qualification, certification, training, and directory-filter input in both forms and query functions.
- `src/queries/personnel-records.ts` contains RLS-protected Supabase query functions. `src/hooks` owns TanStack Query keys, pagination, and mutation invalidation.
- Focused personnel components own the directory filters/table, official-profile form, record tabs, and reusable record-entry forms. They use the existing UI primitives and retain route-guard enforcement through the HR layout.
- Authentication presentation is isolated in the shared auth shell/card and shared form-control classes so all four auth flows get the same improvement without duplicating markup or changing their auth calls.

## Error handling and validation

- Zod displays the first actionable form error without sending invalid data.
- Query and mutation failures remain visible in the screen context and preserve entered data where possible.
- Empty results explicitly distinguish “no employees yet” from “no matching employees.”
- Unknown or inaccessible employee IDs use the existing unauthorized/not-found route behavior; neither the UI nor RLS leaks another employee’s record.

## Tests and verification

- Unit tests cover schemas, date ranges, query inputs, tabs/forms, filters, loading/empty/error states, and mutation invalidation.
- Route tests prove HR may access the personnel pages while another authenticated role is denied.
- SQL/RLS tests prove HR CRUD access, own-employee select-only access, and denied cross-employee/other-role mutations for every table. History tests verify audit snapshots are generated and cannot be forged through the Data API.
- Authentication UI tests cover shared shell content, labels, focus-visible styling contracts, navigation links, and preserved sign-in/recovery/registration behavior.
- Final verification runs Supabase migration/RLS checks plus `npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build`.

## Explicit non-goals

- No employee self-service editing or profile-change approval workflow (branch 07).
- No account invitation/activation workflow changes (branch 04/08).
- No document uploads, deployments, promotion calculations, leave, attendance, notifications, dashboards, or applicant/recruitment features.
- No animation framework, external font dependency, or altered authentication security semantics.
