import { test, expect } from "@playwright/test";

// Every role's main screens must fit a 390px phone without page-level
// horizontal scrolling (wide tables scroll inside their own container).
// Applicant and public text stays at 14px or more. The HR/Admin workspace uses
// the denser approved scale (spec 2026-10-07 §3.2), whose smallest step is 12px
// (table headers and badges); redesigned HR screens are also checked at laptop widths.
const WORKSPACE_MIN_FONT = 12;
const APPLICANT_MIN_FONT = 14;
const sets: [string, string, string[]][] = [
  ["demo.admin@example.test", "/admin", ["/admin", "/admin/users", "/admin/departments", "/admin/ranks", "/admin/settings", "/admin/audit-logs", "/admin/profile-change-requests", "/admin/integrations/attendance"]],
  ["demo.hr@example.test", "/hr", ["/hr", "/hr/employees", "/hr/jobs", "/hr/applications", "/hr/leave-requests", "/hr/deployments", "/hr/promotions", "/hr/promotions/criteria", "/hr/attendance", "/hr/public-site", "/reports"]],
  ["demo.employee@example.test", "/employee", ["/employee", "/employee/profile", "/employee/leave", "/employee/deployments", "/employee/attendance", "/notifications"]],
  ["demo.applicant@example.test", "/applicant", ["/applicant", "/applicant/profile", "/applicant/applications", "/applicant/documents", "/jobs"]],
  ["demo.management@example.test", "/management", ["/management", "/reports"]],
];
for (const [email, home, paths] of sets) {
  test(`${home} screens fit a phone and keep text readable`, async ({ page }) => {
    test.setTimeout(180_000);
    const minFont = home === "/applicant" ? APPLICANT_MIN_FONT : WORKSPACE_MIN_FONT;
    const widths = home === "/hr" ? [390, 1024, 1366] : [390];
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("textbox", { name: "Password" }).fill(process.env.HRIS_E2E_PASSWORD ?? "DemoPass!2026");
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForURL(new RegExp(home + "$"));
    const bad: string[] = [];
    for (const width of widths) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      for (const path of paths) {
        await page.goto(path);
        await page.waitForLoadState("load");
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const small = await page.evaluate((min) => [...document.querySelectorAll("main *, [id=main-content] *")].filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(el).fontSize) < min && (el as HTMLElement).offsetParent !== null).map((el) => `${el.tagName}:${parseFloat(getComputedStyle(el).fontSize)}:${el.textContent!.trim().slice(0, 30)}`).slice(0, 3), minFont);
        if (overflow > 0) bad.push(`${path} at ${width}px scrolls horizontally by ${overflow}px`);
        if (small.length) bad.push(`${path} at ${width}px has text under ${minFont}px: ${small.join(", ")}`);
      }
    }
    expect(bad).toEqual([]);
  });
}

test("the public landing page fits a phone and keeps text readable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const small = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(el).fontSize) < 14 && (el as HTMLElement).offsetParent !== null).map((el) => `${el.tagName}:${parseFloat(getComputedStyle(el).fontSize)}:${el.textContent!.trim().slice(0, 30)}`).slice(0, 3));
  expect(overflow).toBeLessThanOrEqual(0);
  expect(small).toEqual([]);
});
