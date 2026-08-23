# Profile Change Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure employee profile-change request workflow for contact details and qualifications, with System Administrator approval, audit history, private documents, and decision notifications.

**Architecture:** Browser code validates and submits a request proposal, then reads only records allowed by RLS. A security-definer database workflow owns every status transition and makes approval atomic: it locks a pending request, validates snapshots, updates official employee/qualification records, writes history and audit data, and creates the existing in-app notification in one transaction. Pages use shared query functions and TanStack Query hooks; no service-role credential or Edge Function is required.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind/shadcn UI, React Hook Form, Zod 4, TanStack Query 5, Supabase PostgreSQL/Auth/Storage/RLS, pgTAP, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-23-profile-change-approval-design.md`

## Global Constraints

- Use branch `feat/08-profile-change-approval` based on merged `main` containing `feat/07-notifications`.
- Employees never directly update `public.employees` or `public.qualifications`; official data changes only after a System Administrator approves a request.
- Use shared Zod schemas at every browser form, URL/query, and RPC boundary; database procedures must independently enforce ownership, allowed JSON shapes, record matching, and state transitions.
- Use browser Supabase clients only with the publishable key. Never expose `service_role`, `SUPABASE_SECRET_KEY`, or a server credential in `src/`.
- All new public tables and Storage access paths require RLS, least-privilege grants/policies, and permitted/denied pgTAP coverage.
- Keep documents in the existing private `private-documents` bucket under `profile-change-requests/<auth-user-id>/<request-id>/<random-file-id>`; accept only PDF, PNG, JPEG, and WEBP, at most 10 files and 10 MiB each.
- Request statuses are `pending`, `approved`, `rejected`, and `cancelled`; only the owning employee may cancel and only while pending.
- The full request is decided atomically. A stale contact field or qualification snapshot aborts approval without updating any official data, history, audit log, or notification.
- System Administrators approve/reject; HR Personnel, Management, Applicants, and Employees cannot decide profile-change requests.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/schemas/profile-change-requests.ts` | Zod contracts and inferred input/filter types for contact, qualification, document, submission, cancellation, and decision payloads. |
| `src/lib/types/database.ts` | TypeScript representations of request headers, proposed changes, documents, and request history returned by Supabase. |
| `src/lib/query-keys.ts` | Stable employee and administrator cache keys for request data. |
| CLI-generated `supabase/migrations/*_profile_change_approval.sql` | Tables, indexes, RLS policies, private transactional procedures/public RPCs, and narrow private-document Storage policies. |
| `supabase/tests/profile_change_approval.test.sql` | pgTAP tests for schema, RLS, state transitions, stale protection, official updates, audit data, and notifications. |
| `src/queries/profile-change-requests.ts` | Browser Supabase selects, Storage upload, and RPC calls; no authorization logic is duplicated here. |
| `src/hooks/use-profile-change-requests.ts` | TanStack Query reads/mutations and complete invalidation rules. |
| `src/components/profile-change-requests/*` | Focused employee submission/history and administrator queue/review components. |
| `src/app/(app)/employee/profile/**` | Protected employee profile, submission, and request-history routes. |
| `src/app/(app)/admin/profile-change-requests/**` | Protected administrator queue and request-detail routes. |
| `src/lib/app/role-config.ts` and app-shell tests | Navigation entries for employee profile changes and administrator review. |

### Task 1: Define the shared profile-change contracts and cache keys

**Files:**
- Create: `src/schemas/profile-change-requests.ts`
- Create: `src/schemas/profile-change-requests.test.ts`
- Modify: `src/schemas/index.ts`
- Modify: `src/lib/types/database.ts`
- Modify: `src/lib/query-keys.ts`
- Modify: `src/lib/query-keys.test.ts`

**Interfaces:**
- Produces `profileChangeDraftSchema`, `profileChangeSubmissionSchema`, `profileChangeRequestFiltersSchema`, `profileChangeDecisionSchema`, `profileChangeCancellationSchema`, `profileChangeContactChangeSchema`, `profileChangeDocumentSchema`, and inferred input types.
- Produces `ProfileChangeRequest`, `ProfileChangeRequestChange`, `ProfileChangeRequestDocument`, and `ProfileChangeRequestHistory` database types.
- Produces `queryKeys.profileChangeRequests.mine(filters)`, `.detail(requestId)`, and `.adminQueue(filters)`.

