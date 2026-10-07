p = "e2e/iso25010-quality.spec.ts"
s = open(p, encoding="utf-8").read()
a = '["hr", ["/hr", "/hr/employees", "/hr/employees/new", "/hr/leave-requests", "/hr/attendance", "/hr/public-site", "/reports"]],'
assert a in s
s = s.replace(a, '["hr", ["/hr", "/hr/jobs", "/hr/jobs/new", "/hr/applications", "/hr/applications?view=applicants", "/hr/employees", "/hr/employees/new", "/hr/leave-requests", "/hr/attendance", "/hr/public-site", "/reports"]],', 1)
open(p, "w", encoding="utf-8").write(s)

p = "e2e/responsive-layout.spec.ts"
s = open(p, encoding="utf-8").read()
a = '''// Every role's main screens must fit a 390px phone without page-level
// horizontal scrolling (wide tables scroll inside their own container) and
// must not render visible text smaller than 14px.
const sets: [string, string, string[]][] = ['''
assert a in s
s = s.replace(a, '''// Every role's main screens must fit a 390px phone without page-level
// horizontal scrolling (wide tables scroll inside their own container).
// Applicant and public text stays at 14px or more. The HR/Admin workspace uses
// the denser approved scale (spec 2026-10-07 §3.2), whose smallest step is 12px
// (table headers and badges); redesigned HR screens are also checked at laptop widths.
const WORKSPACE_MIN_FONT = 12;
const APPLICANT_MIN_FONT = 14;
const sets: [string, string, string[]][] = [''', 1)
a = '''    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");'''
assert a in s
s = s.replace(a, '''    const minFont = home === "/applicant" ? APPLICANT_MIN_FONT : WORKSPACE_MIN_FONT;
    const widths = home === "/hr" ? [390, 1024, 1366] : [390];
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");''', 1)
a = '''    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const small = await page.evaluate(() => [...document.querySelectorAll("main *, [id=main-content] *")].filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(el).fontSize) < 14 && (el as HTMLElement).offsetParent !== null).map((el) => `${el.tagName}:${parseFloat(getComputedStyle(el).fontSize)}:${el.textContent!.trim().slice(0, 30)}`).slice(0, 3));
      if (overflow > 0) bad.push(`${path} scrolls horizontally by ${overflow}px`);
      if (small.length) bad.push(`${path} has text under 14px: ${small.join(", ")}`);
    }'''
assert a in s
s = s.replace(a, '''    for (const width of widths) {
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
    }''', 1)
open(p, "w", encoding="utf-8").write(s)
print("ok")
