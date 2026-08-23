# Notifications Design

## Purpose

Build the reusable, in-app notification foundation required by later approval workflows. Every authenticated user can see and mark only their own notifications as read. This branch does not create notification-producing product workflows, email delivery, real-time subscriptions, or a notification-composer UI.

## Data model

Add `public.notifications` with:

- `id uuid primary key default gen_random_uuid()`
- `recipient_user_id uuid not null references auth.users(id) on delete cascade`
- `type text not null`, constrained to a trimmed, lowercase snake-case identifier of at most 64 characters
- `title text not null`, trimmed and limited to 160 characters
- `body text not null`, trimmed and limited to 2,000 characters
- `link text null`, restricted to a safe, application-relative path such as `/employee/profile/change-requests`; external URLs and protocol-relative paths are rejected
- `read_at timestamptz null`
- `created_at timestamptz not null default now()`

Create a newest-first `(recipient_user_id, created_at desc)` index for the inbox and a partial unread index keyed by recipient for unread-count queries. The flexible `type` field avoids a migration every time a later module introduces a new notification category while retaining a stable validation contract.

## Authorization and state transitions

Enable RLS and grant browser clients only `SELECT` on `notifications`. A signed-in user can select a row only when `recipient_user_id = auth.uid()`. There are no browser `INSERT`, `DELETE`, or broad `UPDATE` privileges.

Expose two narrowly scoped, authenticated RPCs:

- `mark_notification_read(notification_id uuid)` updates `read_at` only when the identified row belongs to the caller and remains unread.
- `mark_all_notifications_read()` updates all unread rows belonging to the caller.

Both functions read the caller with `auth.uid()`, use a safe empty search path, are not executable by `anon`, and make cross-user identifiers a harmless no-op. They are the only browser-accessible mutation path, preventing a recipient from editing notification content or reassignment fields.

Later Edge Functions or server workflows will create rows with privileged server credentials. This branch deliberately supplies no public creation RPC because it would widen the write surface before a business workflow needs it.

## Application design

Add shared TypeScript types and Zod schemas for notification records, inbox pagination, and notification creation payloads used by future privileged workflows. Add Supabase browser query functions and TanStack Query hooks for:

- paginated newest-first notification listing;
- unread count;
- marking one notification read;
- marking all notifications read.

Successful mutations invalidate both inbox and unread-count keys. The feature does not add real-time delivery or polling; standard query refetching and invalidation keep the UI current without creating an unrequested subscription system.

The authenticated app shell receives a keyboard-accessible bell in its header. It links to `/notifications`, includes an accessible unread count, and is shown for every application role.

The `/notifications` route sits inside the existing authenticated layout, so all signed-in roles may access it and unauthenticated visitors are redirected to sign in. The page presents a newest-first paginated inbox with loading, error, and empty states. Each item shows the title, body, creation time, unread state, an optional internal “View details” link, and an individual “Mark as read” control. A “Mark all as read” action appears when unread notifications exist and becomes unavailable when none remain. The UI uses the existing semantic tokens, Lucide icons, visible focus states, and mobile-friendly 44-pixel touch targets.

## Testing and verification

- Database tests assert table structure, grants, RLS isolation, direct write denial, own-item read transitions, and that “mark all” does not change another user’s rows.
- Unit tests cover schemas, query construction/RPC usage, mutation invalidation, the accessible bell/count, and inbox actions and states.
- Run `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, and the Supabase database test after implementation.

## Acceptance criteria

1. An authenticated user sees only their notifications and unread count.
2. A user can mark one or all of their unread notifications as read.
3. A user cannot read, create, alter, delete, or mark another user’s notification as read.
4. Every authenticated role can reach the notification inbox from the bell.
5. Later privileged workflows have a stable validated table contract for creating in-app notifications.