- [ ] **Step 1: Write failing schema and cache-key tests**

```ts
it("accepts contact, qualification add/edit/remove, and private document metadata", () => {
  const parsed = profileChangeSubmissionSchema.parse({
    requestId: "123e4567-e89b-42d3-a456-426614174000",
    note: "New contact details and qualification correction.",
    changes: [
      { kind: "contact", field: "phone", originalValue: "+976 111", requestedValue: "+976 222" },
      { kind: "qualification", operation: "edit", qualificationId: "123e4567-e89b-42d3-a456-426614174001", originalValue: qualification, requestedValue: { ...qualification, institution: "Updated academy" } },
    ],
    documents: [{ objectPath: "profile-change-requests/123e4567-e89b-42d3-a456-426614174002/123e4567-e89b-42d3-a456-426614174000/123e4567-e89b-42d3-a456-426614174003.pdf", fileName: "evidence.pdf", mimeType: "application/pdf", sizeBytes: 1024 }],
  });
  expect(parsed.changes).toHaveLength(2);
});

it("rejects an empty request, a protected field, invalid qualification snapshots, and unsafe files", () => {
  expect(profileChangeSubmissionSchema.safeParse({ requestId, changes: [], documents: [] }).success).toBe(false);
  expect(profileChangeContactChangeSchema.safeParse({ field: "employmentStatus", originalValue: "active", requestedValue: "inactive" }).success).toBe(false);
  expect(profileChangeDocumentSchema.safeParse({ objectPath: "private-documents/other.pdf", fileName: "x.exe", mimeType: "application/x-msdownload", sizeBytes: 1 }).success).toBe(false);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:run -- src/schemas/profile-change-requests.test.ts src/lib/query-keys.test.ts`

Expected: FAIL because profile-change schemas and cache keys do not exist.

- [ ] **Step 3: Implement the contracts and exports**

Use these exact discriminated change shapes and preserve the existing camelCase browser / snake_case database convention. `profileChangeDraftSchema` accepts `{ note?, changes }` from the form. The form adds a generated request ID before upload; the query layer creates validated document metadata after upload, then validates the complete RPC payload with `profileChangeSubmissionSchema`.

```ts
export const profileChangeSubmissionSchema = z.object({
  requestId: uuidSchema,
  note: z.string().trim().max(2000).optional(),
  changes: z.array(profileChangeChangeSchema).min(1).max(20),
  documents: z.array(profileChangeDocumentSchema).max(10),
});

export const profileChangeDecisionSchema = z.object({
  requestId: uuidSchema,
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (value.decision === "rejected" && !value.reason) context.addIssue({ code: "custom", path: ["reason"], message: "Provide a reason when rejecting a request." });
});
```

Allow contact fields only `personalEmail`, `phone`, `address`, `emergencyContactName`, and `emergencyContactPhone`. Require add changes to have `originalValue: null` and no target ID; require edit/remove changes to have both a target qualification ID and full original snapshot; require remove changes to have `requestedValue: null`. Make request filters include a bounded page/pageSize, optional status, and trimmed search text. Add the new contract exports to `src/schemas/index.ts`, record types to `src/lib/types/database.ts`, and profile-change cache keys to `src/lib/query-keys.ts`.

- [ ] **Step 4: Run focused contract tests**

Run: `npm run test:run -- src/schemas/profile-change-requests.test.ts src/lib/query-keys.test.ts`

Expected: PASS; normalized text and valid shapes parse, every invalid state in Step 1 fails, and the new cache keys are stable.

- [ ] **Step 5: Commit the contracts**

```bash
git add src/schemas src/lib/types/database.ts src/lib/query-keys.ts src/lib/query-keys.test.ts
git commit -m "feat: add profile change request contracts"
```

### Task 2: Create the secure transactional database workflow and RLS regression suite

