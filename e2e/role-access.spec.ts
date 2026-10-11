import { expect, test } from "@playwright/test";
import { fillLogin, signOutFromShell } from "./demo-accounts";

const demoPassword = process.env.HRIS_E2E_PASSWORD ?? "DemoPass!2026";
const roles = [
  { label: "System Administrator", email: "demo.admin@example.test", home: "/admin", denied: "/hr" },
  { label: "HR Personnel", email: "demo.hr@example.test", home: "/hr", denied: "/admin" },
  { label: "Applicant", email: "demo.applicant@example.test", home: "/applicant", denied: "/hr" },
  { label: "Employee", email: "demo.employee@example.test", home: "/employee", denied: "/hr" },
  { label: "Management", email: "demo.management@example.test", home: "/management", denied: "/hr" },
] as const;

for (const role of roles) {
  test(`${role.label} can sign in, keep a session, and is denied another workspace`, async ({ page }) => {
    await page.goto(role.home);
    await expect(page).toHaveURL(/\/login\?/);

    await fillLogin(page, role.email, demoPassword);
    await expect(page).toHaveURL(new RegExp(`${role.home}$`));
    // Applicants' account menu is named after the applicant; staff menus after their email.
    await expect(page.getByRole("button", { name: role.home === "/applicant" ? "Account menu for Demo Applicant" : new RegExp(`Account menu for ${role.email}`) })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${role.home}$`));

    await page.goto(role.denied);
    await expect(page).toHaveURL(/\/unauthorized$/);
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();

    await page.goto(role.home);
    await signOutFromShell(page);
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);

    await page.goto(role.home);
    await expect(page).toHaveURL(/\/login\?/);
  });
}

test("invalid credentials show a safe error and do not create a session", async ({ page }) => {
  await page.goto("/login?as=applicant&next=/applicant");
  await page.getByLabel("Email Address").fill("demo.applicant@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill("incorrect-local-test-password");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/login\?.*error=invalid_credentials/);
  await expect(page.getByText(/We could not sign you in\./)).toBeVisible();
  await page.goto("/applicant");
  await expect(page).toHaveURL(/\/login\?/);
});

test("employees, HR and System Administrators all sign in at the Employee / HR login with their badge number", async ({ page }) => {
  for (const [badge, home] of [["0-00001", "/employee"], ["0-00002", "/hr"], ["0-00004", "/admin"]] as const) {
    await page.goto("/login?as=employee");
    await expect(page.getByLabel("Access Level")).toHaveCount(0);
    await page.getByLabel("Badge Number").fill(badge);
    await page.getByRole("textbox", { name: "Password" }).fill(demoPassword);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL(new RegExp(`${home}$`), { timeout: 30_000 });
    await page.context().clearCookies();
  }
});

test("the old Admin & HR Login link opens the Employee / HR login", async ({ page }) => {
  await page.goto("/login?as=admin");
  await expect(page).toHaveURL(/\/login\?as=employee/);
  await expect(page.getByRole("heading", { level: 1, name: "Employee / HR" })).toBeVisible();
});
