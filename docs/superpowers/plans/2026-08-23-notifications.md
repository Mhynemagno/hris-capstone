# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure, reusable in-app notification inbox with an authenticated bell, unread count, individual read action, and mark-all-read action.

**Architecture:** A new RLS-protected `public.notifications` table stores immutable notification content and recipient ownership. Browser clients can only select their own rows and call two narrow authenticated RPCs that transition `read_at`; TanStack Query supplies the inbox/count cache and invalidates both views after mutations. The existing authenticated shell renders a shared bell, and a client inbox component powers the new globally protected route.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Postgres/RLS/RPC, TanStack Query 5, Zod 4, Vitest, Testing Library, pgTAP, Tailwind CSS, Base UI, Lucide.

**Spec:** `docs/superpowers/specs/2026-08-23-notifications-design.md`

## Global Constraints

- Notifications are in-app only; do not add email delivery, polling, or Supabase Realtime subscriptions.
- The browser must never receive a service-role or secret key, nor general `INSERT`, `UPDATE`, or `DELETE` access to `public.notifications`.
- Every authenticated role may read only its own notifications and may only transition its own unread rows to read.
- Notification content, type, link, and recipient become immutable to the recipient after creation.
- Validate notification payloads and pagination with shared Zod schemas; links must be safe application-relative paths.
- Use the existing Supabase browser-query, TanStack Query, shadcn-style component, and role-guard conventions.
- Use semantic design tokens, visible keyboard focus, Lucide icons, and existing 44px minimum-size button primitives.

---

## File Structure

- the `notifications` migration generated in `supabase/migrations/` — imperative migration defining the table, indexes, RLS/grants/policies, and safe read-state RPCs.
- `supabase/tests/notifications.test.sql` — pgTAP authorization and RPC regression coverage using the existing five role fixtures.
- `src/lib/types/database.ts` — `Notification` database-record type.
- `src/schemas/notifications.ts` — Zod contracts for creation payloads, safe links, and paginated inbox filters.
- `src/schemas/notifications.test.ts` — normalization and rejection tests for the notification contracts.
- `src/lib/query-keys.ts` — notification inbox and unread-count key factories.
- `src/queries/notifications.ts` — Supabase browser queries and RPC invocations.
- `src/queries/notifications.test.ts` — mocked client tests for newest-first pagination, count, and RPC payloads/errors.
- `src/hooks/use-notifications.ts` — focused TanStack Query read/mutation hooks and invalidation behavior.
- `src/hooks/use-notifications.test.tsx` — hook tests for cache invalidation after each read mutation.
- `src/components/notifications/notification-bell.tsx` — accessible header link with loading-safe unread badge.
- `src/components/notifications/notification-inbox.tsx` — client inbox presentation, paging, empty/error/loading states, and read controls.
- `src/components/notifications/notification-inbox.test.tsx` — bell and inbox interaction/accessibility tests.
- `src/app/(app)/notifications/page.tsx` — authenticated notification page route.
- `src/components/app-shell/app-shell.tsx` — bell placement in the shared authenticated header.
- `src/components/app-shell/app-shell.test.tsx` — shell regression coverage for the bell’s global presence.

## Task 1: Secure database notification contract

**Files:**
- Create: migration emitted by `npx supabase@latest migration new notifications` in `supabase/migrations/`
- Create: `supabase/tests/notifications.test.sql`

**Interfaces:**
- Produces: `public.notifications(id uuid, recipient_user_id uuid, type text, title text, body text, link text, read_at timestamptz, created_at timestamptz)`.
- Produces: authenticated RPCs `public.mark_notification_read(target_notification_id uuid) returns void` and `public.mark_all_notifications_read() returns void`.
- Consumed by: the browser query layer in Task 3 and all later privileged workflow code that inserts notifications.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/notifications.test.sql` with transactional fixtures for two users and assertions matching the public contract:

```sql
begin;
set local search_path = extensions, public;
select extensions.plan(12);

select extensions.has_table('public', 'notifications', 'notifications table exists');
select extensions.has_column('public', 'notifications', 'recipient_user_id', 'notifications have a recipient');