**Files:**
- Create: the CLI-generated `supabase/migrations/*_profile_change_approval.sql` file produced by `npx supabase@latest migration new profile_change_approval`
- Create: `supabase/tests/profile_change_approval.test.sql`

**Interfaces:**
- Produces tables `profile_change_requests`, `profile_change_request_changes`, `profile_change_request_documents`, and `profile_change_request_history`.
- Produces authenticated RPCs `submit_profile_change_request(target_request_id uuid, request_note text, requested_changes jsonb, requested_documents jsonb)`, `cancel_profile_change_request(target_request_id uuid)`, and `decide_profile_change_request(target_request_id uuid, requested_decision text, requested_reason text)`.
- Consumes `private.current_user_has_role(public.app_role)`, existing `employees`, `qualifications`, `audit_logs`, `notifications`, and `storage.objects`.

- [ ] **Step 1: Write failing pgTAP assertions before the migration**

```sql
select extensions.has_table('public', 'profile_change_requests', 'Profile change requests table exists');
select extensions.has_function('public', 'submit_profile_change_request', array['uuid', 'text', 'jsonb', 'jsonb'], 'Submission RPC exists');
select extensions.throws_ok(
  $$update public.employees set phone = '+976 222' where id = '00000000-0000-0000-0000-000000000010'$$,
  '42501', null, 'Employee cannot directly alter official contact data'
);
```

Create fixtures for an active System Administrator, HR Personnel, Employee, and unrelated Employee. Link the two employee users to separate official records, seed an existing qualification for the requesting employee, and set `request.jwt.claim.sub` for each role before each authorization assertion.

- [ ] **Step 2: Run the database test to verify it fails**

Run: `npx supabase@latest test db --linked supabase/tests/profile_change_approval.test.sql`

Expected: FAIL because the migration and its functions do not exist.

- [ ] **Step 3: Generate and implement the migration**

Run `npx supabase@latest migration new profile_change_approval`, then edit the generated file. Create the tables with check constraints, foreign keys, timestamps, and these indexes:

```sql
create index profile_change_requests_employee_created_idx
  on public.profile_change_requests (employee_id, created_at desc);
create index profile_change_requests_review_queue_idx
  on public.profile_change_requests (status, created_at asc);
create index profile_change_request_changes_request_idx
  on public.profile_change_request_changes (request_id, ordinal);
create index profile_change_request_history_request_idx
  on public.profile_change_request_history (request_id, created_at asc);
```

Keep public table grants read-only: employees select only rows linked to their own `employees.profile_id`; administrators select all; no direct browser inserts/updates/deletes are granted. Put the privileged implementations in the `private` schema with `security definer`, `set search_path = ''`, explicit `auth.uid()` checks, and no `PUBLIC` execute grant. Add thin `public` RPC wrappers, revoke from `anon`, and grant execute only to `authenticated`.

In `private.submit_profile_change_request`, require that the caller owns a linked employee record, reject any unknown contact key, unsupported qualification operation, malformed JSON, duplicate targeted qualification, invalid attachment path, non-existent Storage object, or document whose `owner_id` does not equal the caller. Insert the request, ordered changes, document metadata, and a `submitted` history event in one transaction.

In `private.cancel_profile_change_request`, lock the request `for update`, require employee ownership and `pending`, set `cancelled`, and append `cancelled` history. In `private.decide_profile_change_request`, require an active administrator, lock the row, require `pending`, test each saved original snapshot against current official data, make every requested employee/qualification change, set the decision data, append history, insert an `audit_logs` row with `entity_type = 'profile_change_requests'`, and insert a `notifications` row of type `profile_change_decision` linking to `/employee/profile/change-requests`. A stale snapshot must raise an error before any change occurs.

Add Storage policies that allow an employee to insert and read only `private-documents` keys matching `profile-change-requests/<auth.uid()>/<uuid>/<uuid>.<extension>` and retain the existing administrator management policy. Do not grant employees broad Storage update/delete rights.

- [ ] **Step 4: Complete the pgTAP coverage**

Add assertions for all of these concrete journeys:

