# Leave Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Deliver secure employee leave requests with HR-managed types, private attachments, cancellation, decisions, history, audit events, and in-app decision notifications.

**Architecture:** The Supabase leave subsystem holds normalized types, requests, attachments, and immutable history. Browser code validates with Zod, reads/mutates through the existing Supabase client/TanStack Query pattern, and database RPCs enforce authorization, attachment rules, transitions, audit records, and notifications atomically.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind/shadcn UI, Zod 4, TanStack Query 5, Supabase PostgreSQL/Auth/Storage/RLS, pgTAP, Vitest.

**Spec:** \`docs/superpowers/specs/2026-08-24-leave-management-design.md\`

## Global Constraints

- Work only on \`feat/11-leave-management\`, created from task 10's merged \`main\`.
- Use inclusive full-day ranges beginning today or later. Do not implement partial days, retroactive requests, accruals, balances, payroll, or multi-level approvals.
- HR Personnel alone create/edit/activate/deactivate types and decide requests. An employee owns only their requests and can cancel only a pending one. All other roles receive no leave-data access.
- Rejections require a reason; approvals may have an optional note. Never hard-delete an in-use leave type.
- Validate every browser, filter, route, and RPC input with shared Zod contracts. Database workflows independently enforce caller role, ownership, Storage-object ownership, active type, attachment requirement, dates, and transitions.
- All public tables and private Storage paths need RLS, least-privilege grants/policies, and pgTAP allow/deny coverage. Never expose a service-role credential.
- Use \`private-documents\` keys of \`leave-requests/<auth-user-id>/<request-id>/<random-file-id>.<extension>\`; accept up to 10 PDF/PNG/JPEG/WEBP files of 10 MiB each.
- A successful HR decision writes request state, history, \`audit_logs\`, and an employee \`notifications\` record in one transaction.

---

## File structure

| File | Responsibility |
| --- | --- |
| \`src/schemas/leave-management.ts\` | Status, type, request, filter, attachment, cancellation, and decision contracts. |
| \`src/lib/types/database.ts\` | Leave type, request, attachment, and history projections. |
| \`src/lib/query-keys.ts\` | Employee, HR, type, request, and attachment keys. |
| CLI-generated \`supabase/migrations/*_leave_management.sql\` | Tables, indexes, RLS, RPCs, and Storage policies. |
| \`supabase/tests/leave_management.test.sql\` | pgTAP security and workflow regression suite. |
| \`src/queries/leave-management.ts\` | Browser selects, uploads, signed URLs, and RPC calls. |
| \`src/hooks/use-leave-management.ts\` | Queries, mutations, and cache invalidation. |
| \`src/components/leave-management/*\` | Employee history/form and HR queue/detail/type-manager components. |
| \`src/app/(app)/employee/leave/**\` | Employee history and submission routes. |
| \`src/app/(app)/hr/leave-requests/**\` | HR queue and decision routes. |
| \`src/lib/app/role-config.ts\` | Employee and HR navigation entries. |

### Task 1: Add leave contracts, types, and cache keys

**Files:**
- Create: \`src/schemas/leave-management.ts\`, \`src/schemas/leave-management.test.ts\`
- Modify: \`src/schemas/index.ts\`, \`src/lib/types/database.ts\`, \`src/lib/query-keys.ts\`, \`src/lib/query-keys.test.ts\`

**Interfaces:**
- Produces \`leaveTypeSchema\`, \`leaveTypeUpdateSchema\`, \`leaveRequestDraftSchema\`, \`leaveRequestSubmissionSchema\`, \`leaveRequestFiltersSchema\`, \`leaveDecisionSchema\`, \`leaveCancellationSchema\`, and \`leaveAttachmentSchema\`.
- Produces \`LeaveType\`, \`LeaveRequest\`, \`LeaveRequestAttachment\`, \`LeaveRequestHistory\`, and \`LeaveRequestStatus\`.
- Produces \`queryKeys.leaveManagement.types()\`, \`.mine(filters)\`, \`.request(requestId)\`, \`.hrQueue(filters)\`, and \`.attachment(path)\`.

- [ ] **Step 1: Write failing schema and cache-key tests**

\`\`\`ts
it("accepts a current/future inclusive request with valid evidence", () => {
  expect(leaveRequestSubmissionSchema.parse({
    requestId: "123e4567-e89b-42d3-a456-426614174000",
    leaveTypeId: "123e4567-e89b-42d3-a456-426614174001",
    startsOn: "2026-08-24", endsOn: "2026-08-26", reason: "Medical recovery.",
    attachments: [{ objectPath: "leave-requests/123e4567-e89b-42d3-a456-426614174002/123e4567-e89b-42d3-a456-426614174000/a.pdf", fileName: "evidence.pdf", mimeType: "application/pdf", sizeBytes: 1024 }],
  }).endsOn).toBe("2026-08-26");
});
it("rejects past/reversed dates, unsafe files, and blank rejection reason", () => {
  expect(leaveRequestDraftSchema.safeParse({ leaveTypeId, startsOn: "2026-08-23", endsOn: "2026-08-24", reason: "x" }).success).toBe(false);
  expect(leaveRequestDraftSchema.safeParse({ leaveTypeId, startsOn: "2026-08-26", endsOn: "2026-08-24", reason: "x" }).success).toBe(false);
  expect(leaveAttachmentSchema.safeParse({ objectPath: "x.exe", fileName: "x.exe", mimeType: "application/x-msdownload", sizeBytes: 1 }).success).toBe(false);
  expect(leaveDecisionSchema.safeParse({ requestId, decision: "rejected", note: "" }).success).toBe(false);
});
\`\`\`

- [ ] **Step 2: Run the focused test**

Run: \`npm run test:run -- src/schemas/leave-management.test.ts src/lib/query-keys.test.ts\`

Expected: FAIL because leave contracts and cache keys do not exist.

- [ ] **Step 3: Implement the contracts and exports**

Use camelCase browser inputs and snake_case database types. Set request status to \`pending | approved | rejected | cancelled\`; type names to trimmed 1–100 characters; descriptions/reasons/notes to 2,000; and page size to 100 or less. Reject dates before the current local ISO day and \`endsOn < startsOn\`.

\`\`\`ts
export const leaveDecisionSchema = z.object({
  requestId: uuidSchema,
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(2000).optional(),
}).superRefine((value, ctx) => {
  if (value.decision === "rejected" && !value.note) {
    ctx.addIssue({ code: "custom", path: ["note"], message: "Provide a reason when rejecting a leave request." });
  }
});
\`\`\`

Export the interfaces above from schema/type/key modules. \`leaveTypeUpdateSchema\` must accept only \`id, name, description, requiresAttachment, isActive\`.

- [ ] **Step 4: Re-run the focused test**

Run: \`npm run test:run -- src/schemas/leave-management.test.ts src/lib/query-keys.test.ts\`

Expected: PASS.

- [ ] **Step 5: Commit**

\`\`\`bash
git add src/schemas src/lib/types/database.ts src/lib/query-keys.ts src/lib/query-keys.test.ts
git commit -m "feat: add leave management contracts"
\`\`\`

### Task 2: Create secure leave tables, RPCs, RLS, Storage policies, and pgTAP tests

**Files:**
- Create: CLI-generated \`supabase/migrations/*_leave_management.sql\` using \`npx supabase@latest migration new leave_management\`
- Create: \`supabase/tests/leave_management.test.sql\`

**Interfaces:**
- Produces \`leave_types\`, \`leave_requests\`, \`leave_request_attachments\`, and \`leave_request_history\`.
- Produces \`submit_leave_request(uuid, uuid, date, date, text, jsonb)\`, \`cancel_leave_request(uuid)\`, \`decide_leave_request(uuid, text, text)\`, \`create_leave_type(text, text, boolean)\`, and \`update_leave_type(uuid, text, text, boolean, boolean)\`.
- Consumes \`private.current_user_has_role\`, \`employees\`, \`notifications\`, \`audit_logs\`, and \`storage.objects\`.

- [ ] **Step 1: Write failing pgTAP assertions**

\`\`\`sql
select extensions.has_table('public', 'leave_requests', 'Leave request table exists');
select extensions.has_function('public', 'submit_leave_request',
  array['uuid', 'uuid', 'date', 'date', 'text', 'jsonb'], 'Submission RPC exists');
select extensions.throws_ok(
  $$insert into public.leave_requests (employee_id, leave_type_id, starts_on, ends_on, reason)
    values ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000020',current_date,current_date,'Bypass')$$,
  '42501', null, 'Employee cannot directly create a leave request');
\`\`\`

Seed HR, Employee, unrelated Employee, Administrator, Applicant, Management, linked employee records, an active optional-evidence type, and an active required-evidence type. Set \`request.jwt.claim.sub\` per role before each assertion.

- [ ] **Step 2: Run the database test**

Run: \`npx supabase@latest test db --linked supabase/tests/leave_management.test.sql\`

Expected: FAIL because no leave schema/RPC exists.

- [ ] **Step 3: Generate and implement the migration**

Create normalized tables with FKs/checks/timestamps and capture \`leave_type_name\` on each request to preserve the historical label after later renames/deactivation. Add:

\`\`\`sql
create unique index leave_types_active_name_unique on public.leave_types (lower(name)) where is_active;
create index leave_requests_employee_created_idx on public.leave_requests (employee_id, created_at desc);
create index leave_requests_hr_queue_idx on public.leave_requests (status, starts_on, created_at asc);
create index leave_requests_type_idx on public.leave_requests (leave_type_id, starts_on);
create index leave_request_history_request_idx on public.leave_request_history (request_id, created_at asc);
\`\`\`

Enable RLS and revoke direct DML. Employees select only rows attached to their \`employees.profile_id = auth.uid()\`; HR selects operational data; authenticated users select only active types. HR create/update types; add no delete policy. Add private-bucket policies only for \`leave-requests/<auth.uid()>/<request-uuid>/<file>.*\`: employee insert/read own keys; HR read; no broad update/delete.

Private security-definer functions use \`set search_path = ''\`, explicit caller/role checks, revoked \`PUBLIC\` execution, and public authenticated-only wrappers. Submission validates active type, current/future inclusive dates, caller-owned Storage objects, supported metadata, and required evidence before atomically adding header/attachments/\`submitted\` history. Cancellation locks a pending, owned request and appends \`cancelled\`. Decision locks a pending request, checks HR, requires rejection reason, writes decision/history/audit with \`entity_type = 'leave_requests'\`, and creates a \`leave_request_decision\` notification linking to \`/employee/leave\`.

- [ ] **Step 4: Complete pgTAP coverage**

Add assertions for:

\`\`\`sql
-- HR creates/renames/deactivates a type but cannot delete it.
-- Employee submits an optional-evidence request; it is pending with submitted history.
-- Required-evidence type rejects no evidence and other-user Storage keys.
-- Other employee cannot read/cancel; non-HR cannot manage types or decide.
-- Cancellation succeeds exactly once and blocks a later decision.
-- Approval writes decision/history/audit/one employee-owned notification.
-- Rejection without reason fails; rejection with reason persists all side effects.
-- Direct DML, anon RPC, Administrator/Applicant/Management access are denied.
\`\`\`

- [ ] **Step 5: Run migration and database verification**

\`\`\`bash
npx supabase@latest migration list --local
npx supabase@latest test db --linked supabase/tests/leave_management.test.sql
\`\`\`

Expected: migration is listed and all pgTAP assertions pass.

- [ ] **Step 6: Commit**

\`\`\`bash
git add supabase/migrations supabase/tests/leave_management.test.sql
git commit -m "feat: add secure leave management workflow"
\`\`\`

### Task 3: Add browser query functions, uploads, signed URLs, and hooks

**Files:**
- Create: \`src/queries/leave-management.ts\`, \`src/queries/leave-management.test.ts\`
- Create: \`src/hooks/use-leave-management.ts\`, \`src/hooks/use-leave-management.test.tsx\`
- Modify: \`src/hooks/index.ts\`

**Interfaces:**
- Produces \`listActiveLeaveTypes\`, \`listMyLeaveRequests\`, \`getLeaveRequest\`, \`listHrLeaveRequests\`, \`uploadLeaveAttachments\`, \`submitLeaveRequest\`, \`cancelLeaveRequest\`, \`decideLeaveRequest\`, \`createLeaveType\`, \`updateLeaveType\`, \`getLeaveAttachmentUrl\`, and matching \`use*\` hooks.

- [ ] **Step 1: Write failing query/hook tests**

\`\`\`ts
it("uploads valid files then calls the submission RPC with validated metadata", async () => {
  await submitLeaveRequest({ requestId, leaveTypeId, startsOn: "2026-08-24", endsOn: "2026-08-24", reason: "Family event" }, [file]);
  expect(storage.from).toHaveBeenCalledWith("private-documents");
  expect(rpc).toHaveBeenCalledWith("submit_leave_request", expect.objectContaining({ target_request_id: requestId }));
});
it("invalidates both workflows, notifications, and audit logs after a decision", async () => {
  await result.current.mutateAsync({ requestId, decision: "approved" });
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["leave-management", "mine"] });
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["administration", "audit-logs"] });
});
\`\`\`

- [ ] **Step 2: Run focused tests**

Run: \`npm run test:run -- src/queries/leave-management.test.ts src/hooks/use-leave-management.test.tsx\`

Expected: FAIL because leave browser data access is missing.

- [ ] **Step 3: Implement browser access**

Parse all filters/IDs/payloads first. Paginate newest-first with exact counts and fetch request attachments/history only by validated request ID. Upload valid \`File\` objects with UUID names, \`upsert: false\`, and content type; validate generated metadata before the submission RPC. Keep cancelled files private. Use a validated path with \`storage.from("private-documents").createSignedUrl(path, 60)\`.

\`\`\`ts
const parsed = leaveDecisionSchema.parse(input);
const { error } = await createBrowserSupabaseClient().rpc("decide_leave_request", {
  target_request_id: parsed.requestId,
  requested_decision: parsed.decision,
  requested_note: parsed.note ?? null,
});
if (error) throw new Error(error.message);
\`\`\`

- [ ] **Step 4: Implement hook invalidation**

Queries cover types, employee list, HR queue, detail, and signed URL. Submission/cancellation invalidate employee list/detail plus HR queue/detail; type edits invalidate type and HR data; decisions invalidate both request audiences, notifications, and administration audits.

- [ ] **Step 5: Re-run tests and commit**

\`\`\`bash
npm run test:run -- src/queries/leave-management.test.ts src/hooks/use-leave-management.test.tsx
git add src/queries/leave-management.ts src/queries/leave-management.test.ts src/hooks/use-leave-management.ts src/hooks/use-leave-management.test.tsx src/hooks/index.ts
git commit -m "feat: add leave data hooks"
\`\`\`

Expected: tests PASS and only validated data reaches Supabase.

### Task 4: Build employee history and submission screens

**Files:**
- Create: \`src/components/leave-management/employee-leave-list.tsx\`, \`employee-leave-request-form.tsx\`, \`employee-leave.test.tsx\`
- Create: \`src/app/(app)/employee/leave/page.tsx\`, \`src/app/(app)/employee/leave/new/page.tsx\`

**Interfaces:**
- Consumes \`useActiveLeaveTypes\`, \`useMyLeaveRequests\`, \`useSubmitLeaveRequest\`, and \`useCancelLeaveRequest\`.
- Produces \`/employee/leave\` and \`/employee/leave/new\`.

- [ ] **Step 1: Write failing employee UI tests**

\`\`\`tsx
it("requires evidence for an evidence-required type", async () => {
  render(<EmployeeLeaveRequestForm />);
  await user.selectOptions(screen.getByLabelText("Leave type"), "medical-type");
  await user.click(screen.getByRole("button", { name: "Submit request" }));
  expect(await screen.findByText("Attach supporting evidence for this leave type.")).toBeVisible();
});
it("offers cancellation only on a pending request", () => {
  render(<EmployeeLeaveList />);
  expect(screen.getByRole("button", { name: "Cancel request" })).toBeVisible();
  expect(screen.getAllByText("approved")).toHaveLength(1);
});
\`\`\`

- [ ] **Step 2: Run focused UI tests**

Run: \`npm run test:run -- src/components/leave-management/employee-leave.test.tsx\`

Expected: FAIL because the employee UI does not exist.

- [ ] **Step 3: Implement form, history, and routes**

Follow profile-change UI patterns using \`FormField\`, \`Input\`, \`Button\`, \`Badge\`, \`LoadingState\`, \`ErrorState\`, and \`PaginatedTableControls\`. History shows type, dates, status, submitted time, decision note, and pending-only cancellation. Form uses active types, date-input \`min\` today, reason textarea, multi-file selection, evidence-required copy, and a \`crypto.randomUUID()\` request ID.

- [ ] **Step 4: Re-run the employee test**

Run: \`npm run test:run -- src/components/leave-management/employee-leave.test.tsx\`

Expected: PASS; employee UI is accessible and final requests never show cancellation.

- [ ] **Step 5: Commit**

\`\`\`bash
git add src/components/leave-management src/app/'(app)'/employee/leave
git commit -m "feat: add employee leave requests"
\`\`\`

### Task 5: Build HR queue, detail/decision, leave-type management, and navigation

**Files:**
- Create: \`src/components/leave-management/hr-leave-request-queue.tsx\`, \`hr-leave-request-detail.tsx\`, \`leave-type-manager.tsx\`, \`hr-leave-management.test.tsx\`
- Create: \`src/app/(app)/hr/leave-requests/page.tsx\`, \`src/app/(app)/hr/leave-requests/[requestId]/page.tsx\`
- Modify: \`src/lib/app/role-config.ts\`, \`src/lib/app/role-config.test.ts\`

**Interfaces:**
- Consumes HR/type/attachment hooks from Task 3.
- Produces \`/hr/leave-requests\` and \`/hr/leave-requests/[requestId]\`, including type lifecycle controls.

- [ ] **Step 1: Write failing HR/navigation tests**

\`\`\`tsx
it("requires a rejection reason but accepts an approval note", async () => {
  render(<HrLeaveRequestDetail requestId={requestId} />);
  await user.click(screen.getByRole("button", { name: "Reject request" }));
  expect(await screen.findByText("Provide a reason when rejecting a leave request.")).toBeVisible();
});
it("deactivates an in-use type instead of deleting it", async () => {
  render(<LeaveTypeManager />);
  expect(screen.queryByRole("button", { name: "Delete leave type" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Deactivate type" }));
  expect(updateLeaveType).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
});
it("adds leave navigation only to HR and employee", () => {
  expect(getRoleConfig("employee").navigation).toEqual(expect.arrayContaining([expect.objectContaining({ href: "/employee/leave" })]));
  expect(getRoleConfig("hr_personnel").navigation).toEqual(expect.arrayContaining([expect.objectContaining({ href: "/hr/leave-requests" })]));
  expect(getRoleConfig("management").navigation).not.toEqual(expect.arrayContaining([expect.objectContaining({ label: "Leave requests" })]));
});
\`\`\`

- [ ] **Step 2: Run focused HR tests**

Run: \`npm run test:run -- src/components/leave-management/hr-leave-management.test.tsx src/lib/app/role-config.test.ts\`

Expected: FAIL because HR leave components/routes/navigation do not exist.

- [ ] **Step 3: Implement HR workspace and navigation**

Queue supports search, status/type/date filters, pagination, and detail links. Its type manager creates, edits, activates, and deactivates—never deletes. Detail presents employee/type/dates/reason/history and signed attachment URLs; an unavailable file is an error, never a guessed public link. Pending details expose approve with optional note and reject with required reason. Add \`Leave\` to employee and \`Leave requests\` to HR navigation using an existing supported icon; do not add it to other roles.

- [ ] **Step 4: Re-run focused HR tests**

Run: \`npm run test:run -- src/components/leave-management/hr-leave-management.test.tsx src/lib/app/role-config.test.ts\`

Expected: PASS.

- [ ] **Step 5: Commit**

\`\`\`bash
git add src/components/leave-management src/app/'(app)'/hr/leave-requests src/lib/app/role-config.ts src/lib/app/role-config.test.ts
git commit -m "feat: add HR leave review workspace"
\`\`\`

### Task 6: Verify the complete role journey and prepare handoff

**Files:**
- Modify only files proven necessary by verification failures from Tasks 1–5.

**Interfaces:**
- Consumes all leave contracts, RPCs, routes, tests, and policies above.
- Produces verification evidence and an implementation-ready PR handoff.

- [ ] **Step 1: Run repository checks**

\`\`\`bash
npm run lint
npm run typecheck
npm run test:run
npm run build
\`\`\`

Expected: every command exits 0.

- [ ] **Step 2: Run clean migration and leave database tests**

\`\`\`bash
npx supabase@latest migration list --local
npx supabase@latest test db --linked supabase/tests/leave_management.test.sql
\`\`\`

Expected: leave migration applies cleanly and all RLS/RPC/Storage pgTAP tests pass.

- [ ] **Step 3: Manually verify both role journeys**

Use Employee to submit required evidence where applicable, view history, and cancel a pending request. Use HR to create/deactivate types, approve one request, reject another with a reason, and confirm target employees receive one decision notification. Verify unrelated Employees, Management, Applicant, and Administrator cannot reach/read leave data.

- [ ] **Step 4: Audit final diff and secret exposure**

\`\`\`bash
git diff main...HEAD --check
git status --short
rg -n "service_role|SUPABASE_SECRET_KEY" src supabase
\`\`\`

Expected: no whitespace errors, unrelated files, or browser-exposed secret.

- [ ] **Step 5: Commit verification fixes and hand off**

\`\`\`bash
git add src/schemas/leave-management.ts src/schemas/leave-management.test.ts src/schemas/index.ts src/lib/types/database.ts src/lib/query-keys.ts src/lib/query-keys.test.ts src/queries/leave-management.ts src/queries/leave-management.test.ts src/hooks/use-leave-management.ts src/hooks/use-leave-management.test.tsx src/hooks/index.ts src/components/leave-management src/app/'(app)'/employee/leave src/app/'(app)'/hr/leave-requests src/lib/app/role-config.ts src/lib/app/role-config.test.ts supabase/migrations supabase/tests/leave_management.test.sql
git commit -m "test: verify leave management workflow"
git status --short
\`\`\`

Record migration name, RLS/Storage changes, automated-command results, employee/HR screenshots, and required Supabase configuration in the PR description; target \`main\` and do not begin task 12 until this branch is merged.
