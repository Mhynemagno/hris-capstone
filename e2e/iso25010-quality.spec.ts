import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { openLoginAndSignIn } from "./demo-accounts";

// Objective 9 is a user-based evaluation against ISO/IEC 25010:2023. These checks supply
// automated evidence for the characteristics software can measure on its own; the usability
// and effectiveness ratings still come from the evaluation with San Juan City Police Station
// users (see docs/capstone-objectives-verification.md).

const demoPassword = process.env.HRIS_E2E_PASSWORD ?? "DemoPass!2026";
test.describe.configure({ timeout: 120_000 });

const accounts = {
  hr: { email: "demo.hr@example.test", home: "/hr" },
  employee: { email: "demo.employee@example.test", home: "/employee" },
  management: { email: "demo.management@example.test", home: "/management" },
  applicant: { email: "demo.applicant@example.test", home: "/applicant" },
  admin: { email: "demo.admin@example.test", home: "/admin" },
} as const;

/**
 * Runs SQL as the table owner inside the local Supabase database container. The Data API's
 * service_role has no explicit table grants in this schema, so arrangement cannot go through it.
 */
function localSql(script: string) {
  return execFileSync("docker", ["exec", "-i", "supabase_db_hris-capstone", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qtA"], { input: script, encoding: "utf8" }).trim();
}

const corporal = "(select id from public.ranks where code = 'PCPL')";
const demoEmployee = "(select id from public.employees where employee_number = '0-00001')";
const corporalCriterion = `(select id from public.promotion_criteria where target_rank_id = ${corporal})`;

/**
 * Makes the demo employee ready to file a promotion docket (Patrolman, long service, an active
 * Police Corporal criterion with no mandatory records) and returns a function that restores every row it touched.
 */
function arrangeReadyEmployee() {
  const saved = JSON.parse(localSql(`select json_build_object(
    'employee', (select json_build_object('rankId', rank_id, 'startedOn', employment_started_on) from public.employees where id = ${demoEmployee}),
    'criterion', (select json_build_object('isActive', is_active, 'years', minimum_years_of_service, 'rating', minimum_performance_rating) from public.promotion_criteria where id = ${corporalCriterion}),
    'mandatory', (select coalesce(json_agg(id), '[]') from public.promotion_criteria_requirements where criterion_id = ${corporalCriterion} and is_mandatory),
    'dockets', (select coalesce(json_agg(d), '[]') from public.employee_promotion_dockets d where employee_id = ${demoEmployee} and criterion_id = ${corporalCriterion}));`));
  if (!saved.employee) throw new Error("The demo employee 0-00001 is missing from the seed data.");

  localSql(`begin;
    insert into public.promotion_criteria (target_rank_id, minimum_years_of_service, is_active)
      select ${corporal}, 1, true where not exists (select 1 from public.promotion_criteria where target_rank_id = ${corporal});
    update public.promotion_criteria set is_active = true, minimum_years_of_service = 1, minimum_performance_rating = null where id = ${corporalCriterion};
    update public.promotion_criteria_requirements set is_mandatory = false where criterion_id = ${corporalCriterion};
    delete from public.employee_promotion_dockets where employee_id = ${demoEmployee} and criterion_id = ${corporalCriterion};
    update public.employees set rank_id = (select id from public.ranks where code = 'PAT'), employment_started_on = '2015-01-01' where id = ${demoEmployee};
    commit;`);

  const literal = (value: unknown) => (value === null || value === undefined ? "null" : `'${String(value).replaceAll("'", "''")}'`);
  return {
    restore() {
      const criterion = saved.criterion
        ? `update public.promotion_criteria set is_active = ${saved.criterion.isActive}, minimum_years_of_service = ${literal(saved.criterion.years)}, minimum_performance_rating = ${literal(saved.criterion.rating)} where id = ${corporalCriterion};`
        : `delete from public.promotion_criteria where id = ${corporalCriterion};`;
      const mandatory = saved.mandatory.length ? `update public.promotion_criteria_requirements set is_mandatory = true where id in (${saved.mandatory.map(literal).join(", ")});` : "";
      localSql(`begin;
        delete from public.employee_promotion_dockets where employee_id = ${demoEmployee} and criterion_id = ${corporalCriterion};
        insert into public.employee_promotion_dockets select * from jsonb_populate_recordset(null::public.employee_promotion_dockets, ${literal(JSON.stringify(saved.dockets))}::jsonb);
        update public.employees set rank_id = ${literal(saved.employee.rankId)}, employment_started_on = ${literal(saved.employee.startedOn)} where id = ${demoEmployee};
        ${mandatory}
        ${criterion}
        commit;`);
    },
  };
}

async function signIn(page: Page, account: { email: string; home: string }) {
  await openLoginAndSignIn(page, account.email, demoPassword);
  await expect(page).toHaveURL(new RegExp(`${account.home}$`), { timeout: 30_000 });
}

test.describe("Security: confidentiality, integrity, and authenticity", () => {
  test("the Employee / HR badge login keeps each role on its own home", async ({ page }) => {
    await page.goto("/login?as=employee");
    await expect(page.getByRole("heading", { level: 1, name: "Employee / HR" })).toBeVisible();
    for (const [badge, home] of [["0-00002", "/hr"], ["0-00004", "/admin"], ["0-00003", "/management"], ["0-00001", "/employee"]] as const) {
      await openLoginAndSignIn(page, { mode: "employee", identifier: badge }, demoPassword);
      await expect(page).toHaveURL(new RegExp(`${home}$`), { timeout: 30_000 });
      await page.context().clearCookies();
    }
  });

  const protectedRoutes = ["/hr/employees", "/hr/applications", "/hr/deployments", "/hr/promotions", "/hr/attendance", "/employee/leave", "/employee/attendance", "/reports", "/admin/users", "/notifications"];

  test("every protected page requires signing in", async ({ page }) => {
    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page, `${route} must redirect to login`).toHaveURL(/\/login\?/);
    }
  });

  const denied: [keyof typeof accounts, string[]][] = [
    ["employee", ["/hr/employees", "/hr/attendance/kiosk", "/hr/attendance/face-enrollment", "/reports", "/admin/users"]],
    ["management", ["/hr/employees", "/hr/leave-requests", "/employee/leave", "/admin/audit-logs"]],
    ["applicant", ["/employee", "/hr/applications", "/reports"]],
    ["hr", ["/admin/users", "/admin/audit-logs", "/employee/attendance"]],
  ];
  for (const [role, routes] of denied) {
    test(`${role} cannot open other roles' workspaces`, async ({ page }) => {
      await signIn(page, accounts[role]);
      for (const route of routes) {
        await page.goto(route);
        await expect(page, `${role} must be denied ${route}`).toHaveURL(/\/unauthorized$/);
      }
    });
  }
});