-- Insert two fixture rows as postgres, then impersonate user one.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select extensions.is((select count(*) from public.notifications), 1::bigint, 'recipient sees only own notification');
select extensions.throws_ok(
  $$update public.notifications set title = 'forged' where recipient_user_id = '00000000-0000-0000-0000-000000000004'$$,
  '42501', null, 'recipient has no broad table update permission'
);
select extensions.lives_ok(
  $$select public.mark_notification_read('10000000-0000-0000-0000-000000000001'::uuid)$$,
  'recipient marks own notification read'
);
select extensions.is((select read_at is not null from public.notifications where id = '10000000-0000-0000-0000-000000000001'::uuid), true, 'own notification is read');
select extensions.lives_ok(
  $$select public.mark_notification_read('10000000-0000-0000-0000-000000000002'::uuid)$$,
  'cross-user read request is a harmless no-op'
);
select extensions.is((select read_at from public.notifications where id = '10000000-0000-0000-0000-000000000002'::uuid), null::timestamptz, 'other user notification remains unread');
select extensions.lives_ok($$select public.mark_all_notifications_read()$$, 'recipient can read all own notifications');

select * from extensions.finish();
rollback;
```

Use literal fixed UUIDs instead of the angle-bracket labels in the final test, seed one unread row for each fixture user as `postgres`, and add assertions that the type/link checks reject malformed rows and that `anon` cannot select or execute either RPC.

- [ ] **Step 2: Run the database test to verify it fails**

Run: `npx supabase@latest test db --linked supabase/tests/notifications.test.sql`

Expected: the table and RPC assertions fail because the migration has not been added.

- [ ] **Step 3: Create the migration and implement the minimal secure schema**

Run `npx supabase@latest migration new notifications`, then replace the generated file contents with a migration that:

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type ~ '^[a-z][a-z0-9_]{0,63}$'),
  title text not null check (title = btrim(title) and char_length(title) between 1 and 160),
  body text not null check (body = btrim(body) and char_length(body) between 1 and 2000),
  link text check (link is null or (link = btrim(link) and left(link, 1) = '/' and left(link, 2) <> '//')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_created_idx on public.notifications (recipient_user_id, created_at desc);
create index notifications_recipient_unread_idx on public.notifications (recipient_user_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
create policy notifications_select_own on public.notifications for select to authenticated
  using (recipient_user_id = (select auth.uid()));
```

Add `SECURITY DEFINER` RPCs with `set search_path = ''`, an explicit non-null `auth.uid()` check, and `update public.notifications set read_at = now()` predicates that always constrain `recipient_user_id` to that caller and `read_at is null`. Revoke their default `PUBLIC` execution, then grant execution only to `authenticated`; grant neither RPC to `anon`.

- [ ] **Step 4: Run the database test to verify it passes**

Run: `npx supabase@latest test db --linked supabase/tests/notifications.test.sql`

Expected: all notification table, RLS, grants, validation, own-read, cross-user no-op, and mark-all assertions pass.

- [ ] **Step 5: Commit the database contract**

```bash
git add supabase/migrations supabase/tests/notifications.test.sql
git commit -m "feat: add secure notification storage"
```

## Task 2: Shared notification types, validation, and cache keys

**Files:**
- Modify: `src/lib/types/database.ts`
- Create: `src/schemas/notifications.ts`
- Create: `src/schemas/notifications.test.ts`
- Modify: `src/schemas/index.ts`
- Modify: `src/lib/query-keys.ts`
- Test: `src/schemas/notifications.test.ts`

**Interfaces:**
- Produces: `Notification`, `notificationCreateSchema`, `notificationFiltersSchema`, `NotificationCreateInput`, and `NotificationFilters`.
- Produces: `queryKeys.notifications.inbox(filters)` and `queryKeys.notifications.unreadCount()`.
- Consumed by: Tasks 3–5.

- [ ] **Step 1: Write the failing validation/key tests**

