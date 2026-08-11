# Supabase Auth and RBAC Foundation Design

## Goal

Establish verified Supabase identity, single-role authorization, protected shared reference data, private document-storage conventions, and database-enforced access rules for every later HRIS module.

## Scope

This branch creates the authorization foundation only. It does not add sign-in pages, application shells, role landing pages, module-specific forms, or module-specific document upload UI.

## Identity and Role Model

`auth.users` remains the identity source. A `public.profiles` row is created automatically for each Auth user and uses the Auth user UUID as its primary key. `public.user_roles` also uses `user_id` as its primary key, which makes exactly one role structurally enforceable for each account.

The allowed role values are System Administrator, HR Personnel, Applicant, Employee/Personnel, and Management. Roles are kept separate from profiles so role changes are auditable and do not depend on mutable user metadata or stale JWT claims.

An administrator bootstrap procedure assigns the initial System Administrator role to the account selected by the project owner after that Auth account exists. The account email is runtime-only input and is never stored in source control or a migration.

## Database Objects

- `profiles`: Auth-linked display identity and status metadata.
- `user_roles`: one role per Auth user, with a role-value constraint and indexed role lookups.
- `departments`: administrator-managed active reference records.
- `positions`: administrator-managed active reference records, linked to departments when applicable.
- `audit_logs`: append-only record of privileged actions with actor, target, action, metadata, and timestamp.
- `private-documents`: private Storage bucket reserved for later personnel, applicant, leave, and profile-change documents.

All timestamps use `timestamptz`; all Auth-linked identifiers use `uuid`; text values use `text` with targeted constraints. Foreign keys and columns used by RLS predicates receive indexes.

## Authorization and RLS

Every table in `public` enables RLS. Policies use `(select auth.uid())` and an internal, non-exposed role helper for role tests. The helper checks the caller identity, has a locked search path, is not directly executable by browser roles, and is used only to avoid policy recursion and repeated scans.

- Users can read their own profile and role.
- HR Personnel and System Administrators can read personnel identity data needed by later HR operations.
- System Administrators alone manage profiles, roles, departments, and positions.
- Management receives read-only access to approved reference data and later reporting data; it receives no mutation policies.
- Audit logs are inserted only by trusted database workflows and cannot be changed by browser roles.
- The private Storage bucket exposes no unauthenticated object access. This branch establishes folder/policy conventions only; each later document-owning module adds its own narrow object policy.

No policy relies on `user_metadata`, `getSession()`, or a `NEXT_PUBLIC_*` secret. Browser access always uses the publishable key and database RLS.

## Application Foundation

The existing browser and server Supabase clients remain the entry points. This branch adds a Next.js `proxy.ts` that refreshes cookies through `getClaims()` but does not guard public routes. Server helpers verify identity with `getClaims()` and resolve the current database role. Shared TypeScript types and Zod primitives define role values, UUIDs, ISO dates, pagination, and employee numbers.

## Tests and Verification

Database tests provision one fixture per role and test both allowed and denied operations for every exposed table and the private document bucket. They include cross-user read/write denial, role-assignment denial, Management mutation denial, and malformed-input rejection. The migration is applied to a clean linked database, inspected with the Supabase advisors, and verified alongside linting, typechecking, unit tests, and the production build.

## External Setup

The authenticated CLI is linked to the existing `wcjpyzulbiexvwtmyudq` project before migration work. The project owner enters the database password only in the local CLI prompt. The initial administrator account is created in the Supabase dashboard and assigned through a non-committed bootstrap operation after migrations apply.