```sql
-- Employee submits contact + qualification add/edit/remove proposals; official rows remain unchanged.
select extensions.lives_ok($$select public.submit_profile_change_request(...)$$, 'Employee submits own request');
-- Other employee cannot see request or submit/cancel against it.
-- HR, Management, Applicant, and Employee receive 42501 when deciding a request.
-- Employee cancels once; a second cancellation and any administrator decision on it fail.
-- Administrator approval updates phone, inserts one qualification, edits one, removes one,
-- creates request history/audit/notification rows, and marks status approved.
-- Rejection preserves official employee and qualification values, persists non-empty reason,
-- writes decision history/audit/notification rows, and marks status rejected.
-- Alter a proposed contact value after submission, then assert approval throws and no partial output rows change.
```

Also test anonymous table/RPC denial, cross-user document metadata denial, direct table update denial for both employees and administrators, and that notifications belong only to the employee recipient.

- [ ] **Step 5: Run migration and database tests**

Run:

```bash
npx supabase@latest migration list --local
npx supabase@latest test db --linked supabase/tests/profile_change_approval.test.sql
```

Expected: the generated migration is listed and every pgTAP assertion passes on a clean test database.

- [ ] **Step 6: Commit the database workflow**

```bash
git add supabase/migrations supabase/tests/profile_change_approval.test.sql
git commit -m "feat: add secure profile change approval workflow"
```

### Task 3: Build the browser query layer, uploads, and query invalidation

**Files:**
- Create: `src/queries/profile-change-requests.ts`
- Create: `src/queries/profile-change-requests.test.ts`
- Create: `src/hooks/use-profile-change-requests.ts`
- Create: `src/hooks/use-profile-change-requests.test.tsx`
- Modify: `src/hooks/index.ts`

**Interfaces:**
- Produces `getMyProfileChangeRequests`, `getProfileChangeRequest`, `getAdminProfileChangeRequests`, `getProfileChangeDocumentUrl`, `submitProfileChangeRequest(draftWithRequestId, files)`, `cancelProfileChangeRequest`, `decideProfileChangeRequest`, and `uploadProfileChangeDocuments`.
- Produces `useMyProfileChangeRequests`, `useProfileChangeRequest`, `useAdminProfileChangeRequests`, `useSubmitProfileChangeRequest`, `useCancelProfileChangeRequest`, and `useDecideProfileChangeRequest`.
- Consumes Task 1 contracts, Task 2 RPCs, request types, and `queryKeys.profileChangeRequests`.

- [ ] **Step 1: Write failing query and hook tests**

```ts
it("uploads only normalized documents then submits through the narrow RPC", async () => {
  await submitProfileChangeRequest({ requestId, note: "Evidence attached", changes }, [file]);
  expect(storage.from).toHaveBeenCalledWith("private-documents");
  expect(rpc).toHaveBeenCalledWith("submit_profile_change_request", {
    target_request_id: requestId,
    request_note: "Evidence attached",
    requested_changes: expect.any(Array),
    requested_documents: expect.any(Array),
  });
});

it("invalidates profile, qualification, request, admin queue, audit, and notification data after approval", async () => {
  await result.current.mutateAsync({ requestId, decision: "approved" });
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["administration", "audit-logs"] });
});

it("creates a short-lived private document URL only for a validated request object path", async () => {
  await expect(getProfileChangeDocumentUrl(document.object_path)).resolves.toBe("https://signed.example/evidence.pdf");
  expect(storage.from).toHaveBeenCalledWith("private-documents");
  expect(createSignedUrl).toHaveBeenCalledWith(document.object_path, 60);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm run test:run -- src/queries/profile-change-requests.test.ts src/hooks/use-profile-change-requests.test.tsx`

Expected: FAIL because the query functions and hooks do not exist.

- [ ] **Step 3: Implement read, upload, and mutation functions**

