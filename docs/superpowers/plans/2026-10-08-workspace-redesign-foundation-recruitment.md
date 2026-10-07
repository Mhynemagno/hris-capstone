# Workspace Redesign (Foundation + Recruitment) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give System Administrator, HR, Employee and Management a new navy "workspace" look (tokens, type, component kit, shell, navigation) and rebuild the HR dashboard, job postings, applications list and applicant detail — while the Applicant side and public pages render exactly as today.

**Architecture:**
- A `.workspace` CSS scope redefines colour, type-scale, and radius tokens.
- Shared components gain `ws:`-variant classes that apply only inside that scope, so output outside it is byte-identical.
- `(app)/layout.tsx` picks `WorkspaceShell` for every non-applicant role and keeps `AppShell` for applicants.
- Recruitment pages become DataTable/FilterBar/Tabs screens. Their state lives in the URL, and they filter, sort and page on the client over the existing queries.

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript, Tailwind v4, `@base-ui/react` 1.7, TanStack Query 5, Supabase JS, Vitest + Testing Library, Playwright, `sonner` (new).

**Spec:** `docs/superpowers/specs/2026-10-07-workspace-redesign-foundation-recruitment-design.md`. Read it before starting any task.

**Before writing Next.js code** (`AGENTS.md` rule): this Next.js version differs from training data. Read the relevant guide under `node_modules/next/dist/docs/`:
- `useSearchParams`, `useRouter`, `usePathname` from `next/navigation`;
- async `searchParams` / `params` props;
- `next/link`.

For base-ui component APIs, read `node_modules/@base-ui/react/docs/` (or the `.d.ts` files next to each part).

## Global Constraints

- Applicant routes (`/applicant/**`, `/jobs/**`, `(public)/**`, `(auth)/**`, `/unauthorized`) must render exactly as before. The baseline in Task 1 must pass after every task.
- No database migrations, no new RPCs, no change to status transitions or business rules.
- One typeface: Inter. Workspace type scale:
  - xs 12/16, sm 13/18, base 14/20, lg 16/24, xl 18/28, 2xl 24/32, 3xl 28/36, 4xl 32/40.
  - Page title: `text-2xl font-bold`. Section heading: `text-lg font-semibold` (16px). Panel title: `text-base font-semibold`.
- Workspace colours:
  - primary `#0F3467`, primary hover `#0B2A55`, primary subtle `#EBF0F8`;
  - canvas `#F6F7F9`, surface `#FFFFFF`, surface muted `#F2F4F7`;
  - border `#E4E7EC`, input `#D0D5DD`;
  - text `#101828` / `#475467` / `#667085`;
  - success `#067647`/`#ECFDF3`, warning `#B54708`/`#FFFAEB`, danger `#B42318`/`#FEF3F2`.
- Workspace sizes: control height 36px (32 small, 40 large, minimum 40 below `md`); table rows 44px; radius 6px on controls and badges, 8px on cards, dialogs and drawers. No gradients. Shadows only on floating layers.
- Dates show in words through `formatDate` / `formatDateTime` from `src/lib/format-date.ts`.
- Keep these stable, because the tests rely on them:
  - `dialog` / `alertdialog` roles;
  - button names "Close", "Next page" and "Previous page";
  - `role="status"` on success feedback (sonner toasts satisfy this);
  - "Loading…" text inside `role="status"` while loading;
  - exactly one `h1` per page;
  - `aria-current="page"` on the active nav link;
  - "Skip to main content".
- Nav labels and page titles match exactly.
- Commit after every task. Messages use the repo style (`feat:`, `fix:`, `test:`, `style:`, `docs:`) and end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Work on branch `feat/workspace-redesign-foundation-recruitment` (already created).

## Review Focus

1. **A portal overlay (dialog, menu, toast, popover) opened on a workspace page must use workspace tokens.** Portals render under `<body>`, outside the shell's wrapper. Task 10 puts `workspace` on `<html>` while the shell is mounted. Its test asserts the class is added on mount and removed on unmount.
2. **URL state with junk values** (`?page=999`, `?sort=nope`, `?stage=Bogus`, `?minScore=abc`) must fall back to defaults instead of crashing or showing an empty page. Tests: Task 6 (`clampPage`, `parseSort`) and Task 16 (`parseApplicationListParams`).
3. **Applications whose applicant or job lookup failed** (`applicant_name` / `job_title` null) still render with a fallback name ("Application 3f2a9c1b") and "—" for the job, and search must not crash on nulls. Tests: Task 15.
4. **Double-submitting a stage change or a hire** (double click, Enter twice) must fire one mutation. Confirm buttons are disabled while pending. Test: Task 14 (dialog disabled while pending).
5. **A count query that errors or is slow** must never block the nav or the dashboard. The badge is hidden and the attention row shows "—". Tests: Task 9 (badge hidden on error) and Task 11 (attention row with a null count).

---

## File Structure

**Created**

| Path | Responsibility |
|---|---|
| `e2e/applicant-visual-baseline.spec.ts` | Proves applicant/public styling is unchanged (computed-style snapshot + screenshots of static pages) |
| `src/components/ui/dialog.tsx` | base-ui Dialog with workspace styling (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`) |
| `src/components/ui/alert-dialog.tsx` | base-ui AlertDialog (`ConfirmDialog` convenience component) |
| `src/components/ui/drawer.tsx` | Right-side panel built on the existing `Sheet` |
| `src/components/ui/popover.tsx` | base-ui Popover |
| `src/components/ui/radio-group.tsx` | base-ui RadioGroup + Radio as a labelled option list |
| `src/components/ui/toaster.tsx` | sonner `Toaster` + `notifySuccess` |
| `src/components/ui/tabs.tsx` | base-ui Tabs + `useUrlTab` |
| `src/components/ui/search-input.tsx` | Debounced search field with a clear button |
| `src/components/ui/pagination.tsx` | "1–25 of 132" + Previous/Next |
| `src/components/ui/empty-state.tsx` | First-use / no-results empty state |
| `src/components/ui/data-table.tsx` | Typed table: sortable headers, row link, skeleton/empty/error rows, responsive columns |
| `src/components/ui/filter-bar.tsx` | Toolbar layout + active-filter chips + Clear all |
| `src/components/ui/stat-strip.tsx` | Bordered strip of linked stat cells |
| `src/lib/workspace/list-params.ts` | `useListParams` (URL query state) |
| `src/lib/workspace/table.ts` | Pure helpers: `parseSort`, `formatSort`, `sortRows`, `paginate`, `clampPage` |
| `src/lib/workspace/date-range.ts` | Dashboard period presets → `{ startsOn, endsOn }` |
| `src/queries/workspace-counts.ts` | Head-count queries for nav badges and dashboard attention rows |
| `src/hooks/use-workspace-counts.ts` | `useWorkspaceCount(key)` |
| `src/components/workspace-shell/workspace-shell.tsx` | New shell (sidebar, navy top bar, breadcrumbs) |
| `src/components/workspace-shell/breadcrumbs.tsx` | `BreadcrumbProvider`, `useBreadcrumbTrail`, `WorkspaceBreadcrumbs` |
| `src/components/workspace-shell/page-container.tsx` | `PageContainer width="wide" \| "narrow"` |
| `src/components/workspace-shell/nav-badge.tsx` | Count badge for one nav item |
| `src/components/reporting/workspace-dashboard.tsx` | New HR/Management dashboard |
| `src/components/reporting/attention-list.tsx` | Needs-attention list (pure presentational) |
| `src/lib/recruitment/applicant-number.ts` | `formatApplicantNumber` (replaces 3 copies) |
| `src/lib/recruitment/application-stages.ts` | Stage order, `allowedNextStatuses`, `stageActions`, `stageBadgeVariant` |
| `src/lib/recruitment/application-list.ts` | Quick views, row building, filtering, sort accessors, URL param parsing |
| `src/components/recruitment/application-stage-badge.tsx` | Stage StatusBadge |
| `src/components/recruitment/hr-job-postings.tsx` | Job postings list (replaces `hr-job-list.tsx`) |
| `src/components/recruitment/hr-applications.tsx` | Applications list tab |
| `src/components/recruitment/hr-registered-applicants.tsx` | Registered applicants tab + drawer |
| `src/components/recruitment/application-detail/*.tsx` | Applicant detail units (Tasks 17–18) |

**Modified**

- `src/app/globals.css`
- `src/components/ui/{button,badge,input,textarea,native-select,card,form-field,page-header,loading-state,error-state}.tsx`
- `src/app/(app)/layout.tsx`
- `src/lib/app/role-config.ts`
- `src/queries/recruitment.ts`, `src/hooks/use-recruitment.ts`
- `src/components/recruitment/{hr-job-form,hr-job-editor}.tsx`
- `src/components/leave-management/hr-leave.tsx`
- the HR/admin/management page wrappers
- the e2e specs

**Deleted**

- `src/components/recruitment/hr-job-list.tsx` (+ test)
- `src/components/recruitment/hr-application-list.tsx`
- `src/components/recruitment/hr-registered-applicant-list.tsx` (+ test)
- `src/components/recruitment/hr-application-detail.tsx`
- `src/components/recruitment/hr-required-documents.tsx` (+ test)
- `src/components/recruitment/hr-recruitment-workspace.test.tsx`, split into new tests

**Deliberate narrowing of spec §3.4 (YAGNI).** No screen in this phase uses a custom Select, Checkbox, Switch or DataTable row selection.

- Toolbars use the existing `NativeSelect`: it is accessible, and the e2e `selectOption` keeps working.
- Checkbox, Switch and row selection are added by the sub-project that first needs them.

**Spec §5 attendance chart.** The dashboard RPC returns `attendanceTrend` as a single daily series, not a present/late/absent split per day. The Attendance panel therefore shows:

- the daily column chart,
- the period's status split (`attendanceStatus`) as labelled bars underneath.

Producing stacked daily columns would need a new RPC, which is out of scope.

---

### Task 1: Applicant-side visual baseline

**Files:**
- Create: `e2e/applicant-visual-baseline.spec.ts`

**Interfaces:**
- Produces: snapshot files under `e2e/applicant-visual-baseline.spec.ts-snapshots/`, committed. Every later task must keep `npx playwright test e2e/applicant-visual-baseline.spec.ts` green.

- [ ] **Step 1: Write the baseline spec**

```ts
import { expect, test, type Page } from "@playwright/test";

// Guards the redesign's hard constraint: the Applicant side and public pages look exactly as before.
// Computed styles are data-independent, so they are snapshotted for pages whose content changes
// between runs; static pages are also screenshotted.

const demoPassword = process.env.HRIS_E2E_PASSWORD ?? "DemoPass!2026";

const PROBES = [
  "body",
  "h1",
  "main a",
  "button",
  "input",
  "select",
  "[data-slot=badge]",
  "[data-slot=sidebar-inner]",
  "header",
] as const;

const PROPERTIES = [
  "font-family", "font-size", "font-weight", "line-height", "color", "background-color",
  "border-top-color", "border-top-left-radius", "min-height", "padding-left", "box-shadow",
] as const;

async function styleSignature(page: Page) {
  return page.evaluate(({ probes, properties }) => {
    const out: Record<string, Record<string, string> | null> = {};
    for (const selector of probes) {
      const element = document.querySelector(selector);
      if (!element) { out[selector] = null; continue; }
      const style = getComputedStyle(element);
      out[selector] = Object.fromEntries(properties.map((name) => [name, style.getPropertyValue(name)]));
    }
    return out;
  }, { probes: [...PROBES], properties: [...PROPERTIES] });
}

async function signInApplicant(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo.applicant@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill(demoPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/applicant$/, { timeout: 30_000 });
}

test.describe("applicant and public pages keep their current look", () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  for (const path of ["/login", "/applicant/register"]) {
    test(`static page ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`${path.replaceAll("/", "_")}.png`, { fullPage: true, maxDiffPixelRatio: 0.002 });
      expect(JSON.stringify(await styleSignature(page), null, 2)).toMatchSnapshot(`${path.replaceAll("/", "_")}.styles.json`);
    });
  }

  for (const path of ["/", "/jobs"]) {
    test(`public page ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(JSON.stringify(await styleSignature(page), null, 2)).toMatchSnapshot(`${path === "/" ? "_home" : path.replaceAll("/", "_")}.styles.json`);
    });
  }

  test("signed-in applicant pages", async ({ page }) => {
    await signInApplicant(page);
    for (const path of ["/applicant", "/applicant/profile", "/applicant/documents", "/applicant/applications"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(JSON.stringify(await styleSignature(page), null, 2)).toMatchSnapshot(`${path.replaceAll("/", "_")}.styles.json`);
    }
  });
});
```

- [ ] **Step 2: Generate the baselines on the untouched branch**

Run (with local Supabase started, `npx supabase start`): `npx playwright test e2e/applicant-visual-baseline.spec.ts --update-snapshots`

Expected: 5 tests pass and snapshot files are written to `e2e/applicant-visual-baseline.spec.ts-snapshots/`.

- [ ] **Step 3: Confirm the baselines are stable**

Run: `npx playwright test e2e/applicant-visual-baseline.spec.ts`

Expected: PASS twice in a row. If a screenshot flakes because of a blinking caret or font loading, add `animations: "disabled", caret: "hide"` to that `toHaveScreenshot` options object and regenerate.

- [ ] **Step 4: Commit**

```bash
git add e2e/applicant-visual-baseline.spec.ts e2e/applicant-visual-baseline.spec.ts-snapshots
git commit -m "test(e2e): baseline the applicant and public pages before the workspace redesign"
```

---

### Task 2: Workspace tokens and type scale

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces:
  - the `ws:` Tailwind variant (`@custom-variant ws`), which applies when the element is inside `.workspace`;
  - CSS variables inside `.workspace`: `--primary`, `--primary-hover`, `--primary-subtle`, `--success`, `--success-subtle`, `--warning`, `--warning-subtle`, `--destructive-subtle`, plus the overridden type scale and `--radius: 0.5rem`;
  - Tailwind colours `bg-primary-hover`, `bg-primary-subtle`, `text-success`, `bg-success-subtle`, `text-warning`, `bg-warning-subtle`, `bg-destructive-subtle`, `text-secondary-foreground` (existing).

- [ ] **Step 1: Split the type scale out of `@theme inline`**

In `src/app/globals.css`, delete the `--text-xs` … `--text-4xl--line-height` lines (and their comment) from the `@theme inline { … }` block. Add this block directly after it. Values are unchanged, but a plain `@theme` makes utilities reference the variables, so a scope can override them:

```css
/*
 * Readability-first type scale for the applicant and public pages (unchanged values).
 * Declared with a plain @theme (not inline) so utilities read var(--text-*), which lets
 * `.workspace` swap in the denser HR/Admin scale without touching applicant pages.
 */
@theme {
  --text-xs: 0.875rem;
  --text-xs--line-height: 1.35rem;
  --text-sm: 1rem;
  --text-sm--line-height: 1.5rem;
  --text-base: 1.0625rem;
  --text-base--line-height: 1.7rem;
  --text-lg: 1.1875rem;
  --text-lg--line-height: 1.8rem;
  --text-xl: 1.375rem;
  --text-xl--line-height: 1.9rem;
  --text-2xl: 1.625rem;
  --text-2xl--line-height: 2.15rem;
  --text-3xl: 1.875rem;
  --text-3xl--line-height: 2.4rem;
  --text-4xl: 2.25rem;
  --text-4xl--line-height: 2.75rem;
}
```

- [ ] **Step 2: Add the `ws` variant and the new colour aliases**

Directly after `@custom-variant dark (&:is(.dark *));` add:

```css
/* Applies only inside the HR/Admin/Employee/Management workspace (WorkspaceShell). */
@custom-variant ws (&:where(.workspace, .workspace *));
```

Inside the `@theme inline { … }` block, after `--color-primary: var(--primary);`, add:

```css
  --color-primary-hover: var(--primary-hover);
  --color-primary-subtle: var(--primary-subtle);
  --color-success: var(--success);
  --color-success-subtle: var(--success-subtle);
  --color-warning: var(--warning);
  --color-warning-subtle: var(--warning-subtle);
  --color-destructive-subtle: var(--destructive-subtle);
```

In `:root`, after `--primary-foreground`, add defaults so these utilities resolve outside the workspace. They only appear in new workspace components:

```css
  --primary-hover: oklch(0.45 0.1 170);
  --primary-subtle: oklch(0.95 0.025 170);
  --success: #067647;
  --success-subtle: #ecfdf3;
  --warning: #b54708;
  --warning-subtle: #fffaeb;
  --destructive-subtle: #fef3f2;
```

- [ ] **Step 3: Add the `.workspace` scope**

After the `.app-sidebar { … }` block, add:

```css
/*
 * HR / Admin / Employee / Management workspace (spec 2026-10-07 §3). Police navy brand,
 * cool neutrals, borders over shadows, a denser 14px type scale. Scoped so the applicant
 * and public pages keep today's tokens.
 */
.workspace {
  --background: #f6f7f9;
  --foreground: #101828;
  --card: #ffffff;
  --card-foreground: #101828;
  --popover: #ffffff;
  --popover-foreground: #101828;
  --primary: #0f3467;
  --primary-foreground: #ffffff;
  --primary-hover: #0b2a55;
  --primary-subtle: #ebf0f8;
  --secondary: #f2f4f7;
  --secondary-foreground: #475467;
  --muted: #f2f4f7;
  --muted-foreground: #667085;
  --accent: #ebf0f8;
  --accent-foreground: #0f3467;
  --destructive: #b42318;
  --destructive-subtle: #fef3f2;
  --success: #067647;
  --success-subtle: #ecfdf3;
  --warning: #b54708;
  --warning-subtle: #fffaeb;
  --border: #e4e7ec;
  --input: #d0d5dd;
  --ring: #0f3467;
  --chart-1: #0f3467;
  --chart-4: #5b7db5;
  --radius: 0.5rem;
  --text-xs: 0.75rem;
  --text-xs--line-height: 1rem;
  --text-sm: 0.8125rem;
  --text-sm--line-height: 1.125rem;
  --text-base: 0.875rem;
  --text-base--line-height: 1.25rem;
  --text-lg: 1rem;
  --text-lg--line-height: 1.5rem;
  --text-xl: 1.125rem;
  --text-xl--line-height: 1.75rem;
  --text-2xl: 1.5rem;
  --text-2xl--line-height: 2rem;
  --text-3xl: 1.75rem;
  --text-3xl--line-height: 2.25rem;
  --text-4xl: 2rem;
  --text-4xl--line-height: 2.5rem;
}

/* The workspace sidebar: white, navy text, a subtle navy "you are here". */
.workspace .app-sidebar {
  --sidebar: #ffffff;
  --sidebar-foreground: #344054;
  --sidebar-primary: #0f3467;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #ebf0f8;
  --sidebar-accent-foreground: #0f3467;
  --sidebar-border: #e4e7ec;
  --sidebar-ring: #0f3467;
}
```

- [ ] **Step 4: Add the scoped defaults for hand-built tables (spec §9)**

At the end of `@layer base { … }` add:

```css
  /* Hand-built tables on not-yet-redesigned workspace pages match DataTable until migrated. */
  :where(.workspace) :where(table:not([data-slot=data-table])) :where(thead) {
    background-color: var(--muted);
  }
  :where(.workspace) :where(table:not([data-slot=data-table])) :where(th) {
    font-size: var(--text-xs);
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    color: var(--muted-foreground);
  }
  :where(.workspace) :where(table:not([data-slot=data-table])) :where(tbody tr:hover) {
    background-color: var(--muted);
  }
```

- [ ] **Step 5: Verify that nothing outside the workspace changed**

Run: `npm run typecheck && npm run lint && npx playwright test e2e/applicant-visual-baseline.spec.ts`

Expected: all PASS. The baseline must be identical because no element has `.workspace` yet.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add the scoped workspace theme and make the type scale overridable"
```

---

### Task 3: Workspace styling for the shared primitives

**Files:**
- Modify:
  - `src/components/ui/button.tsx`
  - `src/components/ui/badge.tsx`
  - `src/components/ui/input.tsx`
  - `src/components/ui/textarea.tsx`
  - `src/components/ui/native-select.tsx`
  - `src/components/ui/card.tsx`
  - `src/components/ui/form-field.tsx`
  - `src/components/ui/page-header.tsx`
  - `src/components/ui/error-state.tsx`
- Test:
  - `src/components/ui/ui-states.test.tsx` (extend)
  - `src/components/ui/badge.test.tsx` (new)
  - `src/components/ui/page-header.test.tsx` (extend)

**Interfaces:**
- Produces:
  - `Button` gains `variant="primary"` (alias of default), a solid `variant="danger"`, and a `loading?: boolean` prop. While `loading`, the button is disabled, sets `aria-busy`, and shows a spinner. Existing variants are unchanged outside the workspace.
  - `Badge` gains variants `success | warning | info | neutral | danger`.
  - `ErrorState` gains optional `onRetry?: () => void` (renders a "Try again" button).
  - `PageHeader` gains optional `secondaryActions?: ReactNode` and `eyebrow?: ReactNode` (for back links).

- [ ] **Step 1: Write failing tests**

Create `src/components/ui/badge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Badge } from "./badge";

it.each(["success", "warning", "info", "neutral", "danger"] as const)("renders the %s variant with readable text", (variant) => {
  render(<Badge variant={variant}>Label</Badge>);
  expect(screen.getByText("Label")).toHaveAttribute("data-slot", "badge");
});
```

Append to `src/components/ui/ui-states.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { Button } from "./button";
import { ErrorState } from "./error-state";

it("offers a retry from an error state", async () => {
  const onRetry = vi.fn();
  render(<ErrorState message="Network down" onRetry={onRetry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Network down");
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

it("disables a loading button and marks it busy", () => {
  render(<Button loading>Save</Button>);
  const button = screen.getByRole("button", { name: /save/i });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
});
```

If `ui-states.test.tsx` already imports `render`/`screen`/`it`/`expect`, merge the imports instead of duplicating them.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/ui/badge.test.tsx src/components/ui/ui-states.test.tsx`

Expected: FAIL. The badge variant is unknown, there is no "Try again" button, and `loading` is ignored.

- [ ] **Step 3: Implement**

**`button.tsx`**

- Append `ws:rounded-md ws:text-base ws:font-medium ws:active:not-aria-[haspopup]:translate-y-0` to the base string.
- Change the variants map to:

```ts
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80 ws:hover:bg-primary-hover",
        primary: "bg-primary text-primary-foreground hover:bg-primary/80 ws:hover:bg-primary-hover",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 ws:border-input ws:bg-card",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        danger: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
```

- Change the sizes to append workspace heights:

```ts
        default:
          "min-h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 ws:min-h-9 ws:px-3.5 ws:max-md:min-h-10",
        xs: "min-h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3 ws:min-h-7",
        sm: "min-h-10 gap-1 rounded-[min(var(--radius-md),12px)] px-3 text-sm in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5 ws:min-h-8 ws:text-sm ws:max-md:min-h-10",
        lg: "min-h-12 gap-2 px-5 text-base has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 ws:min-h-10",
        icon: "size-11 ws:size-9 ws:max-md:size-10",
        "icon-xs":
          "size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3 ws:size-7",
        "icon-sm":
          "size-11 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg ws:size-8 ws:max-md:size-10",
        "icon-lg": "size-12 ws:size-10",
```

- Replace the component:

```tsx
import { LoaderCircle } from "lucide-react"

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { loading?: boolean }) {
  return (
    <ButtonPrimitive
      aria-busy={loading || undefined}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : null}
      {children}
    </ButtonPrimitive>
  )
}
```

`aria-busy` is only rendered when `loading` is true, so DOM output outside the workspace is unchanged.

**`badge.tsx`**

- Append `ws:min-h-5 ws:rounded-md ws:px-2 ws:font-medium` to the base string.
- Add the variants:

```ts
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        info: "bg-primary-subtle text-primary",
        neutral: "bg-muted text-secondary-foreground",
        danger: "bg-destructive-subtle text-destructive",
```

**`input.tsx`**: append `ws:min-h-9 ws:rounded-md ws:bg-card ws:px-3 ws:py-1.5 ws:max-md:min-h-10` to the class string.

**`textarea.tsx`**: append `ws:rounded-md ws:bg-card`.

**`native-select.tsx`**: append `ws:min-h-9 ws:rounded-md ws:bg-card ws:py-1.5 ws:max-md:min-h-10` to `nativeSelectClassName`.

**`card.tsx`**

- Append `ws:rounded-lg ws:ring-0 ws:border ws:border-border` to `Card`'s classes.
- Append `ws:text-base ws:font-semibold` to `CardTitle`.

**`form-field.tsx`**

- Label class: `"block text-sm font-semibold text-foreground ws:font-medium"`.
- Wrapper: `"space-y-2 ws:space-y-1.5"`.

**`page-header.tsx`**: replace with:

```tsx
import type { ReactNode } from "react";

type PageHeaderProps = {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Secondary actions, e.g. a "More" dropdown, shown before the primary action. */
  secondaryActions?: ReactNode;
  /** Small line above the title, e.g. a back link. */
  eyebrow?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ action, description, eyebrow, id, meta, secondaryActions, title }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border/80 pb-6 sm:flex-row sm:items-end sm:justify-between ws:border-b-0 ws:pb-0">
      <div className="max-w-3xl space-y-2 ws:space-y-1">
        {eyebrow}
        <h1 className="text-3xl font-bold tracking-tight ws:text-2xl" id={id}>
          {title}
        </h1>
        {description ? (
          <p className="text-base leading-7 text-muted-foreground ws:leading-5">{description}</p>
        ) : null}
        {meta}
      </div>
      {action || secondaryActions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {secondaryActions}
          {action}
        </div>
      ) : null}
    </header>
  );
}
```

The action wrapper previously was `<div className="shrink-0">`. The new wrapper adds flex classes only around existing actions, and applicant pages never pass `action` (verify with `grep -rn "PageHeader" src/app/\(app\)/applicant src/components/recruitment/applicant-*`). If any applicant page does pass `action`, keep the old `<div className="shrink-0">{action}</div>` when `secondaryActions` is absent, so its DOM is unchanged.

**`error-state.tsx`**: replace with:

```tsx
type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  if (!onRetry) {
    return (
      <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {message}
      </p>
    );
  }
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <span>{message}</span>
      <button className="font-medium underline underline-offset-4" onClick={onRetry} type="button">Try again</button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and the baseline**

Run: `npx vitest run src/components/ui && npm run typecheck && npx playwright test e2e/applicant-visual-baseline.spec.ts`

Expected: PASS. The baseline is unchanged because every new class is behind `ws:`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui
git commit -m "style: workspace sizing and new variants for the shared controls"
```

---

### Task 4: Overlays and toasts (Dialog, ConfirmDialog, Drawer, Popover, RadioGroup, Toaster)

**Files:**
- Create:
  - `src/components/ui/dialog.tsx`
  - `src/components/ui/alert-dialog.tsx`
  - `src/components/ui/drawer.tsx`
  - `src/components/ui/popover.tsx`
  - `src/components/ui/radio-group.tsx`
  - `src/components/ui/toaster.tsx`
- Test: `src/components/ui/overlays.test.tsx`
- Modify: `package.json` (add `sonner`)

**Interfaces:**
- Produces:
  - `Dialog({ open, onOpenChange, children })`.
  - `DialogContent({ title: string; description?: ReactNode; children; footer?: ReactNode; className? })`. Renders `role="dialog"` named by `title`, with a "Close" button.
  - `ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = "Cancel", tone: "default" | "danger", pending?: boolean, onConfirm: () => void | Promise<void>, children?: ReactNode, error?: string | null })`. Renders `role="alertdialog"`.
  - `Drawer({ open, onOpenChange, title, description?, children })`. Right side, `role="dialog"`.
  - `Popover`, `PopoverTrigger`, `PopoverContent`.
  - `RadioGroup({ name, value, onValueChange, options: { value: string; label: string; description?: string }[], legend: string })`.
  - `Toaster()`, mounted once by `WorkspaceShell` in Task 10.
  - `notifySuccess(message: string)`.

- [ ] **Step 1: Install sonner**

Run: `npm install sonner`

Expected: `package.json` lists `sonner` and the lockfile updates.

- [ ] **Step 2: Write the failing tests**

`src/components/ui/overlays.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./alert-dialog";
import { Dialog, DialogContent } from "./dialog";
import { Drawer } from "./drawer";
import { RadioGroup } from "./radio-group";

