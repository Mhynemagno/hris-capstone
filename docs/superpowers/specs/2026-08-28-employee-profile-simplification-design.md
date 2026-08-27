# Employee Profile Simplification Design

**Branch:** `codex/employee-profile-simplification`  
**Date:** 2026-08-28

## Purpose

Turn the existing personnel record into a concise, police-oriented employee profile that an administrator or HR user can open quickly and an employee can understand without exposing or collecting unnecessary personal data. The design takes visual inspiration only from the supplied reference: a clear identity header, optional photo, key service details, and focused actions. It does not copy its legacy layout or visual treatment.

## Decisions and scope

- **Users** remain sign-in accounts: email, active status, account role, invitation and account lifecycle.
- **Roles** remain authorization assignments: `Applicant`, `Admin`, and `Employee`. They do not own personal employee data and therefore do not get a profile-view action.
- The **Users** workspace gains a `View profile` action only when the account is linked to an employee record. It opens that employee’s official profile in read-only mode for System Administrators. Unlinked accounts display no misleading action.
- HR Personnel retain the existing official-record editing capability. System Administrators can inspect an employee profile but cannot silently alter official personnel fields from the Users workspace.
- Employees view their own profile, training records, and account-security action. Their personal contact and emergency-contact updates remain requests requiring System Administrator approval, preserving the existing audit and anti-overwrite workflow. Password changes are immediate through Supabase Auth and never visible to administrators.
- A profile photo is optional. The UI always has an accessible initials/avatar fallback and never requires an upload to create or use a profile.
- Existing historic columns and records are preserved. The new UI removes unneeded fields from normal data collection and display; it does not destructively erase already-held data.

## Minimum employee information

The primary profile and HR edit experience will collect and display only the details needed for personnel administration:

| Profile area | Fields | Notes |
| --- | --- | --- |
| Identity | optional profile photo, full name, badge number, rank | The current `employee_number` database value becomes the product label **Badge number**. It is not renamed because attendance, auditing, and existing records depend on it. |
| Assignment | department, unit/station, position, employment status | The active department catalogue is replaced with the client-approved entries from `Departments.txt`: Operations Division, Women and Children Protection Desk, and Administrative & Intelligence Division. Older department rows are retired (not deleted) to preserve historic references. `unit_station` is a concise optional assignment field. Position is retained where needed by promotions and historic records. |
| Contact | personal email, phone | Kept narrow and employee-visible. |
| Emergency | contact name, contact phone | Optional, available as one compact section. |
| Development | training records | Existing training records become a first-class profile section used by promotion eligibility. HR maintains the official entries; employees can read their own entries. |

The standard profile and creation/edit form will not request or surface place of birth, date of birth, sex, civil status, religion, or other unrelated personal information. Home address remains preserved if an older record already contains it, but is removed from the standard profile surface and from the employee self-service request flow for this feature.

## Data model and authorization

### Employee record additions

The `employees` table gains only two fields:

- `rank` — nullable text, constrained to the supplied Philippine National Police rank catalogue: PAT, PCpl, PSSg, PMSg, PSMS, PCMS, PEMS, PLT, PCPT, PMAJ, PLTCOL, PCOL, PBGEN, PMGEN, PLTGEN, and PGEN (stored as the supplied full display value to avoid ambiguous abbreviations).
- `unit_station` — nullable trimmed text, maximum 160 characters.

The existing `employee_number` remains the unique operational identifier and is labelled “Badge number” in the product. A new `profile_image_path` field stores only the controlled Storage object path, never a public URL.

### Private profile photos

A non-public `employee-profile-photos` Storage bucket holds image files at `employees/<employee-id>/<uuid>.<extension>`. Allowed types are PNG, JPEG, and WebP; file size is capped at 5 MB. Browser access is granted only to the linked employee, HR Personnel, and System Administrators. The UI uses a short-lived signed URL, preserves a stable fallback avatar while loading, and removes the old object after a successful replacement. The client never receives a service-role credential.

### RLS and audit behavior

- Existing employee-owned `SELECT` access continues to apply only where `employees.profile_id = auth.uid()`.
- HR Personnel retain official employee CRUD, training management, and related record access.
- System Administrators gain read-only access to employee profiles, relevant rank/assignment information, and training records so `View profile` works from Users without granting employee-data mutation rights.
- Employee self-service continues to submit only personal email, phone, emergency-contact name, and emergency-contact phone to the current protected profile-change request workflow. The allowed-field constraint drops address for new requests, while historic requests remain readable.
- Profile-photo uploads are restricted by Storage policies and object path ownership; they do not grant an employee access to any other employee profile.
- Employee-record history and audit logs capture official staff changes as they do today. Account password changes are handled by Supabase Auth and are not added to personnel history.

