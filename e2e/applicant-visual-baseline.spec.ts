import { expect, test, type Page } from "@playwright/test";

// Guards the redesign's hard constraint: approved pages (applicant, public, Employee / HR login, HR, employee) look exactly as approved.
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

// Content links are intentionally absent when the corresponding data is empty.
// Keep those baselines focused on stable page structure, not mutable rows/cards.
const CONTENT_AGNOSTIC_PROBES = PROBES.filter((selector) => selector !== "main a");

const PROPERTIES = [
  "font-family", "font-size", "font-weight", "line-height", "color", "background-color",
  "border-top-color", "border-top-left-radius", "min-height", "padding-left", "box-shadow",
] as const;

async function styleSignature(page: Page, probes: readonly string[] = PROBES) {
  return page.evaluate(({ probes, properties }) => {
    const out: Record<string, Record<string, string> | null> = {};
    for (const selector of probes) {
      const element = document.querySelector(selector);
      if (!element) { out[selector] = null; continue; }
      const style = getComputedStyle(element);
      // Chromium's lab() colour conversion differs in the fifth decimal between Windows and Linux builds;
      // three decimals keep the snapshot meaningful and identical across platforms.
      out[selector] = Object.fromEntries(properties.map((name) => [name, style.getPropertyValue(name).replace(/-?\d+\.\d+/g, (value) => Number(value).toFixed(3))]));
    }
    return out;
  }, { probes: [...probes], properties: [...PROPERTIES] });
}

async function signInHr(page: Page) {
  await page.goto("/login?as=employee&next=/hr");
  await page.getByLabel("Badge Number").fill("0-00002");
  await page.getByRole("textbox", { name: "Password" }).fill(demoPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/hr$/, { timeout: 30_000 });
}

async function signInEmployee(page: Page) {
  await page.goto("/login?as=employee&next=/employee");
  await page.getByLabel("Badge Number").fill("0-00001");
  await page.getByRole("textbox", { name: "Password" }).fill(demoPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/employee$/, { timeout: 30_000 });
}

async function signInApplicant(page: Page) {
  await page.goto("/login?as=applicant&next=/applicant");
  await page.getByLabel("Email Address").fill("demo.applicant@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill(demoPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/applicant$/, { timeout: 30_000 });
}

test.describe("applicant, admin login and HR pages keep their approved look", () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  for (const path of ["/login", "/login?as=applicant", "/login?as=employee", "/applicant/register"]) {
    test(`static page ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const name = path.replaceAll("/", "_").replace("?as=", "_as_");
      // The Recruitment Notice names whichever posting is open when the test runs.
      await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide", mask: [page.locator("[data-recruitment-notice]")] });
      expect(JSON.stringify(await styleSignature(page), null, 2)).toMatchSnapshot(`${name}.styles.json`);
    });
  }

  for (const path of ["/", "/jobs"]) {
    test(`public page ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const probes = path === "/jobs" ? CONTENT_AGNOSTIC_PROBES : PROBES;
      expect(JSON.stringify(await styleSignature(page, probes), null, 2)).toMatchSnapshot(`${path === "/" ? "_home" : path.replaceAll("/", "_")}.styles.json`);
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

  test("signed-in HR pages", async ({ page }) => {
    await signInHr(page);
    for (const path of ["/hr", "/hr/jobs", "/hr/applications", "/hr/deployments", "/hr/leave-requests", "/hr/promotions", "/hr/attendance", "/reports", "/hr/public-site"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const probes = path === "/hr/applications" || path === "/hr/deployments" ? CONTENT_AGNOSTIC_PROBES : PROBES;
      expect(JSON.stringify(await styleSignature(page, probes), null, 2)).toMatchSnapshot(`${path.replaceAll("/", "_")}.styles.json`);
    }
  });

  test("signed-in employee pages", async ({ page }) => {
    await signInEmployee(page);
    for (const path of ["/employee", "/employee/profile", "/employee/leave", "/employee/deployments", "/employee/attendance", "/employee/promotion-eligibility"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(JSON.stringify(await styleSignature(page, CONTENT_AGNOSTIC_PROBES), null, 2)).toMatchSnapshot(`${path.replaceAll("/", "_")}.styles.json`);
    }
  });
});