describe("overlays", () => {
  it("names a dialog by its title and closes it with the Close button", async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return <Dialog onOpenChange={setOpen} open={open}><DialogContent title="Move to stage"><p>Body</p></DialogContent></Dialog>;
    }
    render(<Harness />);
    expect(screen.getByRole("dialog", { name: "Move to stage" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirms through an alertdialog and disables the confirm button while pending", async () => {
    const onConfirm = vi.fn();
    const { rerender } = render(<ConfirmDialog confirmLabel="Withdraw" description="Applicants can no longer apply." onConfirm={onConfirm} onOpenChange={() => undefined} open title="Withdraw posting?" tone="danger" />);
    const dialog = screen.getByRole("alertdialog", { name: "Withdraw posting?" });
    expect(dialog).toHaveTextContent("Applicants can no longer apply.");
    await userEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    rerender(<ConfirmDialog confirmLabel="Withdraw" description="x" onConfirm={onConfirm} onOpenChange={() => undefined} open pending title="Withdraw posting?" tone="danger" />);
    expect(screen.getByRole("button", { name: /withdraw/i })).toBeDisabled();
  });

  it("shows a confirm error inside the dialog", () => {
    render(<ConfirmDialog confirmLabel="Go" description="d" error="Server said no" onConfirm={() => undefined} onOpenChange={() => undefined} open title="Sure?" />);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Server said no");
  });

  it("opens a drawer as a named dialog", () => {
    render(<Drawer onOpenChange={() => undefined} open title="Aplica Candidate"><p>Contact</p></Drawer>);
    expect(screen.getByRole("dialog", { name: "Aplica Candidate" })).toHaveTextContent("Contact");
  });

  it("lists radio options and reports the choice", async () => {
    const onValueChange = vi.fn();
    render(<RadioGroup legend="Next stage" name="stage" onValueChange={onValueChange} options={[{ value: "Interview", label: "Interview" }, { value: "Shortlisted", label: "Shortlisted" }]} value="" />);
    expect(screen.getByRole("radiogroup", { name: "Next stage" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Interview" }));
    expect(onValueChange).toHaveBeenCalledWith("Interview");
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/components/ui/overlays.test.tsx`

Expected: FAIL with "Failed to resolve import ./alert-dialog".

- [ ] **Step 4: Implement**

`src/components/ui/dialog.tsx`:

```tsx
"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />;
}

export const DialogClose = DialogPrimitive.Close;

const backdrop = "fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0";
const popup = "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl transition-[opacity,scale] duration-[180ms] ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0";

export function DialogContent({ title, description, children, footer, className }: { title: string; description?: ReactNode; children?: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className={backdrop} />
      <DialogPrimitive.Popup className={cn(popup, className)}>
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="space-y-1">
            <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description> : null}
          </div>
          <DialogPrimitive.Close render={<Button aria-label="Close" size="icon-sm" variant="ghost" />}>
            <XIcon aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/40 px-5 py-3">{footer}</div> : null}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}
```

`src/components/ui/alert-dialog.tsx`:

```tsx
"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
};

/** A blocking yes/no question. Errors from the confirmed action are shown inside the dialog. */
export function ConfirmDialog({ cancelLabel = "Cancel", children, confirmLabel, description, error, onConfirm, onOpenChange, open, pending = false, title, tone = "default" }: ConfirmDialogProps) {
  return (
    <AlertDialog.Root onOpenChange={(next) => { if (!pending) onOpenChange(next); }} open={open}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-popover p-5 text-popover-foreground shadow-xl transition-[opacity,scale] duration-[180ms] ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">{description}</AlertDialog.Description>
          {children ? <div className="mt-4">{children}</div> : null}
          {error ? <p className="mt-4 rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <AlertDialog.Close disabled={pending} render={<Button variant="outline" />}>{cancelLabel}</AlertDialog.Close>
            <Button loading={pending} onClick={() => void onConfirm()} type="button" variant={tone === "danger" ? "danger" : "primary"}>{confirmLabel}</Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
```

`src/components/ui/drawer.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Right-hand panel for secondary detail that does not need its own page. */
export function Drawer({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 sm:max-w-md ws:rounded-l-lg" side="right">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
```

`src/components/ui/popover.tsx`:

```tsx
"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { ReactNode } from "react";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "center" | "end" }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner align={align} className="z-50" sideOffset={6}>
        <PopoverPrimitive.Popup className="w-72 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}
```

`src/components/ui/radio-group.tsx`:

```tsx
"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { useId } from "react";

type Option = { value: string; label: string; description?: string };

export function RadioGroup({ legend, name, onValueChange, options, value }: { legend: string; name: string; value: string; onValueChange: (value: string) => void; options: Option[] }) {
  const legendId = useId();
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" id={legendId}>{legend}</p>
      <RadioGroupPrimitive aria-labelledby={legendId} className="space-y-1.5" name={name} onValueChange={(next) => onValueChange(String(next))} value={value}>
        {options.map((option) => (
          <label className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary-subtle" key={option.value}>
            <Radio.Root className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-input data-checked:border-primary" value={option.value}>
              <Radio.Indicator className="size-2 rounded-full bg-primary" />
            </Radio.Root>
            <span className="space-y-0.5">
              <span className="block text-base font-medium">{option.label}</span>
              {option.description ? <span className="block text-sm text-muted-foreground">{option.description}</span> : null}
            </span>
          </label>
        ))}
      </RadioGroupPrimitive>
    </div>
  );
}
```

Check `node_modules/@base-ui/react/radio/index.d.ts` for the exported name (`Radio` with `.Root` and `.Indicator`). If base-ui does not derive the accessible name from the wrapping `<label>`, add `aria-label={option.label}` to `Radio.Root`; the test queries `radio` by name.

`src/components/ui/toaster.tsx`:

```tsx
"use client";

import { Toaster as Sonner, toast } from "sonner";

/** One toaster for the workspace. Success toasts are polite status messages and never take focus. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "workspace rounded-lg border border-border bg-card text-foreground shadow-lg text-base",
          description: "text-sm text-muted-foreground",
        },
      }}
    />
  );
}

export function notifySuccess(message: string) {
  toast.success(message);
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/components/ui/overlays.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/ui/{dialog,alert-dialog,drawer,popover,radio-group,toaster}.tsx src/components/ui/overlays.test.tsx
git commit -m "feat: dialog, confirm dialog, drawer, popover, radio group and toasts for the workspace"
```

---

### Task 5: Tabs, SearchInput, Pagination, EmptyState, StatStrip

**Files:**
- Create:
  - `src/components/ui/tabs.tsx`
  - `src/components/ui/search-input.tsx`
  - `src/components/ui/pagination.tsx`
  - `src/components/ui/empty-state.tsx`
  - `src/components/ui/stat-strip.tsx`
- Test: `src/components/ui/kit.test.tsx`

**Interfaces:**
- Produces:
  - `Tabs({ value, onValueChange, items: { value: string; label: string; count?: number }[], label: string, children })`.
  - `TabPanel({ value, children })`.
  - `useUrlTab(param: string, allowed: readonly string[], fallback: string): [string, (value: string) => void]`.
  - `SearchInput({ label: string; value: string; onChange: (value: string) => void; placeholder?: string; delay?: number })`. Debounced (300ms) with a "Clear search" button.
  - `Pagination({ page, pageCount, total, from, to, noun, onPageChange })`.
  - `EmptyState({ title, description?, action?, icon? })` (`role="status"`).
  - `StatStrip({ label, items: { key; label; value: ReactNode; hint?: ReactNode; href? }[] })`.

- [ ] **Step 1: Write failing tests**

`src/components/ui/kit.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "./empty-state";
import { Pagination } from "./pagination";
import { SearchInput } from "./search-input";
import { StatStrip } from "./stat-strip";
import { TabPanel, Tabs } from "./tabs";

describe("workspace kit", () => {
  it("shows totals and moves between pages", async () => {
    const onPageChange = vi.fn();
    render(<Pagination from={26} noun="applications" onPageChange={onPageChange} page={2} pageCount={3} to={50} total={60} />);
    expect(screen.getByText("26–50 of 60 applications")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables page buttons at the ends", () => {
    render(<Pagination from={1} noun="rows" onPageChange={() => undefined} page={1} pageCount={1} to={3} total={3} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("debounces search and clears it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onChange = vi.fn();
    render(<SearchInput label="Search applications" onChange={onChange} value="" />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search applications" }), "ana");
    expect(onChange).not.toHaveBeenCalledWith("ana");
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(onChange).toHaveBeenLastCalledWith("ana");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    vi.useRealTimers();
  });

  it("switches tabs and shows counts", async () => {
    const onValueChange = vi.fn();
    render(
      <Tabs items={[{ value: "a", label: "Overview" }, { value: "b", label: "Documents", count: 8 }]} label="Application sections" onValueChange={onValueChange} value="a">
        <TabPanel value="a">First</TabPanel>
        <TabPanel value="b">Second</TabPanel>
      </Tabs>,
    );
    expect(screen.getByRole("tablist", { name: "Application sections" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Documents.*8/ })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("First");
    await userEvent.click(screen.getByRole("tab", { name: /Documents/ }));
    expect(onValueChange).toHaveBeenCalledWith("b");
  });

  it("renders an empty state with its action", () => {
    render(<EmptyState action={<a href="/hr/jobs/new">New job posting</a>} description="Create one to start." title="No job postings yet" />);
    expect(screen.getByRole("status")).toHaveTextContent("No job postings yet");
    expect(screen.getByRole("link", { name: "New job posting" })).toBeInTheDocument();
  });

  it("labels each stat and links it", () => {
    render(<StatStrip items={[{ key: "p", label: "Personnel", value: 160, href: "/hr/employees" }]} label="Today" />);
    expect(screen.getByRole("link", { name: /Personnel/ })).toHaveAttribute("href", "/hr/employees");
    expect(screen.getByRole("article", { name: "Personnel" })).toHaveTextContent("160");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/ui/kit.test.tsx`

Expected: FAIL (imports missing).

- [ ] **Step 3: Implement**

`src/components/ui/tabs.tsx`:

```tsx
"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

type TabItem = { value: string; label: string; count?: number };

export function Tabs({ children, items, label, onValueChange, value }: { value: string; onValueChange: (value: string) => void; items: TabItem[]; label: string; children: ReactNode }) {
  return (
    <TabsPrimitive.Root onValueChange={(next) => onValueChange(String(next))} value={value}>
      <TabsPrimitive.List aria-label={label} className="flex gap-1 overflow-x-auto border-b">
        {items.map((item) => (
          <TabsPrimitive.Tab className="-mb-px inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-base font-medium text-muted-foreground transition-colors hover:text-foreground data-selected:border-primary data-selected:text-primary" key={item.value} value={item.value}>
            {item.label}
            {item.count !== undefined ? <span className="rounded-md bg-muted px-1.5 text-xs text-secondary-foreground tabular-nums">{item.count}</span> : null}
          </TabsPrimitive.Tab>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}

export function TabPanel({ children, value }: { value: string; children: ReactNode }) {
  return <TabsPrimitive.Panel className="pt-5 outline-none" value={value}>{children}</TabsPrimitive.Panel>;
}

/** Keeps the selected tab in `?<param>=`, so links and Back restore it. */
export function useUrlTab(param: string, allowed: readonly string[], fallback: string): [string, (value: string) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = searchParams.get(param);
  const value = raw && allowed.includes(raw) ? raw : fallback;
  function setValue(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === fallback) params.delete(param); else params.set(param, next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }
  return [value, setValue];
}
```

If the base-ui `Tabs.Tab` selected attribute is not `data-selected` in 1.7, check `node_modules/@base-ui/react/tabs/tab/TabsTab.d.ts` (the `State` type) and use the matching `data-*` attribute.

`src/components/ui/search-input.tsx`:

```tsx
"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

export function SearchInput({ delay = 300, label, onChange, placeholder, value }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; delay?: number }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  function update(next: string) {
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next.trim()), delay);
  }
  return (
    <div className="relative w-full sm:w-72">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pr-9 pl-9" id={id} onChange={(event) => update(event.target.value)} placeholder={placeholder ?? label} type="search" value={draft} />
      {draft ? (
        <button aria-label="Clear search" className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground" onClick={() => { clearTimeout(timer.current); setDraft(""); onChange(""); }} type="button">
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
```

`src/components/ui/pagination.tsx`:

```tsx
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Pagination({ from, noun, onPageChange, page, pageCount, to, total }: { page: number; pageCount: number; total: number; from: number; to: number; noun: string; onPageChange: (page: number) => void }) {
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground tabular-nums">{total ? `${from}–${to} of ${total} ${noun}` : `0 ${noun}`}</p>
      <div className="flex gap-2">
        <Button aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} size="sm" type="button" variant="outline"><ChevronLeft aria-hidden="true" />Previous</Button>
        <Button aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} size="sm" type="button" variant="outline">Next<ChevronRight aria-hidden="true" /></Button>
      </div>
    </nav>
  );
}
```

`src/components/ui/empty-state.tsx`:

```tsx
import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ action, description, icon: Icon = Inbox, title }: { title: string; description?: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center" role="status">
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground"><Icon className="size-5" /></span>
      <p className="text-base font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
```

`src/components/ui/stat-strip.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

type Stat = { key: string; label: string; value: ReactNode; hint?: ReactNode; href?: string };

export function StatStrip({ items, label }: { label: string; items: Stat[] }) {
  return (
    <section aria-label={label} className="grid divide-y overflow-hidden rounded-lg border bg-card sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
      {items.map((item) => {
        const body = (
          <article aria-label={item.label} className="flex h-full flex-col gap-1 px-5 py-4">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="text-3xl font-semibold tabular-nums" data-numeric>{item.value}</p>
            {item.hint ? <p className="text-sm text-muted-foreground">{item.hint}</p> : null}
          </article>
        );
        return item.href
          ? <Link className="transition-colors hover:bg-muted focus-visible:outline-offset-[-3px]" href={item.href} key={item.key}>{body}</Link>
          : <div key={item.key}>{body}</div>;
      })}
    </section>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/ui/kit.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/{tabs,search-input,pagination,empty-state,stat-strip}.tsx src/components/ui/kit.test.tsx
git commit -m "feat: tabs, search, pagination, empty state and stat strip for the workspace kit"
```

---

### Task 6: Table helpers and URL list state

**Files:**
- Create:
  - `src/lib/workspace/table.ts`
  - `src/lib/workspace/list-params.ts`
- Test:
  - `src/lib/workspace/table.test.ts`
  - `src/lib/workspace/list-params.test.tsx`

**Interfaces:**
- Produces:
  - `type SortDirection = "asc" | "desc"`.
  - `type SortState = { key: string; direction: SortDirection }`.
  - `parseSort(raw: string | null | undefined, allowedKeys: readonly string[], fallback: SortState): SortState`. Format is `key:asc` / `key:desc`.
  - `formatSort(sort: SortState): string`.
  - `nextSort(current: SortState, key: string): SortState`. Same key toggles direction; a new key starts `asc`.
  - `sortRows<T>(rows: readonly T[], sort: SortState, accessors: Record<string, (row: T) => string | number | null | undefined>): T[]`. Stable; nulls last whatever the direction; strings compared with `localeCompare` (`sensitivity: "base"`).
  - `clampPage(raw: string | number | null | undefined, pageCount: number): number`.
  - `paginate<T>(rows: readonly T[], page: number, pageSize: number): { rows: T[]; page: number; pageCount: number; total: number; from: number; to: number }`.
  - `useListParams<K extends string>(keys: readonly K[]): { params: Record<K, string>; set: (patch: Partial<Record<K, string>>, options?: { keepPage?: boolean }) => void; clear: (keys: readonly K[]) => void }`. Empty strings delete the key. Any change to a key other than `page` resets `page` unless `keepPage` is set.

- [ ] **Step 1: Write failing tests**

`src/lib/workspace/table.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { clampPage, formatSort, nextSort, paginate, parseSort, sortRows } from "./table";

const fallback = { key: "submitted", direction: "desc" } as const;

describe("table helpers", () => {
  it("parses a valid sort and rejects junk", () => {
    expect(parseSort("name:asc", ["name", "submitted"], fallback)).toEqual({ key: "name", direction: "asc" });
    expect(parseSort("nope:asc", ["name"], fallback)).toEqual(fallback);
    expect(parseSort("name:sideways", ["name"], fallback)).toEqual(fallback);
    expect(parseSort(null, ["name"], fallback)).toEqual(fallback);
    expect(formatSort({ key: "name", direction: "desc" })).toBe("name:desc");
  });

  it("toggles direction on the same column and starts ascending on a new one", () => {
    expect(nextSort({ key: "name", direction: "asc" }, "name")).toEqual({ key: "name", direction: "desc" });
    expect(nextSort({ key: "name", direction: "desc" }, "score")).toEqual({ key: "score", direction: "asc" });
  });

  it("sorts with nulls last in both directions and keeps ties stable", () => {
    const rows = [{ id: 1, v: 5 }, { id: 2, v: null }, { id: 3, v: 9 }, { id: 4, v: 5 }];
    const accessors = { v: (row: (typeof rows)[number]) => row.v };
    expect(sortRows(rows, { key: "v", direction: "asc" }, accessors).map((r) => r.id)).toEqual([1, 4, 3, 2]);
    expect(sortRows(rows, { key: "v", direction: "desc" }, accessors).map((r) => r.id)).toEqual([3, 1, 4, 2]);
  });

  it("sorts text case-insensitively", () => {
    const rows = [{ n: "beta" }, { n: "Alpha" }];
    expect(sortRows(rows, { key: "n", direction: "asc" }, { n: (r) => r.n }).map((r) => r.n)).toEqual(["Alpha", "beta"]);
  });

  it("clamps junk and out-of-range pages", () => {
    expect(clampPage("999", 3)).toBe(3);
    expect(clampPage("abc", 3)).toBe(1);
    expect(clampPage("-2", 3)).toBe(1);
    expect(clampPage(undefined, 0)).toBe(1);
  });

  it("paginates with 1-based from/to", () => {
    const result = paginate(Array.from({ length: 60 }, (_, i) => i), 3, 25);
    expect(result).toMatchObject({ page: 3, pageCount: 3, total: 60, from: 51, to: 60 });
    expect(result.rows).toHaveLength(10);
    expect(paginate([], 1, 25)).toMatchObject({ page: 1, pageCount: 1, total: 0, from: 0, to: 0, rows: [] });
  });
});
```

`src/lib/workspace/list-params.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "q=ana&page=3" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/hr/applications",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { useListParams } from "./list-params";

beforeEach(() => { nav.replace.mockReset(); nav.search = "q=ana&page=3"; });

it("reads params with empty-string defaults", () => {
  const { result } = renderHook(() => useListParams(["q", "stage", "page"] as const));
  expect(result.current.params).toEqual({ q: "ana", stage: "", page: "3" });
});

it("resets the page when a filter changes and drops empty values", () => {
  const { result } = renderHook(() => useListParams(["q", "stage", "page"] as const));
  act(() => result.current.set({ stage: "Interview", q: "" }));
  expect(nav.replace).toHaveBeenCalledWith("/hr/applications?stage=Interview", { scroll: false });
});

it("keeps other params when only the page changes", () => {
  const { result } = renderHook(() => useListParams(["q", "page"] as const));
  act(() => result.current.set({ page: "4" }));
  expect(nav.replace).toHaveBeenCalledWith("/hr/applications?q=ana&page=4", { scroll: false });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/workspace`

Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/lib/workspace/table.ts`:

```ts
export type SortDirection = "asc" | "desc";
export type SortState = { key: string; direction: SortDirection };
type Accessor<T> = (row: T) => string | number | null | undefined;

export function parseSort(raw: string | null | undefined, allowedKeys: readonly string[], fallback: SortState): SortState {
  const [key, direction] = (raw ?? "").split(":");
  if (key && allowedKeys.includes(key) && (direction === "asc" || direction === "desc")) return { key, direction };
  return fallback;
}

export function formatSort(sort: SortState) {
  return `${sort.key}:${sort.direction}`;
}

export function nextSort(current: SortState, key: string): SortState {
  if (current.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { key, direction: "asc" };
}

function compare(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), "en", { sensitivity: "base", numeric: true });
}

export function sortRows<T>(rows: readonly T[], sort: SortState, accessors: Record<string, Accessor<T>>): T[] {
  const accessor = accessors[sort.key];
  if (!accessor) return [...rows];
  const factor = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: accessor(row) }))
    .sort((a, b) => {
      const aMissing = a.value === null || a.value === undefined || a.value === "";
      const bMissing = b.value === null || b.value === undefined || b.value === "";
      if (aMissing || bMissing) return aMissing === bMissing ? a.index - b.index : aMissing ? 1 : -1;
      return compare(a.value as string | number, b.value as string | number) * factor || a.index - b.index;
    })
    .map((entry) => entry.row);
}

export function clampPage(raw: string | number | null | undefined, pageCount: number) {
  const value = Math.trunc(Number(raw));
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(value, Math.max(1, pageCount));
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number) {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = clampPage(page, pageCount);
  const start = (current - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);
  return { rows: slice, page: current, pageCount, total, from: total ? start + 1 : 0, to: start + slice.length };
}
```

`src/lib/workspace/list-params.ts`:

```ts
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** List screen state in the URL so dashboard links, refresh and Back restore the same view. */
export function useListParams<K extends string>(keys: readonly K[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = Object.fromEntries(keys.map((key) => [key, searchParams.get(key) ?? ""])) as Record<K, string>;

  function write(next: URLSearchParams) {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function set(patch: Partial<Record<K, string>>, options: { keepPage?: boolean } = {}) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch) as [K, string | undefined][]) {
      if (value) next.set(key, value); else next.delete(key);
    }
    const onlyPage = Object.keys(patch).every((key) => key === "page");
    if (!onlyPage && !options.keepPage) next.delete("page");
    write(next);
  }

  function clear(clearKeys: readonly K[]) {
    const next = new URLSearchParams(searchParams.toString());
    for (const key of clearKeys) next.delete(key);
    next.delete("page");
    write(next);
  }

  return { params, set, clear };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/workspace`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workspace
git commit -m "feat: sorting, paging and URL list-state helpers for workspace tables"
```

---

### Task 7: DataTable and FilterBar

**Files:**
- Create:
  - `src/components/ui/data-table.tsx`
  - `src/components/ui/filter-bar.tsx`
- Test: `src/components/ui/data-table.test.tsx`

**Interfaces:**
- Consumes: `SortState`, `nextSort` (Task 6); `ErrorState` with `onRetry` (Task 3).
- Produces:
  - Column type:

    ```ts
    type DataTableColumn<T> = {
      key: string;
      header: string;
      cell: (row: T) => ReactNode;
      sortable?: boolean;
      align?: "left" | "right";
      hideBelow?: "md" | "lg";
      className?: string;
    };
    ```

  - `DataTable<T>(props)`, where `props` is:

    ```ts
    {
      caption: string;
      columns: DataTableColumn<T>[];
      rows: T[];
      getRowKey: (row: T) => string;
      getRowHref?: (row: T) => string | null;
      sort?: SortState;
      onSortChange?: (sort: SortState) => void;
      isLoading?: boolean;
      loadingLabel: string;
      error?: string | null;
      onRetry?: () => void;
      empty: ReactNode;
      footer?: ReactNode;
    }
    ```

    The `<table>` gets `data-slot="data-table"`. Sortable headers are buttons named `Sort by <header>` and set `aria-sort` on the `th`. Clicking a row navigates to `getRowHref(row)` unless the click target is inside `a, button, input, select, textarea, [role=menuitem], [role=menu]`.
  - `FilterBar({ children, chips?: { key: string; label: string; onRemove: () => void }[], onClearAll?: () => void })`. Chips are buttons named `Remove filter <label>`; the clear button is named "Clear all".

- [ ] **Step 1: Write failing tests**

`src/components/ui/data-table.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { DataTable, type DataTableColumn } from "./data-table";
import { FilterBar } from "./filter-bar";

type Row = { id: string; name: string; score: number };
const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Applicant", sortable: true, cell: (row) => <a href={`/x/${row.id}`}>{row.name}</a> },
  { key: "score", header: "AI match", sortable: true, align: "right", hideBelow: "md", cell: (row) => row.score },
  { key: "actions", header: "Actions", cell: () => <button type="button">Menu</button> },
];
const rows: Row[] = [{ id: "1", name: "Ana", score: 80 }];

describe("DataTable", () => {
  beforeEach(() => push.mockReset());

  it("marks the sorted column and asks for the next sort", async () => {
    const onSortChange = vi.fn();
    render(<DataTable caption="Applications" columns={columns} empty="None" getRowKey={(r) => r.id} loadingLabel="Loading applications…" onSortChange={onSortChange} rows={rows} sort={{ key: "name", direction: "asc" }} />);
    expect(screen.getByRole("columnheader", { name: /Applicant/ })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: /AI match/ })).toHaveAttribute("aria-sort", "none");
    await userEvent.click(screen.getByRole("button", { name: "Sort by Applicant" }));
    expect(onSortChange).toHaveBeenCalledWith({ key: "name", direction: "desc" });
  });

  it("navigates on row click but not when clicking a control inside the row", async () => {
    render(<DataTable caption="Applications" columns={columns} empty="None" getRowHref={(r) => `/hr/applications/${r.id}`} getRowKey={(r) => r.id} loadingLabel="Loading…" rows={rows} />);
    await userEvent.click(screen.getByRole("cell", { name: "80" }));
    expect(push).toHaveBeenCalledWith("/hr/applications/1");
    push.mockReset();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(push).not.toHaveBeenCalled();
  });

  it("shows loading, error and empty rows", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<DataTable caption="A" columns={columns} empty="Nothing here" getRowKey={(r) => r.id} isLoading loadingLabel="Loading applications…" rows={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading applications…");
    rerender(<DataTable caption="A" columns={columns} empty="Nothing here" error="Boom" getRowKey={(r) => r.id} loadingLabel="Loading…" onRetry={onRetry} rows={[]} />);
    await userEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<DataTable caption="A" columns={columns} empty="Nothing here" getRowKey={(r) => r.id} loadingLabel="Loading…" rows={[]} />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});

describe("FilterBar", () => {
  it("removes single filters and clears all", async () => {
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    render(<FilterBar chips={[{ key: "stage", label: "Stage: Interview", onRemove }]} onClearAll={onClearAll}><span>controls</span></FilterBar>);
    await userEvent.click(screen.getByRole("button", { name: "Remove filter Stage: Interview" }));
    expect(onRemove).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/ui/data-table.test.tsx`

Expected: FAIL (imports missing).

- [ ] **Step 3: Implement**

`src/components/ui/data-table.tsx`:

```tsx
"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { nextSort, type SortState } from "@/lib/workspace/table";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
  hideBelow?: "md" | "lg";
  className?: string;
};

type DataTableProps<T> = {
  caption: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  getRowHref?: (row: T) => string | null;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  isLoading?: boolean;
  loadingLabel: string;
  error?: string | null;
  onRetry?: () => void;
  empty: ReactNode;
  footer?: ReactNode;
};

const hideClass = { md: "hidden md:table-cell", lg: "hidden lg:table-cell" } as const;
const INTERACTIVE = "a, button, input, select, textarea, label, [role=menuitem], [role=menu]";

export function DataTable<T>({ caption, columns, empty, error, footer, getRowHref, getRowKey, isLoading, loadingLabel, onRetry, onSortChange, rows, sort }: DataTableProps<T>) {
  const router = useRouter();

  function onRowClick(event: MouseEvent<HTMLTableRowElement>, href: string | null | undefined) {
    if (!href || (event.target as HTMLElement).closest(INTERACTIVE)) return;
    if (event.metaKey || event.ctrlKey) { window.open(href, "_blank", "noopener"); return; }
    router.push(href);
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-base" data-slot="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-[1] border-b bg-muted">
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const ariaSort = !column.sortable ? undefined : active ? (sort!.direction === "asc" ? "ascending" : "descending") : "none";
                const Icon = active ? (sort!.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th aria-sort={ariaSort} className={cn("h-10 px-4 text-xs font-medium whitespace-nowrap text-muted-foreground", column.align === "right" && "text-right", column.hideBelow && hideClass[column.hideBelow])} key={column.key} scope="col">
                    {column.sortable && onSortChange && sort ? (
                      <button aria-label={`Sort by ${column.header}`} className={cn("inline-flex items-center gap-1 rounded hover:text-foreground", active && "text-foreground")} onClick={() => onSortChange(nextSort(sort, column.key))} type="button">
                        {column.header}<Icon aria-hidden="true" className="size-3.5" />
                      </button>
                    ) : column.key === "actions" ? <span className="sr-only">{column.header}</span> : column.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <>
                <tr><td className="sr-only" colSpan={columns.length}><span aria-live="polite" role="status">{loadingLabel}</span></td></tr>
                {Array.from({ length: 6 }, (_, index) => (
                  <tr aria-hidden="true" className="h-11" key={index}>
                    {columns.map((column) => <td className={cn("px-4", column.hideBelow && hideClass[column.hideBelow])} key={column.key}><Skeleton className="h-4 w-3/4" /></td>)}
                  </tr>
                ))}
              </>
            ) : error ? (
              <tr><td className="p-4" colSpan={columns.length}><ErrorState message={error} onRetry={onRetry} /></td></tr>
            ) : rows.length ? rows.map((row) => {
              const href = getRowHref?.(row);
              return (
                <tr className={cn("h-11 transition-colors hover:bg-muted/60", href && "cursor-pointer")} key={getRowKey(row)} onClick={(event) => onRowClick(event, href)}>
                  {columns.map((column) => (
                    <td className={cn("px-4 py-2 align-middle", column.align === "right" && "text-right", column.hideBelow && hideClass[column.hideBelow], column.className)} key={column.key}>{column.cell(row)}</td>
                  ))}
                </tr>
              );
            }) : (
              <tr><td colSpan={columns.length}>{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
```

`src/components/ui/filter-bar.tsx`:

```tsx
import { X } from "lucide-react";
import type { ReactNode } from "react";

type Chip = { key: string; label: string; onRemove: () => void };

export function FilterBar({ children, chips = [], onClearAll }: { children: ReactNode; chips?: Chip[]; onClearAll?: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">{children}</div>
      {chips.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary-subtle py-0.5 pr-1 pl-2 text-sm text-primary" key={chip.key}>
              {chip.label}
              <button aria-label={`Remove filter ${chip.label}`} className="grid size-5 place-items-center rounded hover:bg-primary/10" onClick={chip.onRemove} type="button"><X aria-hidden="true" className="size-3.5" /></button>
            </span>
          ))}
          {onClearAll ? <button className="text-sm font-medium text-primary underline-offset-4 hover:underline" onClick={onClearAll} type="button">Clear all</button> : null}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/ui/data-table.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/{data-table,filter-bar}.tsx src/components/ui/data-table.test.tsx
git commit -m "feat: sortable data table and filter bar for workspace lists"
```

---

### Task 8: Navigation labels, page titles, and the Leave status link

**Files:**
- Modify:
  - `src/lib/app/role-config.ts`
  - `src/lib/app/role-config.test.ts`
  - `src/components/leave-management/hr-leave.tsx`
  - `src/components/leave-management/hr-leave.test.tsx`
  - the page titles listed in Step 5

**Interfaces:**
- Produces:
  - `type NavBadgeKey = "applicationsAwaitingReview" | "leaveForApproval" | "profileChangesPending"` exported from `role-config.ts`.
  - `RoleNavigationItem.badge?: NavBadgeKey`.
  - `HrLeaveQueue` reads its initial status from `?status=`.

- [ ] **Step 1: Update the role-config test to the new navigation**

In `src/lib/app/role-config.test.ts`, replace the tests "returns HR navigation…", "exposes attendance…", "uses one account-management destination…" and "gives HR one place…" with:

```ts
  it("returns HR navigation with short labels that match page titles", () => {
    expect(getRoleConfig("hr_personnel").navigation.map(({ href, label, group, badge }) => ({ href, label, group, badge }))).toEqual([
      { href: "/hr", label: "Dashboard", group: undefined, badge: undefined },
      { href: "/hr/jobs", label: "Job postings", group: "Recruitment", badge: undefined },
      { href: "/hr/applications", label: "Applications", group: "Recruitment", badge: "applicationsAwaitingReview" },
      { href: "/hr/employees", label: "Employees", group: "Personnel", badge: undefined },
      { href: "/hr/deployments", label: "Deployments", group: "Personnel", badge: undefined },
      { href: "/hr/leave-requests", label: "Leave", group: "Personnel", badge: "leaveForApproval" },
      { href: "/hr/promotions", label: "Promotions", group: "Personnel", badge: undefined },
      { href: "/hr/attendance", label: "Attendance", group: "Attendance", badge: undefined },
      { href: "/hr/attendance/kiosk", label: "Kiosk", group: "Attendance", badge: undefined },
      { href: "/reports", label: "Reports", group: "Insights", badge: undefined },
      { href: "/hr/public-site", label: "Announcements", group: "Public site", badge: undefined },
    ]);
  });

  it("groups administrator navigation by people, organization and system", () => {
    expect(getRoleConfig("system_administrator").navigation.map(({ href, label, group }) => ({ href, label, group }))).toEqual([
      { href: "/admin", label: "Dashboard", group: undefined },
      { href: "/admin/users", label: "Accounts", group: "People" },
      { href: "/admin/profile-change-requests", label: "Approvals", group: "People" },
      { href: "/admin/departments", label: "Units / Sections", group: "Organization" },
      { href: "/admin/unit-stations", label: "Units / Stations", group: "Organization" },
      { href: "/admin/ranks", label: "Ranks", group: "Organization" },
      { href: "/admin/settings", label: "Settings", group: "System" },
      { href: "/admin/integrations/attendance", label: "Attendance integration", group: "System" },
      { href: "/admin/audit-logs", label: "Audit log", group: "System" },
    ]);
    expect(getRoleConfig("system_administrator").navigation.some((item) => item.href === "/admin/roles")).toBe(false);
  });

  it("keeps employee and management menus with tidied labels", () => {
    expect(getRoleConfig("employee").navigation.map(({ label }) => label)).toEqual(["Dashboard", "My profile", "Leave", "Deployments", "Promotion", "Attendance", "Scan"]);
    expect(getRoleConfig("management").navigation.map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/management", label: "Dashboard" },
      { href: "/reports", label: "Reports" },
    ]);
    expect(getRoleConfig("management").landingTitle).toBe("Dashboard");
  });
```

Keep "defines one landing page…", "keeps grouped navigation items adjacent…" and "puts Job Openings in the applicant sidebar". The applicant config does not change.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/lib/app/role-config.test.ts`

Expected: FAIL (old labels).

- [ ] **Step 3: Rewrite the navigation in `role-config.ts`**

Add after the `RoleNavigationIcon` type:

```ts
/** Live counts shown beside a nav item (src/hooks/use-workspace-counts.ts). */
export type NavBadgeKey = "applicationsAwaitingReview" | "leaveForApproval" | "profileChangesPending";
```

Add `badge?: NavBadgeKey;` to `RoleNavigationItem`.

Replace the `navigation` arrays for `system_administrator`, `hr_personnel`, `employee` and `management`. Leave `applicant` untouched. Change the management `landingTitle` to `"Dashboard"`.

```ts
    // system_administrator
    navigation: [
      { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/admin/users", label: "Accounts", icon: "Users", group: "People" },
      { href: "/admin/profile-change-requests", label: "Approvals", icon: "UserPen", group: "People", badge: "profileChangesPending" },
      { href: "/admin/departments", label: "Units / Sections", icon: "Building2", group: "Organization" },
      { href: "/admin/unit-stations", label: "Units / Stations", icon: "MapPin", group: "Organization" },
      { href: "/admin/ranks", label: "Ranks", icon: "BriefcaseBusiness", group: "Organization" },
      { href: "/admin/settings", label: "Settings", icon: "Settings", group: "System" },
      { href: "/admin/integrations/attendance", label: "Attendance integration", icon: "Fingerprint", group: "System" },
      { href: "/admin/audit-logs", label: "Audit log", icon: "ScrollText", group: "System" },
    ],
```

```ts
    // hr_personnel
    navigation: [
      { href: "/hr", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/hr/jobs", label: "Job postings", icon: "BriefcaseBusiness", group: "Recruitment" },
      { href: "/hr/applications", label: "Applications", icon: "FileText", group: "Recruitment", badge: "applicationsAwaitingReview" },
      { href: "/hr/employees", label: "Employees", icon: "ContactRound", group: "Personnel" },
      { href: "/hr/deployments", label: "Deployments", icon: "MapPin", group: "Personnel" },
      { href: "/hr/leave-requests", label: "Leave", icon: "CalendarDays", group: "Personnel", badge: "leaveForApproval" },
      { href: "/hr/promotions", label: "Promotions", icon: "TrendingUp", group: "Personnel" },
      { href: "/hr/attendance", label: "Attendance", icon: "Clock", group: "Attendance" },
      { href: "/hr/attendance/kiosk", label: "Kiosk", icon: "Fingerprint", group: "Attendance" },
      { href: "/reports", label: "Reports", icon: "ChartColumn", group: "Insights" },
      { href: "/hr/public-site", label: "Announcements", icon: "ScrollText", group: "Public site" },
    ],
```

```ts
    // employee
    navigation: [
      { href: "/employee", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/employee/profile", label: "My profile", icon: "ContactRound" },
      { href: "/employee/leave", label: "Leave", icon: "CalendarDays" },
      { href: "/employee/deployments", label: "Deployments", icon: "MapPin" },
      { href: "/employee/promotion-eligibility", label: "Promotion", icon: "TrendingUp" },
      { href: "/employee/attendance", label: "Attendance", icon: "Clock" },
      { href: "/employee/attendance/scan", label: "Scan", icon: "Fingerprint" },
    ],
```

```ts
    // management
    navigation: [
      { href: "/management", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/reports", label: "Reports", icon: "ChartColumn" },
    ],
```

- [ ] **Step 4: Make the Leave queue honour `?status=`**

In `src/components/leave-management/hr-leave.tsx`:

- Add `import { useSearchParams } from "next/navigation";`.
- Change the first lines of `HrLeaveQueue` to:

```tsx
export function HrLeaveQueue() {
  // The dashboard links here with ?status=pending so the queue opens on For Approval.
  const requested = useSearchParams().get("status");
  const [status, setStatus] = useState<LeaveRequestStatus | "">(
    statusOptions.some((option) => option.value === requested) ? (requested as LeaveRequestStatus) : "",
  );
```

In `src/components/leave-management/hr-leave.test.tsx`, add a navigation mock above the imports of the component:

```tsx
const navigation = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.search) }));
```

Then add the test, and set `navigation.search = ""` in the existing `beforeEach` blocks:

```tsx
describe("HrLeaveQueue status link", () => {
  it("opens on the status named in the URL and ignores unknown values", () => {
    navigation.search = "status=pending";
    const { unmount } = render(<HrLeaveQueue />);
    expect(mocks.hrQueueInput).toHaveBeenLastCalledWith(expect.objectContaining({ status: "pending" }));
    unmount();
    navigation.search = "status=bogus";
    render(<HrLeaveQueue />);
    expect(mocks.hrQueueInput).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined }));
  });
});
```

- [ ] **Step 5: Match the page titles to the new labels (copy only)**

| File | Old title | New title |
|---|---|---|
| `src/app/(app)/hr/employees/page.tsx` | "Employee Records" | "Employees" |
| `src/app/(app)/hr/leave-requests/page.tsx` | "Leave requests" | "Leave" |
| `src/app/(app)/hr/promotions/page.tsx` | "Promotion reviews" | "Promotions" |
| `src/app/(app)/hr/public-site/page.tsx` | "Public Announcements" | "Announcements" |
| `src/app/(app)/admin/users/page.tsx` | "Account Management" | "Accounts" |
| `src/app/(app)/admin/profile-change-requests/page.tsx` | "Reviews & Approvals" | "Approvals" |
| `src/app/(app)/admin/audit-logs/page.tsx` | "Audit logs" | "Audit log" |
| `src/app/(app)/employee/attendance/scan/page.tsx` | "Scan attendance" | "Scan" |

- In `src/components/attendance-integration/attendance-integration-settings.tsx`, change the hand-written h1 text to "Attendance integration".
- In `src/components/profile-change-requests/admin-profile-change-request-detail.tsx`, change the "Back to Reviews & Approvals" link text to "Back to Approvals".

Find every test or e2e that asserts an old title or link:

```bash
grep -rn "Employee Records\|Leave requests\|Promotion reviews\|Public Announcements\|Account Management\|Reviews & Approvals\|Audit logs\|Scan attendance\|Attendance Integration\|Daily Attendance\|Attendance Records\|Job Posting\|Management workspace" src e2e --include=*.ts --include=*.tsx
```

Update each hit in `*.test.tsx` and `e2e/*.ts` to the new text. Leave `app-shell.test.tsx` for Task 10.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/lib/app src/components/leave-management src/app src/components/administration src/components/profile-change-requests src/components/attendance-integration`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/app src/components/leave-management src/app src/components/attendance-integration src/components/profile-change-requests src/components/administration e2e
git commit -m "feat: shorter workspace navigation labels and matching page titles"
```

---

### Task 9: Live counts for nav badges and the dashboard

**Files:**
- Create:
  - `src/queries/workspace-counts.ts`
  - `src/hooks/use-workspace-counts.ts`
  - `src/components/workspace-shell/nav-badge.tsx`
- Modify: `src/lib/query-keys.ts`
- Test:
  - `src/queries/workspace-counts.test.ts`
  - `src/components/workspace-shell/nav-badge.test.tsx`

**Interfaces:**
- Consumes: `NavBadgeKey` (Task 8).
- Produces:
  - `type WorkspaceCountKey = NavBadgeKey | "unmatchedAttendance"`.
  - `getWorkspaceCount(key: WorkspaceCountKey): Promise<number>`.
  - `useWorkspaceCount(key: WorkspaceCountKey, enabled = true)` (TanStack query: 60s refetch, refetch on focus, `retry: 1`).
  - `NavBadge({ badge: NavBadgeKey })`. Renders nothing on error, loading, or zero. Otherwise it renders an `aria-hidden` pill plus `<span class="sr-only">N waiting</span>`.
  - `queryKeys.workspace.count(key)`.

- [ ] **Step 1: Write failing tests**

`src/queries/workspace-counts.test.ts`:

```ts
import { beforeEach, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ table: "", filters: [] as Array<[string, string, unknown]>, result: { count: 4, error: null as { message: string } | null } }));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: (table: string) => {
      calls.table = table;
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => { calls.filters.push(["eq", column, value]); return builder; },
        is: (column: string, value: unknown) => { calls.filters.push(["is", column, value]); return builder; },
        then: (resolve: (value: unknown) => unknown) => resolve(calls.result),
      };
      return builder;
    },
  }),
}));

import { getWorkspaceCount } from "./workspace-counts";

beforeEach(() => { calls.filters = []; calls.result = { count: 4, error: null }; });

it.each([
  ["applicationsAwaitingReview", "applications", ["eq", "status", "Submitted"]],
  ["leaveForApproval", "leave_requests", ["eq", "status", "pending"]],
  ["profileChangesPending", "profile_change_requests", ["eq", "status", "pending"]],
  ["unmatchedAttendance", "attendance_unmatched_events", ["is", "resolved_at", null]],
] as const)("counts %s from %s", async (key, table, filter) => {
  await expect(getWorkspaceCount(key)).resolves.toBe(4);
  expect(calls.table).toBe(table);
  expect(calls.filters).toContainEqual(filter);
});

it("throws when the count query fails", async () => {
  calls.result = { count: 0, error: { message: "denied" } };
  await expect(getWorkspaceCount("leaveForApproval")).rejects.toThrow("denied");
});
```

`src/components/workspace-shell/nav-badge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ value: { data: 3 as number | undefined, isError: false } }));
vi.mock("@/hooks/use-workspace-counts", () => ({ useWorkspaceCount: () => state.value }));

import { NavBadge } from "./nav-badge";

it("shows the count with a screen-reader phrase", () => {
  state.value = { data: 3, isError: false };
  render(<NavBadge badge="leaveForApproval" />);
  expect(screen.getByText("3 waiting")).toHaveClass("sr-only");
});

it("hides the badge on error and at zero", () => {
  state.value = { data: undefined, isError: true };
  const { container, rerender } = render(<NavBadge badge="leaveForApproval" />);
  expect(container).toBeEmptyDOMElement();
  state.value = { data: 0, isError: false };
  rerender(<NavBadge badge="leaveForApproval" />);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/queries/workspace-counts.test.ts src/components/workspace-shell/nav-badge.test.tsx`

Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/queries/workspace-counts.ts`:

```ts
import type { NavBadgeKey } from "@/lib/app/role-config";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export type WorkspaceCountKey = NavBadgeKey | "unmatchedAttendance";

/** Head-only counts (no rows transferred) for nav badges and the dashboard's attention list. */
export async function getWorkspaceCount(key: WorkspaceCountKey): Promise<number> {
  const client = createBrowserSupabaseClient();
  const head = { count: "exact" as const, head: true };
  const query =
    key === "applicationsAwaitingReview" ? client.from("applications").select("id", head).eq("status", "Submitted")
    : key === "leaveForApproval" ? client.from("leave_requests").select("id", head).eq("status", "pending")
    : key === "profileChangesPending" ? client.from("profile_change_requests").select("id", head).eq("status", "pending")
    : client.from("attendance_unmatched_events").select("id", head).is("resolved_at", null);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}
```

In `src/lib/query-keys.ts`, add inside `queryKeys`:

```ts
  workspace: {
    count: (key: string) => ["workspace", "count", key] as const,
  },
```

`src/hooks/use-workspace-counts.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getWorkspaceCount, type WorkspaceCountKey } from "@/queries/workspace-counts";

export function useWorkspaceCount(key: WorkspaceCountKey, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspace.count(key),
    queryFn: () => getWorkspaceCount(key),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
```

`src/components/workspace-shell/nav-badge.tsx`:

```tsx
"use client";

import { useWorkspaceCount } from "@/hooks/use-workspace-counts";
import type { NavBadgeKey } from "@/lib/app/role-config";

/** A count beside a nav link. Sits outside the link so the link's name stays stable. */
export function NavBadge({ badge }: { badge: NavBadgeKey }) {
  const { data, isError } = useWorkspaceCount(badge);
  if (isError || !data) return null;
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2 min-w-5 -translate-y-1/2 rounded-md bg-primary px-1.5 text-center text-xs leading-5 font-semibold text-primary-foreground tabular-nums group-data-[collapsible=icon]:hidden">
        {data > 99 ? "99+" : data}
      </span>
      <span className="sr-only">{data} waiting</span>
    </>
  );
}
```

Also invalidate the badge counts when the related work changes. In `src/hooks/use-recruitment.ts`, in `useTransitionApplicationStatus().onSuccess` add:

```ts
      void queryClient.invalidateQueries({ queryKey: ["workspace", "count"] });
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/queries/workspace-counts.test.ts src/components/workspace-shell/nav-badge.test.tsx src/hooks`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/queries/workspace-counts.ts src/queries/workspace-counts.test.ts src/hooks/use-workspace-counts.ts src/components/workspace-shell/nav-badge.tsx src/components/workspace-shell/nav-badge.test.tsx src/lib/query-keys.ts src/hooks/use-recruitment.ts
git commit -m "feat: live counts for workspace nav badges"
```

---

### Task 10: WorkspaceShell, breadcrumbs, PageContainer, and shell selection

**Files:**
- Create:
  - `src/components/workspace-shell/workspace-shell.tsx`
  - `src/components/workspace-shell/breadcrumbs.tsx`
  - `src/components/workspace-shell/page-container.tsx`
  - `src/components/workspace-shell/nav-icons.ts`
- Modify:
  - `src/app/(app)/layout.tsx`
  - `src/components/app-shell/app-shell.tsx` (import icons from the shared map)
  - `src/components/app-shell/app-shell.test.tsx`
- Test: `src/components/workspace-shell/workspace-shell.test.tsx`

**Interfaces:**
- Consumes: `RoleConfig` (Task 8); `NavBadge` (Task 9); `Toaster` (Task 4).
- Produces:
  - `WorkspaceShell({ children, config, email })`, with the same props as `AppShell`.
  - `PageContainer({ width: "wide" | "narrow"; children; className? })`. Renders `<div data-page-width>`; the shell widens or narrows to it via CSS `:has()`.
  - `useBreadcrumbTrail(trail: { label: string; href?: string }[])`. A page calls it to extend the breadcrumb after the section crumb.
  - `NAVIGATION_ICONS` exported from `nav-icons.ts`.

- [ ] **Step 1: Move the icon map so both shells share it**

Create `src/components/workspace-shell/nav-icons.ts`:

```ts
import {
  BriefcaseBusiness, Building2, CalendarDays, ChartColumn, Clock, ContactRound, FileText, Fingerprint,
  LayoutDashboard, MapPin, ScrollText, Settings, ShieldCheck, TrendingUp, UserPen, Users, type LucideIcon,
} from "lucide-react";

import type { RoleNavigationIcon } from "@/lib/app/role-config";

export const NAVIGATION_ICONS: Record<RoleNavigationIcon, LucideIcon> = {
  BriefcaseBusiness, Building2, CalendarDays, ChartColumn, Clock, ContactRound, FileText, Fingerprint,
  LayoutDashboard, MapPin, ScrollText, Settings, ShieldCheck, TrendingUp, UserPen, Users,
};
```

In `app-shell.tsx`:

- Delete the local `NAVIGATION_ICONS` constant and the icon imports it used (keep `PanelLeft`).
- Import `NAVIGATION_ICONS` from `@/components/workspace-shell/nav-icons`.

The rendered output is unchanged.

- [ ] **Step 2: Write the failing shell tests**

`src/components/workspace-shell/workspace-shell.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_CONFIG } from "@/lib/app/role-config";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/notifications/notification-bell", () => ({ NotificationBell: () => <a href="/notifications">Notifications</a> }));
vi.mock("@/components/workspace-shell/nav-badge", () => ({ NavBadge: ({ badge }: { badge: string }) => <span>badge:{badge}</span> }));

import { useBreadcrumbTrail } from "./breadcrumbs";
import { WorkspaceShell } from "./workspace-shell";

function DetailPage() {
  useBreadcrumbTrail([{ label: "Aplica Candidate" }]);
  return <h1>Aplica Candidate</h1>;
}

describe("WorkspaceShell", () => {
  beforeEach(() => usePathname.mockReturnValue("/hr"));

  it("scopes the workspace theme to the document while mounted", () => {
    const { unmount } = render(<WorkspaceShell config={ROLE_CONFIG.hr_personnel} email="hr@example.com"><p>x</p></WorkspaceShell>);
    expect(document.documentElement).toHaveClass("workspace");
    unmount();
    expect(document.documentElement).not.toHaveClass("workspace");
  });

  it("groups HR navigation, marks the most specific link current and shows badges beside links", () => {
    usePathname.mockReturnValue("/hr/attendance/kiosk");
    render(<WorkspaceShell config={ROLE_CONFIG.hr_personnel} email="hr@example.com"><p>Kiosk</p></WorkspaceShell>);
    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    for (const heading of ["Recruitment", "Personnel", "Attendance", "Insights", "Public site"]) {
      expect(within(navigation).getByText(heading, { selector: "div" })).toBeInTheDocument();
    }
    expect(within(navigation).getByRole("link", { name: "Kiosk" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: "Attendance" })).not.toHaveAttribute("aria-current");
    expect(within(navigation).getByRole("link", { name: "Applications" })).toBeInTheDocument();
    expect(within(navigation).getByText("badge:applicationsAwaitingReview")).toBeInTheDocument();
  });

  it("keeps landmarks, the skip link, the brand line and the account menu", () => {
    render(<WorkspaceShell config={ROLE_CONFIG.management} email="manager@example.com"><p>x</p></WorkspaceShell>);
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("button", { name: /toggle sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "San Juan City Police Station logo" })).toBeInTheDocument();
    expect(screen.getByTestId("brand-command-accent")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("button", { name: "Account menu for manager@example.com" })).toBeInTheDocument();
  });

  it("extends the breadcrumb with the page's trail and links the section", () => {
    usePathname.mockReturnValue("/hr/applications/123e4567-e89b-42d3-a456-426614174000");
    render(<WorkspaceShell config={ROLE_CONFIG.hr_personnel} email="hr@example.com"><DetailPage /></WorkspaceShell>);
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Applications" })).toHaveAttribute("href", "/hr/applications");
    expect(within(breadcrumb).getByText("Aplica Candidate")).toHaveAttribute("aria-current", "page");
  });
});
```

Replace `src/components/app-shell/app-shell.test.tsx` with an applicant-only version. `AppShell` now serves applicants only:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_CONFIG } from "@/lib/app/role-config";

import { AppShell } from "./app-shell";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/notifications/notification-bell", () => ({ NotificationBell: () => <a href="/notifications">Notifications</a> }));

describe("AppShell (applicant)", () => {
  beforeEach(() => usePathname.mockReturnValue("/applicant"));

  it("shows the applicant navigation and identifies the current page", () => {
    render(<AppShell config={ROLE_CONFIG.applicant} email="a@example.com"><p>Applicant</p></AppShell>);
    const navigation = screen.getByRole("navigation", { name: /main navigation/i });
    expect(within(navigation).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: "Job Openings" })).toHaveAttribute("href", "/jobs");
  });

  it("keeps the original landmarks and brand", () => {
    render(<AppShell config={ROLE_CONFIG.applicant} email="a@example.com"><p>Applicant</p></AppShell>);
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("button", { name: /toggle sidebar/i })).toHaveClass("min-h-11");
    expect(screen.getByText("San Juan City Police Station")).toBeInTheDocument();
    expect(screen.getByTestId("brand-command-accent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu for a@example.com" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/components/workspace-shell src/components/app-shell`

Expected: workspace-shell tests FAIL (module missing); app-shell tests PASS.

- [ ] **Step 4: Implement the breadcrumbs and the page container**

`src/components/workspace-shell/breadcrumbs.tsx`:

```tsx
"use client";

import Link from "next/link";
import { createContext, Fragment, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

export type Crumb = { label: string; href?: string };

const TrailContext = createContext<{ trail: Crumb[]; setTrail: (trail: Crumb[]) => void } | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [trail, setTrail] = useState<Crumb[]>([]);
  const value = useMemo(() => ({ trail, setTrail }), [trail]);
  return <TrailContext.Provider value={value}>{children}</TrailContext.Provider>;
}

/** A detail page names itself in the breadcrumb, e.g. Applications › Juan Dela Cruz. */
export function useBreadcrumbTrail(trail: Crumb[]) {
  const context = useContext(TrailContext);
  const key = JSON.stringify(trail);
  const setTrail = context?.setTrail;
  useEffect(() => {
    if (!setTrail) return;
    setTrail(JSON.parse(key) as Crumb[]);
    return () => setTrail([]);
  }, [key, setTrail]);
}

export function WorkspaceBreadcrumbs({ section }: { section: { label: string; href: string } }) {
  const trail = useContext(TrailContext)?.trail ?? [];
  const crumbs: Crumb[] = [{ label: section.label, href: trail.length ? section.href : undefined }, ...trail];
  return (
    <Breadcrumb aria-label="Breadcrumb" className="min-w-0">
      <BreadcrumbList className="flex-nowrap text-white/70">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator className="text-white/40" /> : null}
              <BreadcrumbItem className="min-w-0">
                {last || !crumb.href
                  ? <BreadcrumbPage className="truncate font-semibold text-white">{crumb.label}</BreadcrumbPage>
                  : <Link className="truncate rounded hover:text-white" href={crumb.href}>{crumb.label}</Link>}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
```

`BreadcrumbSeparator` and `BreadcrumbItem` are both `<li>` elements in `src/components/ui/breadcrumb.tsx`, which is why they are siblings here. `BreadcrumbPage` already renders `aria-current="page"`.

`src/components/workspace-shell/page-container.tsx`:

```tsx
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Declares how wide a redesigned page is. The shell's content column reads this through
 * CSS :has(), so pages that do not use it keep today's 1152px width.
 */
export function PageContainer({ children, className, width }: { width: "wide" | "narrow"; children: ReactNode; className?: string }) {
  return <div className={cn("space-y-6", className)} data-page-width={width}>{children}</div>;
}
```

- [ ] **Step 5: Implement `WorkspaceShell`**

`src/components/workspace-shell/workspace-shell.tsx`:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { PanelLeft } from "lucide-react";

import { AccountMenu } from "@/components/auth/account-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Toaster } from "@/components/ui/toaster";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { RoleConfig, RoleNavigationItem } from "@/lib/app/role-config";

import { BreadcrumbProvider, WorkspaceBreadcrumbs } from "./breadcrumbs";
import { NavBadge } from "./nav-badge";
import { NAVIGATION_ICONS } from "./nav-icons";

type WorkspaceShellProps = { children: ReactNode; config: RoleConfig; email: string | null };

function groupNavigation(items: readonly RoleNavigationItem[]) {
  const groups: { label: string | null; items: RoleNavigationItem[] }[] = [];
  for (const item of items) {
    const label = item.group ?? null;
    const current = groups.at(-1);
    if (current && current.label === label) current.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

/** Laptop widths start with the icon rail unless the user already chose (shadcn stores the choice in a cookie). */
function CollapseOnLaptop() {
  const { setOpen } = useSidebar();
  useEffect(() => {
    if (document.cookie.includes("sidebar_state=")) return;
    if (window.matchMedia("(min-width: 768px) and (max-width: 1279px)").matches) setOpen(false);
  }, [setOpen]);
  return null;
}

/** After client navigation, move focus to the new page's heading for screen-reader users. */
function useFocusHeadingOnRouteChange(pathname: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const frame = requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("#main-content h1");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
}

export function WorkspaceShell({ children, config, email }: WorkspaceShellProps) {
  const pathname = usePathname();
  const active = config.navigation
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .toSorted((left, right) => right.href.length - left.href.length)[0];
  const section = active ?? (pathname === "/notifications" ? { href: "/notifications" as const, label: "Notifications" } : { href: config.homeHref, label: config.landingTitle });

  // Overlays render in portals under <body>; scoping <html> gives them the workspace tokens too.
  useEffect(() => {
    document.documentElement.classList.add("workspace");
    return () => document.documentElement.classList.remove("workspace");
  }, []);
  useFocusHeadingOnRouteChange(pathname);

  return (
    <TooltipProvider>
      <BreadcrumbProvider>
        <SidebarProvider className="workspace h-svh overflow-hidden" style={{ "--sidebar-width": "15.5rem", "--sidebar-width-icon": "4rem" } as React.CSSProperties}>
          <CollapseOnLaptop />
          <a className="sr-only fixed top-4 left-4 z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only" href="#main-content">
            Skip to main content
          </a>
          <Sidebar className="app-sidebar border-sidebar-border" collapsible="icon">
            <SidebarHeader className="px-3 pt-4 pb-3">
              <Link className="flex items-center gap-3 rounded-md p-1 group-data-[collapsible=icon]:justify-center" href={config.homeHref}>
                <Image alt="San Juan City Police Station logo" className="size-8 shrink-0 object-contain" height={32} priority src="/san-juan-police-logo.png" width={32} />
                <span className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="block truncate text-base font-semibold text-foreground">San Juan CPS</span>
                  <span className="block text-sm text-muted-foreground">HRIS</span>
                </span>
              </Link>
            </SidebarHeader>
            <SidebarContent className="pb-4">
              <nav aria-label="Main navigation">
                {groupNavigation(config.navigation).map((group, index) => (
                  <SidebarGroup className="px-3 py-1.5" key={group.label ?? `ungrouped-${index}`}>
                    {group.label ? (
                      <SidebarGroupLabel className="h-7 px-2 text-xs font-medium tracking-normal text-muted-foreground normal-case">{group.label}</SidebarGroupLabel>
                    ) : null}
                    <SidebarGroupContent>
                      <SidebarMenu className="gap-0.5">
                        {group.items.map((item) => {
                          const isActive = active?.href === item.href;
                          const Icon = NAVIGATION_ICONS[item.icon];
                          return (
                            <SidebarMenuItem className="relative" key={item.href}>
                              <SidebarMenuButton
                                className="h-9 gap-3 rounded-md px-3 text-base font-medium text-sidebar-foreground hover:bg-muted hover:text-foreground data-active:bg-primary-subtle data-active:font-semibold data-active:text-primary data-active:shadow-[inset_2px_0_0_var(--primary)] [&_svg]:size-[18px]"
                                isActive={isActive}
                                render={<Link aria-current={isActive ? "page" : undefined} href={item.href} />}
                                tooltip={item.label}
                              >
                                <Icon aria-hidden="true" />
                                <span>{item.label}</span>
                              </SidebarMenuButton>
                              {item.badge ? <NavBadge badge={item.badge} /> : null}
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                ))}
              </nav>
            </SidebarContent>
          </Sidebar>
          <SidebarInset className="min-w-0 overflow-y-auto overscroll-contain bg-background" id="main-content">
            <header className="dark sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 bg-topbar px-3 text-foreground sm:px-4">
              <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-command-red" data-testid="brand-command-accent" />
              <SidebarTrigger aria-label="Toggle sidebar" className="size-9 text-white/80 hover:bg-white/10 hover:text-white">
                <PanelLeft aria-hidden="true" />
              </SidebarTrigger>
              <WorkspaceBreadcrumbs section={section} />
              <div className="ml-auto flex items-center gap-1">
                <NotificationBell />
                <AccountMenu email={email} roleLabel={config.label} />
              </div>
            </header>
            <div className="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-6 2xl:px-8">
              <div className="mx-auto w-full max-w-6xl min-w-0 has-[[data-page-width=narrow]]:max-w-[60rem] has-[[data-page-width=wide]]:max-w-[90rem]">{children}</div>
            </div>
          </SidebarInset>
          <Toaster />
        </SidebarProvider>
      </BreadcrumbProvider>
    </TooltipProvider>
  );
}
```

Check `SidebarMenuButton`'s props in `src/components/ui/sidebar.tsx`:

- If it does not accept `tooltip`, remove that prop.
- If its `isActive` sets `data-active` under a different attribute name, adjust the `data-active:` classes to match.
- The 1279px/767px media query matches shadcn's 768px mobile breakpoint (`src/hooks/use-mobile.ts`). Below 768px the sidebar is an off-canvas sheet.

- [ ] **Step 6: Pick the shell by role**

`src/app/(app)/layout.tsx`: import `WorkspaceShell` and replace the return with:

```tsx
  const Shell = role === "applicant" ? AppShell : WorkspaceShell;

  return (
    <QueryProvider>
      <Shell config={getRoleConfig(role)} email={user.email}>
        {children}
      </Shell>
    </QueryProvider>
  );
```

- [ ] **Step 7: Run tests, typecheck, and the baseline**

Run: `npx vitest run src/components/workspace-shell src/components/app-shell && npm run typecheck && npx playwright test e2e/applicant-visual-baseline.spec.ts`

Expected: PASS. The applicant baseline is still identical.

- [ ] **Step 8: Look at it**

Run `npm run dev`, sign in as `demo.hr@example.test` (password `DemoPass!2026`), and open `/hr` at 1440, 1280, 1100 and 390px widths. Confirm:

- the white sidebar with a 32px logo,
- the navy 56px top bar with the red line,
- the rail at 1100px,
- the drawer at 390px,
- dropdown menus (account menu) using the navy tokens.

- [ ] **Step 9: Commit**

```bash
git add src/components/workspace-shell src/components/app-shell src/app/\(app\)/layout.tsx
git commit -m "feat: workspace shell with grouped navigation, count badges and page breadcrumbs"
```

---

### Task 11: HR and Management dashboard

**Files:**
- Create:
  - `src/lib/workspace/date-range.ts`
  - `src/lib/recruitment/application-stages.ts` (stage lists only; Task 14 adds the rest)
  - `src/components/reporting/attention-list.tsx`
  - `src/components/reporting/workspace-dashboard.tsx`
- Modify:
  - `src/queries/recruitment.ts` (add `listRecentApplications`)
  - `src/hooks/use-recruitment.ts` (add `useRecentApplications`)
  - `src/components/reporting/charts.tsx` (restyle `ChartCard`, delete `KpiTile`, `DonutChart`, `GaugeChart`)
  - `src/app/(app)/hr/page.tsx`
  - `src/app/(app)/management/page.tsx`
- Delete:
  - `src/components/reporting/dashboard.tsx`
  - `src/components/reporting/dashboard.test.tsx`
- Test:
  - `src/lib/workspace/date-range.test.ts`
  - `src/components/reporting/attention-list.test.tsx`
  - `src/components/reporting/workspace-dashboard.test.tsx`

**Interfaces:**
- Produces:
  - `type PeriodPreset = "7d" | "30d" | "month" | "custom"`.
  - `resolvePeriod(params: { period: string; from: string; to: string }, today?: Date): { preset: PeriodPreset; startsOn: string; endsOn: string }`.
  - `PIPELINE_STAGES: readonly ApplicationStatus[]`. These are the 8 forward stages, Submitted…Hired.
  - `ACTIVE_STAGES: readonly ApplicationStatus[]`. These are Submitted, Under Review, Shortlisted, Interview, Needs Revision, Endorsed to Crame, Neuro Exam, For Training.
  - `AttentionList({ items: AttentionItem[] })`, where `AttentionItem = { key: string; label: string; count: number | null; href: string; icon: LucideIcon }`.
  - `WorkspaceDashboard({ role: "hr_personnel" | "management" })`.
  - `listRecentApplications(limit = 5)` returns `RecentApplication[]`, where `RecentApplication = { id: string; status: ApplicationStatus; submitted_at: string; applicant_name: string | null; job_title: string | null }`.
  - `useRecentApplications(enabled = true)`.

- [ ] **Step 1: Write the failing tests**

`src/lib/workspace/date-range.test.ts`:

```ts
import { expect, it } from "vitest";

import { resolvePeriod } from "./date-range";

const today = new Date("2026-10-08T03:00:00Z");

it("resolves presets ending today", () => {
  expect(resolvePeriod({ period: "7d", from: "", to: "" }, today)).toEqual({ preset: "7d", startsOn: "2026-10-02", endsOn: "2026-10-08" });
  expect(resolvePeriod({ period: "", from: "", to: "" }, today)).toEqual({ preset: "30d", startsOn: "2026-09-09", endsOn: "2026-10-08" });
  expect(resolvePeriod({ period: "month", from: "", to: "" }, today)).toEqual({ preset: "month", startsOn: "2026-10-01", endsOn: "2026-10-08" });
});

it("accepts a valid custom range and falls back on junk", () => {
  expect(resolvePeriod({ period: "custom", from: "2026-01-01", to: "2026-01-31" }, today)).toEqual({ preset: "custom", startsOn: "2026-01-01", endsOn: "2026-01-31" });
  expect(resolvePeriod({ period: "custom", from: "2026-02-01", to: "2026-01-01" }, today).preset).toBe("30d");
  expect(resolvePeriod({ period: "custom", from: "nope", to: "" }, today).preset).toBe("30d");
  expect(resolvePeriod({ period: "weird", from: "", to: "" }, today).preset).toBe("30d");
});
```

`src/components/reporting/attention-list.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { CalendarDays, FileText, Fingerprint } from "lucide-react";
import { expect, it } from "vitest";

import { AttentionList } from "./attention-list";

const base = [
  { key: "apps", label: "Applications awaiting review", count: 3, href: "/hr/applications?stage=Submitted", icon: FileText },
  { key: "leave", label: "Leave requests for approval", count: 0, href: "/hr/leave-requests?status=pending", icon: CalendarDays },
  { key: "unmatched", label: "Unmatched attendance IDs", count: null, href: "/hr/attendance/unmatched", icon: Fingerprint },
];

it("lists open work as links, shows unknown counts as a dash, and folds clear rows into one line", () => {
  render(<AttentionList items={base} />);
  expect(screen.getByRole("link", { name: /Applications awaiting review.*3/ })).toHaveAttribute("href", "/hr/applications?stage=Submitted");
  expect(screen.getByRole("link", { name: /Unmatched attendance IDs.*—/ })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Leave requests/ })).not.toBeInTheDocument();
  expect(screen.getByText("All clear: leave requests for approval")).toBeInTheDocument();
});

it("says so when everything is caught up", () => {
  render(<AttentionList items={base.map((item) => ({ ...item, count: 0 }))} />);
  expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
```

`src/components/reporting/workspace-dashboard.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/hr",
  useSearchParams: () => new URLSearchParams(""),
}));

const summary = {
  generatedAt: "2026-10-08T00:00:00Z",
  range: { startsOn: "2026-09-09", endsOn: "2026-10-08" },
  metrics: { totalPersonnel: 160, attendanceToday: 142, activeWorkforce: 160, onLeave: 4, activeDeployments: 7, openJobs: 2, hiredApplicants: 1, pendingLeave: 2, attendanceExceptions: 5, trainingNeeds: 0 },
  breakdowns: {
    recruitmentPipeline: [{ label: "Submitted", count: 3 }, { label: "Interview", count: 1 }, { label: "Not Selected", count: 2 }],
    attendanceTrend: [{ label: "2026-10-07", count: 140 }],
    attendanceStatus: [{ label: "present", count: 130 }, { label: "late", count: 10 }],
    workforceByDepartment: [{ label: "Patrol", count: 90 }],
    workforceByRank: [{ label: "PAT", count: 50 }],
  },
};
vi.mock("@/hooks/use-reporting", () => ({
  useHrDashboard: () => ({ isLoading: false, error: null, data: summary, refetch: vi.fn() }),
  useManagementDashboard: () => ({ isLoading: false, error: null, data: summary, refetch: vi.fn() }),
}));
vi.mock("@/hooks/use-workspace-counts", () => ({ useWorkspaceCount: (key: string) => ({ data: key === "applicationsAwaitingReview" ? 3 : 0, isError: false }) }));
vi.mock("@/hooks/use-recruitment", () => ({
  useRecentApplications: () => ({ isLoading: false, error: null, data: [{ id: "a1", status: "Submitted", submitted_at: "2026-10-07T00:00:00Z", applicant_name: "Aplica Candidate", job_title: "Patrol 2026" }] }),
}));

import { WorkspaceDashboard } from "./workspace-dashboard";

describe("WorkspaceDashboard", () => {
  beforeEach(() => undefined);

  it("leads HR with needs-attention work, then today's figures, pipeline and recent applications", () => {
    render(<WorkspaceDashboard role="hr_personnel" />);
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Applications awaiting review.*3/ })).toHaveAttribute("href", "/hr/applications?stage=Submitted");
    expect(screen.getByRole("article", { name: "On duty today" })).toHaveTextContent("142 / 160");
    expect(screen.getByRole("article", { name: "Open job postings" })).toHaveTextContent("2");
    const pipeline = screen.getByRole("region", { name: "Recruitment pipeline" });
    expect(within(pipeline).getByRole("link", { name: /Submitted.*3/ })).toHaveAttribute("href", "/hr/applications?stage=Submitted");
    expect(within(pipeline).getByText(/1 hired in this period/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Attendance" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aplica Candidate" })).toHaveAttribute("href", "/hr/applications/a1");
    expect(screen.getByRole("button", { name: /Create/ })).toBeInTheDocument();
  });

  it("gives Management a read-only view with workforce breakdowns", () => {
    render(<WorkspaceDashboard role="management" />);
    expect(screen.queryByRole("heading", { name: "Needs attention" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Personnel by unit / section" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Personnel by rank" })).toBeInTheDocument();
    expect(screen.queryByText("Recent applications")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/workspace/date-range.test.ts src/components/reporting/attention-list.test.tsx src/components/reporting/workspace-dashboard.test.tsx`

Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the date range, the stage lists and recent applications**

`src/lib/workspace/date-range.ts`:

```ts
export type PeriodPreset = "7d" | "30d" | "month" | "custom";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysBefore(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

/** The dashboard period from `?period=&from=&to=`. Matches the RPC's own 30-day default. */
export function resolvePeriod(params: { period: string; from: string; to: string }, today = new Date()) {
  const endsOn = isoDay(today);
  if (params.period === "7d") return { preset: "7d" as const, startsOn: isoDay(daysBefore(today, 6)), endsOn };
  if (params.period === "month") return { preset: "month" as const, startsOn: `${endsOn.slice(0, 7)}-01`, endsOn };
  if (params.period === "custom" && ISO_DAY.test(params.from) && ISO_DAY.test(params.to) && params.from <= params.to) {
    return { preset: "custom" as const, startsOn: params.from, endsOn: params.to };
  }
  return { preset: "30d" as const, startsOn: isoDay(daysBefore(today, 29)), endsOn };
}
```

`src/lib/recruitment/application-stages.ts`:

```ts
import type { ApplicationStatus } from "@/schemas/recruitment";

/** Forward stages in workflow order (supabase/migrations/20261006091000_applicant_post_interview_flow.sql). */
export const PIPELINE_STAGES: readonly ApplicationStatus[] = [
  "Submitted", "Under Review", "Shortlisted", "Interview", "Endorsed to Crame", "Neuro Exam", "For Training", "Hired",
];

/** Stages HR still has to act on, or that wait on the applicant. */
export const ACTIVE_STAGES: readonly ApplicationStatus[] = [
  "Submitted", "Under Review", "Shortlisted", "Interview", "Needs Revision", "Endorsed to Crame", "Neuro Exam", "For Training",
];
```

In `src/queries/recruitment.ts`, add after `listHrApplications`:

```ts
export type RecentApplication = { id: string; status: Application["status"]; submitted_at: string; applicant_name: string | null; job_title: string | null };

/** The newest submitted applications for the HR dashboard. */
export async function listRecentApplications(limit = 5): Promise<RecentApplication[]> {
  const { data, error } = await createBrowserSupabaseClient()
    .from("applications")
    .select("id, status, submitted_at, applicants(first_name, last_name), job_openings(title)")
    .order("submitted_at", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return ((data ?? []) as unknown as Array<{ id: string; status: Application["status"]; submitted_at: string; applicants: { first_name: string | null; last_name: string | null } | null; job_openings: { title: string } | null }>).map((row) => ({
    id: row.id,
    status: row.status,
    submitted_at: row.submitted_at,
    applicant_name: row.applicants ? [row.applicants.first_name, row.applicants.last_name].filter(Boolean).join(" ") || null : null,
    job_title: row.job_openings?.title ?? null,
  }));
}
```

In `src/hooks/use-recruitment.ts`:

- Import `listRecentApplications`.
- Add:

```ts
export function useRecentApplications(enabled = true) {
  return useQuery({ queryKey: ["recruitment", "applications", "recent"], queryFn: () => listRecentApplications(5), enabled, staleTime: 60_000 });
}
```

- [ ] **Step 4: Restyle the chart frame and drop unused charts**

In `src/components/reporting/charts.tsx`:

- Delete `KpiTile`, `DonutChart` and `GaugeChart`; no caller remains after this task.
- Change the `ChartCard` `<section>` class to:

  `"flex flex-col gap-4 rounded-lg border bg-card p-5"`.

- Change its `<h2>` class to `"text-lg font-semibold"`.
- Change its empty `<p>` to:

  `"grid min-h-32 flex-1 place-items-center rounded-md border border-dashed text-sm text-muted-foreground"`, with the text "No records in this period."

- In `HorizontalBarChart`, change the bar track to `h-2` and the fill `rounded-full bg-chart-1` (unchanged class names otherwise).

Run `grep -rn "KpiTile\|DonutChart\|GaugeChart" src`. It must find nothing outside `dashboard.tsx` and its test, which this task deletes.

- [ ] **Step 5: Implement `AttentionList`**

`src/components/reporting/attention-list.tsx`:

```tsx
import Link from "next/link";
import { ChevronRight, CircleCheck, type LucideIcon } from "lucide-react";

export type AttentionItem = { key: string; label: string; count: number | null; href: string; icon: LucideIcon };

/** Open work first; zero-count rows fold into one quiet line. A count that failed to load shows "—". */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  const open = items.filter((item) => item.count === null || item.count > 0);
  const clear = items.filter((item) => item.count === 0);
  if (!open.length) {
    return <p className="flex items-center gap-2 px-5 py-4 text-base text-muted-foreground"><CircleCheck aria-hidden="true" className="size-4 text-success" />You&apos;re all caught up.</p>;
  }
  return (
    <div>
      <ul className="divide-y">
        {open.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link className="flex min-h-12 items-center gap-3 px-5 py-2 transition-colors hover:bg-muted" href={item.href}>
                <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-base">{item.label}</span>
                <span className="min-w-8 text-right text-base font-semibold tabular-nums">{item.count ?? "—"}</span>
                <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
      {clear.length ? (
        <p className="flex items-center gap-2 border-t px-5 py-3 text-sm text-muted-foreground">
          <CircleCheck aria-hidden="true" className="size-4 text-success" />
          All clear: {clear.map((item) => item.label.toLowerCase()).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Implement `WorkspaceDashboard`**

`src/components/reporting/workspace-dashboard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { CalendarDays, ChevronDown, FileText, Fingerprint, Plus, TrendingUp, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { ApplicationStageBadge } from "@/components/recruitment/application-stage-badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatStrip } from "@/components/ui/stat-strip";
import { PageContainer } from "@/components/workspace-shell/page-container";
import { useRecentApplications } from "@/hooks/use-recruitment";
import { useHrDashboard, useManagementDashboard } from "@/hooks/use-reporting";
import { useWorkspaceCount } from "@/hooks/use-workspace-counts";
import { attendanceStatusLabel } from "@/lib/attendance-status";
import { formatDate } from "@/lib/format-date";
import { PIPELINE_STAGES } from "@/lib/recruitment/application-stages";
import { resolvePeriod } from "@/lib/workspace/date-range";
import { useListParams } from "@/lib/workspace/list-params";
import type { DashboardSummary } from "@/schemas/reporting";

import { AttentionList, type AttentionItem } from "./attention-list";
import { ChartCard, ColumnTrendChart, formatCount, HorizontalBarChart, type ChartDatum } from "./charts";

type DashboardRole = "hr_personnel" | "management";

const shortDate = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const formatDay = (label: string) => { const date = new Date(`${label}T00:00:00Z`); return Number.isNaN(date.getTime()) ? label : shortDate.format(date); };

function Panel({ children, id, title, footer }: { id: string; title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col rounded-lg border bg-card">
      <h2 className="border-b px-5 py-3 text-lg font-semibold" id={id}>{title}</h2>
      <div className="flex-1 p-5">{children}</div>
      {footer ? <div className="border-t px-5 py-3 text-sm text-muted-foreground">{footer}</div> : null}
    </section>
  );
}

function PeriodPicker({ preset, startsOn, endsOn, onChange }: { preset: string; startsOn: string; endsOn: string; onChange: (patch: { period?: string; from?: string; to?: string }) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect aria-label="Period" className="w-40" onChange={(event) => onChange({ period: event.target.value === "30d" ? "" : event.target.value, from: event.target.value === "custom" ? startsOn : "", to: event.target.value === "custom" ? endsOn : "" })} value={preset}>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="month">This month</option>
        <option value="custom">Custom range</option>
      </NativeSelect>
      {preset === "custom" ? (
        <>
          <Input aria-label="From" className="w-40" max={endsOn} onChange={(event) => onChange({ period: "custom", from: event.target.value, to: endsOn })} type="date" value={startsOn} />
          <Input aria-label="To" className="w-40" min={startsOn} onChange={(event) => onChange({ period: "custom", from: startsOn, to: event.target.value })} type="date" value={endsOn} />
        </>
      ) : null}
    </div>
  );
}

function CreateMenu() {
  const items = [
    { href: "/hr/jobs/new", label: "New job posting" },
    { href: "/hr/employees/new", label: "New employee" },
    { href: "/hr/deployments/new", label: "New deployment" },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button />}><Plus aria-hidden="true" />Create<ChevronDown aria-hidden="true" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>{item.label}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PipelineChart({ rows }: { rows: ChartDatum[] }) {
  const counts = new Map(rows.map((row) => [row.label, row.count]));
  const max = Math.max(1, ...PIPELINE_STAGES.map((stage) => counts.get(stage) ?? 0));
  const notSelected = counts.get("Not Selected") ?? 0;
  return (
    <div className="space-y-1">
      <ul className="space-y-1">
        {PIPELINE_STAGES.map((stage) => {
          const count = counts.get(stage) ?? 0;
          return (
            <li key={stage}>
              <Link className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted" href={`/hr/applications?stage=${encodeURIComponent(stage)}`}>
                <span className="truncate text-base">{stage}</span>
                <span aria-hidden="true" className="h-2 rounded-full bg-muted"><span className="block h-full rounded-full bg-chart-1" style={{ width: `${count ? Math.max(3, (count / max) * 100) : 0}%` }} /></span>
                <span className="text-right text-base font-semibold tabular-nums">{formatCount(count)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 rounded-md border-t px-2 pt-2.5 pb-1.5 text-muted-foreground hover:bg-muted" href="/hr/applications?quick=not-selected">
        <span className="text-base">Not Selected</span><span /><span className="text-right text-base tabular-nums">{formatCount(notSelected)}</span>
      </Link>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <span className="sr-only" role="status">Loading dashboard…</span>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
    </div>
  );
}

export function WorkspaceDashboard({ role }: { role: DashboardRole }) {
  const isHr = role === "hr_personnel";
  const { params, set } = useListParams(["period", "from", "to"] as const);
  const period = resolvePeriod(params);
  const range = { startsOn: period.startsOn, endsOn: period.endsOn };
  const hrQuery = useHrDashboard(range, isHr);
  const managementQuery = useManagementDashboard(range, !isHr);
  const query = isHr ? hrQuery : managementQuery;
  const awaitingReview = useWorkspaceCount("applicationsAwaitingReview", isHr);
  const unmatched = useWorkspaceCount("unmatchedAttendance", isHr);
  const recent = useRecentApplications(isHr);

  return (
    <PageContainer width="wide">
      <PageHeader
        action={isHr ? <CreateMenu /> : undefined}
        description={`${formatDate(period.startsOn)} to ${formatDate(period.endsOn)}`}
        secondaryActions={<PeriodPicker endsOn={period.endsOn} onChange={(patch) => set(patch)} preset={period.preset} startsOn={period.startsOn} />}
        title="Dashboard"
      />
      {query.isLoading ? <DashboardSkeleton /> : query.error ? <ErrorState message={query.error.message} onRetry={() => void query.refetch()} /> : query.data ? (
        <DashboardBody awaitingReview={awaitingReview} data={query.data} isHr={isHr} recent={recent} unmatched={unmatched} />
      ) : null}
    </PageContainer>
  );
}

type CountQuery = { data?: number; isError: boolean };
type RecentQuery = ReturnType<typeof useRecentApplications>;

function DashboardBody({ awaitingReview, data, isHr, recent, unmatched }: { data: DashboardSummary; isHr: boolean; awaitingReview: CountQuery; unmatched: CountQuery; recent: RecentQuery }) {
  const metric = (key: string) => data.metrics[key] ?? 0;
  const countOf = (query: CountQuery) => (query.isError || query.data === undefined ? null : query.data);
  const attention: AttentionItem[] = [
    { key: "applications", label: "Applications awaiting review", count: countOf(awaitingReview), href: "/hr/applications?stage=Submitted", icon: FileText },
    { key: "leave", label: "Leave requests for approval", count: "pendingLeave" in data.metrics ? metric("pendingLeave") : null, href: "/hr/leave-requests?status=pending", icon: CalendarDays },
    { key: "unmatched", label: "Unmatched attendance IDs", count: countOf(unmatched), href: "/hr/attendance/unmatched", icon: Fingerprint },
    { key: "exceptions", label: "Attendance exceptions", count: "attendanceExceptions" in data.metrics ? metric("attendanceExceptions") : null, href: "/hr/attendance", icon: TriangleAlert },
    { key: "promotions", label: "Missing promotion requirements", count: "trainingNeeds" in data.metrics ? metric("trainingNeeds") : null, href: "/hr/promotions", icon: TrendingUp },
  ];
  const workforce = metric("activeWorkforce");
  const onDutyShare = workforce ? Math.round((metric("attendanceToday") / workforce) * 100) : 0;
  const stats = [
    { key: "personnel", label: "Personnel", value: formatCount(metric("totalPersonnel")), href: isHr ? "/hr/employees" : undefined },
    { key: "onDuty", label: "On duty today", value: `${formatCount(metric("attendanceToday"))} / ${formatCount(workforce)}`, hint: `${onDutyShare}% of active personnel`, href: isHr ? "/hr/attendance" : undefined },
    { key: "onLeave", label: "On leave today", value: formatCount(metric("onLeave")), href: isHr ? "/hr/leave-requests?status=approved" : undefined },
    { key: "deployments", label: "Active deployments", value: formatCount(metric("activeDeployments")), href: isHr ? "/hr/deployments" : undefined },
    { key: "openJobs", label: "Open job postings", value: formatCount(metric("openJobs")), href: isHr ? "/hr/jobs?status=published" : undefined },
  ];
  const breakdown = (key: string) => data.breakdowns[key] ?? [];

  return (
    <div className="space-y-6">
      {isHr ? (
        <section aria-labelledby="needs-attention" className="rounded-lg border bg-card">
          <h2 className="border-b px-5 py-3 text-lg font-semibold" id="needs-attention">Needs attention</h2>
          <AttentionList items={attention} />
        </section>
      ) : null}
      <StatStrip items={stats} label="Today" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel footer={`${formatCount(metric("hiredApplicants"))} hired in this period`} id="pipeline-heading" title="Recruitment pipeline">
          <PipelineChart rows={breakdown("recruitmentPipeline")} />
        </Panel>
        <Panel id="attendance-heading" title="Attendance">
          <div className="space-y-5">
            {breakdown("attendanceTrend").some((row) => row.count > 0)
              ? <ColumnTrendChart data={breakdown("attendanceTrend")} formatLabel={formatDay} unit="attendance" />
              : <p className="grid min-h-32 place-items-center rounded-md border border-dashed text-sm text-muted-foreground">No attendance recorded in this period.</p>}
            {breakdown("attendanceStatus").length ? <HorizontalBarChart data={breakdown("attendanceStatus")} formatLabel={attendanceStatusLabel} /> : null}
          </div>
        </Panel>
      </div>
      {isHr ? (
        <Panel footer={<Link className="font-medium text-primary hover:underline" href="/hr/applications">View all applications →</Link>} id="recent-heading" title="Recent applications">
          {recent.isLoading ? <Skeleton className="h-32 w-full" /> : recent.error ? <ErrorState message={recent.error.message} /> : recent.data?.length ? (
            <ul className="-my-2 divide-y">
              {recent.data.map((application) => (
                <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5" key={application.id}>
                  <Link className="min-w-40 flex-1 font-medium hover:underline" href={`/hr/applications/${application.id}`}>{application.applicant_name ?? `Application ${application.id.slice(0, 8)}`}</Link>
                  <span className="min-w-32 text-muted-foreground">{application.job_title ?? "—"}</span>
                  <ApplicationStageBadge status={application.status} />
                  <span className="w-40 text-right text-sm text-muted-foreground tabular-nums">{formatDate(application.submitted_at)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No applications yet" />}
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard data={breakdown("workforceByDepartment")} id="by-unit" labelHeading="Unit / Section" title="Personnel by unit / section"><HorizontalBarChart data={breakdown("workforceByDepartment")} /></ChartCard>
          <ChartCard data={breakdown("workforceByRank")} id="by-rank" labelHeading="Rank" title="Personnel by rank"><HorizontalBarChart data={breakdown("workforceByRank")} /></ChartCard>
        </div>
      )}
    </div>
  );
}
```

This task uses `ApplicationStageBadge`, which Task 14 builds fully. Create a minimal version now so the dashboard compiles. Task 14 replaces its body and adds tests.

`src/components/recruitment/application-stage-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/schemas/recruitment";

export function ApplicationStageBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant="neutral">{status}</Badge>;
}
```

Each dashboard hook gets an `enabled` flag, so only the summary for the viewer's role is fetched. In `src/hooks/use-reporting.ts`:

```ts
export function useHrDashboard(input: Partial<Pick<ReportFilters, "startsOn" | "endsOn">> = {}, enabled = true) {
  const filters = reportingFilters({ reportKey: "deployments", ...input });
  return useQuery({ queryKey: queryKeys.reporting.dashboard("hr_personnel", filters), queryFn: () => getHrDashboard(filters), staleTime: 60_000, enabled });
}
```

Apply the same change to `useManagementDashboard`.

- [ ] **Step 7: Point both pages at the new dashboard and delete the old one**

`src/app/(app)/hr/page.tsx`:

```tsx
import { WorkspaceDashboard } from "@/components/reporting/workspace-dashboard";

export default function HrPage() {
  return <WorkspaceDashboard role="hr_personnel" />;
}
```

`src/app/(app)/management/page.tsx`: the same, with `role="management"` and the function named `ManagementPage`.

Run: `git rm src/components/reporting/dashboard.tsx src/components/reporting/dashboard.test.tsx`

- [ ] **Step 8: Run the tests and typecheck**

Run: `npx vitest run src/lib/workspace src/components/reporting && npm run typecheck`

Expected: PASS. `reporting.test.tsx` and `report-detail.test.tsx` must still pass. If either imported the deleted chart components, remove those imports.

- [ ] **Step 9: Commit**

```bash
git add -A src/lib/workspace src/lib/recruitment/application-stages.ts src/components/reporting src/components/recruitment/application-stage-badge.tsx src/queries/recruitment.ts src/hooks/use-recruitment.ts src/hooks/use-reporting.ts src/app/\(app\)/hr/page.tsx src/app/\(app\)/management/page.tsx
git commit -m "feat: an operational dashboard led by work that needs attention"
```

---

### Task 12: Job postings list

**Files:**
- Create:
  - `src/lib/recruitment/job-postings.ts`
  - `src/components/recruitment/hr-job-postings.tsx`
- Modify:
  - `src/queries/recruitment.ts` (add `listAllHrJobs`, `getHrJob`, `HrJob`)
  - `src/hooks/use-recruitment.ts` (add `useAllHrJobs`, `useHrJob`)
  - `src/app/(app)/hr/jobs/page.tsx`
- Delete:
  - `src/components/recruitment/hr-job-list.tsx`
  - `src/components/recruitment/hr-job-list.test.tsx`
- Test:
  - `src/lib/recruitment/job-postings.test.ts`
  - `src/components/recruitment/hr-job-postings.test.tsx`

**Interfaces:**
- Consumes: `DataTable`, `FilterBar`, `SearchInput`, `Pagination`, `EmptyState`, `ConfirmDialog`, `notifySuccess`, `useListParams`, `parseSort`, `sortRows`, `paginate`, `PageContainer`, and `DeleteRecordDialog` (existing).
- Produces:
  - `type HrJob = JobOpening & { job_qualification_criteria: JobQualificationCriterion[]; applications?: Array<{ count: number }> }`.
  - `listAllHrJobs(): Promise<HrJob[]>`.
  - `getHrJob(id: number): Promise<HrJob | null>`.
  - `useAllHrJobs()`, with query key `["recruitment", "hr-jobs", "all"]`.
  - `useHrJob(id)`, with query key `["recruitment", "hr-jobs", "detail", id]`.
  - `applicationCount(job: HrJob): number`.
  - `jobActions(job: HrJob): { canDelete: boolean; canWithdraw: boolean }`.
  - `deadlineNote(closesOn: string | null, status: HrJob["status"], today?: Date): string | null`.
  - `filterJobs(jobs: HrJob[], filters: { status: string; q: string }): HrJob[]`.
  - `jobStatusCounts(jobs: HrJob[]): Record<"all" | "published" | "draft" | "closed", number>`.
  - `JOB_SORT_KEYS`, `JOB_SORT_ACCESSORS`, `DEFAULT_JOB_SORT`.

- [ ] **Step 1: Write the failing tests**

`src/lib/recruitment/job-postings.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { deadlineNote, filterJobs, jobActions, jobStatusCounts, type HrJobLike } from "./job-postings";

const job = (overrides: Partial<HrJobLike>): HrJobLike => ({ id: 1, title: "Patrol 2026", location: "San Juan", status: "published", closes_on: "2026-10-20", updated_at: "2026-10-01T00:00:00Z", applications: [{ count: 0 }], ...overrides });
const today = new Date("2026-10-08T03:00:00Z");

describe("job postings", () => {
  it("allows deleting only empty drafts and withdrawing anything else still open", () => {
    expect(jobActions(job({ status: "draft" }))).toEqual({ canDelete: true, canWithdraw: false });
    expect(jobActions(job({ status: "draft", applications: [{ count: 2 }] }))).toEqual({ canDelete: false, canWithdraw: true });
    expect(jobActions(job({ status: "published" }))).toEqual({ canDelete: false, canWithdraw: true });
    expect(jobActions(job({ status: "closed" }))).toEqual({ canDelete: false, canWithdraw: false });
  });

  it("describes the deadline relative to today", () => {
    expect(deadlineNote("2026-10-13", "published", today)).toBe("Closes in 5 days");
    expect(deadlineNote("2026-10-09", "published", today)).toBe("Closes in 1 day");
    expect(deadlineNote("2026-10-08", "published", today)).toBe("Closes today");
    expect(deadlineNote("2026-10-01", "published", today)).toBe("Deadline passed");
    expect(deadlineNote("2026-10-20", "closed", today)).toBe("Closed");
    expect(deadlineNote(null, "draft", today)).toBeNull();
  });

  it("filters by status tab and title search, and counts each tab", () => {
    const jobs = [job({ id: 1, title: "Patrol North" }), job({ id: 2, title: "Patrol South", status: "draft" }), job({ id: 3, title: "Intel", status: "closed" })];
    expect(filterJobs(jobs, { status: "draft", q: "" }).map((j) => j.id)).toEqual([2]);
    expect(filterJobs(jobs, { status: "", q: "patrol" }).map((j) => j.id)).toEqual([1, 2]);
    expect(filterJobs(jobs, { status: "bogus", q: "" })).toHaveLength(3);
    expect(jobStatusCounts(jobs)).toEqual({ all: 3, published: 1, draft: 1, closed: 1 });
  });
});
```

`src/components/recruitment/hr-job-postings.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ withdraw: vi.fn(), search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
  usePathname: () => "/hr/jobs",
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("@/components/deletion/delete-record-dialog", () => ({ DeleteRecordDialog: ({ entityId }: { entityId: number | null }) => (entityId ? <div role="alertdialog">Delete draft {entityId}</div> : null) }));
vi.mock("@/components/ui/toaster", () => ({ notifySuccess: vi.fn() }));
vi.mock("@/hooks/use-recruitment", () => ({
  useAllHrJobs: () => ({ isLoading: false, error: null, refetch: vi.fn(), data: [
    { id: 1, title: "Patrol North", location: "San Juan", status: "published", closes_on: "2099-12-31", updated_at: "2026-10-02T00:00:00Z", applications: [{ count: 4 }], job_qualification_criteria: [] },
    { id: 2, title: "Draft Opening", location: "San Juan", status: "draft", closes_on: "2099-12-31", updated_at: "2026-10-01T00:00:00Z", applications: [{ count: 0 }], job_qualification_criteria: [] },
  ] }),
  useWithdrawJobOpening: () => ({ isPending: false, mutateAsync: mocks.withdraw }),
}));

import { HrJobPostings } from "./hr-job-postings";

describe("HrJobPostings", () => {
  beforeEach(() => { mocks.search = ""; mocks.withdraw.mockReset(); });

  it("lists postings in a table with application counts linking to the applications list", () => {
    render(<HrJobPostings />);
    expect(screen.getByRole("heading", { level: 1, name: "Job postings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New job posting" })).toHaveAttribute("href", "/hr/jobs/new");
    expect(screen.getByRole("link", { name: "4 applications for Patrol North" })).toHaveAttribute("href", "/hr/applications?job=1&quick=all");
    expect(screen.getByRole("tab", { name: /Draft.*1/ })).toBeInTheDocument();
  });

  it("withdraws through a confirmation dialog", async () => {
    mocks.withdraw.mockResolvedValue(undefined);
    render(<HrJobPostings />);
    await userEvent.click(screen.getByRole("button", { name: "Actions for Patrol North" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Withdraw" }));
    const dialog = screen.getByRole("alertdialog", { name: "Withdraw “Patrol North”?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Withdraw" }));
    expect(mocks.withdraw).toHaveBeenCalledWith(1);
  });

  it("offers Delete draft only for an empty draft", async () => {
    render(<HrJobPostings />);
    await userEvent.click(screen.getByRole("button", { name: "Actions for Draft Opening" }));
    expect(await screen.findByRole("menuitem", { name: "Delete draft" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Withdraw" })).not.toBeInTheDocument();
  });

  it("explains when filters match nothing", () => {
    mocks.search = "q=zzz";
    render(<HrJobPostings />);
    expect(screen.getByText("No job postings match")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/recruitment/job-postings.test.ts src/components/recruitment/hr-job-postings.test.tsx`

Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the queries and hooks**

In `src/queries/recruitment.ts`, add after `listHrJobs`:

```ts
export type HrJob = JobOpening & { job_qualification_criteria: JobQualificationCriterion[]; applications?: Array<{ count: number }> };

const HR_JOB_SELECT = "*, job_qualification_criteria(*), applications(count)";

/** Every posting for the HR list, which filters, sorts and pages on the client. Move to server paging if volumes grow past ~1000. */
export async function listAllHrJobs(): Promise<HrJob[]> {
  const { data, error } = await createBrowserSupabaseClient().from("job_openings").select(HR_JOB_SELECT).order("updated_at", { ascending: false }).range(0, 999);
  throwIfError(error);
  return (data ?? []) as HrJob[];
}

export async function getHrJob(id: number): Promise<HrJob | null> {
  const { data, error } = await createBrowserSupabaseClient().from("job_openings").select(HR_JOB_SELECT).eq("id", id).maybeSingle();
  throwIfError(error);
  return (data as HrJob | null) ?? null;
}
```

In `src/hooks/use-recruitment.ts`, import both, then add:

```ts
export function useAllHrJobs() {
  return useQuery({ queryKey: ["recruitment", "hr-jobs", "all"], queryFn: listAllHrJobs });
}

export function useHrJob(jobId: number) {
  return useQuery({ queryKey: ["recruitment", "hr-jobs", "detail", jobId], queryFn: () => getHrJob(jobId), enabled: Number.isInteger(jobId) && jobId > 0 });
}
```

The existing mutations already invalidate `["recruitment", "hr-jobs"]`, which covers both new keys.

- [ ] **Step 4: Implement the list logic**

`src/lib/recruitment/job-postings.ts`:

```ts
import type { SortState } from "@/lib/workspace/table";

export type HrJobLike = { id: number; title: string; location: string | null; status: "draft" | "published" | "closed"; closes_on: string | null; updated_at: string; applications?: Array<{ count: number }> };

export const JOB_STATUS_LABELS = { draft: "Draft", published: "Published", closed: "Closed" } as const;
export const JOB_SORT_KEYS = ["title", "deadline", "updated"] as const;
export const DEFAULT_JOB_SORT: SortState = { key: "updated", direction: "desc" };
export const JOB_SORT_ACCESSORS = {
  title: (job: HrJobLike) => job.title,
  deadline: (job: HrJobLike) => job.closes_on,
  updated: (job: HrJobLike) => job.updated_at,
};

export function applicationCount(job: HrJobLike) {
  return job.applications?.[0]?.count ?? 0;
}

export function jobActions(job: HrJobLike) {
  const canDelete = job.status === "draft" && applicationCount(job) === 0;
  return { canDelete, canWithdraw: job.status !== "closed" && !canDelete };
}

const DAY = 86_400_000;

export function deadlineNote(closesOn: string | null, status: HrJobLike["status"], today = new Date()) {
  if (status === "closed") return "Closed";
  if (!closesOn) return null;
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [year, month, day] = closesOn.split("-").map(Number);
  const days = Math.round((Date.UTC(year!, month! - 1, day!) - todayUtc) / DAY);
  if (days < 0) return "Deadline passed";
  if (days === 0) return "Closes today";
  return `Closes in ${days} ${days === 1 ? "day" : "days"}`;
}

export function filterJobs<T extends HrJobLike>(jobs: T[], filters: { status: string; q: string }) {
  const term = filters.q.trim().toLowerCase();
  const status = filters.status in JOB_STATUS_LABELS ? filters.status : "";
  return jobs.filter((job) => (!status || job.status === status) && (!term || job.title.toLowerCase().includes(term) || (job.location ?? "").toLowerCase().includes(term)));
}

export function jobStatusCounts(jobs: HrJobLike[]) {
  return {
    all: jobs.length,
    published: jobs.filter((job) => job.status === "published").length,
    draft: jobs.filter((job) => job.status === "draft").length,
    closed: jobs.filter((job) => job.status === "closed").length,
  };
}
```

- [ ] **Step 5: Implement the list screen**

`src/components/recruitment/hr-job-postings.tsx`:

```tsx
"use client";

import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";

import { DeleteRecordDialog } from "@/components/deletion/delete-record-dialog";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { notifySuccess } from "@/components/ui/toaster";
import { PageContainer } from "@/components/workspace-shell/page-container";
import { useAllHrJobs, useWithdrawJobOpening } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { applicationCount, deadlineNote, DEFAULT_JOB_SORT, filterJobs, jobActions, JOB_SORT_ACCESSORS, JOB_SORT_KEYS, JOB_STATUS_LABELS, jobStatusCounts } from "@/lib/recruitment/job-postings";
import { useListParams } from "@/lib/workspace/list-params";
import { formatSort, paginate, parseSort, sortRows } from "@/lib/workspace/table";
import type { HrJob } from "@/queries/recruitment";

const STATUS_VARIANT = { published: "success", draft: "neutral", closed: "outline" } as const;
const PAGE_SIZE = 25;

export function HrJobPostings() {
  const jobs = useAllHrJobs();
  const withdraw = useWithdrawJobOpening();
  const { params, set, clear } = useListParams(["status", "q", "sort", "page"] as const);
  const [withdrawing, setWithdrawing] = useState<HrJob | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const all = jobs.data ?? [];
  const counts = jobStatusCounts(all);
  const sort = parseSort(params.sort, JOB_SORT_KEYS, DEFAULT_JOB_SORT);
  const filtered = filterJobs(all, { status: params.status, q: params.q });
  const page = paginate(sortRows(filtered, sort, JOB_SORT_ACCESSORS), Number(params.page || 1), PAGE_SIZE);
  const statusTab = params.status in JOB_STATUS_LABELS ? params.status : "all";

  async function confirmWithdraw() {
    if (!withdrawing || withdraw.isPending) return;
    setWithdrawError(null);
    try {
      await withdraw.mutateAsync(withdrawing.id);
      notifySuccess(`“${withdrawing.title}” was withdrawn. Its applications are kept.`);
      setWithdrawing(null);
    } catch (cause) {
      setWithdrawError(cause instanceof Error ? cause.message : "We could not withdraw this posting.");
    }
  }

  const columns: DataTableColumn<HrJob>[] = [
    { key: "title", header: "Posting", sortable: true, cell: (job) => (
      <div className="min-w-0">
        <Link className="font-medium hover:underline" href={`/hr/jobs/${job.id}`}>{job.title}</Link>
        <p className="text-sm text-muted-foreground">{job.location || "Location to be confirmed"}</p>
      </div>
    ) },
    { key: "status", header: "Status", cell: (job) => <Badge variant={STATUS_VARIANT[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge> },
    { key: "applications", header: "Applications", align: "right", cell: (job) => {
      const count = applicationCount(job);
      return <Link aria-label={`${count} applications for ${job.title}`} className="font-medium tabular-nums hover:underline" href={`/hr/applications?job=${job.id}&quick=all`}>{count}</Link>;
    } },
    { key: "deadline", header: "Deadline", sortable: true, hideBelow: "md", cell: (job) => (
      <div>
        <p className="tabular-nums">{formatDate(job.closes_on) ?? "—"}</p>
        {deadlineNote(job.closes_on, job.status) ? <p className="text-sm text-muted-foreground">{deadlineNote(job.closes_on, job.status)}</p> : null}
      </div>
    ) },
    { key: "updated", header: "Updated", sortable: true, hideBelow: "lg", cell: (job) => <span className="tabular-nums text-secondary-foreground">{formatDate(job.updated_at)}</span> },
    { key: "actions", header: "Actions", align: "right", cell: (job) => {
      const { canDelete, canWithdraw } = jobActions(job);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button aria-label={`Actions for ${job.title}`} size="icon-sm" variant="ghost" />}><MoreHorizontal aria-hidden="true" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href={`/hr/jobs/${job.id}`} />}>Edit</DropdownMenuItem>
            <DropdownMenuItem render={<Link href={`/hr/applications?job=${job.id}&quick=all`} />}>View applications</DropdownMenuItem>
            {job.status === "published" ? <DropdownMenuItem render={<a href={`/jobs/${job.id}`} rel="noreferrer" target="_blank" />}>View on public site</DropdownMenuItem> : null}
            {canWithdraw || canDelete ? <DropdownMenuSeparator /> : null}
            {canWithdraw ? <DropdownMenuItem onClick={() => { setWithdrawError(null); setWithdrawing(job); }} variant="destructive">Withdraw</DropdownMenuItem> : null}
            {canDelete ? <DropdownMenuItem onClick={() => setDeletingId(job.id)} variant="destructive">Delete draft</DropdownMenuItem> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    } },
  ];

  const hasFilters = Boolean(params.q || params.status);

  return (
    <PageContainer width="wide">
      <PageHeader action={<Link className={buttonVariants()} href="/hr/jobs/new"><Plus aria-hidden="true" />New job posting</Link>} title="Job postings" />
      <Tabs
        items={[
          { value: "all", label: "All", count: counts.all },
          { value: "published", label: "Published", count: counts.published },
          { value: "draft", label: "Draft", count: counts.draft },
          { value: "closed", label: "Closed", count: counts.closed },
        ]}
        label="Posting status"
        onValueChange={(value) => set({ status: value === "all" ? "" : value })}
        value={statusTab}
      >
        <div className="space-y-4 pt-4">
          <FilterBar>
            <SearchInput label="Search job postings" onChange={(q) => set({ q })} value={params.q} />
          </FilterBar>
          <DataTable
            caption="Job postings"
            columns={columns}
            empty={hasFilters
              ? <EmptyState action={<Button onClick={() => clear(["q", "status"])} variant="outline">Clear filters</Button>} title="No job postings match" />
              : <EmptyState action={<Link className={buttonVariants()} href="/hr/jobs/new">New job posting</Link>} description="Create a draft when your team is ready to recruit." title="No job postings yet" />}
            error={jobs.error?.message}
            footer={page.total ? <Pagination from={page.from} noun="postings" onPageChange={(next) => set({ page: String(next) })} page={page.page} pageCount={page.pageCount} to={page.to} total={page.total} /> : null}
            getRowHref={(job) => `/hr/jobs/${job.id}`}
            getRowKey={(job) => String(job.id)}
            isLoading={jobs.isLoading}
            loadingLabel="Loading job postings…"
            onRetry={() => void jobs.refetch()}
            onSortChange={(next) => set({ sort: formatSort(next) }, { keepPage: false })}
            rows={page.rows}
            sort={sort}
          />
        </div>
      </Tabs>
      <ConfirmDialog
        confirmLabel="Withdraw"
        description="Applicants can no longer apply. Existing applications stay available for review."
        error={withdrawError}
        onConfirm={confirmWithdraw}
        onOpenChange={(open) => { if (!open) setWithdrawing(null); }}
        open={Boolean(withdrawing)}
        pending={withdraw.isPending}
        title={`Withdraw “${withdrawing?.title ?? ""}”?`}
        tone="danger"
      />
      <DeleteRecordDialog entityId={deletingId} entityType="job_opening" noun="draft posting" onClose={() => setDeletingId(null)} onDeleted={() => notifySuccess("The draft posting was deleted.")} />
    </PageContainer>
  );
}
```

`DropdownMenuItem` in `src/components/ui/dropdown-menu.tsx` must accept `variant="destructive"` and `render`. If `onClick` does not fire on base-ui menu items, use the item's `onClick` prop name from `node_modules/@base-ui/react/menu/item/MenuItem.d.ts`. The Tabs here only switch the status filter, so put no `TabPanel` inside: the table is shared across tabs.

Replace `src/app/(app)/hr/jobs/page.tsx` with:

```tsx
import { HrJobPostings } from "@/components/recruitment/hr-job-postings";

export default function HrJobsPage() {
  return <HrJobPostings />;
}
```

Delete the old list:

```bash
git rm src/components/recruitment/hr-job-list.tsx src/components/recruitment/hr-job-list.test.tsx
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/lib/recruitment/job-postings.test.ts src/components/recruitment/hr-job-postings.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/recruitment/job-postings.ts src/lib/recruitment/job-postings.test.ts src/components/recruitment src/queries/recruitment.ts src/hooks/use-recruitment.ts src/app/\(app\)/hr/jobs/page.tsx
git commit -m "feat: job postings as a searchable, sortable table with a confirmed withdraw"
```

---

### Task 13: Job posting editor layout

**Files:**
- Modify:
  - `src/components/recruitment/hr-job-form.tsx`
  - `src/components/recruitment/hr-job-editor.tsx`
  - `src/app/(app)/hr/jobs/new/page.tsx`
  - `src/app/(app)/hr/jobs/[jobId]/page.tsx`
- Test: `src/components/recruitment/hr-job-form.test.tsx` (extend)

**Interfaces:**
- Consumes: `useHrJob` (Task 12), `notifySuccess`, `useBreadcrumbTrail`, `PageContainer`.
- Produces: `HrJobForm({ job?: HrJob })`. Same props; the layout is new. Button names are unchanged: "Save draft", "Save changes", "Publish opening". The e2e relies on them.

- [ ] **Step 1: Add the failing tests**

Append to `src/components/recruitment/hr-job-form.test.tsx`. Reuse its existing mocks. If it does not mock `@/components/ui/toaster`, add `vi.mock("@/components/ui/toaster", () => ({ notifySuccess: mocks.notify }))` with `notify: vi.fn()` in its hoisted mocks.

```tsx
  it("groups the form into Details, Requirements and Image with actions in a side panel", () => {
    render(<HrJobForm />);
    for (const heading of ["Details", "Requirements", "Image"]) expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    const panel = screen.getByRole("complementary", { name: "Posting status" });
    expect(within(panel).getByText("Draft")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Save draft" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Publish opening" })).toBeInTheDocument();
  });

  it("links a published posting to the public site", () => {
    render(<HrJobForm job={{ id: 7, title: "Patrol", description: "x".repeat(30), location: "San Juan", closes_on: "2099-12-31", status: "published", department_id: null, rank_id: null, published_at: null, created_by_user_id: null, created_at: "", updated_at: "", job_qualification_criteria: [], applications: [{ count: 2 }] }} />);
    expect(screen.getByRole("link", { name: "View on public site" })).toHaveAttribute("href", "/jobs/7");
    expect(screen.getByText("2 applications")).toBeInTheDocument();
  });
```

Find the existing test that expects the inline "Draft saved." status text. Change its assertion to `expect(mocks.notify).toHaveBeenCalledWith("Draft saved.")`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/recruitment/hr-job-form.test.tsx`

Expected: FAIL (no "Details" heading, no complementary panel).

- [ ] **Step 3: Restructure the form**

In `src/components/recruitment/hr-job-form.tsx`:

- Import `Link` from `next/link`, `Badge`, and `notifySuccess` from `@/components/ui/toaster`. Import `applicationCount`, `deadlineNote` and `JOB_STATUS_LABELS` from `@/lib/recruitment/job-postings`. Import `type HrJob` from `@/queries/recruitment`.
- Change the `HrJobFormProps` type to `{ job?: HrJob }`.
- Remove the `success` state. Replace `setSuccess(hasApplications ? "Changes saved." : "Draft saved.")` with `notifySuccess(hasApplications ? "Changes saved." : "Draft saved.")`.
- In the published branch, call `notifySuccess("Posting published.")` before `router.replace("/hr/jobs")`.
- Replace everything from `return (` to the end of the component with:

```tsx
  const status = job?.status ?? "draft";
  const count = job ? applicationCount(job) : 0;
  const note = job ? deadlineNote(job.closes_on, job.status) : null;

  return (
    <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start" noValidate onSubmit={(event) => { event.preventDefault(); void saveAs(hasApplications && job ? job.status : "draft"); }}>
      <div className="min-w-0 space-y-6">
        <section aria-labelledby="job-details-heading" className="space-y-4 rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold" id="job-details-heading">Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField error={errors.title?.message} htmlFor="job-title" label="Title" required>
              <Input id="job-title" required {...form.register("title")} />
            </FormField>
            <FormField error={errors.location?.message} htmlFor="job-location" label="Location" required>
              <Input id="job-location" required {...form.register("location")} />
            </FormField>
            <FormField error={errors.closesOn?.message} htmlFor="job-closes-on" label="Deadline of Application" required>
              <Input id="job-closes-on" required type="date" {...form.register("closesOn")} />
            </FormField>
            <FormField description="Every recruitment is for this rank." htmlFor="job-position" label="Position">
              <Input id="job-position" readOnly value={rankLabel(RECRUITMENT_RANK)} />
            </FormField>
          </div>
          <FormField description="At least 20 characters." error={errors.description?.message} htmlFor="job-description" label="Description" required>
            <Textarea className="min-h-40" id="job-description" required rows={8} {...form.register("description")} />
          </FormField>
        </section>

        <section aria-labelledby="job-requirements-heading" className="space-y-4 rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold" id="job-requirements-heading">Requirements</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["education", "eligibility"] as const).map((kind, index) => {
              const label = kind === "education" ? "Education" : "Eligibility";
              const fieldErrors = errors.requirements?.[kind];
              // A saved requirement that is not listed (older openings) stays selectable as its own choice.
              const choices = withSavedValue(PNP_GENERAL_REQUIREMENTS[kind], requirements?.[kind]?.choice);
              return (
                <div className="space-y-3 rounded-md bg-muted/50 p-3" key={kind}>
                  <FormField error={fieldErrors?.choice?.message} htmlFor={`requirement-${kind}`} label={`Requirement ${index + 1}: ${label}`} required>
                    <NativeSelect id={`requirement-${kind}`} required {...form.register(`requirements.${kind}.choice`)}>
                      <option value="">Select {label.toLowerCase()}</option>
                      {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                    </NativeSelect>
                  </FormField>
                  {requirements?.[kind]?.choice === OTHERS_CHOICE ? (
                    <FormField error={fieldErrors?.other?.message} htmlFor={`requirement-${kind}-other`} label={`Specify ${label.toLowerCase()}`} required>
                      <Input id={`requirement-${kind}-other`} maxLength={1000} required {...form.register(`requirements.${kind}.other`)} />
                    </FormField>
                  ) : null}
                </div>
              );
            })}
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Other requirements</legend>
            <p className="text-sm text-muted-foreground">Uncheck a requirement that does not apply to this opening.</p>
            <ul className="space-y-1">
              {(requirements?.otherRequirements ?? []).map((item, index) => (
                <li key={`${item.kind}-${item.requirement}`}>
                  <label className="flex min-h-9 items-center gap-2 text-base">
                    <input className="size-4 accent-[var(--primary)]" type="checkbox" {...form.register(`requirements.otherRequirements.${index}.included`)} /> {item.requirement}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </section>

        <section aria-labelledby="job-image-heading" className="space-y-4 rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold" id="job-image-heading">Image</h2>
          <FormField description="Optional. PNG, JPEG, or WebP up to 5 MB." error={imageError ?? undefined} htmlFor="job-image" label="Image">
            <div className="space-y-3">
              {shownImage ? <Image alt="Job posting image preview" className="max-h-72 w-full rounded-md border object-contain" height={450} src={shownImage} unoptimized width={800} /> : null}
              <div className="flex flex-wrap items-center gap-2">
                <Input accept="image/png,image/jpeg,image/webp" className="max-w-sm" id="job-image" onChange={(event) => chooseImage(event.target.files?.[0])} ref={imageInput} type="file" />
                {shownImage ? <Button onClick={clearImage} size="sm" type="button" variant="outline">Remove image</Button> : null}
              </div>
            </div>
          </FormField>
        </section>
        {error ? <ErrorState message={error} /> : null}
      </div>

      <aside aria-label="Posting status" className="space-y-4 rounded-lg border bg-card p-5 lg:sticky lg:top-20">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge variant={status === "published" ? "success" : "neutral"}>{JOB_STATUS_LABELS[status]}</Badge>
        </div>
        {job ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Applications</dt><dd>{count} {count === 1 ? "application" : "applications"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Deadline</dt><dd className="text-right">{note ?? "—"}</dd></div>
          </dl>
        ) : null}
        {hasApplications ? <p className="rounded-md bg-warning-subtle p-3 text-sm text-warning">This posting has applications. Its status can only change by withdrawing it from the job postings list.</p> : null}
        <div className="flex flex-col gap-2">
          {!hasApplications ? <Button disabled={submitDisabled} onClick={() => void saveAs("published")} type="button">Publish opening</Button> : null}
          <Button loading={save.isPending} type="submit" variant="outline">{hasApplications ? "Save changes" : "Save draft"}</Button>
        </div>
        {job?.status === "published" ? <Link className="block text-sm font-medium text-primary hover:underline" href={`/jobs/${job.id}`} target="_blank">View on public site</Link> : null}
      </aside>
    </form>
  );
```

The Requirements and Image blocks are the existing JSX, moved into their sections with workspace sizing. The labels "Requirement 1: Education" and "Requirement 2: Eligibility" stay, because the e2e uses them. The old `<h2>General Requirements</h2>` heading is gone.

- [ ] **Step 4: Load one posting in the editor, and update the page wrappers**

`src/components/recruitment/hr-job-editor.tsx`:

```tsx
"use client";

import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { useBreadcrumbTrail } from "@/components/workspace-shell/breadcrumbs";
import { PageContainer } from "@/components/workspace-shell/page-container";
import { useHrJob } from "@/hooks/use-recruitment";

import { HrJobForm } from "./hr-job-form";

export function HrJobEditor({ jobId }: { jobId: number }) {
  const job = useHrJob(jobId);
  useBreadcrumbTrail([{ label: job.data?.title ?? "Edit job posting" }]);
  return (
    <PageContainer width="wide">
      {job.isLoading ? <LoadingState label="Loading job posting…" /> : job.error ? <ErrorState message={job.error.message} onRetry={() => void job.refetch()} /> : !job.data ? (
        <>
          <PageHeader title="Job posting not found" />
          <EmptyState action={<Link className="font-medium text-primary hover:underline" href="/hr/jobs">Back to job postings</Link>} title="This job posting does not exist or was deleted." />
        </>
      ) : (
        <>
          <PageHeader description={job.data.location ?? undefined} title={job.data.title} />
          <HrJobForm job={job.data} />
        </>
      )}
    </PageContainer>
  );
}
```

`src/app/(app)/hr/jobs/[jobId]/page.tsx`: render `<HrJobEditor jobId={parsed} />` only, removing the old `PageHeader` wrapper.

`src/app/(app)/hr/jobs/new/page.tsx`:

```tsx
import { HrJobForm } from "@/components/recruitment/hr-job-form";
import { PageHeader } from "@/components/ui/page-header";
import { PageContainer } from "@/components/workspace-shell/page-container";

export default function NewHrJobPage() {
  return <PageContainer width="wide"><PageHeader title="New job posting" /><HrJobForm /></PageContainer>;
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/components/recruitment/hr-job-form.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/recruitment/hr-job-form.tsx src/components/recruitment/hr-job-form.test.tsx src/components/recruitment/hr-job-editor.tsx src/app/\(app\)/hr/jobs
git commit -m "feat: job posting editor with titled sections and a sticky status panel"
```

---

### Task 14: Application stages, stage badge, and the stage dialogs

**Files:**
- Create:
  - `src/lib/recruitment/applicant-number.ts`
  - `src/components/recruitment/stage-dialogs.tsx`
- Modify:
  - `src/lib/recruitment/application-stages.ts` (extend Task 11's file)
  - `src/components/recruitment/application-stage-badge.tsx` (replace Task 11's stub)
- Test:
  - `src/lib/recruitment/application-stages.test.ts`
  - `src/components/recruitment/stage-dialogs.test.tsx`

**Interfaces:**
- Consumes: `useTransitionApplicationStatus`, `useHireApplication` (existing); `Dialog`, `ConfirmDialog`, `RadioGroup`, `notifySuccess` (Task 4); `hiringDecisionSchema` (existing).
- Produces:
  - `allowedNextStatuses: Record<ApplicationStatus, readonly ApplicationStatus[]>`. Moved verbatim from `hr-application-detail.tsx`.
  - `type StageAction = { kind: "advance"; next: ApplicationStatus[]; canReject: boolean } | { kind: "waiting-bmi"; canReject: boolean } | { kind: "hire"; canReject: boolean } | { kind: "waiting-resubmit" } | { kind: "closed" }`.
  - `stageActions(status: ApplicationStatus, hasBmiProof: boolean): StageAction`.
  - `stageBadgeVariant(status): "info" | "neutral" | "warning" | "success" | "danger"`.
  - `trackerPosition(status: ApplicationStatus, endedAt?: ApplicationStatus | null): { reached: number; outcome: "open" | "hired" | "not-selected" | "needs-revision" }`.
  - `endedAtStage(history: Pick<ApplicationStatusHistory, "previous_status" | "next_status">[]): ApplicationStatus | null`.
  - `formatApplicantNumber(value: number | null | undefined): string | null` (e.g. `12345` gives `"0-12345"`).
  - `ApplicationStageBadge({ status })`.
  - `MoveStageDialog({ applicationId, status, open, onOpenChange, initialStage? })`.
  - `NotSelectedDialog({ applicationId, open, onOpenChange })`.
  - `HireDialog({ applicationId, applicantNumber, open, onOpenChange })`.

- [ ] **Step 1: Write the failing tests**

`src/lib/recruitment/application-stages.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatApplicantNumber } from "./applicant-number";
import { endedAtStage, stageActions, stageBadgeVariant, trackerPosition } from "./application-stages";

describe("application stages", () => {
  it.each([
    ["Submitted", false, { kind: "advance", next: ["Under Review"], canReject: false }],
    ["Under Review", false, { kind: "advance", next: ["Shortlisted", "Interview"], canReject: true }],
    ["Interview", false, { kind: "advance", next: ["Endorsed to Crame", "Shortlisted"], canReject: true }],
    ["Endorsed to Crame", false, { kind: "waiting-bmi", canReject: true }],
    ["Endorsed to Crame", true, { kind: "advance", next: ["Neuro Exam"], canReject: true }],
    ["For Training", false, { kind: "hire", canReject: true }],
    ["Needs Revision", false, { kind: "waiting-resubmit" }],
    ["Hired", false, { kind: "closed" }],
    ["Not Selected", false, { kind: "closed" }],
  ] as const)("%s (BMI proof: %s) offers the right actions", (status, hasBmi, expected) => {
    expect(stageActions(status, hasBmi)).toEqual(expected);
  });

  it("colours only the stages that need attention or are final", () => {
    expect(stageBadgeVariant("Submitted")).toBe("info");
    expect(stageBadgeVariant("Interview")).toBe("neutral");
    expect(stageBadgeVariant("Needs Revision")).toBe("warning");
    expect(stageBadgeVariant("Hired")).toBe("success");
    expect(stageBadgeVariant("Not Selected")).toBe("danger");
  });

  it("finds where a rejected application stopped and positions the tracker", () => {
    const history = [
      { previous_status: null, next_status: "Submitted" as const },
      { previous_status: "Submitted" as const, next_status: "Under Review" as const },
      { previous_status: "Under Review" as const, next_status: "Under Review" as const },
      { previous_status: "Under Review" as const, next_status: "Not Selected" as const },
    ];
    expect(endedAtStage(history)).toBe("Under Review");
    expect(trackerPosition("Not Selected", "Under Review")).toEqual({ reached: 1, outcome: "not-selected" });
    expect(trackerPosition("Interview")).toEqual({ reached: 3, outcome: "open" });
    expect(trackerPosition("Needs Revision")).toEqual({ reached: 1, outcome: "needs-revision" });
    expect(trackerPosition("Hired")).toEqual({ reached: 7, outcome: "hired" });
  });

  it("formats applicant numbers in the 0-00000 style", () => {
    expect(formatApplicantNumber(12345)).toBe("0-12345");
    expect(formatApplicantNumber(null)).toBeNull();
  });
});
```

`src/components/recruitment/stage-dialogs.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transition: vi.fn(), hire: vi.fn(), notify: vi.fn(), pending: false }));
vi.mock("@/components/ui/toaster", () => ({ notifySuccess: mocks.notify }));
vi.mock("@/hooks/use-recruitment", () => ({
  useTransitionApplicationStatus: () => ({ isPending: mocks.pending, mutateAsync: mocks.transition }),
  useHireApplication: () => ({ isPending: mocks.pending, mutateAsync: mocks.hire }),
}));

import { HireDialog, MoveStageDialog, NotSelectedDialog } from "./stage-dialogs";

const id = "00000000-0000-0000-0000-000000000001";

describe("stage dialogs", () => {
  beforeEach(() => { mocks.transition.mockReset(); mocks.hire.mockReset(); mocks.notify.mockReset(); mocks.pending = false; });

  it("moves to a chosen allowed stage with an optional note and confirms with a toast", async () => {
    mocks.transition.mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(<MoveStageDialog applicationId={id} onOpenChange={onOpenChange} open status="Under Review" />);
    const dialog = screen.getByRole("dialog", { name: "Move to next stage" });
    expect(within(dialog).queryByRole("radio", { name: "Not Selected" })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("radio", { name: "Interview" }));
    await userEvent.type(within(dialog).getByLabelText("Note to applicant"), "See you Monday");
    await userEvent.click(within(dialog).getByRole("button", { name: "Move to Interview" }));
    expect(mocks.transition).toHaveBeenCalledWith({ applicationId: id, nextStatus: "Interview", note: "See you Monday" });
    expect(mocks.notify).toHaveBeenCalledWith("Moved to Interview · applicant notified");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog open and shows the server error inside it", async () => {
    mocks.transition.mockRejectedValue(new Error("Upload the BMI proof first."));
    render(<MoveStageDialog applicationId={id} initialStage="Neuro Exam" onOpenChange={() => undefined} open status="Endorsed to Crame" />);
    await userEvent.click(screen.getByRole("button", { name: "Move to Neuro Exam" }));
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("Upload the BMI proof first.");
  });

  it("disables confirmation while a change is in flight", () => {
    mocks.pending = true;
    render(<MoveStageDialog applicationId={id} initialStage="Interview" onOpenChange={() => undefined} open status="Under Review" />);
    expect(screen.getByRole("button", { name: /Move to Interview/ })).toBeDisabled();
  });

  it("asks for confirmation before marking not selected", async () => {
    mocks.transition.mockResolvedValue(undefined);
    render(<NotSelectedDialog applicationId={id} onOpenChange={() => undefined} open />);
    const dialog = screen.getByRole("alertdialog", { name: "Mark as not selected?" });
    expect(dialog).toHaveTextContent("This ends the application. The applicant will be notified.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark as not selected" }));
    expect(mocks.transition).toHaveBeenCalledWith({ applicationId: id, nextStatus: "Not Selected", note: undefined });
  });

  it("requires a badge number before hiring", async () => {
    render(<HireDialog applicantNumber={12345} applicationId={id} onOpenChange={() => undefined} open />);
    const dialog = screen.getByRole("dialog", { name: "Hire applicant" });
    expect(within(dialog).getByLabelText("Applicant number")).toHaveValue("0-12345");
    await userEvent.click(within(dialog).getByRole("button", { name: "Hire applicant" }));
    expect(mocks.hire).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("alert")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/recruitment/application-stages.test.ts src/components/recruitment/stage-dialogs.test.tsx`

Expected: FAIL (exports missing).

- [ ] **Step 3: Implement the stage logic**

`src/lib/recruitment/applicant-number.ts`:

```ts
/** Applicant numbers display like badge numbers: 12345 → "0-12345". */
export function formatApplicantNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const digits = String(value).padStart(6, "0");
  return `${digits.slice(0, 1)}-${digits.slice(1)}`;
}
```

Append to `src/lib/recruitment/application-stages.ts`:

```ts
import type { ApplicationStatusHistory } from "@/lib/types/database";

/**
 * Review transitions HR can choose. private.transition_application_status also accepts
 * Needs Revision, but HR no longer offers it (tester feedback). Hiring is its own flow
 * once the applicant is For Training; Needs Revision, Hired and Not Selected have none.
 */
export const allowedNextStatuses: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  Submitted: ["Under Review"],
  "Under Review": ["Shortlisted", "Interview", "Not Selected"],
  Shortlisted: ["Interview", "Not Selected"],
  Interview: ["Endorsed to Crame", "Shortlisted", "Not Selected"],
  "Endorsed to Crame": ["Neuro Exam", "Not Selected"],
  "Neuro Exam": ["For Training", "Not Selected"],
  "For Training": ["Not Selected"],
  "Needs Revision": [],
  Hired: [],
  "Not Selected": [],
};

export type StageAction =
  | { kind: "advance"; next: ApplicationStatus[]; canReject: boolean }
  | { kind: "waiting-bmi"; canReject: boolean }
  | { kind: "hire"; canReject: boolean }
  | { kind: "waiting-resubmit" }
  | { kind: "closed" };

export function stageActions(status: ApplicationStatus, hasBmiProof: boolean): StageAction {
  if (status === "Hired" || status === "Not Selected") return { kind: "closed" };
  if (status === "Needs Revision") return { kind: "waiting-resubmit" };
  const allowed = allowedNextStatuses[status];
  const canReject = allowed.includes("Not Selected");
  if (status === "For Training") return { kind: "hire", canReject };
  if (status === "Endorsed to Crame" && !hasBmiProof) return { kind: "waiting-bmi", canReject };
  return { kind: "advance", next: allowed.filter((next) => next !== "Not Selected"), canReject };
}

export function stageBadgeVariant(status: ApplicationStatus) {
  if (status === "Submitted") return "info" as const;
  if (status === "Needs Revision") return "warning" as const;
  if (status === "Hired") return "success" as const;
  if (status === "Not Selected") return "danger" as const;
  return "neutral" as const;
}

/** The stage a Not Selected application had reached: the status it left when it was rejected. */
export function endedAtStage(history: Pick<ApplicationStatusHistory, "previous_status" | "next_status">[]) {
  const rejection = history.findLast((entry) => entry.next_status === "Not Selected" && entry.previous_status !== "Not Selected");
  return rejection?.previous_status ?? null;
}

export function trackerPosition(status: ApplicationStatus, endedAt?: ApplicationStatus | null) {
  const index = (value: ApplicationStatus) => Math.max(0, PIPELINE_STAGES.indexOf(value));
  if (status === "Hired") return { reached: PIPELINE_STAGES.length - 1, outcome: "hired" as const };
  if (status === "Not Selected") return { reached: endedAt ? index(endedAt === "Needs Revision" ? "Under Review" : endedAt) : 0, outcome: "not-selected" as const };
  if (status === "Needs Revision") return { reached: index("Under Review"), outcome: "needs-revision" as const };
  return { reached: index(status), outcome: "open" as const };
}
```

Merge the new `import type` line with the existing import at the top of the file.

- [ ] **Step 4: Implement the badge and the dialogs**

`src/components/recruitment/application-stage-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { stageBadgeVariant } from "@/lib/recruitment/application-stages";
import type { ApplicationStatus } from "@/schemas/recruitment";

export function ApplicationStageBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant={stageBadgeVariant(status)}>{status}</Badge>;
}
```

`src/components/recruitment/stage-dialogs.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { BadgeNumberInput } from "@/components/ui/badge-number-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { notifySuccess } from "@/components/ui/toaster";
import { useHireApplication, useTransitionApplicationStatus } from "@/hooks/use-recruitment";
import { formatApplicantNumber } from "@/lib/recruitment/applicant-number";
import { allowedNextStatuses } from "@/lib/recruitment/application-stages";
import { hiringDecisionSchema, type ApplicationStatus } from "@/schemas/recruitment";

const errorText = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

type OpenProps = { open: boolean; onOpenChange: (open: boolean) => void };

export function MoveStageDialog({ applicationId, initialStage, onOpenChange, open, status }: OpenProps & { applicationId: string; status: ApplicationStatus; initialStage?: ApplicationStatus }) {
  const transition = useTransitionApplicationStatus();
  const options = allowedNextStatuses[status].filter((next) => next !== "Not Selected");
  const [stage, setStage] = useState<string>(initialStage ?? (options.length === 1 ? options[0]! : ""));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setStage(initialStage ?? (options.length === 1 ? options[0]! : "")); setNote(""); setError(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirm() {
    if (!stage || transition.isPending) return;
    setError(null);
    try {
      await transition.mutateAsync({ applicationId, nextStatus: stage as ApplicationStatus, note: note.trim() || undefined });
      notifySuccess(`Moved to ${stage} · applicant notified`);
      onOpenChange(false);
    } catch (cause) {
      setError(errorText(cause, "We could not update this application."));
    }
  }

  return (
    <Dialog onOpenChange={(next) => { if (!transition.isPending) onOpenChange(next); }} open={open}>
      <DialogContent
        description={`Currently ${status}. Only the stages allowed next are listed.`}
        footer={<>
          <DialogClose render={<Button disabled={transition.isPending} variant="outline" />}>Cancel</DialogClose>
          <Button disabled={!stage} loading={transition.isPending} onClick={() => void confirm()} type="button">{stage ? `Move to ${stage}` : "Move"}</Button>
        </>}
        title="Move to next stage"
      >
        <div className="space-y-4">
          <RadioGroup legend="Next stage" name="next-stage" onValueChange={setStage} options={options.map((value) => ({ value, label: value }))} value={stage} />
          <FormField description="Included in the applicant's notification." htmlFor="move-note" label="Note to applicant">
            <Textarea id="move-note" maxLength={2000} onChange={(event) => setNote(event.target.value)} rows={3} value={note} />
          </FormField>
          {error ? <p className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NotSelectedDialog({ applicationId, onOpenChange, open }: OpenProps & { applicationId: string }) {
  const transition = useTransitionApplicationStatus();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setNote(""); setError(null); } }, [open]);

  async function confirm() {
    if (transition.isPending) return;
    setError(null);
    try {
      await transition.mutateAsync({ applicationId, nextStatus: "Not Selected", note: note.trim() || undefined });
      notifySuccess("Marked as not selected · applicant notified");
      onOpenChange(false);
    } catch (cause) {
      setError(errorText(cause, "We could not update this application."));
    }
  }

  return (
    <ConfirmDialog confirmLabel="Mark as not selected" description="This ends the application. The applicant will be notified." error={error} onConfirm={confirm} onOpenChange={onOpenChange} open={open} pending={transition.isPending} title="Mark as not selected?" tone="danger">
      <FormField description="Optional. Included in the applicant's notification." htmlFor="not-selected-note" label="Note to applicant">
        <Textarea id="not-selected-note" maxLength={2000} onChange={(event) => setNote(event.target.value)} rows={3} value={note} />
      </FormField>
    </ConfirmDialog>
  );
}

export function HireDialog({ applicantNumber, applicationId, onOpenChange, open }: OpenProps & { applicationId: string; applicantNumber: number | null | undefined }) {
  const hire = useHireApplication();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) setError(null); }, [open]);

  async function submit(form: HTMLFormElement) {
    if (hire.isPending) return;
    setError(null);
    const data = new FormData(form);
    const input = hiringDecisionSchema.safeParse({ applicationId, badgeNumber: String(data.get("badgeNumber") ?? ""), note: String(data.get("hireNote") || "") || undefined });
    if (!input.success) { setError(input.error.issues[0]?.message ?? "Enter the badge number."); return; }
    try {
      await hire.mutateAsync(input.data);
      notifySuccess("Applicant hired · employee record created");
      onOpenChange(false);
    } catch (cause) {
      setError(errorText(cause, "We could not hire this applicant."));
    }
  }

  return (
    <Dialog onOpenChange={(next) => { if (!hire.isPending) onOpenChange(next); }} open={open}>
      <DialogContent description="Creates the employee record, sends an account activation email, and notifies the applicant." title="Hire applicant">
        <form className="space-y-4" id="hire-form" noValidate onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="hire-applicant-number" label="Applicant number">
              <Input id="hire-applicant-number" readOnly value={formatApplicantNumber(applicantNumber) ?? "Not available"} />
            </FormField>
            <FormField description="6 digits, e.g. 1-23456." htmlFor="hire-badge-number" label="Badge number" required>
              <BadgeNumberInput id="hire-badge-number" name="badgeNumber" required />
            </FormField>
          </div>
          <FormField htmlFor="hire-note" label="Notes">
            <Textarea id="hire-note" maxLength={2000} name="hireNote" />
          </FormField>
          {error ? <p className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button disabled={hire.isPending} variant="outline" />}>Cancel</DialogClose>
            <Button loading={hire.isPending} type="submit">Hire applicant</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/recruitment/application-stages.test.ts src/components/recruitment/stage-dialogs.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recruitment/applicant-number.ts src/lib/recruitment/application-stages.ts src/lib/recruitment/application-stages.test.ts src/components/recruitment/application-stage-badge.tsx src/components/recruitment/stage-dialogs.tsx src/components/recruitment/stage-dialogs.test.tsx
git commit -m "feat: stage rules, stage badge and confirmable stage and hire dialogs"
```

---

### Task 15: Registered applicants tab and contact drawer

**Files:**
- Create: `src/components/recruitment/hr-registered-applicants.tsx`
- Delete:
  - `src/components/recruitment/hr-registered-applicant-list.tsx`
  - `src/components/recruitment/hr-registered-applicant-list.test.tsx`
- Test: `src/components/recruitment/hr-registered-applicants.test.tsx`

**Interfaces:**
- Consumes: `useHrRegisteredApplicants` (existing); `DataTable`, `Drawer`, `SearchInput`, `FilterBar`, `Pagination`, `EmptyState`, `useListParams`, `ApplicationStageBadge`, `formatApplicantNumber`.
- Produces:
  - `registeredApplicantName(applicant: HrRegisteredApplicant): string` ("Last, First Middle Qualifier", falling back to full_name, then email, then "Applicant").
  - `RegisteredApplicantDrawer({ applicant: HrRegisteredApplicant | null; onClose: () => void })`.
  - `HrRegisteredApplicants()`. URL keys: `rq`, `applied` (`""` / `"applied"` / `"not-yet"`), `rsort`, `rpage`.

- [ ] **Step 1: Write the failing tests**

`src/components/recruitment/hr-registered-applicants.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  usePathname: () => "/hr/applications",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
const applicants = [
  { user_id: "u1", applicant_id: "a1", applicant_number: 12345, first_name: "Ana", middle_name: null, last_name: "Reyes", qualifier: null, full_name: null, email: "ana@example.test", phone: "09171234567", registered_at: "2026-09-01T00:00:00Z", email_confirmed: true, application_count: 1, latest_application_id: "app-1", latest_application_status: "Interview", latest_job_title: "Patrol", latest_submitted_at: "2026-09-02T00:00:00Z" },
  { user_id: "u2", applicant_id: null, applicant_number: null, first_name: "Ben", middle_name: null, last_name: "Cruz", qualifier: null, full_name: null, email: "ben@example.test", phone: null, registered_at: "2026-09-05T00:00:00Z", email_confirmed: false, application_count: 0, latest_application_id: null, latest_application_status: null, latest_job_title: null, latest_submitted_at: null },
];
vi.mock("@/hooks/use-applicant-portal", () => ({ useHrRegisteredApplicants: () => ({ isLoading: false, error: null, refetch: vi.fn(), data: applicants }) }));

import { HrRegisteredApplicants } from "./hr-registered-applicants";

describe("HrRegisteredApplicants", () => {
  beforeEach(() => { nav.search = ""; nav.push.mockReset(); });

  it("lists every account with its latest stage and an unconfirmed-email badge", () => {
    render(<HrRegisteredApplicants />);
    expect(screen.getByRole("link", { name: "Reyes, Ana" })).toHaveAttribute("href", "/hr/applications/app-1");
    expect(within(screen.getByRole("row", { name: /Cruz, Ben/ })).getByText("Unconfirmed")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Cruz, Ben/ })).getByText("Not yet applied")).toBeInTheDocument();
  });

  it("filters to accounts that have not applied", () => {
    nav.search = "applied=not-yet";
    render(<HrRegisteredApplicants />);
    expect(screen.queryByRole("link", { name: "Reyes, Ana" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cruz, Ben" })).toBeInTheDocument();
  });

  it("opens a contact drawer for someone who has not applied", async () => {
    render(<HrRegisteredApplicants />);
    await userEvent.click(screen.getByRole("button", { name: "Cruz, Ben" }));
    const drawer = screen.getByRole("dialog", { name: "Cruz, Ben" });
    expect(drawer).toHaveTextContent("ben@example.test");
    expect(drawer).toHaveTextContent("Not confirmed");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/recruitment/hr-registered-applicants.test.tsx`

Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`src/components/recruitment/hr-registered-applicants.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

import { ApplicationStageBadge } from "@/components/recruitment/application-stage-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { useHrRegisteredApplicants } from "@/hooks/use-applicant-portal";
import { formatDate } from "@/lib/format-date";
import { formatApplicantNumber } from "@/lib/recruitment/applicant-number";
import type { HrRegisteredApplicant } from "@/lib/types/database";
import { useListParams } from "@/lib/workspace/list-params";
import { formatSort, paginate, parseSort, sortRows } from "@/lib/workspace/table";

export function registeredApplicantName(applicant: HrRegisteredApplicant) {
  const name = [applicant.last_name, [applicant.first_name, applicant.middle_name, applicant.qualifier].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return name || applicant.full_name || applicant.email || "Applicant";
}

export function RegisteredApplicantDrawer({ applicant, onClose }: { applicant: HrRegisteredApplicant | null; onClose: () => void }) {
  return (
    <Drawer description="Registered, has not applied yet" onOpenChange={(open) => { if (!open) onClose(); }} open={Boolean(applicant)} title={applicant ? registeredApplicantName(applicant) : ""}>
      {applicant ? (
        <dl className="space-y-4">
          {[
            ["Applicant number", formatApplicantNumber(applicant.applicant_number) ?? "Not assigned yet"],
            ["Email", applicant.email ?? "—"],
            ["Email status", applicant.email_confirmed ? "Confirmed" : "Not confirmed"],
            ["Mobile", applicant.phone ?? "—"],
            ["Registered", formatDate(applicant.registered_at)],
          ].map(([label, value]) => (
            <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-base break-all">{value}</dd></div>
          ))}
        </dl>
      ) : null}
    </Drawer>
  );
}

const SORT_KEYS = ["name", "registered"] as const;
const SORT_ACCESSORS = { name: (row: HrRegisteredApplicant) => registeredApplicantName(row), registered: (row: HrRegisteredApplicant) => row.registered_at };

export function HrRegisteredApplicants() {
  const applicants = useHrRegisteredApplicants();
  const { params, set, clear } = useListParams(["rq", "applied", "rsort", "rpage"] as const);
  const [open, setOpen] = useState<HrRegisteredApplicant | null>(null);
  const term = params.rq.toLowerCase();
  const sort = parseSort(params.rsort, SORT_KEYS, { key: "registered", direction: "desc" });
  const filtered = (applicants.data ?? []).filter((applicant) =>
    (params.applied !== "applied" || applicant.application_count > 0)
    && (params.applied !== "not-yet" || applicant.application_count === 0)
    && (!term || [registeredApplicantName(applicant), applicant.email, applicant.phone].some((value) => value?.toLowerCase().includes(term))));
  const page = paginate(sortRows(filtered, sort, SORT_ACCESSORS), Number(params.rpage || 1), 25);

  const columns: DataTableColumn<HrRegisteredApplicant>[] = [
    { key: "name", header: "Applicant", sortable: true, cell: (row) => {
      const name = registeredApplicantName(row);
      return (
        <div>
          {row.latest_application_id
            ? <Link className="font-medium hover:underline" href={`/hr/applications/${row.latest_application_id}`}>{name}</Link>
            : <button className="font-medium hover:underline" onClick={() => setOpen(row)} type="button">{name}</button>}
          {row.applicant_number !== null ? <p className="text-sm text-muted-foreground tabular-nums">{formatApplicantNumber(row.applicant_number)}</p> : null}
        </div>
      );
    } },
    { key: "email", header: "Email", cell: (row) => <span className="inline-flex flex-wrap items-center gap-2 break-all">{row.email ?? "—"}{row.email_confirmed ? null : <Badge variant="warning">Unconfirmed</Badge>}</span> },
    { key: "mobile", header: "Mobile", hideBelow: "lg", cell: (row) => <span className="tabular-nums">{row.phone ?? "—"}</span> },
    { key: "registered", header: "Registered", sortable: true, hideBelow: "md", cell: (row) => <span className="tabular-nums">{formatDate(row.registered_at)}</span> },
    { key: "stage", header: "Latest stage", cell: (row) => row.latest_application_status ? <ApplicationStageBadge status={row.latest_application_status} /> : <span className="text-muted-foreground">Not yet applied</span> },
  ];

  const filtersActive = Boolean(params.rq || params.applied);
  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchInput label="Search registered applicants" onChange={(rq) => set({ rq, rpage: "" }, { keepPage: true })} placeholder="Search name, email or mobile" value={params.rq} />
        <NativeSelect aria-label="Application" className="w-48" onChange={(event) => set({ applied: event.target.value, rpage: "" }, { keepPage: true })} value={params.applied}>
          <option value="">All accounts</option>
          <option value="applied">Applied</option>
          <option value="not-yet">Not yet applied</option>
        </NativeSelect>
      </FilterBar>
      <DataTable
        caption="Registered applicant accounts"
        columns={columns}
        empty={filtersActive
          ? <EmptyState action={<Button onClick={() => clear(["rq", "applied", "rpage"])} variant="outline">Clear filters</Button>} title="No applicants match" />
          : <EmptyState title="No applicant accounts yet" />}
        error={applicants.error?.message}
        footer={page.total ? <Pagination from={page.from} noun="applicants" onPageChange={(next) => set({ rpage: String(next) }, { keepPage: true })} page={page.page} pageCount={page.pageCount} to={page.to} total={page.total} /> : null}
        getRowHref={(row) => (row.latest_application_id ? `/hr/applications/${row.latest_application_id}` : null)}
        getRowKey={(row) => row.user_id}
        isLoading={applicants.isLoading}
        loadingLabel="Loading applicants…"
        onRetry={() => void applicants.refetch()}
        onSortChange={(next) => set({ rsort: formatSort(next), rpage: "" }, { keepPage: true })}
        rows={page.rows}
        sort={sort}
      />
      <RegisteredApplicantDrawer applicant={open} onClose={() => setOpen(null)} />
    </div>
  );
}
```

The test queries `row` by an accessible name. Table rows get their name from their cell text in Testing Library, so `{ name: /Cruz, Ben/ }` matches.

Delete the old list and its test:

```bash
git rm src/components/recruitment/hr-registered-applicant-list.tsx src/components/recruitment/hr-registered-applicant-list.test.tsx
```

`hr-application-list.tsx` still imports `applicantDisplayName` from the deleted file. Task 16 deletes it, so run Task 16 next before typechecking the whole project. For this task, type-check only the new files:

`npx tsc --noEmit -p . 2>&1 | grep -v "hr-application-list"` must print nothing.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/recruitment/hr-registered-applicants.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/recruitment
git commit -m "feat: registered applicants table with a contact drawer for people who have not applied"
```

---

### Task 16: Applications tab and page

**Files:**
- Create:
  - `src/lib/recruitment/application-list.ts`
  - `src/components/recruitment/hr-applications.tsx`
  - `src/components/recruitment/hr-applications-workspace.tsx`
- Modify:
  - `src/queries/recruitment.ts` (add `listAllHrApplications`)
  - `src/hooks/use-recruitment.ts` (add `useAllHrApplications`)
  - `src/app/(app)/hr/applications/page.tsx`
- Delete: `src/components/recruitment/hr-application-list.tsx`
- Test:
  - `src/lib/recruitment/application-list.test.ts`
  - `src/components/recruitment/hr-applications.test.tsx`

**Interfaces:**
- Consumes: Tasks 4–7 and 14–15.
- Produces:
  - `listAllHrApplications(filters: { aiStatus?: AiStatus; minimumScore?: number }): Promise<HrShortlistApplication[]>`.
  - `useAllHrApplications(filters)`.
  - `type QuickView = "active" | "hired" | "not-selected" | "not-yet-applied" | "all"`.
  - `QUICK_VIEWS`.
  - `type ApplicationListRow`.
  - `parseApplicationListParams(raw)`.
  - `buildApplicationRows(applications, registered, params)`.
  - `APPLICATION_SORT_KEYS`, `APPLICATION_SORT_ACCESSORS`.
  - `HrApplicationsWorkspace()`: page-level tabs "Applications" / "Registered applicants", with the URL key `view`.

- [ ] **Step 1: Write the failing tests**

`src/lib/recruitment/application-list.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { HrRegisteredApplicant, HrShortlistApplication } from "@/lib/types/database";

import { buildApplicationRows, parseApplicationListParams } from "./application-list";

const app = (overrides: Partial<HrShortlistApplication>): HrShortlistApplication => ({
  id: "11111111-aaaa-bbbb-cccc-000000000001", applicant_id: "a1", job_opening_id: 1, status: "Submitted", cover_note: null, submitted_at: "2026-10-01T00:00:00Z",
  reviewed_at: null, hired_employee_id: null, created_at: "", updated_at: "", ai_score_id: null, ai_score_status: "completed", ai_score: 80, ai_explanation: null, ai_model: null,
  applicant_name: "Ana Reyes", applicant_number: 12345, job_title: "Patrol North", ...overrides,
});
const registered = (overrides: Partial<HrRegisteredApplicant>): HrRegisteredApplicant => ({
  user_id: "u9", applicant_id: null, applicant_number: null, first_name: "Ben", middle_name: null, last_name: "Cruz", qualifier: null, full_name: null, email: "ben@example.test", phone: null,
  registered_at: "2026-10-02T00:00:00Z", email_confirmed: true, application_count: 0, latest_application_id: null, latest_application_status: null, latest_job_title: null, latest_submitted_at: null, ...overrides,
});

describe("application list", () => {
  it("parses URL params and drops junk", () => {
    expect(parseApplicationListParams({ quick: "bogus", stage: "Bogus", job: "abc", q: " ana ", ai: "weird", minScore: "abc", sort: "nope", page: "x" })).toEqual({
      quick: "active", stage: "", job: null, q: "ana", ai: "", minScore: undefined, sort: { key: "ai", direction: "desc" }, page: 1,
    });
    expect(parseApplicationListParams({ quick: "hired", stage: "Interview", job: "3", q: "", ai: "failed", minScore: "150", sort: "name:asc", page: "2" })).toMatchObject({
      quick: "hired", stage: "Interview", job: 3, ai: "failed", minScore: 100, sort: { key: "name", direction: "asc" }, page: 2,
    });
  });

  it("shows active applications by default and keeps not-yet-applied people one click away", () => {
    const apps = [app({ id: "1", status: "Interview" }), app({ id: "2", status: "Hired" }), app({ id: "3", status: "Not Selected" })];
    const people = [registered({})];
    const base = parseApplicationListParams({});
    expect(buildApplicationRows(apps, people, base).map((row) => row.id)).toEqual(["1"]);
    expect(buildApplicationRows(apps, people, { ...base, quick: "hired" }).map((row) => row.id)).toEqual(["2"]);
    expect(buildApplicationRows(apps, people, { ...base, quick: "not-yet-applied" }).map((row) => row.kind)).toEqual(["registered"]);
    expect(buildApplicationRows(apps, people, { ...base, quick: "all" })).toHaveLength(4);
  });

  it("lets an explicit stage or job override the quick view and never matches registered rows", () => {
    const apps = [app({ id: "1", status: "Hired", job_opening_id: 2 }), app({ id: "2", status: "Interview", job_opening_id: 1 })];
    const base = parseApplicationListParams({});
    expect(buildApplicationRows(apps, [registered({})], { ...base, stage: "Hired" }).map((row) => row.id)).toEqual(["1"]);
    expect(buildApplicationRows(apps, [registered({})], { ...base, job: 1 }).map((row) => row.id)).toEqual(["2"]);
  });

  it("searches names and applicant numbers, and survives missing lookups", () => {
    const apps = [app({ id: "1", applicant_name: null, applicant_number: null, job_title: null }), app({ id: "2", applicant_name: "Ana Reyes" })];
    const base = { ...parseApplicationListParams({}), quick: "all" as const };
    expect(buildApplicationRows(apps, [], { ...base, q: "reyes" }).map((row) => row.id)).toEqual(["2"]);
    expect(buildApplicationRows(apps, [], { ...base, q: "0-12345" }).map((row) => row.id)).toEqual(["2"]);
    const fallback = buildApplicationRows(apps, [], base).find((row) => row.id === "1")!;
    expect(fallback.name).toBe("Application 1");
    expect(fallback.kind === "application" && fallback.jobTitle).toBeNull();
  });
});
```

`src/components/recruitment/hr-applications.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  usePathname: () => "/hr/applications",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/components/recruitment/stage-dialogs", () => ({
  MoveStageDialog: ({ open, initialStage }: { open: boolean; initialStage?: string }) => (open ? <div role="dialog">Move dialog {initialStage}</div> : null),
  NotSelectedDialog: ({ open }: { open: boolean }) => (open ? <div role="alertdialog">Not selected dialog</div> : null),
}));
const rows = [
  { id: "11111111-0000-0000-0000-000000000001", applicant_id: "a1", job_opening_id: 1, status: "Under Review", submitted_at: "2026-10-01T00:00:00Z", ai_score_status: "completed", ai_score: 82, applicant_name: "Ana Reyes", applicant_number: 12345, job_title: "Patrol North" },
  { id: "11111111-0000-0000-0000-000000000002", applicant_id: "a2", job_opening_id: 1, status: "Submitted", submitted_at: "2026-10-03T00:00:00Z", ai_score_status: "failed", ai_score: null, applicant_name: "Carlo Diaz", applicant_number: 12346, job_title: "Patrol North" },
];
vi.mock("@/hooks/use-recruitment", () => ({
  useAllHrApplications: () => ({ isLoading: false, error: null, refetch: vi.fn(), data: rows }),
  useAllHrJobs: () => ({ data: [{ id: 1, title: "Patrol North" }] }),
}));
vi.mock("@/hooks/use-applicant-portal", () => ({ useHrRegisteredApplicants: () => ({ isLoading: false, error: null, data: [] }) }));

import { HrApplications } from "./hr-applications";

describe("HrApplications", () => {
  beforeEach(() => { nav.search = ""; nav.replace.mockReset(); });

  it("shows the job posting, stage and AI match, best match first", () => {
    render(<HrApplications />);
    const [first, second] = screen.getAllByRole("row").slice(1);
    expect(within(first!).getByRole("link", { name: "Ana Reyes" })).toHaveAttribute("href", "/hr/applications/11111111-0000-0000-0000-000000000001");
    expect(first).toHaveTextContent("Patrol North");
    expect(first).toHaveTextContent("82");
    expect(second).toHaveTextContent("Analysis failed");
    expect(screen.getByText("1–2 of 2 applications")).toBeInTheDocument();
  });

  it("puts filters in the URL", async () => {
    render(<HrApplications />);
    await userEvent.selectOptions(screen.getByLabelText("Stage"), "Interview");
    expect(nav.replace).toHaveBeenCalledWith("/hr/applications?stage=Interview", { scroll: false });
  });

  it("shows removable chips for active filters", () => {
    nav.search = "stage=Submitted&job=1";
    render(<HrApplications />);
    expect(screen.getByRole("button", { name: "Remove filter Stage: Submitted" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove filter Job: Patrol North" })).toBeInTheDocument();
  });

  it("offers only the allowed next stages from the row menu", async () => {
    render(<HrApplications />);
    await userEvent.click(screen.getByRole("button", { name: "Actions for Ana Reyes" }));
    expect(await screen.findByRole("menuitem", { name: "Move to Interview" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Move to Shortlisted" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Mark as not selected" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Not selected dialog");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/recruitment/application-list.test.ts src/components/recruitment/hr-applications.test.tsx`

Expected: FAIL (modules missing).

- [ ] **Step 3: Add the query and hook**

In `src/queries/recruitment.ts`, refactor `listHrApplications` so its body after parsing lives in a helper. Then add `listAllHrApplications`:

```ts
async function fetchShortlist(filters: { status?: Application["status"]; aiStatus?: HrShortlistApplication["ai_score_status"]; minimumScore?: number }, from: number, to: number) {
  const { data, error } = await createBrowserSupabaseClient()
    .rpc("list_hr_application_shortlist", { target_application_status: filters.status ?? null, target_ai_status: filters.aiStatus ?? null, minimum_score: filters.minimumScore ?? null })
    .range(from, to);
  throwIfError(error);
  // …the existing body that maps rows and calls shortlistNames, unchanged, returning HrShortlistApplication[]…
}
```

Move the existing mapping code from `listHrApplications` (the `shortlist` cast, `shortlistNames` call and `rows` map) into `fetchShortlist`. It must return `rows`. Then:

```ts
export async function listHrApplications(input: Partial<ApplicationAiFilters> = {}) {
  const filters = applicationAiFiltersSchema.parse(input);
  const { from, to } = pageRange(filters.page, filters.pageSize);
  const rows = await fetchShortlist(filters, from, to);
  return { rows, count: rows.length, filters } satisfies PaginatedResult<HrShortlistApplication, ApplicationAiFilters>;
}

/** Every application for the HR list, which filters, sorts and pages on the client. Move to server paging if volumes grow past ~1000. */
export async function listAllHrApplications(filters: { aiStatus?: HrShortlistApplication["ai_score_status"]; minimumScore?: number } = {}) {
  return fetchShortlist(filters, 0, 999);
}
```

In `src/hooks/use-recruitment.ts`:

```ts
export function useAllHrApplications(filters: { aiStatus?: HrShortlistApplication["ai_score_status"]; minimumScore?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.recruitment.applications({ all: true, ...filters }),
    queryFn: () => listAllHrApplications(filters),
    refetchInterval: (query) => analysisRefetchInterval((query.state.data ?? []).map((row) => row.ai_score_status)),
  });
}
```

Import `type HrShortlistApplication` from `@/lib/types/database`.

- [ ] **Step 4: Implement the list logic**

`src/lib/recruitment/application-list.ts`:

```ts
import { formatApplicantNumber } from "@/lib/recruitment/applicant-number";
import { ACTIVE_STAGES } from "@/lib/recruitment/application-stages";
import type { HrRegisteredApplicant, HrShortlistApplication } from "@/lib/types/database";
import { parseSort, type SortState } from "@/lib/workspace/table";
import { applicationStatusSchema, type ApplicationStatus } from "@/schemas/recruitment";

export type QuickView = "active" | "hired" | "not-selected" | "not-yet-applied" | "all";
export const QUICK_VIEWS: { value: QuickView; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "hired", label: "Hired" },
  { value: "not-selected", label: "Not selected" },
  { value: "not-yet-applied", label: "Not yet applied" },
  { value: "all", label: "All" },
];

export type AiStatus = HrShortlistApplication["ai_score_status"];
const AI_STATUSES: readonly AiStatus[] = ["queued", "processing", "completed", "failed", "unscored"];

export type ApplicationListRow =
  | { kind: "application"; id: string; name: string; applicantNumber: string | null; jobId: number; jobTitle: string | null; status: ApplicationStatus; submittedAt: string; aiStatus: AiStatus; aiScore: number | null }
  | { kind: "registered"; id: string; name: string; applicantNumber: string | null; submittedAt: string; applicant: HrRegisteredApplicant };

export type ApplicationListParams = { quick: QuickView; stage: ApplicationStatus | ""; job: number | null; q: string; ai: AiStatus | ""; minScore: number | undefined; sort: SortState; page: number };

export const APPLICATION_SORT_KEYS = ["ai", "submitted", "name"] as const;
export const DEFAULT_APPLICATION_SORT: SortState = { key: "ai", direction: "desc" };
export const APPLICATION_SORT_ACCESSORS = {
  ai: (row: ApplicationListRow) => (row.kind === "application" && row.aiStatus === "completed" ? row.aiScore : null),
  submitted: (row: ApplicationListRow) => row.submittedAt,
  name: (row: ApplicationListRow) => row.name,
};

export function parseApplicationListParams(raw: Partial<Record<"quick" | "stage" | "job" | "q" | "ai" | "minScore" | "sort" | "page", string>>): ApplicationListParams {
  const quick = QUICK_VIEWS.some((view) => view.value === raw.quick) ? (raw.quick as QuickView) : "active";
  const stage = applicationStatusSchema.safeParse(raw.stage).success ? (raw.stage as ApplicationStatus) : "";
  const job = Number.isInteger(Number(raw.job)) && Number(raw.job) > 0 ? Number(raw.job) : null;
  const ai = AI_STATUSES.includes(raw.ai as AiStatus) ? (raw.ai as AiStatus) : "";
  const score = Number(raw.minScore);
  const minScore = raw.minScore && Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : undefined;
  const page = Math.trunc(Number(raw.page));
  return { quick, stage, job, q: (raw.q ?? "").trim(), ai, minScore, sort: parseSort(raw.sort, APPLICATION_SORT_KEYS, DEFAULT_APPLICATION_SORT), page: Number.isFinite(page) && page > 0 ? page : 1 };
}

function registeredName(applicant: HrRegisteredApplicant) {
  const name = [applicant.last_name, [applicant.first_name, applicant.middle_name, applicant.qualifier].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return name || applicant.full_name || applicant.email || "Applicant";
}

function quickMatches(quick: QuickView, status: ApplicationStatus) {
  if (quick === "active") return ACTIVE_STAGES.includes(status);
  if (quick === "hired") return status === "Hired";
  if (quick === "not-selected") return status === "Not Selected";
  return quick === "all";
}

/** Applications (and, in the "Not yet applied" and "All" views, registered people) after every filter. */
export function buildApplicationRows(applications: HrShortlistApplication[], registered: HrRegisteredApplicant[], params: ApplicationListParams): ApplicationListRow[] {
  // An explicit stage or job (e.g. a dashboard or job-posting link) overrides the quick view.
  const quick: QuickView = params.stage || params.job ? "all" : params.quick;
  const term = params.q.toLowerCase();
  const matchesTerm = (row: ApplicationListRow) => !term || row.name.toLowerCase().includes(term) || (row.applicantNumber ?? "").includes(term);

  const applicationRows: ApplicationListRow[] = quick === "not-yet-applied" ? [] : applications
    .filter((application) => quickMatches(quick, application.status) && (!params.stage || application.status === params.stage) && (!params.job || application.job_opening_id === params.job))
    .map((application) => ({
      kind: "application" as const,
      id: application.id,
      name: application.applicant_name || `Application ${application.id.slice(0, 8)}`,
      applicantNumber: formatApplicantNumber(application.applicant_number),
      jobId: application.job_opening_id,
      jobTitle: application.job_title ?? null,
      status: application.status,
      submittedAt: application.submitted_at,
      aiStatus: application.ai_score_status,
      aiScore: application.ai_score,
    }));

  const includeRegistered = (quick === "not-yet-applied" || quick === "all") && !params.stage && !params.job && !params.ai && params.minScore === undefined;
  const registeredRows: ApplicationListRow[] = includeRegistered ? registered.filter((applicant) => applicant.application_count === 0).map((applicant) => ({
    kind: "registered" as const,
    id: applicant.user_id,
    name: registeredName(applicant),
    applicantNumber: formatApplicantNumber(applicant.applicant_number),
    submittedAt: applicant.registered_at,
    applicant,
  })) : [];

  return [...applicationRows, ...registeredRows].filter(matchesTerm);
}
```

The quick-view test expects `fallback.name` to be `"Application 1"` for id `"1"`, because `slice(0, 8)` of `"1"` is `"1"`.

- [ ] **Step 5: Implement the tab and the page workspace**

`src/components/recruitment/hr-applications.tsx`:

```tsx
"use client";

import Link from "next/link";
import { MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { ApplicationStageBadge } from "@/components/recruitment/application-stage-badge";
import { RegisteredApplicantDrawer } from "@/components/recruitment/hr-registered-applicants";
import { MoveStageDialog, NotSelectedDialog } from "@/components/recruitment/stage-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/search-input";
import { useHrRegisteredApplicants } from "@/hooks/use-applicant-portal";
import { useAllHrApplications, useAllHrJobs } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { APPLICATION_SORT_ACCESSORS, buildApplicationRows, parseApplicationListParams, QUICK_VIEWS, type ApplicationListRow } from "@/lib/recruitment/application-list";
import { allowedNextStatuses } from "@/lib/recruitment/application-stages";
import type { HrRegisteredApplicant } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { useListParams } from "@/lib/workspace/list-params";
import { formatSort, paginate, sortRows } from "@/lib/workspace/table";
import { applicationStatusSchema, type ApplicationStatus } from "@/schemas/recruitment";

const KEYS = ["quick", "stage", "job", "q", "ai", "minScore", "sort", "page"] as const;
const AI_LABELS: Record<string, string> = { queued: "Queued", processing: "Analyzing", completed: "Completed", failed: "Failed", unscored: "Not analyzed" };

function AiMatch({ row }: { row: Extract<ApplicationListRow, { kind: "application" }> }) {
  if (row.aiStatus === "completed" && row.aiScore !== null) {
    return (
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, row.aiScore)}%` }} /></span>
        <span className="font-medium tabular-nums">{row.aiScore}</span>
      </span>
    );
  }
  const text = row.aiStatus === "failed" ? "Analysis failed" : row.aiStatus === "unscored" ? "Not analyzed" : row.aiStatus === "queued" ? "Queued" : "Analyzing";
  return <span className={cn("text-sm text-muted-foreground", row.aiStatus === "failed" && "text-destructive")}>{text}</span>;
}

export function HrApplications() {
  const { params: raw, set, clear } = useListParams(KEYS);
  const params = parseApplicationListParams(raw);
  const applications = useAllHrApplications({ aiStatus: params.ai || undefined, minimumScore: params.minScore });
  const registered = useHrRegisteredApplicants();
  const jobs = useAllHrJobs();
  const [moving, setMoving] = useState<{ id: string; status: ApplicationStatus; stage: ApplicationStatus } | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<HrRegisteredApplicant | null>(null);

  const rows = buildApplicationRows(applications.data ?? [], registered.data ?? [], params);
  const page = paginate(sortRows(rows, params.sort, APPLICATION_SORT_ACCESSORS), params.page, 25);
  const jobTitle = (id: number) => jobs.data?.find((job) => job.id === id)?.title ?? `Posting ${id}`;

  const chips = [
    params.stage ? { key: "stage", label: `Stage: ${params.stage}`, onRemove: () => set({ stage: "" }) } : null,
    params.job ? { key: "job", label: `Job: ${jobTitle(params.job)}`, onRemove: () => set({ job: "" }) } : null,
    params.ai ? { key: "ai", label: `AI: ${AI_LABELS[params.ai]}`, onRemove: () => set({ ai: "" }) } : null,
    params.minScore !== undefined ? { key: "minScore", label: `Score ≥ ${params.minScore}`, onRemove: () => set({ minScore: "" }) } : null,
    params.q ? { key: "q", label: `Search: ${params.q}`, onRemove: () => set({ q: "" }) } : null,
  ].filter((chip): chip is NonNullable<typeof chip> => chip !== null);

  const columns: DataTableColumn<ApplicationListRow>[] = [
    { key: "name", header: "Applicant", sortable: true, cell: (row) => (
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-subtle text-xs font-semibold text-primary">{row.name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
        <div className="min-w-0">
          {row.kind === "application"
            ? <Link className="font-medium hover:underline" href={`/hr/applications/${row.id}`}>{row.name}</Link>
            : <button className="font-medium hover:underline" onClick={() => setDrawer(row.applicant)} type="button">{row.name}</button>}
          {row.applicantNumber ? <p className="text-sm text-muted-foreground tabular-nums">{row.applicantNumber}</p> : null}
        </div>
      </div>
    ) },
    { key: "job", header: "Job posting", hideBelow: "md", cell: (row) => <span className="text-secondary-foreground">{row.kind === "application" ? (row.jobTitle ?? "—") : "—"}</span> },
    { key: "stage", header: "Stage", cell: (row) => row.kind === "application" ? <ApplicationStageBadge status={row.status} /> : <Badge variant="warning">Not yet applied</Badge> },
    { key: "ai", header: "AI match", sortable: true, cell: (row) => row.kind === "application" ? <AiMatch row={row} /> : <span className="text-muted-foreground">—</span> },
    { key: "submitted", header: "Submitted", sortable: true, hideBelow: "lg", cell: (row) => <span className="tabular-nums text-secondary-foreground">{formatDate(row.submittedAt)}</span> },
    { key: "actions", header: "Actions", align: "right", cell: (row) => {
      if (row.kind !== "application") return null;
      const allowed = allowedNextStatuses[row.status];
      const forward = allowed.filter((next) => next !== "Not Selected");
      return (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button aria-label={`Actions for ${row.name}`} size="icon-sm" variant="ghost" />}><MoreHorizontal aria-hidden="true" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<a href={`/hr/applications/${row.id}`} rel="noreferrer" target="_blank" />}>Open in new tab</DropdownMenuItem>
            {forward.length ? <DropdownMenuSeparator /> : null}
            {forward.map((stage) => <DropdownMenuItem key={stage} onClick={() => setMoving({ id: row.id, status: row.status, stage })}>Move to {stage}</DropdownMenuItem>)}
            {allowed.includes("Not Selected") ? <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setRejecting(row.id)} variant="destructive">Mark as not selected</DropdownMenuItem></> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    } },
  ];

  const hasFilters = chips.length > 0 || params.quick !== "active";
  const noApplicationsAtAll = !applications.isLoading && !(applications.data ?? []).length && !hasFilters;

  return (
    <div className="space-y-4">
      <div aria-label="Quick views" className="inline-flex flex-wrap gap-1 rounded-md border bg-card p-1" role="group">
        {QUICK_VIEWS.map((view) => (
          <button aria-pressed={!params.stage && !params.job && params.quick === view.value} className="rounded px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-primary-subtle aria-pressed:text-primary" key={view.value} onClick={() => set({ quick: view.value === "active" ? "" : view.value, stage: "", job: "" })} type="button">{view.label}</button>
        ))}
      </div>
      <FilterBar chips={chips} onClearAll={chips.length ? () => clear(["stage", "job", "ai", "minScore", "q"]) : undefined}>
        <SearchInput label="Search applications" onChange={(q) => set({ q })} placeholder="Search name or applicant number" value={params.q} />
        <NativeSelect aria-label="Job posting" className="w-52" onChange={(event) => set({ job: event.target.value })} value={params.job ? String(params.job) : ""}>
          <option value="">All job postings</option>
          {(jobs.data ?? []).map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Stage" className="w-48" onChange={(event) => set({ stage: event.target.value })} value={params.stage}>
          <option value="">All stages</option>
          {applicationStatusSchema.options.map((status) => <option key={status} value={status}>{status}</option>)}
        </NativeSelect>
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}><SlidersHorizontal aria-hidden="true" />More filters</PopoverTrigger>
          <PopoverContent>
            <div className="space-y-4">
              <FormField htmlFor="filter-ai-status" label="AI analysis status">
                <NativeSelect id="filter-ai-status" onChange={(event) => set({ ai: event.target.value })} value={params.ai}>
                  <option value="">All results</option>
                  {Object.entries(AI_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </FormField>
              <FormField htmlFor="filter-min-score" label="Minimum AI score (0–100)">
                <Input id="filter-min-score" inputMode="numeric" max={100} min={0} onChange={(event) => set({ minScore: event.target.value })} placeholder="Any score" type="number" value={params.minScore ?? ""} />
              </FormField>
            </div>
          </PopoverContent>
        </Popover>
      </FilterBar>
      <DataTable
        caption="Applications"
        columns={columns}
        empty={noApplicationsAtAll
          ? <EmptyState action={<Link className="font-medium text-primary hover:underline" href="/hr/jobs">Go to job postings</Link>} description="Applicants appear here once they apply to a published posting." title="No applications yet" />
          : <EmptyState action={<Button onClick={() => clear(["quick", "stage", "job", "ai", "minScore", "q"])} variant="outline">Clear filters</Button>} title="No applications match these filters" />}
        error={applications.error?.message ?? registered.error?.message}
        footer={page.total ? <Pagination from={page.from} noun="applications" onPageChange={(next) => set({ page: String(next) })} page={page.page} pageCount={page.pageCount} to={page.to} total={page.total} /> : null}
        getRowHref={(row) => (row.kind === "application" ? `/hr/applications/${row.id}` : null)}
        getRowKey={(row) => `${row.kind}-${row.id}`}
        isLoading={applications.isLoading}
        loadingLabel="Loading applications…"
        onRetry={() => void applications.refetch()}
        onSortChange={(next) => set({ sort: formatSort(next) })}
        rows={page.rows}
        sort={params.sort}
      />
      {moving ? <MoveStageDialog applicationId={moving.id} initialStage={moving.stage} onOpenChange={(open) => { if (!open) setMoving(null); }} open status={moving.status} /> : null}
      <NotSelectedDialog applicationId={rejecting ?? ""} onOpenChange={(open) => { if (!open) setRejecting(null); }} open={Boolean(rejecting)} />
      <RegisteredApplicantDrawer applicant={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
```

`src/components/recruitment/hr-applications-workspace.tsx`:

```tsx
"use client";

import { PageHeader } from "@/components/ui/page-header";
import { TabPanel, Tabs, useUrlTab } from "@/components/ui/tabs";
import { PageContainer } from "@/components/workspace-shell/page-container";

import { HrApplications } from "./hr-applications";
import { HrRegisteredApplicants } from "./hr-registered-applicants";

export function HrApplicationsWorkspace() {
  const [view, setView] = useUrlTab("view", ["applications", "applicants"], "applications");
  return (
    <PageContainer width="wide">
      <PageHeader title="Applications" />
      <Tabs items={[{ value: "applications", label: "Applications" }, { value: "applicants", label: "Registered applicants" }]} label="Recruitment views" onValueChange={setView} value={view}>
        <TabPanel value="applications"><HrApplications /></TabPanel>
        <TabPanel value="applicants"><HrRegisteredApplicants /></TabPanel>
      </Tabs>
    </PageContainer>
  );
}
```

Replace `src/app/(app)/hr/applications/page.tsx` with:

```tsx
import { HrApplicationsWorkspace } from "@/components/recruitment/hr-applications-workspace";

export default function HrApplicationsPage() {
  return <HrApplicationsWorkspace />;
}
```

Delete the old list: `git rm src/components/recruitment/hr-application-list.tsx`.

Then fix the old combined test. `src/components/recruitment/hr-recruitment-workspace.test.tsx` imports the deleted list. Delete its four list-related tests:

- "shows a failed analysis as failed in both list and detail views" (list half),
- "names each application by applicant and position…",
- "lists registered applicants who have not applied yet…".

Also remove its `HrApplicationList` import. The detail tests there are replaced in Task 18.

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx vitest run src/lib/recruitment src/components/recruitment && npm run typecheck`

Expected: PASS. `hr-recruitment-workspace.test.tsx` still compiles against the old `hr-application-detail.tsx`, which Task 18 removes.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/recruitment src/components/recruitment src/queries/recruitment.ts src/hooks/use-recruitment.ts src/app/\(app\)/hr/applications/page.tsx
git commit -m "feat: applications table with quick views, URL filters, AI-match sorting and stage actions"
```

---

### Task 17: Applicant detail — tab content

**Files:**
- Create:
  - `src/components/recruitment/application-detail/overview-tab.tsx`
  - `src/components/recruitment/application-detail/profile-tab.tsx`
  - `src/components/recruitment/application-detail/documents-tab.tsx`
  - `src/components/recruitment/application-detail/activity-tab.tsx`
  - `src/components/recruitment/application-detail/open-signed-url.ts`
- Test: `src/components/recruitment/application-detail/tabs.test.tsx`

**Interfaces:**
- Consumes: `useApplicationAiScores`, `useRetryApplicationAnalysis`, `useAddApplicationRemark`, `getApplicantDocumentUrl`, `getApplicantProfileDocumentUrl` (existing); `APPLICANT_PROFILE_DOCUMENT_KINDS`; `documentKindLabels`, `historyEntryLabel` (from `application-status-tracker.tsx`); `notifySuccess`.
- Produces:
  - `openSignedUrl(getUrl: () => Promise<string>): Promise<void>`. Opens a tab synchronously, then navigates it; throws if the URL fails.
  - `OverviewTab({ applicationId, coverNote, profileDocuments, history, onShowDocuments })`.
  - `ProfileTab({ applicant: Applicant | null })`.
  - `DocumentsTab({ profileDocuments, applicationDocuments })`.
  - `ActivityTab({ applicationId, history })`.
  - `type ProfileDocument = Pick<ApplicantProfileDocument, "id" | "kind" | "file_name" | "object_path" | "updated_at">`.

The Profile tab shows the fields `applicants(*)` returns: name, birth, gender, civil status, religion, citizenship, phone and address. Education is not part of that select, so the spec's "Education & eligibility" group is omitted rather than adding a query. Activity entries show timestamps. The history rows carry only an actor id, not a name, so actor names are not shown.

- [ ] **Step 1: Write the failing tests**

`src/components/recruitment/application-detail/tabs.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ remark: vi.fn(), retry: vi.fn(), notify: vi.fn(), scores: [] as Array<Record<string, unknown>>, profileUrl: vi.fn(), appUrl: vi.fn() }));
vi.mock("@/components/ui/toaster", () => ({ notifySuccess: mocks.notify }));
vi.mock("@/queries/recruitment", () => ({ getApplicantProfileDocumentUrl: mocks.profileUrl, getApplicantDocumentUrl: mocks.appUrl }));
vi.mock("@/hooks/use-recruitment", () => ({
  useApplicationAiScores: () => ({ data: mocks.scores, error: null }),
  useRetryApplicationAnalysis: () => ({ isPending: false, mutateAsync: mocks.retry }),
  useAddApplicationRemark: () => ({ isPending: false, mutateAsync: mocks.remark }),
}));

import { ActivityTab } from "./activity-tab";
import { DocumentsTab } from "./documents-tab";
import { OverviewTab } from "./overview-tab";
import { ProfileTab } from "./profile-tab";

const id = "00000000-0000-0000-0000-000000000001";
const profileDocuments = [{ id: "d1", kind: "resume", file_name: "resume.pdf", object_path: "p/resume.pdf", updated_at: "2026-10-01T00:00:00Z" }] as never[];
const history = [
  { id: "h1", application_id: id, actor_user_id: null, previous_status: null, next_status: "Submitted", note: null, created_at: "2026-10-01T00:00:00Z" },
  { id: "h2", application_id: id, actor_user_id: "x", previous_status: "Submitted", next_status: "Submitted", note: "Passed the BMI at Crame.", created_at: "2026-10-02T00:00:00Z" },
] as never[];

describe("applicant detail tabs", () => {
  beforeEach(() => { mocks.scores = []; mocks.remark.mockReset(); mocks.retry.mockReset(); mocks.notify.mockReset(); });

  it("summarises the AI match, document checklist and latest remark on Overview", async () => {
    mocks.scores = [{ id: "s", status: "completed", score: 82, explanation: "Strong fit", failure_code: null }];
    const onShowDocuments = vi.fn();
    render(<OverviewTab applicationId={id} coverNote="I am ready." history={history} onShowDocuments={onShowDocuments} profileDocuments={profileDocuments} />);
    expect(screen.getByRole("region", { name: "AI match" })).toHaveTextContent("82/100");
    expect(screen.getByText("1 of 5 required documents uploaded")).toBeInTheDocument();
    expect(screen.getByText(/Missing: PSA birth certificate, 2x2 picture, Eligibility, Diploma/)).toBeInTheDocument();
    expect(screen.getByText("Passed the BMI at Crame.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View documents" }));
    expect(onShowDocuments).toHaveBeenCalled();
  });

  it("offers a retry when analysis failed or timed out", async () => {
    mocks.scores = [{ id: "s", status: "failed", score: null, explanation: null, failure_code: "timed_out" }];
    render(<OverviewTab applicationId={id} coverNote={null} history={[]} onShowDocuments={() => undefined} profileDocuments={[]} />);
    expect(screen.getByRole("region", { name: "AI match" })).toHaveTextContent("Analysis timed out");
    await userEvent.click(screen.getByRole("button", { name: "Retry analysis" }));
    expect(mocks.retry).toHaveBeenCalledWith(id);
  });

  it("groups profile and application documents and marks missing ones", () => {
    render(<DocumentsTab applicationDocuments={[{ id: "a1", application_id: id, kind: "bmi_proof", object_path: "x/bmi.pdf", file_name: "bmi.pdf", mime_type: "application/pdf", size_bytes: 1, uploaded_by_user_id: null, created_at: "2026-10-03T00:00:00Z" }]} profileDocuments={profileDocuments} />);
    const required = screen.getByRole("region", { name: "Required profile documents" });
    expect(within(required).getByRole("button", { name: "View CV / Resume: resume.pdf" })).toBeInTheDocument();
    expect(within(required).getAllByText("Not uploaded")).toHaveLength(4);
    expect(within(screen.getByRole("region", { name: "Submitted with this application" })).getByRole("button", { name: "View BMI proof: bmi.pdf" })).toBeInTheDocument();
  });

  it("adds a remark from the Activity tab and lists the history newest first", async () => {
    mocks.remark.mockResolvedValue(undefined);
    render(<ActivityTab applicationId={id} history={history} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Passed the BMI at Crame.");
    await userEvent.click(screen.getByRole("button", { name: "Add remark" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a remark.");
    await userEvent.type(screen.getByLabelText("Remark"), "Called the applicant.");
    await userEvent.click(screen.getByRole("button", { name: "Add remark" }));
    expect(mocks.remark).toHaveBeenCalledWith({ applicationId: id, remark: "Called the applicant." });
    expect(mocks.notify).toHaveBeenCalledWith("Remark added · applicant notified");
  });

  it("shows Not provided for empty profile fields", () => {
    render(<ProfileTab applicant={{ id: "a", profile_id: "p", applicant_number: 1, first_name: "Ana", middle_name: null, last_name: "Reyes", qualifier: null, place_of_birth: null, date_of_birth: "1998-04-12", gender: "female", civil_status: null, religion: null, citizenship: "Filipino", profile_image_path: null, phone: "0917", address: null, created_at: "", updated_at: "" }} />);
    expect(screen.getByRole("heading", { name: "Personal" })).toBeInTheDocument();
    expect(screen.getByText("April 12, 1998")).toBeInTheDocument();
    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/recruitment/application-detail/tabs.test.tsx`

Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

`open-signed-url.ts`:

```ts
/**
 * Opens a signed file URL in one click. The tab is opened synchronously (inside the click),
 * so popup blockers allow it, then pointed at the URL once it resolves.
 */
export async function openSignedUrl(getUrl: () => Promise<string>) {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  try {
    const url = await getUrl();
    if (tab) tab.location.href = url; else window.location.assign(url);
  } catch (cause) {
    tab?.close();
    throw cause;
  }
}
```

`overview-tab.tsx`:

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { useApplicationAiScores, useRetryApplicationAnalysis } from "@/hooks/use-recruitment";
import { formatDateTime } from "@/lib/format-date";
import type { ApplicantProfileDocument, ApplicationStatusHistory } from "@/lib/types/database";
import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

export type ProfileDocument = Pick<ApplicantProfileDocument, "id" | "kind" | "file_name" | "object_path" | "updated_at">;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border bg-card p-5">
      <h3 className="mb-3 text-base font-semibold" id={id}>{title}</h3>
      {children}
    </section>
  );
}

function AiMatchCard({ applicationId }: { applicationId: string }) {
  const scores = useApplicationAiScores(applicationId);
  const retry = useRetryApplicationAnalysis();
  const [error, setError] = useState<string | null>(null);
  const score = scores.data?.[0];
  const analyzing = score?.status === "queued" || score?.status === "processing";
  return (
    <Section id="ai-match-heading" title="AI match">
      <div aria-live="polite" className="space-y-2">
        {scores.error ? <ErrorState message={scores.error.message} /> : null}
        {score?.status === "completed" ? <p className="text-base"><span className="text-2xl font-semibold tabular-nums">{score.score}/100</span>{score.explanation ? <span className="mt-1 block text-secondary-foreground">{score.explanation}</span> : null}</p> : null}
        {analyzing ? <p className="text-muted-foreground">Analyzing application…</p> : null}
        {score?.status === "failed" ? (
          <div className="space-y-3">
            <p>{score.failure_code === "timed_out" ? "Analysis timed out. The analysis service did not finish in time." : "Analysis failed. You can retry when the service is available."}</p>
            <Button loading={retry.isPending} onClick={async () => { setError(null); try { await retry.mutateAsync(applicationId); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to retry analysis."); } }} size="sm" variant="outline">Retry analysis</Button>
          </div>
        ) : null}
        {!score && !scores.error ? <p className="text-muted-foreground">Not analyzed. This may be an application submitted before automatic analysis was enabled.</p> : null}
        {error ? <ErrorState message={error} /> : null}
        <p className="text-sm text-muted-foreground">HR makes the final decision. Recommendations never change an application&apos;s stage.</p>
      </div>
    </Section>
  );
}

export function OverviewTab({ applicationId, coverNote, history, onShowDocuments, profileDocuments }: { applicationId: string; coverNote: string | null; history: ApplicationStatusHistory[]; profileDocuments: ProfileDocument[]; onShowDocuments: () => void }) {
  const uploaded = APPLICANT_PROFILE_DOCUMENT_KINDS.filter(({ kind }) => profileDocuments.some((document) => document.kind === kind));
  const missing = APPLICANT_PROFILE_DOCUMENT_KINDS.filter(({ kind }) => !profileDocuments.some((document) => document.kind === kind));
  const latestRemark = history.filter((entry) => entry.previous_status === entry.next_status && entry.note).at(-1);
  return (
    <div className="space-y-4">
      <AiMatchCard applicationId={applicationId} />
      <Section id="documents-summary-heading" title="Documents">
        <p className="text-base">{uploaded.length} of {APPLICANT_PROFILE_DOCUMENT_KINDS.length} required documents uploaded</p>
        {missing.length ? <p className="mt-1 text-sm text-warning">Missing: {missing.map(({ label }) => label).join(", ")}</p> : null}
        <Button className="mt-3" onClick={onShowDocuments} size="sm" variant="outline">View documents</Button>
      </Section>
      <Section id="cover-note-heading" title="Cover note">
        <p className="whitespace-pre-wrap text-base text-secondary-foreground">{coverNote || "No cover note."}</p>
      </Section>
      {latestRemark ? (
        <Section id="latest-remark-heading" title="Latest remark">
          <p className="text-base">{latestRemark.note}</p>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(latestRemark.created_at)}</p>
        </Section>
      ) : null}
    </div>
  );
}
```

`profile-tab.tsx`:

```tsx
import { formatDate } from "@/lib/format-date";
import type { Applicant } from "@/lib/types/database";

const titleCase = (value: string | null) => (value ? value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) : null);

export function ProfileTab({ applicant }: { applicant: Applicant | null }) {
  if (!applicant) return <p className="text-muted-foreground">The applicant profile is not available.</p>;
  const groups: { title: string; rows: [string, string | null][] }[] = [
    { title: "Personal", rows: [
      ["First name", applicant.first_name], ["Middle name", applicant.middle_name], ["Last name", applicant.last_name], ["Qualifier", applicant.qualifier],
      ["Date of birth", formatDate(applicant.date_of_birth)], ["Place of birth", applicant.place_of_birth], ["Gender", titleCase(applicant.gender)],
      ["Civil status", titleCase(applicant.civil_status)], ["Religion", applicant.religion], ["Citizenship", applicant.citizenship],
    ] },
    { title: "Contact", rows: [["Mobile", applicant.phone]] },
    { title: "Address", rows: [["Home address", applicant.address]] },
  ];
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section aria-labelledby={`profile-${group.title}`} className="rounded-lg border bg-card p-5" key={group.title}>
          <h3 className="mb-3 text-base font-semibold" id={`profile-${group.title}`}>{group.title}</h3>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {group.rows.map(([label, value]) => (
              <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className={value ? "text-base" : "text-base text-muted-foreground"}>{value || "Not provided"}</dd></div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
```

`documents-tab.tsx`:

```tsx
"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { formatDate } from "@/lib/format-date";
import type { ApplicantDocument } from "@/lib/types/database";
import { getApplicantDocumentUrl, getApplicantProfileDocumentUrl } from "@/queries/recruitment";
import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

import { documentKindLabels } from "../application-status-tracker";
import { openSignedUrl } from "./open-signed-url";
import type { ProfileDocument } from "./overview-tab";

type Row = { key: string; label: string; fileName: string | null; date: string | null; open: (() => Promise<string>) | null };

function DocumentGroup({ id, onError, rows, title }: { id: string; title: string; rows: Row[]; onError: (message: string) => void }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border bg-card">
      <h3 className="border-b px-5 py-3 text-base font-semibold" id={id}>{title}</h3>
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((row) => (
            <li className="flex flex-wrap items-center gap-3 px-5 py-3" key={row.key}>
              <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{row.label}</p>
                <p className="truncate text-sm text-muted-foreground">{row.fileName ? `${row.fileName} · ${formatDate(row.date)}` : "Not uploaded"}</p>
              </div>
              {row.open ? <Button aria-label={`View ${row.label}: ${row.fileName}`} onClick={() => void openSignedUrl(row.open!).catch((cause) => onError(cause instanceof Error ? cause.message : "We could not open this document."))} size="sm" variant="outline">View</Button> : null}
            </li>
          ))}
        </ul>
      ) : <p className="px-5 py-4 text-sm text-muted-foreground">No documents were attached.</p>}
    </section>
  );
}

export function DocumentsTab({ applicationDocuments, profileDocuments }: { profileDocuments: ProfileDocument[]; applicationDocuments: ApplicantDocument[] }) {
  const [error, setError] = useState<string | null>(null);
  const required: Row[] = APPLICANT_PROFILE_DOCUMENT_KINDS.map(({ kind, label }) => {
    const document = profileDocuments.find((item) => item.kind === kind);
    return { key: kind, label, fileName: document?.file_name ?? null, date: document?.updated_at ?? null, open: document ? () => getApplicantProfileDocumentUrl(document.object_path) : null };
  });
  const submitted: Row[] = applicationDocuments.map((document) => ({
    key: document.id, label: documentKindLabels[document.kind], fileName: document.file_name, date: document.created_at,
    open: async () => { const url = await getApplicantDocumentUrl(document.object_path); if (!url) throw new Error("We could not open this document."); return url; },
  }));
  return (
    <div className="space-y-4">
      {error ? <ErrorState message={error} /> : null}
      <DocumentGroup id="required-documents-heading" onError={setError} rows={required} title="Required profile documents" />
      <DocumentGroup id="application-documents-heading" onError={setError} rows={submitted} title="Submitted with this application" />
    </div>
  );
}
```

Check the return type of `getApplicantDocumentUrl` in `src/queries/recruitment.ts:541`. If it already returns `string`, drop the null guard.

`activity-tab.tsx`:

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { notifySuccess } from "@/components/ui/toaster";
import { useAddApplicationRemark } from "@/hooks/use-recruitment";
import { formatDateTime } from "@/lib/format-date";
import type { ApplicationStatusHistory } from "@/lib/types/database";

import { historyEntryLabel } from "../application-status-tracker";

export function ActivityTab({ applicationId, history }: { applicationId: string; history: ApplicationStatusHistory[] }) {
  const addRemark = useAddApplicationRemark();
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (addRemark.isPending) return;
    setError(null);
    if (!remark.trim()) { setError("Enter a remark."); return; }
    try {
      await addRemark.mutateAsync({ applicationId, remark: remark.trim() });
      setRemark("");
      notifySuccess("Remark added · applicant notified");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not add this remark.");
    }
  }

  return (
    <div className="space-y-5">
      <section aria-label="Add remark" className="space-y-3 rounded-lg border bg-card p-5">
        <FormField description="Record progress without changing the stage. The applicant sees each remark and is notified." error={error ?? undefined} htmlFor="application-remark" label="Remark">
          <Textarea id="application-remark" maxLength={2000} onChange={(event) => { setError(null); setRemark(event.target.value); }} rows={3} value={remark} />
        </FormField>
        <Button loading={addRemark.isPending} onClick={() => void save()} type="button" variant="outline">Add remark</Button>
      </section>
      <ol className="relative space-y-4 border-l pl-5">
        {history.toReversed().map((entry) => {
          const isRemark = entry.previous_status === entry.next_status;
          return (
            <li className="relative" key={entry.id}>
              <span aria-hidden="true" className={isRemark ? "absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card bg-muted-foreground" : "absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card bg-primary"} />
              <p className="text-base font-medium">{isRemark ? "Remark" : `Moved to ${historyEntryLabel(entry)}`}</p>
              {entry.note ? <p className="text-base text-secondary-foreground">{entry.note}</p> : null}
              <p className="text-sm text-muted-foreground">{formatDateTime(entry.created_at)}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/recruitment/application-detail/tabs.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/recruitment/application-detail
git commit -m "feat: applicant detail tabs for overview, profile, documents and activity"
```

---

### Task 18: Applicant detail — header, stage tracker, details panel, and assembly

**Files:**
- Create:
  - `src/components/recruitment/application-detail/application-header.tsx`
  - `src/components/recruitment/application-detail/stage-tracker.tsx`
  - `src/components/recruitment/application-detail/details-panel.tsx`
  - `src/components/recruitment/application-detail/application-review.tsx`
- Modify: `src/app/(app)/hr/applications/[applicationId]/page.tsx`
- Delete:
  - `src/components/recruitment/hr-application-detail.tsx`
  - `src/components/recruitment/hr-required-documents.tsx`
  - `src/components/recruitment/hr-required-documents.test.tsx`
  - `src/components/recruitment/hr-recruitment-workspace.test.tsx`
- Test: `src/components/recruitment/application-detail/application-review.test.tsx`

**Interfaces:**
- Consumes: Tasks 14 and 17; `useMyApplication`, `useApplicantProfileDocumentsFor`, `useApplicantProfilePhotoUrl` (existing); `useHrRegisteredApplicants` (for the email); `useBreadcrumbTrail`; `Tabs`, `TabPanel`, `useUrlTab`.
- Produces: `HrApplicationReview({ applicationId })`.

- [ ] **Step 1: Write the failing tests**

`src/components/recruitment/application-detail/application-review.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ status: "Under Review", documents: [] as Array<Record<string, unknown>>, missing: false, history: [] as Array<Record<string, unknown>> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/hr/applications/x", useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/components/workspace-shell/breadcrumbs", () => ({ useBreadcrumbTrail: vi.fn() }));
vi.mock("@/components/recruitment/stage-dialogs", () => ({
  MoveStageDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Move to next stage" /> : null),
  NotSelectedDialog: ({ open }: { open: boolean }) => (open ? <div role="alertdialog" aria-label="Mark as not selected?" /> : null),
  HireDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Hire applicant" /> : null),
}));
vi.mock("./overview-tab", () => ({ OverviewTab: () => <p>overview content</p> }));
vi.mock("./profile-tab", () => ({ ProfileTab: () => <p>profile content</p> }));
vi.mock("./documents-tab", () => ({ DocumentsTab: () => <p>documents content</p> }));
vi.mock("./activity-tab", () => ({ ActivityTab: () => <p>activity content</p> }));
vi.mock("@/hooks/use-applicant-portal", () => ({ useHrRegisteredApplicants: () => ({ data: [{ applicant_id: "a1", email: "ana@example.test" }] }) }));
vi.mock("@/hooks/use-recruitment", () => ({
  useMyApplication: () => (state.missing ? { isLoading: false, error: null, data: null } : {
    isLoading: false, error: null,
    data: {
      application: { id: "00000000-0000-0000-0000-000000000001", applicant_id: "a1", job_opening_id: 4, status: state.status, submitted_at: "2026-10-01T00:00:00Z", cover_note: null,
        applicants: { first_name: "Ana", middle_name: "Santos", last_name: "Reyes", qualifier: null, applicant_number: 12345, phone: "0917", profile_image_path: null },
        job_openings: { id: 4, title: "Patrol North" } },
      history: state.history,
      documents: state.documents,
    },
  }),
  useApplicantProfileDocumentsFor: () => ({ isLoading: false, error: null, data: [] }),
  useApplicantProfilePhotoUrl: () => ({ data: null }),
}));

import { HrApplicationReview } from "./application-review";

describe("HrApplicationReview", () => {
  beforeEach(() => { state.status = "Under Review"; state.documents = []; state.missing = false; state.history = [{ id: "h", previous_status: "Submitted", next_status: "Under Review", created_at: new Date(Date.now() - 4 * 86_400_000).toISOString(), note: null }]; });

  it("names the applicant, links the job and shows how long they have been at this stage", () => {
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByRole("heading", { level: 1, name: "Ana Santos Reyes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Patrol North" })).toHaveAttribute("href", "/hr/jobs/4");
    expect(screen.getByText("in Under Review for 4 days")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Application stages" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Application stages" })).getByText("Under Review").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("complementary", { name: "Applicant details" })).toHaveTextContent("ana@example.test");
  });

  it.each([
    ["Under Review", ["Move to next stage", "Not selected"], []],
    ["For Training", ["Hire applicant", "Not selected"], ["Move to next stage"]],
    ["Hired", [], ["Move to next stage", "Hire applicant", "Not selected"]],
    ["Needs Revision", [], ["Move to next stage"]],
  ])("shows the right actions at %s", (status, present, absent) => {
    state.status = status;
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    for (const name of present) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    for (const name of absent) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("disables moving on while the BMI proof is missing", () => {
    state.status = "Endorsed to Crame";
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByRole("button", { name: "Move to next stage" })).toBeDisabled();
    expect(screen.getByText("Waiting for the applicant's BMI proof")).toBeInTheDocument();
  });

  it("opens the move and hire dialogs", async () => {
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    await userEvent.click(screen.getByRole("button", { name: "Move to next stage" }));
    expect(screen.getByRole("dialog", { name: "Move to next stage" })).toBeInTheDocument();
  });

  it("switches tabs", async () => {
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByText("overview content")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Documents/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Activity/ })).toBeInTheDocument();
  });

  it("says when the application does not exist", () => {
    state.missing = true;
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByRole("heading", { level: 1, name: "Application not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to applications" })).toHaveAttribute("href", "/hr/applications");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/recruitment/application-detail/application-review.test.tsx`

Expected: FAIL (module missing).

- [ ] **Step 3: Implement the stage tracker**

`stage-tracker.tsx`:

```tsx
import { Check, X } from "lucide-react";

import { PIPELINE_STAGES, trackerPosition } from "@/lib/recruitment/application-stages";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/schemas/recruitment";

export function StageTracker({ endedAt, status }: { status: ApplicationStatus; endedAt: ApplicationStatus | null }) {
  const { outcome, reached } = trackerPosition(status, endedAt);
  return (
    <div>
      <p className="text-sm text-muted-foreground md:hidden">Stage {reached + 1} of {PIPELINE_STAGES.length} · {status}</p>
      <ol aria-label="Application stages" className="hidden items-center gap-1 md:flex">
        {PIPELINE_STAGES.map((stage, index) => {
          const done = index < reached || (index === reached && outcome === "hired");
          const current = index === reached && outcome !== "hired";
          const stopped = current && outcome === "not-selected";
          const revising = current && outcome === "needs-revision";
          return (
            <li aria-current={current ? "step" : undefined} className="flex min-w-0 flex-1 items-center gap-1.5" key={stage}>
              <span aria-hidden="true" className={cn("grid size-5 shrink-0 place-items-center rounded-full border text-[10px]", done && "border-primary bg-primary text-primary-foreground", current && !stopped && !revising && "border-primary text-primary ring-2 ring-primary/20", stopped && "border-destructive bg-destructive text-white", revising && "border-warning text-warning", !done && !current && "border-input text-muted-foreground")}>
                {done ? <Check className="size-3" /> : stopped ? <X className="size-3" /> : index + 1}
              </span>
              <span className={cn("truncate text-xs", current ? "font-semibold text-foreground" : "text-muted-foreground")}>{stage}</span>
              {stopped ? <span className="sr-only">(not selected at this stage)</span> : null}
              {index < PIPELINE_STAGES.length - 1 ? <span aria-hidden="true" className={cn("h-px flex-1", index < reached ? "bg-primary" : "bg-border")} /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Implement the header, the details panel and the review page**

`details-panel.tsx`:

```tsx
import Link from "next/link";

import { formatDate } from "@/lib/format-date";

export function DetailsPanel({ email, jobId, jobTitle, lastChange, mobile, number, submittedAt }: { email: string | null; mobile: string | null; number: string | null; jobId: number; jobTitle: string | null; submittedAt: string; lastChange: string | null }) {
  const rows: [string, React.ReactNode][] = [
    ["Email", email ?? "—"],
    ["Mobile", mobile ?? "—"],
    ["Applicant number", number ?? "—"],
    ["Job posting", jobTitle ? <Link className="text-primary hover:underline" href={`/hr/jobs/${jobId}`}>{jobTitle}</Link> : "—"],
    ["Submitted", formatDate(submittedAt)],
    ["Last stage change", formatDate(lastChange) ?? "—"],
  ];
  return (
    <aside aria-label="Applicant details" className="rounded-lg border bg-card p-5 lg:sticky lg:top-20">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-1">
        {rows.map(([label, value]) => (
          <div className="min-w-0" key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="truncate text-base">{value}</dd></div>
        ))}
      </dl>
    </aside>
  );
}
```

`application-header.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

import { ApplicationStageBadge } from "@/components/recruitment/application-stage-badge";
import { HireDialog, MoveStageDialog, NotSelectedDialog } from "@/components/recruitment/stage-dialogs";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { stageActions } from "@/lib/recruitment/application-stages";
import type { ApplicationStatus } from "@/schemas/recruitment";

function daysAt(since: string | null) {
  if (!since) return null;
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
  return days < 1 ? "since today" : `for ${days} ${days === 1 ? "day" : "days"}`;
}

type HeaderProps = {
  applicationId: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  applicantNumber: number | null;
  formattedNumber: string | null;
  jobId: number;
  jobTitle: string | null;
  submittedAt: string;
  status: ApplicationStatus;
  stageSince: string | null;
  hasBmiProof: boolean;
  outcomeDate: string | null;
};

export function ApplicationHeader(props: HeaderProps) {
  const [dialog, setDialog] = useState<"move" | "reject" | "hire" | null>(null);
  const action = stageActions(props.status, props.hasBmiProof);
  const canReject = "canReject" in action && action.canReject;

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {props.photoUrl
          ? <img alt="" className="size-14 shrink-0 rounded-full border object-cover" src={props.photoUrl} />
          : <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-primary-subtle text-lg font-semibold text-primary">{props.initials}</span>}
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold">{props.name}</h1>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {props.formattedNumber ? <span className="tabular-nums">{props.formattedNumber}</span> : null}
            {props.jobTitle ? <><span aria-hidden="true">·</span><Link className="text-primary hover:underline" href={`/hr/jobs/${props.jobId}`}>{props.jobTitle}</Link></> : null}
            <span aria-hidden="true">·</span><span>Submitted {formatDate(props.submittedAt)}</span>
          </p>
          <p className="flex flex-wrap items-center gap-2 pt-1">
            <ApplicationStageBadge status={props.status} />
            {action.kind === "closed"
              ? <span className="text-sm text-muted-foreground">{props.outcomeDate ? `on ${formatDate(props.outcomeDate)}` : null}</span>
              : <span className="text-sm text-muted-foreground">in {props.status} {daysAt(props.stageSince)}</span>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {action.kind === "waiting-resubmit" ? <p className="text-sm text-muted-foreground">Waiting for the applicant to resubmit</p> : null}
        {action.kind === "waiting-bmi" ? <p className="text-sm text-muted-foreground">Waiting for the applicant&apos;s BMI proof</p> : null}
        {canReject ? <Button onClick={() => setDialog("reject")} variant="outline">Not selected</Button> : null}
        {action.kind === "advance" || action.kind === "waiting-bmi" ? <Button disabled={action.kind === "waiting-bmi"} onClick={() => setDialog("move")}>Move to next stage</Button> : null}
        {action.kind === "hire" ? <Button onClick={() => setDialog("hire")}>Hire applicant</Button> : null}
      </div>
      <MoveStageDialog applicationId={props.applicationId} onOpenChange={(open) => setDialog(open ? "move" : null)} open={dialog === "move"} status={props.status} />
      <NotSelectedDialog applicationId={props.applicationId} onOpenChange={(open) => setDialog(open ? "reject" : null)} open={dialog === "reject"} />
      <HireDialog applicantNumber={props.applicantNumber} applicationId={props.applicationId} onOpenChange={(open) => setDialog(open ? "hire" : null)} open={dialog === "hire"} />
    </header>
  );
}
```

The header uses a plain `<img>` because the signed photo URL is not on a configured `next/image` domain. Add `{/* eslint-disable-next-line @next/next/no-img-element */}` above it if lint flags it.

`application-review.tsx`:

```tsx
"use client";

import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TabPanel, Tabs, useUrlTab } from "@/components/ui/tabs";
import { useBreadcrumbTrail } from "@/components/workspace-shell/breadcrumbs";
import { PageContainer } from "@/components/workspace-shell/page-container";
import { useHrRegisteredApplicants } from "@/hooks/use-applicant-portal";
import { useApplicantProfileDocumentsFor, useApplicantProfilePhotoUrl, useMyApplication } from "@/hooks/use-recruitment";
import { formatApplicantNumber } from "@/lib/recruitment/applicant-number";
import { endedAtStage } from "@/lib/recruitment/application-stages";
import type { Applicant } from "@/lib/types/database";

import { ActivityTab } from "./activity-tab";
import { ApplicationHeader } from "./application-header";
import { DetailsPanel } from "./details-panel";
import { DocumentsTab } from "./documents-tab";
import { OverviewTab } from "./overview-tab";
import { ProfileTab } from "./profile-tab";
import { StageTracker } from "./stage-tracker";

const TABS = ["overview", "profile", "documents", "activity"] as const;

export function HrApplicationReview({ applicationId }: { applicationId: string }) {
  const result = useMyApplication(applicationId);
  const application = result.data?.application;
  const applicant = (application as unknown as { applicants?: Applicant | null } | undefined)?.applicants ?? null;
  const profileDocuments = useApplicantProfileDocumentsFor(application?.applicant_id);
  const photo = useApplicantProfilePhotoUrl(applicant?.profile_image_path ?? null);
  const registered = useHrRegisteredApplicants();
  const [tab, setTab] = useUrlTab("tab", TABS, "overview");
  const name = applicant ? [applicant.first_name, applicant.middle_name, applicant.last_name, applicant.qualifier].filter(Boolean).join(" ") : application ? `Application ${application.id.slice(0, 8)}` : "";
  useBreadcrumbTrail(name ? [{ label: name }] : []);

  if (result.isLoading) {
    return <PageContainer width="wide"><span className="sr-only" role="status">Loading application…</span><Skeleton className="h-24 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-80 w-full" /></PageContainer>;
  }
  if (result.error) return <PageContainer width="wide"><PageHeader title="Application" /><ErrorState message={result.error.message} onRetry={() => void result.refetch()} /></PageContainer>;
  if (!result.data || !application) {
    return (
      <PageContainer width="narrow">
        <PageHeader title="Application not found" />
        <EmptyState action={<Link className="font-medium text-primary hover:underline" href="/hr/applications">Back to applications</Link>} title="This application does not exist or you cannot view it." />
      </PageContainer>
    );
  }

  const { documents, history } = result.data;
  const job = result.data.application.job_openings;
  const statusChanges = history.filter((entry) => entry.previous_status !== entry.next_status);
  const lastChange = statusChanges.at(-1)?.created_at ?? null;
  const email = registered.data?.find((row) => row.applicant_id === application.applicant_id)?.email ?? null;
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const profileDocs = profileDocuments.data ?? [];

  return (
    <PageContainer width="wide">
      <ApplicationHeader
        applicantNumber={applicant?.applicant_number ?? null}
        applicationId={applicationId}
        formattedNumber={formatApplicantNumber(applicant?.applicant_number)}
        hasBmiProof={documents.some((document) => document.kind === "bmi_proof")}
        initials={initials}
        jobId={application.job_opening_id}
        jobTitle={job?.title ?? null}
        name={name}
        outcomeDate={lastChange}
        photoUrl={photo.data ?? null}
        stageSince={lastChange}
        status={application.status}
        submittedAt={application.submitted_at}
      />
      <StageTracker endedAt={endedAtStage(history)} status={application.status} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18.75rem] lg:items-start">
        <div className="order-2 min-w-0 lg:order-1">
          <Tabs
            items={[
              { value: "overview", label: "Overview" },
              { value: "profile", label: "Profile" },
              { value: "documents", label: "Documents", count: profileDocs.length + documents.length },
              { value: "activity", label: "Activity", count: history.length },
            ]}
            label="Application sections"
            onValueChange={setTab}
            value={tab}
          >
            <TabPanel value="overview"><OverviewTab applicationId={applicationId} coverNote={application.cover_note} history={history} onShowDocuments={() => setTab("documents")} profileDocuments={profileDocs} /></TabPanel>
            <TabPanel value="profile"><ProfileTab applicant={applicant} /></TabPanel>
            <TabPanel value="documents">{profileDocuments.error ? <ErrorState message={profileDocuments.error.message} onRetry={() => void profileDocuments.refetch()} /> : <DocumentsTab applicationDocuments={documents} profileDocuments={profileDocs} />}</TabPanel>
            <TabPanel value="activity"><ActivityTab applicationId={applicationId} history={history} /></TabPanel>
          </Tabs>
        </div>
        <div className="order-1 lg:order-2">
          <DetailsPanel email={email} jobId={application.job_opening_id} jobTitle={job?.title ?? null} lastChange={lastChange} mobile={applicant?.phone ?? null} number={formatApplicantNumber(applicant?.applicant_number)} submittedAt={application.submitted_at} />
        </div>
      </div>
    </PageContainer>
  );
}
```

The hooks `useApplicantProfileDocumentsFor`, `useApplicantProfilePhotoUrl` and `useHrRegisteredApplicants` are called before the early returns. That keeps the hook order stable. `useBreadcrumbTrail` likewise runs before them.

- [ ] **Step 5: Wire the page and delete the old detail**

`src/app/(app)/hr/applications/[applicationId]/page.tsx`: replace the `HrApplicationDetail` import and usage with `HrApplicationReview` from `@/components/recruitment/application-detail/application-review`.

Then delete the old files:

```bash
git rm src/components/recruitment/hr-application-detail.tsx src/components/recruitment/hr-required-documents.tsx src/components/recruitment/hr-required-documents.test.tsx src/components/recruitment/hr-recruitment-workspace.test.tsx
```

`hr-recruitment-workspace.test.tsx` held the job-form "saves a draft" test. Before deleting, confirm that `hr-job-form.test.tsx` covers saving a draft with general requirements. If it does not, move that `it(...)` block, with its mocks, into `hr-job-form.test.tsx` first.

Run: `grep -rn "hr-application-detail\|allowedNextStatuses\|hr-required-documents\|hr-application-list\|hr-registered-applicant-list" src`

Expected: only `src/lib/recruitment/application-stages.ts` and its importers (`stage-dialogs.tsx`, `hr-applications.tsx`).

- [ ] **Step 6: Run the full unit suite and typecheck**

Run: `npm run typecheck && npm run lint && npm run test:run`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src/components/recruitment src/app/\(app\)/hr/applications
git commit -m "feat: applicant review page with identity header, stage tracker, tabs and stage actions"
```

---

### Task 19: End-to-end updates, accessibility, and responsive coverage

**Files:**
- Modify:
  - `e2e/capstone-objectives.spec.ts`
  - `e2e/business-journeys.spec.ts`
  - `e2e/iso25010-quality.spec.ts`
  - `e2e/responsive-layout.spec.ts`

- [ ] **Step 1: Update the recruitment journey (Objective 2)**

In `e2e/capstone-objectives.spec.ts`, replace the HR block from `await page.goto("/hr/applications");` down to `await signOut(page, HR.email);` (the first one, before the applicant uploads the BMI proof) with:

```ts
    await signIn(page, HR.email, HR.home);
    await page.goto("/hr/applications");
    // The queue names each application by its applicant.
    const review = page.getByRole("link", { name: `Aplica Candidate ${runId}`, exact: true });
    await expect(review).toBeVisible({ timeout: 15_000 });
    await expect(review).toHaveAttribute("href", `/hr/applications/${applicationId}`);
    await page.goto(`/hr/applications/${applicationId}`);
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(`Candidate ${runId}`) })).toBeVisible();
    await page.getByRole("tab", { name: /Documents/ }).click();
    await expect(page.getByRole("heading", { name: "Required profile documents" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^View CV \/ Resume: / })).toBeVisible();
    const advance = async (statuses: string[]) => {
      for (const status of statuses) {
        await page.getByRole("button", { name: "Move to next stage" }).click();
        const dialog = page.getByRole("dialog", { name: "Move to next stage" });
        await dialog.getByRole("radio", { name: status }).check();
        await dialog.getByRole("button", { name: `Move to ${status}` }).click();
        await expect(page.getByRole("status").filter({ hasText: `Moved to ${status}` })).toBeVisible();
        await expect(dialog).toBeHidden();
      }
    };
    // The whole cycle runs in the system: interview in San Juan, endorsement to Crame, BMI proof, neuro exam, training.
    await advance(["Under Review", "Interview", "Endorsed to Crame"]);
    await expect(page.getByText("Waiting for the applicant's BMI proof")).toBeVisible();
    await expect(page.getByRole("button", { name: "Move to next stage" })).toBeDisabled();
    await signOut(page, HR.email);
```

Replace the hire block, from `await advance(["Neuro Exam", "For Training"]);` through the "Applicant hired…" expectation, with:

```ts
    await advance(["Neuro Exam", "For Training"]);
    await page.getByRole("button", { name: "Hire applicant" }).click();
    const hireDialog = page.getByRole("dialog", { name: "Hire applicant" });
    await hireDialog.getByLabel(/^Badge number/).fill(badge);
    await hireDialog.getByRole("button", { name: "Hire applicant" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Applicant hired" })).toBeVisible();
```

On the applications list the job filter defaults to "Active". A freshly submitted application is "Submitted", which is active, so the link is visible. The base-ui radio is a `button role="radio"`; if `.check()` fails on it, use `.click()`.

- [ ] **Step 2: Update the dashboard objective (Objective 7)**

Replace the body of the "HR and management dashboards summarize…" test with:

```ts
    await signIn(page, HR.email, HR.home);
    await createDeployment(page, `E2E Dashboard ${runId}`);
    await page.goto("/hr");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 30_000 });
    for (const metric of ["Personnel", "On duty today", "On leave today", "Active deployments", "Open job postings"]) {
      await expect(page.getByRole("article", { name: metric, exact: true })).toContainText(/\d+/);
    }
    const figure = async (name: string) => Number((await page.getByRole("article", { name, exact: true }).locator("p").nth(1).innerText()).split("/")[0]!.replace(/[^\d]/g, ""));
    expect(await figure("Active deployments")).toBeGreaterThan(0);
    expect(await figure("Personnel")).toBeGreaterThan(0);
    for (const heading of ["Needs attention", "Recruitment pipeline", "Attendance", "Recent applications"]) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await signOut(page, HR.email);

    await signIn(page, MANAGEMENT.email, MANAGEMENT.home);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 30_000 });
    for (const heading of ["Recruitment pipeline", "Attendance", "Personnel by unit / section", "Personnel by rank"]) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Needs attention" })).toHaveCount(0);
    await expect(page.getByRole("article", { name: "Personnel", exact: true })).toContainText(/\d+/);
```

- [ ] **Step 3: Find any remaining stale selectors**

Run:

```bash
grep -n "Review application\|Update status\|Next status\|Confirm hire\|Required documents\|Open CV\|Create new Recruitment\|Public Announcements\|Total Personnel\|On-Leave\|Promotion Status\|Deployment status\|Leave status" e2e/*.ts
```

Update each hit:

| Old selector | New selector |
|---|---|
| "Public Announcements" nav link | "Announcements" |
| any remaining "Status updated to" | "Moved to" |
| others | see Step 1 |

"Publish opening" and the job form labels are unchanged.

- [ ] **Step 4: Extend the accessibility and responsive checks**

In `e2e/iso25010-quality.spec.ts`, change the axe route list:

- from `["/hr", "/hr/employees", "/hr/applications", "/hr/deployments", "/hr/attendance", "/reports/deployments"]`
- to `["/hr", "/hr/jobs", "/hr/jobs/new", "/hr/employees", "/hr/applications", "/hr/applications?view=applicants", "/hr/deployments", "/hr/attendance", "/reports/deployments"]`.

In the same file, add an applicant-detail axe scan. Inside the HR axe test, after the loop:

```ts
    await page.goto("/hr/applications?quick=all");
    const firstApplication = page.locator("table[data-slot=data-table] tbody a[href^='/hr/applications/']").first();
    if (await firstApplication.count()) {
      await firstApplication.click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(results.violations).toEqual([]);
    }
```

Use the same `AxeBuilder` import and options that the file's existing loop uses. Match its exact `.withTags`/`.exclude` calls.

In `e2e/responsive-layout.spec.ts`, where the HR routes are checked on a phone viewport, wrap the existing check in a loop over the three widths:

```ts
for (const viewport of [{ width: 1366, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  // …existing per-route overflow assertion, with `await page.setViewportSize(viewport)` before visiting each route…
}
```

Reuse the file's existing `scrollWidth <= clientWidth` assertion verbatim inside the loop.

- [ ] **Step 5: Run the whole end-to-end suite**

Run (local Supabase running): `npm run test:e2e`

Expected: all PASS, including `applicant-visual-baseline.spec.ts` unchanged.

If axe reports a contrast violation on the navy top bar or a badge, fix the token in `.workspace` (Task 2), not with a per-component override.

- [ ] **Step 6: Commit**

```bash
git add e2e
git commit -m "test(e2e): follow the redesigned recruitment and dashboard screens; widen a11y and layout coverage"
```

---

### Task 20: User guide and final verification

**Files:**
- Modify: `docs/user-guides/hris-role-user-guide.md`

- [ ] **Step 1: Update the user guide's screen names**

Run: `grep -n "Recruitment\|Application queue\|Update status\|Next status\|Hire applicant\|Notification\|Dashboard" docs/user-guides/hris-role-user-guide.md`

For each HR or Admin instruction that names an old screen, button or menu item, rewrite it with the new name. Use this mapping:

| Old | New |
|---|---|
| "Recruitment" / "Create new Recruitment" | "Job postings" / "New job posting" |
| "Application queue" | "Applications" |
| "choose Next status, then Update status" | "Move to next stage, choose the stage, then Move to <stage>" |
| "Confirm hire" | "Hire applicant" (in the dialog) |
| the dashboard "Notification" card | "Needs attention" |
| "Employee Records" | "Employees" |
| "Leave Management" | "Leave" |
| "Promotion Records" | "Promotions" |
| "Daily Attendance" | "Kiosk" |
| "Attendance Records" | "Attendance" |
| "Public Announcements" | "Announcements" |
| "Account Management" | "Accounts" |
| "Reviews & Approvals" | "Approvals" |
| "Audit logs" | "Audit log" |

Do not edit Applicant sections.

- [ ] **Step 2: Run the final verification**

Run: `npm run typecheck && npm run lint && npm run test:run && npm run build && npm run test:e2e`

Expected: every command exits 0, and `applicant-visual-baseline.spec.ts` passes with no snapshot updates.

- [ ] **Step 3: Check it visually**

With `npm run dev`, sign in as HR and walk through:

1. `/hr`: needs attention, today strip, pipeline, attendance and recent applications.
2. `/hr/jobs`: tabs, search, the row menu, Withdraw.
3. `/hr/jobs/new`: the side panel.
4. `/hr/applications`: quick views, chips, More filters, the row menu.
5. `/hr/applications?view=applicants`: the drawer.
6. One applicant: tracker, tabs, the move dialog and its toast.

Check each at 1440, 1280, 1024 and 390px. Then sign in as admin, employee and management and confirm the new shell renders their existing pages. Then sign in as the applicant and confirm nothing changed.

- [ ] **Step 4: Commit**

```bash
git add docs/user-guides/hris-role-user-guide.md
git commit -m "docs: update HR and admin screen names in the user guide"
```
