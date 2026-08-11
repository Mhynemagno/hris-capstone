# HRIS Delivery Roadmap Design

## Goal

Provide an agent-ready, chronological plan for delivering the HRIS capstone without conflicting Supabase migrations, RLS policies, or role journeys.

## Selected approach

The project is divided into sixteen sequential branches. Each branch has one independently reviewable feature boundary and specifies its database work, pages, access rules, and acceptance condition in `docs/IMPLEMENTATION_ORDER.md`. Reusable execution requirements are centralized in `docs/AGENT_EXECUTION_PLAYBOOK.md` so individual task descriptions remain specific rather than repetitive.

## Architecture decisions

- Use Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase, TanStack Query, and Zod.
- Use Supabase Data API protected by RLS for ordinary CRUD; use Edge Functions for secrets, approvals, Gemini calls, attendance synchronization, and other privileged multi-step workflows.
- Do not use Prisma because it would create a second database-access model beside Supabase's RLS-protected Data API.
- Applicants self-register. Administrators provision internal roles. HR selects a candidate for hiring; an administrator activates the employee account and role.
- Notifications are in-app only; leave balances are excluded.
- Gemini is used only with dummy, anonymized, or explicitly consented data through an Edge Function.
- Attendance is vendor-neutral. A documented cloud/API integration is preferred and CSV/XLSX import is mandatory fallback. The HRIS never stores raw biometric templates or fingerprint images.

## Delivery boundaries

The first four branches establish project conventions, Supabase/RLS, authentication, route protection, and administration. Personnel, notifications, profile approval, and recruitment then establish the core HR journeys. AI, leave, deployment, promotion, attendance, reporting, and release readiness follow in dependency order.

## Deferred decision

USB fingerprint readers are not part of the baseline attendance branch. They require a dedicated client-side Windows kiosk, vendor SDK proof of 1:N matching, encrypted local template handling, offline queueing, and a privacy review. A separate design/branch is required only if the client chooses that hardware after vendor validation.

## Success criteria

Following the roadmap produces a deployed HRIS where role journeys work end-to-end, RLS protects personnel records, employees request rather than directly edit official profiles, HR retains final hiring decisions, AI is recommendation-only, attendance stores time logs but no biometric templates, and Management is read-only.