```ts
import { expect, it } from "vitest";
import { notificationCreateSchema, notificationFiltersSchema } from "./notifications";
import { queryKeys } from "@/lib/query-keys";

it("normalizes notification content and accepts only internal links", () => {
  expect(notificationCreateSchema.parse({
    recipientUserId: "123e4567-e89b-42d3-a456-426614174000",
    type: "profile_change_decision",
    title: " Profile updated ",
    body: " Your request was approved. ",
    link: " /employee/profile ",
  })).toMatchObject({ title: "Profile updated", body: "Your request was approved.", link: "/employee/profile" });
  expect(notificationCreateSchema.safeParse({ recipientUserId: "123e4567-e89b-42d3-a456-426614174000", type: "bad type", title: "x", body: "x" }).success).toBe(false);
  expect(notificationCreateSchema.safeParse({ recipientUserId: "123e4567-e89b-42d3-a456-426614174000", type: "update", title: "x", body: "x", link: "https://example.com" }).success).toBe(false);
});

it("bounds inbox filters and gives unread count a stable cache key", () => {
  expect(notificationFiltersSchema.parse({ page: "2", pageSize: "500" })).toEqual({ page: 2, pageSize: 100 });
  expect(queryKeys.notifications.unreadCount()).toEqual(["notifications", "unread-count"]);
});
```

- [ ] **Step 2: Run the validation test to verify it fails**

Run: `npm run test:run -- src/schemas/notifications.test.ts`

Expected: FAIL because the notification schemas and keys do not exist.

- [ ] **Step 3: Implement the shared contracts**

Add the exact database-row shape:

```ts
export type Notification = {
  id: string;
  recipient_user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};
```

Implement creation and filter schemas using `uuidSchema`, trimmed bounded strings, a lowercase snake-case type regex, and an optional link refined to start with one slash but never two. Export their inferred input types. Extend `src/schemas/index.ts` with the notification exports, then add cache keys:

```ts
notifications: {
  inbox: (filters: Record<string, unknown>) => ["notifications", "inbox", filters] as const,
  unreadCount: () => ["notifications", "unread-count"] as const,
},
```

- [ ] **Step 4: Run the validation test to verify it passes**

Run: `npm run test:run -- src/schemas/notifications.test.ts src/lib/query-keys.test.ts`

Expected: PASS, including the existing query-key tests.

- [ ] **Step 5: Commit the shared contracts**

```bash
git add src/lib/types/database.ts src/schemas src/lib/query-keys.ts
git commit -m "feat: add notification contracts"
```

## Task 3: Browser queries and read-state hooks

**Files:**
- Create: `src/queries/notifications.ts`
- Create: `src/queries/notifications.test.ts`
- Create: `src/hooks/use-notifications.ts`
- Create: `src/hooks/use-notifications.test.tsx`
- Modify: `src/hooks/index.ts`
- Test: `src/queries/notifications.test.ts`, `src/hooks/use-notifications.test.tsx`

**Interfaces:**
- Consumes: `Notification`, `NotificationFilters`, `notificationFiltersSchema`, and `queryKeys.notifications`.
- Produces: `listNotifications`, `getUnreadNotificationCount`, `markNotificationRead`, `markAllNotificationsRead`, `useNotifications`, `useUnreadNotificationCount`, `useMarkNotificationRead`, and `useMarkAllNotificationsRead`.
- Consumed by: Task 4’s bell and Task 5’s inbox.

- [ ] **Step 1: Write the failing query and hook tests**

Mock `createBrowserSupabaseClient` as in `src/queries/administration.test.ts`. Assert newest-first table access, an exact count query, page range, and RPC arguments:

```ts
await listNotifications({ page: 2, pageSize: 20 });
expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
expect(chain.range).toHaveBeenCalledWith(20, 39);

await markNotificationRead(notificationId);
expect(mocks.rpc).toHaveBeenCalledWith("mark_notification_read", { target_notification_id: notificationId });
await markAllNotificationsRead();
expect(mocks.rpc).toHaveBeenCalledWith("mark_all_notifications_read");
```

Render each mutation hook inside a `QueryClientProvider`, resolve its mocked mutation, and assert both `["notifications", "inbox"]` and `["notifications", "unread-count"]` were invalidated after success.

- [ ] **Step 2: Run the query and hook tests to verify they fail**

Run: `npm run test:run -- src/queries/notifications.test.ts src/hooks/use-notifications.test.tsx`

Expected: FAIL because the query functions and hooks do not exist.

- [ ] **Step 3: Implement the query layer and hooks**

In the query file, parse filters with defaults `{ page: 1, pageSize: 20 }`, select notification columns with `{ count: "exact" }`, order by `created_at` descending, and calculate the inclusive Supabase range with `from = (page - 1) * pageSize` and `to = from + pageSize - 1`. Return `PaginatedResult<Notification, NotificationFilters>`.