Parse every public input before use. List data newest-first and paginate it with exact counts. Select request children, documents, and history by request ID only after parsing the UUID. For administrator detail, retrieve the corresponding official employee record and each targeted qualification so the UI can show the live current value alongside the saved original/proposed snapshots. `getProfileChangeDocumentUrl` parses the stored path and calls `storage.from("private-documents").createSignedUrl(path, 60)`; it returns no URL when Storage denies access. `submitProfileChangeRequest(draftWithRequestId, files)` validates the draft and request UUID, uploads each Zod-validated `File` to the required generated path with `contentType` and `upsert: false`, builds and validates `profileChangeSubmissionSchema`, then calls the submission RPC. If any upload fails, surface the error and do not call the submission RPC. Map browser camelCase contract fields to the RPC's expected JSON keys deliberately rather than spreading arbitrary form data.

```ts
const { error } = await createBrowserSupabaseClient().rpc("decide_profile_change_request", {
  target_request_id: parsed.requestId,
  requested_decision: parsed.decision,
  requested_reason: parsed.reason ?? null,
});
if (error) throw new Error(error.message);
```

Keep document removal out of this browser layer; cancelled request files remain private for administrative retention.

- [ ] **Step 4: Implement hooks with complete cache invalidation**

Use `useQuery` for each list/detail and `useMutation` for each state-changing RPC. On successful submission/cancellation invalidate the employee request list/detail and employee profile. On a successful decision also invalidate the affected employee profile, that employee's qualifications, all administrator queues/detail, `administration.auditLogs`, and the entire `notifications` namespace. Do not copy server records into Zustand or component state.

- [ ] **Step 5: Run focused data-layer tests**

Run: `npm run test:run -- src/queries/profile-change-requests.test.ts src/hooks/use-profile-change-requests.test.tsx`

Expected: PASS; RPC arguments are exact, errors surface, documents use only the private path, and each mutation invalidates its affected views.

- [ ] **Step 6: Commit the browser data layer**

```bash
git add src/queries/profile-change-requests.ts src/queries/profile-change-requests.test.ts src/hooks/use-profile-change-requests.ts src/hooks/use-profile-change-requests.test.tsx src/hooks/index.ts
git commit -m "feat: add profile change request data layer"
```

### Task 4: Deliver the employee profile-change pages and request history

**Files:**
- Create: `src/components/profile-change-requests/profile-change-request-form.tsx`
- Create: `src/components/profile-change-requests/profile-change-request-form.test.tsx`
- Create: `src/components/profile-change-requests/my-profile-change-requests.tsx`
- Create: `src/components/profile-change-requests/my-profile-change-requests.test.tsx`
- Create: `src/app/(app)/employee/profile/page.tsx`
- Create: `src/app/(app)/employee/profile/change-request/page.tsx`
- Create: `src/app/(app)/employee/profile/change-requests/page.tsx`
- Modify: `src/app/(app)/employee/page.tsx`
- Modify: `src/components/personnel-records/employee-record-summary.tsx`

**Interfaces:**
- Consumes Task 3 employee hooks and Task 1 submission contracts.
- Produces employee routes for official profile, request submission, and request history.
- Submits the exact `ProfileChangeSubmissionInput` shape; displays only request data returned through RLS.

- [ ] **Step 1: Write failing employee component and route tests**

