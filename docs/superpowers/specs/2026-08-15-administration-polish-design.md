# Administration reliability and San Juan City Police design

## Goal

Correct the Administration users/roles data failure, standardize every administration form as a modal, turn audit records into readable operational history, and rebrand the application for San Juan City Police.

## Scope

- Rebrand the global application identity: browser metadata, authentication views, application shell, and role areas use **San Juan City Police**.
- Establish a high-contrast red-and-blue semantic theme: deep navy structural surfaces, blue primary interactions, and red authority/destructive states. The UI uses a text identity instead of an invented official police logo.
- Replace every Administration right-side form panel with an accessible centered modal:
  - Invite account
  - Manage account/role
  - Create and edit department
  - Create and edit position
  - Edit organization settings
- Correct Users and Roles retrieval without relying on a missing PostgREST relationship between profiles and user_roles.
- Keep all administration listings bounded to 20 rows per page.
- Present audit records in human-readable language, while retaining a way to inspect structured details.

## Data design

### Managed users and roles

Profiles and user_roles both reference auth.users, but neither has a direct foreign key to the other. PostgREST therefore cannot resolve the nested profile-to-role embed.

The client will use bounded composition instead of changing the database schema:

1. Fetch one 20-row profiles page, applying profile search/status filters.
2. Fetch role rows only for the profile IDs on that page.
3. Join those rows by user ID in the query function.
4. When a role filter is active, first obtain the matching user IDs through a paginated/filtered role query and then fetch only the matching profile page.

No query fetches all profiles, all roles, or all audit rows. Existing RLS remains the authorization boundary.

### Audit records

The Audit Logs query fetches one 20-row audit page. It then looks up only IDs referenced by that page:

- actor profiles for actor_user_id;
- target profiles for user/profile audit records;
- department and position labels when metadata does not already contain a historical label.

The UI formatter maps technical values to plain language:

- departments: 18, insert, { name: Employees } -> **Department “Employees” created**
- user_roles, update, { role: system_administrator } -> **Account role changed to System Administrator**
- profiles, activation_changed, { is_active: true } -> **Account activated**

The table shows localised time, a human actor label (name/email or System), a readable record label, a readable action, and a short summary. A Details control opens the original structured values in a modal for traceability.

## Interaction design

Each administration route retains its current page, filters, table, pagination, loading, empty, retry, validation, and authorization states. Create/Edit actions open centered modals rather than a side cabinet.

Modal behavior:

- focus moves into the modal on open and returns to its trigger on close;
- Escape, close button, Cancel, and backdrop interaction dismiss non-pending forms;
- the modal is constrained to the viewport and scrolls internally on smaller screens;
- submission disables duplicate actions and surfaces contextual server errors;
- destructive account or reference-data deactivation remains explicit and visually distinct.

Organization Settings is a single client configuration record. It contains only organization name, support email, and default timezone—never application secrets. The page displays the current values and opens an **Edit organization settings** modal for modification.

## Visual design

The San Juan City Police application uses semantic tokens rather than component-level color literals:

- Navy: trusted structural/navigation surfaces.
- Blue: primary action, selected navigation, links, and focus emphasis.
- Red: authority accents, destructive/deactivation actions, and errors.
- Neutral surfaces: readable data tables and modals.

Text contrast meets WCAG AA, focus states remain visible, state is never communicated by color alone, controls have accessible names, and wide data tables retain an overflow wrapper on small screens.

## Testing and verification

- Query tests prove users and roles no longer use the missing relationship and preserve 20-row bounds.
- Audit formatter tests cover user, role, department, position, settings, unknown actor, and structured-detail cases.
- Workspace tests prove every form opens a modal and successful/cancel/error flows behave correctly.
- Theme and identity tests/snapshots cover the global client name and semantic token use where practical.
- Run lint, typecheck, the full Vitest suite, production build, and relevant local Supabase tests before handoff.

## Out of scope

- A new database relationship, view, RPC, or migration.
- Changes to RLS policy behavior or server-side mutation workflows.
- Creation or imitation of an official San Juan City Police logo.
- A remote database or Edge Function deployment; the existing backend deployment remains unchanged.
