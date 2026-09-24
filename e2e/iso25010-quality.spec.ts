import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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

async function signIn(page: Page, account: { email: string; home: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByRole("textbox", { name: "Password" }).fill(demoPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${account.home}$`), { timeout: 30_000 });
}

test.describe("Security: confidentiality, integrity, and authenticity", () => {
  const protectedRoutes = ["/hr/employees", "/hr/applications", "/hr/deployments", "/hr/promotions", "/hr/attendance", "/employee/leave", "/employee/attendance/scan", "/reports", "/admin/users", "/notifications"];

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
    ["hr", ["/admin/users", "/admin/audit-logs", "/employee/attendance/scan"]],
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
    ["public", ["/", "/login", "/jobs"]],
    ["hr", ["/hr", "/hr/employees", "/hr/employees/new", "/hr/leave-requests", "/hr/attendance", "/reports"]],
    ["employee", ["/employee", "/employee/leave/new", "/employee/attendance"]],
    ["management", ["/management"]],
  ];
  for (const [role, routes] of pages) {
    test(`${role} pages have no serious or critical accessibility violations`, async ({ page }) => {
      if (role !== "public") await signIn(page, accounts[role]);
      for (const route of routes) {
        await page.goto(route);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 15_000 });
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
        expect(blocking.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} element(s))`), `${route}`).toEqual([]);
      }
    });
  }
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
