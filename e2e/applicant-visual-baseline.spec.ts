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

// Job cards are intentionally absent when no openings are published. Keep the
// /jobs baseline focused on the page's stable structure, not mutable content.
const JOBS_PROBES = PROBES.filter((selector) => selector !== "main a");

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
      out[selector] = Object.fromEntries(properties.map((name) => [name, style.getPropertyValue(name)]));
    }
    return out;
  }, { probes: [...probes], properties: [...PROPERTIES] });
}

async function signInApplicant(page: Page) {
  await page.goto("/login?as=applicant&next=/applicant");
  await page.getByLabel("Applicant Number").fill("202604");
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
      await expect(page).toHaveScreenshot(`${path.replaceAll("/", "_")}.png`, { fullPage: true, maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide" });
      expect(JSON.stringify(await styleSignature(page), null, 2)).toMatchSnapshot(`${path.replaceAll("/", "_")}.styles.json`);
    });
  }

  for (const path of ["/", "/jobs"]) {
    test(`public page ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const probes = path === "/jobs" ? JOBS_PROBES : PROBES;
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
});