test.describe("Performance efficiency: time behaviour", () => {
  test("key HR pages render within 5 seconds", async ({ page }) => {
    await signIn(page, accounts.hr);
    for (const route of ["/hr", "/hr/employees", "/hr/applications", "/hr/deployments", "/hr/attendance", "/reports/deployments"]) {
      const started = Date.now();
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 5_000 });
      expect(Date.now() - started, `${route} load time`).toBeLessThan(5_000);
    }
  });
});

test.describe("Interaction capability (usability): accessibility", () => {
  const pages: [keyof typeof accounts | "public", string[]][] = [
    ["public", ["/", "/login", "/login?as=applicant", "/login?as=employee", "/applicant/register", "/jobs"]],
    ["applicant", ["/applicant", "/applicant/profile", "/applicant/documents", "/applicant/applications"]],
    ["hr", ["/hr", "/hr/jobs", "/hr/jobs/new", "/hr/applications", "/hr/applications?view=applicants", "/hr/employees", "/hr/employees/new", "/hr/leave-requests", "/hr/deployments", "/hr/deployments?create=1", "/hr/promotions", "/hr/promotions?criteria=1", "/hr/attendance", "/hr/public-site", "/hr/public-site?new=1", "/reports"]],
    ["employee", ["/employee", "/employee/profile", "/employee/leave", "/employee/leave?request=1", "/employee/deployments", "/employee/attendance", "/employee/promotion-eligibility"]],
    ["management", ["/management"]],
  ];
  for (const [role, routes] of pages) {
    test(`${role} pages have no serious or critical accessibility violations`, async ({ page }) => {
      if (role !== "public") await signIn(page, accounts[role]);
      for (const route of routes) {
        await page.goto(route);
        // Panel routes open a modal or slide-over, which hides the page behind it from assistive technology.
        const opensPanel = /[?&](create|criteria|new|request)=/.test(route);
        await expect(opensPanel ? page.getByRole("dialog").first() : page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 15_000 });
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
        expect(blocking.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} element(s))`), `${route}`).toEqual([]);
      }
      if (role === "hr") {
        // The applicant review page, reached from the list like a user would.
        await page.goto("/hr/applications?quick=all");
        const firstApplication = page.getByRole("link", { name: "View Profile" }).first();
        if (await firstApplication.count()) {
          await firstApplication.click();
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 15_000 });
          const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
          expect(blocking.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} element(s))`), "applicant review").toEqual([]);
        }
      }
    });
  }
  test("the employee promotion docket dialog has no serious or critical accessibility violations", async ({ page }) => {
    const arranged = arrangeReadyEmployee();
    try {
      await signIn(page, accounts.employee);
      await page.goto("/employee/promotion-eligibility");
      await expect(page.getByRole("heading", { level: 1, name: "Promotion Status" })).toBeVisible();
      await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 15_000 });
      const file = page.getByRole("button", { name: "Submit to Promotion Board" });
      await expect(file).toHaveCount(1);
      await file.click();
      await expect(page.getByRole("dialog").first()).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
      expect(blocking.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} element(s))`), "promotion docket dialog").toEqual([]);
    } finally {
      arranged.restore();
    }
  });
});

test.describe("Reliability: fault tolerance", () => {
  test("unknown pages and records fail safely", async ({ page }) => {
    await signIn(page, accounts.hr);
    const missing = await page.goto("/this-page-does-not-exist");
    expect(missing?.status()).toBe(404);
    await page.goto("/hr/employees/00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { level: 1 }).or(page.getByRole("alert")).first()).toBeVisible();
    await expect(page.getByText(/Application error|Unhandled Runtime Error/)).toHaveCount(0);
  });
});
