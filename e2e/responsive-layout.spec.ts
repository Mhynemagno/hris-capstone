import { test, expect } from "@playwright/test";

// Every role's main screens must fit a 390px phone without page-level
// horizontal scrolling (wide tables scroll inside their own container) and
// must not render visible text smaller than 14px.
const sets: [string, string, string[]][] = [
  ["demo.admin@example.test", "/admin", ["/admin", "/admin/users", "/admin/departments", "/admin/ranks", "/admin/settings", "/admin/audit-logs", "/admin/profile-change-requests", "/admin/integrations/attendance"]],
  ["demo.hr@example.test", "/hr", ["/hr", "/hr/employees", "/hr/jobs", "/hr/applications", "/hr/leave-requests", "/hr/deployments", "/hr/promotions", "/hr/promotions/criteria", "/hr/attendance", "/reports"]],
  ["demo.employee@example.test", "/employee", ["/employee", "/employee/profile", "/employee/leave", "/employee/deployments", "/employee/attendance", "/notifications"]],
  ["demo.applicant@example.test", "/applicant", ["/applicant", "/applicant/profile", "/applicant/applications", "/jobs"]],
  ["demo.management@example.test", "/management", ["/management", "/reports"]],
];
for (const [email, home, paths] of sets) {
  test(`${home} screens fit a phone and keep text readable`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("textbox", { name: "Password" }).fill(process.env.HRIS_E2E_PASSWORD ?? "DemoPass!2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(new RegExp(home + "$"));
    const bad: string[] = [];
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const small = await page.evaluate(() => [...document.querySelectorAll("main *, [id=main-content] *")].filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(el).fontSize) < 14 && (el as HTMLElement).offsetParent !== null).map((el) => `${el.tagName}:${parseFloat(getComputedStyle(el).fontSize)}:${el.textContent!.trim().slice(0, 30)}`).slice(0, 3));
      if (overflow > 0) bad.push(`${path} scrolls horizontally by ${overflow}px`);
      if (small.length) bad.push(`${path} has text under 14px: ${small.join(", ")}`);
    }
    expect(bad).toEqual([]);
  });
}
