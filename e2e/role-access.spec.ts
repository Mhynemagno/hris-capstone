import { expect, test } from "@playwright/test";

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

    await page.getByLabel("Email").fill(role.email);
    await page.getByRole("textbox", { name: "Password" }).fill(demoPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`${role.home}$`));
    await expect(page.getByRole("button", { name: new RegExp(`Account menu for ${role.email}`) })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${role.home}$`));

    await page.goto(role.denied);
    await expect(page).toHaveURL(/\/unauthorized$/);
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();

    await page.goto(role.home);
    await page.getByRole("button", { name: new RegExp(`Account menu for ${role.email}`) }).click();
    await page.getByRole("menu").getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto(role.home);
    await expect(page).toHaveURL(/\/login\?/);
  });
}

test("invalid credentials show a safe error and do not create a session", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo.applicant@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill("incorrect-local-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/login\?error=invalid_credentials/);
  await expect(page.getByText(/We could not sign you in\./)).toBeVisible();
  await page.goto("/applicant");
  await expect(page).toHaveURL(/\/login\?/);
});