```tsx
it("submits a contact update and qualification edit without changing the official profile in the form", async () => {
  render(<ProfileChangeRequestForm employee={employee} qualifications={[qualification]} />);
  await user.clear(screen.getByLabelText("Phone"));
  await user.type(screen.getByLabelText("Phone"), "+976 222");
  await user.click(screen.getByRole("button", { name: "Submit request" }));
  expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ changes: expect.arrayContaining([expect.objectContaining({ field: "phone" })]) }));
});

it("shows Cancel only for the current employee's pending request", () => {
  render(<MyProfileChangeRequests />);
  expect(screen.getByRole("button", { name: "Cancel request" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Cancel rejected request" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run employee tests to verify they fail**

Run: `npm run test:run -- src/components/profile-change-requests/profile-change-request-form.test.tsx src/components/profile-change-requests/my-profile-change-requests.test.tsx`

Expected: FAIL because the employee components and new routes do not exist.

- [ ] **Step 3: Implement the submission form**

Use React Hook Form with `zodResolver(profileChangeDraftSchema)`. Prefill contact controls from the official `Employee` record but build changes only for values the employee actually alters. Render the employee's current qualifications and explicit Add, Edit, and Remove proposal controls; do not call existing `savePersonnelEntry` or `deletePersonnelEntry`. Accept at most ten validated files, generate `requestId` with `crypto.randomUUID()` immediately before upload, and call `useSubmitProfileChangeRequest({ requestId, note, changes }, files)` only after a non-empty proposal validates. Show a clear explanation that official data remains unchanged until administrator approval.

- [ ] **Step 4: Implement profile and history views**

Reuse `EmployeeRecordSummary` for the official record at `/employee/profile`, then add links to `/employee/profile/change-request` and `/employee/profile/change-requests`. Keep `/employee` as an employee-workspace landing page that links to the new profile route rather than removing the existing summary unexpectedly. In the history component render status badge, submitted/decided timestamps, proposed original/requested values, document links created through `getProfileChangeDocumentUrl`, event history, decision reason, and one pending-only cancel button. Use existing `LoadingState`, `ErrorState`, `EmptyTableState`, `Card`, `Badge`, and `Button` components for every async state.

- [ ] **Step 5: Run employee UI tests**

Run: `npm run test:run -- src/components/profile-change-requests/profile-change-request-form.test.tsx src/components/profile-change-requests/my-profile-change-requests.test.tsx src/components/personnel-records/personnel-records.test.tsx`

Expected: PASS; the form validates and submits a proposal, the official summary remains read-only, and cancellation is not rendered for non-pending requests.

- [ ] **Step 6: Commit the employee experience**

```bash
git add src/components/profile-change-requests src/app/(app)/employee src/components/personnel-records/employee-record-summary.tsx
git commit -m "feat: add employee profile change requests"
```

### Task 5: Deliver administrator review pages, protected navigation, and decisions

**Files:**
- Create: `src/components/profile-change-requests/admin-profile-change-request-queue.tsx`
- Create: `src/components/profile-change-requests/admin-profile-change-request-queue.test.tsx`
- Create: `src/components/profile-change-requests/admin-profile-change-request-detail.tsx`
- Create: `src/components/profile-change-requests/admin-profile-change-request-detail.test.tsx`
- Create: `src/app/(app)/admin/profile-change-requests/page.tsx`
- Create: `src/app/(app)/admin/profile-change-requests/[requestId]/page.tsx`
- Modify: `src/lib/app/role-config.ts`
- Modify: `src/lib/app/role-config.test.ts`
- Modify: `src/components/app-shell/app-shell.tsx`
- Modify: `src/components/app-shell/app-shell.test.tsx`

**Interfaces:**
- Consumes Task 3 administrator query/detail hooks and Task 1 `profileChangeDecisionSchema`.
- Produces `/admin/profile-change-requests` and `/admin/profile-change-requests/[requestId]`, protected by the existing System Administrator layout.
- Adds role-navigation items `{ href: "/employee/profile", label: "My profile", icon: "ContactRound" }` and `{ href: "/admin/profile-change-requests", label: "Profile change requests", icon: "ClipboardCheck" }`.

- [ ] **Step 1: Write failing administrator and navigation tests**

```tsx
it("shows a pending request in the queue and opens its review route", async () => {
  render(<AdminProfileChangeRequestQueue />);
  await user.click(screen.getByRole("link", { name: "Review request" }));
  expect(screen.getByRole("link", { name: "Review request" })).toHaveAttribute("href", `/admin/profile-change-requests/${requestId}`);
});

