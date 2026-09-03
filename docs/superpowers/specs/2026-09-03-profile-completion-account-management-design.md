# Profile Completion and Account Management Design

**Branch:** `codex/profile-completion-account-management`
**Date:** 2026-09-03

## Goal

Finish the agreed employee-profile experience, remove the unsupported self-service address flow, provide HR controls for existing training records, and replace the duplicate Users/Roles screens with a single account-management workspace.

## Scope

### Unified account management

- `/admin/users` becomes the sole account-management page and navigation entry, labelled **Account management**.
- It continues to support invite, search, filter, edit role/status, delete account, and `View profile` for linked employee accounts.
- `/admin/roles` becomes a server-side redirect to `/admin/users` so saved links keep working but users do not see a second workspace.
- The account editor keeps role assignment alongside active/inactive status. Employee personal information remains outside the table and is available only through the existing read-only profile action.

### Employee profile photo

- Photos remain optional and are private. The current initials avatar stays visible when no photo is configured or its signed URL cannot be prepared.
- Only a linked employee can upload, replace, or remove their own photo from **My profile**. System Administrators remain read-only. HR’s existing official-record workflow remains separate.
- The browser validates PNG, JPEG, and WebP files at or below 5 MiB before upload, then uploads a generated UUID filename to `employee-profile-photos/employees/<employee-id>/`.
- A narrowly scoped, authenticated RPC updates only the caller’s `employees.profile_image_path`. It validates that the target path exactly belongs to the caller’s linked employee record. It cannot update another employee or any other employee column.
- After the RPC succeeds, the browser deletes the former file. If upload or RPC update fails, the old image path remains in the database. If cleanup fails, the new image stays in use and a non-blocking warning is shown.
- The profile loads a short-lived signed URL for `profile_image_path`; it never exposes a service-role credential or turns the bucket public.

### Simplified profile change request

- Employee self-service shows only personal email, phone, emergency-contact name, and emergency-contact phone.
- Address is removed from the client form and client schema. The database rejection remains as a defense-in-depth rule for forged or old payloads.
- Qualification proposals remain outside this change because they are an established approval workflow and do not alter the contact-data restriction.

### Training management

- The HR employee-record detail shows existing training entries with **Edit** and **Delete** actions.
- Edit uses the existing typed `savePersonnelEntry("training", input, id)` operation. Delete uses the existing typed `deletePersonnelEntry("training", id)` operation.
- The training form accepts prefilled values and includes course, provider, completed date, expiry date, hours, and notes. Employee and Administrator profile views remain read-only.

### Date-stable leave cleanup test

- The leave-upload cleanup test uses a date dynamically derived from the test runtime (or a fixed clock) so it tests the RPC-failure cleanup path every day rather than failing early on date validation.

## Security and authorization

- Existing `employees_select_system_administrator` and `training_records_select_system_administrator` policies continue to provide profile read access only.
- The new public RPC is intentionally `security definer`, pins `search_path = ''`, schema-qualifies every referenced relation, checks `auth.uid()`, checks the linked employee record, and validates the path before updating `profile_image_path`.
- Execution is revoked from `public` and `anon` and granted only to `authenticated`.
- Storage access remains private and policy-scoped; no direct writes occur to Storage tables.
- Database tests cover the employee allow path, cross-employee denial, invalid-path denial, and administrator read-only behavior.

## UI and error behavior

- The account workspace keeps the existing table, filters, dialogs, 44 px actions, and accessible labels; only its duplicated route/navigation is removed.
- The profile photo control has a labelled file input, upload/replace/remove actions, pending state, inline error/warning feedback, and an accessible fallback avatar.
- Removing a photo first clears the approved database path, then deletes the object. If deletion fails, the profile remains without a configured image and reports the cleanup warning; private orphan cleanup can be handled later without exposing data.
- Training deletion requires an explicit confirmation inside the existing panel/dialog pattern before the irreversible action runs.

## Tests and verification

- Component/query tests prove accepted/rejected photo files, photo upload ordering, signed URL rendering, replacement cleanup, and error fallback.
- Route/navigation tests prove Account management is the sole sidebar destination and `/admin/roles` redirects to `/admin/users`.
- Form tests prove Address is absent and the four contact fields remain submit-ready.
- Training tests prove add, edit, and delete behavior, including entry prefill and delete confirmation.
- SQL tests prove photo-path RPC allow/deny cases.
- Final checks: `npm run lint`, `npm run typecheck`, `npm run test:run`, `npx supabase test db`, and `npm run build`.

## Non-goals

- No public photo URLs or service-role browser credentials.
- No employee edits to rank, badge number, department, unit/station, employment status, position, or another employee’s record.
- No reintroduction of address collection in employee self-service.
- No role/permission model redesign beyond consolidating duplicate account-management navigation.