Implement unread count with `client.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null)` and return `count ?? 0`. Parse the one-item mutation input with `uuidSchema`, call the specified RPCs, and throw the Supabase error message when an error exists.

Use `useQuery` with the shared keys. Each mutation’s `onSuccess` must call:

```ts
void queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] });
void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
```

Export the hooks from `src/hooks/index.ts` following its existing barrel convention.

- [ ] **Step 4: Run the query and hook tests to verify they pass**

Run: `npm run test:run -- src/queries/notifications.test.ts src/hooks/use-notifications.test.tsx`

Expected: PASS, including error propagation and both invalidation assertions.

- [ ] **Step 5: Commit the data-access layer**

```bash
git add src/queries/notifications.ts src/queries/notifications.test.ts src/hooks/use-notifications.ts src/hooks/use-notifications.test.tsx src/hooks/index.ts
git commit -m "feat: add notification queries"
```

## Task 4: Accessible shared notification bell

**Files:**
- Create: `src/components/notifications/notification-bell.tsx`
- Modify: `src/components/app-shell/app-shell.tsx`
- Modify: `src/components/app-shell/app-shell.test.tsx`
- Test: `src/components/notifications/notification-inbox.test.tsx`

**Interfaces:**
- Consumes: `useUnreadNotificationCount` from Task 3.
- Produces: `NotificationBell`, a `/notifications` header link visible in every authenticated shell.
- Consumed by: all authenticated role layouts through `AppShell`.

- [ ] **Step 1: Write the failing bell tests**

Mock the unread-count hook and assert the semantic link, accessible count, and loading-safe behavior:

```tsx
render(<NotificationBell />);
expect(screen.getByRole("link", { name: /notifications, 3 unread/i })).toHaveAttribute("href", "/notifications");
expect(screen.getByText("3")).toHaveTextContent("3");

render(<AppShell config={ROLE_CONFIG.management} email="manager@example.com"><p>Content</p></AppShell>);
expect(screen.getByRole("link", { name: /notifications/i })).toBeInTheDocument();
```

Add a loading case that retains the label “Notifications” without exposing a false numeric count, and an error case that still offers the inbox link.

- [ ] **Step 2: Run the bell tests to verify they fail**

Run: `npm run test:run -- src/components/app-shell/app-shell.test.tsx src/components/notifications/notification-inbox.test.tsx`

Expected: FAIL because `NotificationBell` does not exist and the shell has no notifications link.

- [ ] **Step 3: Implement the bell and shell placement**

Build `NotificationBell` as a `<Link href="/notifications">` containing a `Bell` icon, visible focus styling from the existing `Button` primitive or equivalent `size="icon"` control, and an unread badge only when the successful count is greater than zero. Set an explicit accessible name such as `Notifications, 3 unread`; use `Notifications` when loading, zero, or errored.

Place the bell in `AppShell`’s sticky header after the breadcrumb and before the flexible spacer, preserving the existing sidebar button and breadcrumb. Do not add a separate per-role navigation item because the shared header bell is the required global entry point.

- [ ] **Step 4: Run the bell tests to verify they pass**

Run: `npm run test:run -- src/components/app-shell/app-shell.test.tsx src/components/notifications/notification-inbox.test.tsx`

Expected: PASS with a visible, keyboard-addressable bell for multiple role configurations.

- [ ] **Step 5: Commit the shell integration**

```bash
git add src/components/notifications/notification-bell.tsx src/components/app-shell/app-shell.tsx src/components/app-shell/app-shell.test.tsx src/components/notifications/notification-inbox.test.tsx
git commit -m "feat: add notification bell"
```

## Task 5: Notification inbox page and user actions

**Files:**
- Create: `src/components/notifications/notification-inbox.tsx`
- Modify: `src/components/notifications/notification-inbox.test.tsx`
- Create: `src/app/(app)/notifications/page.tsx`
- Test: `src/components/notifications/notification-inbox.test.tsx`

**Interfaces:**
- Consumes: `Notification`, `useNotifications`, `useUnreadNotificationCount`, `useMarkNotificationRead`, and `useMarkAllNotificationsRead`.
- Produces: `NotificationInbox` and the authenticated `/notifications` page.
- Acceptance: list/newest-first page, per-item read action, mark-all-read action, optional internal link, pagination, and complete state coverage.