## Experience design

### Shared profile layout

The desktop page uses a calm authority-oriented service layout rather than the reference’s dated dashboard chrome: a responsive identity header, a concise two-column facts grid, and grouped cards below it. At 375 px it becomes a single column with full-width actions. It uses existing product tokens, Lucide icons, visible keyboard focus, 44 px minimum interactive targets, explicit labels, status feedback, and reduced-motion-safe 150–300 ms interaction transitions.

1. **Identity header:** avatar/photo, full name, rank, badge number, assignment chips, and role/status badge.
2. **Actions:** contextual `Edit profile` for HR, `Request profile change` for the linked employee, `Change password` for the linked employee only, plus `View profile` entry from Users. A System Administrator sees no password or direct-personnel-edit action.
3. **Profile details:** contact and emergency-contact cards; absent optional data is rendered as “Not provided”, not blank fields.
4. **Training:** a readable training timeline/list with course, provider, completion date, optional expiry, hours, and notes. HR gets add/edit/delete controls; employees and System Administrators get read-only presentation.

### Users and Roles workspaces

The Users table keeps edit and delete controls and adds a clearly named `View profile` button for a linked employee. This opens the profile detail route in an administrator-safe read-only state. The Roles page continues to list accounts and their assigned permissions, but its language and controls are clarified as role-management rather than a duplicate employee directory. Personal employee data is never rendered inside a role assignment panel.

### Employee self-service

`/employee/profile` adopts the shared profile layout. The employee can inspect their official summary and training records, upload or replace their optional photo, submit the limited contact/emergency update request, see pending/recent requests, and open a dedicated password-change form. The password form requires the new password and confirmation, gives inline accessible validation and completion feedback, and uses the existing authenticated Supabase client session.

## Application boundaries

- **Schemas and types:** expand the employee contract with rank, unit/station, and controlled image-path data. Add narrow client validation for photo metadata and password confirmation. Centralize the rank catalogue so forms, display, and tests use one source of truth.
- **Queries and hooks:** add typed, RLS-protected operations for profile photo storage, profile detail lookup, current user profile summary/training lookup, and linked-employee lookup for managed users. Existing query invalidation refreshes the directory, profile, and account view after an official update or photo replacement.
- **Components:** split identity display, facts grid, action rail, training list, and profile-photo controls into focused reusable personnel components. Keep the User management table responsible for account actions and link it to the profile route instead of duplicating profile fields.
- **Routes:** retain HR employee detail deep links, add a separate administrator-safe route at `/admin/users/[userId]/profile` which resolves only the linked employee account, and add an employee account-security route. Routes remain server components unless client interaction is needed; client components use the existing browser Supabase client and TanStack Query pattern.

## Error handling and edge cases

- An unlinked account has no profile target; `View profile` is absent.
- An inaccessible, malformed, or missing employee ID renders the existing safe error/unauthorized behavior without leaking another employee’s data.
- Upload failures retain the previous image and show an actionable in-context error. Unsupported type/size never starts an upload.
- Any failed profile-change submission preserves entered values. Employee changes cannot be applied directly by manipulating browser payloads.
- An employee with no training records sees a clear empty state; a profile remains useful without a photo, phone, emergency contact, rank, or unit/station.
- Password failures show an accessible error without exposing password values or logging them.

## Testing and verification

- Component tests cover identity fallback/photo presentation, the responsive profile actions, contact/emergency empty states, training presentation, and the Users table’s linked/unlinked view action.
- Schema and query tests cover rank acceptance/rejection, unit/station bounds, image validation, profile-change field restrictions, and scoped profile lookups.
- Route tests prove HR can edit, System Administrators can only view from Users, employees can view only their own profile and security form, and unauthorized roles cannot read another employee’s data.
- SQL/RLS tests prove every Storage and database allow/deny path: owner/HR/Admin reads, owner/HR photo write rules, no cross-employee Storage access, employee self-service restriction to the four approved contact fields, and read-only Admin access to trainings.
- Final verification runs the Supabase database test suite, `npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build`, with responsive manual checks at 375 px, 768 px, 1024 px, and 1440 px.

## Explicit non-goals

- No migration or deletion of historic personal data solely for UI simplification.
- No employee ability to edit rank, badge number, department, unit/station, employment status, position, official training, or another employee’s data.
- No role-permission redesign beyond clarifying the Users versus Roles surfaces.
- No public profile images, public employee directory, external photo hosting, biometric data, new social identity fields, or email/password visibility for administrators.
