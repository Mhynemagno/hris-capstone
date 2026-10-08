import { expect, test, type Page } from "@playwright/test";

import { formatDate } from "../src/lib/format-date";

// These journeys create and remove their own uniquely named records in the
// LOCAL Supabase stack only (playwright.config.ts refuses non-local URLs).

const demoPassword = process.env.HRIS_E2E_PASSWORD ?? "DemoPass!2026";
const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

// First visits compile routes on the dev server, so allow for slower navigation.
test.describe.configure({ timeout: 90_000 });

async function signIn(page: Page, email: string, home: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(demoPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(new RegExp(`${home}$`));
}

async function signOut(page: Page, email: string) {
  await page.getByRole("button", { name: new RegExp(`Account menu for ${email}`) }).click();
  await page.getByRole("menu").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

function isoDate(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

test.describe("administrator master data", () => {
  test("creates a department that survives reload, then deletes it", async ({ page }) => {
    const name = `E2E Department ${runId}`;
    await signIn(page, "demo.admin@example.test", "/admin");
    await page.goto("/admin/departments");

    // Navigation shows the current location.
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Units / Sections" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("button", { name: "Add unit / section" }).click();
    const panel = page.getByRole("dialog", { name: "Add unit / section" });
    await panel.getByRole("button", { name: "Save unit / section" }).click();
    await expect(panel.getByRole("alert").first()).toBeVisible();

    await panel.getByLabel(/^Name/).fill(name);
    await panel.getByRole("button", { name: "Save unit / section" }).click();
    await expect(page.getByRole("status")).toContainText(`${name} was added`);

    await page.getByLabel("Search units / sections").fill(name);
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
    await page.reload();
    await page.getByLabel("Search units / sections").fill(name);
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();

    await expect(page.getByRole("button", { name: `Edit ${name}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Deactivate ${name}` })).toHaveCount(0);

    // An unused unit / section is deleted straight away (no force needed).
    await page.getByRole("button", { name: `Delete ${name}` }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(`Delete ${name}?`);
    await dialog.getByRole("button", { name: "Delete unit / section" }).click();
    await expect(page.getByRole("status")).toContainText("The unit / section was deleted successfully.");
    await expect(page.getByRole("cell", { name, exact: true })).toHaveCount(0);
  });

  test("lists the station ranks with their codes and a delete action", async ({ page }) => {
    await signIn(page, "demo.admin@example.test", "/admin");
    await page.goto("/admin/ranks");
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Ranks" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("cell", { name: "PAT", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Patrolman / Patrolwoman", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "PCOL", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete Patrolman / Patrolwoman" })).toBeVisible();
  });
});

test.describe("leave journey", () => {
  test("HR manages a leave type lifecycle: create, deactivate, then delete while unused", async ({ page }) => {
    const typeName = `E2E Leave ${runId}`;
    await signIn(page, "demo.hr@example.test", "/hr");
    await page.goto("/hr/leave-requests");
    await page.getByRole("tab", { name: "Leave types" }).click();

    await page.getByLabel(/^Name/).first().fill(typeName);
    await page.getByRole("button", { name: "Add leave type" }).click();
    await expect(page.getByRole("status").first()).toContainText(`${typeName} was added`);

    await page.getByRole("button", { name: `Deactivate ${typeName}` }).click();
    await expect(page.getByRole("button", { name: `Activate ${typeName}` })).toBeVisible();

    await page.getByRole("button", { name: `Delete ${typeName}` }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Delete leave type" }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByText(typeName)).toHaveCount(0);
  });

  test("employee submits leave, invalid dates are caught inline, and HR approves it", async ({ page }) => {
    const reason = `E2E leave reason ${runId}`;
    const offset = 60 + Math.floor(Math.random() * 200);
    await signIn(page, "demo.employee@example.test", "/employee");
    await page.goto("/employee/leave/new");

    await page.getByLabel(/^Leave type/).selectOption({ label: "Demo leave" });
    await page.getByLabel(/^Start date/).fill(isoDate(offset + 3));
    await page.getByLabel(/^End date/).fill(isoDate(offset));
    await page.getByLabel(/^Notes/).fill(reason);
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByText(/end date/i).and(page.getByRole("alert"))).toBeVisible();

    await page.getByLabel(/^End date/).fill(isoDate(offset + 4));
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByRole("status").filter({ hasText: /submitted/i })).toBeVisible();

    await page.goto("/employee/leave");
    const request = page.getByRole("article").filter({ hasText: reason });
    await expect(request).toContainText("For Approval");
    await signOut(page, "demo.employee@example.test");

    await signIn(page, "demo.hr@example.test", "/hr");
    await page.goto("/hr/leave-requests");
    await page.getByRole("link", { name: new RegExp(`Review .+'s Demo leave request, ${formatDate(isoDate(offset + 3))}`) }).click();
    await expect(page).toHaveURL(/\/hr\/leave-requests\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByText(reason)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Approve request" }).click();
    await expect(page.getByRole("status").filter({ hasText: "approved" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Approve request" })).toHaveCount(0);
    await signOut(page, "demo.hr@example.test");

    await signIn(page, "demo.employee@example.test", "/employee");
    await page.goto("/employee/leave");
    await expect(page.getByRole("article").filter({ hasText: reason })).toContainText(/approved/i);
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText(/leave request/i).first()).toBeVisible();
  });
});

test.describe("personnel records and profile changes", () => {
  test("editing a personnel record keeps its department, rank, and linked account", async ({ page }) => {
    const phone = `+63917${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    await signIn(page, "demo.hr@example.test", "/hr");
    await page.goto("/hr/employees");
    await page.getByRole("link", { name: /0-00001|Demo/ }).first().click();
    await expect(page).toHaveURL(/\/hr\/employees\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const recordUrl = page.url();
    await page.goto(`${recordUrl}?tab=official&mode=edit`);

    await expect(page.getByRole("tab", { name: "Official record" })).toHaveAttribute("aria-selected", "true");
    const department = page.getByLabel(/^Unit \/ Section/).first();
    const rank = page.getByLabel(/^Rank/).first();
    await department.selectOption({ label: "Traffic and Investigation Section" });
    await rank.selectOption({ label: "PCPL — Police Corporal" });
    const departmentBefore = await department.inputValue();
    const rankBefore = await rank.inputValue();
    expect(departmentBefore).not.toBe("");
    expect(rankBefore).not.toBe("");

    // The demo record may predate the required personal details; complete any that are still blank.
    const completeIfBlank = async (selector: string, value: string, kind: "fill" | "select" = "fill") => {
      const field = page.locator(selector);
      if (await field.count() === 0 || await field.inputValue() !== "") return;
      if (kind === "select") await field.selectOption(value);
      else await field.fill(value);
    };
    await completeIfBlank("#place-of-birth", "San Juan City");
    await completeIfBlank("#date-of-birth", "1995-05-15");
    await completeIfBlank("#gender", "female", "select");
    await completeIfBlank("#civil-status", "single", "select");
    await completeIfBlank("#religion", "Roman Catholic");
    await completeIfBlank("#address", "1 Test St., San Juan City");
    await completeIfBlank("#emergency-contact-name", "Test Contact");
    await completeIfBlank("#emergency-contact-phone", "+639181234567");
    await completeIfBlank("#employment-started-on", "2015-06-01");
    await page.locator("#phone").fill(phone);
    await page.getByRole("button", { name: "Save employee" }).click();
    await page.waitForURL(`${recordUrl}?tab=official&saved=edited`);
    await page.goto(`${recordUrl}?tab=official&mode=edit`);

    await expect(page.getByLabel(/^Phone/).first()).toHaveValue(phone);
    await expect(page.getByLabel(/^Unit \/ Section/).first()).toHaveValue(departmentBefore);
    await expect(page.getByLabel(/^Rank/).first()).toHaveValue(rankBefore);
    await signOut(page, "demo.hr@example.test");

    // The linked account still resolves to the same record after the edit.
    await signIn(page, "demo.employee@example.test", "/employee");
    await page.goto("/employee/profile");
    await expect(page.getByText(phone)).toBeVisible();
  });

  test("an employee's contact change is approved by an administrator and applied", async ({ page }) => {
    const contact = `E2E Contact ${runId}`;
    await signIn(page, "demo.employee@example.test", "/employee");
    await page.goto("/employee/profile/change-request");
    await page.getByLabel(/^Emergency contact name/).fill(contact);
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByRole("status").filter({ hasText: /submitted|sent/i })).toBeVisible();
    await signOut(page, "demo.employee@example.test");

    await signIn(page, "demo.admin@example.test", "/admin");
    await page.goto("/admin/profile-change-requests");
    await page.getByRole("link", { name: /^Review request/ }).first().click();
    await expect(page).toHaveURL(/\/admin\/profile-change-requests\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByText(contact)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Approve request" }).click();
    await expect(page.getByRole("button", { name: "Approve request" })).toHaveCount(0);
    await signOut(page, "demo.admin@example.test");

    await signIn(page, "demo.employee@example.test", "/employee");
    await page.goto("/employee/profile");
    await expect(page.getByText(contact)).toBeVisible();
  });
});

test.describe("read-only and public journeys", () => {
  test("management can read reports but sees no record mutation controls", async ({ page }) => {
    await signIn(page, "demo.management@example.test", "/management");
    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /delete|deactivate|approve/i })).toHaveCount(0);
    await page.goto("/admin/departments");
    await expect(page).toHaveURL(/\/unauthorized$/);
  });

  test("public visitors can browse an opening HR published, without signing in", async ({ page }) => {
    const title = `E2E Opening ${runId}`;
    await signIn(page, "demo.hr@example.test", "/hr");
    await page.goto("/hr/jobs/new");
    await page.getByLabel(/^Title/).fill(title);
    await page.getByLabel(/^Location/).fill("San Juan City Police Station");
    await page.getByLabel(/^Deadline of Application/).fill("2099-12-31");
    await page.getByLabel(/^Description/).fill("An opening published by the end-to-end journey tests.");
    await page.getByLabel(/^Requirement 1: Education/).selectOption("Baccalaureate Degree");
    await page.getByLabel(/^Requirement 2: Eligibility/).selectOption("NAPOLCOM PNP Entrance Examination");
    await page.getByRole("button", { name: "Publish opening" }).click();
    await expect(page).toHaveURL(/\/hr\/jobs$/);
    await signOut(page, "demo.hr@example.test");

    await page.goto("/jobs");
    await page.getByRole("link", { name: new RegExp(title) }).first().click();
    await expect(page.getByRole("heading", { name: new RegExp(title) })).toBeVisible();
  });

  test("an announcement HR publishes appears on the public landing page", async ({ page }) => {
    const title = `E2E Announcement ${runId}`;
    await signIn(page, "demo.hr@example.test", "/hr");
    await page.goto("/hr/public-site");
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Announcements" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("button", { name: "New announcement" }).click();
    const form = page.getByRole("form", { name: "New announcement" });
    await form.getByLabel(/^Title/).fill(title);
    await form.getByLabel(/^Category/).selectOption("advisory");
    await form.getByLabel(/^Summary/).fill("Road works near the station this weekend.");
    await form.getByLabel(/^Announcement text/).fill("First paragraph.\n\nSecond paragraph.");
    await form.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(`${title} was saved as a draft.`)).toBeVisible();

    await page.getByRole("button", { name: `Publish ${title}` }).click();
    await expect(page.getByText(`${title} is now published on the landing page.`)).toBeVisible();
    await signOut(page, "demo.hr@example.test");

    await page.goto("/");
    const announcements = page.getByRole("region", { name: "Announcements" });
    await expect(announcements.getByRole("heading", { name: title })).toBeVisible();
    await announcements.getByRole("link", { name: `Read more about ${title}` }).click();
    await expect(page).toHaveURL(/\/announcements\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Second paragraph.")).toBeVisible();
  });
});