- [ ] **Step 1: Write the failing inbox tests**

Mock the four notification hooks and render a page with one unread item. Assert controls call only the matching mutations and content is accessible:

```tsx
await user.click(screen.getByRole("button", { name: /mark all as read/i }));
expect(markAllMutate).toHaveBeenCalledTimes(1);

await user.click(screen.getByRole("button", { name: /mark “profile updated” as read/i }));
expect(markOneMutate).toHaveBeenCalledWith("123e4567-e89b-42d3-a456-426614174000");

expect(screen.getByRole("link", { name: /view details for profile updated/i })).toHaveAttribute("href", "/employee/profile");
```

Also test: no notifications empty state; query error with retry guidance; initial loading indicator; already-read records omit the per-item action; zero unread disables mark-all; a second-page button requests page 2; and prior-page control requests page 1.

- [ ] **Step 2: Run the inbox test to verify it fails**

Run: `npm run test:run -- src/components/notifications/notification-inbox.test.tsx`

Expected: FAIL because the inbox component and notification route do not exist.

- [ ] **Step 3: Implement the inbox and route**

Create a client component that keeps `page` in local state starting at `1`, calls `useNotifications({ page, pageSize: 20 })`, and renders:

```tsx
<section aria-labelledby="notifications-heading">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div><h1 id="notifications-heading">Notifications</h1><p>Review your HRIS updates and decisions.</p></div>
    <Button onClick={() => markAll.mutate()} disabled={unreadCount === 0 || markAll.isPending}>Mark all as read</Button>
  </div>
</section>
```

Use existing `LoadingState`, `ErrorState`, `EmptyTableState`, `Card`, `Badge`, and `Button` components. Render unread records with a textual “Unread” badge; each has title, body, `<time dateTime={created_at}>`, optional Next.js `Link`, and a `Mark “{title}” as read` button disabled while its mutation is pending. Keep an item read until cache refresh rather than mutating cached data optimistically. Include Previous/Next buttons based on `count`, `page`, and page size.

Create `src/app/(app)/notifications/page.tsx` that renders `<NotificationInbox />`. The existing `(app)` layout supplies the authentication redirect and shell, so no role-specific nested layout is required.

- [ ] **Step 4: Run inbox and route-adjacent tests to verify they pass**

Run: `npm run test:run -- src/components/notifications/notification-inbox.test.tsx src/components/app-shell/app-shell.test.tsx`

Expected: PASS for every loading/error/empty/data/mutation/pagination state and for the global bell.

- [ ] **Step 5: Commit the inbox**

```bash
git add src/components/notifications/notification-inbox.tsx src/components/notifications/notification-inbox.test.tsx "src/app/(app)/notifications/page.tsx"
git commit -m "feat: add notifications inbox"
```

## Task 6: End-to-end branch verification and documentation check

**Files:**
- Modify only if verification exposes a notification-specific defect: the affected Task 1–5 file and its focused test.

**Interfaces:**
- Verifies: all interfaces introduced in Tasks 1–5 and the acceptance criteria in the design spec.

- [ ] **Step 1: Run focused application tests**

Run: `npm run test:run -- src/schemas/notifications.test.ts src/queries/notifications.test.ts src/hooks/use-notifications.test.tsx src/components/notifications/notification-inbox.test.tsx src/components/app-shell/app-shell.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run the required repository checks**

Run:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Expected: each command exits 0.

- [ ] **Step 3: Run migration/RLS verification**

Run:

```bash
npx supabase@latest migration list --local
npx supabase@latest test db --linked supabase/tests/notifications.test.sql
```

Expected: the generated notifications migration is listed and all pgTAP assertions pass.

- [ ] **Step 4: Inspect the final diff and security boundary**

Run:

```bash
git diff main...HEAD --check
git status --short
rg -n "service_role|sb_secret" src supabase docs
```

Expected: no whitespace errors, no untracked local environment files, and no browser-facing service or secret key.

- [ ] **Step 5: Commit any verification-only fixes**

```bash
git add supabase src docs
git commit -m "fix: verify notification workflow"
```

Skip this commit when verification requires no code changes.
