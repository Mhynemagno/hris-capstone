# Secure Mobile Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure login uses a secure POST request on every browser, including when client-side JavaScript is unavailable.

**Architecture:** A dedicated Next.js route handler validates submitted credentials with the existing Zod schema, signs in through the server Supabase client, and redirects to the protected continuation route. The login form posts directly to that handler, retaining a client-independent submission path and never placing credentials in a URL.

**Tech Stack:** Next.js App Router route handlers, Supabase SSR, Zod, Vitest.

## Global Constraints

- The login form must use `POST`; credentials must never be appended to a URL.
- Redirect targets must be restricted with `getSafeNextPath`.
- Supabase credentials remain server-side and errors must be generic.

---

### Task 1: Secure Login Route

**Files:**
- Create: `src/app/auth/login/route.ts`
- Create: `src/app/auth/login/route.test.ts`
- Modify: `src/components/auth/login-form.tsx`

**Interfaces:**
- Consumes: `POST(request: NextRequest)` with `email`, `password`, and optional `next` form fields.
- Produces: a `303` redirect to `/auth/continue?next=...` on success, or `/login?next=...&error=invalid_credentials` on invalid input or credentials.

- [ ] **Step 1: Write failing tests**

```ts
expect(response.status).toBe(303);
expect(response.headers.get("location")).toBe(
  "http://localhost/auth/continue?next=%2Fhr",
);
```

- [ ] **Step 2: Run the focused test and verify it fails because `POST` is absent.**

Run: `npm run test:run -- src/app/auth/login/route.test.ts`

- [ ] **Step 3: Implement the route and POST form.**

```ts
export async function POST(request: NextRequest) {
  const data = loginSchema.safeParse(Object.fromEntries(await request.formData()));
  // Sign in with the server client, then redirect without credentials in the URL.
}
```

- [ ] **Step 4: Re-run focused tests, then the full quality suite.**

Run: `npm run test:run && npm run lint && npm run typecheck && npm run build`

### Task 2: Phase 06 Form and Client-State Direction

**Files:**
- Modify: `docs/IMPLEMENTATION_ORDER.md`

**Interfaces:**
- Produces: an explicit Phase 06 requirement for React Hook Form, Zod resolver validation, and narrowly scoped Zustand UI state.

- [ ] **Step 1: Document the target migration.**

```markdown
- Standardize interactive forms on React Hook Form with the existing Zod schemas.
- Use Zustand only for shared client/UI state; continue using TanStack Query for server data.
```

- [ ] **Step 2: Verify the wording keeps React Hook Form and Zustand scoped to their intended responsibilities.**