it("requires a reason to reject and sends an approved decision through the mutation", async () => {
  render(<AdminProfileChangeRequestDetail requestId={requestId} />);
  await user.click(screen.getByRole("button", { name: "Reject request" }));
  expect(screen.getByText("Provide a reason when rejecting a request.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Approve request" }));
  expect(mocks.decide).toHaveBeenCalledWith({ requestId, decision: "approved" });
});
```

- [ ] **Step 2: Run administrator tests to verify they fail**

Run: `npm run test:run -- src/components/profile-change-requests/admin-profile-change-request-queue.test.tsx src/components/profile-change-requests/admin-profile-change-request-detail.test.tsx src/lib/app/role-config.test.ts src/components/app-shell/app-shell.test.tsx`

Expected: FAIL because the review components, routes, and navigation entries do not exist.

- [ ] **Step 3: Implement the queue and detail screens**

The queue has status and text filters, pagination, loading/error/empty states, and a direct review link per row. The detail route parses `requestId` with `uuidSchema` and calls `notFound()` for invalid IDs. The detail component presents original, current, and requested values side-by-side, including explicit qualification add/edit/remove labels; lists authorized document links and request history; and makes approve/reject controls available only while the returned status is pending. Use a confirmation dialog before invoking approval because it updates official data.

For rejection, use React Hook Form plus `profileChangeDecisionSchema` to require a non-empty reason. For approval, submit `{ requestId, decision: "approved" }`. Surface RPC errors, especially stale-request errors, with `ErrorState`; after a successful decision, return to the queue and let Task 3 invalidation refresh all affected data.

- [ ] **Step 4: Update navigation and protected routes**

Extend `RoleNavigationItem["icon"]` and the icon lookup in `AppShell` to support `ClipboardCheck`, then add the employee and System Administrator entries defined above. Do not add the administrator queue to any other role. Rely on the existing `/employee` and `/admin` nested layouts' `requireRole` calls; add targeted route/layout tests if a direct invalid-role visit is not already covered.

- [ ] **Step 5: Run administrator and navigation tests**

Run: `npm run test:run -- src/components/profile-change-requests/admin-profile-change-request-queue.test.tsx src/components/profile-change-requests/admin-profile-change-request-detail.test.tsx src/lib/app/role-config.test.ts src/components/app-shell/app-shell.test.tsx`

Expected: PASS; filters and review links work, rejection requires a reason, approval invokes the correct decision, invalid UUID routes are not found, and only the intended roles see the navigation entries.

- [ ] **Step 6: Commit the administrator experience**

```bash
git add src/components/profile-change-requests src/app/(app)/admin/profile-change-requests src/lib/app/role-config.ts src/lib/app/role-config.test.ts src/components/app-shell
git commit -m "feat: add profile change approval review"
```

### Task 6: Verify the complete feature and document operational checks

**Files:**
- Modify only if verification exposes a profile-change-specific defect: the affected Task 1–5 implementation and its focused test.

**Interfaces:**
- Verifies every contract and route from Tasks 1–5 against the approved design.

- [ ] **Step 1: Run the full focused application suite**

Run:

```bash
npm run test:run -- src/schemas/profile-change-requests.test.ts src/queries/profile-change-requests.test.ts src/hooks/use-profile-change-requests.test.tsx src/components/profile-change-requests/profile-change-request-form.test.tsx src/components/profile-change-requests/my-profile-change-requests.test.tsx src/components/profile-change-requests/admin-profile-change-request-queue.test.tsx src/components/profile-change-requests/admin-profile-change-request-detail.test.tsx src/lib/app/role-config.test.ts src/components/app-shell/app-shell.test.tsx
```

Expected: PASS; contracts, data access, employee submission/history/cancellation, administrator decisions, and navigation all work under test.

- [ ] **Step 2: Run migration/RLS workflow verification**

Run:

```bash
npx supabase@latest migration list --local
npx supabase@latest test db --linked supabase/tests/profile_change_approval.test.sql
```

Expected: the migration applies cleanly; the pgTAP suite proves submit → unchanged official record → approve/reject → history/audit/notification, plus all denied-role paths.

- [ ] **Step 3: Run repository-wide checks**

Run:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Expected: every command exits with status 0.

- [ ] **Step 4: Inspect the release diff and security boundary**

Run:

```bash
git diff main...HEAD --check
git status --short
rg -n "service_role|SUPABASE_SECRET_KEY|NEXT_PUBLIC_.*(SECRET|SERVICE)" src docs
```

Expected: no whitespace errors, no untracked environment/secrets, and no secret exposed to browser code. Manually inspect that Storage policies constrain employee keys to the expected profile-change prefix and that direct employee writes to official records remain denied.

- [ ] **Step 5: Commit any verification-only corrections**

```bash
git add src supabase docs
git commit -m "fix: verify profile change approval workflow"
```

Skip this commit if verification requires no correction.
